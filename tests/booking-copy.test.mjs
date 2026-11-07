// The booking page promises only what a visitor can do now: email while live
// booking is off (the default), picking a slot once open times load (audit
// 2026-11-07: every "Book 15 min" led to "Pick a slot", then "opens soon").
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'pages/book.html'), 'utf8');
const body = html.slice(html.indexOf('<main'), html.indexOf('</main>') + 7);

function page() {
  const window = new Window({ url: 'https://jayptl.me/book' });
  window.document.body.innerHTML = body;
  return window;
}
const shown = (doc, sel) => [...doc.querySelectorAll(sel)].filter((n) => !n.hidden && !n.closest('[hidden]'));
const shownText = (doc) => shown(doc, '.page-hero-lead, section').map((n) => n.textContent).join(' ');

test('booking: with live booking off, nothing visible asks the visitor to pick a slot', () => {
  const { document } = page();
  assert.doesNotMatch(shownText(document), /Pick a slot/i);
  assert.match(shownText(document), /hello@jayptl\.me/);
});

test('booking: once open times load, the page switches to the slot promise', async () => {
  const window = page();
  let mount = null;
  window.Mount = { register: (name, def) => { if (name === 'slot-picker') mount = def.mount; } };
  window.SiteApi = { enabled: () => true, get: () => Promise.resolve({ slots: [] }), post: () => Promise.resolve(null) };
  const src = fs.readFileSync(path.join(root, 'js/components/slot-picker.js'), 'utf8');
  new Function('window', 'document', src)(window, window.document);
  assert.ok(mount, 'slot-picker did not register');
  mount(window.document.getElementById('bookPage'));
  await new Promise((r) => setTimeout(r, 20));
  const text = shown(window.document, '.page-hero-lead').map((n) => n.textContent).join(' ');
  assert.match(text, /Pick a slot/);
  assert.equal(shown(window.document, '.book-lead-off').length, 0, 'the email promise still shows beside the slots');
});
