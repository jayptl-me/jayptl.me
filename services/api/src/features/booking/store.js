'use strict';

/**
 * Booking keys:
 *   bk:<id>          hash   one booking (guest data, deleted after 30 days)
 *   bk:start         zset   booking ids by start time (ms)
 *   bk:email:<hash>  set    upcoming booking ids for one email (hashed)
 *   bk:lock:<ms>     string short lock while one request books a slot
 */

const { hashToObject, DAY_MS } = require('../../core/redis-shapes');

function toBooking(reply) {
  const h = hashToObject(reply);
  if (!h) return null;
  h.start = Number(h.start);
  h.end = Number(h.end);
  return h;
}

/**
 * keepDays: guest data is gone this many days after the call. The tick
 * deletes it; the key's own expiry does it too, so the promise holds even
 * when no tick runs.
 */
function createBookingStore(redis, { keepDays = 30 } = {}) {
  async function booking(id) {
    return toBooking(await redis.command(['HGETALL', 'bk:' + id]));
  }

  /** Every booking for a list of ids in one round trip, in the same order. */
  async function many(ids) {
    if (!ids || !ids.length) return [];
    const replies = await redis.pipeline(ids.map((id) => ['HGETALL', 'bk:' + id]));
    return replies.map(toBooking).filter(Boolean);
  }

  return {
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
        ['PEXPIREAT', 'bk:' + b.id, b.end + keepDays * DAY_MS],
        ['ZADD', 'bk:start', b.start, b.id],
        ['SADD', 'bk:email:' + emailHash, b.id],
        // Lives exactly as long as the latest booking it lists (GT: never shortened).
        ['PEXPIREAT', 'bk:email:' + emailHash, b.end + keepDays * DAY_MS, 'GT'],
        ['PEXPIREAT', 'bk:email:' + emailHash, b.end + keepDays * DAY_MS, 'NX']
      ]);
    },

    booking,

    async bookingsBetween(fromMs, toMs) {
      return many(await redis.command(['ZRANGEBYSCORE', 'bk:start', fromMs, toMs]));
    },

    async upcomingForEmail(emailHash, nowMs) {
      const list = await many(await redis.command(['SMEMBERS', 'bk:email:' + emailHash]));
      return list.filter((b) => b.end > nowMs).length;
    },

    /** Drop start-index entries up to a time; their bookings are already gone. */
    async dropIndexBefore(ms) {
      await redis.command(['ZREMRANGEBYSCORE', 'bk:start', '-inf', ms]);
    },

    /**
     * The expiry is set again with the link: if a cancel deleted the
     * booking a moment earlier, the leftover field still goes away.
     */
    async setMeet(b, link) {
      await redis.pipeline([
        ['HSET', 'bk:' + b.id, 'meet', link || 'added'],
        ['PEXPIREAT', 'bk:' + b.id, b.end + keepDays * DAY_MS]
      ]);
    },

    async deleteBooking(b, emailHash) {
      await redis.pipeline([
        ['DEL', 'bk:' + b.id],
        ['ZREM', 'bk:start', b.id],
        ['SREM', 'bk:email:' + emailHash, b.id]
      ]);
    }
  };
}

module.exports = { createBookingStore };
