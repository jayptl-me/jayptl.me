// Tests for the overlap deck, the second parallel build of the homepage
// "Selected work" section. Covers the keyboard path, the status announcement
// that replaces the dropped counter, the inertia and parallax motion, and a
// planted negative control for every guard, because a guard that cannot fail is
// not a guard.
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
  'IntersectionObserver', 'MutationObserver', 'CustomEvent', 'Event',
  'PointerEvent', 'WheelEvent', 'KeyboardEvent', 'fetch',
  'setTimeout', 'clearTimeout', 'Date'
];

function makeWindow({ width = 1280, height = 800, reduced = false } = {}) {
  const window = new Window({ url: 'https://jayptl.me/', innerWidth: width, innerHeight: height });
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
  const flush = (ms = 16, count = 1) => {
    for (let i = 0; i < count; i++) {
      now += ms;
      const batch = frames.splice(0);
      batch.forEach((cb) => cb(now));
    }
  };
  return { window, document: window.document, flush, tick: (ms) => { now += ms; }, now: () => now };
}

function run(win, rel) {
  const fn = new Function(...GLOBALS, src(rel));
  fn(...GLOBALS.map((name) => {
    const v = name === 'Date' ? win.date : win[name];
    return typeof v === 'function' && !/^[A-Z]/.test(name) ? v.bind(win) : v;
  }));
}

/* ---- Fixture: the real block, trimmed of copy -------------------------- */

const PROJECTS = [
  { title: 'Aviz Health', when: 'Dec 2025 to now' },
  { title: 'Swalook CRM', when: 'Jan 2026 to now' },
  { title: 'Genuinest', when: 'Jan 2026 to now' },
  { title: 'Vini and Tini', when: '2026' }
];

function deckHtml() {
  const pills = PROJECTS.map((p, i) =>
    `<button type="button" class="work-deck-pill${i === 0 ? ' is-active' : ''}" data-workdeck-pill role="tab" aria-selected="${i === 0}">0${i + 1}</button>`).join('');
  const sheets = PROJECTS.map((p, i) => `
    <article class="work-deck-sheet${i === 0 ? ' is-active' : ''}" data-workdeck-sheet data-side="${i === 0 ? 'active' : 'next'}" data-title="${p.title}" data-when="${p.when}">
      <div class="work-deck-shot"><div class="work-deck-shot-move" data-workdeck-shot-move><img src="/assets/x.jpg" width="2080" height="1200" alt=""></div></div>
      <span class="work-deck-shade" data-workdeck-shade aria-hidden="true"></span>
      <span class="work-deck-spine work-deck-spine--prev" aria-hidden="true"></span>
      <span class="work-deck-spine work-deck-spine--next" aria-hidden="true"></span>
      <div class="work-deck-caption"><h3 class="work-deck-title"><a href="/projects/x">${p.title}</a></h3></div>
    </article>`).join('');
  return `<div class="work-deck" id="overlapDeck">
      <div class="work-deck-pills" role="tablist">${pills}</div>
      <div class="work-deck-viewport" data-workdeck-viewport tabindex="0" role="group"><div class="work-deck-track" data-workdeck-track>${sheets}</div></div>
      <p class="work-deck-live" data-workdeck-live role="status" aria-live="polite">Aviz Health, sheet 1 of 4, Dec 2025 to now</p>
    </div>`;
}

function deckEnv(opts = {}) {
  const env = makeWindow(opts);
  const { window, document } = env;
  window.date = { now: () => env.now() };
  document.body.innerHTML = deckHtml(opts);
  const track = document.querySelector('[data-workdeck-track]');
  // happy-dom reports no layout, so the cached step is set the way a 1040px
  // track reports it in a browser.
  Object.defineProperty(track, 'offsetWidth', { value: 1040, configurable: true });
  run(window, 'js/components/overlap-deck.js');
  const api = {
    ...env, window, document, track,
    viewport: document.querySelector('[data-workdeck-viewport]'),
    sheets: Array.from(document.querySelectorAll('[data-workdeck-sheet]')),
    pills: Array.from(document.querySelectorAll('[data-workdeck-pill]')),
    live: document.querySelector('[data-workdeck-live]')
  };
  api.key = (key) => {
    const e = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    api.viewport.dispatchEvent(e);
    return e;
  };
  api.wheel = (init) => {
    const e = new window.WheelEvent('wheel', Object.assign({ bubbles: true, cancelable: true, deltaMode: 0 }, init));
    api.viewport.dispatchEvent(e);
    return e;
  };
  api.pointer = (type, x) => api.viewport.dispatchEvent(new window.PointerEvent(type, {
    bubbles: true, cancelable: true, button: 0, pointerId: 1, pointerType: 'mouse', clientX: x, clientY: 10
  }));
  return api;
}

const tx = (value) => {
  const m = /translate3d\(\s*(-?[0-9.]+)px/.exec(value || '');
  return m ? parseFloat(m[1]) : 0;
};
const activeIndex = (api) => api.sheets.findIndex((s) => s.classList.contains('is-active'));

/* ---- Keyboard path ------------------------------------------------------ */

test('deck: sheet one is active at rest and the pills agree', () => {
  const api = deckEnv();
  assert.equal(activeIndex(api), 0);
  assert.equal(api.pills[0].getAttribute('aria-selected'), 'true');
  assert.equal(api.sheets[1].getAttribute('data-side'), 'next');
});

test('deck: ArrowRight moves the sheet, the pills and the spine sides', () => {
  const api = deckEnv();
  api.key('ArrowRight');
  api.flush(16, 60);
  assert.equal(activeIndex(api), 1, 'sheet two took focus');
  assert.equal(api.pills[1].getAttribute('aria-selected'), 'true');
  assert.equal(api.pills[0].getAttribute('aria-selected'), 'false');
  assert.equal(api.sheets[0].getAttribute('data-side'), 'prev', 'the passed sheet shows its left spine');
  assert.equal(api.sheets[2].getAttribute('data-side'), 'next', 'the coming sheet shows its right spine');
});

test('deck: ArrowLeft, Home and End move the deck, and the keys are consumed', () => {
  const api = deckEnv();
  const home = api.key('Home');
  api.flush(16, 40);
  assert.equal(activeIndex(api), 0);
  assert.equal(home.defaultPrevented, true, 'the deck keeps the key so the page does not jump');
  api.key('ArrowLeft');
  api.flush(16, 40);
  assert.equal(activeIndex(api), 0, 'ArrowLeft cannot go past the first sheet');
  api.key('End');
  api.flush(16, 80);
  assert.equal(activeIndex(api), 3, 'End reaches the last sheet');
});

test('deck: a pill click moves the deck and a click on the active pill is a no-op', () => {
  const api = deckEnv();
  api.pills[2].click();
  api.flush(16, 60);
  assert.equal(activeIndex(api), 2);
  api.pills[2].click();
  api.flush(16, 10);
  assert.equal(activeIndex(api), 2);
});

/* ---- The announcement that replaces the counter ------------------------- */

test('deck: the status element announces the sheet that took focus', () => {
  const api = deckEnv();
  assert.equal(api.live.getAttribute('role'), 'status');
  assert.equal(api.live.getAttribute('aria-live'), 'polite');
  assert.match(api.live.textContent, /Aviz Health, sheet 1 of 4/);
  api.key('ArrowRight');
  api.flush(16, 60);
  assert.match(api.live.textContent, /Swalook CRM, sheet 2 of 4, Jan 2026 to now/);
});

test('deck: the dropped counter is gone from the deck block', () => {
  const html = src('index.html');
  const deck = html.slice(html.indexOf('id="selected-work-deck"'), html.indexOf('<!-- 04 · Sticker break'));
  assert.ok(deck.length > 1000, 'the deck block was found');
  assert.equal(deckViolations(deck).counter, null, 'no readout element in the deck');
});

// The checker the test above runs, exposed to a planted negative control so a
// reader can see it rejects the thing it is supposed to reject.
function deckViolations(html) {
  const counter = /deck-readout|STACK\s*\/\//.exec(html);
  return { counter };
}

test('deck: the counter guard rejects a planted readout', () => {
  assert.ok(deckViolations('<span class="work-deck-readout">STACK // 01 OF 04</span>').counter,
    'a readout has to be caught by name');
  assert.equal(deckViolations('<div class="work-deck-pills"></div>').counter, null);
});

test('deck: it replaced the scroll stack on home (owner, 16 Nov)', () => {
  const html = src('index.html');
  assert.ok(!/scroll-stack/.test(html), 'the scroll stack is still on the home page');
  assert.ok(/<script defer src="\/js\/components\/overlap-deck.js"><\/script>/.test(html), 'the deck script is not loaded');
  assert.ok(/@import 'components\/overlap-deck.css';/.test(src('css/main.css')), 'the deck styles are not imported');
  assert.ok(/id="selected-work"/.test(html), 'links to #selected-work must keep working');
});

test('deck: a mostly vertical trackpad scroll with a little sideways drift stays with the page', () => {
  const api = deckEnv();
  const diagonal = api.wheel({ deltaX: 18, deltaY: 120 });
  api.flush(16, 40);
  assert.equal(diagonal.defaultPrevented, false, 'the deck stole a vertical scroll');
  assert.equal(activeIndex(api), 0);
});

/* ---- Motion: inertia, parallax, depth ---------------------------------- */

test('deck: a sideways wheel moves the deck, a vertical one leaves it to the page', () => {
  const api = deckEnv();
  const vertical = api.wheel({ deltaY: 120 });
  api.flush(16, 40);
  assert.equal(vertical.defaultPrevented, false, 'vertical travel is the page scroll');
  assert.equal(activeIndex(api), 0);
  const sideways = api.wheel({ deltaX: 420 });
  assert.equal(sideways.defaultPrevented, true, 'the deck took the gesture');
  api.flush(16, 60);
  assert.ok(activeIndex(api) >= 2, `three sheets of travel landed on ${activeIndex(api) + 1}`);
});

test('deck: a sideways wheel at the last sheet is handed back to the page', () => {
  const api = deckEnv();
  api.key('End');
  api.flush(16, 80);
  assert.equal(activeIndex(api), 3);
  const e = api.wheel({ deltaX: 300 });
  assert.equal(e.defaultPrevented, false);
});

test('deck: a flick carries further than a slow drag of the same distance', () => {
  const fast = deckEnv();
  fast.pointer('pointerdown', 600);
  fast.tick(1);
  fast.pointer('pointermove', 550);
  fast.tick(1);
  fast.pointer('pointermove', 500);
  fast.pointer('pointerup', 500);
  fast.flush(16, 120);

  const slow = deckEnv();
  slow.pointer('pointerdown', 600);
  slow.tick(60);
  slow.pointer('pointermove', 550);
  slow.tick(60);
  slow.pointer('pointermove', 500);
  slow.pointer('pointerup', 500);
  slow.flush(16, 120);

  assert.ok(activeIndex(fast) > activeIndex(slow),
    `inertia: a flick settled on ${activeIndex(fast) + 1}, the same slow drag on ${activeIndex(slow) + 1}`);
});

test('deck: a drag past the cancel threshold swallows the click it ends on', () => {
  const api = deckEnv();
  let navigations = 0;
  const link = api.sheets[0].querySelector('.work-deck-title a');
  link.addEventListener('click', (e) => { e.preventDefault(); navigations++; });
  api.pointer('pointerdown', 600);
  api.tick(30);
  api.pointer('pointermove', 500);
  api.pointer('pointerup', 500);
  link.dispatchEvent(new api.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.equal(navigations, 0, 'a drag is not a click');

  api.pointer('pointerdown', 600);
  api.pointer('pointerup', 600);
  link.dispatchEvent(new api.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.equal(navigations, 1, 'a press that did not move still clicks');
});

test('deck: the shot inside a sheet travels slower than the sheet', () => {
  const api = deckEnv();
  api.key('End');
  api.flush(16, 120);
  const sheet = api.sheets[0];
  const shot = sheet.querySelector('[data-workdeck-shot-move]');
  const sheetX = tx(sheet.style.transform);
  const shotX = tx(shot.style.transform);
  assert.ok(sheetX < 0, `a passed sheet sits left of focus at ${sheetX}`);
  assert.ok(shotX > 0, `the shot leans back against the sheet at ${shotX}`);
  assert.ok(Math.abs(shotX) < Math.abs(sheetX), 'and strictly slower than it');
  assert.ok(Math.abs(shotX) > 0, 'the parallax is real, not a zero that passes by accident');
});

test('deck: depth, neighbours recede in scale and brightness and drop behind', () => {
  const api = deckEnv();
  api.key('End');
  api.flush(16, 120);
  const active = api.sheets[3];
  const far = api.sheets[0];
  const scale = (v) => {
    const m = /scale\(\s*([0-9.]+)\s*\)/.exec(v || '');
    return m ? parseFloat(m[1]) : 1;
  };
  assert.equal(scale(active.style.transform), 1, 'the focused sheet is at full scale');
  assert.ok(scale(far.style.transform) < 0.92, `the far sheet receded to ${scale(far.style.transform)}`);
  const shadeOf = (s) => parseFloat(s.querySelector('[data-workdeck-shade]').style.opacity);
  assert.equal(shadeOf(active), 0, 'the focused sheet carries no shade');
  assert.ok(shadeOf(far) > 0.5, `the far sheet dimmed to ${shadeOf(far)}`);
  assert.ok(Number(active.style.zIndex) > Number(far.style.zIndex), 'the focused sheet is on top');
});

test('deck: a sheet away from focus takes no pointer events', () => {
  const api = deckEnv();
  api.key('ArrowRight');
  api.flush(16, 60);
  assert.equal(api.sheets[0].style.pointerEvents, 'none');
  assert.equal(api.sheets[1].style.pointerEvents, 'auto');
});

/* ---- Reduced motion ----------------------------------------------------- */

test('deck: reduced motion writes no transform and still moves', () => {
  const api = deckEnv({ reduced: true });
  api.sheets.forEach((s, i) => {
    assert.equal(s.style.transform, '', `sheet ${i} has no transform at rest`);
    assert.equal(s.querySelector('[data-workdeck-shot-move]').style.transform, '');
  });
  api.pills[3].click();
  assert.equal(activeIndex(api), 3, 'the pills still work with no animation');
  assert.match(api.live.textContent, /sheet 4 of 4/);
  assert.equal(api.sheets[3].style.transform, '', 'and it moved by state, not by motion');
});

/* ---- Guards with planted negative controls ------------------------------ */

// The checker for the 3D bug the current stack carries at
// css/components/scroll-stack.css:183 and :212.
function styleViolations(css) {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const found = [];
  if (/transform-style:\s*preserve-3d/.test(body)) found.push('preserve-3d lets a tilted neighbour paint over focus');
  if (/(^|[{;])\s*perspective\s*:/.test(body)) found.push('perspective turns the deck 3D');
  return found;
}

test('guard: the deck stylesheet never goes 3D', () => {
  assert.deepEqual(styleViolations(src('css/components/overlap-deck.css')), []);
});

test('guard: the 3D checker rejects a planted preserve-3d, and names the live one', () => {
  assert.deepEqual(
    styleViolations('.x { transform-style: preserve-3d; }'),
    ['preserve-3d lets a tilted neighbour paint over focus']);
  assert.deepEqual(
    styleViolations('.y { perspective: 1400px; }'),
    ['perspective turns the deck 3D']);
  // The bug being avoided is real and still live in the current component.
  assert.ok(styleViolations(src('css/components/scroll-stack.css')).length > 0,
    'scroll-stack.css still carries the 3D rule this guard refuses to repeat');
});

// The one sheet ratio, checked from the file rather than asserted in prose.
function sheetRatio(css) {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const m = /\.work-deck-track\s*\{[^}]*aspect-ratio:\s*([0-9.]+)\s*\/\s*([0-9.]+)/.exec(body);
  if (!m) return null;
  return { w: Number(m[1]), h: Number(m[2]), ratio: Number(m[1]) / Number(m[2]) };
}

test('guard: the sheet is 1040 x 600, ratio 1.7333', () => {
  const ratio = sheetRatio(src('css/components/overlap-deck.css'));
  assert.ok(ratio, 'the track declares its own aspect-ratio');
  assert.equal(ratio.w, 1040);
  assert.equal(ratio.h, 600);
  assert.ok(Math.abs(ratio.ratio - 1.73333) < 0.0005, `ratio is ${ratio.ratio}`);
});

test('guard: the ratio checker rejects the two shapes already ruled out', () => {
  assert.equal(sheetRatio('.work-deck-track { aspect-ratio: 1040 / 620; }').h, 620,
    'it reads what it is given, so 620 is caught by the assertion above');
  assert.equal(sheetRatio('.work-deck-track { aspect-ratio: 1040 / 551; }').h, 551);
  assert.equal(sheetRatio('.work-deck-track { width: 100%; }'), null, 'and it fails when there is no ratio at all');
});

// css/base/reset.css:227-236 forces height: auto !important on every img.
function shotSizing(css) {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const m = /\.work-deck-shot-move img\s*\{([^}]*)\}/.exec(body);
  if (!m) return null;
  return { fills: /height:\s*100%\s*!important/.test(m[1]), covers: /object-fit:\s*cover/.test(m[1]) };
}

test('guard: the shot answers the reset height rule on purpose', () => {
  const sizing = shotSizing(src('css/components/overlap-deck.css'));
  assert.ok(sizing, 'the deck sizes its own img');
  assert.ok(sizing.fills, 'height: 100% !important is the answer to reset.css height: auto !important');
  assert.ok(sizing.covers, 'and the per-shot crop is object-position under object-fit: cover');
});

test('guard: the shot sizing checker rejects a sheet that never overrides the reset', () => {
  assert.deepEqual(shotSizing('.work-deck-shot-move img { object-fit: cover; }'), { fills: false, covers: true });
  assert.equal(shotSizing('.other img { height: 100% !important; }'), null);
});

test('guard: every sheet carries the title and year the announcement reads', () => {  const html = src('index.html');
  const deck = html.slice(html.indexOf('id="selected-work-deck"'), html.indexOf('<!-- 04 · Sticker break'));
  const sheets = deck.match(/<article class="work-deck-sheet[^"]*"[^>]*>/g) || [];
  assert.equal(sheets.length, 4, 'four sheets, the four live projects');
  sheets.forEach((open, i) => {
    assert.match(open, /data-title="[^"]+"/, `sheet ${i + 1} names its project`);
    assert.match(open, /data-when="[^"]+"/, `sheet ${i + 1} carries its year`);
  });
});

test('guard: the title checker rejects a planted sheet with no name', () => {
  const planted = '<article class="work-deck-sheet" data-workdeck-sheet data-when="2026"></article>';
  assert.throws(() => {
    if (!/data-title="[^"]+"/.test(planted)) throw new Error('the announcement would read Project, sheet 1 of 4');
  }, /the announcement would read/);
});

test('guard: the step the engine moves by is the step the spine is sized to', () => {
  const css = src('css/components/overlap-deck.css');
  const js = src('js/components/overlap-deck.js');
  const cssStep = /--workdeck-step:\s*([0-9.]+)/.exec(css);
  const jsStep = /var STEP = ([0-9.]+)/.exec(js);
  assert.ok(cssStep && jsStep, 'both halves of the coupling are declared');
  assert.equal(Number(cssStep[1]), Number(jsStep[1]), 'the spine width and the sheet offset agree');
});

test('guard: the step drift checker catches a planted mismatch', () => {
  const read = (text) => {
    const m = /--workdeck-step:\s*([0-9.]+)/.exec(text);
    return m ? Number(m[1]) : null;
  };
  assert.equal(read('.t { --workdeck-step: 0.135; }'), 0.135);
  assert.equal(read('.t { --workdeck-step: 0.25; }'), 0.25, 'a drifted value reads back as drifted');
  assert.equal(read('.t { width: 10px; }'), null, 'and an absent one is not silently zero');
});

test('deck: the engine binds the block the page actually ships', () => {  const html = src('index.html');
  const deck = html.slice(html.indexOf('id="selected-work-deck"'), html.indexOf('<!-- 04 · Sticker break'));
  for (const attr of ['data-workdeck-viewport', 'data-workdeck-track', 'data-workdeck-sheet', 'data-workdeck-pill', 'data-workdeck-live', 'data-workdeck-shade', 'data-workdeck-shot-move']) {
    assert.ok(deck.includes(attr), `the markup is missing ${attr}`);
  }
  assert.equal((deck.match(/data-workdeck-pill/g) || []).length, 4);
  assert.equal((deck.match(/data-workdeck-live/g) || []).length, 1, 'exactly one announcement element');
  assert.match(html, /<script defer src="\/js\/components\/overlap-deck\.js"><\/script>/);
  assert.match(src('css/main.css'), /@import 'components\/overlap-deck\.css';/, 'the stylesheet is in the bundle');
});

/* ---- The page and the stylesheet have to name the same classes ---------- */

// The first draft renamed the component from deck-* to work-deck-* inside the
// stylesheet and left the shipped markup on the old names. Every rule hanging
// off a modifier then stopped matching: the spines never showed, the head never
// laid out, and the footer link picked up command-deck.css's .deck-foot, which
// hides it under 600px. The tests above kept passing because this file's
// fixture copied the markup's mistake. This reads the shipped block itself.
function deckBlock() {
  const html = src('index.html');
  return html.slice(html.indexOf('id="selected-work-deck"'), html.indexOf('<!-- 04 · Sticker break'));
}

function unstyledDeckClasses(html, css) {
  const declared = new Set((css.replace(/\/\*[\s\S]*?\*\//g, '').match(/\.work-deck[a-z0-9-]*/g)) || []);
  const used = new Set();
  for (const attr of html.match(/class="[^"]*"/g) || []) {
    for (const cls of attr.slice(7, -1).split(/\s+/)) {
      if (cls.startsWith('work-deck')) used.add('.' + cls);
    }
  }
  return Array.from(used).filter((c) => !declared.has(c)).sort();
}

function borrowedDeckClasses(html) {
  const used = new Set();
  for (const attr of html.match(/class="[^"]*"/g) || []) {
    for (const cls of attr.slice(7, -1).split(/\s+/)) {
      if (cls.startsWith('deck-')) used.add(cls);
    }
  }
  return Array.from(used).sort();
}

test('guard: every work-deck class the page ships is styled by the deck sheet', () => {
  assert.deepEqual(unstyledDeckClasses(deckBlock(), src('css/components/overlap-deck.css')), [],
    'the markup names a class the stylesheet never declares');
});

test('guard: the deck markup borrows no bare deck- class', () => {
  assert.deepEqual(borrowedDeckClasses(deckBlock()), [],
    'command-deck.css owns the bare deck- namespace and hides .deck-foot under 600px');
});

test('guard: both class checkers reject the drift they were written for', () => {
  const css = '.work-deck-spine { a: 1 } .work-deck-spine--next { b: 2 }';
  assert.deepEqual(unstyledDeckClasses('<i class="work-deck-spine work-deck-spine--next"></i>', css), []);
  assert.deepEqual(unstyledDeckClasses('<i class="work-deck-spine work-deck-spine--prev"></i>', css),
    ['.work-deck-spine--prev'], 'an unstyled modifier is named, not waved through');
  assert.deepEqual(borrowedDeckClasses('<i class="work-deck-spine deck-spine--next"></i>'), ['deck-spine--next']);
  assert.deepEqual(borrowedDeckClasses('<i class="work-deck-caption"></i>'), [], 'the real namespace passes');
});

/* ---- A var the project never defines is not a no-op --------------------- */

// An undefined custom property does not fall back to zero: it makes the whole
// declaration invalid at computed-value time. The caption's padding used
// --space-7, which is not a step of this ramp (1, 2, 3, 4, 5, 6, 8, 10, 12...),
// so the padding collapsed and the type ran into the sheet's edge. Nothing in
// the suite could see that until a render was looked at.
function projectVarNames() {
  const defined = new Set();
  for (const file of cssFiles('css')) {
    for (const m of src(file).matchAll(/(--[a-z0-9-]+)\s*:/g)) defined.add(m[1]);
  }
  for (const m of src('index.html').matchAll(/(--[a-z0-9-]+)\s*:/g)) defined.add(m[1]);
  return defined;
}

function missingVars(css, defined) {
  const used = new Set((css.match(/var\(\s*(--[a-z0-9-]+)/g) || []).map((s) => /^var\(\s*(--.+)/.exec(s)[1]));
  return Array.from(used).filter((v) => !defined.has(v)).sort();
}

test('guard: the deck sheet uses no custom property the project never defines', () => {
  const defined = projectVarNames();
  assert.ok(defined.has('--space-6') && defined.has('--space-8'), 'the ramp the deck leans on is defined');
  assert.deepEqual(missingVars(src('css/components/overlap-deck.css'), defined), []);
});

test('guard: the var checker catches the --space-7 it was written for', () => {
  const defined = projectVarNames();
  assert.equal(defined.has('--space-7'), false, '--space-7 is not a step of this ramp');
  assert.deepEqual(
    missingVars('.x { padding: var(--space-6) var(--space-7); }', defined),
    ['--space-7'], 'and a declaration built on it is named, not passed');
});

test('guard: the bleed always covers the parallax excursion', () => {
  const css = src('css/components/overlap-deck.css');
  const js = src('js/components/overlap-deck.js');
  const bleed = /--workdeck-bleed:\s*([0-9.]+)%/.exec(css);
  const step = /var STEP = ([0-9.]+)/.exec(js);
  const parallax = /var PARALLAX = ([0-9.]+)/.exec(js);
  assert.ok(bleed && step && parallax, 'all three halves of the coupling are declared');
  const excursion = Number(step[1]) * Number(parallax[1]);
  assert.ok(Number(bleed[1]) / 100 >= excursion,
    `the shot slides ${excursion} of the track and the bleed is only ${bleed[1]} percent: an edge would show`);
});

test('guard: the bleed checker catches a planted shortfall', () => {
  const read = (text) => {
    const m = /--workdeck-bleed:\s*([0-9.]+)%/.exec(text);
    return m ? Number(m[1]) / 100 : null;
  };
  assert.equal(read('.t { --workdeck-bleed: 3%; }'), 0.03);
  assert.ok(read('.t { --workdeck-bleed: 3%; }') < 0.135 * 0.5,
    'a parallax of 0.5 at the shipped step would out-run a 3 percent bleed, and the guard says so');
  assert.equal(read('.t { width: 10px; }'), null, 'and an absent bleed is not silently zero');
});

test('deck: no id is duplicated between the stack and the deck', () => {
  const ids = (src('index.html').match(/\sid="([^"]+)"/g) || []).map((m) => m.slice(5, -1));
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(dupes, [], 'the deck block must not re-use an id');
});

test('deck: the deck block adds no emoji and no em dash', () => {
  const html = src('index.html');
  const deck = html.slice(html.indexOf('id="selected-work-deck"'), html.indexOf('<!-- 04 · Sticker break'));
  assert.ok(!/—|–/.test(deck), 'no em dash or en dash in the new copy');
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(deck), 'no emoji');
});

/* ---- The namespace guard ------------------------------------------------ */

// This guard exists because the first draft of the deck named its scrim
// .deck-scrim, which css/components/command-deck.css already owns. The scrim
// then resolved to background: none and the type sat on the bare photograph,
// and no test in the repo could see it. The deck's classes now live in their
// own namespace and this check keeps them there.
function cssClasses(css) {
  return new Set((css.replace(/\/\*[\s\S]*?\*\//g, '').match(/\.(?:work-)?deck[a-z0-9-]*/g) || []));
}

function namespaceClash(mine, other) {
  const a = cssClasses(mine);
  const b = cssClasses(other);
  return Array.from(a).filter((c) => b.has(c)).sort();
}

function cssFiles(dir, out = []) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name).split(path.sep).join('/');
    if (entry.isDirectory()) cssFiles(rel, out);
    else if (rel.endsWith('.css')) out.push(rel);
  }
  return out;
}

test('guard: the deck shares no class name with another stylesheet', () => {
  const mine = src('css/components/overlap-deck.css');
  const clashes = [];
  for (const file of cssFiles('css')) {
    if (file === 'css/components/overlap-deck.css') continue;
    for (const cls of namespaceClash(mine, src(file))) clashes.push(`${cls} also in ${file}`);
  }
  assert.deepEqual(clashes, []);
});

test('guard: the namespace checker catches the collision it was written for', () => {
  assert.deepEqual(
    namespaceClash('.deck-scrim { background: red; }', '.deck-scrim { background: var(--sf-scrim); }'),
    ['.deck-scrim']);
  assert.deepEqual(namespaceClash('.work-deck-caption { a: 1; }', '.deck-caption { b: 2; }'), [],
    'the renamed namespace does not clash');
  // The live owner of the name the deck had to give up.
  assert.ok(cssClasses(src('css/components/command-deck.css')).has('.deck-scrim'),
    'command-deck.css still owns .deck-scrim');
});
