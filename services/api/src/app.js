'use strict';

/**
 * jayptl.me API: page views, uptime, booking, now playing.
 *
 * createApp(deps) returns a Node request handler. Every outside thing is
 * injected (config, store, google, steam, fetch, clock), so tests run the
 * real routes against fakes.
 *
 * Public:  GET /v1/health, GET /v1/status, POST /v1/hit, GET /v1/views,
 *          GET /v1/slots, POST /v1/book, POST /v1/cancel, GET /v1/playing
 * Secret:  POST /v1/tick (TICK_SECRET), GET /v1/export (ADMIN_SECRET),
 *          POST|DELETE /v1/admin/playing (ADMIN_SECRET), GET /admin (page)
 */

const crypto = require('node:crypto');
const {
  HttpError, send, readJson, clientIp, fetchWithTimeout, bearerOk, sign, verify, sha256, createLimiter, BASE_HEADERS
} = require('./util');
const { openSlots } = require('./slots');
const { features } = require('./config');
const { ADMIN_HTML, ADMIN_JS, ADMIN_CSS } = require('./admin-page');

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const MIN_FILL_MS = 3000;
const SITEMAP_TTL_MS = 6 * 3600 * 1000;
const STATUS_TTL_MS = 30 * 1000;
// How often the tick asks the calendar about upcoming calls (declines,
// events deleted by hand). Cheap: one read per upcoming call.
const SYNC_EVERY_MS = 10 * 60000;
// Wrong secrets: 10 tries per address per 15 minutes, then locked out
// until the window passes, even with the right one.
const AUTH_FAIL_LIMIT = 10;
const AUTH_FAIL_WINDOW_MS = 15 * 60000;

function createApp({ config, store, google, steam, fetch = globalThis.fetch, now = () => Date.now(), log = () => {} }) {
  const on = features(config);
  const allow = createLimiter(now);
  const startedAt = now();
  let sitemap = { paths: new Set(config.extraPaths), at: 0, loading: null };
  let statusCache = { at: 0, value: null };
  let lastSync = 0;

  /* ---- Helpers ----------------------------------------------------------- */

  function cors(req) {
    const origin = req.headers.origin;
    if (origin && config.allowedOrigins.includes(origin)) {
      return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '600',
        Vary: 'Origin'
      };
    }
    return { Vary: 'Origin' };
  }

  function need(flag, what) {
    if (!on[flag]) throw new HttpError(503, 'not_configured', `${what} is not configured on this server`);
  }

  function ipOf(req) {
    return clientIp(req, config.trustedIpHeaders);
  }

  function limit(req, bucket, max, windowMs) {
    if (!allow(bucket, ipOf(req), max, windowMs)) {
      throw new HttpError(429, 'rate_limited', 'Too many requests, slow down');
    }
  }

  function secret(req, value) {
    const ip = ipOf(req);
    if (allow.blocked('auth-fail', ip, AUTH_FAIL_LIMIT)) {
      throw new HttpError(429, 'rate_limited', 'Too many wrong keys, try again later');
    }
    if (!bearerOk(req, value)) {
      allow('auth-fail', ip, AUTH_FAIL_LIMIT, AUTH_FAIL_WINDOW_MS);
      throw new HttpError(401, 'unauthorized', 'Missing or wrong bearer token');
    }
  }

  /** Paths that may be counted: the live sitemap, refreshed every 6h. */
  async function allowedPaths() {
    if (now() - sitemap.at < SITEMAP_TTL_MS) return sitemap.paths;
    if (!sitemap.loading) {
      sitemap.loading = (async () => {
        try {
          const res = await fetchWithTimeout(fetch, config.sitemapUrl, { headers: { Accept: 'application/xml' } }, 8000);
          if (!res.ok) throw new Error('sitemap answered ' + res.status);
          const xml = await res.text();
          const set = new Set(config.extraPaths);
          for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
            try {
              const p = new URL(m[1]).pathname.replace(/\/+$/, '') || '/';
              set.add(p);
            } catch (e) { /* skip bad loc */ }
          }
          if (set.size > config.extraPaths.length) sitemap = { paths: set, at: now(), loading: null };
        } catch (e) {
          log('sitemap fetch failed', e.message);
        }
        sitemap.loading = null;
      })();
    }
    await sitemap.loading;
    return sitemap.paths;
  }

  function normalizePath(p) {
    if (typeof p !== 'string' || p.length > 200 || p[0] !== '/') return null;
    return p.split(/[?#]/)[0].replace(/\/+$/, '').replace(/\.html$/, '') || '/';
  }

  function slotRange(query) {
    const today = new Date(now()).toISOString().slice(0, 10);
    const from = /^\d{4}-\d{2}-\d{2}$/.test(query.get('from') || '') ? query.get('from') : today;
    const toDay = /^\d{4}-\d{2}-\d{2}$/.test(query.get('to') || '') ? query.get('to') : null;
    const fromMs = Date.parse(from + 'T00:00:00Z') - 86400000; // include zones ahead of UTC
    const toMs = toDay ? Date.parse(toDay + 'T23:59:59Z') + 86400000 : now() + config.booking.horizonDays * 86400000;
    return { fromMs, toMs };
  }

  async function computeSlots(fromMs, toMs) {
    const rules = config.booking;
    const busy = await google.busy(fromMs, toMs, rules.timeZone);
    const ours = await store.bookingsBetween(fromMs - 86400000, toMs + 86400000);
    // Our own bookings block their slots at once, even before Google's
    // free/busy reflects the new event.
    return openSlots(rules, {
      nowMs: now(), fromMs, toMs,
      busy: busy.concat(ours.map((b) => ({ start: b.start, end: b.end }))),
      taken: ours.map((b) => b.start)
    });
  }

  async function playing() {
    const manual = await store.manualPlaying();
    let fromSteam = null;
    if (on.steam) {
      const cached = await store.cachedSteam();
      if (cached !== undefined) {
        fromSteam = cached;
      } else {
        try {
          fromSteam = await steam.activity();
        } catch (e) {
          log('steam failed', e.message);
          fromSteam = null;
        }
        await store.cacheSteam(fromSteam);
      }
    }
    const pick = [fromSteam && { ...fromSteam, platform: 'Steam', source: 'steam' },
      manual && { ...manual, now: Boolean(manual.now), source: 'manual' }]
      .filter(Boolean)
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
    return pick || null;
  }

  /* ---- Routes ------------------------------------------------------------ */

  const routes = {
    'GET /v1/health': async () => ({ ok: true, service: 'jayptl-api', uptimeSeconds: Math.round((now() - startedAt) / 1000), time: new Date(now()).toISOString() }),

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
    },

    'POST /v1/hit': async (req) => {
      need('redis', 'Storage');
      limit(req, 'hit', 120, 60000);
      const body = await readJson(req);
      const path = normalizePath(body.path);
      if (!path || !(await allowedPaths()).has(path)) throw new HttpError(404, 'unknown_path', 'Only site pages are counted');
      const { views, total } = await store.hit(path);
      return { path, views, total };
    },

    'GET /v1/views': async (req, url) => {
      need('redis', 'Storage');
      limit(req, 'views', 120, 60000);
      const path = normalizePath(url.searchParams.get('path') || '/');
      if (!path || !(await allowedPaths()).has(path)) throw new HttpError(404, 'unknown_path', 'Only site pages are counted');
      const { views, total } = await store.views(path);
      return { path, views, total };
    },

    'GET /v1/slots': async (req, url) => {
      need('booking', 'Booking');
      limit(req, 'slots', 30, 60000);
      const { fromMs, toMs } = slotRange(url.searchParams);
      const slots = await computeSlots(fromMs, toMs);
      return {
        timeZone: config.booking.timeZone,
        slotMinutes: config.booking.slotMinutes,
        slots: slots.map((ms) => new Date(ms).toISOString())
      };
    },

    'POST /v1/book': async (req) => {
      need('booking', 'Booking');
      limit(req, 'book-burst', 10, 3600000);
      const body = await readJson(req);
      // Bots fill every field and submit instantly; people do neither.
      if (body.company) throw new HttpError(400, 'rejected', 'Booking rejected');
      if (!(Number(body.elapsed) >= MIN_FILL_MS)) throw new HttpError(400, 'too_fast', 'Take a second, then try again');
      const name = String(body.name || '').trim().slice(0, 80);
      const email = String(body.email || '').trim().toLowerCase().slice(0, 120);
      const note = String(body.note || '').trim().slice(0, 500);
      const slotMs = Date.parse(body.slot);
      if (!name) throw new HttpError(400, 'name_required', 'Name is required');
      if (!EMAIL_RE.test(email)) throw new HttpError(400, 'email_invalid', 'That email does not look right');
      if (!Number.isFinite(slotMs)) throw new HttpError(400, 'slot_invalid', 'Pick a time first');
      if (!allow('book-day', ipOf(req), 5, 86400000)) throw new HttpError(429, 'rate_limited', 'Too many bookings from here today');
      const emailHash = sha256(email);
      if ((await store.upcomingForEmail(emailHash, now())) >= 2) {
        throw new HttpError(429, 'too_many_upcoming', 'You already have two upcoming calls');
      }
      const len = config.booking.slotMinutes * 60000;
      const id = crypto.randomBytes(9).toString('base64url');
      if (!(await store.claimSlot(slotMs, id))) throw new HttpError(409, 'slot_taken', 'That time is no longer free');
      try {
        // Re-check the calendar right now; the slot may have gone.
        const open = await computeSlots(slotMs - 3600000, slotMs + 3600000);
        if (!open.includes(slotMs)) throw new HttpError(409, 'slot_taken', 'That time is no longer free');
        const cancelToken = sign(id, config.tokenSecret);
        const event = await google.createEvent({
          start: slotMs, end: slotMs + len, name, email, note, timeZone: config.booking.timeZone,
          cancelUrl: `${config.siteUrl}/book#cancel=${encodeURIComponent(cancelToken)}`
        });
        try {
          await store.saveBooking({ id, eventId: event.id, name, email, note, start: slotMs, end: slotMs + len }, emailHash);
        } catch (e) {
          // Never leave an invite on the calendar that storage does not
          // know about: it could not be cancelled or cleaned up later.
          await google.deleteEvent(event.id).catch((err) => log('orphan event cleanup failed', err.message));
          throw e;
        }
        return {
          start: new Date(slotMs).toISOString(),
          end: new Date(slotMs + len).toISOString(),
          cancelToken
        };
      } finally {
        await store.releaseSlot(slotMs).catch(() => {});
      }
    },

    'POST /v1/cancel': async (req) => {
      need('booking', 'Booking');
      limit(req, 'cancel', 20, 3600000);
      const body = await readJson(req);
      const id = verify(body.token, config.tokenSecret);
      if (!id) throw new HttpError(400, 'bad_token', 'That cancel link is not valid');
      const b = await store.booking(id);
      if (!b) throw new HttpError(404, 'not_found', 'Already cancelled, or already past');
      await google.deleteEvent(b.eventId);
      await store.deleteBooking(b, sha256(b.email));
      return { ok: true };
    },

    'GET /v1/playing': async (req) => {
      need('redis', 'Storage');
      limit(req, 'playing', 60, 60000);
      return (await playing()) || {};
    },

    'POST /v1/tick': async (req) => {
      need('tick', 'Tick');
      secret(req, config.tickSecret);
      const t = now();
      await store.heartbeat(t);
      statusCache.at = 0;
      const result = { ok: true, at: new Date(t).toISOString(), meetLinks: 0, released: 0, cleaned: 0, errors: 0 };
      if (on.booking && t - lastSync >= SYNC_EVERY_MS) {
        // A guest who declines the invite, or a call deleted from the
        // calendar by hand, frees the slot and drops the guest data.
        lastSync = t;
        const upcoming = await store.bookingsBetween(t, t + config.booking.horizonDays * 86400000);
        for (const b of upcoming) {
          try {
            const state = await google.attendance(b.eventId, b.email);
            if (state === 'ok') continue;
            if (state === 'declined') await google.deleteEvent(b.eventId, { notify: false });
            await store.deleteBooking(b, sha256(b.email));
            result.released++;
          } catch (e) {
            log('calendar sync failed', b.id, e.message);
            result.errors++;
          }
        }
      }
      if (on.booking) {
        const lead = config.booking.meetLeadMinutes * 60000;
        const soon = await store.bookingsBetween(t, t + lead);
        for (const b of soon) {
          if (b.meet) continue;
          try {
            const link = await google.addMeet(b.eventId, 'jayptl-' + b.id);
            await store.setMeet(b.id, link);
            result.meetLinks++;
          } catch (e) {
            log('meet link failed', b.id, e.message);
            result.errors++;
          }
        }
        const old = await store.bookingsBetween(0, t - config.booking.keepDays * 86400000);
        for (const b of old) {
          await store.deleteBooking(b, sha256(b.email));
          result.cleaned++;
        }
      }
      return result;
    },

    'GET /v1/export': async (req) => {
      need('admin', 'Export');
      secret(req, config.adminSecret);
      const t = now();
      return {
        exportedAt: new Date(t).toISOString(),
        views: await store.allViews(),
        bookings: await store.bookingsBetween(t - config.booking.keepDays * 86400000, '+inf'),
        playing: await store.manualPlaying()
      };
    },

    'POST /v1/admin/playing': async (req) => {
      need('admin', 'Admin');
      secret(req, config.adminSecret);
      const body = await readJson(req);
      const game = String(body.game || '').trim().slice(0, 80);
      if (!game) throw new HttpError(400, 'game_required', 'Game is required');
      const at = body.at && Number.isFinite(Date.parse(body.at)) ? new Date(body.at).toISOString() : new Date(now()).toISOString();
      const entry = { game, platform: String(body.platform || '').trim().slice(0, 40), at, now: Boolean(body.now) };
      await store.setManualPlaying(entry);
      return entry;
    },

    'DELETE /v1/admin/playing': async (req) => {
      need('admin', 'Admin');
      secret(req, config.adminSecret);
      await store.setManualPlaying(null);
      return { ok: true };
    }
  };

  const STATIC = {
    '/admin': { type: 'text/html; charset=utf-8', body: ADMIN_HTML },
    '/admin.js': { type: 'text/javascript; charset=utf-8', body: ADMIN_JS },
    '/admin.css': { type: 'text/css; charset=utf-8', body: ADMIN_CSS }
  };

  /** Methods each path answers, for 405 answers with an Allow header. */
  const methodsByPath = {};
  for (const key of Object.keys(routes)) {
    const [method, path] = key.split(' ');
    (methodsByPath[path] = methodsByPath[path] || []).push(method);
  }

  return async function handle(req, res) {
    const started = now();
    let url;
    try {
      url = new URL(req.url, 'http://api.local');
    } catch (e) {
      url = new URL('http://api.local/');
    }
    const requestId = crypto.randomUUID();
    const headers = { ...cors(req), 'X-Request-Id': requestId };

    // One line per request: method, path, status, time. Never the query
    // string, body, IP or any guest detail. Health checks and preflights
    // are skipped when they succeed, so the log stays readable.
    res.on('finish', () => {
      const quiet = res.statusCode < 400 && (url.pathname === '/v1/health' || req.method === 'OPTIONS');
      if (!quiet) log(req.method, url.pathname, res.statusCode, `${now() - started}ms`, requestId);
    });

    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { ...BASE_HEADERS, ...headers });
        res.end();
        return;
      }
      const page = req.method === 'GET' && STATIC[url.pathname];
      if (page) {
        res.writeHead(200, {
          ...BASE_HEADERS,
          'Content-Type': page.type,
          'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'"
        });
        res.end(page.body);
        return;
      }
      if (req.method === 'GET' && url.pathname === '/') {
        send(res, 200, { service: 'jayptl-api', docs: 'https://jayptl.me/colophon' }, headers);
        return;
      }
      const route = routes[`${req.method} ${url.pathname}`];
      if (!route) {
        const allowed = methodsByPath[url.pathname];
        if (allowed) {
          headers.Allow = allowed.concat('OPTIONS').join(', ');
          throw new HttpError(405, 'method_not_allowed', 'That method is not allowed here');
        }
        throw new HttpError(404, 'not_found', 'No such endpoint');
      }
      const body = await route(req, url);
      send(res, 200, body, headers);
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) log('error', req.method, url.pathname, err.message, requestId);
      const message = status >= 500 && err.code !== 'not_configured' ? 'Something went wrong' : err.message;
      if (res.headersSent) {
        res.end();
        return;
      }
      send(res, status, { error: status >= 500 && err.code !== 'not_configured' ? 'server_error' : (err.code || 'error'), message, requestId }, headers);
    }
  };
}

module.exports = { createApp };
