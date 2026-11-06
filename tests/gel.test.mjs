// Tests for the painted gel on the squishy controls (D-103, built on the
// D-71 squish in js/components/press-state.js and css/components/gel.css).
// Every guard here has a planted negative control in this same file, so a
// guard that cannot fail is caught by its own control.
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

function makeWindow({ reduced = false, observer = true } = {}) {
  const window = new Window({ url: 'https://jayptl.me/', innerWidth: 1280, innerHeight: 800, settings: { disableCSSFileLoading: true, disableJavaScriptFileLoading: true } });
  window.matchMedia = (query) => ({
    matches: query.includes('reduce') ? reduced : query.includes('pointer: fine') || query.includes('hover: hover'),
    media: query,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}
  });
  window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  window.setTimeout = setTimeout;
  window.clearTimeout = clearTimeout;
  Object.defineProperty(window, 'CSS', { value: { supports: () => true }, configurable: true });
  if (!observer) Object.defineProperty(window, 'MutationObserver', { value: undefined, configurable: true });
  const calls = [];
  window.HTMLElement.prototype.animate = function (frames, opts) {
    calls.push({ el: this, to: frames[1].scale, opts });
    return { cancel() {}, set onfinish(fn) { this._f = fn; } };
  };
  return { window, document: window.document, calls };
}

function run(win, rel, source) {
  const fn = new Function(...GLOBALS, source || src(rel));
  fn(...GLOBALS.map((name) => {
    const v = win[name];
    return typeof v === 'function' && !/^[A-Z]/.test(name) ? v.bind(win) : v;
  }));
}

const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

// Every squishy family in its real markup, plus the things that must stay bare.
const PAGE =
  '<nav class="glass-nav"><button class="theme-toggle" id="navtheme" type="button" aria-label="Toggle theme"><svg class="moon-icon"></svg></button>' +
  '<a class="nav-link" id="navlink" href="/about">About</a></nav>' +
  '<div><button class="theme-toggle" id="theme" type="button" aria-label="Toggle theme"><svg class="moon-icon"></svg></button></div>' +
  '<p><a class="pill-btn pill-btn--filled" id="filled" href="/book">Book a call</a></p>' +
  '<p><button class="pill-btn pill-btn--outline" id="outline" type="button">Copy email</button></p>' +
  '<p><a class="pill-btn pill-btn--quiet" id="quiet" href="/projects">Read it</a></p>' +
  '<div class="talk-chip"><a class="talk-chip-book pill-btn pill-btn--filled" id="chipbook" href="/book">Book 15 min</a>' +
  '<button class="mobile-social-pill" id="chipsocial" type="button">Copy</button></div>' +
  '<div class="work-deck-pills"><button class="work-deck-pill is-active" id="deck1" type="button">01</button><button class="work-deck-pill" id="deck2" type="button">02</button></div>' +
  '<div class="scroll-stack-pills"><button class="scroll-stack-pill is-active" id="stack1" type="button">01</button></div>' +
  '<div class="slot-days"><input type="radio" name="d" id="d0" checked><label class="day-pill" id="day0" for="d0"><span class="day-name">Mon</span></label>' +
  '<input type="radio" name="d" id="d1"><label class="slot-pill" id="slot1" for="d1"><span class="slot-local">10:00</span></label></div>' +
  '<div class="island-scroll-body"><a class="mobile-all-projects" id="allproj" href="/projects">All projects</a>' +
  '<div class="mobile-social-row"><a class="mobile-social-pill highlight" id="social" href="/contact">Say hi</a>' +
  '<button type="button" class="mobile-social-pill" id="copyisland" data-copy="hello@jayptl.me" aria-label="Copy email hello@jayptl.me">' +
  '<svg aria-hidden="true"></svg><span>Copy email</span></button></div></div>' +
  '<a class="case-card" data-linked id="card" href="/projects/aviz-health">Card</a>' +
  '<div class="pill-btn pill-btn--filled" id="inertdiv">Not a control</div>';

const GEL_IDS = ['theme', 'filled', 'outline', 'deck1', 'deck2', 'stack1', 'day0', 'slot1', 'allproj', 'social', 'copyisland'];
const BARE_IDS = ['quiet', 'navtheme', 'chipbook', 'chipsocial', 'navlink', 'card', 'inertdiv'];

function layers(el) {
  return {
    shadow: el.querySelectorAll(':scope > .gel-shadow').length,
    body: el.querySelectorAll(':scope > .gel-body').length
  };
}

function page(opts) {
  const env = makeWindow(opts);
  env.document.body.innerHTML = PAGE;
  run(env.window, 'js/components/press-state.js');
  return env;
}

// The checker the injection tests use: every listed host carries exactly one
// shadow and one body as its first two children, hidden from screen readers.
function injectionViolations(document, ids) {
  const out = [];
  for (const id of ids) {
    const el = document.getElementById(id);
    const n = layers(el);
    if (n.shadow !== 1 || n.body !== 1) out.push(`${id}: ${n.shadow} shadow, ${n.body} body`);
    else {
      const [a, b] = el.children;
      if (!a.classList.contains('gel-shadow') || !b.classList.contains('gel-body')) out.push(`${id}: layers are not first`);
      if (a.getAttribute('aria-hidden') !== 'true' || b.getAttribute('aria-hidden') !== 'true') out.push(`${id}: layers not aria-hidden`);
      if (!el.classList.contains('has-gel')) out.push(`${id}: no has-gel`);
    }
  }
  return out;
}

function bareViolations(document, ids) {
  return ids.filter((id) => {
    const el = document.getElementById(id);
    return el.querySelector('.gel-shadow, .gel-body') || el.classList.contains('has-gel');
  });
}

/* ---- Injection --------------------------------------------------------- */

test('gel: every squishy family gets its layers on mount, text and names unchanged', () => {
  const { document } = page();
  assert.deepEqual(injectionViolations(document, GEL_IDS), []);
  assert.equal(document.getElementById('filled').textContent, 'Book a call', 'the layers carry no text');
  assert.equal(document.getElementById('day0').textContent, 'Mon');
  const tabs = GEL_IDS.filter((id) => document.getElementById(id).classList.contains('gel--tab'));
  assert.deepEqual(tabs, ['deck1', 'deck2', 'stack1'], 'only the deck and stack tabs are marked as tabs');
});

test('gel: talk chip pills, quiet text pills, the navbar icon toggle, firm cards, links and non-controls stay bare', () => {
  const { document } = page();
  assert.deepEqual(bareViolations(document, BARE_IDS), []);
});

test('gel, negative control: the checkers catch a missing, doubled or misplaced layer and a stray one', () => {
  const { document } = page();
  const filled = document.getElementById('filled');
  filled.appendChild(filled.querySelector('.gel-body').cloneNode());
  assert.deepEqual(injectionViolations(document, ['filled']), ['filled: 1 shadow, 2 body']);
  const outline = document.getElementById('outline');
  outline.querySelector('.gel-shadow').remove();
  assert.deepEqual(injectionViolations(document, ['outline']), ['outline: 0 shadow, 1 body']);
  const deck = document.getElementById('deck2');
  deck.appendChild(deck.querySelector('.gel-shadow'));
  assert.deepEqual(injectionViolations(document, ['deck2']), ['deck2: layers are not first']);
  const quiet = document.getElementById('quiet');
  quiet.appendChild(document.createElement('span')).className = 'gel-body';
  assert.deepEqual(bareViolations(document, ['quiet', 'card']), ['quiet']);
});

test('gel: no double injection on a second scan, a repeat page:ready or a second copy of the script', async () => {
  const { window, document } = page();
  window.Gel.scan(document);
  window.dispatchEvent(new window.CustomEvent('page:ready'));
  window.dispatchEvent(new window.CustomEvent('page:ready'));
  run(window, 'js/components/press-state.js');
  await tick();
  assert.deepEqual(injectionViolations(document, GEL_IDS), []);
});

test('gel, negative control: without the already-injected check, a rescan doubles the layers', () => {
  const env = makeWindow({ observer: false });
  env.document.body.innerHTML = PAGE;
  const code = src('js/components/press-state.js');
  const guard = "if (el.querySelector(':scope > .gel-body')) return false;";
  assert.ok(code.includes(guard), 'the guard this control removes is in the file');
  run(env.window, null, code.replace(guard, ''));
  env.window.Gel.scan(env.document);
  assert.deepEqual(injectionViolations(env.document, ['filled']), ['filled: 2 shadow, 2 body']);
});

test('gel: a router swap gets fresh layers on page:ready (no observer needed)', () => {
  const { window, document } = page({ observer: false });
  document.body.innerHTML = '<main><p><a class="pill-btn pill-btn--filled" id="next" href="/x">Next</a></p>' +
    '<div class="talk-chip"><a class="pill-btn pill-btn--filled" id="nextchip" href="/book">Book</a></div></main>';
  assert.deepEqual(injectionViolations(document, ['next']), ['next: 0 shadow, 0 body'], 'negative control: nothing before page:ready');
  window.dispatchEvent(new window.CustomEvent('page:ready'));
  assert.deepEqual(injectionViolations(document, ['next']), []);
  assert.deepEqual(bareViolations(document, ['nextchip']), []);
});

test('gel: controls built later by script get layers, and a host that loses them gets them back', async () => {
  const { document } = page();
  const btn = document.createElement('button');
  btn.className = 'audio-toggle';
  btn.id = 'audio';
  btn.innerHTML = '<svg></svg>';
  document.body.appendChild(btn);
  await tick();
  assert.deepEqual(injectionViolations(document, ['audio']), []);
  const deck = document.getElementById('deck1');
  deck.textContent = '03';
  await tick();
  assert.deepEqual(injectionViolations(document, ['deck1']), []);
  assert.equal(deck.textContent, '03');
});

test('gel, negative control: with no observer, a control built later stays bare until page:ready', async () => {
  const { window, document } = page({ observer: false });
  const btn = document.createElement('button');
  btn.className = 'audio-toggle';
  btn.id = 'audio';
  document.body.appendChild(btn);
  await tick();
  assert.deepEqual(injectionViolations(document, ['audio']), ['audio: 0 shadow, 0 body'], 'so the test above proves the observer did it');
  window.dispatchEvent(new window.CustomEvent('page:ready'));
  assert.deepEqual(injectionViolations(document, ['audio']), []);
});

/* ---- Scripts that write a pill's label ------------------------------- */

// js/components/talk-chip.js swapLabel: the island's copy pill (navbar.js) says "Copied"
// in its own label. The gel layers are the pill's first spans, so a reader that takes
// the first span writes into the shadow instead (review 2026-11-05, finding 1).
const LABEL_LINE = "var label = btn.querySelector('span:not([aria-hidden=\"true\"])');";

async function islandCopy(talkChipSource) {
  const env = page();
  Object.defineProperty(env.window.navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });
  run(env.window, 'js/components/talk-chip.js', talkChipSource);
  const btn = env.document.getElementById('copyisland');
  btn.click();
  await tick(20);
  return {
    label: btn.querySelector(':scope > span:not(.gel-shadow):not(.gel-body)').textContent,
    layers: btn.querySelector('.gel-shadow').textContent + btn.querySelector('.gel-body').textContent
  };
}

test('gel: the island copy pill says Copied in its own label, and the layers stay empty', async () => {
  assert.ok(src('js/components/talk-chip.js').includes(LABEL_LINE), 'swapLabel skips the hidden layers');
  assert.deepEqual(await islandCopy(), { label: 'Copied', layers: '' });
});

test('gel, negative control: the old first-span reader writes Copied into the shadow', async () => {
  const old = src('js/components/talk-chip.js').replace(LABEL_LINE, "var label = btn.querySelector('span');");
  assert.deepEqual(await islandCopy(old), { label: 'Copy email', layers: 'Copied' });
});

/* ---- Press state for the gel ------------------------------------------- */

function down(win, el, extra = {}) {
  el.dispatchEvent(new win.PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse', pointerId: 1, isPrimary: true, clientX: 10, clientY: 10, ...extra }));
}
function up(win, extra = {}) {
  win.dispatchEvent(new win.PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 10, clientY: 10, ...extra }));
}

test('gel press: held while down, released on up, cancelled by sliding off or Escape; talk chip never', () => {
  const { window, document } = page();
  const theme = document.getElementById('theme');
  theme.getBoundingClientRect = () => ({ left: 0, top: 0, right: 36, bottom: 36, width: 36, height: 36 });
  down(window, theme);
  assert.ok(theme.classList.contains('gel-held'));
  up(window);
  assert.ok(!theme.classList.contains('gel-held'));

  down(window, theme);
  window.dispatchEvent(new window.PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 120, clientY: 10 }));
  assert.ok(!theme.classList.contains('gel-held'), 'sliding off releases');

  const day = document.getElementById('day0');
  document.getElementById('d0').focus();
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  assert.ok(day.classList.contains('gel-held'), 'Space on the radio holds its booking pill');
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.ok(!day.classList.contains('gel-held'));

  const chip = document.getElementById('chipbook');
  down(window, chip);
  assert.ok(!chip.classList.contains('gel-held'));
  up(window);
});

test('gel press: reduced motion still shows the press as colour and shadow, with no squash', () => {
  const { window, document, calls } = page({ reduced: true });
  const filled = document.getElementById('filled');
  filled.getBoundingClientRect = () => ({ left: 0, top: 0, right: 150, bottom: 44, width: 150, height: 44 });
  down(window, filled);
  assert.ok(filled.classList.contains('gel-held'), 'the gel press state is set');
  assert.equal(calls.length, 0, 'no scale animation runs');
  up(window);
  assert.ok(!filled.classList.contains('gel-held'));
});

test('gel press, negative control: a busy pill never holds', () => {
  const { window, document } = page();
  const filled = document.getElementById('filled');
  filled.setAttribute('aria-busy', 'true');
  down(window, filled);
  assert.ok(!filled.classList.contains('gel-held'));
  filled.removeAttribute('aria-busy');
  down(window, filled);
  assert.ok(filled.classList.contains('gel-held'), 'the same pill holds once it is not busy');
  up(window);
});

/* ---- Stylesheet guards ------------------------------------------------- */

const CSS = src('css/components/gel.css');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

function mediaBlocks(css, query) {
  const body = strip(css);
  const out = [];
  let i = body.indexOf(query);
  while (i !== -1) {
    let j = body.indexOf('{', i);
    let depth = 1;
    let k = j + 1;
    while (depth && k < body.length) {
      if (body[k] === '{') depth++;
      else if (body[k] === '}') depth--;
      k++;
    }
    out.push(body.slice(j + 1, k - 1));
    i = body.indexOf(query, k);
  }
  return out;
}

// Reduced motion end state: nothing moves, nothing animates; only colour,
// shadow and opacity differ between rest and pressed.
function reducedMotionViolations(css) {
  const blocks = mediaBlocks(css, '@media (prefers-reduced-motion: reduce)');
  const v = [];
  if (!blocks.length) v.push('no reduced-motion block');
  for (const b of blocks) {
    for (const m of b.matchAll(/(?:^|[;{\s])transform\s*:\s*([^;}]+)/g)) {
      if (m[1].trim() !== 'none') v.push(`reduced motion moves: transform: ${m[1].trim()}`);
    }
    for (const m of b.matchAll(/transition(?:-duration)?\s*:\s*([^;}]+)/g)) {
      if (!/^(none|0m?s)$/.test(m[1].trim())) v.push(`reduced motion animates: ${m[1].trim()}`);
    }
  }
  const all = blocks.join('\n');
  if (!/gel-shadow[^{]*\{[^}]*transform:\s*none/.test(all)) v.push('the shadow still tucks in');
  if (!/gel-body::before[^{]*\{[^}]*transform:\s*none/.test(all)) v.push('the highlight still flattens');
  if (!/--g-rim-press:\s*var\(--g-press-inset\)/.test(all)) v.push('the press shows no inset colour change');
  return v;
}

test('gel: under reduced motion only colour and shadow change', () => {
  assert.deepEqual(reducedMotionViolations(CSS), []);
});

test('gel, negative control: a moving or animated press under reduced motion is caught', () => {
  const block = '@media (prefers-reduced-motion: reduce)';
  const planted = CSS.replace(block + ' {', block + ' {\n.has-gel.gel-held > .gel-body::before { transform: scaleY(0.8); }\n.has-gel { transition: opacity 150ms ease; }\n');
  const v = reducedMotionViolations(planted);
  assert.ok(v.some((x) => /moves: transform: scaleY/.test(x)), v.join('; '));
  assert.ok(v.some((x) => /animates: opacity 150ms/.test(x)), v.join('; '));
  assert.ok(reducedMotionViolations('.x{}').includes('no reduced-motion block'));
});

// Outside reduced motion the press moves transform and opacity only:
// no animated box-shadow, filter or backdrop-filter (D-103).
function pressViolations(css) {
  const body = strip(css);
  const v = [];
  for (const m of body.matchAll(/transition\s*:\s*([^;}]+)/g)) {
    for (const part of m[1].split(/,(?![^(]*\))/)) {
      const prop = part.trim().split(/\s+/)[0];
      if (!['transform', 'opacity', 'none'].includes(prop)) v.push(`transition on ${prop}`);
    }
  }
  if (/(^|[;{\s])filter\s*:(?!\s*none)/.test(body)) v.push('a filter');
  if (/backdrop-filter\s*:(?!\s*none)/.test(body)) v.push('a backdrop-filter');
  return v;
}

test('gel: the press animates transform and opacity only, with no filter anywhere', () => {
  assert.deepEqual(pressViolations(CSS), []);
});

test('gel, negative control: an animated shadow, a filter or a backdrop-filter is caught', () => {
  const planted = CSS + '\n.has-gel > .gel-body { transition: box-shadow 140ms ease; filter: blur(2px); backdrop-filter: blur(4px); }';
  assert.deepEqual(pressViolations(planted), ['transition on box-shadow', 'a filter', 'a backdrop-filter']);
});

// Hover (review finding 3): the gel's own paint cancels the old hover tints, so the gel
// answers hover itself. Fine pointers only, transform and opacity only, never on the
// host's own transform (the 1px pill lift of D-62 lives in buttons.css), and the press
// still wins over hover.
const FINE = '@media (hover: hover) and (pointer: fine)';

function hoverViolations(css) {
  const v = [];
  const body = strip(css);
  const fine = mediaBlocks(css, FINE).join('\n');
  // Hover may also appear in the reduced-motion block, only to switch its movement off.
  const block = (q) => new RegExp(q.replace(/[()]/g, '\\$&') + '\\s*\\{[\\s\\S]*?\\n\\}', 'g');
  const outside = body.replace(block(FINE), '').replace(block('@media (prefers-reduced-motion: reduce)'), '');
  if (/:hover/.test(outside)) v.push('a hover rule outside the fine-pointer query');
  if (!fine) v.push('no fine-pointer hover');
  for (const m of fine.matchAll(/([^{}]*:hover[^{}]*)\{([^}]*)\}/g)) {
    for (const d of m[2].split(';').map((x) => x.trim()).filter(Boolean)) {
      const prop = d.split(':')[0].trim();
      if (!['transform', 'opacity'].includes(prop)) v.push(`hover sets ${prop}`);
    }
    if (!/>\s*\.gel-/.test(m[1])) v.push('hover moves the host itself');
    if (!/:not\(\[aria-busy="true"\]\)/.test(m[1]) || !/:not\(:disabled\)/.test(m[1])) v.push('hover reaches a busy or disabled control');
  }
  if (!/:hover[^{]*>\s*\.gel-body::before[^{]*\{[^}]*transform/.test(fine)) v.push('the highlight does not answer hover');
  if (!/:hover[^{]*>\s*\.gel-body::after[^{]*\{[^}]*opacity/.test(fine)) v.push('the caustic does not answer hover');
  // A box shadow is cut out under its own box: moving the shadow layer opens a pale rim
  // under the pill (seen in the fix-round render, 2026-11-05), so hover leaves it alone.
  if (/:hover[^{]*>\s*\.gel-shadow/.test(fine)) v.push('hover moves the shadow layer');
  const hoverAt = body.indexOf(FINE);
  const pressAt = body.indexOf(':is(.is-pressed, .gel-held) > .gel-shadow {');
  if (hoverAt === -1 || pressAt === -1 || pressAt < hoverAt) v.push('the press rules must come after hover so the press wins');
  const rm = mediaBlocks(css, '@media (prefers-reduced-motion: reduce)').join('\n');
  if (!/:hover[^{]*>\s*\.gel-body::before[^{]*\{[^}]*transform:\s*none/.test(rm)) v.push('hover still moves under reduced motion');
  return v;
}

test('gel: hover answers on fine pointers with transform and opacity only, and leaves the pill lift alone', () => {
  assert.deepEqual(hoverViolations(CSS), []);
  assert.match(src('css/components/buttons.css'), /:hover \{\n\s+transform: translateY\(-1px\);/, 'the D-62 lift is still in buttons.css');
  assert.doesNotMatch(strip(CSS), /\.has-gel[^{>]*\{[^}]*(^|[;\s])transform\s*:/m, 'gel.css never sets the host transform');
});

test('gel, negative control: a hover tint, a coarse-pointer hover, a moved host or shadow, and no hover at all are caught', () => {
  const tint = CSS + '\n' + FINE + ' {\n.has-gel:not(:disabled):not([aria-busy="true"]):hover > .gel-body { background: red; }\n}';
  assert.ok(hoverViolations(tint).includes('hover sets background'), hoverViolations(tint).join('; '));
  const coarse = CSS + '\n.has-gel:hover > .gel-shadow { opacity: 1; }';
  assert.ok(hoverViolations(coarse).includes('a hover rule outside the fine-pointer query'));
  const host = CSS + '\n' + FINE + ' {\n.has-gel:not(:disabled):not([aria-busy="true"]):hover { transform: none; }\n}';
  assert.ok(hoverViolations(host).includes('hover moves the host itself'));
  assert.ok(hoverViolations('.x {}').includes('no fine-pointer hover'));
  const rim = CSS + '\n' + FINE + ' {\n.has-gel:not(:disabled):not([aria-busy="true"]):hover > .gel-shadow { transform: translateY(2px) scale(1.03); }\n}';
  assert.ok(hoverViolations(rim).includes('hover moves the shadow layer'));
});

// --pill-ink (review finding 4): the gel ink must reach the Ink Status mark, so the
// declaration needs at least the specificity of the look rules in buttons.css (0,2,0).
function pillInkSpecificity(css) {
  const m = /([^{}]+)\{[^}]*--pill-ink\s*:\s*var\(--g-ink\)/.exec(strip(css));
  if (!m) return 0;
  return Math.max(...m[1].split(',').map((sel) => (sel.match(/\.[a-z-]+|\[[^\]]+\]|:(?!not|is|where)[a-z-]+/g) || []).length));
}

test('gel: the gel ink reaches the Ink Status mark on gel pills', () => {
  assert.ok(pillInkSpecificity(CSS) >= 2, `--pill-ink at ${pillInkSpecificity(CSS)} classes loses to .pill-btn.pill-btn--filled`);
});

test('gel, negative control: --pill-ink on the bare host is caught', () => {
  assert.equal(pillInkSpecificity('.has-gel { --pill-ink: var(--g-ink); }'), 1);
  assert.equal(pillInkSpecificity('.x {}'), 0);
});

/* ---- Ramps and contrast ------------------------------------------------ */

function recipe(css, name) {
  const m = new RegExp(`/\\* recipe: ${name} \\*/\\s*[^{]+\\{([^}]*)\\}`, 'g');
  const all = [...css.matchAll(m)].map((x) => x[1].replace(/\s+/g, ' ').trim());
  return all;
}

function vars(block) {
  const out = {};
  for (const m of block.matchAll(/(--g-[a-z-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

function rgba(s) {
  if (s.startsWith('#')) {
    const h = s.slice(1);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const n = s.match(/[\d.]+/g).map(Number);
  return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1];
}

// The body gradient's colour at a height, laid over the page.
function bodyAt(gradient, pct, page) {
  const stops = [...gradient.matchAll(/(rgba?\([^)]*\)|#[0-9a-f]{6})\s+([\d.]+)%/gi)].map((m) => ({ c: rgba(m[1]), p: Number(m[2]) }));
  let a = stops[0];
  let b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (pct >= stops[i].p && pct <= stops[i + 1].p) { a = stops[i]; b = stops[i + 1]; break; }
  }
  const t = b.p === a.p ? 0 : (pct - a.p) / (b.p - a.p);
  const c = a.c.map((v, i) => v + (b.c[i] - v) * t);
  return [0, 1, 2].map((i) => c[i] * c[3] + page[i] * (1 - c[3]));
}

// Label contrast across the band the glyphs sit in (40% to 60% of the height).
function labelContrast(v, page) {
  const ink = rgba(v['--g-ink']);
  let min = Infinity;
  for (const pct of [40, 45, 50, 55, 60]) min = Math.min(min, ratio(lum(ink), lum(bodyAt(v['--g-body'], pct, page))));
  return +min.toFixed(2);
}

function tabContrast(v) {
  const ink = rgba(v['--g-ink']);
  let min = Infinity;
  for (const pct of [20, 30, 40, 50, 60, 70, 80]) min = Math.min(min, ratio(lum(ink), lum(bodyAt(v['--g-body-tab'] || v['--g-body'], pct, WHITE))));
  return +min.toFixed(2);
}

const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];
const RECIPES = [['light-fill', WHITE], ['light-clear', WHITE], ['dark-fill', BLACK], ['dark-clear', BLACK]];

function recipeViolations(css) {
  const v = [];
  for (const [name] of RECIPES) if (!recipe(css, name).length) v.push(`${name} is missing`);
  for (const name of ['dark-fill', 'dark-clear']) {
    const copies = recipe(css, name);
    if (copies.length !== 2) v.push(`${name}: ${copies.length} copies, want the data-theme rule and the system-dark fallback`);
    else if (copies[0] !== copies[1]) v.push(`${name}: the two copies drifted`);
  }
  return v;
}

test('gel: each recipe is defined, and the dark recipes match their no-attribute fallback copy', () => {
  assert.deepEqual(recipeViolations(CSS), []);
});

test('gel, negative control: a drifted fallback copy or a missing recipe is caught', () => {
  const parts = CSS.split('--g-ink: #80e2ea;');
  assert.equal(parts.length, 3, 'two dark-clear inks to plant against');
  const drifted = parts[0] + '--g-ink: #80e2ea;' + parts[1] + '--g-ink: #4dd6e2;' + parts[2];
  assert.deepEqual(recipeViolations(drifted), ['dark-clear: the two copies drifted']);
  assert.ok(recipeViolations(CSS.replace('/* recipe: light-fill */', '')).includes('light-fill is missing'));
});

test('gel: every label clears 4.5:1 on its own gel, in both themes', (t) => {
  const found = {};
  for (const [name, pageBg] of RECIPES) {
    found[name] = labelContrast(vars(recipe(CSS, name)[0]), pageBg);
    assert.ok(found[name] >= 4.5, `${name}: ${found[name]}`);
  }
  // An active deck or stack tab is about 20px tall: its label covers 20% to 80% of the height.
  found['light-fill tab'] = tabContrast(vars(recipe(CSS, 'light-fill')[0]));
  assert.ok(found['light-fill tab'] >= 4.5, `light-fill tab: ${found['light-fill tab']}`);
  // Recorded so a reader can see the numbers this guard computed.
  t.diagnostic(`label contrast ${JSON.stringify(found)}`);
});

test('gel, negative control: a lighter body under the label fails the contrast guard', () => {
  const v = vars(recipe(CSS, 'light-fill')[0]);
  const today = { ...v, '--g-body': 'linear-gradient(180deg, rgba(33, 150, 243, 1) 0%, rgba(33, 150, 243, 1) 100%)' };
  assert.ok(labelContrast(today, WHITE) < 4.5, 'the plain #2196f3 fill under white ink is caught');
  const dim = { ...vars(recipe(CSS, 'dark-clear')[0]), '--g-ink': '#1a3a40' };
  assert.ok(labelContrast(dim, BLACK) < 4.5, 'a dim ink on dark glass is caught');
  const { '--g-body-tab': _tab, ...noTab } = v;
  assert.ok(tabContrast(noTab) < 4.5, 'a tab painted with the tall-pill body is caught');
});

// Light is the blue ramp only, dark the turquoise ramp only (AGENTS.md). Checked by hue,
// so a blue or turquoise outside the named ramp values is caught too: light fails on any
// saturated colour at hue 170 to 198 (turquoise), dark on any at hue 200 to 250 (blue).
//
// One named exception, on purpose: the dark clear gel's navy body, rgba(22, 36, 48) to
// rgba(10, 17, 25). It is the site's own dark obsidian glass, the same family as the
// surface AGENTS.md specifies for dark mode, linear-gradient(135deg, rgba(14, 22, 33, 0.78),
// rgba(8, 13, 20, 0.88)), hue about 208 to 214. It is a near-black slate, not the blue
// ramp, and Jay's coordinator ruled on 2026-11-05 to keep it. Do not flag it as blue.
const OBSIDIAN = [[22, 36, 48], [10, 17, 25]];

function hueSat([r, g, b]) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0 };
  const s = d / (1 - Math.abs(2 * l - 1));
  const [R, G, B] = [r / 255, g / 255, b / 255];
  let h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s };
}

function colours(block) {
  return [...block.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])])
    .concat([...block.matchAll(/#([0-9a-f]{6})\b/gi)].map((m) => [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16))));
}

function rampViolations(css) {
  const v = [];
  const isObsidian = (c) => OBSIDIAN.some((o) => o.every((x, i) => x === c[i]));
  for (const name of ['light-fill', 'light-clear']) {
    for (const block of recipe(css, name)) {
      for (const c of colours(block)) {
        const { h, s } = hueSat(c);
        if (s > 0.2 && h >= 170 && h <= 198) v.push(`${name} carries turquoise rgb(${c.join(', ')})`);
      }
    }
  }
  for (const name of ['dark-fill', 'dark-clear']) {
    for (const block of recipe(css, name)) {
      for (const c of colours(block)) {
        const { h, s } = hueSat(c);
        if (s > 0.2 && h >= 200 && h <= 250 && !isObsidian(c)) v.push(`${name} carries blue rgb(${c.join(', ')})`);
      }
    }
  }
  return v;
}

test('gel: light carries no turquoise and dark carries no blue (the obsidian navy is the named exception)', () => {
  assert.deepEqual(rampViolations(CSS), []);
  const darkClear = colours(recipe(CSS, 'dark-clear')[0]);
  assert.ok(OBSIDIAN.every((o) => darkClear.some((c) => c.every((x, i) => x === o[i]))), 'the obsidian exception is still in use, or drop it');
});

test('gel, negative control: a turquoise light recipe, a blue dark recipe and an off-ramp blue are caught', () => {
  const mixed = CSS.replace(/(\/\* recipe: light-fill \*\/\s*[^{]+\{)/, '$1 --g-x: rgba(0, 184, 204, 0.5);')
    .replace(/(\/\* recipe: dark-clear \*\/\s*[^{]+\{)/, '$1 --g-y: rgba(33, 150, 243, 0.5); --g-z: rgba(30, 60, 120, 0.5);');
  const v = rampViolations(mixed);
  assert.ok(v.includes('light-fill carries turquoise rgb(0, 184, 204)'), v.join('; '));
  assert.ok(v.includes('dark-clear carries blue rgb(33, 150, 243)'), v.join('; '));
  assert.ok(v.includes('dark-clear carries blue rgb(30, 60, 120)'), 'a blue that is not on the ramp list is caught by hue');
  assert.equal(hueSat([22, 36, 48]).h > 200, true, 'the obsidian really is a blue hue, so only the named exception lets it pass');
});

/* ---- Wiring ------------------------------------------------------------ */

// Right after the squish, behind the time rail that already claims that slot (tests/time-rail.test.mjs).
const GEL_IMPORT = /@import 'components\/squish\.css';\n@import 'components\/time-rail\.css';\n@import 'components\/gel\.css';/;

test('gel: the stylesheet loads after the squish and the time rail, and the old paint stays as the no-script fallback', () => {
  const main = src('css/main.css');
  assert.match(main, GEL_IMPORT);
  assert.doesNotMatch(main.replace("@import 'components/gel.css';\n", ''), GEL_IMPORT, 'negative control: without the line it fails');
  // The gel only takes over a host the script marked; without it buttons.css paints as before.
  assert.match(src('css/components/buttons.css'), /\.pill-btn\.pill-btn--filled \{[^}]*background: var\(--sf-accent\)/);
  assert.match(strip(CSS), /\.has-gel\s*\{[^}]*background:\s*transparent\s*!important/);
});

test('gel: the release keeps the D-71 spring, not the softer wobble', () => {
  const { window } = page();
  assert.equal(window.Squish.spring.ms, 353, 'stiffness 600, damping 34');
  const WOBBLE = /springCurve\(500,\s*20/;
  assert.doesNotMatch(src('js/components/press-state.js'), WOBBLE);
  assert.match('spring = springCurve(500, 20, 1, 40);', WOBBLE, 'negative control: the softer wobble is caught');
  assert.match(window.document.documentElement.style.getPropertyValue('--gel-firm'), /^linear\(0, /, 'layers settle on the critically damped curve');
});
