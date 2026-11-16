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
  assert.ok(has(out, `${ON} .a, ${ON}.a, ${ON} .b:hover, ${ON}.b:hover { animation: none; }`), out);
});

test('motion css: a class that lives on <html> (.js) still matches, switch off and on', () => {
  const off = addMotionSwitch('@media (prefers-reduced-motion: no-preference) { .js .doodle-draw path { transition: none; } }');
  assert.ok(has(off, `${OFF}.js .doodle-draw path`), off);
  const on = addMotionSwitch('@media (prefers-reduced-motion: reduce) { .js [data-split] .w { transition-delay: 0s; } }');
  assert.ok(has(on, `${ON}.js [data-split] .w`), on);
});

test('motion css: a type selector is never glued to the root', () => {
  const out = addMotionSwitch('@media (prefers-reduced-motion: reduce) { body .a { animation: none; } }');
  assert.ok(has(out, `${ON} body .a {`) && !out.includes(`${ON}body`), out);
});

test('motion css: unsafe query shapes stop the build', () => {
  assert.throws(() => addMotionSwitch('@media (prefers-reduced-motion: reduce) and (min-width: 600px) { .a { x: 1; } }'), /unsupported query/);
  assert.throws(() => addMotionSwitch('@media not (prefers-reduced-motion: reduce) { .a { x: 1; } }'), /unsupported query/);
  assert.throws(() => addMotionSwitch('@media (prefers-reduced-motion) { .a { x: 1; } }'), /unsupported query/);
  assert.throws(() => addMotionSwitch('@media (prefers-reduced-motion: reduce) { @supports (x: y) { .a { x: 1; } } }'), /cannot be copied/);
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
  assert.ok(has(out, `@media (prefers-reduced-motion: no-preference) { ${OFF} .a, ${OFF}.a { transition: transform 1s; } }`), out);
});

test('motion css: an OR query with reduce is copied too', () => {
  const out = addMotionSwitch('@media (prefers-reduced-motion: reduce), (prefers-contrast: more) { .s { scroll-behavior: auto; } }');
  assert.ok(has(out, `${ON} .s, ${ON}.s { scroll-behavior: auto; }`), out);
});

test('motion css: keyframes inside a motion-only block are not prefixed', () => {
  const out = addMotionSwitch('@media (prefers-reduced-motion: no-preference) { .a { animation: k 1s; } @keyframes k { from { opacity: 0; } to { opacity: 1; } } }');
  assert.ok(!/:where\([^)]*\)\s*(from|to)\b/.test(out), out);
  assert.ok(has(out, `${OFF} .a, ${OFF}.a { animation: k 1s; }`), out);
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
  const winListeners = new Map();
  const on = (map, t, f) => { if (!map.has(t)) map.set(t, new Set()); map.get(t).add(f); };
  const win = {
    matchMedia: (q) => {
      const l = new Map();
      return {
        matches: /reduced-motion:\s*reduce/.test(q) ? deviceReduce : /no-preference/.test(q) ? !deviceReduce : false, media: q,
        addEventListener: (t, f) => on(l, t, f), removeEventListener: (t, f) => l.get(t)?.delete(f)
      };
    },
    localStorage: store(local), sessionStorage: store(new Map([['jayptl-preloaded', '1']])),
    setTimeout() {}, requestAnimationFrame() {}, performance: { now: () => 0 },
    addEventListener: (t, f) => on(winListeners, t, f), removeEventListener: (t, f) => winListeners.get(t)?.delete(f),
    dispatchEvent: (e) => { (winListeners.get(e.type) || []).forEach((f) => f(e)); return true; }
  };
  win.window = win; win.document = doc;
  vm.runInNewContext(script, win);
  const set = (v) => { if (v) el.setAttribute('data-motion', 'reduce'); else el.removeAttribute('data-motion'); win.dispatchEvent({ type: 'motion:change' }); };
  return {
    attr: attrs['data-motion'] || null,
    reduce: win.matchMedia('(prefers-reduced-motion: reduce)').matches,
    noPref: win.matchMedia('(prefers-reduced-motion: no-preference)').matches,
    dark: win.matchMedia('(prefers-color-scheme: dark)').matches,
    flip: (v) => { set(v); return [win.matchMedia('(prefers-reduced-motion: reduce)').matches, win.matchMedia('(prefers-reduced-motion: no-preference)').matches]; },
    held: () => {
      const list = win.matchMedia('(prefers-reduced-motion: reduce)');
      const heard = [];
      const fn = (e) => heard.push(e.matches);
      list.addEventListener('change', fn);
      return { list, heard, set, stop: () => list.removeEventListener('change', fn) };
    },
    native: !!(win.matchMedia.native)
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

test('motion runtime: a list held since load updates and hears the switch both ways', () => {
  for (const s of [THEME, HOME_INLINE]) {
    const h = run(s, {}).held();
    assert.ok(h.list.matches === false);
    h.set(true);
    assert.ok(h.list.matches === true, 'held list did not update on');
    h.set(false);
    assert.ok(h.list.matches === false, 'held list did not update off');
    assert.deepEqual(h.heard, [true, false]);
    h.stop();
    h.set(true);
    assert.deepEqual(h.heard, [true, false], 'removed listener still called');
  }
});

test('motion runtime: the native matchMedia stays reachable for the device check', () => {
  for (const s of [THEME, HOME_INLINE]) assert.ok(run(s, {}).native);
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
