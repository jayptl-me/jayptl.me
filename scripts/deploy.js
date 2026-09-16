#!/usr/bin/env node

/**
 * Deploy Script - Production Deployment
 * 
 * This script handles deployment to various platforms:
 * - GitHub Pages
 * - Netlify
 * - Vercel
 * - FTP/SFTP
 * - Custom server via rsync
 * 
 * @author Jay Patel
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

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
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`)
};

const config = {
  distDir: path.join(process.cwd(), 'dist'),
  deploymentType: process.env.DEPLOY_TYPE || 'manual'
};

/**
 * Check if dist directory exists
 */
async function checkDistDirectory() {
  try {
    await fs.access(config.distDir);
    log.success('Found dist directory');
    return true;
  } catch {
    log.error('dist directory not found. Run "npm run deploy:prepare" first.');
    return false;
  }
}

/**
 * Deploy to GitHub Pages
 */
function deployToGitHubPages() {
  log.info('Deploying to GitHub Pages...');
  
  try {
    // Check if gh-pages branch exists
    try {
      execSync('git rev-parse --verify gh-pages', { stdio: 'ignore' });
    } catch {
      log.info('Creating gh-pages branch...');
      execSync('git checkout --orphan gh-pages', { stdio: 'inherit' });
      execSync('git rm -rf .', { stdio: 'ignore' });
      execSync('git commit --allow-empty -m "Initial gh-pages commit"', { stdio: 'ignore' });
      execSync('git checkout main', { stdio: 'ignore' });
    }
    
    // Deploy using subtree
    log.info('Pushing to gh-pages branch...');
    execSync('git subtree push --prefix dist origin gh-pages', { stdio: 'inherit' });
    
    log.success('Successfully deployed to GitHub Pages!');
    console.log(`\n${colors.cyan}Your site will be available at:${colors.reset}`);
    console.log(`${colors.bright}https://jayptl-me.github.io/jayptl.me/${colors.reset}\n`);
    
  } catch (error) {
    log.error(`GitHub Pages deployment failed: ${error.message}`);
    throw error;
  }
}

/**
 * Deploy to Netlify
 */
function deployToNetlify() {
  log.info('Deploying to Netlify...');
  
  try {
    // Check if Netlify CLI is installed
    try {
      execSync('netlify --version', { stdio: 'ignore' });
    } catch {
      log.error('Netlify CLI not installed. Run: npm install -g netlify-cli');
      throw new Error('Netlify CLI not found');
    }
    
    // Deploy
    log.info('Running Netlify deploy...');
    execSync('netlify deploy --prod --dir=dist', { stdio: 'inherit' });
    
    log.success('Successfully deployed to Netlify!');
    
  } catch (error) {
    log.error(`Netlify deployment failed: ${error.message}`);
    throw error;
  }
}

/**
 * Deploy to Vercel
 */
function deployToVercel() {
  log.info('Deploying to Vercel...');
  
  try {
    // Check if Vercel CLI is installed
    try {
      execSync('vercel --version', { stdio: 'ignore' });
    } catch {
      log.error('Vercel CLI not installed. Run: npm install -g vercel');
      throw new Error('Vercel CLI not found');
    }
    
    // Deploy
    log.info('Running Vercel deploy...');
    execSync('vercel --prod dist', { stdio: 'inherit' });
    
    log.success('Successfully deployed to Vercel!');
    
  } catch (error) {
    log.error(`Vercel deployment failed: ${error.message}`);
    throw error;
  }
}

/**
 * Deploy via rsync (custom server)
 */
function deployViaRsync() {
  log.info('Deploying via rsync...');
  
  const SERVER = process.env.DEPLOY_SERVER;
  const USER = process.env.DEPLOY_USER;
  const PATH = process.env.DEPLOY_PATH;
  
  if (!SERVER || !USER || !PATH) {
    log.error('Missing rsync configuration. Set DEPLOY_SERVER, DEPLOY_USER, and DEPLOY_PATH environment variables.');
    throw new Error('Missing rsync configuration');
  }
  
  try {
    const command = `rsync -avz --delete dist/ ${USER}@${SERVER}:${PATH}`;
    log.info(`Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
    
    log.success('Successfully deployed via rsync!');
    
  } catch (error) {
    log.error(`rsync deployment failed: ${error.message}`);
    throw error;
  }
}

/**
 * Show manual deployment instructions
 */
function showManualInstructions() {
  console.log(`\n${colors.bright}Manual Deployment Instructions${colors.reset}\n`);
  
  console.log(`Your production files are ready in the ${colors.cyan}dist/${colors.reset} directory.\n`);
  
  console.log(`${colors.bright}Deployment Options:${colors.reset}\n`);
  
  console.log(`${colors.cyan}1. GitHub Pages:${colors.reset}`);
  console.log(`   DEPLOY_TYPE=github npm run deploy\n`);
  
  console.log(`${colors.cyan}2. Netlify:${colors.reset}`);
  console.log(`   DEPLOY_TYPE=netlify npm run deploy`);
  console.log(`   Or drag and drop the dist/ folder to: https://app.netlify.com/drop\n`);
  
  console.log(`${colors.cyan}3. Vercel:${colors.reset}`);
  console.log(`   DEPLOY_TYPE=vercel npm run deploy`);
  console.log(`   Or run: vercel dist --prod\n`);
  
  console.log(`${colors.cyan}4. FTP/SFTP:${colors.reset}`);
  console.log(`   Upload the contents of dist/ to your web server's public directory\n`);
  
  console.log(`${colors.cyan}5. Custom Server (rsync):${colors.reset}`);
  console.log(`   Set environment variables:`);
  console.log(`   export DEPLOY_SERVER=your-server.com`);
  console.log(`   export DEPLOY_USER=your-username`);
  console.log(`   export DEPLOY_PATH=/path/to/webroot`);
  console.log(`   Then run: DEPLOY_TYPE=rsync npm run deploy\n`);
}

/**
 * Main deployment function
 */
async function deploy() {
  const startTime = Date.now();
  
  console.log(`\n${colors.bright}Starting Deployment${colors.reset}\n`);
  
  try {
    // Check dist directory
    const distExists = await checkDistDirectory();
    if (!distExists) {
      process.exit(1);
    }
    
    // Deploy based on type
    switch (config.deploymentType.toLowerCase()) {
      case 'github':
      case 'gh-pages':
        deployToGitHubPages();
        break;
        
      case 'netlify':
        deployToNetlify();
        break;
        
      case 'vercel':
        deployToVercel();
        break;
        
      case 'rsync':
        deployViaRsync();
        break;
        
      case 'manual':
      default:
        showManualInstructions();
        break;
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n${colors.green}${colors.bright}Deployment process completed in ${duration}s${colors.reset}\n`);
    
  } catch (error) {
    log.error(`Deployment failed: ${error.message}`);
    process.exit(1);
  }
}

// Run deployment if this is the main module
if (require.main === module) {
  deploy();
}

module.exports = { deploy };
