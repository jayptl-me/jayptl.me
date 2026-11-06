'use strict';

/**
 * Open booking slots: working windows in the booking time zone, minus
 * busy calendar time (plus a buffer), minus minimum notice, capped per
 * day. Pure functions, so they are easy to test.
 */

const DAY_MS = 86400000;

/** Offset of a time zone from UTC at a given instant, in minutes. */
function zoneOffset(timeZone, atMs) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(new Date(atMs));
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - atMs) / 60000);
}

/** UTC ms for a wall-clock time in a zone. */
function zonedToUtc(timeZone, y, m, d, hh, mm) {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - zoneOffset(timeZone, guess) * 60000;
  // Second pass settles DST edges.
  return guess - zoneOffset(timeZone, first) * 60000;
}

/** Wall-clock calendar date { y, m, d, weekday } of an instant in a zone. */
function zonedDate(timeZone, atMs) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short'
  }).formatToParts(new Date(atMs));
  const get = (t) => parts.find((p) => p.type === t).value;
  const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { y: Number(get('year')), m: Number(get('month')), d: Number(get('day')), weekday: days[get('weekday')] };
}

function parseWindow(text) {
  const m = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) throw new Error(`Bad BOOKING_HOURS window: ${text}`);
  return { from: Number(m[1]) * 60 + Number(m[2]), to: Number(m[3]) * 60 + Number(m[4]) };
}

/**
 * Every candidate slot start (ms) between fromMs and toMs, before any
 * calendar check.
 */
function candidates(rules, fromMs, toMs) {
  const windows = rules.hours.map(parseWindow);
  const out = [];
  const step = rules.slotMinutes;
  for (let t = fromMs - DAY_MS; t <= toMs + DAY_MS; t += DAY_MS) {
    const { y, m, d, weekday } = zonedDate(rules.timeZone, t);
    if (!rules.days.includes(weekday)) continue;
    for (const w of windows) {
      for (let min = w.from; min + step <= w.to; min += step) {
        const start = zonedToUtc(rules.timeZone, y, m, d, Math.floor(min / 60), min % 60);
        if (start >= fromMs && start < toMs && !out.includes(start)) out.push(start);
      }
    }
  }
  return out.sort((a, b) => a - b);
}

/**
 * Open slots. busy: [{ start, end }] from the calendar; taken: starts of
 * our own bookings (already in busy once Google has them, but counted
 * here too for the per-day cap).
 */
function openSlots(rules, { nowMs, fromMs, toMs, busy = [], taken = [] }) {
  const earliest = nowMs + rules.minNoticeMinutes * 60000;
  const latest = nowMs + rules.horizonDays * DAY_MS;
  const from = Math.max(fromMs, earliest);
  const to = Math.min(toMs, latest);
  if (to <= from) return [];
  const len = rules.slotMinutes * 60000;
  const buf = rules.bufferMinutes * 60000;
  const perDay = {};
  for (const t of taken) {
    const key = JSON.stringify(zonedDate(rules.timeZone, t));
    perDay[key] = (perDay[key] || 0) + 1;
  }
  return candidates(rules, from, to).filter((start) => {
    const end = start + len;
    if (busy.some((b) => start < b.end + buf && end > b.start - buf)) return false;
    const key = JSON.stringify(zonedDate(rules.timeZone, start));
    return (perDay[key] || 0) < rules.maxPerDay;
  });
}

module.exports = { zoneOffset, zonedToUtc, zonedDate, candidates, openSlots, DAY_MS };
