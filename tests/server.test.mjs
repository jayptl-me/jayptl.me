// Integration tests: boot scripts/server.js against dist/ and exercise every
// agent-facing behavior (markdown negotiation, Vary, JSON errors, health,
// agent files, security headers, clean URLs, traversal protection).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

if (!fs.existsSync(dist)) {
  console.error('dist/ not found — run `npm run build` (or `node scripts/build.js`) before tests.');
}
assert.ok(fs.existsSync(dist), 'dist/ must exist (run the build first)');

const { createApp } = require('../scripts/server.js');

const server = createApp({ distDir: dist, quiet: true });
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => new Promise((resolve) => server.close(resolve)));

function get(pathname, headers = {}, method = 'GET') {
  return fetch(base + pathname, { method, headers, redirect: 'manual' });
}

/* ------------------- markdown content negotiation ----------------------- */

test('homepage serves HTML to browsers with Vary: Accept', async () => {
  const res = await get('/', { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/html/);
  assert.ok(res.headers.get('vary').includes('Accept'), 'Vary must include Accept');
  const body = await res.text();
  assert.match(body, /<h1/);
  assert.match(body, /Jay Patel/);
});

test('homepage serves markdown for Accept: text/markdown (acceptmarkdown.com)', async () => {
  const res = await get('/', { Accept: 'text/markdown' });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/markdown; ?charset=utf-8/);
  assert.ok(res.headers.get('vary').includes('Accept'), 'Vary must include Accept');
  const body = await res.text();
  assert.ok(body.startsWith('# '), 'markdown body starts with an H1');
  assert.match(body, /Jay Patel/);
});

test('markdown negotiation honors q-values', async () => {
  const prefersHtml = await get('/', { Accept: 'text/html;q=1.0, text/markdown;q=0.5' });
  assert.match(prefersHtml.headers.get('content-type'), /^text\/html/);

  const prefersMd = await get('/', { Accept: 'text/html;q=0.3, text/markdown;q=0.9' });
  assert.match(prefersMd.headers.get('content-type'), /^text\/markdown/);
});

test('no Accept header defaults to HTML', async () => {
  const res = await fetch(base + '/', { method: 'GET' }); // fetch sends */* by default
  assert.match(res.headers.get('content-type'), /^text\/html/);
  const res2 = await get('/about', { Accept: '*/*' });
  assert.match(res2.headers.get('content-type'), /^text\/html/);
});

test('unsatisfiable Accept header gets 406 with a JSON explanation', async () => {
  const res = await get('/', { Accept: 'application/xml' });
  assert.equal(res.status, 406);
  assert.match(res.headers.get('content-type'), /^application\/json/);
  const body = await res.json();
  assert.equal(body.error.code, 'NOT_ACCEPTABLE');
  assert.ok(body.error.hint.length > 10, 'resolution hint present');
});

test('every content route negotiates to markdown', async () => {
  for (const route of ['/about', '/privacy', '/projects',
    '/projects/aviz-health', '/projects/swalook', '/projects/genuinest', '/projects/vini-tini']) {
    const res = await get(route, { Accept: 'text/markdown' });
    assert.equal(res.status, 200, route);
    assert.match(res.headers.get('content-type'), /^text\/markdown/, route);
    const body = await res.text();
    assert.ok(body.startsWith('# '), `${route} markdown has H1`);
  }
});

test('direct .md URLs are served with text/markdown', async () => {
  for (const p of ['/index.md', '/about.md', '/projects.md', '/projects/aviz-health.md']) {
    const res = await get(p);
    assert.equal(res.status, 200, p);
    assert.match(res.headers.get('content-type'), /^text\/markdown/, p);
  }
});

/* ---------------------------- JSON errors ------------------------------- */

test('unknown /api/* path returns a structured JSON 404', async () => {
  const res = await get('/api/nonexistent');
  assert.equal(res.status, 404);
  assert.match(res.headers.get('content-type'), /^application\/json/);
  const body = await res.json();
  assert.equal(body.error.code, 'NOT_FOUND');
  assert.equal(body.error.status, 404);
  assert.equal(body.error.path, '/api/nonexistent');
  assert.ok(body.error.hint.includes('openapi.json'), 'hint points at the API docs');
  assert.ok(body.error.documentation, 'documentation link present');
});

test('unknown page returns JSON 404 when the client prefers JSON', async () => {
  const res = await get('/no-such-page', { Accept: 'application/json' });
  assert.equal(res.status, 404);
  assert.match(res.headers.get('content-type'), /^application\/json/);
  const body = await res.json();
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('unknown page returns the HTML 404 page for browsers (behavior preserved)', async () => {
  const res = await get('/no-such-page', {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  });
  assert.equal(res.status, 404);
  assert.match(res.headers.get('content-type'), /^text\/html/);
  const body = await res.text();
  assert.match(body, /<!DOCTYPE html>/i);
});

test('unsupported methods get a JSON 405 with Allow', async () => {
  const res = await get('/', { Accept: '*/*' }, 'POST');
  assert.equal(res.status, 405);
  assert.match(res.headers.get('allow'), /GET/);
  const body = await res.json();
  assert.equal(body.error.code, 'METHOD_NOT_ALLOWED');

  const del = await get('/api/health', {}, 'DELETE');
  assert.equal(del.status, 405);
  assert.equal((await del.json()).error.code, 'METHOD_NOT_ALLOWED');
});

test('OPTIONS advertises allowed methods', async () => {
  const res = await get('/', {}, 'OPTIONS');
  assert.equal(res.status, 204);
  assert.match(res.headers.get('allow'), /GET, HEAD/);
});

/* ------------------------------ /api/health ----------------------------- */

test('GET /api/health returns JSON status', async () => {
  const res = await get('/api/health');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^application\/json/);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.service, 'jayptl.me');
  assert.ok(typeof body.uptimeSeconds === 'number');
});

test('/api/health rejects Accept headers it cannot satisfy', async () => {
  const res = await get('/api/health', { Accept: 'text/html' });
  assert.equal(res.status, 406);
  assert.equal((await res.json()).error.code, 'NOT_ACCEPTABLE');
});

/* --------------------------- agent resources ---------------------------- */

test('llms.txt and llms-full.txt are served', async () => {
  const res = await get('/llms.txt');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/markdown/);
  assert.ok((await res.text()).startsWith('# '));

  const full = await get('/llms-full.txt');
  assert.equal(full.status, 200);
  const text = await full.text();
  assert.ok((text.match(/^# /gm) || []).length >= 7, 'all documents included');
});

test('openapi.json is served as JSON', async () => {
  const res = await get('/openapi.json');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^application\/json/);
  const spec = await res.json();
  assert.equal(spec.info.title, 'jayptl.me');
});

test('robots.txt is served and allows AI agents', async () => {
  const res = await get('/robots.txt');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/plain/);
  const body = await res.text();
  assert.ok(body.includes('User-agent: GPTBot'));
  assert.ok(body.includes('User-agent: ClaudeBot'));
  assert.ok(body.includes('User-agent: ChatGPT-User'));
});

/* ------------------------- headers and routing -------------------------- */

test('security headers match the previous static-host configuration', async () => {
  const res = await get('/');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(res.headers.get('permissions-policy'), 'geolocation=(), microphone=(), camera=()');
});

test('HSTS is set for HTTPS requests and absent for plain HTTP', async () => {
  const https = await get('/', { 'X-Forwarded-Proto': 'https', Accept: 'text/html' });
  assert.match(https.headers.get('strict-transport-security') || '', /max-age=\d+/);
  const httpRes = await get('/', { Accept: 'text/html' });
  assert.equal(httpRes.headers.get('strict-transport-security'), null);
});

test('clean URLs and legacy redirects still route correctly', async () => {
  for (const [route, marker] of [
    ['/projects', 'Every suit'],
    ['/about', 'Jay Patel'],
    ['/privacy', 'Privacy Policy'],
    ['/design-system', '']
  ]) {
    const res = await get(route, { Accept: 'text/html' });
    assert.equal(res.status, 200, route);
    if (marker) assert.ok((await res.text()).includes(marker), route);
  }
});

test('trailing slashes are normalized', async () => {
  const res = await get('/about/', { Accept: 'text/html' });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/html/);
});

test('HEAD requests return headers with no body', async () => {
  const res = await get('/', { Accept: 'text/html' }, 'HEAD');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/html/);
  const body = await res.text();
  assert.equal(body, '');
});

test('directory traversal outside dist/ is rejected', async () => {
  const status = await new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port: server.address().port, path: '/..%2f..%2fpackage.json' },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      }
    );
    req.on('error', reject);
    req.end();
  });
  assert.equal(status, 404);
});
