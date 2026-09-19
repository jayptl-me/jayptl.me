// Custom cursor coverage: every shipped HTML page must load the global
// custom cursor (JS + CSS) so no page is left with `cursor: none` and no
// replacement cursor. Runs against dist/ (built output).
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

// Every user-facing HTML page shipped to production. Preview fixtures,
// google verification file, and markdown companions are intentionally excluded.
const PAGES = [
  'index.html',
  'pages/about.html',
  'pages/resume.html',
  'pages/privacy.html',
  'pages/design-system.html',
  'pages/projects/index.html',
  'pages/projects/aviz-health.html',
  'pages/projects/swalook.html',
  'pages/projects/genuinest.html',
  'pages/projects/vini-tini.html',
  'pages/404.html',
  'pages/500.html',
];

test('custom cursor assets exist in dist', () => {
  assert.ok(
    fs.existsSync(path.join(dist, 'js/components/custom-cursor.js')),
    'dist/js/components/custom-cursor.js must exist'
  );
  assert.ok(
    fs.existsSync(path.join(dist, 'css/components/custom-cursor.css')),
    'dist/css/components/custom-cursor.css must exist'
  );
});

test('main.css wires the custom cursor styles globally', () => {
  const main = read('css/main.css');
  assert.ok(
    main.includes('components/custom-cursor.css'),
    'css/main.css must @import components/custom-cursor.css'
  );
});

test('every page loads custom-cursor.js', () => {
  assert.ok(PAGES.length >= 12, 'page list must stay comprehensive');
  for (const page of PAGES) {
    assert.ok(fs.existsSync(path.join(dist, page)), `${page} must be shipped in dist/`);
    const html = read(page);
    assert.ok(
      html.includes('/js/components/custom-cursor.js'),
      `${page} must include /js/components/custom-cursor.js`
    );
  }
});
