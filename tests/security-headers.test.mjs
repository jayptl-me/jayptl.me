// Security headers: scripts/security-headers.js is the source of truth.
// render.yaml and _headers are static config, so check they carry the same
// values; check every built page has the CSP meta tag and no inline code.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const { SECURITY_HEADERS, CONTENT_SECURITY_POLICY, META_CONTENT_SECURITY_POLICY } = require('../scripts/security-headers.js');

function builtHtml(dir = dist) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return builtHtml(full);
    return entry.name.endsWith('.html') ? [full] : [];
  });
}

test('render.yaml serves every shared security header on /*', () => {
  const yaml = fs.readFileSync(path.join(root, 'render.yaml'), 'utf8');
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    const block = new RegExp(`- path: /\\*\\n\\s+name: ${name}\\n\\s+value: "?([^\\n]*?)"?\\n`);
    const match = yaml.match(block);
    assert.ok(match, `render.yaml is missing ${name}`);
    assert.equal(match[1], value, `render.yaml ${name} differs from scripts/security-headers.js`);
  }
});

test('_headers matches the shared security headers', () => {
  const file = fs.readFileSync(path.join(root, '_headers'), 'utf8');
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    assert.ok(file.includes(`  ${name}: ${value}\n`), `_headers ${name} differs`);
  }
});

test('CSP has no unsafe-inline or unsafe-eval for scripts', () => {
  const scriptSrc = CONTENT_SECURITY_POLICY.split('; ').find((d) => d.startsWith('script-src'));
  assert.ok(!scriptSrc.includes("'unsafe-inline'"));
  assert.ok(!scriptSrc.includes("'unsafe-eval'"));
  assert.match(CONTENT_SECURITY_POLICY, /frame-ancestors 'none'/);
  assert.doesNotMatch(META_CONTENT_SECURITY_POLICY, /frame-ancestors/);
});

test('every built page carries the CSP meta tag and no inline scripts or handlers', () => {
  const pages = builtHtml().filter((file) => /<head[^>]*>/i.test(fs.readFileSync(file, 'utf8')));
  assert.ok(pages.length > 10);
  for (const file of pages) {
    const html = fs.readFileSync(file, 'utf8');
    const rel = path.relative(dist, file);
    assert.ok(html.includes(`content="${META_CONTENT_SECURITY_POLICY}"`), `${rel} is missing the CSP meta tag`);
    const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
      .filter(([, attrs, body]) => !/\bsrc=/i.test(attrs) && !/application\/ld\+json/i.test(attrs) && body.trim());
    assert.equal(inline.length, 0, `${rel} has an inline script, which the CSP blocks`);
    assert.doesNotMatch(html, /\son[a-z]+="/i, `${rel} has an inline event handler, which the CSP blocks`);
  }
});
