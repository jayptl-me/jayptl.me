'use strict';

/**
 * Custom CSS entry bundler.
 *
 * Resolves the site's plain @import statements at build time so the browser
 * receives one stylesheet per entry instead of a request per partial. The
 * source files stay split for maintenance; only dist is flattened.
 *
 * Supported syntax: @import 'path'; @import "path"; @import url('path');
 * Anything else is rejected rather than silently shipped.
 */

const fs = require('fs');
const path = require('path');

const IMPORT_PATTERN = /@import\s+(?:url\(\s*)?(['"])([^'"]+)\1\s*\)?\s*;/g;
const URL_PATTERN = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

function fail(message) {
  throw new Error(`CSS bundle: ${message}`);
}

function resolveImport(spec, fromDir, root) {
  if (/^[a-z]+:/i.test(spec) || spec.startsWith('//')) {
    fail(`remote or data import is not allowed: ${spec}`);
  }
  if (spec.includes('?') || spec.includes('#')) {
    fail(`query or hash in import is not supported: ${spec}`);
  }
  return spec.startsWith('/')
    ? path.join(root, spec.slice(1))
    : path.resolve(fromDir, spec);
}

function assertNoRemainingImports(css, source) {
  if (/@import\b/.test(css)) {
    fail(`unsupported @import form remains in ${source}`);
  }
}

function assertNoRelativeUrls(css, source) {
  const urlRe = new RegExp(URL_PATTERN.source, 'g');
  let match;
  while ((match = urlRe.exec(css))) {
    const value = match[2].trim();
    if (value.startsWith('data:') || value.startsWith('#') || value.startsWith('/') ||
        value.startsWith('http:') || value.startsWith('https:') || value.startsWith('//')) {
      continue;
    }
    fail(`relative url(${value}) cannot be flattened safely in ${source}`);
  }
}

function bundleFile(absFile, root, stack, readCache, included) {
  if (stack.includes(absFile)) {
    fail(`import cycle: ${[...stack, absFile].join(' -> ')}`);
  }
  let css = readCache.get(absFile);
  if (css === undefined) {
    try {
      css = fs.readFileSync(absFile, 'utf8');
    } catch (error) {
      fail(`cannot read ${absFile}: ${error.message}`);
    }
    readCache.set(absFile, css);
  }
  included.add(absFile);

  const dir = path.dirname(absFile);
  const importRe = new RegExp(IMPORT_PATTERN.source, 'g');
  let out = '';
  let last = 0;
  let match;
  while ((match = importRe.exec(css))) {
    out += css.slice(last, match.index);
    const resolved = resolveImport(match[2], dir, root);
    const rel = path.relative(root, resolved).split(path.sep).join('/');
    out += `\n/* bundled from ${rel} */\n`;
    out += bundleFile(resolved, root, [...stack, absFile], readCache, included);
    out += '\n';
    last = importRe.lastIndex;
  }
  out += css.slice(last);
  return out;
}

function bundleCss(entry, root) {
  const absEntry = path.resolve(root, entry);
  const included = new Set();
  const css = bundleFile(absEntry, root, [], new Map(), included);
  assertNoRemainingImports(css, absEntry);
  assertNoRelativeUrls(css, absEntry);
  return { css, included: Array.from(included) };
}

function walkHtml(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walkHtml(full, out);
    } else if (name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

function findCssEntries(distDir) {
  const entries = new Set();
  const htmlFiles = walkHtml(distDir, []);
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    let match;
    const re = /href="(\/css\/[^"]+\.css)"/g;
    while ((match = re.exec(html))) entries.add(match[1]);
  }
  return Array.from(entries).sort();
}

function bundleCssInDist(options) {
  const distDir = options.distDir;
  const root = options.root;
  const entries = findCssEntries(distDir);
  let included = 0;
  for (const href of entries) {
    const rel = href.replace(/^\//, '');
    const source = path.join(root, rel);
    const target = path.join(distDir, rel);
    if (!fs.existsSync(source)) fail(`entry ${href} has no source at ${source}`);
    if (!fs.existsSync(target)) fail(`entry ${href} was not copied to ${target}`);
    const result = bundleCss(source, root);
    fs.writeFileSync(target, result.css);
    included += result.included.length - 1;
  }
  return { entries: entries.length, included };
}

module.exports = { bundleCss, bundleCssInDist, findCssEntries };
