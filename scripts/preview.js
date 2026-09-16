#!/usr/bin/env node

/**
 * Preview Script - Local Preview Server
 * 
 * This script starts a local server to preview the built site
 * before deployment
 * 
 * @author Jay Patel
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const PORT = process.env.PORT || 8000;
const DIST_DIR = path.join(process.cwd(), 'dist');

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json'
};

/**
 * Create HTTP server
 */
const server = http.createServer((req, res) => {
  // Parse URL
  let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url);
  
  // Get file extension
  const extname = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';
  
  // Read and serve file
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // File not found - serve 404.html if it exists
        const notFoundPath = path.join(DIST_DIR, '404.html');
        fs.readFile(notFoundPath, (err, notFoundContent) => {
          if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          } else {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(notFoundContent, 'utf-8');
          }
        });
      } else {
        // Server error
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      // Success - serve file
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

/**
 * Start server
 */
server.listen(PORT, () => {
  console.log(`\n${colors.bright}${colors.green}Preview server running${colors.reset}\n`);
  console.log(`${colors.cyan}Local:${colors.reset}            http://localhost:${PORT}`);
  console.log(`${colors.cyan}Network:${colors.reset}          http://$(hostname):${PORT}`);
  console.log(`\n${colors.bright}Serving files from:${colors.reset} ${DIST_DIR}`);
  console.log(`\nPress ${colors.bright}Ctrl+C${colors.reset} to stop\n`);
});

// Handle errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\n${colors.red}Error: Port ${PORT} is already in use${colors.reset}`);
    console.log(`Try a different port: PORT=8080 npm run preview\n`);
  } else {
    console.error(`\n${colors.red}Server error: ${error.message}${colors.reset}\n`);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n\nShutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
