// Tests for the phase 2 content components: Stack Chip, Role Ledger,
// Tally Roll, Digit Odometer, Commit Field (and its snapshot script),
// Lab Folder, Change Feed, Sticker Peel and Ink Spark.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const require = createRequire(import.meta.url);

const GLOBALS = [
  'window', 'document', 'navigator', 'location', 'history', 'performance',
  'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle',
  'IntersectionObserver', 'MutationObserver', 'DOMParser', 'CustomEvent',
  'fetch', 'setTimeout', 'clearTimeout'
];

function makeWindow({ reduced = true } = {}) {
  const window = new Window({ url: 'https://jayptl.me/', innerWidth: 1280, innerHeight: 800 });
  window.matchMedia = (q) => ({
    matches: q.includes('reduce') ? reduced : q.includes('pointer: fine') || q.includes('hover: hover'),
    media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}
  });
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  window.cancelAnimationFrame = () => {};
  window.setTimeout = setTimeout;
  window.clearTimeout = clearTimeout;
  return { window, document: window.document };
}

function run(win, rel) {
  const fn = new Function(...GLOBALS, src(rel));
  fn(...GLOBALS.map((n) => {
    const v = win[n];
    return typeof v === 'function' && !/^[A-Z]/.test(n) ? v.bind(win) : v;
  }));
}

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

/* ---- Stack Chip ------------------------------------------------------- */

test('stack chip: project counts match the tags on the project cards', () => {
  const { window } = makeWindow();
  run(window, 'js/components/stack-chip.js');
  const html = src('pages/projects/index.html');
  // Features + Archive (2026-09-30): feature cards and archive rows both
  // carry .case-card-tags; status labels sit in the card or row kicker.
  // Count both, as the old tag row did.
  const cards = [...html.matchAll(/<article class="case-card[\s\S]*?<\/article>|<details class="role arch-row[\s\S]*?<\/details>/g)].map((m) => {
    const kicker = (m[0].match(/<(?:p|span) class="(?:case-card|arch)-kicker[^"]*">([^<]*)<\/(?:p|span)>/) || [, ''])[1].split(' · ');
    const tags = [...m[0].matchAll(/<li class="tag"(?: hidden)?>([^<]+)<\/li>/g)].map((t) => t[1].trim());
    return kicker.concat(tags).filter(Boolean);
  });
  assert.equal(cards.length, window.StackChip.total, 'TOTAL matches the number of project cards');
  for (const [name, spec] of Object.entries(window.StackChip.stack)) {
    const re = new RegExp(spec.match, 'i');
    const n = cards.filter((tags) => tags.some((t) => re.test(t))).length;
    assert.equal(spec.projects, n, `${name} is in ${n} projects`);
  }
});

test('stack chip: adds a glyph, and a described tooltip only when the count is real', () => {
  const { window, document } = makeWindow();
  run(window, 'js/components/mount.js');
  document.body.innerHTML = '<p><span data-stack="flutter">Flutter</span> and <span data-stack="typescript">TypeScript</span></p>';
  run(window, 'js/components/stack-chip.js');
  const flutter = document.querySelector('[data-stack="flutter"]');
  assert.ok(flutter.querySelector('svg.stack-chip-icon[aria-hidden="true"]'));
  const tip = document.getElementById(flutter.getAttribute('aria-describedby'));
  assert.match(tip.textContent, /In 11 of 31 projects/);
  assert.equal(flutter.getAttribute('tabindex'), '0');
  const ts = document.querySelector('[data-stack="typescript"]');
  assert.equal(ts.hasAttribute('aria-describedby'), false, 'no tooltip for a single project');
  assert.equal(ts.hasAttribute('tabindex'), false);
});

/* ---- Role Ledger ------------------------------------------------------ */

test('role ledger: closing fades first, then collapses', async () => {
  const { window, document } = makeWindow({ reduced: false });
  run(window, 'js/components/mount.js');
  document.body.innerHTML = '<div data-component="role-ledger"><details class="role" open><summary class="role-head">Role</summary><div class="role-body"><p>a</p><ul><li>b</li></ul></div></details></div>';
  run(window, 'js/components/role-ledger.js');
  const details = document.querySelector('details');
  document.querySelector('summary').click();
  assert.equal(details.open, true, 'still open during the fade');
  assert.ok(details.classList.contains('is-closing'));
  await tick(160);
  assert.equal(details.open, false);
  assert.equal(document.querySelector('.role-body ul li').style.getPropertyValue('--line'), '2');
});

/* ---- Tally Roll and Digit Odometer ------------------------------------ */

test('tally roll: reduced motion shows the final value, label always carries it', () => {
  const { window, document } = makeWindow();
  run(window, 'js/components/mount.js');
  document.body.innerHTML = '<span data-tally="5068">5,068</span><span data-tally="35" data-tally-suffix="+">35+</span>';
  run(window, 'js/components/tally-roll.js');
  const [a, b] = document.querySelectorAll('[data-tally]');
  assert.equal(a.textContent, '5,068');
  assert.equal(a.getAttribute('aria-label'), '5,068');
  assert.equal(b.textContent, '35+');
  assert.equal(window.SnapEase(0), 0);
  assert.equal(window.SnapEase(1), 1);
  assert.ok(window.SnapEase(0.25) > 0.7, 'snap curve front-loads the motion');
});

test('digit odometer: builds one reel per digit and labels the number', async () => {
  const { window, document } = makeWindow();
  document.body.innerHTML = '<span id="v" data-odometer></span>';
  run(window, 'js/components/digit-odometer.js');
  const el = document.getElementById('v');
  window.DigitOdometer.set(el, 12345);
  assert.equal(el.getAttribute('aria-label'), '12,345');
  assert.equal(el.querySelectorAll('.odo-col').length, 5);
  assert.equal(el.querySelectorAll('.odo-sep').length, 1);
  // The roll starts two animation frames later (each a zero-delay timer
  // here). Await one timer per frame, in order: a single 10ms wait could
  // fire between the two frames on a loaded machine (seen 2026-10-08).
  await tick(0);
  await tick(0);
  await tick(0);
  assert.equal(el.querySelectorAll('.odo-reel')[1].style.transform, 'translateY(-20%)');
});

/* ---- Commit Field ----------------------------------------------------- */

test('commit snapshot: parses counts and levels and computes streaks', () => {
  const { parse, streaks } = require(path.join(root, 'scripts/fetch-commits.js'));
  const html = [
    '<td data-date="2026-01-01" id="contribution-day-component-4-0" data-level="0"></td>',
    '<td data-date="2026-01-02" id="contribution-day-component-5-0" data-level="2"></td>',
    '<td data-date="2026-01-03" id="contribution-day-component-6-0" data-level="4"></td>',
    '<tool-tip for="contribution-day-component-4-0">No contributions on January 1st.</tool-tip>',
    '<tool-tip for="contribution-day-component-5-0">3 contributions on January 2nd.</tool-tip>',
    '<tool-tip for="contribution-day-component-6-0">1,204 contributions on January 3rd.</tool-tip>'
  ].join('');
  const days = parse(html);
  assert.deepEqual(days.map((d) => [d.date, d.count, d.level]), [
    ['2026-01-01', 0, 0], ['2026-01-02', 3, 2], ['2026-01-03', 1204, 4]
  ]);
  assert.deepEqual(streaks(days), { longest: 2, current: 2 });
});

test('commit field: renders stats, one cell per day and a readable readout', async () => {
  const { window, document } = makeWindow();
  const data = { from: '2026-01-04', total: 12, longestStreak: 2, currentStreak: 1, days: [[0, 0], [5, 2], [7, 3], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]] };
  window.fetch = async () => ({ ok: true, json: async () => data });
  run(window, 'js/components/mount.js');
  document.body.innerHTML = '<figure class="commit-field" data-component="commit-field"><figcaption>12 contributions</figcaption></figure>';
  run(window, 'js/components/commit-field.js');
  await tick(10);
  const grid = document.querySelector('.cf-grid');
  assert.equal(grid.querySelectorAll('.cf-cell').length, 8);
  assert.equal(grid.style.getPropertyValue('--weeks'), '2');
  assert.match(document.querySelector('.cf-readout').textContent, /12 contributions in the last 12 months/);
  grid.dispatchEvent(new window.Event('focus'));
  grid.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Home' }));
  assert.match(document.querySelector('.cf-readout').textContent, /No contributions on Jan 4, 2026/);
  grid.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown' }));
  assert.match(document.querySelector('.cf-readout').textContent, /5 contributions on Jan 5, 2026/);
});

/* ---- Lab Folder, Change Feed ------------------------------------------ */

test('lab folder: starts closed with JS, opens and closes with Escape', async () => {
  const { window, document } = makeWindow();
  run(window, 'js/components/mount.js');
  document.body.innerHTML = '<div class="lab-folder" data-component="lab-folder"><button class="lab-folder-tab" type="button" aria-expanded="true" aria-controls="c">Lab</button><ul class="lab-folder-cards" id="c"><li class="lab-card">1</li><li class="lab-card">2</li></ul></div>';
  run(window, 'js/components/lab-folder.js');
  const tab = document.querySelector('.lab-folder-tab');
  const list = document.getElementById('c');
  assert.equal(tab.getAttribute('aria-expanded'), 'false');
  assert.equal(list.hidden, true);
  tab.click();
  assert.equal(tab.getAttribute('aria-expanded'), 'true');
  assert.equal(list.hidden, false);
  document.querySelector('.lab-folder').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await tick(160);
  assert.equal(list.hidden, true);
  assert.equal(document.activeElement, tab);
});

test('change feed: tags a fresh newest entry as new', () => {
  const { window, document } = makeWindow();
  run(window, 'js/components/mount.js');
  const today = new Date().toISOString().slice(0, 10);
  document.body.innerHTML = `<ol class="change-feed" data-component="change-feed"><li><time datetime="${today}">today</time><p>a</p></li><li><time datetime="2020-01-01">old</time><p>b</p></li></ol>`;
  run(window, 'js/components/change-feed.js');
  assert.equal(document.querySelectorAll('.feed-new').length, 1);
  assert.equal(document.querySelector('.feed-new').closest('li').querySelector('time').textContent, 'today');
});

/* ---- Sticker Peel, Ink Spark ------------------------------------------ */

test('sticker peel: keyboard picks up and drops a sticker, reset sends it home', () => {
  const { window, document } = makeWindow();
  run(window, 'js/components/mount.js');
  document.body.innerHTML = '<div class="sticker-zone" id="stickerZone"><div class="sticker"><span class="sticker-caption">hi</span></div></div><button id="resetStickers">reset</button>';
  run(window, 'js/components/sticker-peel.js');
  const st = document.querySelector('.sticker');
  assert.equal(st.getAttribute('role'), 'button');
  const key = (k) => st.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true }));
  key('Enter');
  assert.equal(st.getAttribute('aria-pressed'), 'true');
  assert.match(document.querySelector('.sticker-live').textContent, /Picked up hi/);
  key('Escape');
  assert.equal(st.getAttribute('aria-pressed'), 'false');
  document.getElementById('resetStickers').click();
  assert.equal(st.style.getPropertyValue('--sx'), '0.0px');
});

test('ink spark: one burst at a time, none with reduced motion', async () => {
  const { window, document } = makeWindow({ reduced: false });
  document.body.innerHTML = '<button data-spark>go</button>';
  run(window, 'js/components/ink-spark.js');
  const btn = document.querySelector('button');
  btn.click();
  btn.click();
  assert.equal(document.querySelectorAll('.ink-spark').length, 1);
  assert.equal(document.querySelector('.ink-spark').querySelectorAll('path').length, 4);
  const calm = makeWindow({ reduced: true });
  calm.document.body.innerHTML = '<button data-spark>go</button>';
  run(calm.window, 'js/components/ink-spark.js');
  calm.document.querySelector('button').click();
  assert.equal(calm.document.querySelectorAll('.ink-spark').length, 0);
});

test('glow follow never overrides a host that positions itself (scroll-stack cards)', () => {
  const css = src('css/components/pointer-play.css');
  assert.match(css, /:where\(\.glow-follow\)\s*\{[^}]*position: relative/, 'glow host rule has zero specificity');
  assert.doesNotMatch(css, /^\.glow-follow\s*\{/m);
  const home = src('index.html');
  assert.doesNotMatch(home, /class="scroll-stack-card[^"]*"[^>]*data-glow/, 'stack cards carry no glow');
});

test('pill links keep their text color on hover (global a:hover would hide it)', () => {
  // The pill family owns this since the 2026-09-30 UI system round.
  const css = src('css/components/buttons.css');
  assert.match(css, /a\.pill-btn\.pill-btn--filled:hover,\na\.pill-btn\.pill-btn--filled:focus-visible \{\n    color: var\(--sf-panel\);/);
  assert.match(src('css/components/navbar.css'), /html\[data-theme="light"\] \.nav-cta-btn:hover \{\n    color: #ffffff;/);
});

test('every class the new home sections use has a style rule', () => {
  const css = src('css/pages/home.css');
  for (const cls of ['home-intro-talk', 'home-socials', 'home-more', 'home-closing-inner', 'home-closing-lede',
    'home-closing-note', 'home-closing-chip', 'site-footer-grid', 'site-footer-right', 'site-footer-status']) {
    assert.match(css, new RegExp('\\.' + cls + '\\b'), `home.css styles .${cls}`);
  }
});
