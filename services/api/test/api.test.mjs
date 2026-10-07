// Every endpoint against fakes: views, uptime, slots, booking, cancel,
// the 15-minute Meet job, cleanup, now playing, admin, CORS, limits.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fakeRedis, fakeGoogle, fakeSteam } from './fakes.mjs';

const require = createRequire(import.meta.url);
const { createApp } = require('../src/app.js');
const { createStore } = require('../src/store.js');
const { loadConfig } = require('../src/config.js');

const ORIGIN = 'https://jayptl.me';
const MON_0830_IST = Date.parse('2026-09-28T03:00:00Z');
const SITEMAP = '<urlset><url><loc>https://jayptl.me/</loc></url><url><loc>https://jayptl.me/about</loc></url><url><loc>https://jayptl.me/book</loc></url></urlset>';

const open = [];
after(() => Promise.all(open.splice(0).map((close) => close())));

async function boot(overrides = {}) {
  let clock = overrides.now ?? MON_0830_IST;
  const redis = fakeRedis();
  const google = fakeGoogle();
  const steam = overrides.steam || fakeSteam(null);
  const config = loadConfig({
    REDIS_URL: 'redis://fake',
    TICK_SECRET: 'tick-secret',
    ADMIN_SECRET: 'admin-secret',
    TOKEN_SECRET: 'token-secret',
    GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret', GOOGLE_REFRESH_TOKEN: 'refresh',
    ...(overrides.steamEnv ? { STEAM_API_KEY: 'k', STEAM_ID: '1' } : {}),
    ...(overrides.env || {})
  });
  const fetch = async (url) => {
    if (String(url).includes('sitemap')) return { ok: true, text: async () => SITEMAP };
    throw new Error('unexpected fetch ' + url);
  };
  const app = createApp({ config, store: createStore(redis), google, steam, fetch, now: () => clock });
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const closeServer = () => new Promise((r) => { server.closeAllConnections(); server.close(r); });
  open.push(closeServer);
  const call = async (method, path, { body, token, origin = ORIGIN, ip = '203.0.113.7', headers: extra = {} } = {}) => {
    const res = await globalThis.fetch(base + path, {
      method,
      headers: {
        ...extra,
        Origin: origin,
        'X-Forwarded-For': ip,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { json = text; }
    return { status: res.status, headers: res.headers, body: json };
  };
  const raw = async (method, path, body, type) => {
    const res = await globalThis.fetch(base + path, { method, headers: { 'Content-Type': type, Origin: ORIGIN }, body });
    return { status: res.status };
  };
  return {
    call, raw, redis, google, steam,
    setNow: (ms) => { clock = ms; },
    close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); })
  };
}

/* ---- Health and CORS ----------------------------------------------------- */

test('health answers without touching storage', async () => {
  const t = await boot();
  const r = await t.call('GET', '/v1/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  await t.close();
});

test('CORS allows only the site origin, and preflight works', async () => {
  const t = await boot();
  const ok = await t.call('GET', '/v1/health');
  assert.equal(ok.headers.get('access-control-allow-origin'), ORIGIN);
  const other = await t.call('GET', '/v1/health', { origin: 'https://evil.example' });
  assert.equal(other.headers.get('access-control-allow-origin'), null);
  const pre = await t.call('OPTIONS', '/v1/hit');
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get('access-control-allow-methods'), /POST/);
  await t.close();
});

/* ---- Views ----------------------------------------------------------------- */

test('hit counts sitemap paths only and returns page and site totals', async () => {
  const t = await boot();
  const a = await t.call('POST', '/v1/hit', { body: { path: '/about' } });
  assert.deepEqual(a.body, { path: '/about', views: 1, total: 1 });
  const b = await t.call('POST', '/v1/hit', { body: { path: '/about/' } });
  assert.equal(b.body.views, 2);
  const home = await t.call('POST', '/v1/hit', { body: { path: '/' } });
  assert.deepEqual([home.body.views, home.body.total], [1, 3]);
  const bad = await t.call('POST', '/v1/hit', { body: { path: '/wp-admin' } });
  assert.equal(bad.status, 404);
  const read = await t.call('GET', '/v1/views?path=/about');
  assert.deepEqual(read.body, { path: '/about', views: 2, total: 3 });
  // Nothing about the visitor is stored: only the path hash and the total.
  assert.deepEqual([...t.redis.hashes.keys()], ['v:paths']);
  assert.deepEqual([...t.redis.kv.keys()], ['v:total']);
  await t.close();
});

test('hit rejects non-JSON and oversized bodies', async () => {
  const t = await boot();
  const text = await t.raw('POST', '/v1/hit', 'path=/about', 'text/plain');
  assert.equal(text.status, 415);
  const big = await t.call('POST', '/v1/hit', { body: { path: '/about', pad: 'x'.repeat(9000) } });
  assert.equal(big.status, 413);
  await t.close();
});

/* ---- Tick and uptime -------------------------------------------------------- */

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

/* ---- Slots and booking ----------------------------------------------------- */

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

async function firstSlot(t) {
  const r = await t.call('GET', '/v1/slots?from=2026-09-28&to=2026-09-29');
  return r.body.slots[0];
}

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

test('export needs the admin secret, not the scheduler key, and returns views and bookings', async () => {
  const t = await boot();
  await t.call('POST', '/v1/hit', { body: { path: '/about' } });
  assert.equal((await t.call('GET', '/v1/export')).status, 401);
  assert.equal((await t.call('GET', '/v1/export', { token: 'tick-secret' })).status, 401, 'the scheduler key cannot read guest data');
  const r = await t.call('GET', '/v1/export', { token: 'admin-secret' });
  assert.equal(r.status, 200);
  assert.equal(r.body.views.paths['/about'], 1);
  assert.ok(Array.isArray(r.body.bookings));
  await t.close();
});

/* ---- Now playing and admin ------------------------------------------------ */

test('now playing: newest of Steam and the manual entry wins, Steam is cached', async () => {
  const steam = fakeSteam({ game: 'Hades II', now: false, at: '2026-09-27T18:00:00.000Z', recentMinutes: 300 });
  const t = await boot({ steam, steamEnv: true });
  let r = await t.call('GET', '/v1/playing');
  assert.equal(r.body.game, 'Hades II');
  assert.equal(r.body.source, 'steam');
  assert.equal((await t.call('POST', '/v1/admin/playing', { body: { game: 'Fortnite' } })).status, 401);
  const set = await t.call('POST', '/v1/admin/playing', { token: 'admin-secret', body: { game: 'Fortnite', platform: 'Epic', now: true } });
  assert.equal(set.status, 200);
  r = await t.call('GET', '/v1/playing');
  assert.equal(r.body.game, 'Fortnite', 'manual entry is newer');
  assert.equal(steam.calls, 1, 'Steam answer cached for 5 minutes');
  await t.call('DELETE', '/v1/admin/playing', { token: 'admin-secret' });
  r = await t.call('GET', '/v1/playing');
  assert.equal(r.body.game, 'Hades II');
  await t.close();
});

test('admin page is served with a strict CSP and no inline script', async () => {
  const t = await boot();
  const page = await t.call('GET', '/admin');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
  assert.ok(!/<script>/.test(page.body), 'no inline scripts');
  assert.match(page.body, /noindex/);
  await t.close();
});

test('features that are not configured answer 503, not a crash', async () => {
  const t = await boot({ env: { GOOGLE_REFRESH_TOKEN: '' } });
  const r = await t.call('GET', '/v1/slots');
  assert.equal(r.status, 503);
  assert.equal(r.body.error, 'not_configured');
  await t.close();
});

/* ---- Hardening (2026-09-30) ---------------------------------------------- */

test('rate limits follow the edge IP header, so a faked forwarded list does not dodge them', async () => {
  const t = await boot();
  const edge = { 'CF-Connecting-IP': '198.51.100.9' };
  for (let i = 0; i < 10; i++) {
    const r = await t.call('POST', '/v1/tick', { token: 'wrong', ip: `10.0.0.${i}`, headers: edge });
    assert.equal(r.status, 401, 'wrong key ' + i);
  }
  const locked = await t.call('POST', '/v1/tick', { token: 'wrong', ip: '10.0.0.99', headers: edge });
  assert.equal(locked.status, 429, 'eleventh wrong key is locked out');
  const right = await t.call('POST', '/v1/tick', { token: 'tick-secret', ip: '10.0.0.100', headers: edge });
  assert.equal(right.status, 429, 'even the right key waits out the lockout');
  const other = await t.call('POST', '/v1/tick', { token: 'tick-secret', headers: { 'CF-Connecting-IP': '198.51.100.10' } });
  assert.equal(other.status, 200, 'other addresses are unaffected');
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

test('every answer carries security headers and a request id; wrong methods get 405', async () => {
  const t = await boot();
  const h = await t.call('GET', '/v1/health');
  assert.equal(h.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(h.headers.get('x-frame-options'), 'DENY');
  assert.match(h.headers.get('strict-transport-security'), /max-age=/);
  assert.match(h.headers.get('content-security-policy'), /default-src 'none'/);
  assert.match(h.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);
  const wrong = await t.call('PUT', '/v1/hit', { body: {} });
  assert.equal(wrong.status, 405);
  assert.equal(wrong.headers.get('allow'), 'POST, OPTIONS');
  assert.equal((await t.call('GET', '/v1/nope')).status, 404);
  await t.close();
});

test('an upstream calendar failure never leaks its code or path to visitors', async () => {
  const t = await boot();
  t.google.busy = async () => {
    const err = new Error('Google POST /freeBusy failed: 403');
    err.upstreamStatus = 403;
    throw err;
  };
  const r = await t.call('GET', '/v1/slots');
  assert.equal(r.status, 500);
  assert.deepEqual([r.body.error, r.body.message], ['server_error', 'Something went wrong']);
  await t.close();
});
