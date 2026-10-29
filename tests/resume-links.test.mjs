import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function pdfTargets(html) {
  return Array.from(html.matchAll(/href="(\/[^"]+\.pdf)"/g)).map((m) => m[1]);
}

function mdTargets(md) {
  return Array.from(md.matchAll(/\]\((https:\/\/jayptl\.me)(\/[^)]+\.pdf)\)/g)).map((m) => m[2]);
}

function unresolved(targets, exists) {
  return targets.filter((href) => !exists(href));
}

test('resume links: every download on the resume page resolves to a real file', () => {
  const html = fs.readFileSync(path.join(root, 'pages/resume.html'), 'utf8');
  const targets = pdfTargets(html);
  assert.equal(targets.length, 7, 'one link per resume track');
  const missing = unresolved(targets, (href) => fs.existsSync(path.join(root, href.replace(/^\//, ''))));
  assert.deepEqual(missing, [], 'resume hrefs must point at files that exist');
});

test('resume links: the markdown twin resolves too', () => {
  const md = fs.readFileSync(path.join(root, 'markdown/pages/resume.md'), 'utf8');
  const targets = mdTargets(md);
  assert.equal(targets.length, 7);
  const missing = unresolved(targets, (href) => fs.existsSync(path.join(root, href.replace(/^\//, ''))));
  assert.deepEqual(missing, [], 'markdown resume links must resolve');
});

test('resume links: the command deck uses the same path', () => {
  const src = fs.readFileSync(path.join(root, 'js/components/command-deck.js'), 'utf8');
  assert.ok(src.includes("'/assets/resumes/' + track"), 'deck must build the real asset path');
  assert.equal(src.includes("'/resumes/' + track"), false, 'the short path only works if Render rewrites it');
});

test('resume links: no resume file is orphaned', () => {
  const html = fs.readFileSync(path.join(root, 'pages/resume.html'), 'utf8');
  const linked = new Set(pdfTargets(html).map((href) => path.basename(href)));
  const onDisk = fs.readdirSync(path.join(root, 'assets/resumes')).filter((n) => n.endsWith('.pdf'));
  assert.deepEqual(onDisk.filter((n) => !linked.has(n)), []);
  assert.ok(onDisk.length >= 7);
});

test('resume links: the checker does reject the broken form', () => {
  const broken = '<a href="/resumes/fde.pdf">x</a>';
  const targets = pdfTargets(broken);
  assert.deepEqual(unresolved(targets, (href) => fs.existsSync(path.join(root, href.replace(/^\//, '')))),
    ['/resumes/fde.pdf']);
});
