#!/usr/bin/env node

/**
 * Production Static Server with Agent-Friendly Content Negotiation
 *
 * Serves the built site from dist/ and adds the behaviors AI agents rely on:
 *
 * - Markdown content negotiation (acceptmarkdown.com): pages that have a
 *   .md companion are served as text/markdown when the client's Accept
 *   header prefers it. Negotiated responses carry `Vary: Accept` so caches
 *   key on the right variant.
 * - Structured JSON errors: /api/* paths, unsupported methods, and any
 *   client whose Accept header prefers application/json receive
 *   { error: { code, message, hint } } bodies instead of HTML error pages.
 * - /api/health liveness probe for monitors and deploy health checks.
 * - RFC 9110 Accept parsing: q-values, specificity tie-breaks, and 406
 *   when no representation can satisfy the header.
 *
 * Used as the Render web service start command and for local development.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = process.env.PORT || 8000;
const DEFAULT_DIST_DIR = path.join(__dirname, '..', 'dist');

// MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

// Cache-Control policy, matching the previous static-host configuration
const CACHE_CONTROL = [
  { prefix: '/assets/', value: 'public, max-age=31536000, immutable' },
  { prefix: '/css/', value: 'public, max-age=2592000' },
  { prefix: '/js/', value: 'public, max-age=2592000' },
  // Machine-readable resources change with deploys; a short shared cache is safe
  // because they are single-variant (no Accept negotiation).
  { prefix: '/llms.txt', value: 'public, max-age=3600' },
  { prefix: '/llms-full.txt', value: 'public, max-age=3600' },
  { prefix: '/openapi.json', value: 'public, max-age=3600' },
  { prefix: '/robots.txt', value: 'public, max-age=3600' },
  { prefix: '/sitemap.xml', value: 'public, max-age=3600' }
];

// Security headers, matching the previous static-host configuration (_headers / render.yaml)
const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
};

// Route mappings (clean URLs)
const ROUTES = {
  '/about': '/pages/about.html',
  '/privacy': '/pages/privacy.html',
  '/design-system': '/pages/design-system.html',
  '/projects': '/pages/projects/index.html',
  '/projects/aviz-health': '/pages/projects/aviz-health.html',
  '/projects/swalook': '/pages/projects/swalook.html',
  '/projects/genuinest': '/pages/projects/genuinest.html',
  '/projects/vini-tini': '/pages/projects/vini-tini.html',
  '/about.html': '/pages/about.html',
  '/privacy.html': '/pages/privacy.html'
};

// Predictable markdown URLs -> dist file
const MD_ROUTES = {
  '/index.md': '/index.md',
  '/about.md': '/pages/about.md',
  '/privacy.md': '/pages/privacy.md',
  '/projects.md': '/pages/projects/index.md',
  '/projects/aviz-health.md': '/pages/projects/aviz-health.md',
  '/projects/swalook.md': '/pages/projects/swalook.md',
  '/projects/genuinest.md': '/pages/projects/genuinest.md',
  '/projects/vini-tini.md': '/pages/projects/vini-tini.md'
};

const AGENT_DOCS_URL = 'https://jayptl.me/llms.txt';

/* ------------------------------------------------------------------------ */
/* Accept header parsing (RFC 9110 sections 12.5.1 / 12.5.2)                 */
/* ------------------------------------------------------------------------ */

/**
 * Parse an Accept header into media ranges with quality values.
 * Returns [{ type, subtype, q }] with q defaulting to 1. Unparseable
 * entries are skipped. Other parameters (e.g. charset) are ignored.
 */
function parseAccept(header) {
  if (!header || typeof header !== 'string') {
    return [];
  }
  const ranges = [];
  for (const part of header.split(',')) {
    const [mediaType, ...params] = part.trim().split(';');
    const [type, subtype] = mediaType.trim().toLowerCase().split('/');
    if (!type || !subtype) {
      continue;
    }
    let q = 1;
    let qSeen = false;
    for (const param of params) {
      const [key, value] = param.trim().split('=');
      if (key === 'q') {
        const parsed = parseFloat(value);
        if (!Number.isNaN(parsed)) {
          q = Math.min(Math.max(parsed, 0), 1);
          qSeen = true;
        }
      }
    }
    if (!qSeen && params.some(p => p.trim().startsWith('q='))) {
      q = 0; // malformed q -> not acceptable, be conservative
    }
    ranges.push({ type, subtype, q });
  }
  return ranges;
}

function rangeMatches(range, mediaType) {
  const [type, subtype] = mediaType.split('/');
  if (range.type === '*' && range.subtype === '*') return 1;
  if (range.type === type && range.subtype === '*') return 2;
  if (range.type === type && range.subtype === subtype) return 3;
  return 0;
}

/**
 * Among the client's ranges that match mediaType, return the best one:
 * highest q wins; ties break toward the most specific range (exact >
 * type wildcard > full wildcard), which is the RFC 9110 precedence rule.
 * Returns { q, specificity } or null when nothing matches.
 */
function bestMatchFor(ranges, mediaType) {
  let best = null;
  for (const range of ranges) {
    const specificity = rangeMatches(range, mediaType);
    if (specificity === 0) continue;
    if (
      !best ||
      range.q > best.q ||
      (range.q === best.q && specificity > best.specificity)
    ) {
      best = { q: range.q, specificity };
    }
  }
  return best;
}

/**
 * Pick the representation to serve from `representations`
 * ([{ contentType, file }]) given an Accept header.
 * Returns the chosen representation, or null when the header cannot be
 * satisfied by any representation (caller should respond 406).
 */
function negotiate(acceptHeader, representations) {
  const ranges = parseAccept(acceptHeader);

  // No Accept header means the client accepts anything: serve the default.
  if (ranges.length === 0) {
    return representations[0];
  }

  let winner = null;
  let winnerScore = null;
  for (const representation of representations) {
    const match = bestMatchFor(ranges, representation.contentType);
    if (!match || match.q === 0) continue;
    // Highest q wins; equal q breaks toward the more specific matching
    // range (exact > type wildcard > full wildcard), per RFC 9110 §12.5.1;
    // remaining ties go to declaration order (server preference).
    if (
      !winnerScore ||
      match.q > winnerScore.q ||
      (match.q === winnerScore.q && match.specificity > winnerScore.specificity)
    ) {
      winner = representation;
      winnerScore = match;
    }
  }
  return winner;
}

/**
 * True when the client's Accept header prefers application/json over any
 * HTML representation — used to decide between JSON and HTML error pages.
 */
function prefersJson(acceptHeader) {
  const ranges = parseAccept(acceptHeader);
  if (ranges.length === 0) return false;
  const json = bestMatchFor(ranges, 'application/json');
  if (!json || json.q === 0) return false;
  const html = bestMatchFor(ranges, 'text/html');
  return !html || json.q > html.q;
}

/* ------------------------------------------------------------------------ */
/* Server factory                                                            */
/* ------------------------------------------------------------------------ */

function createApp(options = {}) {
  const distDir = options.distDir || DEFAULT_DIST_DIR;
  const quiet = !!options.quiet;

  let buildInfo = null;
  try {
    buildInfo = JSON.parse(fs.readFileSync(path.join(distDir, 'build-info.json'), 'utf8'));
  } catch {
    buildInfo = null;
  }
  const startedAt = Date.now();

  /* ------------------------------ helpers ------------------------------- */

  function cacheControlFor(requestPath) {
    for (const rule of CACHE_CONTROL) {
      if (requestPath === rule.prefix || requestPath.startsWith(rule.prefix)) {
        return rule.value;
      }
    }
    return null;
  }

  function baseHeaders(requestPath, extra = {}) {
    const headers = { ...SECURITY_HEADERS, ...extra };
    const cache = cacheControlFor(requestPath);
    if (cache) headers['Cache-Control'] = cache;
    return headers;
  }

  function isHttps(req) {
    return req.socket.encrypted || (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  }

  function sendJsonError(req, res, status, code, message, hint, extraHeaders = {}) {
    const body = JSON.stringify({
      error: {
        code,
        message,
        hint,
        status,
        path: req.url.split('?')[0],
        documentation: AGENT_DOCS_URL
      }
    });
    res.writeHead(status, {
      ...baseHeaders(req.url.split('?')[0], {
        'Content-Type': 'application/json; charset=utf-8',
        // Status (not just body) depends on Accept for negotiated resources.
        'Vary': 'Accept, Accept-Encoding',
        ...extraHeaders
      })
    });
    res.end(body);
  }

  function sendHtmlErrorPage(res, requestPath, status, pageFile) {
    const filePath = path.join(distDir, pageFile);
    fs.readFile(filePath, (err, data) => {
      const headers = baseHeaders(requestPath);
      if (err) {
        headers['Content-Type'] = 'text/html; charset=utf-8';
        res.writeHead(status, headers);
        res.end(`<h1>${status}</h1>`);
        return;
      }
      headers['Content-Type'] = 'text/html; charset=utf-8';
      res.writeHead(status, headers);
      res.end(data);
    });
  }

  function serve404(req, res, requestPath) {
    if (requestPath.startsWith('/api/') || prefersJson(req.headers.accept)) {
      sendJsonError(
        req, res, 404, 'NOT_FOUND',
        `No resource at ${requestPath}.`,
        `See ${AGENT_DOCS_URL} for the content index or https://jayptl.me/openapi.json for the API surface.`
      );
    } else {
      sendHtmlErrorPage(res, requestPath, 404, path.join('pages', '404.html'));
    }
  }

  function serveFile(req, res, filePath, requestPath, extraHeaders = {}) {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        serve404(req, res, requestPath);
        return;
      }
      const mimeType = MIME_TYPES[path.extname(filePath)] || 'application/octet-stream';
      const headers = baseHeaders(requestPath, {
        'Content-Type': mimeType,
        ...extraHeaders
      });
      if (!headers['Cache-Control']) {
        headers['Cache-Control'] = 'public, max-age=0, must-revalidate';
      }
      res.writeHead(200, headers);
      res.end(data);
    });
  }

  function serveHealth(req, res) {
    const body = JSON.stringify({
      status: 'ok',
      service: 'jayptl.me',
      version: (buildInfo && buildInfo.version) || null,
      buildDate: (buildInfo && buildInfo.buildDate) || null,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString()
    });
    res.writeHead(200, baseHeaders('/api/health', {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Vary': 'Accept, Accept-Encoding'
    }));
    res.end(body);
  }

  /* ---------------------------- negotiation ----------------------------- */

  function serveNegotiatedPage(req, res, requestPath, htmlFile) {
    const mdFile = htmlFile.replace(/\.html$/, '.md');
    let mdExists = false;
    try {
      mdExists = fs.statSync(path.join(distDir, mdFile)).isFile();
    } catch {
      mdExists = false;
    }

    const representations = [
      { contentType: 'text/html', file: htmlFile }
    ];
    if (mdExists) {
      representations.push({ contentType: 'text/markdown', file: mdFile });
    }

    const chosen = negotiate(req.headers.accept, representations);
    if (!chosen) {
      sendJsonError(
        req, res, 406, 'NOT_ACCEPTABLE',
        `No representation of ${requestPath} satisfies the Accept header.`,
        'This resource is available as text/html' + (mdExists ? ' or text/markdown' : '') + '. Adjust the Accept header (e.g. "Accept: text/markdown, text/html").'
      );
      return;
    }

    // The response body depends on Accept, so caches must key on it.
    serveFile(req, res, path.join(distDir, chosen.file), requestPath, {
      'Vary': 'Accept, Accept-Encoding'
    });
  }

  function serveApiRoute(req, res, requestPath) {
    if (requestPath === '/api/health') {
      const chosen = negotiate(req.headers.accept, [
        { contentType: 'application/json' }
      ]);
      if (!chosen) {
        sendJsonError(
          req, res, 406, 'NOT_ACCEPTABLE',
          'This endpoint only returns application/json.',
          'Send "Accept: application/json" or "Accept: */*".'
        );
        return;
      }
      serveHealth(req, res);
      return;
    }
    sendJsonError(
      req, res, 404, 'NOT_FOUND',
      `No API endpoint at ${requestPath}.`,
      'Available endpoints: GET /api/health. Full site API surface: https://jayptl.me/openapi.json'
    );
  }

  /* ------------------------------ handler ------------------------------- */

  const server = http.createServer((req, res) => {
    let requestPath;
    try {
      requestPath = decodeURIComponent(req.url.split('?')[0]);
    } catch {
      requestPath = req.url.split('?')[0];
    }

    // Remove trailing slash except for root
    if (requestPath !== '/' && requestPath.endsWith('/')) {
      requestPath = requestPath.slice(0, -1);
    }

    if (!quiet) {
      console.log(`${new Date().toISOString()} - ${req.method} ${requestPath}`);
    }

    // HSTS only makes sense over TLS; Render terminates TLS in front of us.
    // Set before any writeHead so it lands on every response.
    if (isHttps(req)) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // Content negotiation and JSON errors are GET/HEAD semantics; other
    // methods are uniformly rejected with a JSON 405 (no write surface exists).
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, baseHeaders(requestPath, { Allow: 'GET, HEAD, OPTIONS' }));
        res.end();
        return;
      }
      sendJsonError(
        req, res, 405, 'METHOD_NOT_ALLOWED',
        `${req.method} is not supported. This site is read-only.`,
        'Use GET (or HEAD). Supported resources are listed in https://jayptl.me/llms.txt',
        { Allow: 'GET, HEAD, OPTIONS' }
      );
      return;
    }

    if (requestPath.startsWith('/api/')) {
      serveApiRoute(req, res, requestPath);
      return;
    }

    // Agent index files are markdown despite the .txt extension (matches
    // the content types documented in openapi.json).
    if (requestPath === '/llms.txt' || requestPath === '/llms-full.txt') {
      const file = path.join(distDir, requestPath);
      fs.stat(file, (err, stats) => {
        if (err || !stats.isFile()) {
          serve404(req, res, requestPath);
          return;
        }
        serveFile(req, res, file, requestPath, {
          'Content-Type': 'text/markdown; charset=utf-8'
        });
      });
      return;
    }

    // Map clean markdown URLs to their files
    if (MD_ROUTES[requestPath]) {
      requestPath = MD_ROUTES[requestPath];
    } else if (ROUTES[requestPath]) {
      requestPath = ROUTES[requestPath];
    } else if (requestPath === '/') {
      requestPath = '/index.html';
    }

    const filePath = path.resolve(path.join(distDir, requestPath));

    // Security check - prevent directory traversal
    if (filePath !== distDir && !filePath.startsWith(distDir + path.sep)) {
      serve404(req, res, requestPath);
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        serve404(req, res, requestPath);
        return;
      }

      if (filePath.endsWith('.html')) {
        serveNegotiatedPage(req, res, requestPath, filePath.slice(distDir.length));
        return;
      }

      // Static asset (css/js/images/markdown files fetched directly, ...)
      serveFile(req, res, filePath, requestPath);
    });
  });

  return server;
}

/* ------------------------------------------------------------------------ */
/* CLI entry                                                                 */
/* ------------------------------------------------------------------------ */

if (require.main === module) {
  const PORT = DEFAULT_PORT;
  const server = createApp({ distDir: DEFAULT_DIST_DIR });

  server.listen(PORT, () => {
    console.log('\x1b[36m%s\x1b[0m', '╔════════════════════════════════════════╗');
    console.log('\x1b[36m%s\x1b[0m', '║   jayptl.me server running             ║');
    console.log('\x1b[36m%s\x1b[0m', '╚════════════════════════════════════════╝');
    console.log('');
    console.log('\x1b[32m%s\x1b[0m', `  ➜ Local:   http://localhost:${PORT}`);
    console.log('\x1b[32m%s\x1b[0m', `  ➜ Health:  http://localhost:${PORT}/api/health`);
    console.log('');
    console.log('\x1b[33m%s\x1b[0m', '  Agent-friendly features:');
    console.log('    • Accept: text/markdown negotiation (Vary: Accept)');
    console.log('    • JSON errors for /api/* and JSON-preferring clients');
    console.log('    • /openapi.json, /llms.txt, /llms-full.txt served from dist/');
    console.log('');
    console.log('\x1b[90m%s\x1b[0m', '  Press Ctrl+C to stop');
    console.log('');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\x1b[31mError: Port ${PORT} is already in use\x1b[0m`);
      console.log('Try a different port: PORT=8080 node scripts/server.js');
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  });
}

module.exports = { createApp, parseAccept, negotiate, prefersJson, ROUTES, MD_ROUTES };
