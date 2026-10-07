// /projects Features + Archive (docs/redesign/projects-cards-plan-2026-09-30.md):
// markup shape, real assets, honest links, and the filter's layout duties.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const html = src('pages/projects/index.html');

const features = [...html.matchAll(/<article class="case-card feature-card[\s\S]*?<\/article>/g)].map((m) => m[0]);
const rows = [...html.matchAll(/<details class="role arch-row"[\s\S]*?<\/details>/g)].map((m) => m[0]);
const idOf = (s) => s.match(/id="(project-[^"]+)"/)[1];

test('projects: 9 feature cards and 23 archive rows, 32 unique projects', () => {
  assert.equal(features.length, 9);
  assert.equal(rows.length, 23);
  const ids = features.concat(rows).map(idOf);
  assert.equal(new Set(ids).size, 32);
  assert.doesNotMatch(html, /case-study-callout/, 'the deep-dives strip is gone');
});

test('projects: rail counts match the categories on the page', () => {
  const all = features.concat(rows).map((s) => s.match(/data-category="([^"]+)"/)[1]);
  for (const [value, count] of [...html.matchAll(/value="(\w+)"(?: checked)?><label[^>]*><span class="stretch-rail-label">[^<]+<\/span> <span class="stretch-rail-count">(\d+)<\/span>/g)].map((m) => [m[1], +m[2]])) {
    const n = value === 'all' ? all.length : all.filter((c) => c === value).length;
    assert.equal(n, count, `${value} count`);
  }
});

test('projects: every feature cover is a real framed screenshot with dimensions', () => {
  for (const card of features) {
    const shot = card.match(/<img class="feature-shot" src="([^"]+)" srcset="([^"]+)"[^>]*width="(\d+)" height="(\d+)"/);
    assert.ok(shot, `${idOf(card)} has a sized desktop shot`);
    assert.ok(fs.existsSync(path.join(root, shot[1])), `${shot[1]} exists`);
    for (const part of shot[2].split(',')) assert.ok(fs.existsSync(path.join(root, part.trim().split(' ')[0])), `${part} exists`);
    const phone = card.match(/<img class="feature-phone" src="([^"]+)" width="300" height="649"/);
    if (phone) assert.ok(fs.existsSync(path.join(root, phone[1])), `${phone[1]} exists`);
    assert.match(card, /<p class="feature-actions">[\s\S]*pill-btn/, `${idOf(card)} has its pills`);
  }
});

test('projects: every archive row opens to its drawing and full description', () => {
  for (const row of rows) {
    assert.match(row, /<summary class="role-head arch-head">/);
    assert.match(row, /<span class="arch-year">(\d{4}|Now)<\/span>/, `${idOf(row)} has a year`);
    assert.match(row, /<div class="arch-cover" aria-hidden="true">(<svg class="case-card-blueprint"|<img )/, `${idOf(row)} keeps its cover`);
    const pitch = row.match(/<p class="arch-pitch">([\s\S]*?)<\/p>/);
    assert.ok(pitch && pitch[1].trim().length > 20, `${idOf(row)} has its full description`);
    assert.doesNotMatch(row.match(/<summary[\s\S]*?<\/summary>/)[0], /<a /, 'no links inside a summary');
  }
});

test('projects: no link sends visitors to a private repo or a bare profile', () => {
  for (const repo of ['nds_services', 'within', 'ambica_web']) assert.doesNotMatch(html, new RegExp(`github\\.com/jayptl-me/${repo}"`));
  assert.doesNotMatch(html, /href="https:\/\/github\.com\/jayptl-me"/);
  assert.doesNotMatch(html, /aortarooms\.com/, 'the retired domain is not linked');
});

test('projects: claims match what is actually public', () => {
  // Only vini-pico is public on the model hub (checked 2026-10-07); Tini is not.
  for (const rel of ['pages/projects/index.html', 'pages/projects/vini-tini.html', 'markdown/pages/projects/index.md', 'markdown/pages/projects/vini-tini.md',
    'index.html', 'pages/about.html', 'pages/resume.html', 'pages/now.html', 'pages/ai.html', 'markdown/index.md', 'markdown/pages/about.md',
    'markdown/pages/resume.md', 'markdown/pages/now.md', 'markdown/pages/ai.md', 'llms.txt', 'assets/resumes/resume.json']) {
    const text = src(rel);
    assert.doesNotMatch(text, /jayptl-rq\/tini/, `${rel} links a model that is not public`);
    assert.doesNotMatch(text, /Tini[^.]{0,80}published/, `${rel} claims Tini is published`);
  }
  assert.match(html, /href="https:\/\/huggingface\.co\/jayptl-rq"/, 'Vini and Tini links the profile');
  assert.match(html, /href="https:\/\/www\.thhiya\.com\/#home"/);
  assert.match(html, /href="https:\/\/schoolofhathayoga\.org\/"/);
  assert.doesNotMatch(html, /Oracle Cloud/, 'Ai-Vestor is live on Render');
});

test('projects: the page loads the ledger, filter and peek scripts', () => {
  for (const js of ['role-ledger', 'projects-filter', 'archive-peek']) {
    assert.match(html, new RegExp(`<script defer src="/js/components/${js}\\.js"></script>`));
  }
  assert.match(html, /data-component="role-ledger archive-peek"/);
  assert.match(src('js/components/command-deck.js'), /details\.arch-row\[id\]/, 'the Command Deck indexes archive rows');
});

/* ---- Filter layout (happy-dom) -------------------------------------------- */

const GLOBALS = ['window', 'document', 'requestAnimationFrame', 'setTimeout', 'clearTimeout'];

function page() {
  const window = new Window({ url: 'https://jayptl.me/projects', innerWidth: 1280, innerHeight: 800 });
  window.matchMedia = (q) => ({ matches: /reduce/.test(q), addEventListener() {}, removeEventListener() {} });
  window.requestAnimationFrame = (cb) => { cb(0); return 1; };
  const main = html.match(/<main[\s\S]*<\/main>/)[0];
  window.document.body.innerHTML = main;
  const run = (rel) => {
    const fn = new Function(...GLOBALS, src(rel));
    fn(...GLOBALS.map((n) => {
      const v = window[n];
      return typeof v === 'function' && !/^[A-Z]/.test(n) ? v.bind(window) : v;
    }));
  };
  run('js/components/mount.js');
  run('js/components/projects-filter.js');
  run('js/components/archive-peek.js');
  window.Mount.scan(window.document);
  return window;
}

function pick(window, value) {
  const radio = window.document.querySelector(`input[value="${value}"]`);
  radio.checked = true;
  radio.dispatchEvent(new window.Event('change', { bubbles: true }));
}

const visible = (doc, sel) => [...doc.querySelectorAll(sel)].filter((el) => !el.hidden);

test('filter: an odd set of feature cards makes the last one span the row', () => {
  const window = page();
  const doc = window.document;
  // On load: 9 cards, the ninth spans the row.
  let cards = visible(doc, '.feature-card');
  assert.equal(cards.length, 9);
  assert.ok(cards[8].hasAttribute('data-wide'));
  assert.equal(doc.querySelectorAll('.feature-card[data-wide]').length, 1);
  pick(window, 'client');
  assert.equal(visible(doc, '.feature-card').length, 6);
  assert.equal(doc.querySelectorAll('.feature-card[data-wide]').length, 0);
  pick(window, 'aiml');
  cards = visible(doc, '.feature-card');
  assert.equal(cards.length, 1);
  assert.ok(cards[0].hasAttribute('data-wide'), 'a lone card spans the row');
  pick(window, 'personal');
  assert.equal(visible(doc, '.feature-card').length, 2);
  assert.equal(doc.querySelectorAll('.feature-card[data-wide]').length, 0);
});

test('filter: a section with nothing to show hides, counts follow the filter', () => {
  const window = page();
  const doc = window.document;
  pick(window, 'opensource');
  const [live, archive] = doc.querySelectorAll('.work-section');
  assert.equal(live.hidden, true, 'no open-source feature cards');
  assert.equal(archive.hidden, false);
  assert.match(archive.querySelector('.work-count').textContent, /^9 projects/);
  assert.match(doc.getElementById('filterReadout').textContent, /Showing 9 of 32/);
  pick(window, 'all');
  assert.equal(live.hidden, false);
  assert.equal(live.querySelector('.work-count').textContent, '9 projects');
});

test('archive: a link to a row opens it', () => {
  const window = new Window({ url: 'https://jayptl.me/projects#project-niti-health' });
  window.matchMedia = () => ({ matches: false });
  window.document.body.innerHTML = html.match(/<main[\s\S]*<\/main>/)[0];
  window.HTMLElement.prototype.scrollIntoView = function () {};
  const fn = new Function(...GLOBALS, src('js/components/mount.js') + '\n' + src('js/components/archive-peek.js'));
  fn(...GLOBALS.map((n) => (typeof window[n] === 'function' ? window[n].bind(window) : window[n])));
  window.Mount.scan(window.document);
  assert.equal(window.document.getElementById('project-niti-health').open, true);
});
