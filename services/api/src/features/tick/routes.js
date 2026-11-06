'use strict';

/**
 * POST /v1/tick (TICK_SECRET), once a minute from an outside scheduler:
 * the uptime heartbeat, then the booking jobs.
 */

function createTick(ctx, { uptime, booking }) {
  const { store, now, need, secret, config, on } = ctx;
  return {
    routes: {
      'POST /v1/tick': async (req) => {
        need('tick', 'Tick');
        secret(req, config.tickSecret);
        const t = now();
        await store.heartbeat(t);
        uptime.invalidate();
        const result = { ok: true, at: new Date(t).toISOString(), meetLinks: 0, released: 0, cleaned: 0, errors: 0 };
        if (on.booking) {
          await booking.jobs.sync(t, result);
          await booking.jobs.addMeetLinks(t, result);
          await booking.jobs.cleanup(t, result);
        }
        return result;
      }
    }
  };
}

module.exports = { createTick };
