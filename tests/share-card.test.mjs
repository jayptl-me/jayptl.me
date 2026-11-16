// Link previews (WhatsApp, LinkedIn, X, Slack) showed the square logo. Every
// page now shares the Porcelain card (D-53): 1200 x 630, large-image layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARD = 'https://jayptl.me/assets/share-card.png';

function pages() {
  const list = ['index.html'];
  for (const dir of ['pages', 'pages/projects']) {
    for (const f of fs.readdirSync(path.join(root, dir))) if (f.endsWith('.html')) list.push(`${dir}/${f}`);
  }
  return list;
}

function meta(html, attr, name) {
  const re = new RegExp(`<meta\\s+${attr}="${name}"\\s+content="([^"]*)"`, 'g');
  return [...html.matchAll(re)].map((m) => m[1]);
}

test('share card: every page previews with the card, not the logo', () => {
  const bad = [];
  for (const p of pages()) {
    const html = fs.readFileSync(path.join(root, p), 'utf8');
    const og = meta(html, 'property', 'og:image');
    const tw = meta(html, 'name', 'twitter:image');
    if (og.length !== 1 || og[0] !== CARD) bad.push(`${p} og:image=${og.join('|')}`);
    if (tw.length !== 1 || tw[0] !== CARD) bad.push(`${p} twitter:image=${tw.join('|')}`);
  }
  assert.ok(bad.length === 0, bad.slice(0, 6).join('; '));
});

test('share card: large-image layout, size and alt text on every page', () => {
  const bad = [];
  for (const p of pages()) {
    const html = fs.readFileSync(path.join(root, p), 'utf8');
    if (meta(html, 'name', 'twitter:card')[0] !== 'summary_large_image') bad.push(`${p} card`);
    if (meta(html, 'property', 'og:image:width')[0] !== '1200') bad.push(`${p} width`);
    if (meta(html, 'property', 'og:image:height')[0] !== '630') bad.push(`${p} height`);
    const alt = meta(html, 'property', 'og:image:alt')[0] || '';
    if (!/Jay Patel/.test(alt) || /Logo/i.test(alt)) bad.push(`${p} alt="${alt}"`);
  }
  assert.ok(bad.length === 0, bad.slice(0, 6).join('; '));
});

test('share card: the image is a 1200 x 630 PNG and the build publishes it', () => {
  const buf = fs.readFileSync(path.join(root, 'assets', 'share-card.png'));
  assert.ok(buf.subarray(1, 4).toString() === 'PNG', 'not a PNG');
  assert.ok(buf.readUInt32BE(16) === 1200 && buf.readUInt32BE(20) === 630, 'wrong size');
  const policy = require('../scripts/asset-policy.js');
  const ships = policy.shouldPublish || policy.isPublished || policy.ships;
  assert.ok(typeof ships === 'function', 'asset-policy exports no publish check');
  assert.ok(ships('share-card.png') || ships('assets/share-card.png'), 'share-card.png not published');
});

test('share card, negative control: a page left on the logo is caught', () => {
  const html = '<meta property="og:image" content="https://jayptl.me/assets/logo-1024.png" />';
  assert.ok(meta(html, 'property', 'og:image')[0] !== CARD);
});
