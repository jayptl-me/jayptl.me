'use strict';

/** GET /v1/health: instant liveness, no storage. */
function createHealth(ctx) {
  const { now } = ctx;
  return {
    routes: {
      'GET /v1/health': async () => ({
        ok: true,
        service: 'jayptl-api',
        uptimeSeconds: Math.round((now() - ctx.startedAt) / 1000),
        time: new Date(now()).toISOString()
      })
    }
  };
}

module.exports = { createHealth };
