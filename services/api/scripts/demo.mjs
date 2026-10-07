// Local demo: the real site build and the real API running together, with
// the same in-memory stand-ins the tests use for Redis and Google Calendar.
// Nothing leaves this machine, no real invites are sent, and every count
// and booking resets when it stops.
//
//   node services/api/scripts/demo.mjs      (from the repo root, after a build)
//
// Site:  http://localhost:8000   API: http://127.0.0.1:8787
// The repo's own dist/ is never touched: a copy in a temp folder gets the
// API switched on (API_BASE and connect-src), and the copy is deleted on stop.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { fakeRedis, fakeGoogle } from '../test/fakes.mjs';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const { createApp } = require('../src/app.js');
const { createStore } = require('../src/store.js');
const { loadConfig } = require('../src/config.js');

const API_PORT = 8787;
const API = `http://127.0.0.1:${API_PORT}`;
const TICK_MS = 60000;

const dist = path.join(root, 'dist');
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('No dist/ build found. Build the site first.');
  process.exit(1);
}

/* ---- A switched-on copy of the build ------------------------------------ */

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'jayptl-demo-'));
fs.cpSync(dist, path.join(work, 'dist'), { recursive: true });

const clientFile = path.join(work, 'dist/js/components/site-api.js');
const client = fs.readFileSync(clientFile, 'utf8');
if (!client.includes("var API_BASE = ''")) {
  console.error('site-api.js no longer has the expected API_BASE line; update this script.');
  process.exit(1);
}
fs.writeFileSync(clientFile, client.replace("var API_BASE = ''", `var API_BASE = '${API}'`));

let pages = 0;
(function patchCsp(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) patchCsp(p);
    else if (entry.name.endsWith('.html')) {
      const html = fs.readFileSync(p, 'utf8');
      if (html.includes("connect-src 'self'")) {
        fs.writeFileSync(p, html.replace("connect-src 'self'", `connect-src 'self' ${API}`));
        pages++;
      }
    }
  }
})(path.join(work, 'dist'));

/* ---- The real API with stand-ins ---------------------------------------- */

const secret = () => crypto.randomBytes(24).toString('base64url');
const tickSecret = secret();
const config = loadConfig({
  PORT: String(API_PORT),
  ALLOWED_ORIGIN: 'http://localhost:8000,http://127.0.0.1:8000',
  SITE_URL: 'http://localhost:8000',
  SITEMAP_URL: 'http://127.0.0.1:8000/sitemap.xml',
  REDIS_URL: 'redis://in-memory-stand-in',
  TICK_SECRET: tickSecret,
  ADMIN_SECRET: secret(),
  TOKEN_SECRET: secret(),
  GOOGLE_CLIENT_ID: 'stand-in',
  GOOGLE_CLIENT_SECRET: 'stand-in',
  GOOGLE_REFRESH_TOKEN: 'stand-in'
});

const log = (...args) => console.log(new Date().toISOString(), '[api]', ...args);
const google = fakeGoogle();
const app = createApp({ config, store: createStore(fakeRedis()), google, steam: {}, log });
const api = http.createServer(app);

function tick() {
  fetch(`${API}/v1/tick`, { method: 'POST', headers: { Authorization: `Bearer ${tickSecret}` } })
    .then((r) => r.json())
    .then((r) => { if (r.meetLinks || r.released || r.errors) log('tick', JSON.stringify(r)); })
    .catch((e) => log('tick failed', e.message));
}

api.listen(API_PORT, '127.0.0.1', () => {
  log(`API on ${API} (Redis and Google Calendar are in-memory stand-ins)`);
  log(`Switched-on build copy: ${pages} pages, in ${work}`);
  tick();
  setInterval(tick, TICK_MS).unref();
});

/* ---- Clean stop --------------------------------------------------------- */

process.on('exit', () => fs.rmSync(work, { recursive: true, force: true }));
const stop = () => {
  api.closeAllConnections();
  setTimeout(() => process.exit(0), 500).unref();
};
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', stop);

/* ---- The site's own preview server, serving the copy -------------------- */

process.chdir(work);
require(path.join(root, 'scripts/preview.js'));
