import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routerSrc = fs.readFileSync(path.join(root, 'js/components/page-router.js'), 'utf8');

function setup(options = {}) {
  const window = new Window({ url: 'https://jayptl.me/projects' });
  const document = window.document;
  document.body.innerHTML = '<main></main>';
  const fetchStub = options.fetch || (async () => ({
    ok: true,
    headers: { get: () => 'text/html' },
    text: async () => '<html><head></head><body><main></main></body></html>'
  }));
  const navigatorStub = options.navigator || window.navigator;
  const run = new Function('window', 'document', 'DOMParser', 'fetch', 'navigator', routerSrc);
  run(window, document, window.DOMParser, fetchStub, navigatorStub);
  return { window, document };
}

test('router: missing page scripts are appended together in order before waiting', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { window, document } = setup();
    const parsed = new window.DOMParser().parseFromString(
      '<html><body><main></main>' +
      '<script defer src="/js/a.js"></script>' +
      '<script defer src="/js/b.js"></script>' +
      '<script defer src="/js/c.js"></script>' +
      '<script defer src="/js/d.js"></script>' +
      '</body></html>',
      'text/html'
    );
    const appended = [];
    const body = document.body;
    const original = body.appendChild.bind(body);
    body.appendChild = (node) => {
      if (node && node.tagName === 'SCRIPT') appended.push(node);
      return original(node);
    };

    const pending = window.PageRouter.loadMissingScripts(parsed);

    assert.equal(appended.length, 4, 'all four scripts must be appended before any load wait');
    assert.deepEqual(appended.map((node) => node.getAttribute('src')), [
      '/js/a.js', '/js/b.js', '/js/c.js', '/js/d.js'
    ]);
    assert.ok(appended.every((node) => node.async === false), 'ordered execution needs async=false');

    mock.timers.tick(3000);
    await pending;
    body.appendChild = original;
  } finally {
    mock.timers.reset();
  }
});

test('router: prefetch warms page CSS and JS once, as bytes only', async () => {
  const html = '<html><head><link rel="stylesheet" href="/css/pages/about.css"></head>' +
    '<body><main></main>' +
    '<script defer src="/js/components/a.js"></script>' +
    '<script defer src="/js/components/b.js"></script>' +
    '</body></html>';
  const { window, document } = setup({
    fetch: async () => ({ ok: true, headers: { get: () => 'text/html' }, text: async () => html })
  });

  await window.PageRouter.prefetch('/about');
  const links = Array.from(document.querySelectorAll('link[rel="prefetch"]'));
  assert.deepEqual(links.map((link) => link.getAttribute('href')).sort(), [
    '/css/pages/about.css', '/js/components/a.js', '/js/components/b.js'
  ]);
  assert.ok(links.every((link) => link.rel === 'prefetch'));

  await window.PageRouter.prefetch('/about');
  assert.equal(document.querySelectorAll('link[rel="prefetch"]').length, 3, 'no duplicate warm links');
});

test('router: prefetch respects Save-Data', async () => {
  const html = '<html><head><link rel="stylesheet" href="/css/pages/about.css"></head>' +
    '<body><main></main><script defer src="/js/components/a.js"></script></body></html>';
  const { window, document } = setup({
    navigator: { connection: { saveData: true, effectiveType: '4g' } },
    fetch: async () => ({ ok: true, headers: { get: () => 'text/html' }, text: async () => html })
  });

  await window.PageRouter.prefetch('/about');
  assert.equal(document.querySelectorAll('link[rel="prefetch"]').length, 0);
});
