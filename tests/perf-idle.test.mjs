// Lag fixes from the 16 Nov benchmark (pm/perf-lag-benchmark-2026-11-16.md):
// the site lagged because it never stopped drawing. Each test pins one fix
// that changes nothing a visitor sees, or one trim the owner picked.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const block = (css, selector) => {
  const at = css.indexOf(selector + ' {');
  return at < 0 ? '' : css.slice(at, css.indexOf('}', at) + 1);
};
const keyframes = (css, name) => {
  const at = css.indexOf(`@keyframes ${name}`);
  if (at < 0) return '';
  let depth = 0;
  for (let i = css.indexOf('{', at); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(at, i + 1);
  }
  return '';
};

test('status dot: the pulse animates transform and opacity only, never box-shadow', () => {
  const css = read('css/components/navbar.css');
  const frames = keyframes(css, 'navStatusPulse');
  assert.ok(frames, 'navStatusPulse keyframes missing');
  assert.ok(!/box-shadow/.test(frames), 'the pulse still animates box-shadow (repaints the nav every frame)');
  assert.ok(/transform/.test(frames) && /opacity/.test(frames), frames);
  assert.ok(!/animation/.test(block(css, '.nav-status-dot')), 'the dot itself still animates');
  assert.ok(/animation:\s*navStatusPulse/.test(block(css, '.nav-status-dot::after')), 'the pulse disc is not animated');
});

test('status dot: reduced motion stops the pulse disc too', () => {
  const css = read('css/components/navbar.css');
  assert.ok(/\.nav-status-dot,\s*\.nav-status-dot::after\s*\{\s*animation:\s*none !important/.test(css));
});

function grid() {
  const win = { document: {} };
  vm.runInNewContext(read('js/components/pixel-swap.js'), { window: win, document: {}, Math, Object, Array });
  return win.PixelSwap.buildGrid;
}

test('page change: at most 300 tiles, each a whole multiple of the 50px grid', () => {
  const build = grid();
  for (const [w, h] of [[390, 844], [1440, 900], [1440, 4000], [2560, 1440], [3840, 2160], [1280, 9000]]) {
    const g = build(w, h, 50, 'center', 0);
    assert.ok(g.cols * g.rows <= 300, `${w}x${h}: ${g.cols * g.rows} tiles`);
    assert.ok(g.size % 50 === 0, `${w}x${h}: size ${g.size}`);
  }
});

test('page change, negative control: the old 750 cap would have failed', () => {
  const g = { cols: Math.ceil(1440 / 50), rows: Math.ceil(900 / 50) };
  assert.ok(g.cols * g.rows > 300, 'the check above would not have caught the old grid');
});

test('frosted glass: none where the surface is opaque, none on cards', () => {
  const stack = read('css/components/scroll-stack.css');
  assert.ok(!/backdrop-filter/.test(stack), 'scroll-stack cards (88-96% opaque) and the solid sticky header still blur');
  assert.ok(!/backdrop-filter/.test(block(read('css/components/cards.css'), 'html[data-theme="dark"] .card-default')));
});

test('edge blur: three layers everywhere, not only on touch screens', () => {
  const css = read('css/components/edge-blur.css');
  const outside = css.replace(/@media[^{]*\{[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, '');
  assert.ok(/\.edge-blur-layer:nth-child\(1\),\s*\.edge-blur-layer:nth-child\(2\)\s*\{\s*display:\s*none/.test(outside));
});

test('edge blur: a scroll frame never measures the footer once it is observed', () => {
  const window = new Window({ url: 'https://jayptl.me/about', innerWidth: 1280, innerHeight: 800 });
  const document = window.document;
  document.body.innerHTML = '<main></main><footer class="site-footer"></footer>';
  let measured = 0;
  const footer = document.querySelector('footer');
  footer.getBoundingClientRect = () => { measured++; return { top: 5000 }; };
  let observed = null;
  let report = null;
  window.IntersectionObserver = class { constructor(cb) { report = cb; } observe(el) { observed = el; } disconnect() {} };
  const frames = [];
  window.requestAnimationFrame = (cb) => { frames.push(cb); return frames.length; };
  const ctx = { window, document, requestAnimationFrame: window.requestAnimationFrame, IntersectionObserver: window.IntersectionObserver, MutationObserver: window.MutationObserver };
  window.Mount = { register: (_n, def) => def.mount() };
  ctx.Mount = window.Mount;
  vm.runInNewContext(`(function(window, document, requestAnimationFrame){${read('js/components/edge-blur.js')}})(window, document, requestAnimationFrame)`, ctx);
  assert.ok(observed === footer, 'the footer is not observed');
  for (let i = 0; i < 5; i++) { window.dispatchEvent(new window.Event('scroll')); frames.splice(0).forEach((f) => f(0)); }
  assert.ok(measured === 0, `measured the footer ${measured} times while scrolling`);
  report([{ isIntersecting: true }]);
  frames.splice(0).forEach((f) => f(0));
  assert.ok(document.querySelector('.edge-blur').classList.contains('is-away'), 'band did not step away when the footer came on screen');
});

test('hero grid: the endless pan slides a layer with transform, never background-position', () => {
  const css = read('css/components/scroll-reveal.css');
  const frames = keyframes(css, 'gridPan');
  assert.ok(frames, 'gridPan keyframes missing');
  assert.ok(!/background-position/.test(frames), 'the pan repaints the whole screen every frame');
  assert.ok(/transform:\s*translate3d\(50px,\s*50px,\s*0\)/.test(frames), frames);
  assert.ok(/inset:\s*-50px 0 0 -50px/.test(block(css, '.text-reveal-container::before')), 'the layer is not one cell larger, the pan would show an edge');
});
