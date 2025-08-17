"use strict";

/**
 * Reusable Navbar Component
 * Injects a universal, responsive glassmorphic navbar with inline theme toggle
 * into any page. On pages without the hero reveal overlay, the navbar is
 * visible immediately. On the landing page with the reveal overlay, it
 * respects the reveal flow and visibility behavior.
 *
 * @file js/components/navbar.js
 */

(function () {
  /**
   * Build and return the complete HTML string for the site navbar.
   *
   * The generated markup is a self-contained header with id "glassNav" that includes:
   * - a responsive mobile drawer, backdrop, and dialog-like panel
   * - a left "Projects" link, centered brand link, a "More" dropdown, and a theme toggle (also in mobile footer)
   * - accessible attributes (roles, aria-*, and expected IDs like `mobileMenu`, `navToggle`, `moreMenu`)
   *
   * The function resolves a robust base path (supports subdirectory deployments) and chooses the Projects link target
   * as `#projects` when the current page is the site's home, or as `basePath#projects` otherwise, so all hrefs adapt
   * to the current location.
   *
   * @return {string} HTML for injection into the document containing the fully-formed navigation/header.
   */
  function buildNavHTML() {
    // Robust base path detection for sub-directory deployments
    // Use current directory as base (e.g., "/jayptl.me/") for subdir deployments
    const basePath = new URL(".", location).pathname;
    const onHome = location.pathname === basePath || /(?:^|\/)index\.html?$/i.test(location.pathname);
    const homeHref = basePath; // directory path (always ends with "/")
    const projectsHref = onHome ? "#projects" : `${basePath}#projects`;

    return `
      <header id="glassNav" class="glass-nav" aria-label="Primary Navigation" role="banner">
        <nav class="glass-nav-inner" role="navigation" aria-label="Primary">
          <button class="nav-toggle" id="navToggle" aria-label="Toggle navigation" aria-expanded="false" aria-controls="mobileMenu">
            <span class="nav-toggle-bar"></span>
            <span class="nav-toggle-bar"></span>
            <span class="nav-toggle-bar"></span>
          </button>

          <div class="nav-left">
            <div class="nav-links">
              <a href="${projectsHref}" class="nav-link" aria-label="Projects">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
                <span class="nav-text">Projects</span>
              </a>
            </div>
          </div>

          <div class="nav-center">
            <a href="${homeHref}" id="glassNavBrand" class="nav-brand" aria-label="Brand" tabindex="0">Jay Patel</a>
          </div>

          <div class="nav-right">
            <div class="nav-links">
              <div class="nav-dropdown" id="moreDropdown">
                <button class="nav-link nav-dropdown-toggle" aria-haspopup="true" aria-expanded="false" aria-controls="moreMenu">
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 7a2 2 0 110-4 2 2 0 010 4zm0 7a2 2 0 110-4 2 2 0 010 4zm0 7a2 2 0 110-4 2 2 0 010 4z"/></svg>
                  <span class="nav-text">More</span>
                </button>
                <div class="dropdown-menu" id="moreMenu" role="menu">
                  <a role="menuitem" href="/privacy.html" class="dropdown-item">Privacy Policy</a>
                  <a role="menuitem" href="https://github.com/jayptl-me" target="_blank" rel="noopener" class="dropdown-item">GitHub</a>
                  <a role="menuitem" href="https://www.linkedin.com/in/jayptl/" target="_blank" rel="noopener" class="dropdown-item">LinkedIn</a>
                </div>
              </div>
            </div>

            <button class="theme-toggle" id="themeToggle" aria-label="Toggle dark/light mode" tabindex="0">
              <svg class="lightsaber" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 24" aria-hidden="true" focusable="false">
                <rect x="2" y="10" width="16" height="4" rx="1" fill="currentColor"/>
                <rect x="18" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.6"/>
                <rect class="lightsaber-glow" x="24" y="9" width="36" height="6" rx="3"/>
                <rect class="lightsaber-blade" x="24" y="10" width="36" height="4" rx="2"/>
              </svg>
            </button>

            
          </div>
        </nav>

        <div class="mobile-menu" id="mobileMenu" aria-hidden="true">
          <div class="mobile-overlay" aria-hidden="true"></div>
          <div class="mobile-panel" role="dialog" aria-modal="true" aria-label="Mobile menu">
            <div class="mobile-header">
              <a href="${homeHref}" class="mobile-brand">Jay Patel</a>
              <button class="mobile-close" id="mobileClose" aria-label="Close menu">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <nav class="mobile-list" aria-label="Primary">
              <a href="${projectsHref}" class="mobile-link"><span>Projects</span></a>
              <a href="${homeHref}" class="mobile-link"><span>Home</span></a>
              <a href="/privacy.html" class="mobile-link"><span>Privacy</span></a>
              <a href="https://github.com/jayptl-me" target="_blank" rel="noopener" class="mobile-link"><span>GitHub</span></a>
              <a href="https://www.linkedin.com/in/jayptl/" target="_blank" rel="noopener" class="mobile-link"><span>LinkedIn</span></a>
            </nav>
            <div class="mobile-footer">
              <button class="theme-toggle ghost-btn" aria-label="Toggle dark/light mode">
                <svg class="lightsaber" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 24" aria-hidden="true" focusable="false">
                  <rect x="2" y="10" width="16" height="4" rx="1" fill="currentColor"/>
                  <rect x="18" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.6"/>
                  <rect class="lightsaber-glow" x="24" y="9" width="36" height="6" rx="3"/>
                  <rect class="lightsaber-blade" x="24" y="10" width="36" height="4" rx="2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>
    `;
  }

  /**
   * Toggle the navbar's accessibility and visibility state.
   *
   * When `visible` is true, adds the "visible" class, removes `aria-hidden`, and (if supported) clears `inert`
   * so the navbar and its controls become available to assistive technology and keyboard focus.
   * When `visible` is false, removes the "visible" class, sets `aria-hidden="true"`, and (if supported) sets `inert`
   * to remove the navbar from the accessibility tree. If the document's active element is inside the navbar when hiding,
   * the function attempts to blur it to avoid leaving focus on an invisible element.
   *
   * @param {HTMLElement} nav - The navbar root element (e.g., element with id "glassNav").
   * @param {boolean} visible - True to make the navbar accessible/visible; false to hide it and remove it from the accessibility tree.
   */
  function setNavbarAccessibility(nav, visible) {
    if (visible) {
      nav.classList.add('visible');
      nav.removeAttribute('aria-hidden');
      try { nav.inert = false; } catch { }
    } else {
      nav.classList.remove('visible');
      nav.setAttribute('aria-hidden', 'true');
      try { nav.inert = true; } catch { }

      // If focus is within the navbar when hiding, move it to body to avoid invisible focus
      if (nav.contains(document.activeElement)) {
        try { document.activeElement.blur(); } catch { }
      }
    }
  }

  /**
   * Insert or replace the page navbar and wire up its interactive behavior.
   *
   * Generates the navbar markup with buildNavHTML(), inserts it at the top of the document
   * (or replaces an existing #glassNav), and attaches all runtime behavior:
   * - Mobile drawer: open/close, Esc key handling, backdrop and close-button handling,
   *   focus management, inert/aria-hidden toggling, body scroll locking, resize and
   *   navigation listeners to auto-close.
   * - "More" dropdown: toggle, outside-click closing, and Escape key handling.
   * - Visibility integration with an optional `.text-reveal-container` overlay: if the
   *   overlay is present and not yet released, the navbar starts hidden and a
   *   MutationObserver will reveal it when the overlay receives the `released` class.
   *
   * This function mutates the DOM and registers event listeners; it does not return a value.
   */
  function insertNav() {
    // If a glassNav already exists, replace it for consistency
    const existing = document.getElementById("glassNav");
    const html = buildNavHTML();

    if (existing) {
      existing.outerHTML = html;
    } else {
      document.body.insertAdjacentHTML("afterbegin", html);
    }

    // Setup mobile toggling (drawer)
    const nav = document.getElementById("glassNav");
    const toggle = document.getElementById("navToggle");
    const drawer = document.getElementById("mobileMenu");
    if (toggle && drawer) {
      const onEsc = (e) => {
        if (e.key === 'Escape') {
          setOpen(false);
          // Return focus to the toggle to avoid leaving focus inside a hidden subtree
          setTimeout(() => toggle.focus({ preventScroll: true }), 0);
        }
      };
      const setOpen = (open) => {
        // If closing, ensure focus is not inside an element that will be hidden
        if (!open) {
          if (drawer.contains(document.activeElement)) {
            // Move focus back to the toggle before hiding
            try { toggle.focus({ preventScroll: true }); } catch { }
          }
        }

        nav.classList.toggle("open", open);
        drawer.setAttribute("aria-hidden", String(!open));
        // Use inert to fully disable interaction when hidden
        try { drawer.inert = !open; } catch { }
        toggle.setAttribute("aria-expanded", String(open));
        document.body.classList.toggle('no-scroll', open);
        document.body.classList.toggle('nav-open', open);
        if (open) {
          document.addEventListener('keydown', onEsc);
          // Move focus into the sheet for accessibility
          const firstFocusable = drawer.querySelector('a.tile, a.mobile-item, a.mobile-link, button, [tabindex]:not([tabindex="-1"])');
          if (firstFocusable) {
            setTimeout(() => firstFocusable.focus({ preventScroll: true }), 0);
          }
        } else {
          document.removeEventListener('keydown', onEsc);
          // As a safety, blur any focused element left in the drawer
          if (drawer.contains(document.activeElement)) {
            try { document.activeElement.blur(); } catch { }
          }
        }
      };
      toggle.addEventListener("click", () => {
        const willOpen = !nav.classList.contains('open');
        setOpen(willOpen);
      });
      // Close when clicking the backdrop overlay
      const backdrop = drawer.querySelector('.mobile-overlay');
      if (backdrop) {
        backdrop.addEventListener('click', () => setOpen(false));
      }
      // Close button in the mobile header
      const closeBtn = document.getElementById('mobileClose');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => setOpen(false));
      }
      // Close drawer when a mobile link is clicked
      drawer.querySelectorAll('a.tile, a.mobile-item, a.mobile-link').forEach((link) => {
        link.addEventListener('click', () => setOpen(false));
      });

      // Close on resize back to desktop
      const onResize = () => {
        if (window.innerWidth > 768 && nav.classList.contains('open')) {
          setOpen(false);
        }
      };
      window.addEventListener('resize', onResize, { passive: true });

      // Close on navigation/hash changes (SPA-like UX safety)
      const onNavigate = () => setOpen(false);
      window.addEventListener('hashchange', onNavigate);
      window.addEventListener('popstate', onNavigate);

      // If a mobile item triggered navigation, ensure focus returns to toggle
      drawer.querySelectorAll('a.tile, a.mobile-item, a.mobile-link').forEach((link) => {
        link.addEventListener('click', () => {
          // Slight delay to allow close animation
          setTimeout(() => toggle.focus({ preventScroll: true }), 0);
        });
      });
    }

    // Dropdown (More)
    const dd = document.getElementById('moreDropdown');
    const ddBtn = dd && dd.querySelector('.nav-dropdown-toggle');
    if (dd && ddBtn) {
      ddBtn.addEventListener('click', () => {
        const willOpen = !dd.classList.contains('open');
        ddBtn.setAttribute('aria-expanded', String(willOpen));
        dd.classList.toggle('open');
      });
      document.addEventListener('click', (e) => {
        if (!dd.contains(e.target)) {
          ddBtn.setAttribute('aria-expanded', 'false');
          dd.classList.remove('open');
        }
      });
      ddBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          ddBtn.setAttribute('aria-expanded', 'false');
          dd.classList.remove('open');
        }
      });
    }

    // Visibility behavior
    const overlay = document.querySelector('.text-reveal-container');
    const isReleased = overlay && overlay.classList.contains('released');
    if (!overlay || isReleased) {
      setNavbarAccessibility(nav, true);
    } else {
      setNavbarAccessibility(nav, false);
      // Auto-show when overlay releases
      try {
        const mo = new MutationObserver(() => {
          if (overlay.classList.contains('released')) {
            setNavbarAccessibility(nav, true);
            mo.disconnect();
          }
        });
        mo.observe(overlay, { attributes: true, attributeFilter: ['class'] });
      } catch { /* noop */ }
    }
  }

  // Expose navbar accessibility function globally for other components
  window.setNavbarAccessibility = setNavbarAccessibility;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', insertNav);
  } else {
    insertNav();
  }
})();
