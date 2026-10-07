'use strict';

/**
 * Every Redis key the API touches, in one place.
 *
 *   v:paths          hash   path -> reads            (views)
 *   v:total          string total reads              (views)
 *   up:YYYY-MM-DD    bitmap one bit per UTC minute a tick arrived
 *   up:since         string ISO time of the first tick
 *   up:last          string ISO time of the last tick
 *   bk:<id>          hash   one booking (guest data, deleted after 30 days)
 *   bk:start         zset   booking ids by start time (ms)
 *   bk:email:<hash>  set    upcoming booking ids for one email (hashed)
 *   bk:lock:<ms>     string short lock while one request books a slot
 *   play:manual      string JSON { game, platform, at } set from /admin
 *   play:steam       string JSON cache of the Steam answer, 5 minutes
 */

const DAY_MS = 86400000;

function utcDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function floorMinute(ms) {
  return Math.floor(ms / 60000) * 60000;
}

function minuteOfDay(ms) {
  const d = new Date(ms);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function hashToObject(arr) {
  if (!arr || !arr.length) return null;
  const out = {};
  for (let i = 0; i < arr.length; i += 2) out[arr[i]] = arr[i + 1];
  return out;
}

function createStore(redis) {
  return {
    ping() {
      return redis.command(['PING']);
    },

    /* ---- Views ---------------------------------------------------------- */
    async hit(path) {
      const [views, total] = await redis.pipeline([
        ['HINCRBY', 'v:paths', path, 1],
        ['INCR', 'v:total']
      ]);
      return { views: Number(views), total: Number(total) };
    },

    async views(path) {
      const [views, total] = await redis.pipeline([
        ['HGET', 'v:paths', path],
        ['GET', 'v:total']
      ]);
      return { views: Number(views || 0), total: Number(total || 0) };
    },

    async allViews() {
      const [paths, total] = await redis.pipeline([['HGETALL', 'v:paths'], ['GET', 'v:total']]);
      const map = hashToObject(paths) || {};
      Object.keys(map).forEach((k) => { map[k] = Number(map[k]); });
      return { paths: map, total: Number(total || 0) };
    },

    /* ---- Uptime --------------------------------------------------------- */
    async heartbeat(nowMs) {
      const key = 'up:' + utcDay(nowMs);
      await redis.pipeline([
        ['SETBIT', key, minuteOfDay(nowMs), 1],
        ['EXPIRE', key, 40 * 86400],
        ['SET', 'up:since', new Date(nowMs).toISOString(), 'NX'],
        ['SET', 'up:last', new Date(nowMs).toISOString()]
      ]);
    },

    /**
     * Heartbeats and possible minutes in [fromMs, toMs), split per UTC
     * day, never counting time before the first tick.
     */
    async minutes(fromMs, toMs, sinceMs) {
      const start = Math.max(floorMinute(fromMs), floorMinute(sinceMs));
      const end = floorMinute(toMs);
      if (end <= start) return { up: 0, possible: 0 };
      const ranges = [];
      for (let t = start; t < end;) {
        const dayStart = Date.parse(utcDay(t) + 'T00:00:00Z');
        const stop = Math.min(end, dayStart + DAY_MS);
        ranges.push({ key: 'up:' + utcDay(t), from: (t - dayStart) / 60000, to: (stop - dayStart) / 60000 - 1 });
        t = stop;
      }
      const counts = await redis.pipeline(ranges.map((r) => ['BITCOUNT', r.key, r.from, r.to, 'BIT']));
      return {
        up: counts.reduce((s, c) => s + (Number(c) || 0), 0),
        possible: ranges.reduce((s, r) => s + (r.to - r.from + 1), 0)
      };
    },

    /** Uptime is the share of minutes that got a heartbeat. */
    async uptime(nowMs) {
      const [since, last] = await redis.pipeline([['GET', 'up:since'], ['GET', 'up:last']]);
      if (!since) return { since: null, lastTick: null, uptime24h: 0, uptime30d: 0, days: [] };
      const sinceMs = Date.parse(since);
      const end = floorMinute(nowMs) + 60000;
      const ratio = (m) => (m.possible ? Math.min(1, m.up / m.possible) : 0);
      const days = [];
      for (let i = 29; i >= 0; i--) {
        const dayStart = Date.parse(utcDay(nowMs - i * DAY_MS) + 'T00:00:00Z');
        const m = await this.minutes(dayStart, Math.min(dayStart + DAY_MS, end), sinceMs);
        if (m.possible) days.push({ date: utcDay(dayStart), uptime: ratio(m) });
      }
      const last24 = await this.minutes(end - DAY_MS, end, sinceMs);
      const last30 = await this.minutes(end - 30 * DAY_MS, end, sinceMs);
      return {
        since,
        lastTick: last,
        uptime24h: ratio(last24),
        uptime30d: ratio(last30),
        days
      };
    },

    /* ---- Bookings ------------------------------------------------------- */

    /**
     * Only one request may book a given slot at a time. Two visitors who
     * press "Book it" together would otherwise both pass the free check
     * before either event exists. The lock expires on its own if the
     * process dies mid-booking.
     */
    async claimSlot(startMs, owner) {
      return (await redis.command(['SET', 'bk:lock:' + startMs, owner, 'NX', 'EX', 60])) === 'OK';
    },

    async releaseSlot(startMs) {
      await redis.command(['DEL', 'bk:lock:' + startMs]);
    },
    async saveBooking(b, emailHash) {
      await redis.pipeline([
        ['HSET', 'bk:' + b.id, 'id', b.id, 'eventId', b.eventId, 'name', b.name, 'email', b.email,
          'note', b.note || '', 'start', b.start, 'end', b.end, 'meet', b.meet || ''],
        ['ZADD', 'bk:start', b.start, b.id],
        ['SADD', 'bk:email:' + emailHash, b.id],
        ['EXPIRE', 'bk:email:' + emailHash, 60 * 86400]
      ]);
    },

    async booking(id) {
      const h = hashToObject(await redis.command(['HGETALL', 'bk:' + id]));
      if (!h) return null;
      h.start = Number(h.start);
      h.end = Number(h.end);
      return h;
    },

    async bookingsBetween(fromMs, toMs) {
      const ids = await redis.command(['ZRANGEBYSCORE', 'bk:start', fromMs, toMs]);
      const out = [];
      for (const id of ids || []) {
        const b = await this.booking(id);
        if (b) out.push(b);
      }
      return out;
    },

    async upcomingForEmail(emailHash, nowMs) {
      const ids = await redis.command(['SMEMBERS', 'bk:email:' + emailHash]);
      let n = 0;
      for (const id of ids || []) {
        const b = await this.booking(id);
        if (b && b.end > nowMs) n++;
      }
      return n;
    },

    async setMeet(id, link) {
      await redis.command(['HSET', 'bk:' + id, 'meet', link || 'added']);
    },

    async deleteBooking(b, emailHash) {
      await redis.pipeline([
        ['DEL', 'bk:' + b.id],
        ['ZREM', 'bk:start', b.id],
        ['SREM', 'bk:email:' + emailHash, b.id]
      ]);
    },

    /* ---- Now playing ---------------------------------------------------- */
    async manualPlaying() {
      const raw = await redis.command(['GET', 'play:manual']);
      try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
    },

    async setManualPlaying(entry) {
      if (!entry) return redis.command(['DEL', 'play:manual']);
      return redis.command(['SET', 'play:manual', JSON.stringify(entry)]);
    },

    async cachedSteam() {
      const raw = await redis.command(['GET', 'play:steam']);
      try { return raw ? JSON.parse(raw) : undefined; } catch (e) { return undefined; }
    },

    async cacheSteam(value) {
      return redis.command(['SET', 'play:steam', JSON.stringify(value), 'EX', 300]);
    }
  };
}

module.exports = { createStore, utcDay, minuteOfDay };
