import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fontDir = path.join(root, 'assets', 'fonts');
const facesPath = path.join(root, 'css', 'base', 'fonts-local.css');

const WEIGHT_KEYWORDS = { normal: 400, bold: 700 };

function walk(dir, extension) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, extension);
    return extension.test(entry.name) ? [full] : [];
  });
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// Comments blank out to spaces so every offset and line number survives.
function blankComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

function lineCounter(src) {
  let line = 1;
  let at = 0;
  return (index) => {
    while (at < index) {
      if (src[at] === '\n') line += 1;
      at += 1;
    }
    return line;
  };
}

function weightSpan(value) {
  const text = value.trim();
  if (!text) return null;
  const parts = text.split(/\s+/).map((v) => WEIGHT_KEYWORDS[v] ?? Number(v));
  if (parts.some((n) => !Number.isFinite(n))) return null;
  return [Math.min(...parts), Math.max(...parts)];
}

// name -> hash, grouped; one group holding two names is one file paid for twice.
function duplicateGroups(entries) {
  const byHash = new Map();
  for (const entry of entries) {
    const group = byHash.get(entry.hash);
    if (group) group.push(entry.name);
    else byHash.set(entry.hash, [entry.name]);
  }
  return Array.from(byHash.values())
    .filter((names) => names.length > 1)
    .map((names) => names.sort())
    .sort();
}

function customProperties(files) {
  const defs = new Map();
  for (const file of files) {
    const src = blankComments(fs.readFileSync(file, 'utf8'));
    const re = /(--[\w-]+)\s*:\s*([^;]*);/g;
    let match;
    while ((match = re.exec(src))) {
      const list = defs.get(match[1]) || [];
      list.push(match[2].trim());
      defs.set(match[1], list);
    }
  }
  return defs;
}

// Every family a value can resolve to, custom properties expanded, aliases kept.
function familyCandidates(value, defs, seen = new Set(), out = new Set()) {
  for (const ref of value.match(/var\(\s*(--[\w-]+)/g) || []) {
    const name = /var\(\s*(--[\w-]+)/.exec(ref)[1];
    if (seen.has(name)) continue;
    seen.add(name);
    for (const def of defs.get(name) || []) familyCandidates(def, defs, seen, out);
  }
  const bare = value.replace(/var\([^()]*(?:\([^()]*\)[^()]*)*\)/g, ' ');
  for (const part of bare.split(',')) {
    const token = part.trim().replace(/^["']|["']$/g, '');
    if (token) out.add(token);
  }
  return out;
}

function weightCandidates(value, defs, seen = new Set(), out = []) {
  for (const ref of value.match(/var\(\s*(--[\w-]+)/g) || []) {
    const name = /var\(\s*(--[\w-]+)/.exec(ref)[1];
    if (seen.has(name)) continue;
    seen.add(name);
    for (const def of defs.get(name) || []) weightCandidates(def, defs, seen, out);
  }
  const span = weightSpan(value.replace(/var\([^()]*(?:\([^()]*\)[^()]*)*\)/g, ' '));
  if (span) out.push(span);
  return out;
}

// family -> declared [min, max] weight spans, straight from the @font-face rules.
function faceSpans(src) {
  const faces = [];
  const re = /@font-face\s*\{([^{}]*)\}/g;
  let match;
  while ((match = re.exec(src))) {
    const body = match[1];
    const family = /font-family:\s*([^;]+);/.exec(body);
    const weight = /font-weight:\s*([^;]+);/.exec(body);
    const file = /url\(\s*['"]?([^'")]+)/.exec(body);
    if (!family || !weight) continue;
    const span = weightSpan(weight[1]);
    if (!span) continue;
    faces.push({
      family: family[1].split(',')[0].trim().replace(/^["']|["']$/g, ''),
      min: span[0],
      max: span[1],
      file: file ? file[1].trim() : ''
    });
  }
  return faces;
}

function spansByFamily(faces) {
  const spans = new Map();
  for (const face of faces) {
    const list = spans.get(face.family) || [];
    list.push([face.min, face.max]);
    spans.set(face.family, list);
  }
  return spans;
}

// font-weight asked by a rule that also names its own family, at rule level only.
function fontAsks(files, defs, declared) {
  const asks = [];
  for (const file of files) {
    const src = blankComments(fs.readFileSync(file, 'utf8'));
    const rel = path.relative(root, file);
    const line = lineCounter(src);
    const re = /\{([^{}]*)\}/g;
    let match;
    while ((match = re.exec(src))) {
      const prelude = src.slice(Math.max(0, match.index - 32), match.index);
      if (/@font-face\s*$/.test(prelude)) continue;
      const body = match[1];
      const famDecl = /(^|[;\s])font-family:\s*([^;]+)/.exec(body);
      const weightDecl = /(^|[;\s])font-weight:\s*([^;]+)/.exec(body);
      if (!famDecl || !weightDecl) continue;
      const families = Array.from(familyCandidates(famDecl[2], defs))
        .filter((family) => declared.has(family))
        .sort();
      const weights = weightCandidates(weightDecl[2], defs)
        .flatMap(([min, max]) => (min === max ? [min] : [min, max]))
        .sort((a, b) => a - b);
      for (const family of families) {
        for (const weight of weights) {
          asks.push({
            file: rel,
            line: line(match.index + 1 + weightDecl.index + weightDecl[0].indexOf('font-weight:')),
            family,
            weight
          });
        }
      }
    }
  }
  return asks;
}

function uncovered(asks, spans) {
  return asks
    .filter((ask) => {
      const list = spans.get(ask.family) || [];
      return !list.some(([min, max]) => ask.weight >= min && ask.weight <= max);
    })
    .map((ask) => `${ask.file}:${ask.line} ${ask.family} ${ask.weight}`);
}

test('font faces: no two self-hosted font files share a sha256', () => {
  const files = walk(fontDir, /\.(woff2?|ttf|otf)$/i);
  assert.ok(files.length >= 6, 'expected the real font set');
  const entries = files.map((file) => ({ name: path.relative(root, file), hash: sha256(file) }));
  assert.deepEqual(duplicateGroups(entries), [], 'one file is shipped under several names');
});

test('font faces: the duplicate checker rejects two names for one file', () => {
  const entries = [
    { name: 'plex-sans-400.woff2', hash: 'aa11' },
    { name: 'plex-sans-600.woff2', hash: 'aa11' },
    { name: 'plex-mono-400.woff2', hash: 'bb22' },
    { name: 'plex-mono-600.woff2', hash: 'cc33' }
  ];
  assert.deepEqual(duplicateGroups(entries), [['plex-sans-400.woff2', 'plex-sans-600.woff2']]);
  entries[1].hash = 'dd44';
  assert.deepEqual(duplicateGroups(entries), []);
});

test('font faces: every font-weight the css asks has a declared face', () => {
  const files = walk(path.join(root, 'css'), /\.css$/);
  const defs = customProperties(files);
  const faces = faceSpans(blankComments(fs.readFileSync(facesPath, 'utf8')));
  const spans = spansByFamily(faces);
  const declared = new Set(spans.keys());
  assert.ok(declared.size >= 5, 'expected the self-hosted family set');
  const asks = fontAsks(files, defs, declared);
  assert.ok(asks.length > 40, 'expected the real weight ask set');
  assert.deepEqual(uncovered(asks, spans), [], 'the requested weight has no face to serve it');
});

test('font faces: the coverage checker rejects a static gap and accepts a range', () => {
  const spans = spansByFamily([
    { family: 'plex-sans', min: 400, max: 400, file: '' },
    { family: 'plex-sans', min: 600, max: 600, file: '' }
  ]);
  const asks = [
    { file: 'css/x.css', line: 7, family: 'plex-sans', weight: 500 },
    { file: 'css/x.css', line: 9, family: 'plex-sans', weight: 600 }
  ];
  assert.deepEqual(uncovered(asks, spans), ['css/x.css:7 plex-sans 500']);
  spans.set('plex-sans', [[100, 700]]);
  assert.deepEqual(uncovered(asks, spans), []);
});

test('font faces: a declared weight range reads as one face', () => {
  const faces = faceSpans(blankComments(
    "/* latin */\n@font-face {\n  font-family: 'plex-sans';\n  font-style: normal;\n" +
    "  font-weight: 400 700;\n  src: url('/assets/fonts/plex-sans-400-700.woff2') format('woff2');\n}"
  ));
  assert.deepEqual(faces, [
    { family: 'plex-sans', min: 400, max: 700, file: '/assets/fonts/plex-sans-400-700.woff2' }
  ]);
});
