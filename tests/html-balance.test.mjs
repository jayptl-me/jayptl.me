// Every page closes what it opens. An unclosed tile on the design-system page
// (2026-11-07) nested every later tile inside it and broke the grid; browsers
// repair the DOM silently, so only the source shows it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = ['index.html', ...fs.readdirSync(path.join(root, 'pages')).filter((f) => f.endsWith('.html')).map((f) => 'pages/' + f),
  ...fs.readdirSync(path.join(root, 'pages/projects')).filter((f) => f.endsWith('.html')).map((f) => 'pages/projects/' + f)];
const TAGS = ['div', 'section', 'article', 'main', 'header', 'footer', 'nav', 'ul', 'ol', 'figure'];

// Strip comments, scripts and styles so their text never counts as tags.
const clean = (html) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');

export function imbalance(html) {
  const s = clean(html);
  const out = [];
  for (const t of TAGS) {
    const open = (s.match(new RegExp(`<${t}[\\s>]`, 'gi')) || []).length;
    const close = (s.match(new RegExp(`</${t}>`, 'gi')) || []).length;
    if (open !== close) out.push(`<${t}> opened ${open}, closed ${close}`);
  }
  return out;
}

test('html: every page closes each block element it opens', () => {
  const problems = [];
  for (const p of pages) imbalance(fs.readFileSync(path.join(root, p), 'utf8')).forEach((x) => problems.push(`${p}: ${x}`));
  assert.deepEqual(problems, []);
});

test('html, negative control: an unclosed div is caught', () => {
  assert.deepEqual(imbalance('<div><div>a</div>'), ['<div> opened 2, closed 1']);
  assert.deepEqual(imbalance('<div>a</div><!-- <div> -->'), []);
});
