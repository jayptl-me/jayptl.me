// Execution proof for the strict-mode retrofit (T-23, D-32). js-hygiene.test.mjs
// reads the scripts as text, so a strict-mode ReferenceError in a file that
// gained 'use strict' would stay green there. These tests run the real files
// inside happy-dom against the built homepage and drive their init paths.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const distPage = path.join(root, 'dist', 'index.html');

// Names a script may reach for without "window."; each must exist in the
// runner's scope or the file throws before it can even initialize.
const GLOBALS = [
  'window', 'document', 'navigator', 'location', 'history', 'performance',
  'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle',
  'IntersectionObserver', 'MutationObserver', 'DOMParser', 'Event',
  'CustomEvent', 'MouseEvent', 'Element', 'HTMLElement', 'Node', 'Image',
  'fetch', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'
];

function setup() {
  const window = new Window({ url: 'https://jayptl.me/', innerWidth: 1280, innerHeight: 800 });
  const document = window.document;

  // The real built page: the scripts initialize against the same ids and
  // links they meet in a browser, not a hand-built stand-in.
  const html = fs.readFileSync(distPage, 'utf8');
  document.documentElement.innerHTML = new window.DOMParser()
    .parseFromString(html, 'text/html').documentElement.innerHTML;

  // Desktop pointer, motion allowed, no touch.
  window.matchMedia = (query) => ({
    matches: query.includes('reduce')
      ? false
      : query.includes('pointer: fine') || query.includes('hover: hover'),
    media: query,
    onchange: null,
    addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {},
    dispatchEvent: () => false
  });

  const frames = [];
  window.requestAnimationFrame = (cb) => { frames.push(cb); return frames.length; };
  window.cancelAnimationFrame = () => {};
  window.setTimeout = setTimeout;
  window.clearTimeout = clearTimeout;
  window.setInterval = setInterval;
  window.clearInterval = clearInterval;
  window.fetch = async () => ({ ok: false, text: async () => '', json: async () => ({}) });
  window.scrollTo = () => {};

  const args = GLOBALS.map((name) => {
    const value = window[name];
    return typeof value === 'function' && !/^[A-Z]/.test(name) ? value.bind(window) : value;
  });

  const run = (rel) => runSource(src(rel));
  const runSource = (text) => new Function(...GLOBALS, text)(...args);
  const flush = () => frames.splice(0).forEach((cb) => cb(Date.now()));
  const ready = () => document.dispatchEvent(new window.Event('DOMContentLoaded'));

  return { window, document, run, runSource, flush, ready };
}

// The four files that gained the directive in the retrofit, none of which the
// rest of the suite executes.
const RETROFITTED = [
  'js/main.js',
  'js/performance.js',
  'js/components/theme-toggle.js',
  'js/components/custom-cursor.js'
];

test('strict retrofit: the four newly strict scripts load and initialize', () => {
  assert.ok(fs.existsSync(distPage), 'run the build before the tests');
  for (const rel of RETROFITTED) {
    const env = setup();
    env.run(rel);
    env.ready();
    env.flush();
    // A strict-mode ReferenceError/TypeError escapes as a throw from either
    // call above, so reaching here is the assertion.
    assert.ok(true, rel);
  }
});

test('strict retrofit: each initialized script exposes what the site relies on', () => {
  const env = setup();
  env.run('js/main.js');
  env.ready();
  assert.equal(typeof env.window.themeManager, 'object', 'main.js owns themeManager');

  const toggle = setup();
  toggle.run('js/components/theme-toggle.js');
  toggle.ready();
  assert.ok(toggle.window.themeToggleComponent, 'theme-toggle.js mounts its component');

  const cursor = setup();
  cursor.run('js/components/custom-cursor.js');
  cursor.ready();
  assert.ok(cursor.window.customCursor, 'a fine pointer gets the custom cursor');
  assert.equal(typeof cursor.window.setCursorState, 'function', 'cursor control is exposed');
});

test('strict retrofit: the cursor hover path reaches instanceof Element checks', () => {
  const env = setup();
  env.run('js/components/custom-cursor.js');
  env.ready();
  const link = env.document.querySelector('a');
  assert.ok(link, 'the built home page has a link to hover');

  env.window.dispatchEvent(new env.window.MouseEvent('mousemove', { clientX: 300, clientY: 200 }));
  assert.ok(env.window.customCursor.cursor, 'first mouse move creates the cursor nodes');

  link.dispatchEvent(new env.window.MouseEvent('mouseover', { bubbles: true }));
  env.flush();
  // setHoverState ran through the Element branch without throwing.
  assert.ok(env.document.body.contains(env.window.customCursor.cursor));
});

test('strict retrofit: a leaked assignment fails loud under the directive', () => {
  // Negative control for this whole file. Sloppy mode turns `leaked = 42`
  // into a silent global; strict mode makes it a ReferenceError. Without
  // this pair the tests above would also pass on an unwrapped script.
  const env = setup();
  const sloppy = '(function () {\n  leakedByTest = 42;\n})();';
  const strict = "(function () {\n  'use strict';\n  leakedByTest = 42;\n})();";

  assert.doesNotThrow(() => env.runSource(sloppy), 'sloppy mode leaks the assignment silently');
  assert.equal(globalThis.leakedByTest, 42, 'and the leak really happened');
  delete globalThis.leakedByTest;

  assert.throws(() => env.runSource(strict), /ReferenceError|strict/,
    'with the directive the same line throws, so these tests run strict code');
});
