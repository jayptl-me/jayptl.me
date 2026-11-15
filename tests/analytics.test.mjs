// Analytics: one GA loader, nothing before consent, events that really fire
// once a visitor opts in, and none after they opt out (audit 2026-11-15:
// analytics.js waited for a script consent-banner.js had already loaded, so
// every custom event was dead, and opting in twice loaded GA twice).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const BANNER = read('js/components/consent-banner.js');
const ANALYTICS = read('js/components/analytics.js');

function page({ consent = null } = {}) {
  const window = new Window({ url: 'https://jayptl.me/' });
  const document = window.document;
  document.body.innerHTML = `<main><section id="hero"><a id="mail" href="mailto:hello@jayptl.me">Email</a>
    <a id="book" href="/book">Book</a><a id="gh" href="https://github.com/x" target="_blank">GitHub</a></section>
    <section id="work"></section></main><footer><a id="foot" href="mailto:hello@jayptl.me">mail</a></footer>`;
  // The test browser follows clicked links (mailto: included, which a real
  // browser hands to the mail app), so keep every click on this page.
  document.addEventListener('click', (e) => e.preventDefault());
  if (consent) window.localStorage.setItem('user-analytics-consent', JSON.stringify(consent));
  const observers = [];
  window.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; this.targets = new Set(); observers.push(this); }
    observe(t) { this.targets.add(t); }
    unobserve(t) { this.targets.delete(t); }
    disconnect() { this.targets.clear(); }
  };
  window.dataLayer = [];
  const run = (src) => new Function('window', 'document', 'localStorage', 'CustomEvent', 'IntersectionObserver', 'dataLayer', 'gtag', 'module', src)(
    window, document, window.localStorage, window.CustomEvent, window.IntersectionObserver, window.dataLayer,
    (...a) => window.gtag(...a), undefined);
  run(BANNER);
  run(ANALYTICS);
  const calls = () => window.dataLayer.map((args) => Array.from(args));
  const events = (name) => calls().filter((c) => c[0] === 'event' && c[1] === name);
  const gaScripts = () => [...document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]')].length;
  const seeSection = (id) => observers.forEach((o) => {
    const el = document.getElementById(id);
    if (o.targets.has(el)) o.cb([{ target: el, isIntersecting: true }]);
  });
  return { window, document, calls, events, gaScripts, seeSection };
}

const yes = { accepted: true, hasResponded: true };

test('analytics: nothing loads and nothing is sent before consent', () => {
  const p = page();
  assert.equal(p.gaScripts(), 0);
  assert.equal(typeof p.window.gtag, 'undefined');
  p.document.getElementById('mail').click();
  assert.equal(p.window.dataLayer.length, 0);
});

test('analytics: an opted-in visitor gets one loader, consent v2 defaults, and live events', () => {
  const p = page({ consent: yes });
  assert.equal(p.gaScripts(), 1);
  const def = p.calls().find((c) => c[0] === 'consent' && c[1] === 'default')[2];
  assert.deepEqual(def, { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  assert.equal(p.calls().filter((c) => c[0] === 'config').length, 1);
  assert.equal(p.window.analyticsManager.isAnalyticsReady(), true, 'analytics.js never became ready (the dead-events bug)');

  p.document.getElementById('mail').click();
  p.document.getElementById('foot').click();
  p.document.getElementById('book').click();
  p.document.getElementById('gh').click();
  const leads = p.events('generate_lead').map((e) => [e[2].method, e[2].link_location]);
  assert.deepEqual(leads, [['email', 'hero'], ['email', 'footer']]);
  assert.equal(p.events('select_content')[0][2].content_id, 'book');
  // Outbound links are left to GA's enhanced measurement: no second event here.
  assert.equal(p.calls().filter((c) => c[0] === 'event' && JSON.stringify(c).includes('github')).length, 0);
});

test('analytics: each section is counted once per page, and again after a navigation', () => {
  const p = page({ consent: yes });
  p.seeSection('work');
  p.seeSection('work');
  assert.equal(p.events('section_view').length, 1);
  p.window.analyticsManager.trackPageView('/about');
  p.seeSection('work');
  assert.equal(p.events('section_view').length, 2);
  // The router's call never sends its own page_view (GA's history tracking does).
  assert.equal(p.events('page_view').length, 0);
});

test('analytics: the /privacy switch flips off and on without a second loader or events while off', () => {
  const p = page({ consent: yes });
  const banner = p.window.consentBanner;
  banner.setConsentInline(false);
  assert.equal(p.window['ga-disable-G-GGZTYJVH9J'], true, 'opt-out must switch gtag off, not only deny storage');
  const before = p.window.dataLayer.length;
  p.document.getElementById('mail').click();
  assert.equal(p.window.dataLayer.length, before, 'an event went out after opting out');
  banner.setConsentInline(true);
  assert.equal(p.gaScripts(), 1, 'opting in again added a second GA script');
  assert.equal(p.window['ga-disable-G-GGZTYJVH9J'], false);
  assert.equal(p.calls().filter((c) => c[0] === 'config').length, 1, 'a second config would send a second page_view');
  p.document.getElementById('mail').click();
  assert.equal(p.events('generate_lead').length, 1);
});

test('analytics: a visitor who opts in mid-visit starts sending events', () => {
  const p = page();
  p.window.consentBanner.setConsentInline(true);
  assert.equal(p.gaScripts(), 1);
  p.document.getElementById('mail').click();
  assert.equal(p.events('generate_lead').length, 1);
});

test('analytics: every page loads the consent and analytics scripts, and a booked call is a lead', () => {
  const pages = ['index.html', ...fs.readdirSync(path.join(root, 'pages')).filter((f) => f.endsWith('.html')).map((f) => 'pages/' + f),
    ...fs.readdirSync(path.join(root, 'pages/projects')).filter((f) => f.endsWith('.html')).map((f) => 'pages/projects/' + f)];
  for (const f of pages) {
    const html = read(f);
    assert.match(html, /<script defer src="\/js\/components\/consent-banner\.js"><\/script>/, f + ' has no consent script');
    assert.match(html, /<script defer src="\/js\/components\/analytics\.js"><\/script>/, f + ' has no analytics script');
    // Cloudflare's cookieless beacon is placed by hand: its automatic injection never reached these pages.
    assert.equal((html.match(/static\.cloudflareinsights\.com\/beacon\.min\.js/g) || []).length, 1, f + ' needs exactly one beacon');
    assert.match(html, /data-cf-beacon='\{"token": "[0-9a-f]{32}"\}'/, f + ' beacon has no site token');
  }
  assert.match(read('js/components/slot-picker.js'), /trackEvent\('generate_lead', \{ method: 'booking' \}\)/);
});
