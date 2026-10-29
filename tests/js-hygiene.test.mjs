import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return jsFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

function codeLines(src) {
  const noBlocks = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const noLine = noBlocks.replace(/^\s*\/\/.*$/gm, '');
  return noLine.split('\n').map((l) => l.trim()).filter(Boolean);
}

function violations(src) {
  const lines = codeLines(src);
  const found = [];
  if (!lines.length) return found;
  if (!/^\(function/.test(lines[0])) found.push('does not open with an IIFE');
  if (!/^\}(?:\)\(|\(\))/.test(lines[lines.length - 1])) found.push('does not close its IIFE');
  if (/^["']use strict["'];$/.test(lines[0])) found.push('strict directive is file level');
  const directives = lines.filter((l) => /^["']use strict["'];$/.test(l)).length;
  if (directives > 1) found.push(`strict directive is written ${directives} times`);
  return found;
}

test('js hygiene: every script is one IIFE with strict inside', () => {
  const files = jsFiles(path.join(root, 'js'));
  assert.ok(files.length > 40, 'expected the real script set');
  const bad = files
    .map((file) => ({ rel: path.relative(root, file), why: violations(fs.readFileSync(file, 'utf8')) }))
    .filter((entry) => entry.why.length);
  assert.deepEqual(bad, [], 'unwrapped scripts make concatenation unsafe');
});

test('js hygiene: the checker rejects an unwrapped script', () => {
  assert.deepEqual(violations('class Thing {}\nnew Thing();'), [
    'does not open with an IIFE',
    'does not close its IIFE'
  ]);
  assert.ok(violations('"use strict";\n(function () {\n})();').length > 0);
});

test('js hygiene: the checker rejects a duplicated strict directive', () => {
  // The wrapping script wrote this twice into js/preloader.js. A second
  // directive is harmless at runtime but means the transform ran twice.
  assert.deepEqual(
    violations("(function () {\n    'use strict';\n    'use strict';\n    var a = 1;\n})();"),
    ['strict directive is written 2 times']
  );
});

test('js hygiene: the checker accepts the repo pattern', () => {
  assert.deepEqual(violations('/** header */\n(function () {\n    \'use strict\';\n    var a = 1;\n})();'), []);
});
