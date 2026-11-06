// Slots, booking and cancelling.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, firstSlot } from '../helpers/boot.mjs';

test('slots respect working hours, minimum notice and busy time', async () => {
  const t = await boot();
  // Busy 11:00-12:00 IST today.
  t.google.setBusy([{ start: Date.parse('2026-09-28T05:30:00Z'), end: Date.parse('2026-09-28T06:30:00Z') }]);
  const r = await t.call('GET', '/v1/slots?from=2026-09-28&to=2026-09-28');
  assert.equal(r.status, 200);
  const monday = r.body.slots.filter((iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === '2026-09-28');
  const ist = monday.map((iso) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }));
  assert.equal(ist[0], '10:30', 'two hours notice from 08:30');
  assert.ok(!ist.includes('11:00') && !ist.includes('11:45'), 'busy hour removed');
  assert.ok(!ist.includes('10:45') && !ist.includes('12:00'), '5 minute buffer around busy time');
  assert.ok(!ist.includes('13:00') && ist.includes('14:00'), 'lunch gap kept');
  assert.equal(ist[ist.length - 1], '17:45');
  await t.close();
});

test('book rejects bots, bad input and taken slots, then books and blocks the slot', async () => {
  const t = await boot();
  const slot = await firstSlot(t);
  const good = { name: 'Asha', email: 'Asha@Example.com', note: 'Flutter role', slot, company: '', elapsed: 8000 };
  assert.equal((await t.call('POST', '/v1/book', { body: { ...good, company: 'spam inc' } })).status, 400);
  assert.equal((await t.call('POST', '/v1/book', { body: { ...good, elapsed: 500 } })).status, 400);
  assert.equal((await t.call('POST', '/v1/book', { body: { ...good, email: 'nope' } })).status, 400);
  const ok = await t.call('POST', '/v1/book', { body: good });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.start, slot);
  assert.match(ok.body.cancelToken, /\./);
  const evt = [...t.google.events.values()][0];
  assert.equal(evt.email, 'asha@example.com');
  assert.equal(evt.meet, '', 'no Meet link at booking time');
  const again = await t.call('POST', '/v1/book', { body: { ...good, email: 'other@example.com' } });
  assert.equal(again.status, 409, 'our own booking blocks the slot at once');
  const slots = await t.call('GET', '/v1/slots?from=2026-09-28&to=2026-09-29');
  assert.ok(!slots.body.slots.includes(slot));
  await t.close();
});

test('one email can hold at most two upcoming calls', async () => {
  const t = await boot();
  const r = await t.call('GET', '/v1/slots?from=2026-09-28&to=2026-09-30');
  // Slots at least 30 minutes apart, since a booking and its 5 minute
  // buffer block the neighbouring slot.
  const spaced = r.body.slots.filter((iso, i) => i % 2 === 0);
  const [a, b, c] = spaced;
  const base = { name: 'Ravi', email: 'ravi@example.com', company: '', elapsed: 5000 };
  assert.equal((await t.call('POST', '/v1/book', { body: { ...base, slot: a } })).status, 200);
  assert.equal((await t.call('POST', '/v1/book', { body: { ...base, slot: b } })).status, 200);
  const third = await t.call('POST', '/v1/book', { body: { ...base, slot: c } });
  assert.equal(third.status, 429);
  assert.equal(third.body.error, 'too_many_upcoming');
  await t.close();
});

test('five bookings per address per day', async () => {
  const t = await boot();
  const r = await t.call('GET', '/v1/slots?from=2026-09-28&to=2026-10-05');
  // One slot per day, so the four-per-day cap does not interfere.
  const seen = new Set();
  const slots = r.body.slots.filter((iso) => {
    const day = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    if (seen.has(day)) return false;
    seen.add(day);
    return true;
  });
  for (let i = 0; i < 5; i++) {
    const res = await t.call('POST', '/v1/book', { body: { name: 'N' + i, email: `p${i}@example.com`, slot: slots[i], company: '', elapsed: 5000 } });
    assert.equal(res.status, 200, 'booking ' + i);
  }
  const sixth = await t.call('POST', '/v1/book', { body: { name: 'N6', email: 'p6@example.com', slot: slots[5], company: '', elapsed: 5000 } });
  assert.equal(sixth.status, 429);
  await t.close();
});

test('cancel with the signed token removes the event and the guest data', async () => {
  const t = await boot();
  const slot = await firstSlot(t);
  const ok = await t.call('POST', '/v1/book', { body: { name: 'Mia', email: 'mia@example.com', slot, company: '', elapsed: 5000 } });
  assert.equal((await t.call('POST', '/v1/cancel', { body: { token: ok.body.cancelToken + 'x' } })).status, 400);
  const c = await t.call('POST', '/v1/cancel', { body: { token: ok.body.cancelToken } });
  assert.equal(c.status, 200);
  assert.equal(t.google.events.size, 0);
  assert.equal([...t.redis.hashes.keys()].filter((k) => k.startsWith('bk:')).length, 0);
  assert.equal((await t.call('POST', '/v1/cancel', { body: { token: ok.body.cancelToken } })).status, 404);
  await t.close();
});

test('two visitors booking the same slot at once: exactly one wins', async () => {
  const t = await boot();
  const slot = await firstSlot(t);
  t.google.setCreateDelay(80);
  const base = { slot, company: '', elapsed: 5000 };
  const [a, b] = await Promise.all([
    t.call('POST', '/v1/book', { body: { ...base, name: 'A', email: 'a@example.com' }, ip: '203.0.113.1' }),
    t.call('POST', '/v1/book', { body: { ...base, name: 'B', email: 'b@example.com' }, ip: '203.0.113.2' })
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal(t.google.events.size, 1, 'one invite only');
  assert.equal(t.redis.kv.has('bk:lock:' + Date.parse(slot)), false, 'lock released');
  await t.close();
});

test('the cancel link travels inside the invite', async () => {
  const t = await boot();
  const slot = await firstSlot(t);
  const ok = await t.call('POST', '/v1/book', { body: { name: 'Zoe', email: 'zoe@example.com', slot, company: '', elapsed: 5000 } });
  const evt = [...t.google.events.values()][0];
  assert.equal(evt.cancelUrl, 'https://jayptl.me/book#cancel=' + encodeURIComponent(ok.body.cancelToken));
  await t.close();
});

test('if storage fails after the invite is created, the invite is removed and the visitor sees a plain error', async () => {
  const t = await boot();
  const slot = await firstSlot(t);
  const pipeline = t.redis.pipeline;
  t.redis.pipeline = async (list) => {
    if (list[0][0] === 'HSET') throw new Error('storage down');
    return pipeline(list);
  };
  const r = await t.call('POST', '/v1/book', { body: { name: 'Kai', email: 'kai@example.com', slot, company: '', elapsed: 5000 } });
  assert.equal(r.status, 500);
  assert.equal(r.body.error, 'server_error');
  assert.equal(r.body.message, 'Something went wrong');
  assert.equal(t.google.events.size, 0, 'no orphan invite left on the calendar');
  await t.close();
});

/* ---- Review 2026-11-05: input validation ------------------------------- */

test('an email too long to keep is refused, never cut into a different address', async () => {
  const t = await boot();
  const slot = await firstSlot(t);
  // Cut at 120 characters this would read "...@example.co": a stranger's domain.
  const email = 'a'.repeat(108) + '@example.com.au';
  const r = await t.call('POST', '/v1/book', { body: { name: 'Long', email, slot, company: '', elapsed: 5000 } });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'email_invalid');
  assert.equal(t.google.events.size, 0, 'no invite to a cut address');
  // Negative control: a long but complete address still books.
  const fine = 'b'.repeat(100) + '@example.com';
  assert.equal((await t.call('POST', '/v1/book', { body: { name: 'Fine', email: fine, slot, company: '', elapsed: 5000 } })).status, 200);
  await t.close();
});

test('control characters never reach the invite; the note keeps its line breaks', async () => {
  const t = await boot();
  const slot = await firstSlot(t);
  const r = await t.call('POST', '/v1/book', {
    body: { name: 'Asha\nExtra line\u0000‮', email: 'asha@example.com', note: 'line one\nline two\u0007', slot, company: '', elapsed: 5000 }
  });
  assert.equal(r.status, 200);
  const evt = [...t.google.events.values()][0];
  assert.equal(evt.name, 'Asha Extra line');
  assert.equal(evt.note, 'line one\nline two');
  await t.close();
});

test('slot ranges are clamped to the booking horizon before the calendar is asked', async () => {
  const t = await boot();
  const r = await t.call('GET', '/v1/slots?from=2000-01-01&to=2100-12-31');
  assert.equal(r.status, 200);
  const day = 86400000;
  const now = Date.parse('2026-09-28T03:00:00Z');
  for (const c of t.google.busyCalls) {
    assert.ok(c.fromMs >= now - day, 'range starts no earlier than a day back');
    assert.ok(c.toMs <= now + 15 * day, 'range ends within the 14 day horizon plus a day');
  }
  // An impossible date falls back to the defaults instead of reaching the calendar as NaN.
  const bad = await t.call('GET', '/v1/slots?from=2026-13-45&to=2026-99-99');
  assert.equal(bad.status, 200);
  assert.ok(t.google.busyCalls.every((c) => Number.isFinite(c.fromMs) && Number.isFinite(c.toMs)));
  // Negative control: a normal range still returns slots.
  assert.ok(r.body.slots.length > 0);
  await t.close();
});

test('a slot outside the bookable window is refused before any lock or calendar call', async () => {
  const t = await boot();
  const base = { name: 'Far', email: 'far@example.com', company: '', elapsed: 5000 };
  for (const slot of ['9999-01-01T04:30:00.000Z', '2001-01-01T04:30:00.000Z']) {
    const r = await t.call('POST', '/v1/book', { body: { ...base, slot } });
    assert.equal(r.status, 409, slot);
  }
  assert.equal(t.google.busyCalls.length, 0, 'the calendar was never asked');
  assert.equal([...t.redis.kv.keys()].filter((k) => k.startsWith('bk:lock:')).length, 0, 'no lock written');
  await t.close();
});

test('a global daily cap bounds the invites anyone can make the calendar send', async () => {
  const t = await boot({ env: { BOOKING_MAX_NEW_PER_DAY: '2' } });
  const r = await t.call('GET', '/v1/slots?from=2026-09-28&to=2026-10-02');
  const spaced = r.body.slots.filter((iso, i) => i % 2 === 0);
  const book = (slot, i) => t.call('POST', '/v1/book', { body: { name: 'S' + i, email: `s${i}@example.com`, slot, company: '', elapsed: 5000 }, ip: `203.0.113.${i + 10}` });
  const first = await book(spaced[0], 0);
  assert.equal(first.status, 200);
  // Book and cancel in a loop: cancelling does not give the allowance back.
  assert.equal((await t.call('POST', '/v1/cancel', { body: { token: first.body.cancelToken } })).status, 200);
  assert.equal((await book(spaced[1], 1)).status, 200);
  const third = await book(spaced[2], 2);
  assert.equal(third.status, 429);
  assert.equal(third.body.error, 'busy_today');
  assert.equal(t.google.events.size, 1, 'no third invite');
  // Negative control: a day later bookings open again.
  t.setNow(Date.parse('2026-09-29T03:00:00Z'));
  assert.equal((await book(spaced[spaced.length - 1], 3)).status, 200);
  await t.close();
});

test('the email index is keyed by a keyed hash and expires with the booking', async () => {
  const t = await boot();
  const slot = await firstSlot(t);
  await t.call('POST', '/v1/book', { body: { name: 'Hash', email: 'hash@example.com', slot, company: '', elapsed: 5000 } });
  const { createHash } = await import('node:crypto');
  const plain = 'bk:email:' + createHash('sha256').update('hash@example.com').digest('hex');
  const keys = [...t.redis.sets.keys()].filter((k) => k.startsWith('bk:email:'));
  assert.equal(keys.length, 1);
  assert.notEqual(keys[0], plain, 'not a plain hash anyone can test a list of addresses against');
  assert.equal(t.redis.expiresAt.get(keys[0]), Date.parse(slot) + 15 * 60000 + 30 * 86400000);
  await t.close();
});
