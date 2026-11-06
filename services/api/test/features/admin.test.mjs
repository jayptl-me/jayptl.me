// The export and the /admin page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot } from '../helpers/boot.mjs';

test('export needs the admin secret, not the scheduler key, and returns views and bookings', async () => {
  const t = await boot();
  await t.call('POST', '/v1/hit', { body: { path: '/about' } });
  assert.equal((await t.call('GET', '/v1/export')).status, 401);
  assert.equal((await t.call('GET', '/v1/export', { token: 'tick-secret' })).status, 401, 'the scheduler key cannot read guest data');
  const r = await t.call('GET', '/v1/export', { token: 'admin-secret' });
  assert.equal(r.status, 200);
  assert.equal(r.body.views.paths['/about'], 1);
  assert.ok(Array.isArray(r.body.bookings));
  await t.close();
});

test('admin page is served with a strict CSP and no inline script', async () => {
  const t = await boot();
  const page = await t.call('GET', '/admin');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
  assert.ok(!/<script>/.test(page.body), 'no inline scripts');
  assert.match(page.body, /noindex/);
  await t.close();
});

test('ip-check shows the owner what each address header says, behind the admin key only', async () => {
  const t = await boot();
  assert.equal((await t.call('GET', '/v1/admin/ip-check')).status, 401);
  const r = await t.call('GET', '/v1/admin/ip-check', { token: 'admin-secret', ip: '1.2.3.4, 203.0.113.7', headers: { 'CF-Connecting-IP': '198.51.100.1' } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, {
    trustEdge: false,
    forwardedHops: 1,
    used: '203.0.113.7',
    edgeHeader: '198.51.100.1',
    forwardedFor: ['1.2.3.4', '203.0.113.7']
  });
  await t.close();
});
