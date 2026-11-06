'use strict';

/** Secret checks and signed tokens. */

const crypto = require('node:crypto');

/**
 * Constant-time check of an "Authorization: Bearer <secret>" header. Both
 * sides are hashed first, so the compare always runs on equal lengths and
 * the time taken says nothing about the secret, its length included.
 */
function bearerOk(req, secret) {
  if (!secret) return false;
  const header = String(req.headers.authorization || '');
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(secret).digest();
  return crypto.timingSafeEqual(a, b);
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

/** A keyed hash: nobody without the key can test a list of values against it. */
function keyedHash(text, secret) {
  return crypto.createHmac('sha256', secret).update('email:' + text).digest('hex');
}

module.exports = { bearerOk, sign, verify, sha256, keyedHash };
