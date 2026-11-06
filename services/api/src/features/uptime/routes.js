'use strict';

/** GET /v1/status: storage reachable, last tick, uptime 24h and 30d, one bar per day. */

const STATUS_TTL_MS = 30 * 1000;

function createUptime(ctx) {
  const { store, now, need } = ctx;
  let statusCache = { at: 0, value: null };

  return {
    /** The tick calls this so a fresh heartbeat shows at once. */
    invalidate() {
      statusCache.at = 0;
    },

    routes: {
      'GET /v1/status': async () => {
        need('redis', 'Storage');
        if (now() - statusCache.at < STATUS_TTL_MS && statusCache.value) return statusCache.value;
        let redisOk = false;
        try {
          redisOk = (await store.ping()) === 'PONG';
        } catch (e) {
          redisOk = false;
        }
        const up = redisOk ? await store.uptime(now()) : { lastTick: null, uptime24h: 0, uptime30d: 0, days: [] };
        const value = {
          ok: redisOk,
          redis: redisOk,
          lastTick: up.lastTick,
          uptime24h: up.uptime24h,
          uptime30d: up.uptime30d,
          days: up.days
        };
        statusCache = { at: now(), value };
        return value;
      }
    }
  };
}

module.exports = { createUptime };
