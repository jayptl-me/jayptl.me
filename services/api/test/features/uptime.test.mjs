// The heartbeat and GET /v1/status.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, MON_0830_IST } from '../helpers/boot.mjs';

test('tick needs the secret, and uptime is the share of minutes with a heartbeat', async () => {
  const t = await boot();
  assert.equal((await t.call('POST', '/v1/tick')).status, 401);
  assert.equal((await t.call('POST', '/v1/tick', { token: 'wrong' })).status, 401);
  // 10 minutes, 8 of them ticked.
  for (let m = 0; m < 10; m++) {
    t.setNow(MON_0830_IST + m * 60000);
    if (m !== 3 && m !== 6) assert.equal((await t.call('POST', '/v1/tick', { token: 'tick-secret' })).status, 200);
  }
  const s = await t.call('GET', '/v1/status');
  assert.equal(s.body.ok, true);
  assert.equal(s.body.redis, true);
  assert.equal(Math.round(s.body.uptime24h * 100), 80);
  assert.equal(s.body.days.length, 1);
  assert.equal(s.body.days[0].date, '2026-09-28');
  await t.close();
});

test('a status read is a few round trips, not one per day', async () => {
  const t = await boot();
  // Ticking for 40 days already.
  t.redis.kv.set('up:since', new Date(Date.parse('2026-08-19T00:00:00Z')).toISOString());
  await t.call('POST', '/v1/tick', { token: 'tick-secret' });
  const before = t.redis.calls;
  const s = await t.call('GET', '/v1/status');
  assert.equal(s.status, 200);
  assert.equal(s.body.days.length, 30);
  assert.ok(t.redis.calls - before <= 3, `round trips: ${t.redis.calls - before}`);
  await t.close();
});
