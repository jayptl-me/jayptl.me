#!/usr/bin/env node
// Phase 0 helper: self-host latin woff2 for the four Engineer-Notebook faces
// and the Audiowide hero face.
// Reads Google Fonts css2, keeps only the /* latin */ block per family,
// downloads the woff2 into assets/fonts/, emits css/base/fonts-local.css.
// One file per family per axis range, written once. Idempotent: safe to re-run.
// Static (no third-party runtime dep).

const fs = require('fs');
const path = require('path');
const https = require('https');

// This script sits in scripts/migrations, so the repo root is two levels up.
const ROOT = path.resolve(__dirname, '..', '..');
const FONT_DIR = path.join(ROOT, 'assets', 'fonts');
const OUT_CSS = path.join(ROOT, 'css', 'base', 'fonts-local.css');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// css2 query -> { file } is the @font-face family name and the file prefix.
// A wght@a..b range serves one variable file for the whole axis, so it is
// requested as a range. A static family is requested weight by weight.
const FAMILIES = [
  { css2: 'Space+Grotesk:wght@400..700', file: 'space-grotesk' },
  { css2: 'IBM+Plex+Sans:wght@400..700', file: 'plex-sans' },
  { css2: 'Architects+Daughter', file: 'architects-daughter' },
  { css2: 'IBM+Plex+Mono:wght@400;600', file: 'plex-mono' },
  // Hero display face, locked surface, single weight. A re-run that omits it
  // would emit a fonts-local.css with no audiowide face and the hero would
  // fall back to a system font.
  { css2: 'Audiowide', file: 'audiowide' },
];

const WEIGHT_KEYWORDS = { normal: 400, bold: 700 };

function weightSpan(body) {
  const match = /font-weight:\s*([^;]+);/.exec(body);
  if (!match) return null;
  const parts = match[1].trim().split(/\s+/).map((v) => WEIGHT_KEYWORDS[v] ?? Number(v));
  if (parts.some((n) => !Number.isFinite(n))) return null;
  return [Math.min(...parts), Math.max(...parts)];
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    }).on('error', reject);
  });
}

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(FONT_DIR, { recursive: true });
  const blocks = []; // accumulate @font-face latin blocks
  const written = new Map(); // local filename -> remote url, one write per file

  for (const fam of FAMILIES) {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${fam.css2}&display=swap`;
    const css = await fetch(cssUrl);

    // Split into @font-face blocks
    const faceRe = /@font-face\s*{([^}]*)}/g;
    let match;
    // css2 lists every declared weight of a variable family against the same
    // file, so faces group by their remote url before anything is downloaded.
    const groups = new Map();
    while ((match = faceRe.exec(css))) {
      const body = match[1];
      const isLatin = /\/\*\s*latin\s*\*\//.test(css.slice(Math.max(0, match.index - 12), match.index));
      if (!isLatin) continue;

      const famMatch = /font-family:\s*'([^']+)'/.exec(body);
      const styleMatch = /font-style:\s*(\w+)/.exec(body);
      const span = weightSpan(body);
      const urlMatch = /src:\s*url\(([^)]+)\)/.exec(body);
      if (!famMatch || !span || !urlMatch) continue;

      const style = styleMatch ? styleMatch[1] : 'normal';
      // Skip italic variable-ish duplicates we didn't ask for
      if (style !== 'normal') continue;

      const remote = urlMatch[1].replace(/&amp;/g, '&');
      const seen = groups.get(remote);
      if (seen) seen.push(span);
      else groups.set(remote, [span]);
    }

    for (const [remote, spans] of groups) {
      const min = Math.min(...spans.map((s) => s[0]));
      const max = Math.max(...spans.map((s) => s[1]));
      const ext = path.extname(new URL(remote).pathname) || '.woff2';
      const localName = `${fam.file}-${max > min ? `${min}-${max}` : min}${ext}`;
      const localPath = path.join(FONT_DIR, localName);

      const taken = written.get(localName);
      if (taken && taken !== remote) {
        throw new Error(`${localName} would hold two files: ${taken} and ${remote}`);
      }
      if (taken) continue;
      written.set(localName, remote);

      const buf = await download(remote);
      fs.writeFileSync(localPath, buf);
      console.log(`downloaded ${localName} (${(buf.length / 1024).toFixed(1)} KB)`);

      blocks.push(`@font-face {
  font-family: '${fam.file}';
  font-style: normal;
  font-weight: ${max > min ? `${min} ${max}` : min};
  font-display: swap;
  src: url('/assets/fonts/${localName}') format('woff2');
}`);
    }
  }

  const cssOut = `/* ==========================================================================
   SELF-HOSTED FONTS, Engineer Notebook stack (latin subset only)
   Space Grotesk · IBM Plex Sans · Architects Daughter · IBM Plex Mono
   Generated by scripts/migrations/fetch-fonts.js from Google Fonts css2
   (latin blocks, one @font-face per downloaded file).
   ========================================================================== */

${blocks.join('\n\n')}
`;
  fs.writeFileSync(OUT_CSS, cssOut);
  console.log(`wrote ${path.relative(ROOT, OUT_CSS)} (${blocks.length} faces)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
