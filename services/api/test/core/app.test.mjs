// The router: CORS, security headers, 405 and 404, plain errors, features that are off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, ORIGIN } from '../helpers/boot.mjs';

test('CORS allows only the site origin, and preflight works', async () => {
  const t = await boot();
  const ok = await t.call('GET', '/v1/health');
  assert.equal(ok.headers.get('access-control-allow-origin'), ORIGIN);
  const other = await t.call('GET', '/v1/health', { origin: 'https://evil.example' });
  assert.equal(other.headers.get('access-control-allow-origin'), null);
  const pre = await t.call('OPTIONS', '/v1/hit');
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get('access-control-allow-methods'), /POST/);
  await t.close();
});

test('every answer carries security headers and a request id; wrong methods get 405', async () => {
  const t = await boot();
  const h = await t.call('GET', '/v1/health');
  assert.equal(h.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(h.headers.get('x-frame-options'), 'DENY');
  assert.match(h.headers.get('strict-transport-security'), /max-age=/);
  assert.match(h.headers.get('content-security-policy'), /default-src 'none'/);
  assert.match(h.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);
  const wrong = await t.call('PUT', '/v1/hit', { body: {} });
  assert.equal(wrong.status, 405);
  assert.equal(wrong.headers.get('allow'), 'POST, OPTIONS');
  assert.equal((await t.call('GET', '/v1/nope')).status, 404);
  await t.close();
});

test('an upstream calendar failure never leaks its code or path to visitors', async () => {
  const t = await boot();
  t.google.busy = async () => {
    const err = new Error('Google POST /freeBusy failed: 403');
    err.upstreamStatus = 403;
    throw err;
  };
  const r = await t.call('GET', '/v1/slots');
  assert.equal(r.status, 500);
  assert.deepEqual([r.body.error, r.body.message], ['server_error', 'Something went wrong']);
  await t.close();
});

test('features that are not configured answer 503, not a crash', async () => {
  const t = await boot({ env: { GOOGLE_REFRESH_TOKEN: '' } });
  const r = await t.call('GET', '/v1/slots');
  assert.equal(r.status, 503);
  assert.equal(r.body.error, 'not_configured');
  await t.close();
});
