// Artifact tests: llms.txt, openapi.json, robots.txt, markdown companions,
// and HTML content checks (no-JS visibility, JSON-LD). Runs against dist/.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

const distExists = fs.existsSync(dist);
if (!distExists) {
  console.error('dist/ not found — run `npm run build` (or `node scripts/build.js`) before tests.');
}
assert.ok(distExists, 'dist/ must exist (run the build first)');

const read = (p) => fs.readFileSync(path.join(dist, p), 'utf8');

/* ------------------------------ llms.txt -------------------------------- */

test('llms.txt follows the llmstxt.org format', () => {
  const content = read('llms.txt');
  assert.ok(content.startsWith('# '), 'must start with an H1 site name');
  assert.match(content, /^> /m, 'must contain a blockquote summary');
  assert.match(content, /^## /m, 'must contain sections');
  assert.match(content, /jayptl\.me/i, 'brand name present');
});

test('llms.txt lists the core agent resources', () => {
  const content = read('llms.txt');
  assert.ok(content.includes('openapi.json'), 'links the OpenAPI spec');
  assert.ok(content.includes('/api/health'), 'links the health endpoint');
  assert.ok(content.includes('llms-full.txt'), 'links the full content dump');
  assert.ok(content.includes('privacy.md'), 'links the privacy policy markdown');
});

test('every site-relative or same-origin llms.txt link resolves to a dist file', () => {
  const content = read('llms.txt');
  const links = [...content.matchAll(/\]\((https:\/\/jayptl\.me)?(\/[^)#\s]+)\)/g)].map(m => m[2]);
  assert.ok(links.length >= 10, 'expected a healthy number of links');
  const routeToFile = {
    '/': 'index.md',
    '/index.md': 'index.md',
    '/about.md': 'pages/about.md',
    '/privacy.md': 'pages/privacy.md',
    '/projects.md': 'pages/projects/index.md',
    '/projects/aviz-health.md': 'pages/projects/aviz-health.md',
    '/projects/swalook.md': 'pages/projects/swalook.md',
    '/projects/genuinest.md': 'pages/projects/genuinest.md',
    '/projects/vini-tini.md': 'pages/projects/vini-tini.md'
  };
  // Served dynamically by scripts/server.js, not as files in dist
  const dynamicRoutes = new Set(['/api/health']);
  for (const link of links) {
    if (dynamicRoutes.has(link)) continue;
    const file = routeToFile[link] ?? link.slice(1);
    assert.ok(
      fs.existsSync(path.join(dist, file)),
      `llms.txt links ${link} but dist/${file} does not exist`
    );
  }
});

test('llms-full.txt contains every markdown document', () => {
  const full = read('llms-full.txt');
  for (const doc of [
    'pages/about.md', 'pages/projects/index.md', 'pages/projects/aviz-health.md',
    'pages/projects/swalook.md', 'pages/projects/genuinest.md',
    'pages/projects/vini-tini.md', 'pages/privacy.md'
  ]) {
    const source = fs.readFileSync(path.join(dist, doc), 'utf8').trim();
    assert.ok(full.includes(source.slice(0, 200)), `${doc} content missing from llms-full.txt`);
  }
  assert.match(full, /<!-- source: https:\/\/jayptl\.me\//, 'sections carry source URLs');
});

/* ----------------------------- openapi.json ----------------------------- */

test('openapi.json is a valid OpenAPI document describing the site', () => {
  const spec = JSON.parse(read('openapi.json'));
  assert.match(spec.openapi, /^3\./, 'OpenAPI version 3.x');
  assert.equal(spec.info.title, 'jayptl.me');
  assert.ok(spec.info.description.length > 50, 'meaningful description');
  assert.ok(spec.servers.length >= 1, 'server entry present');

  for (const p of ['/', '/about', '/projects', '/projects/{slug}', '/privacy',
    '/api/health', '/openapi.json', '/llms.txt', '/llms-full.txt', '/robots.txt', '/sitemap.xml']) {
    assert.ok(spec.paths[p], `path ${p} documented`);
  }

  const health = spec.paths['/api/health'].get.responses['200'].content['application/json'].schema;
  assert.equal(health.$ref.includes('Health'), true);
});

test('openapi.json documents the JSON error contract with codes, messages, and hints', () => {
  const spec = JSON.parse(read('openapi.json'));
  const errorSchema = spec.components.schemas.Error;
  assert.ok(errorSchema, 'Error schema present');
  const props = errorSchema.properties.error.properties;
  for (const field of ['code', 'message', 'hint']) {
    assert.ok(props[field], `error.${field} documented`);
  }
  assert.ok(spec.components.responses.NotFound, '404 response documented');
  assert.ok(spec.components.responses.NotAcceptable, '406 response documented');
});

test('markdown and html content types are both documented on negotiable pages', () => {
  const spec = JSON.parse(read('openapi.json'));
  for (const p of ['/', '/about', '/projects', '/projects/{slug}', '/privacy']) {
    const content = spec.paths[p].get.responses['200'].content;
    assert.ok(content['text/html'], `${p} documents text/html`);
    assert.ok(content['text/markdown'], `${p} documents text/markdown`);
  }
});

/* ------------------------------ robots.txt ------------------------------ */

test('robots.txt explicitly allows the audited AI crawlers', () => {
  const robots = read('robots.txt');
  for (const agent of ['GPTBot', 'ClaudeBot', 'ChatGPT-User', 'PerplexityBot',
    'Google-Extended', 'Applebot-Extended', 'DeepSeekBot']) {
    assert.ok(robots.includes(`User-agent: ${agent}`), `${agent} must be explicitly allowed`);
    // The group that follows the agent line must allow crawling
    const group = robots.slice(robots.indexOf(`User-agent: ${agent}`));
    assert.match(group, /Allow: \//, `${agent} group must have Allow: /`);
  }
  assert.ok(robots.includes('Sitemap: https://jayptl.me/sitemap.xml'));
});

test('robots.txt does not disallow anything', () => {
  const robots = read('robots.txt');
  const disallows = [...robots.matchAll(/^Disallow:/gm)];
  assert.equal(disallows.length, 0, 'no Disallow directives (all commented examples removed)');
});

/* -------------------------- markdown companions ------------------------- */

const ROUTES = {
  '/': 'index.md',
  '/about': 'pages/about.md',
  '/privacy': 'pages/privacy.md',
  '/projects': 'pages/projects/index.md',
  '/projects/aviz-health': 'pages/projects/aviz-health.md',
  '/projects/swalook': 'pages/projects/swalook.md',
  '/projects/genuinest': 'pages/projects/genuinest.md',
  '/projects/vini-tini': 'pages/projects/vini-tini.md'
};

test('every content page has a substantive markdown companion', () => {
  for (const [route, file] of Object.entries(ROUTES)) {
    const md = read(file);
    assert.ok(md.startsWith('# '), `${route}: markdown starts with an H1`);
    assert.ok(md.length > 500, `${route}: markdown is substantive (${md.length} chars)`);
  }
});

test('markdown companions mention the brand', () => {
  for (const file of Object.values(ROUTES)) {
    assert.match(read(file), /Jay Patel/, `${file} mentions Jay Patel`);
  }
});

/* ------------------------------- HTML ----------------------------------- */

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

test('homepage is meaningful without JavaScript (H1 + 500+ chars of raw text)', () => {
  const html = read('index.html');
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  assert.ok(h1, 'homepage has an H1');
  assert.ok(stripHtml(h1[1]).length > 10, 'H1 has text');
  const text = stripHtml(html);
  assert.ok(text.length >= 500, `raw text is ${text.length} chars, need >= 500`);
});

test('homepage JSON-LD parses and carries Person identity fields', () => {
  const html = read('index.html');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.ok(blocks.length >= 1, 'JSON-LD present');
  const graphs = blocks.map(b => JSON.parse(b[1]));
  const nodes = graphs.flatMap(g => (g['@graph'] ? g['@graph'] : [g]));
  const person = nodes.find(n => n['@type'] === 'Person');
  assert.ok(person, 'Person node present');
  assert.equal(person.name, 'Jay Patel');
  assert.ok(person.description && person.description.length > 50, 'Person.description');
  assert.equal(person.url, 'https://jayptl.me/');
  assert.ok(Array.isArray(person.sameAs) && person.sameAs.length >= 1, 'Person.sameAs');
  assert.ok(nodes.some(n => n['@type'] === 'WebSite'), 'WebSite node present');
});

test('every content page advertises its markdown alternate and parses its JSON-LD', () => {
  const pages = {
    'index.html': '/index.md',
    'pages/about.html': '/about.md',
    'pages/privacy.html': '/privacy.md',
    'pages/projects/index.html': '/projects.md',
    'pages/projects/aviz-health.html': '/projects/aviz-health.md',
    'pages/projects/swalook.html': '/projects/swalook.md',
    'pages/projects/genuinest.html': '/projects/genuinest.md',
    'pages/projects/vini-tini.html': '/projects/vini-tini.md'
  };
  for (const [page, mdHref] of Object.entries(pages)) {
    const html = read(page);
    assert.ok(
      html.includes(`rel="alternate" type="text/markdown" href="${mdHref}"`),
      `${page} must link its markdown alternate`
    );
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.ok(blocks.length >= 1, `${page} has JSON-LD`);
    for (const b of blocks) JSON.parse(b[1]);
  }
});

test('page titles carry the brand token for name-based search', () => {
  for (const page of ['index.html', 'pages/about.html', 'pages/projects/index.html',
    'pages/privacy.html', 'pages/projects/aviz-health.html', 'pages/projects/swalook.html',
    'pages/projects/genuinest.html', 'pages/projects/vini-tini.html']) {
    const title = read(page).match(/<title>(.*?)<\/title>/)[1];
    assert.ok(/jayptl\.me/.test(title), `${page} title mentions jayptl.me`);
  }
});
