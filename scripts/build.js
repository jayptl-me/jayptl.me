#!/usr/bin/env node

/**
 * Build Script - Production Build Pipeline
 * 
 * This script handles:
 * - Copying source files to dist directory
 * - Preparing files for optimization
 * - Creating production-ready file structure
 * 
 * @author Jay Patel
 */

const fs = require('fs').promises;
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[OK]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`)
};

// Build configuration
const config = {
  sourceDir: process.cwd(),
  distDir: path.join(process.cwd(), 'dist'),

  // Files and directories to copy
  include: [
    '*.html',
    'css/**/*',
    'js/**/*',
    'assets/**/*',
    'markdown/**/*',
    'robots.txt',
    'humans.txt',
    'sitemap.xml',
    'site.webmanifest',
    'llms.txt',
    'openapi.json',
    '.htaccess'
  ],

  // Files and directories to exclude
  exclude: [
    'node_modules',
    'scripts',
    'dist',
    '.git',
    '.gitignore',
    'package.json',
    'package-lock.json',
    'README.md',
    'LICENSE'
  ]
};

/**
 * Check if a path should be excluded
 */
function shouldExclude(filePath) {
  return config.exclude.some(pattern => {
    return filePath.includes(pattern);
  });
}

/**
 * Recursively copy directory
 */
async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (shouldExclude(srcPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Copy specific files matching patterns
 */
async function copyFiles() {
  log.info('Copying files to dist directory...');

  const filesToCopy = [
    { src: 'index.html', dest: 'dist/index.html' },
    { src: 'robots.txt', dest: 'dist/robots.txt' },
    { src: 'humans.txt', dest: 'dist/humans.txt' },
    { src: 'sitemap.xml', dest: 'dist/sitemap.xml' },
    { src: 'site.webmanifest', dest: 'dist/site.webmanifest' },
    { src: 'security.txt', dest: 'dist/security.txt' },
    { src: 'llms.txt', dest: 'dist/llms.txt' },
    { src: 'openapi.json', dest: 'dist/openapi.json' },
    { src: 'CNAME', dest: 'dist/CNAME' },
    { src: '.nojekyll', dest: 'dist/.nojekyll' },
    { src: '_headers', dest: 'dist/_headers' },
    { src: '_redirects', dest: 'dist/_redirects' }
  ];

  // Copy individual files
  for (const { src, dest } of filesToCopy) {
    try {
      await fs.copyFile(src, dest);
      log.success(`Copied ${src}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        log.warn(`Could not copy ${src}: ${error.message}`);
      }
    }
  }

  // Copy directories
  const dirsToCopy = [
    { src: 'css', dest: 'dist/css' },
    { src: 'js', dest: 'dist/js' },
    { src: 'assets', dest: 'dist/assets' },
    { src: 'pages', dest: 'dist/pages' },
    // Markdown companions mirror the dist layout (index.md, pages/about.md, ...)
    // so scripts/server.js can negotiate Accept: text/markdown per page.
    { src: 'markdown', dest: 'dist' },
    { src: '.well-known', dest: 'dist/.well-known' }
  ];

  for (const { src, dest } of dirsToCopy) {
    try {
      await copyDir(src, dest);
      log.success(`Copied ${src}/ directory`);
    } catch (error) {
      log.warn(`Could not copy ${src}: ${error.message}`);
    }
  }
}

/**
 * Copy error pages to root for direct access
 */
async function copyErrorPages() {
  log.info('Copying error pages to root...');

  const errorPages = [
    { source: 'pages/404.html', dest: '404.html' },
    { source: 'pages/500.html', dest: '500.html' }
  ];

  for (const { source, dest } of errorPages) {
    try {
      const sourceFile = path.join(config.distDir, source);
      const destFile = path.join(config.distDir, dest);
      await fs.copyFile(sourceFile, destFile);
      log.success(`Copied ${source} to /${dest}`);
    } catch (error) {
      log.warn(`Could not copy error page ${dest}: ${error.message}`);
    }
  }
}

/**
 * Create .htaccess file for Apache configuration
 */
async function createHtaccess() {
  const htaccessContent = `# Apache Configuration for Production

  # Enable Rewrite Engine
  <IfModule mod_rewrite.c>
    RewriteEngine On

    # Force HTTPS
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

    # Markdown content negotiation (acceptmarkdown.com) — serve the .md
    # companion when the client's Accept header prefers text/markdown.
    # Primary implementation is scripts/server.js; these rules give the
    # Apache fallback host the same behavior.
    RewriteCond %{HTTP:Accept} text/markdown
    RewriteRule ^$ index.md [T=text/markdown; charset=utf-8,L]
    RewriteCond %{HTTP:Accept} text/markdown
    RewriteRule ^about$ pages/about.md [T=text/markdown; charset=utf-8,L]
    RewriteCond %{HTTP:Accept} text/markdown
    RewriteRule ^privacy$ pages/privacy.md [T=text/markdown; charset=utf-8,L]
    RewriteCond %{HTTP:Accept} text/markdown
    RewriteRule ^projects$ pages/projects/index.md [T=text/markdown; charset=utf-8,L]
    RewriteCond %{HTTP:Accept} text/markdown
    RewriteRule ^projects/aviz-health$ pages/projects/aviz-health.md [T=text/markdown; charset=utf-8,L]
    RewriteCond %{HTTP:Accept} text/markdown
    RewriteRule ^projects/swalook$ pages/projects/swalook.md [T=text/markdown; charset=utf-8,L]
    RewriteCond %{HTTP:Accept} text/markdown
    RewriteRule ^projects/genuinest$ pages/projects/genuinest.md [T=text/markdown; charset=utf-8,L]
    RewriteCond %{HTTP:Accept} text/markdown
    RewriteRule ^projects/vini-tini$ pages/projects/vini-tini.md [T=text/markdown; charset=utf-8,L]

    # Clean URLs - Rewrite to pages folder
    RewriteRule ^about$ /pages/about.html [L]
  RewriteRule ^privacy$ /pages/privacy.html [L]
  RewriteRule ^design-system$ /pages/design-system.html [L]
  RewriteRule ^projects$ /pages/projects/index.html [L]
  RewriteRule ^projects/aviz-health$ /pages/projects/aviz-health.html [L]
  RewriteRule ^projects/swalook$ /pages/projects/swalook.html [L]
  RewriteRule ^projects/genuinest$ /pages/projects/genuinest.html [L]
  RewriteRule ^projects/vini-tini$ /pages/projects/vini-tini.html [L]
  
  # Legacy redirects
  RewriteRule ^about\\.html$ /pages/about.html [R=301,L]
  RewriteRule ^privacy\\.html$ /pages/privacy.html [R=301,L]
  RewriteRule ^projects\\.html$ /pages/projects/index.html [R=301,L]
</IfModule>

# Enable GZIP Compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json application/xml
</IfModule>

# Browser Caching
<IfModule mod_expires.c>
  ExpiresActive On
  
  # HTML - 1 hour
  ExpiresByType text/html "access plus 1 hour"
  
  # CSS and JavaScript - 1 year
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType text/javascript "access plus 1 year"
  
  # Images - 1 year
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/gif "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
  ExpiresByType image/webp "access plus 1 year"
  ExpiresByType image/x-icon "access plus 1 year"
  
  # Fonts - 1 year
  ExpiresByType font/woff2 "access plus 1 year"
  ExpiresByType font/woff "access plus 1 year"
  ExpiresByType font/ttf "access plus 1 year"
  
  # Manifests - 1 week
  ExpiresByType application/manifest+json "access plus 1 week"
  
  # XML - 1 day
  ExpiresByType application/xml "access plus 1 day"
  ExpiresByType text/xml "access plus 1 day"
</IfModule>

# Cache-Control Headers
<IfModule mod_headers.c>
  # Negotiated representations vary by Accept — tell caches to key on it
  <FilesMatch "\\.(html|md)$">
    Header set Vary "Accept, Accept-Encoding"
  </FilesMatch>

  # Cache static assets for 1 year
  <FilesMatch "\\.(css|js|jpg|jpeg|png|gif|svg|webp|woff|woff2|ttf|ico)$">
    Header set Cache-Control "max-age=31536000, public, immutable"
  </FilesMatch>
  
  # Cache HTML for 1 hour
  <FilesMatch "\\.(html|htm)$">
    Header set Cache-Control "max-age=3600, public, must-revalidate"
  </FilesMatch>
  
  # Security Headers
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "DENY"
  Header always set X-XSS-Protection "1; mode=block"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Permissions-Policy "geolocation=(), microphone=(), camera=()"
  
  # HSTS (1 year)
  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
  
  # CSP
  Header always set Content-Security-Policy "default-src 'self'; script-src 'self' https://www.googletagmanager.com https://static.cloudflareinsights.com 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; upgrade-insecure-requests"
</IfModule>

# Error Pages
ErrorDocument 404 /pages/404.html
ErrorDocument 500 /pages/500.html

# Disable Directory Browsing
Options -Indexes
`;

  await fs.writeFile(path.join(config.distDir, '.htaccess'), htaccessContent);
  log.success('Created .htaccess file');
}

/**
 * Create build info file
 */
async function createBuildInfo() {
  const buildInfo = {
    version: '1.0.0',
    buildDate: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform
  };

  await fs.writeFile(
    path.join(config.distDir, 'build-info.json'),
    JSON.stringify(buildInfo, null, 2)
  );

  log.success('Created build-info.json');
}

/**
 * Generate llms-full.txt (llmstxt.org "full" variant)
 *
 * Concatenates every markdown companion into one document so agents can
 * ingest the whole site in a single request. Source order: homepage,
 * about, projects index, case studies, privacy.
 */
async function createLlmsFull() {
  log.info('Generating llms-full.txt...');

  const documents = [
    'index.md',
    'pages/about.md',
    'pages/projects/index.md',
    'pages/projects/aviz-health.md',
    'pages/projects/swalook.md',
    'pages/projects/genuinest.md',
    'pages/projects/vini-tini.md',
    'pages/privacy.md'
  ];

  const sections = [];
  for (const doc of documents) {
    try {
      const content = await fs.readFile(path.join(config.distDir, doc), 'utf8');
      const body = content.replace(/\s+$/, '');
      const url = doc === 'index.md'
        ? 'https://jayptl.me/'
        : `https://jayptl.me/${doc.replace(/^pages\//, '').replace(/\.md$/, '').replace(/^projects\/index$/, 'projects')}`;
      sections.push(`<!-- source: ${url} -->\n\n${body}`);
    } catch (error) {
      log.warn(`llms-full.txt: missing markdown companion ${doc}: ${error.message}`);
    }
  }

  if (sections.length === 0) {
    throw new Error('llms-full.txt: no markdown companions found. Aborting.');
  }

  await fs.writeFile(
    path.join(config.distDir, 'llms-full.txt'),
    sections.join('\n\n---\n\n') + '\n'
  );
  log.success(`Generated llms-full.txt (${sections.length} documents)`);
}

/**
 * Main build function
 */
async function build() {
  const startTime = Date.now();

  console.log(`\n${colors.bright}Starting Production Build${colors.reset}\n`);

  try {
    // Create dist directory
    log.info('Creating dist directory...');
    await fs.mkdir(config.distDir, { recursive: true });
    log.success('Created dist directory');

    // Copy files
    await copyFiles();

    // Note: Clean URL structure handled by server rewrites (_redirects, .htaccess)
    // This avoids duplicate content in /pages/ and /about/ directories

    // Copy error pages to root for direct access
    await copyErrorPages();

    // Create .htaccess
    await createHtaccess();

    // Generate llms-full.txt from the markdown companions copied above
    await createLlmsFull();

    // Create build info
    await createBuildInfo();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n${colors.green}${colors.bright}Build completed successfully in ${duration}s${colors.reset}\n`);

  } catch (error) {
    log.error(`Build failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run build if this is the main module
if (require.main === module) {
  build();
}

module.exports = { build };
