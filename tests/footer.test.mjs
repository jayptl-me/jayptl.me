// The shared footer: one per page, the same on every page, links grouped by
// what a visitor is looking for, and only what belongs in a footer (owner's
// pick "A, grouped columns", 16 Nov 2026). Leftovers moved where they work:
// Reset stickers beside the stickers, Preferred Source on the colophon, API
// status on the colophon's uptime section (already there).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const pages = ['index.html',
  ...fs.readdirSync(path.join(root, 'pages')).filter((f) => f.endsWith('.html')).map((f) => 'pages/' + f),
  ...fs.readdirSync(path.join(root, 'pages/projects')).filter((f) => f.endsWith('.html')).map((f) => 'pages/projects/' + f)];

function footerOf(html) {
  const window = new Window({ url: 'https://jayptl.me/' });
  window.document.write(html);
  return window.document;
}

test('footer: exactly one site footer on every page, never one inside main', () => {
  for (const f of pages) {
    const doc = footerOf(read(f));
    assert.equal(doc.querySelectorAll('footer.site-footer, .site-footer').length, 1, f + ' has more than one site footer');
    // A page's own content footer (.page-footer on About) is fine; a second site footer is not.
    assert.equal(doc.querySelectorAll('main .site-footer, main footer[class^="site-footer"]').length, 0, f + ' has a site footer inside main');
  }
});

test('footer: the same markup on every page', () => {
  const block = (html) => {
    const s = html.indexOf('<footer class="site-footer">');
    return html.slice(s, html.indexOf('</footer>', s) + 9).replace(/\s+/g, ' ');
  };
  const first = block(read(pages[0]));
  // assert.ok, not assert.equal: a diff of two long one-line footers runs
  // node out of memory instead of failing (seen 2026-11-16).
  const differ = pages.filter((f) => block(read(f)) !== first);
  assert.ok(differ.length === 0, 'footer differs from the home page footer on: ' + differ.join(', '));
});

test('footer: three labelled groups that link every page a visitor needs', () => {
  const doc = footerOf(read('index.html'));
  const groups = [...doc.querySelectorAll('.site-footer .site-footer-group')];
  assert.deepEqual(groups.map((g) => g.querySelector('.site-footer-group-label').textContent.trim()), ['Work', 'Me', 'Talk']);
  const hrefs = (el) => [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));
  assert.deepEqual(groups.map(hrefs), [['/projects', '/resume', '/changelog'], ['/about', '/now', '/uses', '/ai'], ['/contact', '/book']]);
  // Search engines find every page from any page (the 10 Nov indexing fix).
  const all = hrefs(doc.querySelector('.site-footer'));
  for (const p of ['/projects', '/resume', '/changelog', '/about', '/now', '/uses', '/ai', '/contact', '/book', '/privacy', '/colophon']) {
    assert.ok(all.includes(p), 'footer links ' + p);
  }
  assert.ok(all.includes('mailto:hello@jayptl.me'));
  // Ruling 2 (docs/taste.md section 11): footers read "Analytics only with your consent."
  assert.match(doc.querySelector('.site-footer .site-footer-meta').textContent, /Analytics only with your consent/);
  // The bottom bar carries Home (a static link to "/" for crawlers; the
  // navbar is drawn by script), the small print and the reads count.
  const bar = doc.querySelector('.site-footer .site-footer-bar');
  assert.deepEqual(hrefs(bar).filter((h) => h !== '/changelog'), ['/', '/privacy', '/colophon']);
  assert.ok(bar.querySelector('#footerUpdated'), 'updated date stays');
  assert.ok(bar.querySelector('[data-component="view-count"]'), 'reads count stays');
});

test('footer: what moved out lives where it works', () => {
  for (const f of pages) {
    const foot = footerOf(read(f)).querySelector('.site-footer');
    for (const sel of ['#resetStickers', '.preferred-source-link', '[data-component="api-dot"]']) {
      // ok(), not equal(element, null): printing a page element on failure runs node out of memory.
      assert.ok(foot.querySelector(sel) === null, f + ' footer still holds ' + sel);
    }
  }
  const home = footerOf(read('index.html'));
  const reset = home.getElementById('resetStickers');
  assert.ok(reset && reset.closest('.home-section--sticker'), 'Reset stickers sits beside the stickers');
  const colophon = footerOf(read('pages/colophon.html'));
  assert.ok(colophon.querySelector('main a.preferred-source-link[href^="https://www.google.com/preferences/source"]'), 'Preferred Source on the colophon');
  assert.ok(colophon.querySelector('main #uptime'), 'API uptime stays on the colophon');
});

test('footer: every new class has a style rule', () => {
  const css = read('css/pages/home.css');
  for (const cls of ['site-footer-grid', 'site-footer-brand', 'site-footer-nav', 'site-footer-group', 'site-footer-group-label', 'site-footer-bar']) {
    assert.match(css, new RegExp('\\.' + cls + '\\b'), `home.css styles .${cls}`);
  }
});

test('odometer: screen readers and copied text get the number, never the reels', async () => {
  const window = new Window({ url: 'https://jayptl.me/' });
  window.document.body.innerHTML = '<span id="v" data-odometer></span>';
  new Function('window', 'document', 'requestAnimationFrame', read('js/components/digit-odometer.js'))(
    window, window.document, (f) => setTimeout(f, 0));
  const el = window.document.getElementById('v');
  window.DigitOdometer.set(el, 12345);
  const sr = el.querySelector('.sr-only');
  assert.ok(sr !== null, 'the number is real hidden text, not only an aria-label on a span');
  assert.equal(sr && sr.textContent, '12,345');
  assert.equal(el.querySelector('.odo-face').getAttribute('aria-hidden'), 'true');
  window.DigitOdometer.set(el, 7);
  assert.equal(el.querySelectorAll('.sr-only').length, 1, 'one hidden number, updated in place');
  assert.equal(el.querySelector('.sr-only').textContent, '7');
  assert.match(read('css/components/digit-odometer.css'), /\.odo-face\s*\{[^}]*user-select:\s*none/, 'copying skips the 0-9 reels');
  // A counter whose hidden number went missing gets it back, never a crash.
  el.querySelector('.sr-only').remove();
  window.DigitOdometer.set(el, 42);
  assert.equal(el.querySelector('.sr-only') && el.querySelector('.sr-only').textContent, '42');
});

test('footer: the small labels pass AA in light mode', () => {
  const css = read('css/pages/home.css');
  assert.match(css, /\.site-footer-group-label \{[^}]*color: var\(--primary-800\)/, 'light labels use the 800 blue');
  assert.match(css, /html\[data-theme="dark"\] \.site-footer-group-label \{\s*color: var\(--theme-primary\)/, 'dark labels keep the turquoise primary');
});
