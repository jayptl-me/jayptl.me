'use strict';

/**
 * GET /v1/slots, POST /v1/book, POST /v1/cancel, and the booking jobs the
 * tick runs (calendar sync, Meet links, 30 day cleanup).
 */

const crypto = require('node:crypto');
const { HttpError } = require('../../core/errors');
const { readJson } = require('../../core/http');
const { sign, verify, keyedHash } = require('../../core/auth');
const { openSlots } = require('./slots');

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const MIN_FILL_MS = 3000;
const MAX_EMAIL = 120;
const DAY_MS = 86400000;
// Characters that never belong in an invite: control codes and the
// invisible marks that reverse or reorder text on screen. Joiners used by
// Indic and other scripts are kept.
const HIDDEN_RE = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g;

/** One line of plain text: every hidden or line-breaking character becomes a space. */
function cleanLine(value, max) {
  return String(value || '').replace(/[\r\n\t]/g, ' ').replace(HIDDEN_RE, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** A short note: line breaks kept, everything else hidden dropped. */
function cleanNote(value, max) {
  return String(value || '').replace(/\r\n?/g, '\n').replace(/\t/g, ' ').replace(HIDDEN_RE, '').trim().slice(0, max);
}

function parseDay(text, suffix) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text || '')) return NaN;
  return Date.parse(text + suffix);
}
// How often the tick asks the calendar about upcoming calls (declines,
// events deleted by hand). Cheap: one read per upcoming call.
const SYNC_EVERY_MS = 10 * 60000;

function createBooking(ctx) {
  const { config, store, google, now, log, need, limit, allow, ipOf } = ctx;
  let lastSync = 0;
  const emailKey = (email) => keyedHash(email, config.tokenSecret);

  /**
   * The visitor's from and to days, widened a day each way for zones
   * ahead of and behind UTC, then clamped to what can be booked at all, so
   * the calendar is never asked about years nobody can book.
   */
  function slotRange(query) {
    const t = now();
    const today = new Date(t).toISOString().slice(0, 10);
    let fromMs = parseDay(query.get('from'), 'T00:00:00Z');
    if (!Number.isFinite(fromMs)) fromMs = Date.parse(today + 'T00:00:00Z');
    let toMs = parseDay(query.get('to'), 'T23:59:59Z');
    toMs = Number.isFinite(toMs) ? toMs + DAY_MS : t + config.booking.horizonDays * DAY_MS;
    fromMs = Math.max(fromMs - DAY_MS, t - DAY_MS);
    toMs = Math.min(toMs, t + (config.booking.horizonDays + 1) * DAY_MS);
    return { fromMs, toMs };
  }

  /** A slot start that the rules could ever offer right now. */
  function bookable(slotMs) {
    const t = now();
    return slotMs >= t + config.booking.minNoticeMinutes * 60000 && slotMs <= t + config.booking.horizonDays * DAY_MS;
  }

  async function computeSlots(fromMs, toMs) {
    const rules = config.booking;
    const busy = await google.busy(fromMs, toMs, rules.timeZone);
    const ours = await store.bookingsBetween(fromMs - 86400000, toMs + 86400000);
    // Our own bookings block their slots at once, even before the
    // calendar's free/busy reflects the new event.
    return openSlots(rules, {
      nowMs: now(), fromMs, toMs,
      busy: busy.concat(ours.map((b) => ({ start: b.start, end: b.end }))),
      taken: ours.map((b) => b.start)
    });
  }

  /** A guest who declines, or a call deleted from the calendar by hand, frees the slot and drops the guest data. */
  async function sync(t, result) {
    if (t - lastSync < SYNC_EVERY_MS) return;
    lastSync = t;
    const upcoming = await store.bookingsBetween(t, t + config.booking.horizonDays * 86400000);
    for (const b of upcoming) {
      try {
        const state = await google.attendance(b.eventId, b.email);
        if (state === 'ok') continue;
        if (state === 'declined') await google.deleteEvent(b.eventId, { notify: false });
        await store.deleteBooking(b, emailKey(b.email));
        result.released++;
      } catch (e) {
        log('calendar sync failed', b.id, e.message);
        result.errors++;
      }
    }
  }

  /**
   * Calls starting within the lead time get their Meet link, once. A call
   * already under way still gets it, so ticks that stopped for a while
   * make the link late, never lost.
   */
  async function addMeetLinks(t, result) {
    const lead = config.booking.meetLeadMinutes * 60000;
    const len = config.booking.slotMinutes * 60000;
    const soon = await store.bookingsBetween(t - len + 1, t + lead);
    for (const b of soon) {
      if (b.meet) continue;
      try {
        const link = await google.addMeet(b.eventId, 'jayptl-' + b.id);
        await store.setMeet(b, link);
        result.meetLinks++;
      } catch (e) {
        log('meet link failed', b.id, e.message);
        result.errors++;
      }
    }
  }

  /** Guest data is deleted keepDays after the call. */
  async function cleanup(t, result) {
    const cutoff = t - config.booking.keepDays * DAY_MS;
    const old = await store.bookingsBetween(0, cutoff);
    for (const b of old) {
      await store.deleteBooking(b, emailKey(b.email));
      result.cleaned++;
    }
    // Bookings the store already expired on its own leave only their id
    // in the start index; drop those too.
    await store.dropIndexBefore(cutoff);
  }

  return {
    jobs: { sync, addMeetLinks, cleanup },

    routes: {
      'GET /v1/slots': async (req, url) => {
        need('booking', 'Booking');
        limit(req, 'slots', 30, 60000);
        const { fromMs, toMs } = slotRange(url.searchParams);
        const slots = toMs > fromMs ? await computeSlots(fromMs, toMs) : [];
        return {
          timeZone: config.booking.timeZone,
          slotMinutes: config.booking.slotMinutes,
          slots: slots.map((ms) => new Date(ms).toISOString())
        };
      },

      'POST /v1/book': async (req) => {
        need('booking', 'Booking');
        limit(req, 'book-burst', 10, 3600000);
        const body = await readJson(req);
        // Bots fill every field and submit instantly; people do neither.
        if (body.company) throw new HttpError(400, 'rejected', 'Booking rejected');
        if (!(Number(body.elapsed) >= MIN_FILL_MS)) throw new HttpError(400, 'too_fast', 'Take a second, then try again');
        const name = cleanLine(body.name, 80);
        // An address is never cut: a cut address is someone else's.
        const email = String(body.email || '').trim().toLowerCase();
        const note = cleanNote(body.note, 500);
        const slotMs = Date.parse(body.slot);
        if (!name) throw new HttpError(400, 'name_required', 'Name is required');
        if (email.length > MAX_EMAIL || !EMAIL_RE.test(email)) throw new HttpError(400, 'email_invalid', 'That email does not look right');
        if (!Number.isFinite(slotMs)) throw new HttpError(400, 'slot_invalid', 'Pick a time first');
        // Outside the window nothing could be free: answer before any lock
        // or calendar call.
        if (!bookable(slotMs)) throw new HttpError(409, 'slot_taken', 'That time is no longer free');
        if (!allow('book-day', ipOf(req), 5, 86400000)) throw new HttpError(429, 'rate_limited', 'Too many bookings from here today');
        const emailHash = emailKey(email);
        if ((await store.upcomingForEmail(emailHash, now())) >= 2) {
          throw new HttpError(429, 'too_many_upcoming', 'You already have two upcoming calls');
        }
        // Everyone together: each booking makes the calendar email someone.
        // Cancelling does not give the allowance back.
        if (!allow('book-global', 'all', config.booking.maxNewPerDay, DAY_MS)) {
          throw new HttpError(429, 'busy_today', 'Booking is paused for today, please email instead');
        }
        const len = config.booking.slotMinutes * 60000;
        const id = crypto.randomBytes(9).toString('base64url');
        if (!(await store.claimSlot(slotMs, id))) throw new HttpError(409, 'slot_taken', 'That time is no longer free');
        try {
          // Re-check the calendar right now; the slot may have gone.
          const open = await computeSlots(slotMs - 3600000, slotMs + 3600000);
          if (!open.includes(slotMs)) throw new HttpError(409, 'slot_taken', 'That time is no longer free');
          const cancelToken = sign(id, config.tokenSecret);
          const event = await google.createEvent({
            start: slotMs, end: slotMs + len, name, email, note, timeZone: config.booking.timeZone,
            cancelUrl: `${config.siteUrl}/book#cancel=${encodeURIComponent(cancelToken)}`
          });
          try {
            await store.saveBooking({ id, eventId: event.id, name, email, note, start: slotMs, end: slotMs + len }, emailHash);
          } catch (e) {
            // Never leave an invite on the calendar that storage does not
            // know about: it could not be cancelled or cleaned up later.
            await google.deleteEvent(event.id).catch((err) => log('orphan event cleanup failed', err.message));
            throw e;
          }
          return {
            start: new Date(slotMs).toISOString(),
            end: new Date(slotMs + len).toISOString(),
            cancelToken
          };
        } finally {
          await store.releaseSlot(slotMs).catch(() => {});
        }
      },

      'POST /v1/cancel': async (req) => {
        need('booking', 'Booking');
        limit(req, 'cancel', 20, 3600000);
        const body = await readJson(req);
        const id = verify(body.token, config.tokenSecret);
        if (!id) throw new HttpError(400, 'bad_token', 'That cancel link is not valid');
        const b = await store.booking(id);
        if (!b) throw new HttpError(404, 'not_found', 'Already cancelled, or already past');
        await google.deleteEvent(b.eventId);
        await store.deleteBooking(b, emailKey(b.email));
        return { ok: true };
      }
    }
  };
}

module.exports = { createBooking, cleanLine, cleanNote, EMAIL_RE, MIN_FILL_MS, SYNC_EVERY_MS };
