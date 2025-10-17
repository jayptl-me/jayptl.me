#!/usr/bin/env node

/**
 * Local Development Server with Route Handling
 * Mimics Render's routing behavior for local testing
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8000;
const DIST_DIR = path.join(__dirname, '..', 'dist');

// MIME types
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
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
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json'
};

// Route mappings (clean URLs)
const ROUTES = {
  '/about': '/pages/about.html',
  '/privacy': '/pages/privacy.html',
  '/design-system': '/pages/design-system.html',
  '/about.html': '/pages/about.html',
  '/privacy.html': '/pages/privacy.html'
};

function serveFile(filePath, res) {
  const ext = path.extname(filePath);
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      serve404(res);
      return;
    }

    res.writeHead(200, { 
      'Content-Type': mimeType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000'
    });
    res.end(data);
  });
}

function serve404(res) {
  const notFoundPath = path.join(DIST_DIR, 'pages', '404.html');
  
  fs.readFile(notFoundPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 - Page Not Found</h1>');
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  let requestPath = req.url.split('?')[0]; // Remove query params
  
  // Remove trailing slash except for root
  if (requestPath !== '/' && requestPath.endsWith('/')) {
    requestPath = requestPath.slice(0, -1);
  }

  console.log(`${new Date().toISOString()} - ${req.method} ${requestPath}`);

  // Check if it's a mapped route
  if (ROUTES[requestPath]) {
    requestPath = ROUTES[requestPath];
  }

  // Default to index.html for root
  if (requestPath === '/') {
    requestPath = '/index.html';
  }

  const filePath = path.join(DIST_DIR, requestPath);

  // Security check - prevent directory traversal
  if (!filePath.startsWith(DIST_DIR)) {
    serve404(res);
    return;
  }

  // Check if file exists
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      serve404(res);
      return;
    }

    serveFile(filePath, res);
  });
});

server.listen(PORT, () => {
  console.log('\x1b[36m%s\x1b[0m', '╔════════════════════════════════════════╗');
  console.log('\x1b[36m%s\x1b[0m', '║   Local Development Server Running    ║');
  console.log('\x1b[36m%s\x1b[0m', '╚════════════════════════════════════════╝');
  console.log('');
  console.log('\x1b[32m%s\x1b[0m', `  ➜ Local:   http://localhost:${PORT}`);
  console.log('\x1b[32m%s\x1b[0m', `  ➜ Network: http://127.0.0.1:${PORT}`);
  console.log('');
  console.log('\x1b[33m%s\x1b[0m', '  Routes configured:');
  console.log('    / → index.html');
  console.log('    /about → pages/about.html');
  console.log('    /privacy → pages/privacy.html');
  console.log('    /design-system → pages/design-system.html');
  console.log('    404 → pages/404.html');
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
