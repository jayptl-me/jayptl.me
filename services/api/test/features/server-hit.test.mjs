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
  // Nothing about the visitor is stored: one field in the site's own hash, and its total.
  assert.deepEqual([...t.redis.hashes.get('v:site:notes').keys()], ['/nudgifi/week-2']);
  assert.equal(t.redis.hashes.has('v:paths'), false, 'the portfolio hash is untouched');
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
  assert.equal(t.redis.hashes.has('v:site:notes'), false);
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
  assert.equal(t.redis.hashes.has('v:site:notes'), false);
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

test('wrong keys from the shared edge address cannot lock out the right key', async () => {
  const t = await boot({ env });
  // Ten wrong keys from the same address the notes site's calls come from.
  for (let i = 0; i < 12; i++) await t.call('POST', '/v1/hit/server', { token: 'guess-' + i, body: { site: 'notes', path: '/' } });
  const locked = await t.call('POST', '/v1/hit/server', { token: 'guess-x', body: { site: 'notes', path: '/' } });
  assert.equal(locked.status, 429, 'guessing stays locked out');
  const ok = await t.call('POST', '/v1/hit/server', { token: KEY, body: { site: 'notes', path: '/' } });
  assert.equal(ok.status, 200, 'the real key still counts');
  await t.close();
});

test('the admin export keeps other sites apart, with their own totals', async () => {
  const t = await boot({ env });
  await t.call('POST', '/v1/hit', { body: { path: '/about' } });
  await t.call('POST', '/v1/hit/server', { token: KEY, body: { site: 'notes', path: '/nudgifi/a' } });
  await t.call('POST', '/v1/hit/server', { token: KEY, body: { site: 'notes', path: '/nudgifi/a' } });
  const ex = await t.call('GET', '/v1/export', { token: 'admin-secret' });
  assert.deepEqual(ex.body.views.paths, { '/about': 1 });
  assert.equal(ex.body.views.total, 1);
  assert.deepEqual(ex.body.views.sites, { notes: { paths: { '/nudgifi/a': 2 }, total: 2 } });
  await t.close();
});

test('a site holds at most HIT_SITE_MAX_PATHS distinct paths, so a leaked key cannot fill storage', async () => {
  const t = await boot({ env: { ...env, HIT_SITE_MAX_PATHS: '3' } });
  for (const p of ['/a', '/b', '/c']) assert.equal((await t.call('POST', '/v1/hit/server', { token: KEY, body: { site: 'notes', path: p } })).status, 200);
  const full = await t.call('POST', '/v1/hit/server', { token: KEY, body: { site: 'notes', path: '/d' } });
  assert.equal(full.status, 507);
  assert.equal(t.redis.hashes.get('v:site:notes').size, 3);
  // Negative control: a path already counted keeps counting.
  const again = await t.call('POST', '/v1/hit/server', { token: KEY, body: { site: 'notes', path: '/a' } });
  assert.deepEqual([again.status, again.body.views], [200, 2]);
  await t.close();
});
