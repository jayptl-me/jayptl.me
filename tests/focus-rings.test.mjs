// Keyboard users can see where they are: every control a visitor can tab to
// shows the pill ring (2px solid accent, 3px offset). The sound toggle, the
// theme toggle and the deck search had none (audit 2026-11-07).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// The declarations of every rule whose selector list contains `selector`.
function rulesFor(text, selector) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(text))) {
    if (m[1].split(',').map((s) => s.trim()).includes(selector)) out.push(m[2]);
  }
  return out;
}

export function ringed(text, selector) {
  const decls = rulesFor(text, selector).join(';');
  return /outline\s*:\s*2px solid var\(--sf-accent\)/.test(decls) && /outline-offset\s*:\s*3px/.test(decls);
}

const CASES = [
  ['css/components/audio-toggle.css', '.audio-toggle:focus-visible'],
  ['css/components/theme-toggle.css', '.theme-toggle:focus-visible'],
  ['css/components/command-deck.css', '.deck-search:focus-within'],
];

test('focus: the sound toggle, theme toggle and deck search show the pill ring', () => {
  const missing = CASES.filter(([f, sel]) => !ringed(css(f), sel)).map(([f, sel]) => `${f} ${sel}`);
  assert.deepEqual(missing, []);
});

test('focus: no keyboard focus state removes the outline without a ring', () => {
  const bad = CASES.filter(([f, sel]) => rulesFor(css(f), sel).some((d) => /outline\s*:\s*(none|0)\b/.test(d)));
  assert.deepEqual(bad.map(([f, s]) => `${f} ${s}`), []);
});

test('focus, negative control: an outline:none focus rule is caught', () => {
  assert.equal(ringed('.x:focus-visible { transform: scale(1.08); outline: none; }', '.x:focus-visible'), false);
  assert.equal(ringed('.x:focus-visible { outline: 2px solid var(--sf-accent); outline-offset: 3px; }', '.x:focus-visible'), true);
});
