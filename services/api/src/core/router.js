'use strict';

/**
 * The request handler: CORS, the static admin pages, route lookup, 405
 * and 404 answers, one log line per request, and errors that never leak.
 */

const crypto = require('node:crypto');
const { HttpError } = require('./errors');
const { BASE_HEADERS, send } = require('./http');

const PAGE_CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'";

function createRouter({ routes, pages = {}, config, now, log }) {
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
      const page = req.method === 'GET' && pages[url.pathname];
      if (page) {
        res.writeHead(200, { ...BASE_HEADERS, 'Content-Type': page.type, 'Content-Security-Policy': PAGE_CSP });
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

module.exports = { createRouter };
