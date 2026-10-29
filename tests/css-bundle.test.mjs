import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { bundleCss, findCssEntries } = require('../scripts/css-bundle.js');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'css-bundle-'));
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(dir, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return dir;
}

test('css bundle: inlines nested imports in source order and leaves no import', () => {
  const dir = fixture({
    'a.css': 'A\n@import "b.css";\nA2',
    'b.css': 'B\n@import \'c.css\';\nB2',
    'c.css': 'C'
  });
  const result = bundleCss('a.css', dir);
  assert.equal(result.css.includes('@import'), false);
  assert.ok(result.css.indexOf('A') < result.css.indexOf('B'));
  assert.ok(result.css.indexOf('B') < result.css.indexOf('C'));
  assert.ok(result.css.indexOf('C') < result.css.indexOf('A2'));
  assert.equal(result.included.length, 3);
});

test('css bundle: a missing import fails the build', () => {
  const dir = fixture({ 'a.css': '@import "missing.css";' });
  assert.throws(() => bundleCss('a.css', dir), /cannot read/i);
});

test('css bundle: a cycle fails the build', () => {
  const dir = fixture({
    'a.css': '@import "b.css";',
    'b.css': '@import "a.css";'
  });
  assert.throws(() => bundleCss('a.css', dir), /import cycle/i);
});

test('css bundle: a relative url fails instead of silently changing its base', () => {
  const dir = fixture({ 'a.css': '.x { background: url(images/x.png); }' });
  assert.throws(() => bundleCss('a.css', dir), /relative url/i);
});

test('css bundle: an unsupported import form fails instead of shipping it', () => {
  const dir = fixture({ 'a.css': '@import "b.css" screen;', 'b.css': 'B' });
  assert.throws(() => bundleCss('a.css', dir), /unsupported @import/i);
});

test('css bundle: the real main.css flattens the full tree', () => {
  const result = bundleCss('css/main.css', root);
  assert.equal(/@import\b/.test(result.css), false);
  assert.ok(result.included.length > 50, 'expected the full import tree');
  assert.ok(result.included.some((file) => file.endsWith(path.join('css', 'base', 'variables.css'))));
  assert.ok(result.included.some((file) => file.endsWith(path.join('css', 'pages', 'privacy.css'))));
});

test('css bundle: entries are found from linked stylesheets only', () => {
  const dir = fixture({
    'index.html': '<link rel="stylesheet" href="/css/main.css"><link rel="stylesheet" href="/css/pages/home.css">',
    'pages/about.html': '<link rel="stylesheet" href="/css/main.css"><link rel="stylesheet" href="/css/pages/about.css">',
    'css/main.css': '',
    'css/pages/home.css': '',
    'css/pages/about.css': ''
  });
  assert.deepEqual(findCssEntries(dir), ['/css/main.css', '/css/pages/about.css', '/css/pages/home.css']);
});
