/**
 * Single source of truth for the site's security headers.
 *
 * Used by scripts/build.js (per-page CSP meta tag, generated .htaccess) and
 * scripts/server.js (local server). render.yaml and _headers are static
 * config files, so tests/security-headers.test.mjs checks they carry these
 * exact values.
 *
 * Google Analytics 4 only loads after visitor opt-in; its script and
 * collection hosts are allowed below. Cloudflare Web Analytics hosts are
 * allowed in case the CDN injects its beacon.
 */

const CSP_DIRECTIVES = [
  ["default-src", "'self'"],
  ["script-src", "'self' https://www.googletagmanager.com https://static.cloudflareinsights.com"],
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

const SECURITY_HEADERS = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
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
  SECURITY_HEADERS
};
