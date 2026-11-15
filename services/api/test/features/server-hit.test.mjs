// POST /v1/hit/server: page views another of our own sites reports from its
// server (the notes site's edge middleware), signed with HIT_SECRET.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot } from '../helpers/boot.mjs';

const KEY = 'hit-secret';
const env = { HIT_SECRET: KEY };

test('a signed hit counts a notes path under its own namespace', async () => {
  const t = await boot({ env });
  const a = await t.call('POST', '/v1/hit/server', { token: KEY, origin: '', body: { site: 'notes', path: '/nudgifi/week-2/' } });
  assert.equal(a.status, 200);
  assert.deepEqual(a.body, { key: 'notes:/nudgifi/week-2', views: 1, total: 1 });
  const b = await t.call('POST', '/v1/hit/server', { token: KEY, origin: '', body: { site: 'notes', path: '/nudgifi/week-2' } });
  assert.deepEqual([b.body.views, b.body.total], [2, 2]);
  // The portfolio's own total is untouched, and the public read cannot see notes paths.
  assert.equal(t.redis.kv.get('v:total'), undefined);
  assert.equal(t.redis.kv.get('v:total:notes'), '2');
  const pub = await t.call('GET', '/v1/views?path=notes:/nudgifi/week-2');
  assert.equal(pub.status, 404);
  // Nothing about the visitor is stored: one hash field and one total.
  assert.deepEqual([...t.redis.hashes.get('v:paths').keys()], ['notes:/nudgifi/week-2']);
  await t.close();
});

test('a missing or wrong key counts nothing', async () => {
  const t = await boot({ env });
  const none = await t.call('POST', '/v1/hit/server', { body: { site: 'notes', path: '/' } });
  assert.equal(none.status, 401);
  const wrong = await t.call('POST', '/v1/hit/server', { token: 'nope', body: { site: 'notes', path: '/' } });
  assert.equal(wrong.status, 401);
  // The public site key is not this key.
  const tick = await t.call('POST', '/v1/hit/server', { token: 'tick-secret', body: { site: 'notes', path: '/' } });
  assert.equal(tick.status, 401);
  assert.equal(t.redis.hashes.has('v:paths'), false);
  await t.close();
});

test('only listed sites and plain paths are counted', async () => {
  const t = await boot({ env });
  const site = await t.call('POST', '/v1/hit/server', { token: KEY, body: { site: 'evil', path: '/' } });
  assert.equal(site.status, 400);
  for (const path of ['nudgifi', '/a b', '/' + 'x'.repeat(200), '/<script>', 42]) {
    const r = await t.call('POST', '/v1/hit/server', { token: KEY, body: { site: 'notes', path } });
    assert.equal(r.status, 400, 'refused: ' + String(path).slice(0, 20));
  }
  assert.equal(t.redis.hashes.has('v:paths'), false);
  // Negative control: query strings are dropped, not refused.
  const ok = await t.call('POST', '/v1/hit/server', { token: KEY, body: { site: 'notes', path: '/login?next=/x' } });
  assert.equal(ok.body.key, 'notes:/login');
  await t.close();
});

test('server hits have their own limit, not the public 120 a minute per address', async () => {
  const t = await boot({ env: { ...env, HIT_SERVER_PER_MIN: '150' } });
  // Every notes view arrives from the edge network's few addresses.
  for (let i = 0; i < 150; i++) {
    const r = await t.call('POST', '/v1/hit/server', { token: KEY, body: { site: 'notes', path: '/' } });
    assert.equal(r.status, 200, 'hit ' + (i + 1));
  }
  const over = await t.call('POST', '/v1/hit/server', { token: KEY, body: { site: 'notes', path: '/' } });
  assert.equal(over.status, 429);
  // The public counter on the same address still has its own allowance.
  const pub = await t.call('POST', '/v1/hit', { body: { path: '/' } });
  assert.equal(pub.status, 200);
  await t.close();
});

test('without HIT_SECRET the route says it is not configured', async () => {
  const t = await boot();
  const r = await t.call('POST', '/v1/hit/server', { token: '', body: { site: 'notes', path: '/' } });
  assert.equal(r.status, 503);
  await t.close();
});
