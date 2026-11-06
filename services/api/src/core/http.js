'use strict';

/**
 * JSON in and out: the headers every answer carries, send(), and a capped
 * JSON body reader.
 */

const { HttpError } = require('./errors');

const MAX_BODY_BYTES = 8 * 1024;

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
      let body;
      try {
        body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
      } catch (e) {
        reject(new HttpError(400, 'bad_json', 'Body is not valid JSON'));
        return;
      }
      // Every route reads fields off an object; null, a list or a bare
      // value would otherwise surface as a crash and a 500.
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        reject(new HttpError(400, 'bad_json', 'Send a JSON object'));
        return;
      }
      resolve(body);
    });
    req.on('error', reject);
  });
}

module.exports = { BASE_HEADERS, MAX_BODY_BYTES, send, readJson };
