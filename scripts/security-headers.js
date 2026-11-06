/**
 * Single source of truth for the site's security headers.
 *
 * Used by scripts/build.js (per-page CSP meta tag, generated .htaccess) and
 * scripts/server.js (local server). render.yaml and _headers are static
 * config files, so tests/security-headers.test.mjs checks they carry these
 * exact values.
 *
 * Consent-gated telemetry scripts and collection endpoints are allowed below.
 * Reverse-proxy telemetry hosts are allowed in case the edge network injects
 * a performance beacon.
 *
 * Inline scripts: script-src has no 'unsafe-inline'. The one ruled exception
 * (D-81) is the home page's preloader script, the only inline script in
 * index.html. Its sha256 hash is computed here from that script as written,
 * so the policy can never describe a script the page does not carry. The
 * script sits between htmlmin:ignore markers, so the minifier ships it byte
 * for byte. inlineScriptViolations() is the one check: scripts/build.js runs it
 * before stamping, scripts/validate.js runs it again on the minified dist that
 * ships, and tests/security-headers.test.mjs fails when the page, this policy,
 * render.yaml, _headers and .htaccess drift apart.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const HOME_PAGE = path.join(__dirname, '..', 'index.html');
// The built page (relative to dist/) that may carry the hashed script.
const HOME_REL = 'index.html';

/**
 * Bodies of every executable inline script in an HTML string: no src attribute, and
 * not a JSON data block. Attribute names are matched whole, so data-src or data-type
 * cannot hide a script from the check, and quoted values are blanked first (keeping
 * only a JSON type), so " src=1" inside a value cannot either.
 */
function inlineScripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter(([, attrs]) => { const a = attrs.replace(/=\s*("[^"]*"|'[^']*')/g, (m, v) => '=' + v[0] + (/^.(application\/(ld\+)?json).$/i.test(v) ? v.slice(1, -1) : '') + v[0]); return !/(?:^|\s)src\s*=/i.test(a) && !/(?:^|\s)type\s*=\s*["']?application\/(ld\+)?json/i.test(a); })
    .map(([, , body]) => body);
}

/**
 * The CSP source that allows exactly this inline script body. The HTML parser turns
 * CR and CRLF into LF before the browser hashes a script, so hash the same text.
 */
function scriptHash(body) {
  return `'sha256-${crypto.createHash('sha256').update(body.replace(/\r\n?/g, '\n'), 'utf8').digest('base64')}'`;
}

function preloaderScriptHash() {
  const scripts = inlineScripts(fs.readFileSync(HOME_PAGE, 'utf8'));
  if (scripts.length !== 1) {
    throw new Error(`index.html must carry exactly one inline script, the preloader hold (D-81); found ${scripts.length}`);
  }
  return scriptHash(scripts[0]);
}

const INLINE_SCRIPT_HASHES = [preloaderScriptHash()];

/**
 * What one built page may carry: the home page exactly one inline script, every other
 * page none, and every inline script's hash in script-src. Returns the problems found.
 */
function inlineScriptViolations(rel, html) {
  const problems = [];
  const scripts = inlineScripts(html);
  if (rel === HOME_REL) {
    if (scripts.length !== 1) problems.push(`${rel}: ${scripts.length} inline scripts; exactly one, the preloader hold, is allowed (D-81)`);
  } else if (scripts.length) {
    problems.push(`${rel}: ${scripts.length} inline script(s); only the home page may carry the hashed preloader script (D-81)`);
  }
  for (const body of scripts) {
    const hash = scriptHash(body);
    if (!INLINE_SCRIPT_HASHES.includes(hash)) {
      problems.push(`${rel}: inline script ${hash} is not allowed by script-src (allowed: ${INLINE_SCRIPT_HASHES.join(' ')})`);
    }
  }
  return problems;
}

const CSP_DIRECTIVES = [
  ["default-src", "'self'"],
  ["script-src", `'self' ${INLINE_SCRIPT_HASHES.join(' ')} https://www.googletagmanager.com https://static.cloudflareinsights.com`],
  ["style-src", "'self' 'unsafe-inline'"],
  ["font-src", "'self'"],
  ["img-src", "'self' data: https://*.google-analytics.com https://*.googletagmanager.com"],
  ["connect-src", "'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://cloudflareinsights.com"],
  ["object-src", "'none'"],
  ["base-uri", "'self'"],
  ["form-action", "'self'"],
  ["frame-ancestors", "'none'"],
  ["upgrade-insecure-requests", ""]
];

function buildCsp(directives) {
  return directives.map(([name, value]) => (value ? `${name} ${value}` : name)).join('; ');
}

const CONTENT_SECURITY_POLICY = buildCsp(CSP_DIRECTIVES);

// frame-ancestors is ignored in <meta> CSP, so leave it out of the tag.
const META_CONTENT_SECURITY_POLICY = buildCsp(CSP_DIRECTIVES.filter(([name]) => name !== 'frame-ancestors'));

// HSTS covers jayptl.me only. No includeSubDomains: several subdomains are
// self-hosted services that may not all serve HTTPS to browsers.
const SECURITY_HEADERS = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '0',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'accelerometer=(), browsing-topics=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-site'
};

module.exports = {
  CONTENT_SECURITY_POLICY,
  META_CONTENT_SECURITY_POLICY,
  SECURITY_HEADERS,
  INLINE_SCRIPT_HASHES,
  inlineScripts,
  inlineScriptViolations,
  scriptHash
};
