#!/usr/bin/env node
/**
 * Render the one-page resume PDFs served at /resumes/<track>.pdf.
 *
 * Run by hand after editing the resume sources, never from the deploy build:
 *   node scripts/render-resumes.js
 *
 * Sources: the sibling resume repo (../../jayptl-resume/one-pager/*.html),
 * or RESUME_SRC_DIR. A local headless browser prints each page to PDF, the
 * script checks every PDF is exactly one page, then writes it to
 * assets/resumes/<track>.pdf (and a copy back into the resume repo).
 * The static host only serves the finished files; nothing renders at runtime.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const SRC_REPO = process.env.RESUME_SRC_DIR
  ? path.resolve(process.env.RESUME_SRC_DIR)
  : path.resolve(ROOT, '../../jayptl-resume');
const SRC_DIR = path.join(SRC_REPO, 'one-pager');
const OUT_DIR = path.join(ROOT, 'assets/resumes');
const COPY_DIR = path.join(SRC_REPO, 'pdfs/one-pager');

// Public track name -> source file in the resume repo.
const TRACKS = {
  fde: 'jay-patel-fde.html',
  fullstack: 'jay-patel-fullstack.html',
  frontend: 'jay-patel-frontend.html',
  backend: 'jay-patel-backend.html',
  mobile: 'jay-patel-mobile.html',
  ai: 'jay-patel-ml.html',
  web3: 'jay-patel-web3.html',
};

const BROWSER_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

function findBrowser() {
  const hit = BROWSER_CANDIDATES.find((p) => fs.existsSync(p));
  if (!hit) {
    throw new Error('No headless browser found. Set CHROME_PATH to a Chromium-based browser binary.');
  }
  return hit;
}

/** Count pages by counting page objects in the PDF body. */
function pageCount(file) {
  const raw = fs.readFileSync(file, 'latin1');
  const matches = raw.match(/\/Type\s*\/Page(?!s)/g);
  return matches ? matches.length : 0;
}

/**
 * Print one page to PDF. Some headless builds finish writing the PDF but never
 * exit, so wait for the file to exist and stop growing, then end the process.
 */
function render(browser, srcFile, outFile) {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-render-'));
  fs.rmSync(outFile, { force: true });
  const child = spawn(browser, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${userDir}`,
    '--no-pdf-header-footer',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=4000',
    `--print-to-pdf=${outFile}`,
    pathToFileURL(srcFile).href,
  ], { stdio: 'ignore' });

  return new Promise((resolve, reject) => {
    let exited = false;
    let lastSize = -1;
    let stableTicks = 0;
    const started = Date.now();
    child.on('exit', () => { exited = true; });
    const timer = setInterval(() => {
      const size = fs.existsSync(outFile) ? fs.statSync(outFile).size : 0;
      stableTicks = size > 0 && size === lastSize ? stableTicks + 1 : 0;
      lastSize = size;
      const done = stableTicks >= 3 || (exited && size > 0);
      const timedOut = Date.now() - started > 90000;
      if (done || timedOut || (exited && size === 0)) {
        clearInterval(timer);
        const finish = () => {
          try {
            fs.rmSync(userDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
          } catch {
            // A leftover temp profile is harmless; the OS clears its temp dir.
          }
          if (size > 0) resolve();
          else reject(new Error(`no PDF written for ${path.basename(srcFile)}`));
        };
        if (exited) finish();
        else {
          child.once('exit', finish);
          child.kill('SIGKILL');
        }
      }
    }, 500);
  });
}

async function main() {
  const browser = findBrowser();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(COPY_DIR, { recursive: true });

  const only = process.argv.slice(2);
  const failures = [];

  for (const [track, file] of Object.entries(TRACKS)) {
    if (only.length && !only.includes(track)) continue;
    const src = path.join(SRC_DIR, file);
    if (!fs.existsSync(src)) {
      failures.push(`${track}: missing source ${src}`);
      continue;
    }
    const out = path.join(OUT_DIR, `${track}.pdf`);
    await render(browser, src, out);
    const pages = pageCount(out);
    const kb = Math.round(fs.statSync(out).size / 1024);
    fs.copyFileSync(out, path.join(COPY_DIR, file.replace(/\.html$/, '.pdf')));
    console.log(`${track.padEnd(10)} ${pages} page(s)  ${kb} KB  -> assets/resumes/${track}.pdf`);
    if (pages !== 1) failures.push(`${track}: ${pages} pages, expected 1`);
  }

  if (failures.length) {
    console.error(`\nFailed:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
