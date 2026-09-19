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
    { src: 'googlee57e004af9024243.html', dest: 'dist/googlee57e004af9024243.html' },
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
    RewriteRule ^resume$ pages/resume.md [T=text/markdown; charset=utf-8,L]
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
  RewriteRule ^resume$ /pages/resume.html [L]
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
  Header always set Content-Security-Policy "default-src 'self'; script-src 'self' https://www.googletagmanager.com https://static.cloudflareinsights.com 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; upgrade-insecure-requests"
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
    'pages/resume.md',
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
 * Generate clean URL directories and static route files
 *
 * For every page in pages/ (e.g. pages/about.html, pages/projects/aviz-health.html):
 * - Creates dist/<route>/index.html (e.g. dist/about/index.html)
 * - Creates dist/<route>.html (e.g. dist/about.html)
 * - Keeps dist/pages/<file> for legacy / compatibility
 *
 * For markdown companions in markdown/pages/ (e.g. markdown/pages/about.md):
 * - Creates dist/<route>.md (e.g. dist/about.md)
 *
 * This allows Render (and any static host) to serve clean URLs natively
 * from static files without requiring server-side URL rewrites.
 */
async function generateCleanUrls() {
  log.info('Generating clean URL directory structure for static hosting...');

  async function processHtmlDir(dir, relDir = '') {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const subRel = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await processHtmlDir(fullPath, subRel);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        // Skip 404 and 500 error pages (handled separately)
        if (entry.name === '404.html' || entry.name === '500.html') {
          continue;
        }

        const sourceFile = fullPath;
        if (entry.name === 'index.html') {
          const destDir = path.join(config.distDir, relDir);
          await fs.mkdir(destDir, { recursive: true });
          await fs.copyFile(sourceFile, path.join(destDir, 'index.html'));
          log.success(`Generated /${relDir}/index.html`);
        } else {
          const slug = subRel.replace(/\.html$/, '');
          const targetDir = path.join(config.distDir, slug);
          await fs.mkdir(targetDir, { recursive: true });
          await fs.copyFile(sourceFile, path.join(targetDir, 'index.html'));
          await fs.copyFile(sourceFile, path.join(config.distDir, `${slug}.html`));
          log.success(`Generated /${slug}/index.html and /${slug}.html`);
        }
      }
    }
  }

  const pagesSrc = path.join(config.sourceDir, 'pages');
  await processHtmlDir(pagesSrc);

  // Copy markdown files to clean root URLs: dist/pages/*.md -> dist/*.md
  const mdSrc = path.join(config.sourceDir, 'markdown', 'pages');
  async function processMdDir(dir, relDir = '') {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const subRel = relDir ? `${relDir}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          await processMdDir(fullPath, subRel);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const cleanName = subRel === 'projects/index.md' ? 'projects.md' : subRel;
          const destPath = path.join(config.distDir, cleanName);
          await fs.mkdir(path.dirname(destPath), { recursive: true });
          await fs.copyFile(fullPath, destPath);
          log.success(`Generated clean markdown companion: /${cleanName}`);
        }
      }
    } catch (e) {
      if (e.code !== 'ENOENT') {
        log.warn(`Could not copy clean markdown companions: ${e.message}`);
      }
    }
  }
  await processMdDir(mdSrc);
}

/**
 * Main build function
 */
async function build() {
  const startTime = Date.now();

  console.log(`\n${colors.bright}Starting Production Build${colors.reset}\n`);

  try {
    // Deployment rule: every build starts from an empty dist directory.
    // Wiping here (not only in package.json prebuild) keeps ALL invocation
    // paths stale-proof: bun run build, bun/node scripts/build.js, deploy:prepare.
    log.info('Wiping dist directory for a clean build...');
    await fs.rm(config.distDir, { recursive: true, force: true });
    await fs.mkdir(config.distDir, { recursive: true });
    log.success('Created clean dist directory');

    // Copy files
    await copyFiles();

    // Generate physical clean URL directories (e.g. dist/about/index.html)
    // for native static hosting support on Render, Cloudflare Pages, etc.
    await generateCleanUrls();

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
