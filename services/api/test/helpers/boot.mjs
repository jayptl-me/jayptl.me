// Boots the real app on a free port against fakes, with a fixed clock.
import { after } from 'node:test';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fakeRedis, fakeGoogle, fakeSteam } from '../fakes/index.mjs';

const require = createRequire(import.meta.url);
const { createApp } = require('../../src/core/app.js');
const { createStore } = require('../../src/core/store.js');
const { loadConfig } = require('../../src/core/config.js');

export const ORIGIN = 'https://jayptl.me';
export const MON_0830_IST = Date.parse('2026-09-28T03:00:00Z');
export const SITEMAP = '<urlset><url><loc>https://jayptl.me/</loc></url><url><loc>https://jayptl.me/about</loc></url><url><loc>https://jayptl.me/book</loc></url></urlset>';

const open = [];
after(() => Promise.all(open.splice(0).map((close) => close())));

export async function boot(overrides = {}) {
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
  const fetch = overrides.fetch || (async (url) => {
    if (String(url).includes('sitemap')) return { ok: true, text: async () => SITEMAP };
    throw new Error('unexpected fetch ' + url);
  });
  const app = createApp({ config, store: createStore(redis), google, steam, fetch, now: () => clock, maxLimiterKeys: overrides.maxLimiterKeys });
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
  const raw = async (method, path, body, type, token) => {
    const headers = { 'Content-Type': type, Origin: ORIGIN, ...(token ? { Authorization: 'Bearer ' + token } : {}) };
    const res = await globalThis.fetch(base + path, { method, headers, body });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { json = text; }
    return { status: res.status, body: json };
  };
  return {
    call, raw, redis, google, steam,
    setNow: (ms) => { clock = ms; },
    close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); })
  };
}

export async function firstSlot(t) {
  const r = await t.call('GET', '/v1/slots?from=2026-09-28&to=2026-09-29');
  return r.body.slots[0];
}
