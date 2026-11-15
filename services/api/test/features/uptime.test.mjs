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

test('with TICK_FILL_MINUTES, a beat every 8 minutes counts the minutes between as up, and a long gap as down', async () => {
  const t = await boot({ env: { TICK_FILL_MINUTES: '10' } });
  // Beats at 0, 8, 16, 24 (the box heartbeat), then nothing until 50, then 58.
  for (const m of [0, 8, 16, 24, 50, 58]) {
    t.setNow(MON_0830_IST + m * 60000);
    assert.equal((await t.call('POST', '/v1/tick', { token: 'tick-secret' })).status, 200);
  }
  const s = await t.call('GET', '/v1/status');
  // Minutes 0..58 since the first beat: 59 possible; 25..49 (25 minutes) were a 26 minute gap, so down.
  assert.equal(Math.round(s.body.uptime24h * 1000), Math.round((59 - 25) / 59 * 1000));
  await t.close();
});

test('without TICK_FILL_MINUTES, only the minute of each beat counts (negative control)', async () => {
  const t = await boot();
  for (const m of [0, 8, 16]) {
    t.setNow(MON_0830_IST + m * 60000);
    await t.call('POST', '/v1/tick', { token: 'tick-secret' });
  }
  const s = await t.call('GET', '/v1/status');
  assert.equal(Math.round(s.body.uptime24h * 1000), Math.round(3 / 17 * 1000));
  await t.close();
});

test('a filled gap that crosses midnight lands in both days', async () => {
  const t = await boot({ env: { TICK_FILL_MINUTES: '10' } });
  const midnight = Date.parse('2026-09-29T00:00:00Z');
  for (const ms of [midnight - 4 * 60000, midnight + 4 * 60000]) {
    t.setNow(ms);
    await t.call('POST', '/v1/tick', { token: 'tick-secret' });
  }
  const s = await t.call('GET', '/v1/status');
  assert.deepEqual(s.body.days.map((d) => [d.date, d.uptime]), [['2026-09-28', 1], ['2026-09-29', 1]]);
  await t.close();
});
