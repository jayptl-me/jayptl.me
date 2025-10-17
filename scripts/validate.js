#!/usr/bin/env node

/**
 * Validate Script - Pre-deployment Validation
 * 
 * This script validates:
 * - Required files exist
 * - HTML structure
 * - robots.txt format
 * - Sitemap XML
 * - Meta tags and SEO
 * 
 * @author Jay Patel
 */

const fs = require('fs').promises;
const path = require('path');

// ANSI color codes
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

const config = {
  distDir: path.join(process.cwd(), 'dist'),
  errors: [],
  warnings: []
};

/**
 * Check if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate required files
 */
async function validateRequiredFiles() {
  log.info('Validating required files...');
  
  const requiredFiles = [
    'index.html',
    '404.html',
    'robots.txt',
    'sitemap.xml',
    'site.webmanifest',
    '.htaccess'
  ];
  
  for (const file of requiredFiles) {
    const filePath = path.join(config.distDir, file);
    const exists = await fileExists(filePath);
    
    if (exists) {
      log.success(`Found ${file}`);
    } else {
      config.errors.push(`Missing required file: ${file}`);
      log.error(`Missing ${file}`);
    }
  }
}

/**
 * Validate HTML files
 */
async function validateHTML() {
  log.info('Validating HTML files...');
  
  const htmlFiles = ['index.html', 'about.html', 'privacy.html', '404.html'];
  
  for (const file of htmlFiles) {
    const filePath = path.join(config.distDir, file);
    
    if (await fileExists(filePath)) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        
        // Basic HTML validation
        if (!content.includes('<!DOCTYPE html>')) {
          config.warnings.push(`${file}: Missing DOCTYPE declaration`);
          log.warn(`${file}: Missing DOCTYPE`);
        }
        
        if (!content.includes('<html')) {
          config.errors.push(`${file}: Missing <html> tag`);
          log.error(`${file}: Missing <html> tag`);
        }
        
        if (!content.includes('<head>')) {
          config.errors.push(`${file}: Missing <head> tag`);
          log.error(`${file}: Missing <head> tag`);
        }
        
        if (!content.includes('<body')) {
          config.errors.push(`${file}: Missing <body> tag`);
          log.error(`${file}: Missing <body> tag`);
        }
        
        // SEO validation
        if (!content.includes('<title>')) {
          config.warnings.push(`${file}: Missing <title> tag`);
          log.warn(`${file}: Missing <title> tag`);
        }
        
        if (!content.includes('name="description"')) {
          config.warnings.push(`${file}: Missing meta description`);
          log.warn(`${file}: Missing meta description`);
        }
        
        if (!content.includes('og:')) {
          config.warnings.push(`${file}: Missing Open Graph tags`);
          log.warn(`${file}: Missing Open Graph tags`);
        }
        
        if (content.includes('<html') && !content.includes('lang=')) {
          config.warnings.push(`${file}: Missing lang attribute on <html>`);
          log.warn(`${file}: Missing lang attribute`);
        }
        
        log.success(`Validated ${file}`);
        
      } catch (error) {
        config.errors.push(`${file}: Failed to read file`);
        log.error(`Failed to read ${file}`);
      }
    }
  }
}

/**
 * Validate robots.txt
 */
async function validateRobotsTxt() {
  log.info('Validating robots.txt...');
  
  const robotsPath = path.join(config.distDir, 'robots.txt');
  
  if (await fileExists(robotsPath)) {
    try {
      const content = await fs.readFile(robotsPath, 'utf8');
      
      if (!content.includes('User-agent:')) {
        config.errors.push('robots.txt: Missing User-agent directive');
        log.error('robots.txt: Missing User-agent directive');
      } else {
        log.success('robots.txt: Has User-agent directive');
      }
      
      if (!content.includes('Sitemap:')) {
        config.warnings.push('robots.txt: Missing Sitemap reference');
        log.warn('robots.txt: Missing Sitemap reference');
      } else {
        log.success('robots.txt: Has Sitemap reference');
      }
      
      // Check for correct sitemap URL
      if (content.includes('Sitemap:') && !content.includes('https://')) {
        config.warnings.push('robots.txt: Sitemap URL should use HTTPS');
        log.warn('robots.txt: Sitemap URL should use HTTPS');
      }
      
    } catch (error) {
      config.errors.push('robots.txt: Failed to read file');
      log.error('Failed to read robots.txt');
    }
  }
}

/**
 * Validate sitemap.xml
 */
async function validateSitemap() {
  log.info('Validating sitemap.xml...');
  
  const sitemapPath = path.join(config.distDir, 'sitemap.xml');
  
  if (await fileExists(sitemapPath)) {
    try {
      const content = await fs.readFile(sitemapPath, 'utf8');
      
      if (!content.includes('<?xml')) {
        config.errors.push('sitemap.xml: Missing XML declaration');
        log.error('sitemap.xml: Missing XML declaration');
      }
      
      if (!content.includes('<urlset')) {
        config.errors.push('sitemap.xml: Missing <urlset> tag');
        log.error('sitemap.xml: Missing <urlset> tag');
      } else {
        log.success('sitemap.xml: Has <urlset> tag');
      }
      
      if (!content.includes('<url>')) {
        config.warnings.push('sitemap.xml: No URLs found');
        log.warn('sitemap.xml: No URLs found');
      } else {
        log.success('sitemap.xml: Has URLs');
      }
      
      if (!content.includes('<loc>')) {
        config.warnings.push('sitemap.xml: No <loc> tags found');
        log.warn('sitemap.xml: No <loc> tags found');
      }
      
    } catch (error) {
      config.errors.push('sitemap.xml: Failed to read file');
      log.error('Failed to read sitemap.xml');
    }
  }
}

/**
 * Validate assets structure
 */
async function validateAssets() {
  log.info('Validating assets structure...');
  
  const requiredDirs = ['css', 'js', 'assets'];
  
  for (const dir of requiredDirs) {
    const dirPath = path.join(config.distDir, dir);
    const exists = await fileExists(dirPath);
    
    if (exists) {
      log.success(`Found ${dir}/ directory`);
    } else {
      config.warnings.push(`Missing ${dir}/ directory`);
      log.warn(`Missing ${dir}/ directory`);
    }
  }
}

/**
 * Print validation summary
 */
function printSummary() {
  console.log(`\n${colors.bright}Validation Summary${colors.reset}\n`);
  
  if (config.errors.length === 0 && config.warnings.length === 0) {
    log.success('All validation checks passed!');
  } else {
    if (config.errors.length > 0) {
      console.log(`${colors.red}${colors.bright}Errors (${config.errors.length}):${colors.reset}`);
      config.errors.forEach(error => console.log(`  ${colors.red}[ERROR]${colors.reset} ${error}`));
      console.log('');
    }
    
    if (config.warnings.length > 0) {
      console.log(`${colors.yellow}${colors.bright}Warnings (${config.warnings.length}):${colors.reset}`);
      config.warnings.forEach(warning => console.log(`  ${colors.yellow}[WARN]${colors.reset} ${warning}`));
      console.log('');
    }
  }
  
  if (config.errors.length > 0) {
    console.log(`${colors.red}${colors.bright}❌ Validation failed - please fix errors before deploying${colors.reset}\n`);
    return false;
  } else if (config.warnings.length > 0) {
    console.log(`${colors.yellow}${colors.bright}Validation passed with warnings - review before deploying${colors.reset}\n`);
    return true;
  } else {
    console.log(`${colors.green}${colors.bright}Validation passed - ready to deploy${colors.reset}\n`);
    return true;
  }
}

/**
 * Main validation function
 */
async function validate() {
  const startTime = Date.now();
  
  console.log(`\n${colors.bright}Starting Pre-deployment Validation${colors.reset}\n`);
  
  try {
    // Check if dist directory exists
    try {
      await fs.access(config.distDir);
    } catch {
      log.error('dist directory not found. Run "npm run build" first.');
      process.exit(1);
    }
    
    // Run validations
    await validateRequiredFiles();
    console.log('');
    
    await validateHTML();
    console.log('');
    
    await validateRobotsTxt();
    console.log('');
    
    await validateSitemap();
    console.log('');
    
    await validateAssets();
    
    // Print summary
    const passed = printSummary();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Validation completed in ${duration}s\n`);
    
    // Exit with appropriate code
    if (!passed && config.errors.length > 0) {
      process.exit(1);
    }
    
  } catch (error) {
    log.error(`Validation failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run validation if this is the main module
if (require.main === module) {
  validate();
}

module.exports = { validate };
