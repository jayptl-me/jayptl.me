// Guards for the UI system round (2026-09-30): four screen tiers, one
// button family, drawn arrows, the SVG sizing fix, Ink Status and the
// press, hold and cancel states. Briefs: docs/motion-zen.md section 6b.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function walk(dir, ext, out = []) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel, ext, out);
    else if (rel.endsWith(ext)) out.push(rel);
  }
  return out;
}

const PAGES = ['index.html', ...walk('pages', '.html')];

/* ---- Screen tiers ------------------------------------------------------- */

// The four tiers: phone < 600, tablet 600 to 1023, laptop 1024 to 1439,
// wide 1440+. Only these edges may appear in width media queries.
const TIER_EDGES = new Set(['min:600', 'max:599.98', 'min:1024', 'max:1023.98', 'min:1440', 'max:1439.98']);

// Ratchet: stylesheets written before the tiers, with the number of
// off-tier width queries they still hold. A count may only go down; each
// page phase brings its own files to zero and deletes the line. The navbar
// is out of scope for this round and keeps its own breakpoints.
const LEGACY = {
  'css/base/reset.css': 1,
  'css/components/audio-toggle.css': 1,
  'css/components/command-deck.css': 3,
  'css/components/commit-field.css': 1,
  'css/components/consent-banner.css': 2,
  'css/components/control-dock.css': 1,
  'css/components/custom-cursor.css': 1,
  'css/components/custom-scrollbar.css': 4,
  'css/components/edge-blur.css': 3,
  'css/components/forms.css': 1,
  'css/components/grid.css': 3,
  'css/components/hero.css': 18,
  'css/components/particle-text.css': 1,
  'css/components/playful.css': 1,
  'css/components/role-ledger.css': 1,
  'css/components/scroll-reveal.css': 10,
  'css/components/scroll-stack.css': 2,
  'css/components/split-text.css': 1,
  'css/components/sticker.css': 1,
  'css/components/theme-toggle.css': 1,
  'css/critical.css': 1,
  'css/layout/containers.css': 3,
  'css/pages/home.css': 3,
  'css/utilities/cursor.css': 1,
  'css/utilities/responsive.css': 26,
  'css/utilities/text.css': 2
};
const NAVBAR_OWNED = new Set(['css/components/navbar.css']);
// The navbar's own copy-icon rule lives in talk-chip.css (max-width: 860px).
const NAVBAR_RULES = { 'css/components/talk-chip.css': 1 };

function offTier(css) {
  let n = 0;
  for (const m of css.matchAll(/@media[^{]*\{/g)) {
    for (const [, kind, value, unit] of m[0].matchAll(/(min|max)-width:\s*([0-9.]+)(px|em|rem)/g)) {
      if (unit !== 'px' || !TIER_EDGES.has(`${kind}:${value}`)) n++;
    }
  }
  return n;
}

test('tiers: stylesheets use only the four screen tiers, legacy counts only go down', () => {
  const problems = [];
  for (const file of walk('css', '.css')) {
    if (NAVBAR_OWNED.has(file)) continue;
    const n = offTier(src(file));
    const allowed = (LEGACY[file] || 0) + (NAVBAR_RULES[file] || 0);
    if (n > allowed) problems.push(`${file}: ${n} off-tier width queries (allowed ${allowed})`);
  }
  assert.deepEqual(problems, []);
});

test('tiers: the ratchet list has no stale entries', () => {
  for (const [file, allowed] of Object.entries(LEGACY)) {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} no longer exists, drop it`);
    const n = offTier(src(file));
    assert.ok(n <= allowed, `${file} grew to ${n}`);
    assert.ok(n > 0, `${file} is fully on tiers now, delete its line from LEGACY`);
  }
});

/* ---- One button family -------------------------------------------------- */

test('buttons: no page uses the retired .btn family', () => {
  for (const page of PAGES) {
    const html = src(page);
    const classes = [...html.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/));
    const retired = classes.filter((c) => /^btn(-(primary|secondary|outline|ghost|glass|sm|lg|block))?$/.test(c));
    assert.deepEqual(retired, [], `${page} still uses ${retired.join(', ')}`);
  }
});

test('buttons: every page talk chip is built from the pill family', () => {
  for (const page of PAGES) {
    const html = src(page);
    for (const m of html.matchAll(/class="(talk-chip-(?:book|copy)[^"]*)"/g)) {
      assert.match(m[1], /\bpill-btn\b/, `${page}: ${m[1]}`);
      assert.match(m[1], /\bpill-btn--(filled|outline)\b/, `${page}: ${m[1]}`);
    }
  }
});

test('buttons: no stylesheet defines the retired .btn selectors any more', () => {
  for (const file of walk('css', '.css')) {
    const css = src(file).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/(^|[\s,}])\.btn(-primary|-secondary|-outline|-ghost|-glass)?\s*[,{:]/m.test(css), `${file} still styles .btn`);
  }
});

test('buttons: heights step 48 / 44 / 40 across the tiers', () => {
  const css = src('css/components/buttons.css');
  assert.match(css, /\.pill-btn \{[^}]*--pill-h: 48px/);
  assert.match(css, /@media \(min-width: 600px\) \{\s*\.pill-btn \{\s*--pill-h: 44px/);
  assert.match(css, /@media \(min-width: 1024px\) \{\s*\.pill-btn \{\s*--pill-h: 40px/);
});

/* ---- Arrows and SVG sizing ---------------------------------------------- */

test('links: no page ships a placeholder link to "#"', () => {
  for (const page of PAGES) {
    assert.ok(!/href="#"/.test(src(page)), `${page} has a link to "#" that goes nowhere`);
  }
});

test('arrows: no link carries a typed arrow character', () => {
  for (const page of PAGES) {
    const html = src(page);
    for (const m of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)) {
      assert.ok(!/[→↗←]/.test(m[1]), `${page}: typed arrow in link "${m[1].trim().slice(0, 60)}"`);
    }
  }
});

test('arrows: outside links draw the line arrow, the navbar keeps its own', () => {
  const css = src('css/base/typography.css');
  assert.match(css, /a\[href\^="http"\]:not\(\[href\*="jayptl\.me"\]\):not\(:has\(\.arrow\)\)::after \{[^}]*mask:/);
  assert.match(css, /\.glass-nav a\[href\^="http"\][^{]*::after \{[^}]*content: " ↗"/);
});

test('svg sizing: the reset never forces inline SVG heights again', () => {
  const css = src('css/base/reset.css');
  for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (/height:\s*auto\s*!important/.test(m[2])) {
      const selectors = m[1].replace(/\/\*[\s\S]*?\*\//g, '').split(',').map((s) => s.trim());
      assert.ok(!selectors.includes('svg'), 'svg is back in the forced height rule');
    }
  }
});

test('hidden: the reset makes the hidden attribute beat any component display', () => {
  assert.match(src('css/base/reset.css'), /\[hidden\] \{\s*display: none !important;/);
});

test('svg sizing: section heading doodles have a real height', () => {
  const css = src('css/components/section-heading.css');
  assert.match(css, /\.section-head \.doodle \{[^}]*height: 0\.42em/);
});

/* ---- Ink Status and press states (happy-dom) --------------------------- */

const GLOBALS = ['window', 'document', 'requestAnimationFrame', 'setTimeout', 'clearTimeout', 'Promise'];

function makeWindow() {
  const window = new Window({ url: 'https://jayptl.me/', innerWidth: 1280, innerHeight: 800 });
  const frames = [];
  window.requestAnimationFrame = (cb) => { frames.push(cb); return frames.length; };
  window.setTimeout = setTimeout;
  window.clearTimeout = clearTimeout;
  window.Promise = Promise;
  const flush = () => { for (let i = 0; i < 3; i++) frames.splice(0).forEach((cb) => cb(0)); };
  return { window, document: window.document, flush };
}

function run(win, rel) {
  const fn = new Function(...GLOBALS, src(rel));
  fn(...GLOBALS.map((name) => {
    const v = win[name];
    return typeof v === 'function' && !/^[A-Z]/.test(name) ? v.bind(win) : v;
  }));
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function pointer(win, type, el, x = 10, y = 10) {
  const e = new win.PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: x, clientY: y });
  el.dispatchEvent(e);
}

function setup(html) {
  const { window, document, flush } = makeWindow();
  document.body.innerHTML = html;
  run(window, 'js/components/ink-status.js');
  run(window, 'js/components/press-state.js');
  const btn = document.querySelector('.pill-btn');
  btn.getBoundingClientRect = () => ({ left: 0, top: 0, right: 120, bottom: 40, width: 120, height: 40 });
  return { window, document, flush, btn };
}

test('ink status: builds the loop, check and cross, and switches state', () => {
  const { window, document } = makeWindow();
  run(window, 'js/components/ink-status.js');
  const mark = window.InkStatus.make();
  document.body.appendChild(mark);
  assert.equal(mark.querySelectorAll('.ink-loop, .ink-check, .ink-cross').length, 3);
  assert.equal(mark.getAttribute('aria-hidden'), 'true');
  window.InkStatus.set(mark, 'loading');
  assert.ok(mark.classList.contains('is-loading'));
  window.InkStatus.set(mark, 'ok');
  assert.ok(mark.classList.contains('is-ok') && !mark.classList.contains('is-loading'));
  window.InkStatus.set(mark, 'idle');
  assert.equal(mark.getAttribute('class'), 'ink-status');
});

test('press: a pill shows pressed while held and clicks on release', () => {
  const { window, btn } = setup('<button class="pill-btn pill-btn--filled" type="button">Go</button>');
  let clicks = 0;
  btn.addEventListener('click', () => clicks++);
  pointer(window, 'pointerdown', btn);
  assert.ok(btn.classList.contains('is-pressed'));
  pointer(window, 'pointerup', btn);
  assert.ok(!btn.classList.contains('is-pressed'));
  btn.click();
  assert.equal(clicks, 1);
});

test('press: sliding off the pill cancels, the click never fires', () => {
  const { window, btn } = setup('<button class="pill-btn pill-btn--filled" type="button">Go</button>');
  let clicks = 0;
  btn.addEventListener('click', () => clicks++);
  pointer(window, 'pointerdown', btn);
  pointer(window, 'pointermove', btn, 200, 10);
  assert.ok(!btn.classList.contains('is-pressed'));
  pointer(window, 'pointerup', btn, 200, 10);
  btn.click();
  assert.equal(clicks, 0);
});

test('press: hold to confirm fires only after 600ms, early release cancels', async () => {
  const { window, btn, flush } = setup('<button class="pill-btn pill-btn--outline" type="button" data-hold-confirm>Cancel call</button>');
  let clicks = 0;
  btn.addEventListener('click', () => clicks++);
  pointer(window, 'pointerdown', btn);
  flush();
  assert.ok(btn.classList.contains('is-holding'));
  await wait(200);
  pointer(window, 'pointerup', btn);
  btn.click();
  assert.equal(clicks, 0, 'released at 200ms: nothing fires');
  pointer(window, 'pointerdown', btn);
  await wait(650);
  assert.equal(clicks, 1, 'held past 600ms: one confirmed click');
  pointer(window, 'pointerup', btn);
  btn.click();
  assert.equal(clicks, 1, 'the native click after release is swallowed');
});

test('press: a hold-to-confirm pill ignores a plain click or Enter without the hold', () => {
  const { btn } = setup('<button class="pill-btn pill-btn--outline" type="button" data-hold-confirm>Clear all data</button>');
  let clicks = 0;
  btn.addEventListener('click', () => clicks++);
  btn.click();
  assert.equal(clicks, 0, 'a click that did not come from a completed hold never fires');
});

test('press: disabled pills never press or click', () => {
  const { window, btn } = setup('<button class="pill-btn pill-btn--filled" type="button" aria-disabled="true">Full</button>');
  let clicks = 0;
  btn.addEventListener('click', () => clicks++);
  pointer(window, 'pointerdown', btn);
  assert.ok(!btn.classList.contains('is-pressed'));
  btn.click();
  assert.equal(clicks, 0);
});

test('press: busy locks the width, runs the ink and settles to success or error', async () => {
  const { window, btn } = setup('<button class="pill-btn pill-btn--filled" type="button">Book it</button>');
  const p = window.PillPress.busy(btn, new Promise((r) => setTimeout(r, 20)));
  assert.equal(btn.getAttribute('aria-busy'), 'true');
  assert.equal(btn.style.width, '120px');
  const ink = btn.querySelector('.ink-status');
  assert.ok(ink.classList.contains('is-loading'));
  await p;
  assert.equal(btn.getAttribute('aria-busy'), null);
  assert.ok(btn.classList.contains('is-ok'));
  assert.ok(ink.classList.contains('is-ok'));
  const q = window.PillPress.busy(btn, Promise.reject(new Error('no')));
  await q.catch(() => {});
  assert.ok(btn.classList.contains('is-bad'));
});
