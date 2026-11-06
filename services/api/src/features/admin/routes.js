'use strict';

/**
 * ADMIN_SECRET only: GET /v1/export (the backup), POST and DELETE
 * /v1/admin/playing, and the small /admin page that drives them.
 */

const { HttpError } = require('../../core/errors');
const { readJson } = require('../../core/http');
const { forwardedList, EDGE_HEADER } = require('../../core/client-ip');
const { ADMIN_HTML, ADMIN_JS, ADMIN_CSS } = require('./page');

function createAdmin(ctx) {
  const { config, store, now, need, secret, ipOf } = ctx;
  return {
    pages: {
      '/admin': { type: 'text/html; charset=utf-8', body: ADMIN_HTML },
      '/admin.js': { type: 'text/javascript; charset=utf-8', body: ADMIN_JS },
      '/admin.css': { type: 'text/css; charset=utf-8', body: ADMIN_CSS }
    },

    routes: {
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

      /**
       * The owner's own request, as the service sees it: which address the
       * rate limits use and what each address header says. Answered to
       * the caller only, never logged or stored. Used once after setup to
       * decide TRUST_EDGE_IP and FORWARDED_HOPS (README, "Visitor address").
       */
      'GET /v1/admin/ip-check': async (req) => {
        need('admin', 'Admin');
        secret(req, config.adminSecret);
        return {
          trustEdge: config.clientIp.trustEdge,
          forwardedHops: config.clientIp.hops,
          used: ipOf(req),
          edgeHeader: req.headers[EDGE_HEADER] || null,
          forwardedFor: forwardedList(req)
        };
      },

      'DELETE /v1/admin/playing': async (req) => {
        need('admin', 'Admin');
        secret(req, config.adminSecret);
        await store.setManualPlaying(null);
        return { ok: true };
      }
    }
  };
}

module.exports = { createAdmin };
