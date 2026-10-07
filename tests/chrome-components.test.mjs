// Tests for the shared component contract and the global chrome added in
// phases 0 and 1: mount registry, Ink Mark, Glide Wheel, Command Deck,
// Talk Chip, Edge Blur and Control Dock.
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

function makeWindow({ width = 1280, height = 800, reduced = false, url = 'https://jayptl.me/about' } = {}) {
  const window = new Window({ url, innerWidth: width, innerHeight: height });
  window.matchMedia = (query) => ({
    matches: query.includes('reduce') ? reduced
      : query.includes('pointer: fine') || query.includes('hover: hover'),
    media: query,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}
  });
  let now = 0;
  const frames = [];
  window.performance.now = () => now;
  window.requestAnimationFrame = (cb) => { frames.push(cb); return frames.length; };
  window.cancelAnimationFrame = () => {};
  window.setTimeout = setTimeout;
  window.clearTimeout = clearTimeout;
  window.fetch = async () => ({ ok: false, text: async () => '' });
  let scrollY = 0;
  Object.defineProperty(window, 'scrollY', { get: () => scrollY, configurable: true });
  window.scrollTo = (a, b) => {
    scrollY = typeof a === 'object' ? a.top : b;
    window.dispatchEvent(new window.Event('scroll'));
  };
  const flush = (ms = 16, count = 1) => {
    for (let i = 0; i < count; i++) {
      now += ms;
      const batch = frames.splice(0);
      batch.forEach((cb) => cb(now));
    }
  };
  return { window, document: window.document, flush, setScroll: (y) => { scrollY = y; } };
}

function run(win, rel) {
  const fn = new Function(...GLOBALS, src(rel));
  fn(...GLOBALS.map((name) => {
    const v = win[name];
    return typeof v === 'function' && !/^[A-Z]/.test(name) ? v.bind(win) : v;
  }));
}

/* ---- Mount registry --------------------------------------------------- */

test('mount: mounts a host once and unmounts it after a router swap removes it', () => {
  const { window, document } = makeWindow();
  document.body.innerHTML = '<main><div data-component="demo"></div></main>';
  run(window, 'js/components/mount.js');
  let mounts = 0;
  let unmounts = 0;
  window.Mount.register('demo', { mount: () => { mounts++; return 'state'; }, unmount: (el, s) => { assert.equal(s, 'state'); unmounts++; } });
  assert.equal(mounts, 1);
  window.Mount.scan(document);
  assert.equal(mounts, 1, 'never binds twice');
  document.body.innerHTML = '<main><div data-component="demo"></div></main>';
  window.dispatchEvent(new window.CustomEvent('page:ready'));
  assert.equal(unmounts, 1);
  assert.equal(mounts, 2);
});

test('mount: global chrome mounts once and refreshes on page:ready', () => {
  const { window } = makeWindow();
  run(window, 'js/components/mount.js');
  let mounts = 0;
  let refreshes = 0;
  window.Mount.register('chrome', { global: true, mount: () => mounts++, refresh: () => refreshes++ });
  window.dispatchEvent(new window.CustomEvent('page:ready'));
  window.dispatchEvent(new window.CustomEvent('page:ready'));
  assert.equal(mounts, 1);
  assert.equal(refreshes, 2);
});

/* ---- Ink Mark --------------------------------------------------------- */

test('ink mark: every mark renders an aria-hidden, draw-ready svg with its default placement', () => {
  const { window, document } = makeWindow({ reduced: true });
  run(window, 'js/components/mount.js');
  const names = ['squiggle', 'marker', 'scribble-out', 'loop-arrow', 'heart', 'check', 'box', 'brace', 'burst', 'zigzag', 'here', 'margin'];
  document.body.innerHTML = names.map((n) => `<span data-ink="${n}">${n === 'zigzag' ? '' : 'word'}</span>`).join('');
  run(window, 'js/components/ink-mark.js');
  assert.deepEqual(window.InkMark.marks.sort(), names.slice().sort());
  document.querySelectorAll('[data-ink]').forEach((el) => {
    const svg = el.querySelector('svg.ink-svg.doodle-draw');
    assert.ok(svg, `${el.dataset.ink} has an svg`);
    assert.equal(svg.getAttribute('aria-hidden'), 'true');
    svg.querySelectorAll('path').forEach((p) => assert.equal(p.getAttribute('pathLength'), '1'));
    assert.ok(svg.classList.contains('is-drawn'), 'reduced motion draws at once');
  });
  assert.ok(document.querySelector('[data-ink="squiggle"]').classList.contains('ink--under'));
  assert.ok(document.querySelector('[data-ink="marker"]').classList.contains('ink--behind'));
  assert.ok(document.querySelector('[data-ink="zigzag"]').classList.contains('ink--block'));
  assert.ok(document.querySelector('[data-ink="heart"]').classList.contains('ink--solo'));
});

test('ink mark: an empty host renders solo and hides itself from assistive tech', () => {
  const { window, document } = makeWindow({ reduced: true });
  run(window, 'js/components/mount.js');
  document.body.innerHTML = '<p>made with <span data-ink="heart"></span></p>';
  run(window, 'js/components/ink-mark.js');
  const host = document.querySelector('[data-ink]');
  assert.ok(host.classList.contains('ink--solo'));
  assert.equal(host.getAttribute('aria-hidden'), 'true');
});

test('ink mark: sprite asset and every inline sprite copy carry all 12 marks', () => {
  const ids = ['squiggle', 'marker', 'scribble-out', 'loop-arrow', 'heart', 'check', 'box', 'brace', 'burst', 'zigzag', 'here', 'margin'];
  for (const file of ['assets/doodle-sprite.svg', 'index.html', 'pages/about.html', 'pages/404.html', 'pages/500.html', 'pages/design-system.html']) {
    const text = src(file);
    for (const id of ids) assert.ok(text.includes(`id="d-${id}"`), `${file} has d-${id}`);
  }
});

/* ---- Glide Wheel ------------------------------------------------------ */

function glideEnv(opts) {
  const env = makeWindow(opts);
  const { window, document } = env;
  document.body.innerHTML = '<main style="height:5000px"><p id="t">x</p></main>';
  Object.defineProperty(document.documentElement, 'scrollHeight', { value: 5000, configurable: true });
  run(window, 'js/components/scroll-glide.js');
  const wheel = (init) => {
    const e = new window.WheelEvent('wheel', Object.assign({ bubbles: true, cancelable: true, deltaMode: 0 }, init));
    // The test DOM drops modifier keys from WheelEvent init, so set them here.
    for (const key of ['ctrlKey', 'metaKey', 'shiftKey']) {
      Object.defineProperty(e, key, { value: Boolean(init[key]) });
    }
    document.getElementById('t').dispatchEvent(e);
    return e;
  };
  return Object.assign(env, { wheel });
}

test('glide wheel: a mouse notch is taken over and settles on target in about a second', () => {
  const { window, wheel, flush } = glideEnv();
  const e = wheel({ deltaY: 100 });
  assert.equal(e.defaultPrevented, true);
  assert.equal(window.ScrollGlide.isGliding(), true);
  flush(16, 20); // ~320ms
  assert.ok(window.scrollY > 70 && window.scrollY < 100, `mid glide at ${window.scrollY}`);
  flush(16, 50); // ~1.1s total
  assert.equal(window.scrollY, 100);
  assert.equal(window.ScrollGlide.isGliding(), false);
});

test('glide wheel: trackpad-like deltas stay native', () => {
  const { window, wheel } = glideEnv();
  assert.equal(wheel({ deltaY: 3.5 }).defaultPrevented, false);
  assert.equal(wheel({ deltaY: 120, deltaX: 2 }).defaultPrevented, false);
  assert.equal(window.ScrollGlide.isGliding(), false);
});

test('glide wheel: line-mode wheels glide, pinch-zoom does not', () => {
  const { wheel } = glideEnv();
  assert.equal(wheel({ deltaY: 3, deltaMode: 1 }).defaultPrevented, true);
  const { wheel: wheel2 } = glideEnv();
  assert.equal(wheel2({ deltaY: 100, ctrlKey: true }).defaultPrevented, false);
});

test('glide wheel: stays out while the stepper holds the page', () => {
  const { window, document, wheel } = glideEnv();
  const overlay = document.createElement('div');
  overlay.className = 'text-reveal-container';
  document.body.appendChild(overlay);
  assert.equal(wheel({ deltaY: 100 }).defaultPrevented, false);
  overlay.classList.add('released');
  assert.equal(wheel({ deltaY: 100 }).defaultPrevented, false, 'same gesture keeps its first decision');
  assert.equal(window.ScrollGlide.isGliding(), false);
});

test('glide wheel: off with reduced motion', () => {
  const { window, wheel } = glideEnv({ reduced: true });
  assert.equal(wheel({ deltaY: 100 }).defaultPrevented, false);
  assert.equal(window.ScrollGlide.isGliding(), false);
});

/* ---- Command Deck ----------------------------------------------------- */

function deckEnv() {
  const env = makeWindow({ reduced: true });
  const { window, document } = env;
  document.body.innerHTML = '<button id="opener" data-deck-open>deck</button><main><h2 id="beyond">Beyond the Code</h2></main>';
  run(window, 'js/components/command-deck.js');
  return env;
}

test('command deck: opens from a [data-deck-open] control, locks the page, lists pages and sections', () => {
  const { window, document } = deckEnv();
  const opener = document.getElementById('opener');
  opener.focus();
  opener.click();
  const deck = document.getElementById('commandDeck');
  assert.equal(deck.hidden, false);
  assert.ok(document.documentElement.classList.contains('deck-open'));
  assert.equal(document.activeElement.id, 'deckInput');
  const labels = Array.from(document.querySelectorAll('.deck-row-label')).map((n) => n.textContent);
  assert.ok(labels.includes('Resume'));
  assert.ok(labels.includes('Beyond the Code'));
  assert.ok(document.querySelector('.deck-here'), 'marks the current page');
  window.CommandDeck.close(false);
});

test('command deck: filters, moves with arrows, and Escape restores focus', () => {
  const { window, document } = deckEnv();
  const opener = document.getElementById('opener');
  opener.focus();
  window.CommandDeck.open('email');
  const rows = document.querySelectorAll('.deck-row');
  assert.equal(rows[0].querySelector('.deck-row-label').textContent, 'Copy email');
  const input = document.getElementById('deckInput');
  input.value = 'resume';
  input.dispatchEvent(new window.Event('input'));
  const first = document.querySelector('.deck-row.is-active');
  input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  assert.notEqual(document.querySelector('.deck-row.is-active'), first);
  assert.equal(input.getAttribute('aria-activedescendant'), document.querySelector('.deck-row.is-active').id);
  input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(document.documentElement.classList.contains('deck-open'), false);
  assert.equal(document.activeElement, opener);
});

test('command deck: Cmd K and Ctrl K toggle it', () => {
  const { window, document } = deckEnv();
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
  assert.ok(document.documentElement.classList.contains('deck-open'));
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  assert.equal(document.documentElement.classList.contains('deck-open'), false);
});

/* ---- Talk Chip -------------------------------------------------------- */

test('talk chip: copy button writes the address and shows the hand note', async () => {
  const { window, document } = makeWindow();
  let copied = null;
  Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async (t) => { copied = t; } }, configurable: true });
  document.body.innerHTML = '<div class="talk-chip"><a class="talk-chip-book" href="/book">Book 15 min</a><button class="talk-chip-copy" type="button" data-copy="hello@jayptl.me">Copy email</button></div>';
  run(window, 'js/components/talk-chip.js');
  document.querySelector('.talk-chip-copy').click();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(copied, 'hello@jayptl.me');
  assert.ok(document.querySelector('.talk-chip-note.is-shown'));
  assert.match(document.getElementById('talkChipLive').textContent, /Copied hello@jayptl\.me/);
});

/* ---- Edge Blur and Control Dock --------------------------------------- */

test('edge blur: one static band of five layers, away while the stepper holds the page', () => {
  const { window, document, flush } = makeWindow();
  document.body.innerHTML = '<div class="text-reveal-container"></div><main></main>';
  Object.defineProperty(document.documentElement, 'scrollHeight', { value: 4000, configurable: true });
  run(window, 'js/components/mount.js');
  run(window, 'js/components/edge-blur.js');
  const band = document.querySelector('.edge-blur');
  assert.equal(band.querySelectorAll('.edge-blur-layer').length, 5);
  assert.equal(band.getAttribute('aria-hidden'), 'true');
  flush();
  assert.ok(band.classList.contains('is-away'));
  document.querySelector('.text-reveal-container').classList.add('released');
  window.dispatchEvent(new window.Event('scroll'));
  flush();
  assert.equal(band.classList.contains('is-away'), false);
});

test('control dock: hidden and inert until the page scrolls one screen', () => {
  const { window, document, flush } = makeWindow();
  document.body.innerHTML = '<main></main>';
  Object.defineProperty(document.documentElement, 'scrollHeight', { value: 4000, configurable: true });
  run(window, 'js/components/mount.js');
  run(window, 'js/components/control-dock.js');
  const dock = document.querySelector('.control-dock');
  flush();
  assert.equal(dock.classList.contains('is-shown'), false);
  assert.ok(dock.hasAttribute('inert'));
  window.scrollTo(0, 900);
  flush();
  assert.ok(dock.classList.contains('is-shown'));
  assert.equal(dock.hasAttribute('inert'), false);
  assert.ok(dock.querySelector('[data-deck-open]'), 'dock opens the deck');
});

test('command deck: a mistyped 404 path still finds the page', () => {
  const { window, document } = deckEnv();
  window.CommandDeck.open('aviz healthh');
  assert.equal(document.querySelector('.deck-row .deck-row-label').textContent, 'Aviz Health');
  window.CommandDeck.close(true);
});
