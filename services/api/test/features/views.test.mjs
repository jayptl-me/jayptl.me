// POST /v1/hit and GET /v1/views.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot } from '../helpers/boot.mjs';

test('hit counts sitemap paths only and returns page and site totals', async () => {
  const t = await boot();
  const a = await t.call('POST', '/v1/hit', { body: { path: '/about' } });
  assert.deepEqual(a.body, { path: '/about', views: 1, total: 1 });
  const b = await t.call('POST', '/v1/hit', { body: { path: '/about/' } });
  assert.equal(b.body.views, 2);
  const home = await t.call('POST', '/v1/hit', { body: { path: '/' } });
  assert.deepEqual([home.body.views, home.body.total], [1, 3]);
  const bad = await t.call('POST', '/v1/hit', { body: { path: '/wp-admin' } });
  assert.equal(bad.status, 404);
  const read = await t.call('GET', '/v1/views?path=/about');
  assert.deepEqual(read.body, { path: '/about', views: 2, total: 3 });
  // Nothing about the visitor is stored: only the path hash and the total.
  assert.deepEqual([...t.redis.hashes.keys()], ['v:paths']);
  assert.deepEqual([...t.redis.kv.keys()], ['v:total']);
  await t.close();
});

test('hit rejects non-JSON and oversized bodies', async () => {
  const t = await boot();
  const text = await t.raw('POST', '/v1/hit', 'path=/about', 'text/plain');
  assert.equal(text.status, 415);
  const big = await t.call('POST', '/v1/hit', { body: { path: '/about', pad: 'x'.repeat(9000) } });
  assert.equal(big.status, 413);
  await t.close();
});

test('a failing sitemap is not fetched again on every hit', async () => {
  let fetches = 0;
  const fetch = async () => { fetches++; return { ok: false, status: 503, text: async () => '' }; };
  const t = await boot({ fetch });
  for (let i = 0; i < 5; i++) {
    const r = await t.call('POST', '/v1/hit', { body: { path: '/' } });
    assert.equal(r.status, 200, 'the home page is always countable');
  }
  assert.equal(fetches, 1, 'one fetch, then a pause before the next try');
  // Negative control: after the pause it is tried again.
  t.setNow(Date.parse('2026-09-28T03:00:00Z') + 10 * 60000);
  await t.call('POST', '/v1/hit', { body: { path: '/' } });
  assert.equal(fetches, 2);
  await t.close();
});
