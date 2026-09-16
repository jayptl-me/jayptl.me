#!/usr/bin/env node

/**
 * Optimize Script - Asset Optimization Pipeline
 * 
 * This script handles:
 * - Minifying CSS files
 * - Minifying JavaScript files
 * - Minifying HTML files
 * - Optimizing images (optional)
 * 
 * Addresses PageSpeed Insights recommendations:
 * - Minify CSS (Est savings of 3 KiB)
 * - Minify JavaScript (Est savings of 7 KiB)
 * 
 * @author Jay Patel
 */

const fs = require('fs').promises;
const path = require('path');
const { minify: minifyJS } = require('terser');
const postcss = require('postcss');
const cssnano = require('cssnano');
const { minify: minifyHTML } = require('html-minifier-terser');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[OK]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  stat: (msg) => console.log(`${colors.cyan}  ${msg}${colors.reset}`)
};

const config = {
  distDir: path.join(process.cwd(), 'dist'),
  stats: {
    css: { original: 0, minified: 0, saved: 0, files: 0 },
    js: { original: 0, minified: 0, saved: 0, files: 0 },
    html: { original: 0, minified: 0, saved: 0, files: 0 }
  }
};

/**
 * Get all files recursively matching extension
 */
async function getFiles(dir, ext) {
  const files = [];
  
  async function scan(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.name.endsWith(ext)) {
        files.push(fullPath);
      }
    }
  }
  
  await scan(dir);
  return files;
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Calculate percentage saved
 */
function calcPercentage(original, saved) {
  if (original === 0) return '0.00';
  return ((saved / original) * 100).toFixed(2);
}

/**
 * Minify CSS files
 */
async function minifyCSS() {
  log.info('Minifying CSS files...');
  
  const cssFiles = await getFiles(path.join(config.distDir, 'css'), '.css');
  
  for (const file of cssFiles) {
    try {
      const original = await fs.readFile(file, 'utf8');
      const originalSize = Buffer.byteLength(original, 'utf8');
      
      const result = await postcss([
        cssnano({
          preset: ['default', {
            discardComments: { removeAll: true },
            normalizeWhitespace: true,
            colormin: true,
            minifyFontValues: true,
            minifySelectors: true
          }]
        })
      ]).process(original, { from: file, to: file });
      
      await fs.writeFile(file, result.css);
      
      const minifiedSize = Buffer.byteLength(result.css, 'utf8');
      const saved = originalSize - minifiedSize;
      
      config.stats.css.original += originalSize;
      config.stats.css.minified += minifiedSize;
      config.stats.css.saved += saved;
      config.stats.css.files++;
      
      const fileName = path.relative(config.distDir, file);
      log.success(`Minified ${fileName} (saved ${formatBytes(saved)})`);
      
    } catch (error) {
      log.error(`Failed to minify ${file}: ${error.message}`);
    }
  }
}

/**
 * Minify JavaScript files
 */
async function minifyJavaScript() {
  log.info('Minifying JavaScript files...');
  
  const jsFiles = await getFiles(path.join(config.distDir, 'js'), '.js');
  
  for (const file of jsFiles) {
    try {
      const original = await fs.readFile(file, 'utf8');
      const originalSize = Buffer.byteLength(original, 'utf8');
      
      const result = await minifyJS(original, {
        compress: {
          dead_code: true,
          drop_console: false, // Keep console for analytics
          drop_debugger: true,
          pure_funcs: ['console.debug'],
          passes: 2
        },
        mangle: {
          safari10: true
        },
        format: {
          comments: false
        },
        sourceMap: false
      });
      
      await fs.writeFile(file, result.code);
      
      const minifiedSize = Buffer.byteLength(result.code, 'utf8');
      const saved = originalSize - minifiedSize;
      
      config.stats.js.original += originalSize;
      config.stats.js.minified += minifiedSize;
      config.stats.js.saved += saved;
      config.stats.js.files++;
      
      const fileName = path.relative(config.distDir, file);
      log.success(`Minified ${fileName} (saved ${formatBytes(saved)})`);
      
    } catch (error) {
      log.error(`Failed to minify ${file}: ${error.message}`);
    }
  }
}

/**
 * Minify HTML files
 */
async function minifyHTMLFiles() {
  log.info('Minifying HTML files...');
  
  const htmlFiles = await getFiles(config.distDir, '.html');
  
  const minifyOptions = {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    useShortDoctype: false, // Keep full DOCTYPE for validation
    minifyCSS: true,
    minifyJS: true,
    minifyURLs: true,
    keepClosingSlash: true,
    preserveLineBreaks: false
  };
  
  for (const file of htmlFiles) {
    try {
      const original = await fs.readFile(file, 'utf8');
      const originalSize = Buffer.byteLength(original, 'utf8');
      
      const minified = await minifyHTML(original, minifyOptions);
      
      await fs.writeFile(file, minified);
      
      const minifiedSize = Buffer.byteLength(minified, 'utf8');
      const saved = originalSize - minifiedSize;
      
      config.stats.html.original += originalSize;
      config.stats.html.minified += minifiedSize;
      config.stats.html.saved += saved;
      config.stats.html.files++;
      
      const fileName = path.relative(config.distDir, file);
      log.success(`Minified ${fileName} (saved ${formatBytes(saved)})`);
      
    } catch (error) {
      log.error(`Failed to minify ${file}: ${error.message}`);
    }
  }
}

/**
 * Print optimization statistics
 */
function printStats() {
  console.log(`\n${colors.bright}Optimization Statistics${colors.reset}\n`);
  
  const types = ['CSS', 'JavaScript', 'HTML'];
  const keys = ['css', 'js', 'html'];
  
  types.forEach((type, i) => {
    const stat = config.stats[keys[i]];
    if (stat.files > 0) {
      console.log(`${colors.cyan}${type}:${colors.reset}`);
      log.stat(`Files processed: ${stat.files}`);
      log.stat(`Original size: ${formatBytes(stat.original)}`);
      log.stat(`Minified size: ${formatBytes(stat.minified)}`);
      log.stat(`Saved: ${formatBytes(stat.saved)} (${calcPercentage(stat.original, stat.saved)}%)`);
      console.log('');
    }
  });
  
  // Total stats
  const totalOriginal = config.stats.css.original + config.stats.js.original + config.stats.html.original;
  const totalSaved = config.stats.css.saved + config.stats.js.saved + config.stats.html.saved;
  const totalFiles = config.stats.css.files + config.stats.js.files + config.stats.html.files;
  
  console.log(`${colors.bright}Total:${colors.reset}`);
  log.stat(`Files processed: ${totalFiles}`);
  log.stat(`Total saved: ${formatBytes(totalSaved)} (${calcPercentage(totalOriginal, totalSaved)}%)`);
}

/**
 * Main optimization function
 */
async function optimize() {
  const startTime = Date.now();
  
  console.log(`\n${colors.bright}Starting Asset Optimization${colors.reset}\n`);
  
  try {
    // Check if dist directory exists
    try {
      await fs.access(config.distDir);
    } catch {
      log.error('dist directory not found. Run "npm run build" first.');
      process.exit(1);
    }
    
    // Minify CSS
    await minifyCSS();
    console.log('');
    
    // Minify JavaScript
    await minifyJavaScript();
    console.log('');
    
    // Minify HTML
    await minifyHTMLFiles();
    
    // Print statistics
    printStats();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n${colors.green}${colors.bright}Optimization completed successfully in ${duration}s${colors.reset}\n`);
    
  } catch (error) {
    log.error(`Optimization failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run optimization if this is the main module
if (require.main === module) {
  optimize();
}

module.exports = { optimize };
