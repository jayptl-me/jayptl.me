// The "Reduce motion" switch (D-49, picked 30 Oct 2026; built 16 Nov). A visitor
// can ask for less motion even when the device does not. Two choke points carry
// it everywhere: the build copies every reduced-motion CSS rule under
// :root[data-motion="reduce"] (and turns motion-only rules off there), and the
// early scripts answer "reduce" to matchMedia while the switch is on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { addMotionSwitch, ON, OFF } = require('../scripts/motion-switch-css.js');

const has = (css, s) => css.replace(/\s+/g, ' ').includes(s.replace(/\s+/g, ' '));

test('motion css: a reduce rule is copied under the switch, same specificity', () => {
  const out = addMotionSwitch('@media (prefers-reduced-motion: reduce) { .a, .b:hover { animation: none; } }');
  assert.ok(has(out, '@media (prefers-reduced-motion: reduce)'), 'original block kept');
  assert.ok(has(out, `${ON} .a, ${ON} .b:hover { animation: none; }`), out);
});

test('motion css: html and :root selectors get the switch on themselves', () => {
  const out = addMotionSwitch('@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } html.open main { transform: none; } :root { --d: 0ms; } }');
  assert.ok(has(out, 'html:where([data-motion="reduce"]) { scroll-behavior: auto; }'), out);
  assert.ok(has(out, 'html:where([data-motion="reduce"]).open main { transform: none; }'), out);
  assert.ok(has(out, ':root:where([data-motion="reduce"]) { --d: 0ms; }'), out);
});

test('motion css: pseudo-elements of the root keep working', () => {
  const out = addMotionSwitch('@media (prefers-reduced-motion: reduce) { ::view-transition-group(*) { animation: none; } }');
  assert.ok(has(out, ':where(:root[data-motion="reduce"])::view-transition-group(*) { animation: none; }'), out);
});

test('motion css: motion-only rules stop when the switch is on', () => {
  const out = addMotionSwitch('@media (prefers-reduced-motion: no-preference) { .a { transition: transform 1s; } }');
  assert.ok(has(out, `@media (prefers-reduced-motion: no-preference) { ${OFF} .a { transition: transform 1s; } }`), out);
});

test('motion css: an OR query with reduce is copied too', () => {
  const out = addMotionSwitch('@media (prefers-reduced-motion: reduce), (prefers-contrast: more) { .s { scroll-behavior: auto; } }');
  assert.ok(has(out, `${ON} .s { scroll-behavior: auto; }`), out);
});

test('motion css: keyframes inside a block are not prefixed', () => {
  const out = addMotionSwitch('@media (prefers-reduced-motion: reduce) { @keyframes k { from { opacity: 0; } to { opacity: 1; } } .a { animation: k 1s; } }');
  assert.ok(!/:where\([^)]*\)\s*(from|to)\b/.test(out), out);
  assert.ok(has(out, `${ON} .a { animation: k 1s; }`), out);
});

test('motion css: other css is untouched', () => {
  const src = '.a { color: red; } @media (max-width: 599.98px) { .b { color: blue; } }';
  assert.ok(addMotionSwitch(src) === src);
});

test('motion css, negative control: a copy without the switch prefix is caught', () => {
  const wrong = '.a { animation: none; }';
  assert.ok(!has(wrong, `${ON} .a`));
});

/* ---- runtime: both early scripts answer to the switch, the same way --------- */


const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const THEME = read('js/theme-detection.js');
const HOME_INLINE = (() => {
  const m = [...read('index.html').matchAll(/<script>([\s\S]*?)<\/script>/g)];
  return m[0][1];
})();

function run(script, { stored = null, deviceReduce = false } = {}) {
  const attrs = {};
  const classes = new Set();
  const local = new Map(stored ? [['jayptl.motion', stored]] : []);
  const store = (m) => ({ getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) });
  const el = {
    setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: (k) => (k in attrs ? attrs[k] : null),
    removeAttribute: (k) => { delete attrs[k]; }, style: {},
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) }
  };
  const doc = { documentElement: el, cookie: '', addEventListener() {}, querySelector: () => null, getElementById: () => null };
  const win = {
    matchMedia: (q) => ({ matches: /reduced-motion:\s*reduce/.test(q) ? deviceReduce : /no-preference/.test(q) ? !deviceReduce : false, media: q }),
    localStorage: store(local), sessionStorage: store(new Map([['jayptl-preloaded', '1']])),
    setTimeout() {}, requestAnimationFrame() {}, performance: { now: () => 0 }, addEventListener() {}, dispatchEvent() {}
  };
  win.window = win; win.document = doc;
  vm.runInNewContext(script, win);
  return {
    attr: attrs['data-motion'] || null,
    reduce: win.matchMedia('(prefers-reduced-motion: reduce)').matches,
    noPref: win.matchMedia('(prefers-reduced-motion: no-preference)').matches,
    dark: win.matchMedia('(prefers-color-scheme: dark)').matches,
    flip: (on) => { if (on) el.setAttribute('data-motion', 'reduce'); else el.removeAttribute('data-motion'); return [win.matchMedia('(prefers-reduced-motion: reduce)').matches, win.matchMedia('(prefers-reduced-motion: no-preference)').matches]; }
  };
}

const CASES = [{}, { stored: 'reduce' }, { deviceReduce: true }, { stored: 'reduce', deviceReduce: true }, { stored: 'bogus' }];

test('motion runtime: a stored "reduce" sets data-motion and matchMedia answers reduce', () => {
  for (const s of [THEME, HOME_INLINE]) {
    const r = run(s, { stored: 'reduce' });
    assert.ok(r.attr === 'reduce' && r.reduce === true && r.noPref === false && r.dark === false, JSON.stringify(r));
  }
});

test('motion runtime: with no choice the device decides, untouched', () => {
  for (const s of [THEME, HOME_INLINE]) {
    const off = run(s, {});
    const dev = run(s, { deviceReduce: true });
    assert.ok(off.attr === null && off.reduce === false && off.noPref === true, JSON.stringify(off));
    assert.ok(dev.reduce === true && dev.noPref === false, JSON.stringify(dev));
  }
});

test('motion runtime: flipping the switch on a live page changes the answer', () => {
  for (const s of [THEME, HOME_INLINE]) {
    const r = run(s, {});
    assert.deepEqual(r.flip(true), [true, false]);
    assert.deepEqual(r.flip(false), [false, true]);
  }
});

test('motion runtime: the home inline script and theme-detection.js agree in every case', () => {
  const diffs = CASES.map((c) => {
    const a = run(THEME, c); const b = run(HOME_INLINE, c);
    const pick = (r) => JSON.stringify([r.attr, r.reduce, r.noPref, r.dark]);
    return pick(a) === pick(b) ? null : `${JSON.stringify(c)}: ${pick(a)} vs ${pick(b)}`;
  }).filter(Boolean);
  assert.ok(diffs.length === 0, diffs.join('; '));
});

test('motion runtime, negative control: a drifted storage key is caught', () => {
  const drifted = HOME_INLINE.replace("'jayptl.motion'", "'motion'");
  assert.ok(drifted !== HOME_INLINE);
  const a = run(THEME, { stored: 'reduce' }); const b = run(drifted, { stored: 'reduce' });
  assert.ok(a.attr !== b.attr);
});

test('motion switch: the More menu and the phone menu carry the switch', () => {
  const nav = read('js/components/navbar.js');
  const n = (nav.match(/role="switch" aria-checked="false" data-motion-switch/g) || []).length;
  assert.ok(n === 2, `found ${n} switches`);
  assert.ok(/localStorage\.setItem\(MOTION_KEY, 'reduce'\)/.test(nav) && /const MOTION_KEY = 'jayptl\.motion'/.test(nav));
});
