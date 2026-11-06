'use strict';

/** POST /v1/hit and GET /v1/views: a path and a number, nothing about the visitor. */

const { HttpError } = require('../../core/errors');
const { readJson } = require('../../core/http');
const { createSitemap } = require('./sitemap');

function normalizePath(p) {
  if (typeof p !== 'string' || p.length > 200 || p[0] !== '/') return null;
  return p.split(/[?#]/)[0].replace(/\/+$/, '').replace(/\.html$/, '') || '/';
}

function createViews(ctx) {
  const { store, need, limit } = ctx;
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
