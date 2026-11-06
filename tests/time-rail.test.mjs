// Time Rail (docs/motion-zen.md section 6c, Gate R answers D-48, Gate P D-75).
// A drawn rail beside the Experience rows of /resume that reads scroll and
// never drives it. Every guard here has a negative control in the same file:
// the guard is run against a broken copy and must catch it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const JS = 'js/components/time-rail.js';
const CSS = 'css/components/time-rail.css';
const PAGE = 'pages/resume.html';

/* ---- Harness ---------------------------------------------------------- */

const GLOBALS = [
  'window', 'document', 'navigator', 'location', 'history', 'performance',
  'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle',
  'IntersectionObserver', 'MutationObserver', 'DOMParser', 'CustomEvent',
  'fetch', 'setTimeout', 'clearTimeout'
];

// Row heads sit at these document positions (top, height); the host starts at 1000.
const HOST_TOP = 1000;
const HEADS = [[20, 66], [400, 66], [700, 66], [950, 66], [1150, 66]];
const HOST_HEIGHT = 1500;

function makeWindow({ width = 1280, height = 800, reduced = false } = {}) {
  const window = new Window({ url: 'https://jayptl.me/resume', innerWidth: width, innerHeight: height });
  const media = [];
  window.matchMedia = (query) => {
    const mq = {
      media: query,
      get matches() {
        if (query.includes('reduce')) return reduced;
        const min = query.match(/min-width:\s*([0-9.]+)px/);
        if (min) return width >= Number(min[1]);
        return query.includes('pointer: fine') || query.includes('hover: hover');
      },
      addListener() {}, removeListener() {},
      addEventListener() {}, removeEventListener() {}
    };
    media.push(mq);
    return mq;
  };
  const frames = [];
  window.requestAnimationFrame = (cb) => { frames.push(cb); return frames.length; };
  window.cancelAnimationFrame = () => {};
  window.setTimeout = setTimeout;
  window.clearTimeout = clearTimeout;
  let scrollY = 0;
  Object.defineProperty(window, 'scrollY', { get: () => scrollY, configurable: true });

  // Record every listener the page adds, wherever it lands.
  const listeners = [];
  const proto = window.EventTarget.prototype;
  const add = proto.addEventListener;
  const remove = proto.removeEventListener;
  proto.addEventListener = function (type, fn, opts) {
    listeners.push({ target: this, type, fn, opts });
    return add.call(this, type, fn, opts);
  };
  proto.removeEventListener = function (type, fn, opts) {
    const i = listeners.findIndex((l) => l.target === this && l.type === type && l.fn === fn);
    if (i >= 0) listeners.splice(i, 1);
    return remove.call(this, type, fn, opts);
  };
  if (window.addEventListener !== proto.addEventListener) {
    const wAdd = window.addEventListener.bind(window);
    const wRemove = window.removeEventListener.bind(window);
    window.addEventListener = (type, fn, opts) => { listeners.push({ target: window, type, fn, opts }); return wAdd(type, fn, opts); };
    window.removeEventListener = (type, fn, opts) => {
      const i = listeners.findIndex((l) => l.target === window && l.type === type && l.fn === fn);
      if (i >= 0) listeners.splice(i, 1);
      return wRemove(type, fn, opts);
    };
  }

  // Layout: elements carry a document rect; the viewport rect follows scrollY.
  let rectReads = 0;
  window.Element.prototype.getBoundingClientRect = function () {
    rectReads++;
    const r = this.__rect || [0, 0];
    const top = r[0] - scrollY;
    return { top, bottom: top + r[1], height: r[1], left: 0, right: 100, width: 100, x: 0, y: top };
  };

  const flush = (count = 1) => {
    for (let i = 0; i < count; i++) frames.splice(0).forEach((cb) => cb(0));
  };
  const scrollTo = (y) => {
    scrollY = y;
    window.dispatchEvent(new window.Event('scroll'));
  };
  return {
    window, document: window.document, flush, scrollTo, listeners, frames,
    rectReads: () => rectReads
  };
}

function run(win, code) {
  const fn = new Function(...GLOBALS, code);
  fn(...GLOBALS.map((name) => {
    const v = win[name];
    return typeof v === 'function' && !/^[A-Z]/.test(name) ? v.bind(win) : v;
  }));
}

// The real Experience section from the page, with layout stubbed in.
function experienceMarkup(html = src(PAGE)) {
  const m = html.match(/<section aria-labelledby="resumeExp">[\s\S]*?<\/section>/);
  assert.ok(m, 'resume.html has the Experience section');
  return m[0];
}

function mountRail(opts = {}, code = src(JS)) {
  const env = makeWindow(opts);
  const { window, document } = env;
  document.body.innerHTML = `<main>${experienceMarkup()}</main>`;
  const host = document.querySelector('[data-component~="time-rail"]');
  assert.ok(host, 'the Experience section carries a time-rail host');
  host.__rect = [HOST_TOP, HOST_HEIGHT];
  document.querySelectorAll('details.role > summary').forEach((s, i) => {
    s.__rect = [HOST_TOP + HEADS[i][0], HEADS[i][1]];
  });
  run(window, src('js/components/mount.js'));
  run(window, code);
  env.flush();
  const rail = host.querySelector('.time-rail');
  return {
    ...env,
    host,
    rail,
    marker: rail.querySelector('.time-rail-marker'),
    fill: rail.querySelector('.time-rail-fill'),
    stops: Array.from(rail.querySelectorAll('.time-rail-stop'))
  };
}

const ty = (el) => {
  const m = (el.style.transform || '').match(/translateY\(([-0-9.]+)px\)/);
  return m ? Number(m[1]) : null;
};
const centre = (i) => HEADS[i][0] + HEADS[i][1] / 2;

/* ---- Guards (each one has a negative control below) -------------------- */

// 1. The rail never listens to the wheel and never cancels any input.
function wheelHits(code) {
  const body = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const hits = [];
  for (const word of ['wheel', 'mousewheel', 'DOMMouseScroll', 'touchmove', 'preventDefault', 'stopPropagation']) {
    if (new RegExp(`\\b${word}\\b`).test(body)) hits.push(word);
  }
  return hits;
}

function runtimeWheel(listeners) {
  return listeners.filter((l) => /wheel|DOMMouseScroll|touchmove/i.test(l.type)).map((l) => l.type);
}

// 2. Every year the rail shows is the start year of the row beside it.
function yearDrift(html) {
  const section = experienceMarkup(html);
  const rows = [...section.matchAll(/<span class="role-when">([^<]*)<\/span>/g)].map((m) => m[1]);
  const years = [...section.matchAll(/<span class="time-rail-year">([^<]*)<\/span>/g)].map((m) => m[1].trim());
  const problems = [];
  if (rows.length !== years.length) problems.push(`${years.length} stops for ${rows.length} rows`);
  years.forEach((year, i) => {
    const start = (rows[i] || '').match(/\b(\d{4})\b/);
    if (!start || start[1] !== year) problems.push(`stop ${i + 1} reads ${year}, its row starts ${rows[i]}`);
    if (!new RegExp(`\\b${year}\\b`).test(rows[i] || '')) problems.push(`year ${year} is not in row ${i + 1}`);
  });
  return problems;
}

// 3. Width media queries use only the four screen tiers.
const TIER_EDGES = new Set(['min:600', 'max:599.98', 'min:1024', 'max:1023.98', 'min:1440', 'max:1439.98']);
function offTier(css) {
  let n = 0;
  for (const m of css.matchAll(/@media[^{]*\{/g)) {
    for (const [, kind, value, unit] of m[0].matchAll(/(min|max)-width:\s*([0-9.]+)(px|em|rem)/g)) {
      if (unit !== 'px' || !TIER_EDGES.has(`${kind}:${value}`)) n++;
    }
  }
  return n;
}

// 4. Colours come from theme tokens only, never raw values from either ramp.
function rawColours(css) {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...body.matchAll(/#[0-9a-f]{3,8}\b|\brgba?\(\s*\d/gi)].map((m) => m[0]);
}

// 5. Deliverable copy: no em dashes, no emoji.
const EM_DASH = String.fromCharCode(0x2014);
function copyHits(text) {
  const hits = [];
  if (text.includes(EM_DASH)) hits.push('em dash');
  if (/\p{Extended_Pictographic}/u.test(text)) hits.push('emoji');
  return hits;
}

// 6. The scroll path only moves things by transform.
function scrollPathWrites(el, before) {
  const changed = [];
  for (const prop of ['top', 'height', 'width', 'left', 'filter']) {
    if ((el.style[prop] || '') !== (before[prop] || '')) changed.push(prop);
  }
  return changed;
}

/* ---- Markup ----------------------------------------------------------- */

test('time rail: one aria-hidden rail beside the five Experience rows, one stop per row', () => {
  const section = experienceMarkup();
  const rows = section.match(/<details class="role"/g) || [];
  assert.equal(rows.length, 5, 'the five Experience rows are untouched');
  const rail = section.match(/<div class="time-rail"[^>]*>/);
  assert.ok(rail, 'the rail element is in the section');
  assert.match(rail[0], /aria-hidden="true"/, 'decoration is hidden from assistive tech');
  assert.equal((section.match(/class="time-rail-stop"/g) || []).length, 5);
  assert.equal((section.match(/class="time-rail-marker"/g) || []).length, 1, 'one marker');
  // Decoration, not a control: nothing in the rail can take focus or be clicked.
  const railBlock = section.match(/<div class="time-rail"[\s\S]*?<\/div>/)[0];
  assert.doesNotMatch(railBlock, /<a\b|<button\b|tabindex|role="button"|href=/);
  assert.doesNotMatch(railBlock, /\son[a-z]+=/, 'no inline handlers (CSP)');
  assert.doesNotMatch(railBlock, /\bnow\b/i, 'no now pill');
});

test('time rail: every rail year is the start year already printed in its own row', () => {
  assert.deepEqual(yearDrift(src(PAGE)), []);
});

test('time rail: negative control, a rail year that is not in its row is caught', () => {
  const broken = src(PAGE).replace(/<span class="time-rail-year">2025<\/span>/, '<span class="time-rail-year">2019</span>');
  assert.notEqual(broken, src(PAGE), 'the mutation applied');
  assert.ok(yearDrift(broken).some((p) => /2019/.test(p)));
  const missing = src(PAGE).replace(/<span class="time-rail-stop">[\s\S]*?<\/span><\/span>/, '');
  assert.ok(yearDrift(missing).some((p) => /4 stops for 5 rows/.test(p)));
});

test('time rail: the script loads after mount.js on /resume, with no inline script', () => {
  const html = src(PAGE);
  const mount = html.indexOf('<script defer src="/js/components/mount.js"></script>');
  const rail = html.indexOf('<script defer src="/js/components/time-rail.js"></script>');
  assert.ok(mount > 0 && rail > mount, 'time-rail.js follows mount.js');
  assert.equal(html.split('/js/components/time-rail.js').length - 1, 1, 'loaded once');
  assert.ok(fs.existsSync(path.join(root, JS)));
});

/* ---- Wheel and input hand-off ---------------------------------------- */

test('time rail: the source adds no wheel listener and cancels nothing', () => {
  assert.deepEqual(wheelHits(src(JS)), []);
});

test('time rail: negative control, a wheel listener or a cancel in the source is caught', () => {
  assert.deepEqual(wheelHits(`${src(JS)}\nwindow.addEventListener('wheel', function (e) { e.preventDefault(); }, { passive: false });`),
    ['wheel', 'preventDefault']);
  assert.deepEqual(wheelHits(src(JS).replace("'use strict';", "'use strict'; document.addEventListener('touchmove', f);")), ['touchmove']);
});

test('time rail: at runtime it adds one passive scroll listener and nothing on the wheel', () => {
  const { listeners } = mountRail();
  assert.deepEqual(runtimeWheel(listeners), []);
  const scroll = listeners.filter((l) => l.type === 'scroll');
  assert.equal(scroll.length, 1, 'one scroll listener');
  assert.equal(scroll[0].opts && scroll[0].opts.passive, true, 'it is passive');
});

test('time rail: negative control, a wheel listener added at runtime is caught', () => {
  const code = src(JS).replace("'use strict';", "'use strict'; window.addEventListener('wheel', function () {}, { passive: true });");
  assert.notEqual(code, src(JS));
  const { listeners } = mountRail({}, code);
  assert.deepEqual(runtimeWheel(listeners), ['wheel']);
});

/* ---- Motion: reads scroll, follows, reverses ------------------------- */

test('time rail: stops sit at their own row heads, in reading order', () => {
  const { stops, flush } = mountRail();
  flush();
  stops.forEach((s, i) => assert.equal(ty(s), centre(i), `stop ${i + 1}`));
});

test('time rail: the marker follows the reading line between the first and last stop, and reverses', () => {
  const { marker, fill, stops, scrollTo, flush, window } = mountRail({ height: 800 });
  const line = (y) => y + 800 * 0.4 - HOST_TOP; // reading line inside the host

  scrollTo(0);
  flush();
  assert.equal(ty(marker), centre(0), 'clamped to the first stop above the section');
  assert.match(fill.style.transform, /scaleY\(0\)/);

  const mid = HOST_TOP + 560 - 800 * 0.4; // reading line at 560, between stop 2 and 3
  scrollTo(mid);
  flush();
  assert.equal(line(mid), 560);
  assert.equal(ty(marker), 560);
  assert.ok(stops[1].classList.contains('is-active'), 'the passed stop is active');
  assert.ok(stops[0].classList.contains('is-reached') && stops[1].classList.contains('is-reached'));
  assert.ok(!stops[2].classList.contains('is-reached'));
  const s = Number(fill.style.transform.match(/scaleY\(([0-9.]+)\)/)[1]);
  assert.ok(Math.abs(s - (560 - centre(0)) / (centre(4) - centre(0))) < 1e-6, 'fill grows from its fixed origin');

  scrollTo(99999);
  flush();
  assert.equal(ty(marker), centre(4), 'clamped to the last stop');
  assert.ok(stops[4].classList.contains('is-active'));

  scrollTo(mid);
  flush();
  assert.equal(ty(marker), 560, 'scrolling back reverses');
  assert.ok(!stops[4].classList.contains('is-active') && !stops[4].classList.contains('is-reached'));
  assert.equal(window.document.querySelectorAll('.time-rail-stop.is-active').length, 1, 'one active stop at a time');
});

test('time rail: a burst of scroll events costs one frame, and the frame reads no layout', () => {
  const { scrollTo, frames, flush, rectReads } = mountRail();
  flush();
  const before = rectReads();
  for (let i = 1; i <= 6; i++) scrollTo(i * 40);
  assert.equal(frames.length, 1, 'one rAF per burst');
  flush();
  assert.equal(rectReads() - before, 0, 'no layout read on the scroll path');
});

test('time rail: negative control, a layout read on the scroll path is caught', () => {
  // Make every scroll frame re-measure, the mistake this guard exists for.
  const code = src(JS).replace(/function update\(\) \{/, 'function update() { measureNow();');
  assert.notEqual(code, src(JS), 'the mutation applied');
  const { scrollTo, flush, rectReads } = mountRail({}, code);
  flush();
  const before = rectReads();
  scrollTo(300);
  flush();
  assert.ok(rectReads() - before > 0);
});

test('time rail: the scroll path moves the marker and fill by transform only', () => {
  const { marker, fill, rail, scrollTo, flush } = mountRail();
  flush();
  const spine = rail.querySelector('.time-rail-spine');
  const snap = (el) => ({ top: el.style.top, height: el.style.height, width: el.style.width, left: el.style.left, filter: el.style.filter });
  const was = [marker, fill, spine].map(snap);
  scrollTo(700);
  flush();
  [marker, fill, spine].forEach((el, i) => assert.deepEqual(scrollPathWrites(el, was[i]), [], el.className));
  assert.match(marker.style.transform, /translateY/);
});

test('time rail: negative control, a height write on the scroll path is caught', () => {
  const { fill } = mountRail();
  const was = { top: fill.style.top, height: fill.style.height };
  fill.style.height = '120px';
  assert.deepEqual(scrollPathWrites(fill, was), ['height']);
});

test('time rail: it holds still while the home stepper holds the page', () => {
  const env = mountRail();
  env.flush();
  const overlay = env.document.createElement('div');
  overlay.className = 'text-reveal-container';
  env.document.body.appendChild(overlay);
  const was = env.marker.style.transform;
  env.scrollTo(900);
  env.flush();
  assert.equal(env.marker.style.transform, was);
  overlay.classList.add('released');
  env.scrollTo(901);
  env.flush();
  assert.notEqual(env.marker.style.transform, was);
});

/* ---- Toggle and resize recompute, never scroll ----------------------- */

test('time rail: opening or closing a row moves the stops, on the toggle event', () => {
  const { document, stops, flush } = mountRail();
  flush();
  const heads = document.querySelectorAll('details.role > summary');
  // Row 1 closes: every later head moves up by 300px.
  for (let i = 1; i < heads.length; i++) heads[i].__rect = [HOST_TOP + HEADS[i][0] - 300, HEADS[i][1]];
  const row = document.querySelector('details.role');
  row.open = false;
  row.dispatchEvent(new document.defaultView.Event('toggle'));
  flush();
  assert.equal(ty(stops[0]), centre(0));
  assert.equal(ty(stops[1]), centre(1) - 300);
  assert.equal(ty(stops[4]), centre(4) - 300);
});

/* ---- Tiers and reduced motion ---------------------------------------- */

test('time rail: below the laptop tier it binds no scroll listener and moves nothing', () => {
  for (const width of [390, 768, 1023]) {
    const { listeners, marker, scrollTo, flush } = mountRail({ width });
    assert.equal(listeners.filter((l) => l.type === 'scroll').length, 0, `${width}px`);
    scrollTo(800);
    flush();
    assert.equal(marker.style.transform, '', `${width}px leaves the marker alone`);
  }
});

test('time rail: reduced motion is the static, fully drawn end state', () => {
  const { listeners, marker, fill, stops, scrollTo, flush } = mountRail({ reduced: true });
  assert.equal(listeners.filter((l) => l.type === 'scroll').length, 0, 'no follow');
  flush();
  assert.equal(ty(marker), centre(4), 'marker holds at the end');
  assert.match(fill.style.transform, /scaleY\(1\)/, 'line drawn full length');
  stops.forEach((s, i) => {
    assert.ok(s.classList.contains('is-reached'), `stop ${i + 1} reads at once`);
    assert.equal(ty(s), centre(i));
  });
  const was = marker.style.transform;
  scrollTo(400);
  flush();
  assert.equal(marker.style.transform, was, 'scroll moves nothing');
});

/* ---- Mount contract -------------------------------------------------- */

test('time rail: mounts once, and a router swap unbinds it', () => {
  const env = mountRail();
  env.window.dispatchEvent(new env.window.CustomEvent('page:ready'));
  env.window.dispatchEvent(new env.window.CustomEvent('page:ready'));
  assert.equal(env.listeners.filter((l) => l.type === 'scroll').length, 1, 'never binds twice');
  env.document.body.innerHTML = '<main></main>';
  env.window.dispatchEvent(new env.window.CustomEvent('page:ready'));
  assert.equal(env.listeners.filter((l) => l.type === 'scroll').length, 0, 'unbound after the swap');
  assert.equal(env.listeners.filter((l) => l.type === 'resize').length, 0);
});

/* ---- Stylesheet ------------------------------------------------------ */

test('time rail: the stylesheet uses only the four tiers and never joins the legacy ratchet', () => {
  const css = src(CSS);
  assert.equal(offTier(css), 0);
  assert.ok(!src('tests/ui-system.test.mjs').includes(CSS), 'not on the LEGACY list');
  assert.match(css, /@media \(min-width: 1024px\)/, 'laptop and wide only');
});

test('time rail: negative control, an off-tier width is caught', () => {
  assert.equal(offTier(`${src(CSS)}\n@media (min-width: 900px) { .time-rail { display: block; } }`), 1);
  assert.equal(offTier('@media (max-width: 64em) {}'), 1);
});

test('time rail: imported once in main.css, right after squish', () => {
  const main = src('css/main.css');
  assert.equal(main.split("@import 'components/time-rail.css';").length - 1, 1);
  assert.match(main, /@import 'components\/squish\.css';\n@import 'components\/time-rail\.css';/);
});

test('time rail: colours come from theme tokens only', () => {
  assert.deepEqual(rawColours(src(CSS)), []);
  assert.match(src(CSS), /var\(--sf-accent\)/);
});

test('time rail: negative control, a raw ramp colour is caught', () => {
  assert.deepEqual(rawColours(`${src(CSS)}\n.time-rail-dot { background: #00b8cc; color: rgba(33, 150, 243, 0.4); }`), ['#00b8cc', 'rgba(3']);
});

test('time rail: hidden in print, static under reduced motion, transitions on the snap curve', () => {
  const css = src(CSS).replace(/\/\*[\s\S]*?\*\//g, '');
  const print = css.match(/@media print \{[\s\S]*?\n\}/);
  assert.ok(print && /\.time-rail\s*\{[^}]*display:\s*none/.test(print[0]), 'print hides the rail');
  const reduced = css.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/);
  assert.ok(reduced && /transition:\s*none/.test(reduced[0]), 'reduced motion drops transitions');
  for (const [, ms, curve] of css.matchAll(/(\d+)ms\s+([a-z-]+\([^)]*\)|var\(--[a-z-]+\)|[a-z-]+)/g)) {
    assert.equal(curve, 'var(--ease-snap)', `${ms}ms rides the snap curve`);
    assert.ok(['140', '180'].includes(ms), `${ms}ms is a motion-law step`);
  }
  assert.doesNotMatch(css, /transition[^;]*\b(height|width|top|filter|blur)\b/, 'never transitions layout or filter');
});

test('time rail: no em dash and no emoji in the new files', () => {
  for (const rel of [JS, CSS, 'tests/time-rail.test.mjs']) assert.deepEqual(copyHits(src(rel)), [], rel);
  assert.deepEqual(copyHits(experienceMarkup()), []);
});

test('time rail: negative control, an em dash or emoji is caught', () => {
  assert.deepEqual(copyHits(`a ${EM_DASH} b`), ['em dash']);
  assert.deepEqual(copyHits('ship it \u{1F680}'), ['emoji']);
});
