// The booking jobs the tick runs: Meet links, cleanup, calendar sync.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, firstSlot } from '../helpers/boot.mjs';

test('tick adds the Meet link 15 minutes before start, once, and cleans up after 30 days', async () => {
  const t = await boot();
  const slot = await firstSlot(t);
  await t.call('POST', '/v1/book', { body: { name: 'Lee', email: 'lee@example.com', slot, company: '', elapsed: 5000 } });
  const start = Date.parse(slot);
  t.setNow(start - 20 * 60000);
  let r = await t.call('POST', '/v1/tick', { token: 'tick-secret' });
  assert.equal(r.body.meetLinks, 0, 'too early');
  t.setNow(start - 15 * 60000);
  r = await t.call('POST', '/v1/tick', { token: 'tick-secret' });
  assert.equal(r.body.meetLinks, 1);
  assert.match([...t.google.events.values()][0].meet, /meet\.google\.com/);
  t.setNow(start - 14 * 60000);
  r = await t.call('POST', '/v1/tick', { token: 'tick-secret' });
  assert.equal(r.body.meetLinks, 0, 'never twice');
  t.setNow(start + 31 * 86400000);
  r = await t.call('POST', '/v1/tick', { token: 'tick-secret' });
  assert.equal(r.body.cleaned, 1);
  assert.equal([...t.redis.hashes.keys()].filter((k) => k.startsWith('bk:')).length, 0, 'guest data deleted');
  await t.close();
});

test('a declined or deleted invite frees the slot on the next calendar sync', async () => {
  const t = await boot();
  const r = await t.call('GET', '/v1/slots?from=2026-09-28&to=2026-09-30');
  const [s1, , s2] = r.body.slots;
  await t.call('POST', '/v1/book', { body: { name: 'Dev', email: 'dev@example.com', slot: s1, company: '', elapsed: 5000 } });
  await t.call('POST', '/v1/book', { body: { name: 'Eve', email: 'eve@example.com', slot: s2, company: '', elapsed: 5000 } });
  const [first, second] = [...t.google.events.values()];
  first.declined = true;
  t.google.events.delete(second.id); // deleted by hand on the calendar
  const tick = await t.call('POST', '/v1/tick', { token: 'tick-secret' });
  assert.equal(tick.body.released, 2);
  assert.equal(t.google.events.size, 0, 'declined invite removed from the calendar too');
  const after = await t.call('GET', '/v1/slots?from=2026-09-28&to=2026-09-30');
  assert.ok(after.body.slots.includes(s1) && after.body.slots.includes(s2), 'both slots open again');
  await t.close();
});

test('cleanup also drops index entries whose booking already expired on its own', async () => {
  const t = await boot();
  const slot = await firstSlot(t);
  await t.call('POST', '/v1/book', { body: { name: 'Old', email: 'old@example.com', slot, company: '', elapsed: 5000 } });
  // The store expired the guest hash by itself (no tick ran for a month).
  for (const k of [...t.redis.hashes.keys()]) if (k.startsWith('bk:')) t.redis.hashes.delete(k);
  t.setNow(Date.parse(slot) + 31 * 86400000);
  await t.call('POST', '/v1/tick', { token: 'tick-secret' });
  assert.equal((t.redis.zsets.get('bk:start') || new Map()).size, 0, 'no ids left behind');
  await t.close();
});

test('a call that started while ticks were stopped still gets its Meet link', async () => {
  const t = await boot();
  const slot = await firstSlot(t);
  await t.call('POST', '/v1/book', { body: { name: 'Late', email: 'late@example.com', slot, company: '', elapsed: 5000 } });
  t.setNow(Date.parse(slot) + 5 * 60000);
  const r = await t.call('POST', '/v1/tick', { token: 'tick-secret' });
  assert.equal(r.body.meetLinks, 1);
  // Negative control: after the call has ended, nothing is added.
  t.setNow(Date.parse(slot) + 20 * 60000);
  assert.equal((await t.call('POST', '/v1/tick', { token: 'tick-secret' })).body.meetLinks, 0);
  await t.close();
});
