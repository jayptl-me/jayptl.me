#!/usr/bin/env node
'use strict';

/**
 * Custom performance budget gate.
 *
 * Runs after build + optimize. Counts what a browser must request for each
 * key page, checks the CSS entries are flat, reports duplicated font files,
 * and fails on hard limits. No third-party code.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const dist = path.join(root, 'dist');

const pages = [
  { name: 'home', file: 'index.html' },
  { name: 'projects', file: 'projects/index.html' },
  { name: 'about', file: 'about/index.html' },
  { name: 'case study', file: 'projects/aviz-health/index.html' }
];

const WARN = { requests: 65, cssBytes: 450000, jsBytes: 300000 };
const FAIL = { requests: 80, cssBytes: 550000, jsBytes: 400000, fontsBytes: 300000 };

// Set this to true in the same commit that deletes the duplicate font files,
// then a duplicate byte-for-byte copy fails the gate instead of warning.
const FONT_DUPLICATES_FAIL = true;

function read(rel) {
  return fs.readFileSync(path.join(dist, rel), 'utf8');
}

function bytes(rel) {
  try {
    return fs.statSync(path.join(dist, rel)).size;
  } catch (e) {
    return 0;
  }
}

function localRefs(html) {
  const refs = new Set();
  const attr = /(?:href|src)="(\/[^"]+\.(?:css|js|png|jpe?g|svg|webp|woff2?))"/g;
  let match;
  while ((match = attr.exec(html))) refs.add(match[1]);
  // One browser request per declared src. srcset variants are alternatives,
  // not extra requests, so they are not counted here.
  return Array.from(refs);
}

function fontsFromCss() {
  const fonts = new Set();
  const dir = path.join(dist, 'css');
  const walk = (current) => {
    for (const name of fs.readdirSync(current)) {
      const full = path.join(current, name);
      if (fs.statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!name.endsWith('.css')) continue;
      const css = fs.readFileSync(full, 'utf8');
      const re = /url\(['"]?(\/assets\/fonts\/[^'")]+)['"]?\)/g;
      let match;
      while ((match = re.exec(css))) fonts.add(match[1]);
    }
  };
  walk(dir);
  return Array.from(fonts);
}

function walkFiles(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function duplicateFontGroups() {
  const dir = path.join(dist, 'assets', 'fonts');
  if (!fs.existsSync(dir)) return [];
  const byHash = new Map();
  // Font files only; other assets are not hashed by this check yet.
  const files = walkFiles(dir, []).filter((file) => /\.(woff2?|ttf|otf)$/i.test(file));
  for (const file of files) {
    const hash = sha256(file);
    const group = byHash.get(hash);
    if (group) group.push(file);
    else byHash.set(hash, [file]);
  }
  return Array.from(byHash.values()).filter((group) => group.length > 1);
}

function checkFontDuplicates() {
  const groups = duplicateFontGroups();
  if (!groups.length) return;
  const wasted = groups.reduce(
    (sum, group) => sum + (group.length - 1) * fs.statSync(group[0]).size, 0);
  const copies = groups
    .map((group) => group.map((file) => path.relative(dist, file)).join(' = '))
    .join(', ');
  const message = `${groups.length} duplicate font group(s), ${wasted} wasted bytes: ${copies}`;
  if (FONT_DUPLICATES_FAIL) fail(message);
  else warn(message);
}

let failed = false;
let warned = false;

function fail(message) {
  failed = true;
  console.log(`[FAIL] ${message}`);
}

function warn(message) {
  warned = true;
  console.log(`[WARN] ${message}`);
}

const fonts = fontsFromCss();
const fontBytes = fonts.reduce((sum, url) => sum + bytes(url.slice(1)), 0);
if (fontBytes > FAIL.fontsBytes) fail(`fonts ${fontBytes} bytes over ${FAIL.fontsBytes}`);

console.log('page          requests  cssBytes  jsBytes  imgBytes');
for (const page of pages) {
  let html;
  try {
    html = read(page.file);
  } catch (e) {
    fail(`${page.name}: missing ${page.file}`);
    continue;
  }
  const refs = localRefs(html);
  const css = refs.filter((ref) => ref.endsWith('.css'));
  const js = refs.filter((ref) => ref.endsWith('.js'));
  const img = refs.filter((ref) => /\.(png|jpe?g|svg|webp)$/.test(ref));
  const all = Array.from(new Set([...refs, ...fonts]));
  const cssBytes = css.reduce((sum, ref) => sum + bytes(ref.slice(1)), 0);
  const jsBytes = js.reduce((sum, ref) => sum + bytes(ref.slice(1)), 0);
  const imgBytes = img.reduce((sum, ref) => sum + bytes(ref.slice(1)), 0);
  console.log(
    `${page.name.padEnd(13)} ${String(all.length).padEnd(9)} ${String(cssBytes).padEnd(9)} ` +
    `${String(jsBytes).padEnd(8)} ${imgBytes}`
  );

  if (all.length > FAIL.requests) fail(`${page.name}: ${all.length} requests over ${FAIL.requests}`);
  else if (all.length > WARN.requests) warn(`${page.name}: ${all.length} requests over ${WARN.requests}`);
  if (cssBytes > FAIL.cssBytes) fail(`${page.name}: CSS ${cssBytes} bytes over ${FAIL.cssBytes}`);
  else if (cssBytes > WARN.cssBytes) warn(`${page.name}: CSS ${cssBytes} bytes over ${WARN.cssBytes}`);
  if (jsBytes > FAIL.jsBytes) fail(`${page.name}: JS ${jsBytes} bytes over ${FAIL.jsBytes}`);
  else if (jsBytes > WARN.jsBytes) warn(`${page.name}: JS ${jsBytes} bytes over ${WARN.jsBytes}`);

  for (const ref of css) {
    const file = path.join(dist, ref.slice(1));
    const body = fs.readFileSync(file, 'utf8');
    if (/@import\b/.test(body)) fail(`${page.name}: ${ref} still contains @import`);
  }
}

const apple = walkFiles(dist, []).filter((file) => path.basename(file).startsWith('._'));
if (apple.length) fail(`${apple.length} AppleDouble files in dist`);

checkFontDuplicates();

if (failed) {
  console.log('\nPERF_BUDGET_FAIL');
  process.exit(1);
}
if (warned) console.log('\nPERF_BUDGET_WARN');
else console.log('\nPERF_BUDGET_PASS');
