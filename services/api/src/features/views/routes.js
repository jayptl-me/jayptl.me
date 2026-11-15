'use strict';

/** POST /v1/hit and GET /v1/views: a path and a number, nothing about the visitor. */

const { HttpError } = require('../../core/errors');
const { readJson } = require('../../core/http');
const { createSitemap } = require('./sitemap');

function normalizePath(p) {
  if (typeof p !== 'string' || p.length > 200 || p[0] !== '/') return null;
  return p.split(/[?#]/)[0].replace(/\/+$/, '').replace(/\.html$/, '') || '/';
}

// A path another of our sites may report: plain URL characters only.
const SERVER_PATH = /^\/[A-Za-z0-9/._~%-]*$/;

function createViews(ctx) {
  const { store, need, limit, secret, allow, config } = ctx;
  const { allowedPaths } = createSitemap(ctx);

  async function countable(raw) {
    const path = normalizePath(raw);
    if (!path || !(await allowedPaths()).has(path)) throw new HttpError(404, 'unknown_path', 'Only site pages are counted');
    return path;
  }

  return {
    routes: {
      'POST /v1/hit': async (req) => {
        need('redis', 'Storage');
        limit(req, 'hit', 120, 60000);
        const body = await readJson(req);
        const path = await countable(body.path);
        const { views, total } = await store.hit(path);
        return { path, views, total };
      },

      // Another of our own sites reports a view from its server, signed with
      // HIT_SECRET. Its own limit per site: every such call comes from the
      // edge network's few addresses, so the per-address 120 would drop views.
      'POST /v1/hit/server': async (req) => {
        need('serverHit', 'Server counting');
        secret(req, config.hitSecret);
        const body = await readJson(req);
        const site = body.site;
        if (typeof site !== 'string' || !config.hitSites.includes(site)) throw new HttpError(400, 'unknown_site', 'That site is not counted here');
        const path = normalizePath(body.path);
        if (!path || !SERVER_PATH.test(path)) throw new HttpError(400, 'bad_path', 'Send a plain path');
        if (!allow('hit-server', site, config.hitServerPerMin, 60000)) throw new HttpError(429, 'rate_limited', 'Too many requests, slow down');
        const { views, total } = await store.siteHit(site, path);
        return { key: site + ':' + path, views, total };
      },

      'GET /v1/views': async (req, url) => {
        need('redis', 'Storage');
        limit(req, 'views', 120, 60000);
        const path = await countable(url.searchParams.get('path') || '/');
        const { views, total } = await store.views(path);
        return { path, views, total };
      }
    }
  };
}

module.exports = { createViews, normalizePath };
