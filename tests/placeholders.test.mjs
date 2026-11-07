// No unfinished placeholder text reaches a visitor (audit 2026-11-07: the
// home page showed "[ a candid desk photo lands here ]").
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = ['index.html', ...fs.readdirSync(path.join(root, 'pages')).filter((f) => f.endsWith('.html')).map((f) => 'pages/' + f),
  ...fs.readdirSync(path.join(root, 'pages/projects')).filter((f) => f.endsWith('.html')).map((f) => 'pages/projects/' + f)];
const visible = (html) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');

export function placeholders(html) {
  const text = visible(html);
  const hits = [];
  for (const re of [/\[\s*[^\]<]{0,60}lands here\s*\]/gi, /lorem ipsum/gi, /\bTODO\b/g, /\bFIXME\b/g, /coming soon/gi]) {
    (text.match(re) || []).forEach((m) => hits.push(m));
  }
  return hits;
}

test('content: no page shows placeholder text', () => {
  const found = [];
  for (const p of pages) placeholders(fs.readFileSync(path.join(root, p), 'utf8')).forEach((h) => found.push(`${p}: ${h}`));
  assert.deepEqual(found, []);
});

test('content, negative control: a placeholder in markup is caught, one in a comment is not', () => {
  assert.equal(placeholders('<div>[ a candid desk photo lands here ]</div>').length, 1);
  assert.equal(placeholders('<!-- [ a photo lands here ] -->').length, 0);
});

// One project count everywhere: the projects page's "All" rail is the source.
test('content: every page states the same project count as the projects page', () => {
  const idx = fs.readFileSync(path.join(root, 'pages/projects/index.html'), 'utf8');
  const truth = (idx.match(/stretch-rail-label">All<\/span>\s*<span class="stretch-rail-count">(\d+)</) || [])[1];
  assert.ok(truth, 'the projects page has no All count');
  const wrong = [];
  for (const p of pages) {
    const text = visible(fs.readFileSync(path.join(root, p), 'utf8'));
    // Totals only: "31 shipped", "shipped 31 projects", "all 31 projects". Section
    // counts ("9 projects" featured, "22 projects" archived) are parts of it.
    for (const re of [/(\d+)\+?\s*shipped\b/gi, /shipped\s+(\d+)\s+projects\b/gi, /\ball\s+(\d+)\s+projects\b/gi]) {
      for (const m of text.matchAll(re)) if (m[1] !== truth) wrong.push(`${p}: "${m[0]}"`);
    }
    for (const m of text.matchAll(/stretch-rail-label">All<\/span>\s*<span class="stretch-rail-count">(\d+)</g)) if (m[1] !== truth) wrong.push(`${p}: All rail ${m[1]}`);
  }
  assert.deepEqual(wrong, [], `the projects page says ${truth}`);
});
