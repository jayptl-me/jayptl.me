'use strict';

const crypto = require('node:crypto');
const net = require('node:net');

const MAX_BODY_BYTES = 8 * 1024;
const MAX_LIMITER_KEYS = 50000;

/**
 * Headers every API answer carries. The API only speaks JSON, so nothing
 * it returns may run as a page, be framed, or leak a referrer.
 */
const BASE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000',
  'Cross-Origin-Resource-Policy': 'same-site',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
};

class HttpError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

function send(res, status, body, headers = {}) {
  const data = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    ...BASE_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    ...headers
  });
  res.end(data);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const type = String(req.headers['content-type'] || '');
    if (!type.startsWith('application/json')) {
      reject(new HttpError(415, 'unsupported_media_type', 'Send application/json'));
      return;
    }
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        // Keep draining so the 413 reaches the client, but store nothing.
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (tooLarge) {
        reject(new HttpError(413, 'too_large', 'Body too large'));
        return;
      }
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch (e) {
        reject(new HttpError(400, 'bad_json', 'Body is not valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Client IP for rate limits only, never stored or logged.
 *
 * The host's proxy APPENDS to X-Forwarded-For instead of replacing it, so
 * a visitor can put any address at the front of that list and dodge every
 * limit. The edge network in front of the host overwrites its own
 * connecting-IP headers on every request, so those are read first; the
 * forwarded list is only a fallback (local runs, tests). The order is
 * configurable with TRUSTED_IP_HEADERS.
 */
const DEFAULT_IP_HEADERS = ['cf-connecting-ip', 'true-client-ip', 'x-forwarded-for'];

function clientIp(req, headerNames = DEFAULT_IP_HEADERS) {
  for (const name of headerNames) {
    const raw = String(req.headers[name] || '').split(',')[0].trim();
    if (raw && net.isIP(raw)) return raw;
  }
  return req.socket.remoteAddress || 'unknown';
}

/** fetch with a hard deadline, so a hung upstream never hangs a request. */
function fetchWithTimeout(fetchImpl, url, options = {}, ms = 8000) {
  return fetchImpl(url, { ...options, signal: AbortSignal.timeout(ms) });
}

/** Constant-time check of an "Authorization: Bearer <secret>" header. */
function bearerOk(req, secret) {
  if (!secret) return false;
  const header = String(req.headers.authorization || '');
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** HMAC-signed opaque token: "<payload>.<signature>". */
function sign(payload, secret) {
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verify(token, secret) {
  if (typeof token !== 'string' || !secret) return null;
  const i = token.lastIndexOf('.');
  if (i <= 0) return null;
  const payload = token.slice(0, i);
  const expected = sign(payload, secret);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? payload : null;
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * In-memory fixed-window rate limiter keyed by bucket and IP. Memory
 * only, so IPs are never written anywhere and vanish on restart.
 */
function createLimiter(now = () => Date.now()) {
  const windows = new Map();
  let lastSweep = now();

  function sweep(t, force) {
    if (!force && t - lastSweep <= 60000) return;
    for (const [k, w] of windows) if (w.resetAt <= t) windows.delete(k);
    // A flood of distinct addresses must not grow memory without bound.
    if (windows.size > MAX_LIMITER_KEYS) windows.clear();
    lastSweep = t;
  }

  function current(id, t) {
    const w = windows.get(id);
    return w && w.resetAt > t ? w : null;
  }

  /** Count one request; true while the key is within its limit. */
  function allow(bucket, key, limit, windowMs) {
    const t = now();
    sweep(t, windows.size > MAX_LIMITER_KEYS);
    const id = bucket + '|' + key;
    let w = current(id, t);
    if (!w) {
      w = { count: 0, resetAt: t + windowMs };
      windows.set(id, w);
    }
    w.count++;
    return w.count <= limit;
  }

  /** True when the key has already used up its limit (does not count). */
  allow.blocked = function blocked(bucket, key, limit) {
    const w = current(bucket + '|' + key, now());
    return Boolean(w && w.count >= limit);
  };

  return allow;
}

module.exports = {
  HttpError, send, readJson, clientIp, fetchWithTimeout, bearerOk, sign, verify, sha256, createLimiter,
  BASE_HEADERS, DEFAULT_IP_HEADERS
};
