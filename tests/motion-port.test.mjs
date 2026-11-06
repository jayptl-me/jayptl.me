// Tests for the 2026-11-04 motion round (docs/motion-zen.md section 6d):
// headline arrival, no card hover lift, the resume sheet and the way back.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const GLOBALS = [
  'window', 'document', 'navigator', 'location', 'history', 'performance',
  'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle',
  'IntersectionObserver', 'MutationObserver', 'DOMParser', 'CustomEvent',
  'fetch', 'setTimeout', 'clearTimeout'
];

function makeWindow({ reduced = false, url = 'https://jayptl.me/about', fetch } = {}) {
  const window = new Window({ url, innerWidth: 1280, innerHeight: 800, settings: { disableCSSFileLoading: true, disableJavaScriptFileLoading: true } });
  window.matchMedia = (query) => ({
    matches: query.includes('reduce') ? reduced : query.includes('pointer: fine') || query.includes('hover: hover'),
    media: query,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}
  });
  window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  window.setTimeout = setTimeout;
  window.clearTimeout = clearTimeout;
  window.fetch = fetch || (async () => ({ ok: false, text: async () => '' }));
  return { window, document: window.document };
}

function run(win, rel) {
  const fn = new Function(...GLOBALS, src(rel));
  fn(...GLOBALS.map((name) => {
    const v = win[name];
    return typeof v === 'function' && !/^[A-Z]/.test(name) ? v.bind(win) : v;
  }));
}

const tick = () => new Promise((r) => setTimeout(r, 5));
async function waitFor(check, ms = 2500) {
  const t0 = Date.now();
  while (!check()) {
    if (Date.now() - t0 > ms) return false;
    await new Promise((r) => setTimeout(r, 20));
  }
  return true;
}

/* ---- Headline arrival ------------------------------------------------- */

test('arrival: the first headline splits into word spans, keeps its text, and plays', () => {
  const { window, document } = makeWindow();
  document.body.innerHTML = '<main><h1>Fifteen minutes, <span data-ink="squiggle">no slides</span>.</h1><h1>Second</h1></main>';
  run(window, 'js/components/mount.js');
  run(window, 'js/components/arrive.js');
  const h = document.querySelector('h1');
  assert.equal(h.textContent, 'Fifteen minutes, no slides.', 'text is unchanged');
  assert.deepEqual(Array.from(h.querySelectorAll('.arrive-t')).map((w) => w.textContent), ['Fifteen', 'minutes,', '.']);
  assert.ok(h.querySelector('.arrive-nb > [data-ink] + .arrive-t'), 'the period stays on the ink mark line');
  const ink = h.querySelector('[data-ink]');
  assert.ok(ink.classList.contains('arrive-w') && !ink.classList.contains('arrive-t'), 'an ink mark arrives whole');
  assert.equal(ink.style.getPropertyValue('--i'), '2');
  assert.ok(h.classList.contains('is-arriving'), 'no staged entry: it plays at once');
  assert.equal(document.querySelectorAll('h1')[1].querySelector('.arrive-w'), null, 'only the first headline');
});

test('arrival: waits for the staged entry to reveal the block, and the home hero is left alone', async () => {
  const { window, document } = makeWindow();
  document.documentElement.classList.add('pt-entering');
  document.body.innerHTML = '<main><header class="pt-item"><h1>Say hi.</h1></header></main>';
  run(window, 'js/components/mount.js');
  run(window, 'js/components/arrive.js');
  const h = document.querySelector('h1');
  assert.ok(h.classList.contains('is-waiting'));
  document.querySelector('header').classList.add('pt-in');
  await tick();
  assert.ok(h.classList.contains('is-arriving'));

  const hop = makeWindow();
  hop.document.documentElement.classList.add('pt-covering');
  hop.document.body.innerHTML = '<main class="pt-swapped"><header><h1>Say hi.</h1></header></main>';
  run(hop.window, 'js/components/mount.js');
  run(hop.window, 'js/components/arrive.js');
  assert.equal(hop.document.querySelector('h1 .arrive-w'), null, 'nothing plays under the cover');
  hop.document.documentElement.classList.remove('pt-covering');
  hop.document.documentElement.classList.add('pt-entering');
  hop.document.querySelector('header').classList.add('pt-item', 'pt-in');
  hop.window.dispatchEvent(new hop.window.CustomEvent('page:ready'));
  assert.ok(hop.document.querySelector('h1').classList.contains('is-arriving'), 'it plays once the swap shows');

  const morph = makeWindow();
  morph.document.documentElement.classList.add('pt-morphing');
  morph.document.body.innerHTML = '<main><h1>Genuinest</h1></main>';
  run(morph.window, 'js/components/mount.js');
  run(morph.window, 'js/components/arrive.js');
  assert.equal(morph.document.querySelector('h1 .arrive-w'), null, 'the morph is the title entrance');

  const home = makeWindow();
  home.document.body.innerHTML = '<div class="text-reveal-container"></div><main><h1>Hero</h1></main>';
  run(home.window, 'js/components/mount.js');
  run(home.window, 'js/components/arrive.js');
  assert.equal(home.document.querySelector('h1 .arrive-w'), null);
});

/* ---- No card hover lift (D-62) ---------------------------------------- */

const CARD = /(card|grid-item|resume-track)/;

function cardHoverLifts(css) {
  const found = [];
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = rule.exec(css))) {
    const sel = m[1].trim();
    if (!/:hover/.test(sel)) continue;
    // The element that moves is the last compound of each selector: a card
    // itself, or a screenshot inside one. Icons inside a card may move.
    const parts = sel.split(',').filter((s) => {
      const subject = s.trim().split(/\s+/).pop();
      return (/:hover/.test(subject) && CARD.test(subject.split(':hover')[0])) || /feature-(shot|phone)/.test(subject);
    });
    if (parts.length && /transform\s*:[^;]*translate/.test(m[2])) found.push(sel);
  }
  return found;
}

test('hover: no card lifts on hover anywhere on the site, buttons still do', () => {
  // Negative control: the checker catches the rule this round removed.
  assert.deepEqual(cardHoverLifts('html[data-theme="light"] .card-default:hover { transform: translateY(-2px); }').length, 1);
  assert.deepEqual(cardHoverLifts('.pill-btn:hover { transform: translateY(-1px); }'), []);
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = path.join(dir, e.name);
      if (e.isDirectory()) walk(rel);
      else if (rel.endsWith('.css')) files.push(rel);
    }
  })('css');
  const lifts = files.flatMap((f) => cardHoverLifts(src(f)).map((sel) => `${f}: ${sel}`));
  assert.deepEqual(lifts, []);
  assert.match(src('css/components/buttons.css'), /:hover \{\n\s+transform: translateY\(-1px\);/);
});

/* ---- Resume sheet (D-66, D-69) ---------------------------------------- */

const ONE_PAGER = '<!-- one-pager --><main class="sheet"><h1 class="name">Jay Patel</h1></main>';

function sheetPage(fetch) {
  const env = makeWindow({ reduced: true, url: 'https://jayptl.me/resume', fetch });
  env.document.body.innerHTML = '<main><a class="resume-track" href="/assets/resumes/fde.pdf" download="Jay-Patel-Resume-fde.pdf"><span class="resume-track-name">Client-facing / FDE</span></a></main>';
  run(env.window, 'js/components/resume-sheet.js');
  return env;
}

test('resume sheet: a tile opens the one-pager page in a sheet, the PDF stays the download', async () => {
  const asked = [];
  const { window, document } = sheetPage(async (url) => { asked.push(url); return { ok: true, text: async () => ONE_PAGER }; });
  const tile = document.querySelector('.resume-track');
  const click = new window.MouseEvent('click', { bubbles: true, cancelable: true });
  tile.dispatchEvent(click);
  assert.ok(click.defaultPrevented, 'the tap opens the sheet instead of downloading');
  assert.equal(tile.getAttribute('aria-busy'), 'true', 'busy while the page loads');
  assert.ok(await waitFor(() => document.querySelector('dialog.rsheet')?.open), 'the sheet opens once its styles are ready');
  assert.deepEqual(asked, ['/assets/resumes/html/fde.html']);
  const dialog = document.querySelector('dialog.rsheet');
  assert.equal(tile.getAttribute('aria-busy'), null);
  assert.ok(document.documentElement.classList.contains('rsheet-open'));
  assert.equal(dialog.querySelector('.rsheet-title').textContent, 'Client-facing / FDE one-pager');
  const dl = dialog.querySelector('.rsheet-download');
  assert.equal(dl.getAttribute('href'), '/assets/resumes/fde.pdf');
  assert.equal(dl.getAttribute('download'), 'Jay-Patel-Resume-fde.pdf');
  const shadow = dialog.querySelector('.rsheet-body').shadowRoot;
  assert.equal(shadow.querySelector('article.sheet h1').textContent, 'Jay Patel', 'an article, not a second main');
  const body = dialog.querySelector('.rsheet-body');
  assert.equal(document.activeElement, body, 'keyboard focus lands on the resume, so it scrolls');
  assert.equal(body.getAttribute('tabindex'), '0');
  assert.ok(shadow.querySelector('link[href="/assets/resumes/html/one-pager.css"]'));
  assert.equal(dialog.querySelector('.rsheet-body').getAttribute('data-theme'), 'light');
  assert.match(src('assets/resumes/html/one-pager.css'), /:host\(\[data-theme="dark"\]\) \{\n\s+--accent: #26c9d8;/, 'never blue in dark');
  dialog.dispatchEvent(new window.Event('cancel', { cancelable: true }));
  assert.ok(!dialog.open, 'Escape closes it (reduced motion: at once)');
  assert.ok(!document.documentElement.classList.contains('rsheet-open'));
  assert.equal(document.activeElement, tile, 'focus returns to the tile');
});

test('resume sheet: a failed page load falls back to the tile download, with its check and announcement', async () => {
  const { window, document } = sheetPage(async () => ({ ok: false, text: async () => '' }));
  const tile = document.querySelector('.resume-track');
  let passed = 0;
  document.addEventListener('click', (e) => { if (e.target.closest('.resume-track')) passed++; });
  tile.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.equal(passed, 0, 'the first tap is held for the sheet');
  assert.ok(await waitFor(() => passed === 1), 'the fallback is the tile own click, which page-actions.js answers');
  assert.equal(tile.getAttribute('aria-busy'), null);
  assert.ok(!document.querySelector('dialog.rsheet')?.open);
});

test('resume sheet: leaving /resume while a page loads never opens it on the next page, and a stuck load falls back', async () => {
  let release;
  const slow = sheetPage(() => new Promise((r) => { release = r; }));
  const tile = slow.document.querySelector('.resume-track');
  tile.dispatchEvent(new slow.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  slow.window.dispatchEvent(new slow.window.CustomEvent('page:ready'));
  release({ ok: true, text: async () => ONE_PAGER });
  await new Promise((r) => setTimeout(r, 1700));
  assert.ok(!slow.document.querySelector('dialog.rsheet')?.open, 'a late load after a swap does not open');
  assert.ok(!slow.document.documentElement.classList.contains('rsheet-open'));

  const stuck = sheetPage(() => new Promise(() => {}));
  const t2 = stuck.document.querySelector('.resume-track');
  let passed = 0;
  stuck.document.addEventListener('click', (e) => { if (e.target.closest('.resume-track')) passed++; });
  t2.dispatchEvent(new stuck.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.ok(await waitFor(() => passed === 1, 6000), 'a page that never answers falls back to the PDF');
  assert.equal(t2.getAttribute('aria-busy'), null, 'and the tile is not left busy');
});

test('resume sheet: a router swap with the sheet open leaves nothing behind for the next open', async () => {
  const { window, document } = sheetPage(async () => ({ ok: true, text: async () => ONE_PAGER }));
  document.querySelector('.resume-track').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.ok(await waitFor(() => document.querySelector('dialog.rsheet')?.open));
  const dialog = document.querySelector('dialog.rsheet');
  dialog.classList.add('is-up', 'is-dragging');
  dialog.style.setProperty('--rsheet-drag', '40px');
  window.dispatchEvent(new window.CustomEvent('page:ready'));
  assert.ok(!dialog.open);
  assert.ok(!dialog.classList.contains('is-up') && !dialog.classList.contains('is-dragging'));
  assert.equal(dialog.style.getPropertyValue('--rsheet-drag'), '');
  assert.ok(!document.documentElement.classList.contains('rsheet-open'));
});

test('resume sheet: a modified click still downloads, and every track has its page', () => {
  const { window, document } = sheetPage(async () => ({ ok: true, text: async () => ONE_PAGER }));
  const click = new window.MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
  document.querySelector('.resume-track').dispatchEvent(click);
  assert.ok(!click.defaultPrevented);
  const tracks = [...src('pages/resume.html').matchAll(/href="\/assets\/resumes\/([a-z0-9-]+)\.pdf"/g)].map((m) => m[1]);
  assert.equal(tracks.length, 7);
  for (const t of tracks) {
    assert.match(src(`assets/resumes/html/${t}.html`), /<main class="sheet">[\s\S]*<\/main>/, `${t} page`);
    assert.ok(fs.existsSync(path.join(root, `assets/resumes/${t}.pdf`)), `${t} pdf`);
  }
});

/* ---- Way back (D-67) -------------------------------------------------- */

test('way back: a quiet hooked link sits above the title on each case study and on /privacy', () => {
  const pages = { 'pages/projects/aviz-health.html': '/projects', 'pages/projects/genuinest.html': '/projects',
    'pages/projects/swalook.html': '/projects', 'pages/projects/vini-tini.html': '/projects', 'pages/privacy.html': '/' };
  for (const [file, href] of Object.entries(pages)) {
    const html = src(file);
    const back = html.indexOf(`<a class="way-back" href="${href}"><span class="arrow arrow--back" aria-hidden="true"></span>`);
    assert.ok(back > 0, `${file} has the way back`);
    assert.ok(back < html.indexOf('<h1'), `${file}: above the title`);
  }
  assert.match(src('pages/projects/vini-tini.html'), /pill-btn pill-btn--quiet">Back to all projects/, 'the end pill stays');
});

/* ---- Squish (D-71) ---------------------------------------------------- */

function squishPage({ reduced = false } = {}) {
  const env = makeWindow({ reduced });
  Object.defineProperty(env.window, 'CSS', { value: { supports: () => true }, configurable: true });
  env.document.body.innerHTML =
    '<p><a class="pill-btn" id="pill" href="/book">Book a call</a></p>' +
    '<div><button class="day-pill" id="d1">Mon</button><button class="day-pill" id="d2">Tue</button></div>' +
    '<a class="resume-track" id="tile" href="/x.pdf">Tile</a>';
  const rects = { pill: [0, 0, 150, 44], d1: [0, 100, 60, 40], d2: [64, 100, 60, 40], tile: [0, 200, 300, 300] };
  for (const [id, [x, y, w, h]] of Object.entries(rects)) {
    env.document.getElementById(id).getBoundingClientRect = () => ({ left: x, top: y, right: x + w, bottom: y + h, width: w, height: h });
  }
  const calls = [];
  env.window.HTMLElement.prototype.animate = function (frames, opts) {
    calls.push({ id: this.id, to: frames[1].scale, opts });
    return { cancel() {}, set onfinish(fn) { this._f = fn; } };
  };
  run(env.window, 'js/components/press-state.js');
  return { ...env, calls };
}

test('squish: a small free pill squashes 2px and springs back; crowded pills and big tiles sink evenly', () => {
  const { window, document, calls } = squishPage();
  const S = window.Squish;
  const pill = S.squashFor(document.getElementById('pill'), true);
  assert.equal(pill.y.toFixed(4), (1 - 2 / 44).toFixed(4));
  assert.equal(pill.x.toFixed(4), '1.0200', 'wider by 1.5px a side on a 150px pill');
  assert.ok(pill.spring);
  const crowded = S.squashFor(document.getElementById('d1'), true);
  assert.deepEqual([crowded.x, crowded.y, crowded.spring], [0.97, 0.97, false], 'a 4px gap is too tight to squish');
  const tile = S.squashFor(document.getElementById('tile'), false);
  assert.equal(tile.y, 0.99);
  assert.equal(tile.spring, false);
  assert.match(S.spring.easing, /^linear\(0, /);
  assert.equal(S.spring.ms, 353, 'stiffness 600, damping 34 settles in about 353ms');

  document.getElementById('pill').dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse', pointerId: 1, isPrimary: true }));
  window.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
  assert.equal(calls[0].to, `${(1 + 3 / 150)} ${1 - 2 / 44}`);
  assert.equal(calls[0].opts.duration, 110);
  assert.equal(calls[1].to, '1 1');
  assert.equal(calls[1].opts.easing, S.spring.easing);
  assert.ok(document.documentElement.classList.contains('squish-on'));
});

test('squish: keyboard presses squash too, reduced motion never squashes', () => {
  const env = squishPage();
  const pill = env.document.getElementById('pill');
  pill.focus();
  env.document.dispatchEvent(new env.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(env.calls.length, 1, 'Enter squashes (D-63)');

  const calm = squishPage({ reduced: true });
  calm.document.getElementById('pill').dispatchEvent(new calm.window.PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse', pointerId: 1, isPrimary: true }));
  assert.equal(calm.calls.length, 0);
});

test('squish: a finger that starts a scroll never squashes, a held finger does, a static card never does', async () => {
  const { window, document, calls } = squishPage();
  const tile = document.getElementById('tile');
  tile.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: 10, clientY: 210 }));
  window.dispatchEvent(new window.PointerEvent('pointermove', { bubbles: true, pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: 10, clientY: 240 }));
  await new Promise((r) => setTimeout(r, 140));
  assert.equal(calls.length, 0, 'a scroll that starts on a tile does not ripple it');

  tile.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'touch', pointerId: 8, isPrimary: true, clientX: 10, clientY: 210 }));
  await new Promise((r) => setTimeout(r, 140));
  assert.equal(calls.length, 1, 'a held finger squashes after the touch delay');
  window.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true, pointerId: 99 }));
  assert.equal(calls.length, 1, 'another finger lifting does not release it');
  window.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true, pointerId: 8 }));
  assert.equal(calls.length, 2);

  const box = document.createElement('div');
  box.className = 'card card-default';
  box.getBoundingClientRect = () => ({ left: 0, top: 600, right: 300, bottom: 800, width: 300, height: 200 });
  document.body.appendChild(box);
  box.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse', pointerId: 2, isPrimary: true }));
  assert.equal(calls.length, 2, 'a card that does nothing stays still');
});

test('squish: rows and the docked talk chip are solid, the old fixed press scales step aside', () => {
  assert.doesNotMatch(src('css/components/role-ledger.css'), /\.role-head:active \{[^}]*scale/);
  assert.doesNotMatch(src('css/components/talk-chip.css'), /talk-chip-copy:active \{[^}]*translate/);
  const css = src('css/components/squish.css');
  assert.match(css, /html\.squish-on \{\n\s+--press-scale: 1;\n\s+--press-scale-soft: 1;/);
  assert.match(src('css/main.css'), /@import 'components\/squish\.css';/);
});
