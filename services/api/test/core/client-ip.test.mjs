// Which address the rate limits see. Only what the visitor cannot write
// may decide it: by default the last forwarded entry (added by the host's
// own proxy), and the edge network's header only when TRUST_EDGE_IP says
// every request passes through it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { clientIp } = require('../../src/core/client-ip.js');
const { loadConfig } = require('../../src/core/config.js');

const req = (headers, remote = '10.9.9.9') => ({ headers, socket: { remoteAddress: remote } });

test('by default a visitor-written edge header or forwarded prefix is ignored', () => {
  const opts = loadConfig({}).clientIp;
  assert.equal(opts.trustEdge, false, 'the safe choice is the default');
  assert.equal(clientIp(req({ 'cf-connecting-ip': '198.51.100.1', 'x-forwarded-for': '203.0.113.7' }), opts), '203.0.113.7');
  assert.equal(clientIp(req({ 'x-forwarded-for': '1.2.3.4, 203.0.113.7' }), opts), '203.0.113.7', 'leftmost entries are the visitor\'s own');
  assert.equal(clientIp(req({ 'true-client-ip': '198.51.100.2' }), opts), '10.9.9.9', 'never a client-settable header');
});

test('FORWARDED_HOPS counts proxies from the right', () => {
  const opts = loadConfig({ FORWARDED_HOPS: '2' }).clientIp;
  assert.equal(clientIp(req({ 'x-forwarded-for': '1.2.3.4, 203.0.113.7, 172.70.1.1' }), opts), '203.0.113.7');
  assert.equal(clientIp(req({ 'x-forwarded-for': '203.0.113.7' }), opts), '10.9.9.9', 'too few entries: the socket, never a guess');
});

test('negative control: with TRUST_EDGE_IP the edge header decides', () => {
  const opts = loadConfig({ TRUST_EDGE_IP: 'true' }).clientIp;
  assert.equal(clientIp(req({ 'cf-connecting-ip': '198.51.100.1', 'x-forwarded-for': '203.0.113.7' }), opts), '198.51.100.1');
  assert.equal(clientIp(req({ 'true-client-ip': '198.51.100.2', 'x-forwarded-for': '203.0.113.7' }), opts), '203.0.113.7', 'true-client-ip is spoofable on a free edge plan');
});

test('an IPv6 visitor is one key per /64, so rotating inside a home network does not dodge limits', () => {
  const opts = loadConfig({}).clientIp;
  const a = clientIp(req({ 'x-forwarded-for': '2001:db8:1:2:aaaa:bbbb:cccc:1' }), opts);
  const b = clientIp(req({ 'x-forwarded-for': '2001:db8:1:2:1111:2222:3333:4444' }), opts);
  assert.equal(a, b);
  assert.equal(a, '2001:db8:1:2::/64');
  assert.equal(clientIp(req({ 'x-forwarded-for': '::ffff:203.0.113.7' }), opts), '203.0.113.7', 'a mapped IPv4 is the IPv4');
  // Negative control: a different /64 is a different key.
  assert.notEqual(clientIp(req({ 'x-forwarded-for': '2001:db8:1:3::1' }), opts), a);
});
