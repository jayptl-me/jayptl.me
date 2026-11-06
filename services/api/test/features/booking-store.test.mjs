// The booking keys themselves: guest data expires even if the tick stops,
// and reads cost one round trip, not one per booking.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fakeRedis } from '../fakes/index.mjs';

const require = createRequire(import.meta.url);
const { createStore } = require('../../src/core/store.js');

const DAY = 86400000;
const START = Date.parse('2026-09-28T05:00:00Z');

function booking(i) {
  return { id: 'b' + i, eventId: 'e' + i, name: 'N' + i, email: `n${i}@example.com`, note: '', start: START + i * 3600000, end: START + i * 3600000 + 900000 };
}

test('every booking carries its own expiry, 30 days after the call', async () => {
  const redis = fakeRedis();
  const store = createStore(redis, { keepDays: 30 });
  const b = booking(0);
  await store.saveBooking(b, 'hash');
  assert.equal(redis.expiresAt.get('bk:b0'), b.end + 30 * DAY, 'deleted by the store itself if no tick ever runs');
  // Negative control: the booking is still readable now.
  assert.equal((await store.booking('b0')).email, 'n0@example.com');
});

test('reading many bookings is one round trip for the ids and one for the details', async () => {
  const redis = fakeRedis();
  const store = createStore(redis, { keepDays: 30 });
  for (let i = 0; i < 6; i++) await store.saveBooking(booking(i), 'hash');
  const before = redis.calls;
  const list = await store.bookingsBetween(0, '+inf');
  assert.equal(list.length, 6);
  assert.deepEqual(list.map((b) => b.id), ['b0', 'b1', 'b2', 'b3', 'b4', 'b5'], 'same order as before');
  assert.ok(redis.calls - before <= 2, `round trips: ${redis.calls - before}`);
  const n = redis.calls;
  assert.equal(await store.upcomingForEmail('hash', START), 6);
  assert.ok(redis.calls - n <= 2, `upcoming round trips: ${redis.calls - n}`);
});

test('a Meet link written after a cancel cannot leave a record without an expiry', async () => {
  const redis = fakeRedis();
  const store = createStore(redis, { keepDays: 30 });
  const b = booking(1);
  await store.saveBooking(b, 'hash');
  await store.deleteBooking(b, 'hash');
  redis.expiresAt.clear();
  await store.setMeet(b, 'https://meet.example/x');
  assert.equal(redis.expiresAt.get('bk:b1'), b.end + 30 * DAY);
});
