// Rate limits and the wrong-key lockout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot } from '../helpers/boot.mjs';

test('rate limits follow the edge IP header, so a faked forwarded list does not dodge them', async () => {
  // Behind the edge network only, which is now an explicit setting.
  const t = await boot({ env: { TRUST_EDGE_IP: 'true' } });
  const edge = { 'CF-Connecting-IP': '198.51.100.9' };
  for (let i = 0; i < 10; i++) {
    const r = await t.call('POST', '/v1/tick', { token: 'wrong', ip: `10.0.0.${i}`, headers: edge });
    assert.equal(r.status, 401, 'wrong key ' + i);
  }
  const locked = await t.call('POST', '/v1/tick', { token: 'wrong', ip: '10.0.0.99', headers: edge });
  assert.equal(locked.status, 429, 'eleventh wrong key is locked out');
  const right = await t.call('POST', '/v1/tick', { token: 'tick-secret', ip: '10.0.0.100', headers: edge });
  assert.equal(right.status, 429, 'even the right key waits out the lockout');
  const other = await t.call('POST', '/v1/tick', { token: 'tick-secret', headers: { 'CF-Connecting-IP': '198.51.100.10' } });
  assert.equal(other.status, 200, 'other addresses are unaffected');
  await t.close();
});

test('by default a rotating edge header does not dodge the wrong-key lockout', async () => {
  const t = await boot();
  for (let i = 0; i < 10; i++) {
    const r = await t.call('POST', '/v1/tick', { token: 'wrong', headers: { 'CF-Connecting-IP': `198.51.100.${i}` } });
    assert.equal(r.status, 401, 'wrong key ' + i);
  }
  const locked = await t.call('POST', '/v1/tick', { token: 'wrong', headers: { 'CF-Connecting-IP': '198.51.100.99' } });
  assert.equal(locked.status, 429, 'same real address, new fake header: still locked');
  await t.close();
});

test('by default a faked forwarded prefix does not dodge the wrong-key lockout', async () => {
  const t = await boot();
  for (let i = 0; i < 10; i++) {
    const r = await t.call('POST', '/v1/tick', { token: 'wrong', ip: `10.0.0.${i}, 203.0.113.7` });
    assert.equal(r.status, 401, 'wrong key ' + i);
  }
  const locked = await t.call('POST', '/v1/tick', { token: 'wrong', ip: '10.0.0.99, 203.0.113.7' });
  assert.equal(locked.status, 429);
  const other = await t.call('POST', '/v1/tick', { token: 'tick-secret', ip: '203.0.113.8' });
  assert.equal(other.status, 200, 'negative control: a different real address is unaffected');
  await t.close();
});

test('a flood of new keys evicts the oldest windows, never every window at once', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const { createLimiter, MAX_LIMITER_KEYS } = require('../../src/core/rate-limit.js');
  const limiter = createLimiter(() => 1000);
  for (let i = 0; i < MAX_LIMITER_KEYS; i++) limiter('hit', 'k' + i, 120, 60000);
  for (let i = 0; i < 5; i++) limiter('book-day', 'victim', 5, 86400000);
  assert.equal(limiter.blocked('book-day', 'victim', 5), true);
  for (let i = 0; i < 1000; i++) limiter('hit', 'flood' + i, 120, 60000);
  assert.equal(limiter.blocked('book-day', 'victim', 5), true, 'the newest windows survive a flood');
  // Negative control: the oldest windows were the ones dropped.
  assert.equal(limiter.blocked('hit', 'k0', 1), false);
});

test('wrong-key lockouts live apart from the public limits', async () => {
  // A small cap, so a flood of public keys is cheap to send.
  const t = await boot({ maxLimiterKeys: 50 });
  for (let i = 0; i < 10; i++) await t.call('POST', '/v1/tick', { token: 'wrong', ip: '198.51.100.9' });
  for (let i = 0; i < 120; i++) await t.call('POST', '/v1/hit', { body: { path: '/' }, ip: `10.1.${i >> 8}.${i & 255}` });
  const locked = await t.call('POST', '/v1/tick', { token: 'tick-secret', ip: '198.51.100.9' });
  assert.equal(locked.status, 429, 'a flood of page views never frees a locked address');
  // Negative control: another address still gets in.
  assert.equal((await t.call('POST', '/v1/tick', { token: 'tick-secret', ip: '198.51.100.10' })).status, 200);
  await t.close();
});
