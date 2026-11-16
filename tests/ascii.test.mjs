// ASCII pieces (D-194): an ASCII rack on the 404 page and a hello card in the
// browser console. Plain ASCII only, so every mono font lines them up (the
// self-hosted Plex Mono is subset, box-drawing glyphs would fall back).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const ascii = (s) => /^[\x20-\x7e]*$/.test(s);

function pages() {
  const list = ['index.html'];
  for (const dir of ['pages', 'pages/projects']) {
    for (const f of fs.readdirSync(path.join(root, dir))) if (f.endsWith('.html')) list.push(`${dir}/${f}`);
  }
  return list;
}

test('404: an ASCII rack, decorative, plain ASCII, every line the same width, phone-safe', () => {
  const html = read('pages/404.html');
  const m = html.match(/<pre class="error-ascii" aria-hidden="true">([\s\S]*?)<\/pre>/);
  assert.ok(m, 'no aria-hidden ASCII block on the 404 page');
  const lines = m[1].split('\n');
  assert.ok(lines.length >= 5, 'too short to read as a rack');
  assert.ok(lines.every(ascii), 'non-ASCII character in the art');
  assert.ok(new Set(lines.map((l) => l.length)).size === 1, `ragged widths: ${lines.map((l) => l.length)}`);
  assert.ok(lines[0].length <= 32, `${lines[0].length} columns will not fit a 375px phone`);
  assert.ok(/<h1 id="nfTitle">/.test(html), 'the real heading must stay for screen readers');
});

test('console hello: one card, plain ASCII, even width, logged once per visit', () => {
  const src = read('js/components/console-hello.js');
  const logs = [];
  const store = new Map();
  const win = {
    console: { log: (...a) => logs.push(a) },
    sessionStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }
  };
  const doc = { documentElement: { getAttribute: () => 'light' } };
  win.window = win;
  vm.runInNewContext(src, { window: win, document: doc });
  vm.runInNewContext(src, { window: win, document: doc });
  assert.equal(logs.length, 1, `logged ${logs.length} times`);
  const card = win.JayptlHello.CARD;
  assert.ok(card.every(ascii), 'non-ASCII in the console card');
  assert.ok(new Set(card.map((l) => l.length)).size === 1, `ragged card: ${card.map((l) => l.length)}`);
});

test('console hello: every page loads it, right after the navbar', () => {
  const missing = pages().filter((p) => !/navbar\.js"><\/script>\s*<script defer src="\/js\/components\/console-hello\.js"><\/script>/.test(read(p)));
  assert.deepEqual(missing, []);
});

test('ascii, negative control: a ragged block is caught', () => {
  const lines = ['+--+', '| x|', '+---+'];
  assert.ok(new Set(lines.map((l) => l.length)).size !== 1);
});
