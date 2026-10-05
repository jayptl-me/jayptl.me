'use strict';

/**
 * Google Calendar over plain fetch with an OAuth refresh token (see
 * scripts/google-auth.mjs). Scopes: calendar.events and calendar.freebusy.
 *
 * Only what booking needs: free/busy for slots, create an event with the
 * guest invited, add a Meet link later, delete on cancel. Google emails
 * the guest for every change because sendUpdates=all.
 */

const { fetchWithTimeout } = require('./util');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/calendar/v3';
const TIMEOUT_MS = 10000;

function createGoogle(config, { fetch = globalThis.fetch, now = () => Date.now() } = {}) {
  let token = null;
  let tokenExpiry = 0;
  let refreshing = null;

  /** One refresh at a time: parallel requests share the same new token. */
  function accessToken() {
    if (token && now() < tokenExpiry - 60000) return Promise.resolve(token);
    if (!refreshing) {
      refreshing = refresh().finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  async function refresh() {
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token'
    });
    const res = await fetchWithTimeout(fetch, TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    }, TIMEOUT_MS);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      throw new Error(`Google token refresh failed: ${data.error || res.status}`);
    }
    token = data.access_token;
    tokenExpiry = now() + (Number(data.expires_in) || 3600) * 1000;
    return token;
  }

  async function call(method, path, body) {
    const res = await fetchWithTimeout(fetch, API + path, {
      method,
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    }, TIMEOUT_MS);
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // upstreamStatus, not status: the API answers its own visitors with
      // a plain 500, never Google's code or path.
      const err = new Error(`Google ${method} ${path.split('?')[0]} failed: ${res.status}`);
      err.upstreamStatus = res.status;
      throw err;
    }
    return data;
  }

  const cal = encodeURIComponent(config.calendarId);

  return {
    /** Busy intervals [{ start, end }] in ms between two instants. */
    async busy(fromMs, toMs, timeZone) {
      const data = await call('POST', '/freeBusy', {
        timeMin: new Date(fromMs).toISOString(),
        timeMax: new Date(toMs).toISOString(),
        timeZone,
        items: [{ id: config.calendarId }]
      });
      const calendars = (data && data.calendars) || {};
      const entry = calendars[config.calendarId] || Object.values(calendars)[0] || {};
      if (entry.errors && entry.errors.length) throw new Error('Google free/busy returned errors');
      return (entry.busy || []).map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));
    },

    /**
     * Create the call without a Meet link; Google invites the guest. The
     * cancel link goes in the invite too, so closing the confirmation
     * screen never strands a guest without a way to cancel.
     */
    async createEvent({ start, end, name, email, note, timeZone, cancelUrl }) {
      const description = [
        `15 minute call booked on jayptl.me by ${name}.`,
        note ? `\nNote from ${name}:\n${note}` : '',
        '\nThe Google Meet link is added to this invite 15 minutes before the start.',
        cancelUrl ? `\nPlans changed? Cancel here: ${cancelUrl}` : ''
      ].join('\n');
      return call('POST', `/calendars/${cal}/events?sendUpdates=all`, {
        summary: `15 min with Jay Patel (${name})`,
        description,
        location: 'Google Meet link arrives 15 minutes before start',
        start: { dateTime: new Date(start).toISOString(), timeZone },
        end: { dateTime: new Date(end).toISOString(), timeZone },
        attendees: [{ email, displayName: name }],
        guestsCanInviteOthers: false,
        guestsCanSeeOtherGuests: false,
        reminders: { useDefault: true }
      });
    },

    /** Attach a Meet link; Google emails the guest the updated invite. */
    async addMeet(eventId, requestId) {
      const data = await call('PATCH',
        `/calendars/${cal}/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1&sendUpdates=all`, {
          location: '',
          conferenceData: {
            createRequest: { requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } }
          }
        });
      return (data && (data.hangoutLink ||
        ((data.conferenceData && data.conferenceData.entryPoints) || [])
          .filter((e) => e.entryPointType === 'video').map((e) => e.uri)[0])) || '';
    },

    /**
     * Where a booked call stands on the calendar: 'gone' when the event
     * was deleted or cancelled there, 'declined' when the guest said no,
     * otherwise 'ok'.
     */
    async attendance(eventId, email) {
      let data;
      try {
        data = await call('GET', `/calendars/${cal}/events/${encodeURIComponent(eventId)}`);
      } catch (e) {
        if (e.upstreamStatus === 404 || e.upstreamStatus === 410) return 'gone';
        throw e;
      }
      if (!data || data.status === 'cancelled') return 'gone';
      const guest = (data.attendees || []).find((a) => String(a.email || '').toLowerCase() === email);
      return guest && guest.responseStatus === 'declined' ? 'declined' : 'ok';
    },

    /** notify: false skips the email, for a guest who already declined. */
    async deleteEvent(eventId, { notify = true } = {}) {
      try {
        await call('DELETE', `/calendars/${cal}/events/${encodeURIComponent(eventId)}?sendUpdates=${notify ? 'all' : 'none'}`);
      } catch (e) {
        // Already gone is fine.
        if (e.upstreamStatus !== 404 && e.upstreamStatus !== 410) throw e;
      }
    }
  };
}

module.exports = { createGoogle };
