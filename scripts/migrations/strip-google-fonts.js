#!/usr/bin/env node
// Remove the Google Fonts preload+noscript block from each page's <head>.
// Fonts are now self-hosted and loaded via /css/main.css -> fonts-local.css.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const files = [
  'index.html',
  'pages/privacy.html',
  'pages/404.html',
  'pages/500.html',
  'pages/about.html',
  'pages/design-system.html',
  'pages/projects/index.html',
  'pages/projects/aviz-health.html',
  'pages/projects/swalook.html',
  'pages/projects/genuinest.html',
  'pages/projects/vini-tini.html',
];

// The exact 7-line block to remove (varies by page only in trailing `>` vs ` />`
// on the main.css link, which we leave alone). We target the preload+noscript.
const BLOCK_START = '    <!-- Fonts Preload -->\n';
const BLOCK_START_ALT = '    <link rel="preload"\n';

let removed = 0;
for (const rel of files) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) { console.warn('skip missing', rel); continue; }
  let html = fs.readFileSync(file, 'utf8');
  const orig = html;

  // Remove the whole preload+noscript comment block if present
  html = html.replace(
    /    <!-- Fonts Preload -->\n    <link rel="preload"\n        href="https:\/\/fonts\.googleapis\.com\/css2\?family=Audiowide[^"]*"\n        as="style" onload="this\.onload=null;this\.rel='stylesheet'">\n    <noscript>\n        <link rel="stylesheet"\n            href="https:\/\/fonts\.googleapis\.com\/css2\?family=Audiowide[^"]*">\n    <\/noscript>\n/g,
    ''
  );

  // Some pages may lack the comment but have the bare preload
  html = html.replace(
    /    <link rel="preload"\n        href="https:\/\/fonts\.googleapis\.com\/css2\?family=Audiowide[^"]*"\n        as="style" onload="this\.onload=null;this\.rel='stylesheet'">\n    <noscript>\n        <link rel="stylesheet"\n            href="https:\/\/fonts\.googleapis\.com\/css2\?family=Audiowide[^"]*">\n    <\/noscript>\n/g,
    ''
  );

  if (html !== orig) {
    fs.writeFileSync(file, html);
    removed++;
    console.log('stripped', rel);
  } else {
    console.log('no change ', rel);
  }
}
console.log(`\nDone. Removed font block from ${removed}/${files.length} files.`);
