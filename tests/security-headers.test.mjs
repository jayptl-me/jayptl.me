// Security headers: scripts/security-headers.js is the source of truth.
// Configuration files and headers are static, so check they carry the same
// values; check every built page has the CSP meta tag and no inline code,
// except the one ruled exception (D-81): the home page's preloader script,
// allowed by its sha256 hash in script-src. This file hashes that script
// itself, independently of scripts/security-headers.js, so a drift between
// the page and the policy fails here. Hashes are taken the way a browser takes
// them: after the HTML parser has turned CR and CRLF into LF.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const headers = require('../scripts/security-headers.js');
const { SECURITY_HEADERS, CONTENT_SECURITY_POLICY, META_CONTENT_SECURITY_POLICY } = headers;
const { checkInlineScriptHashes } = require('../scripts/validate.js');

function builtHtml(dir = dist) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return builtHtml(full);
    return entry.name.endsWith('.html') ? [full] : [];
  });
}

const sha256 = (body) => `'sha256-${crypto.createHash('sha256').update(body.replace(/\r\n?/g, '\n'), 'utf8').digest('base64')}'`;
const rawSha256 = (body) => `'sha256-${crypto.createHash('sha256').update(body, 'utf8').digest('base64')}'`;

// Every executable inline script: no src attribute, and not a JSON data block. Empty ones
// count too. Attribute names are matched whole, so data-src and data-type do not hide one.
function inlineScripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter(([, attrs]) => { const a = attrs.replace(/=\s*("[^"]*"|'[^']*')/g, (m, v) => '=' + v[0] + (/^.(application\/(ld\+)?json).$/i.test(v) ? v.slice(1, -1) : '') + v[0]); return !/(?:^|\s)src\s*=/i.test(a) && !/(?:^|\s)type\s*=\s*["']?application\/(ld\+)?json/i.test(a); })
    .map(([, , body]) => body);
}

test('the inline-script finder is not fooled by " src=" inside an attribute value', async () => {
  const mod = await import('../scripts/security-headers.js');
  const finder = mod.inlineScripts || mod.default.inlineScripts;
  const sneaky = '<script data-note=" src=1">alert(1)</script><script src="/js/a.js"></script>';
  assert.deepEqual(finder(sneaky), ['alert(1)'], 'a quoted value is not an attribute');
  assert.deepEqual(inlineScripts(sneaky), ['alert(1)'], 'the test copy agrees');
});

function scriptSrc(policy) {
  return (policy.split('; ').find((d) => d.startsWith('script-src ')) || '').split(/\s+/).slice(1);
}

const policyHashes = (policy) => scriptSrc(policy).filter((s) => /^'sha(256|384|512)-/.test(s));

const SOURCE_HOME = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const SOURCE_HOME_SCRIPTS = inlineScripts(SOURCE_HOME);

// What a built page may carry: only the home page has an inline script, exactly one,
// and its hash must be in the policy's script-src.
function pageViolations(rel, html, policy) {
  const v = [];
  const scripts = inlineScripts(html);
  const allowed = policyHashes(policy);
  if (rel === 'index.html') {
    if (scripts.length !== 1) v.push(`${rel}: ${scripts.length} inline scripts, exactly one (the preloader hold) is allowed`);
  } else if (scripts.length) {
    v.push(`${rel}: ${scripts.length} inline script(s); only the home preloader script is allowed (D-81)`);
  }
  for (const body of scripts) {
    const hash = sha256(body);
    if (!allowed.includes(hash)) v.push(`${rel}: inline script ${hash} is not in script-src`);
  }
  if (/\son[a-z]+="/i.test(html)) v.push(`${rel}: inline event handler, which the CSP blocks`);
  return v;
}

function scriptSrcProblems(policy) {
  const src = scriptSrc(policy);
  const v = [];
  if (!src.length) v.push('no script-src');
  if (src.includes("'unsafe-inline'")) v.push("script-src allows 'unsafe-inline'");
  if (src.includes("'unsafe-eval'")) v.push("script-src allows 'unsafe-eval'");
  return v;
}

function renderYamlMismatches(yaml) {
  const v = [];
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    const block = new RegExp(`- path: /\\*\\n\\s+name: ${name}\\n\\s+value: "?([^\\n]*?)"?\\n`);
    const match = yaml.match(block);
    if (!match) v.push(`render.yaml is missing ${name}`);
    else if (match[1] !== value) v.push(`render.yaml ${name} differs from scripts/security-headers.js; expected: ${value}`);
  }
  return v;
}

function headersFileMismatches(file) {
  return Object.entries(SECURITY_HEADERS)
    .filter(([name, value]) => !file.includes(`  ${name}: ${value}\n`))
    .map(([name, value]) => `_headers ${name} differs; expected: ${value}`);
}

// A throwaway dist holding one page, for the shipped-bytes checks.
function tempDist(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jps-hash-'));
  for (const [rel, html] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), html);
  }
  return dir;
}

test('render.yaml serves every shared security header on /*', () => {
  assert.deepEqual(renderYamlMismatches(fs.readFileSync(path.join(root, 'render.yaml'), 'utf8')), []);
});

test('_headers matches the shared security headers', () => {
  assert.deepEqual(headersFileMismatches(fs.readFileSync(path.join(root, '_headers'), 'utf8')), []);
});

test('.htaccess matches the shared security headers', () => {
  const file = fs.readFileSync(path.join(root, '.htaccess'), 'utf8');
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    assert.ok(
      file.includes(`Header always set ${name} "${value}"`),
      `.htaccess ${name} differs from scripts/security-headers.js`
    );
  }
});

test('dist/.htaccess carries every shared security header', () => {
  const file = fs.readFileSync(path.join(dist, '.htaccess'), 'utf8');
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    assert.ok(
      file.includes(`Header always set ${name} "${value}"`),
      `dist/.htaccess ${name} differs from scripts/security-headers.js`
    );
  }
});

test('CSP has no unsafe-inline or unsafe-eval for scripts', () => {
  assert.deepEqual(scriptSrcProblems(CONTENT_SECURITY_POLICY), []);
  assert.deepEqual(scriptSrcProblems(META_CONTENT_SECURITY_POLICY), []);
  assert.match(CONTENT_SECURITY_POLICY, /frame-ancestors 'none'/);
  assert.doesNotMatch(META_CONTENT_SECURITY_POLICY, /frame-ancestors/);
});

test('CSP allows exactly one inline script hash: the home preloader script as written in index.html', () => {
  assert.equal(SOURCE_HOME_SCRIPTS.length, 1, 'index.html must carry exactly one inline script');
  const expected = sha256(SOURCE_HOME_SCRIPTS[0]);
  assert.deepEqual(policyHashes(CONTENT_SECURITY_POLICY), [expected], `script-src must list ${expected} and no other hash`);
  assert.deepEqual(policyHashes(META_CONTENT_SECURITY_POLICY), [expected]);
});

test('every built page carries the CSP meta tag; only the home page has an inline script, and it is the hashed one', () => {
  const pages = builtHtml().filter((file) => /<head[^>]*>/i.test(fs.readFileSync(file, 'utf8')));
  assert.ok(pages.length > 10);
  const problems = [];
  for (const file of pages) {
    const html = fs.readFileSync(file, 'utf8');
    const rel = path.relative(dist, file).split(path.sep).join('/');
    if (!html.includes(`content="${META_CONTENT_SECURITY_POLICY}"`)) problems.push(`${rel} is missing the CSP meta tag`);
    problems.push(...pageViolations(rel, html, CONTENT_SECURITY_POLICY));
  }
  assert.deepEqual(problems, []);
});

test('the built home script is byte-identical to the source script (the minifier leaves it alone)', () => {
  const built = inlineScripts(fs.readFileSync(path.join(dist, 'index.html'), 'utf8'));
  assert.equal(built.length, 1);
  assert.equal(sha256(built[0]), sha256(SOURCE_HOME_SCRIPTS[0]));
});

test('the deploy gate (scripts/validate.js) re-hashes what ships and finds the built dist clean', () => {
  assert.deepEqual(checkInlineScriptHashes(dist), []);
});

test('negative control: a dist minified twice (script rewritten) fails the deploy gate', async () => {
  const { minify } = require('html-minifier-terser');
  const shipped = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  // The same options scripts/optimize.js uses. The first pass keeps the script and
  // drops the htmlmin:ignore markers, so the second pass rewrites the script. Two
  // passes here, so the control holds on a dist that was or was not minified yet.
  const options = {
    collapseWhitespace: true, removeComments: true, removeRedundantAttributes: true,
    removeScriptTypeAttributes: true, removeStyleLinkTypeAttributes: true, useShortDoctype: false,
    minifyCSS: true, minifyJS: true, minifyURLs: true, keepClosingSlash: true, preserveLineBreaks: false
  };
  const twice = await minify(await minify(shipped, options), options);
  const dir = tempDist({ 'index.html': twice });
  try {
    assert.ok(checkInlineScriptHashes(dir).some((x) => /index\.html: inline script .* not allowed/.test(x)));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('negative control: a one-character change to the home script fails the hash check', () => {
  const body = SOURCE_HOME_SCRIPTS[0];
  const edited = body.replace('5e3', '6e3');
  assert.notEqual(edited, body);
  const v = pageViolations('index.html', SOURCE_HOME.replace(body, edited), CONTENT_SECURITY_POLICY);
  assert.ok(v.some((x) => /is not in script-src/.test(x)), v.join('\n'));
  assert.deepEqual(pageViolations('index.html', SOURCE_HOME, CONTENT_SECURITY_POLICY), []);
  assert.ok(headers.inlineScriptViolations('index.html', SOURCE_HOME.replace(body, edited)).some((x) => /not allowed/.test(x)));
});

test('negative control: any other inline script fails, on the home page or any other page', () => {
  const extra = SOURCE_HOME.replace('</body>', '<script>void 0</script></body>');
  assert.ok(pageViolations('index.html', extra, CONTENT_SECURITY_POLICY).some((x) => /2 inline scripts/.test(x)));
  const empty = SOURCE_HOME.replace('</body>', '<script></script></body>');
  assert.ok(pageViolations('index.html', empty, CONTENT_SECURITY_POLICY).length > 0);
  const copied = `<html><head></head><body><script>${SOURCE_HOME_SCRIPTS[0]}</script></body></html>`;
  assert.ok(pageViolations('about/index.html', copied, CONTENT_SECURITY_POLICY).some((x) => /only the home preloader/.test(x)));
  const handler = SOURCE_HOME.replace('<body', '<body onload="x()"');
  assert.ok(pageViolations('index.html', handler, CONTENT_SECURITY_POLICY).some((x) => /event handler/.test(x)));
});

test('build and deploy gate: the home hash is allowed on the home page only', () => {
  assert.deepEqual(headers.inlineScriptViolations('index.html', SOURCE_HOME), []);
  const copied = `<html><head></head><body><script>${SOURCE_HOME_SCRIPTS[0]}</script></body></html>`;
  assert.ok(headers.inlineScriptViolations('about/index.html', copied).some((x) => /only the home page/.test(x)));
  const dir = tempDist({ 'index.html': SOURCE_HOME, 'about/index.html': copied });
  try {
    assert.ok(checkInlineScriptHashes(dir).some((x) => /about\/index\.html/.test(x)));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('data-src and data-type do not hide an inline script from the gates', () => {
  for (const tag of ['<script data-src="x">alert(1)</script>', '<script data-type="application/json">alert(1)</script>']) {
    assert.equal(inlineScripts(tag).length, 1, tag);
    assert.equal(headers.inlineScripts(tag).length, 1, tag);
  }
  assert.equal(headers.inlineScripts('<script src="/x.js"></script><script type="application/ld+json">{}</script>').length, 0);
});

test('CRLF: the hash is taken after line endings become LF, as the browser does', () => {
  // Start from LF, so the check holds whether the checkout is LF or CRLF.
  const body = SOURCE_HOME_SCRIPTS[0].replace(/\r\n?/g, '\n');
  const crlf = body.replace(/\n/g, '\r\n');
  assert.notEqual(crlf, body);
  assert.equal(headers.scriptHash(crlf), headers.scriptHash(body), 'scripts/security-headers.js normalises');
  assert.equal(sha256(crlf), sha256(body), 'this test normalises');
  const crlfPage = SOURCE_HOME.replace(/\r\n?/g, '\n').replace(/\n/g, '\r\n');
  assert.deepEqual(pageViolations('index.html', crlfPage, CONTENT_SECURITY_POLICY), []);
});

test('CRLF, negative control: hashing the raw CRLF bytes gives a hash the browser would refuse', () => {
  const body = SOURCE_HOME_SCRIPTS[0].replace(/\r\n?/g, '\n');
  assert.notEqual(rawSha256(body.replace(/\n/g, '\r\n')), sha256(body));
});

test('.gitattributes keeps HTML checked out with LF line endings', () => {
  const attrs = fs.readFileSync(path.join(root, '.gitattributes'), 'utf8');
  assert.match(attrs, /^\*\.html\s+text\s+eol=lf\s*$/m);
});

test('negative control: static configs carrying a stale policy, or unsafe-inline, fail', () => {
  const csp = SECURITY_HEADERS['Content-Security-Policy'];
  const stale = csp.replace(/ 'sha256-[^']+'/, '');
  assert.notEqual(stale, csp);
  const yaml = fs.readFileSync(path.join(root, 'render.yaml'), 'utf8');
  assert.ok(renderYamlMismatches(yaml.replace(csp, stale)).some((x) => /Content-Security-Policy differs/.test(x)));
  const file = fs.readFileSync(path.join(root, '_headers'), 'utf8');
  assert.ok(headersFileMismatches(file.replace(csp, stale)).some((x) => /Content-Security-Policy differs/.test(x)));
  assert.ok(scriptSrcProblems(csp.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")).length > 0);
});

test('the site API origin, when set, is allowed by connect-src', () => {
  const siteApi = fs.readFileSync(path.join(root, 'js/components/site-api.js'), 'utf8');
  const base = /var API_BASE = '([^']*)';/.exec(siteApi)[1];
  const csp = SECURITY_HEADERS['Content-Security-Policy'];
  const connect = (/connect-src ([^;]+)/.exec(csp) || [])[1] || '';
  if (base) {
    assert.ok(connect.split(/\s+/).includes(new URL(base).origin), `connect-src must include ${base}`);
  } else {
    assert.ok(true, 'API off, nothing to allow');
  }
});
