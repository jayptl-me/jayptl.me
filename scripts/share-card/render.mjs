// Renders scripts/share-card/card.html to assets/share-card.png (1200 x 630).
// Run on a build box that has Playwright Chromium, never on the owner's Mac:
//   node scripts/share-card/render.mjs
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const out = process.argv[2] || path.join(root, 'assets', 'share-card.png');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(here, 'card.html')).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, type: 'png' });
  console.log(`share-card: wrote ${out}`);
} finally {
  await browser.close();
}
