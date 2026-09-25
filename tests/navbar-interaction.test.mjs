// Automated interaction tests for navbar dropdowns:
// - Hover open delay (150ms) and close delay (300ms) with simulated pointer events
// - Focus restoration to toggle button when closed with focus inside menu (WCAG 2.4.3 / Finding 3)
// - Hover-to-click transition and dismiss behavior (WCAG 1.4.13 / Finding 4)
// - Keyboard disclosure navigation (ArrowDown, ArrowUp, Home, End, Escape)
// - Outside click dismissal
// - Popover coordination (nav:popover-open) and router page-swap sync (page:ready)
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const navbarSrc = fs.readFileSync(path.join(root, 'js/components/navbar.js'), 'utf8');

function setupTestEnvironment() {
  const window = new Window({
    url: 'https://jayptl.me/',
    innerWidth: 1200,
    innerHeight: 800
  });
  const document = window.document;

  // Bind global timers so mock.timers intercepts them
  window.setTimeout = setTimeout;
  window.clearTimeout = clearTimeout;
  window.setInterval = setInterval;
  window.clearInterval = clearInterval;

  // Emulate desktop fine pointer
  window.matchMedia = (query) => ({
    matches: query.includes('pointer: fine') || query.includes('hover: hover'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  });

  window.scrollTo = () => {};
  window.requestAnimationFrame = (cb) => setTimeout(cb, 0);

  // Execute navbar.js inside the window context
  const runNavbar = new Function('window', 'document', navbarSrc);
  runNavbar(window, document);

  const nav = document.getElementById('glassNav');
  const dropdowns = Array.from(nav.querySelectorAll('.nav-dropdown'));
  const projectsDd = dropdowns.find((d) => d.id === 'navProjectsDropdown') || dropdowns[0];
  const moreDd = dropdowns.find((d) => d.id === 'navMoreDropdown') || dropdowns[1];

  return { window, document, nav, dropdowns, projectsDd, moreDd };
}

test('navbar: hover open delay respects 150ms intent timer', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { window, projectsDd } = setupTestEnvironment();
    const btn = projectsDd.querySelector('.nav-dropdown-toggle');

    assert.equal(projectsDd.classList.contains('open'), false);
    assert.equal(btn.getAttribute('aria-expanded'), 'false');

    // Mouse pointer enters
    projectsDd.dispatchEvent(new window.PointerEvent('pointerenter', {
      pointerType: 'mouse',
      bubbles: true
    }));

    // Before 150ms: must still be closed
    mock.timers.tick(140);
    assert.equal(projectsDd.classList.contains('open'), false);

    // Reaching 150ms: opens
    mock.timers.tick(15);
    assert.equal(projectsDd.classList.contains('open'), true);
    assert.equal(btn.getAttribute('aria-expanded'), 'true');
  } finally {
    mock.timers.reset();
  }
});

test('navbar: hover close delay respects 300ms intent timer', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { window, projectsDd } = setupTestEnvironment();
    const btn = projectsDd.querySelector('.nav-dropdown-toggle');

    // Open via hover
    projectsDd.dispatchEvent(new window.PointerEvent('pointerenter', {
      pointerType: 'mouse',
      bubbles: true
    }));
    mock.timers.tick(150);
    assert.equal(projectsDd.classList.contains('open'), true);

    // Pointer leaves
    projectsDd.dispatchEvent(new window.PointerEvent('pointerleave', {
      pointerType: 'mouse',
      bubbles: true
    }));

    // Before 300ms: still open
    mock.timers.tick(250);
    assert.equal(projectsDd.classList.contains('open'), true);

    // At 300ms: closes
    mock.timers.tick(60);
    assert.equal(projectsDd.classList.contains('open'), false);
    assert.equal(btn.getAttribute('aria-expanded'), 'false');
  } finally {
    mock.timers.reset();
  }
});

test('navbar: clicking a hover-opened menu confirms it without toggling closed', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { window, projectsDd } = setupTestEnvironment();
    const btn = projectsDd.querySelector('.nav-dropdown-toggle');

    // Open via hover
    projectsDd.dispatchEvent(new window.PointerEvent('pointerenter', {
      pointerType: 'mouse',
      bubbles: true
    }));
    mock.timers.tick(150);
    assert.equal(projectsDd.classList.contains('open'), true);

    // Click confirms state
    btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    assert.equal(projectsDd.classList.contains('open'), true);

    // Pointer leaves: since it was confirmed by click, pointerleave does NOT close it
    projectsDd.dispatchEvent(new window.PointerEvent('pointerleave', {
      pointerType: 'mouse',
      bubbles: true
    }));
    mock.timers.tick(350);
    assert.equal(projectsDd.classList.contains('open'), true);
  } finally {
    mock.timers.reset();
  }
});

test('navbar: focus returns to toggle button when closed with focus inside menu (WCAG 2.4.3 / Finding 3)', () => {
  const { window, document, projectsDd } = setupTestEnvironment();
  const btn = projectsDd.querySelector('.nav-dropdown-toggle');
  const links = Array.from(projectsDd.querySelectorAll('.dropdown-menu a[href]'));

  // Open via click
  btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(projectsDd.classList.contains('open'), true);

  // Move focus to a link inside the dropdown
  links[0].focus();
  assert.equal(document.activeElement, links[0]);

  // Outside click dismisses the menu
  document.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(projectsDd.classList.contains('open'), false);

  // Focus must return to toggle button, never stranded in hidden menu
  assert.equal(document.activeElement, btn);
});

test('navbar: keyboard disclosure navigation (ArrowDown, ArrowUp, Escape)', () => {
  const { window, document, projectsDd } = setupTestEnvironment();
  const btn = projectsDd.querySelector('.nav-dropdown-toggle');
  const links = Array.from(projectsDd.querySelectorAll('.dropdown-menu a[href]'));

  btn.focus();
  assert.equal(document.activeElement, btn);

  // ArrowDown opens menu and focuses first link
  projectsDd.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  assert.equal(projectsDd.classList.contains('open'), true);
  assert.equal(document.activeElement, links[0]);

  // ArrowDown advances to next link
  projectsDd.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  assert.equal(document.activeElement, links[1]);

  // ArrowUp moves back to previous link
  projectsDd.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  assert.equal(document.activeElement, links[0]);

  // ArrowUp from first link returns to button
  projectsDd.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  assert.equal(document.activeElement, btn);

  // Escape closes menu
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(projectsDd.classList.contains('open'), false);
});

test('navbar: popover coordination closes nav dropdowns when sound panel opens', () => {
  const { window, projectsDd } = setupTestEnvironment();
  const btn = projectsDd.querySelector('.nav-dropdown-toggle');

  // Open nav dropdown
  btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(projectsDd.classList.contains('open'), true);

  // Sound panel opens (dispatches nav:popover-open)
  window.dispatchEvent(new window.CustomEvent('nav:popover-open', {
    detail: { source: 'audio-toggle' }
  }));

  // Nav dropdown closes to yield
  assert.equal(projectsDd.classList.contains('open'), false);
});

test('navbar: router page swap closes dropdowns and updates aria-current', () => {
  const { window, nav, projectsDd } = setupTestEnvironment();
  const btn = projectsDd.querySelector('.nav-dropdown-toggle');

  // Open dropdown
  btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(projectsDd.classList.contains('open'), true);

  // Simulate router updating URL to /projects
  window.location.href = 'https://jayptl.me/projects';

  // Page swap event
  window.dispatchEvent(new window.CustomEvent('page:ready', {
    detail: { url: '/projects' }
  }));

  // Dropdown closes
  assert.equal(projectsDd.classList.contains('open'), false);

  // aria-current is updated on the active route
  const projectsLink = nav.querySelector('a[href="/projects"], a[href="/projects/"]');
  assert.ok(projectsLink, 'projects link must exist in navbar');
  assert.equal(projectsLink.getAttribute('aria-current'), 'page');
});
