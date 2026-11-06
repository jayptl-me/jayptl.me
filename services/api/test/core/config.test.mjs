// Settings: an empty value means the default, never zero.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { loadConfig } = require('../../src/core/config.js');

test('empty or nonsense numbers fall back to the defaults', () => {
  const c = loadConfig({ BOOKING_SLOT_MINUTES: '', BOOKING_HORIZON_DAYS: ' ', PORT: '', BOOKING_BUFFER_MINUTES: 'x' });
  assert.equal(c.booking.slotMinutes, 15, 'a zero slot length would loop forever');
  assert.equal(c.booking.horizonDays, 14);
  assert.equal(c.port, 8787);
  assert.equal(c.booking.bufferMinutes, 5);
  assert.throws(() => loadConfig({ BOOKING_SLOT_MINUTES: '0' }), /BOOKING_SLOT_MINUTES/);
  // Negative control: a real value is kept.
  assert.equal(loadConfig({ BOOKING_SLOT_MINUTES: '30' }).booking.slotMinutes, 30);
});
