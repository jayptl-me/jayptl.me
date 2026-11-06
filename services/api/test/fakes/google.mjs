// A fake calendar: free/busy, events, Meet links, declines.
export function fakeGoogle() {
  const events = new Map();
  let busy = [];
  let seq = 0;
  let createDelayMs = 0;
  const busyCalls = []; // every free/busy range asked for, in ms
  return {
    events,
    busyCalls,
    setBusy(list) { busy = list; },
    // A slow calendar, so two bookings can overlap the way they do live.
    setCreateDelay(ms) { createDelayMs = ms; },
    async busy(fromMs, toMs) { busyCalls.push({ fromMs, toMs }); return busy; },
    async createEvent(e) {
      if (createDelayMs) await new Promise((r) => setTimeout(r, createDelayMs));
      const id = 'evt' + (++seq);
      events.set(id, { ...e, id, meet: '' });
      return { id };
    },
    async addMeet(id) {
      const e = events.get(id);
      e.meet = 'https://meet.google.com/abc-defg-hij';
      return e.meet;
    },
    async attendance(id) {
      const e = events.get(id);
      if (!e) return 'gone';
      return e.declined ? 'declined' : 'ok';
    },
    async deleteEvent(id) { events.delete(id); }
  };
}
