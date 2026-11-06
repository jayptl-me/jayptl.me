'use strict';

/**
 * jayptl.me API: page views, uptime, booking, now playing.
 *
 * createApp(deps) returns a Node request handler. Every outside thing is
 * injected (config, store, calendar, game platform, fetch, clock), so
 * tests run the real routes against fakes. Each feature lives in its own
 * folder under features/ and hands back its routes; this file only joins
 * them and gives them the shared helpers in ctx.
 *
 * Public:  GET /v1/health, GET /v1/status, POST /v1/hit, GET /v1/views,
 *          GET /v1/slots, POST /v1/book, POST /v1/cancel, GET /v1/playing
 * Secret:  POST /v1/tick (TICK_SECRET), GET /v1/export (ADMIN_SECRET),
 *          POST|DELETE /v1/admin/playing, GET /v1/admin/ip-check
 *          (ADMIN_SECRET), GET /admin (page)
 */

const { HttpError } = require('./errors');
const { bearerOk } = require('./auth');
const { clientIp } = require('./client-ip');
const { createLimiter } = require('./rate-limit');
const { features } = require('./config');
const { createRouter } = require('./router');
const { createHealth } = require('../features/health/routes');
const { createUptime } = require('../features/uptime/routes');
const { createViews } = require('../features/views/routes');
const { createBooking } = require('../features/booking/routes');
const { createPlaying } = require('../features/playing/routes');
const { createAdmin } = require('../features/admin/routes');
const { createTick } = require('../features/tick/routes');

// Wrong secrets: 10 tries per address per 15 minutes, then locked out
// until the window passes, even with the right one.
const AUTH_FAIL_LIMIT = 10;
const AUTH_FAIL_WINDOW_MS = 15 * 60000;

function createApp({ config, store, google, steam, fetch = globalThis.fetch, now = () => Date.now(), log = () => {}, maxLimiterKeys }) {
  const on = features(config);
  const allow = createLimiter(now, { maxKeys: maxLimiterKeys });
  // Wrong-key counts get their own limiter: no flood of public requests
  // can push a locked address out.
  const authFails = createLimiter(now, { maxKeys: maxLimiterKeys });

  const ctx = { config, on, store, google, steam, fetch, now, log, allow, startedAt: now() };

  ctx.ipOf = (req) => clientIp(req, config.clientIp);

  ctx.need = (flag, what) => {
    if (!on[flag]) throw new HttpError(503, 'not_configured', `${what} is not configured on this server`);
  };

  ctx.limit = (req, bucket, max, windowMs) => {
    if (!allow(bucket, ctx.ipOf(req), max, windowMs)) {
      throw new HttpError(429, 'rate_limited', 'Too many requests, slow down');
    }
  };

  ctx.secret = (req, value) => {
    const ip = ctx.ipOf(req);
    if (authFails.blocked('auth-fail', ip, AUTH_FAIL_LIMIT)) {
      throw new HttpError(429, 'rate_limited', 'Too many wrong keys, try again later');
    }
    if (!bearerOk(req, value)) {
      authFails('auth-fail', ip, AUTH_FAIL_LIMIT, AUTH_FAIL_WINDOW_MS);
      throw new HttpError(401, 'unauthorized', 'Missing or wrong bearer token');
    }
  };

  const health = createHealth(ctx);
  const uptime = createUptime(ctx);
  const views = createViews(ctx);
  const booking = createBooking(ctx);
  const playing = createPlaying(ctx);
  const admin = createAdmin(ctx);
  const tick = createTick(ctx, { uptime, booking });

  const routes = {
    ...health.routes,
    ...uptime.routes,
    ...views.routes,
    ...booking.routes,
    ...playing.routes,
    ...tick.routes,
    ...admin.routes
  };

  return createRouter({ routes, pages: admin.pages, config, now, log });
}

module.exports = { createApp };
