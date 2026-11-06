'use strict';

/**
 * Uptime keys:
 *   up:YYYY-MM-DD  bitmap one bit per UTC minute a tick arrived
 *   up:since       string ISO time of the first tick
 *   up:last        string ISO time of the last tick
 */

const { DAY_MS } = require('../../core/redis-shapes');

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

/**
 * The per-day bitmap ranges covering [fromMs, toMs), never before the
 * first tick. Pure: no store access.
 */
function minuteRanges(fromMs, toMs, sinceMs) {
  const start = Math.max(floorMinute(fromMs), floorMinute(sinceMs));
  const end = floorMinute(toMs);
  const ranges = [];
  for (let t = start; t < end;) {
    const dayStart = Date.parse(utcDay(t) + 'T00:00:00Z');
    const stop = Math.min(end, dayStart + DAY_MS);
    ranges.push({ key: 'up:' + utcDay(t), from: (t - dayStart) / 60000, to: (stop - dayStart) / 60000 - 1 });
    t = stop;
  }
  return ranges;
}

const possibleOf = (ranges) => ranges.reduce((s, r) => s + (r.to - r.from + 1), 0);

function createUptimeStore(redis) {
  /**
   * Heartbeats for several windows at once: every BITCOUNT in one
   * pipeline, one round trip however many days are asked for.
   */
  async function minutesMany(windows) {
    const groups = windows.map(([fromMs, toMs, sinceMs]) => minuteRanges(fromMs, toMs, sinceMs));
    const flat = groups.flat();
    const counts = flat.length ? await redis.pipeline(flat.map((r) => ['BITCOUNT', r.key, r.from, r.to, 'BIT'])) : [];
    let i = 0;
    return groups.map((ranges) => {
      let up = 0;
      for (let k = 0; k < ranges.length; k++) up += Number(counts[i++]) || 0;
      return { up, possible: possibleOf(ranges) };
    });
  }

  /** Heartbeats and possible minutes in [fromMs, toMs). */
  async function minutes(fromMs, toMs, sinceMs) {
    return (await minutesMany([[fromMs, toMs, sinceMs]]))[0];
  }

  return {
    async heartbeat(nowMs) {
      const key = 'up:' + utcDay(nowMs);
      await redis.pipeline([
        ['SETBIT', key, minuteOfDay(nowMs), 1],
        ['EXPIRE', key, 40 * 86400],
        ['SET', 'up:since', new Date(nowMs).toISOString(), 'NX'],
        ['SET', 'up:last', new Date(nowMs).toISOString()]
      ]);
    },

    minutes,

    /** Uptime is the share of minutes that got a heartbeat. */
    async uptime(nowMs) {
      const [since, last] = await redis.pipeline([['GET', 'up:since'], ['GET', 'up:last']]);
      if (!since) return { since: null, lastTick: null, uptime24h: 0, uptime30d: 0, days: [] };
      const sinceMs = Date.parse(since);
      const end = floorMinute(nowMs) + 60000;
      const ratio = (m) => (m.possible ? Math.min(1, m.up / m.possible) : 0);
      const dayStarts = [];
      for (let i = 29; i >= 0; i--) dayStarts.push(Date.parse(utcDay(nowMs - i * DAY_MS) + 'T00:00:00Z'));
      const windows = dayStarts.map((d) => [d, Math.min(d + DAY_MS, end), sinceMs]);
      windows.push([end - DAY_MS, end, sinceMs], [end - 30 * DAY_MS, end, sinceMs]);
      const results = await minutesMany(windows);
      const last30 = results.pop();
      const last24 = results.pop();
      const days = [];
      results.forEach((m, i) => {
        if (m.possible) days.push({ date: utcDay(dayStarts[i]), uptime: ratio(m) });
      });
      return {
        since,
        lastTick: last,
        uptime24h: ratio(last24),
        uptime30d: ratio(last30),
        days
      };
    }
  };
}

module.exports = { createUptimeStore, minuteRanges, utcDay, minuteOfDay, floorMinute };
