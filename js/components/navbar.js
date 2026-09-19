"use strict";

/**
 * Reusable Navbar Component - Dynamic Island Architecture
 * Injects a universal floating island navbar with:
 * - Pod 1: Identity with profile avatar & live availability status indicator
 * - Pod 2: Desktop navigation rail with rich "Projects" case-study dropdown, direct links, and "More" dropdown
 *           plus the GooeyNav hover/active pill effect (js/components/gooey-nav.js, lazy-loaded)
 * - Pod 3: Quick "Let's Talk" CTA + inline Lightsaber theme toggle + responsive Dynamic Island toggle
 * - Mobile Dynamic Island Morph: Top capsule fluidly expands into an interactive mini-hub with touch-driven
 *   Gooey metaball rail, featured work, and quick resources with zero background clipping.
 *
 * Fully supports dual design systems:
 * - Dark Mode: Liquid Glass with turquoise ramp (#00b8cc), deep blur, specular rim reflections
 * - Light Mode: Soft Calm Clay Light Play UI with skeuomorphic blue ramp (#2196f3), inner bevels, diffused dual shadows
 *
 * @file js/components/navbar.js
 */

(function () {
  function buildNavHTML() {
    // Canonical clean URLs (matching server redirects and routes)
    const homeHref = '/';
    const projectsHref = '/projects';
    const aboutHref = '/about';
    const resumeHref = '/resume';
    const privacyHref = '/privacy';
    const designSystemHref = '/design-system';

    // Featured case study routes
    const avizHref = '/projects/aviz-health';
    const swalookHref = '/projects/swalook';
    const vinitiniHref = '/projects/vini-tini';
    const genuinestHref = '/projects/genuinest';

    const githubHref = 'https://github.com/jayptl-me';
    const linkedinHref = 'https://www.linkedin.com/in/jayptl-rq/';
    const emailHref = 'mailto:connect@jayptl.me';
    const avatarSrc = '/assets/logo-512.png';

    return `
      <header id="glassNav" class="glass-nav" aria-label="Primary Navigation" role="banner">
        <!-- Backdrop Scrim Overlay for mobile island expansion -->
        <div class="mobile-overlay" id="mobileOverlay" aria-hidden="true"></div>

        <div class="nav-island-container" id="navIslandContainer">
          <nav class="glass-nav-inner" role="navigation" aria-label="Primary">
            
            <!-- Left Pod: Identity & Live Status -->
            <a href="${homeHref}" id="glassNavBrand" class="nav-identity" aria-label="Jay Patel - Home" tabindex="0">
              <div class="nav-avatar-wrap">
                <img src="${avatarSrc}" alt="Jay Patel" class="nav-avatar" width="34" height="34" loading="eager" />
                <span class="nav-status-dot" title="Available for work" aria-label="Available for work"></span>
              </div>
              <div class="nav-identity-copy">
                <span class="nav-brand-name">Jay Patel</span>
                <span class="nav-brand-role">Product Engineer</span>
              </div>
            </a>

            <!-- Center Pod: Desktop Navigation Rail -->
            <div class="nav-rail">
              <!-- Projects Dropdown -->
              <div class="nav-dropdown" id="projectsDropdown">
                <button class="nav-link nav-rail-link nav-dropdown-toggle" aria-haspopup="true" aria-expanded="false" aria-controls="projectsMenu">
                  <span class="nav-text">Projects</span>
                  <svg class="dropdown-chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
                    <path d="M2.5 4.5L6 8L9.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <div class="dropdown-menu dropdown-menu--wide" id="projectsMenu" role="menu">
                  <div class="dropdown-header">
                    <span class="dropdown-header-title">Selected Case Studies</span>
                  </div>
                  <div class="dropdown-grid">
                    <a role="menuitem" href="${avizHref}" class="dropdown-card">
                      <div class="dropdown-card-icon aviz-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                      </div>
                      <div class="dropdown-card-info">
                        <div class="dropdown-card-title">Aviz Health</div>
                        <div class="dropdown-card-desc">Clinical AI engine</div>
                      </div>
                    </a>

                    <a role="menuitem" href="${swalookHref}" class="dropdown-card">
                      <div class="dropdown-card-icon swalook-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                      </div>
                      <div class="dropdown-card-info">
                        <div class="dropdown-card-title">Swalook CRM</div>
                        <div class="dropdown-card-desc">Enterprise salon SaaS</div>
                      </div>
                    </a>

                    <a role="menuitem" href="${vinitiniHref}" class="dropdown-card">
                      <div class="dropdown-card-icon vinitini-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                      </div>
                      <div class="dropdown-card-info">
                        <div class="dropdown-card-title">Vini-Tini</div>
                        <div class="dropdown-card-desc">Event mixology platform</div>
                      </div>
                    </a>

                    <a role="menuitem" href="${genuinestHref}" class="dropdown-card">
                      <div class="dropdown-card-icon genuinest-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/></svg>
                      </div>
                      <div class="dropdown-card-info">
                        <div class="dropdown-card-title">Genuinest</div>
                        <div class="dropdown-card-desc">Community commerce</div>
                      </div>
                    </a>
                  </div>
                  <div class="dropdown-footer">
                    <a role="menuitem" href="${projectsHref}" class="dropdown-footer-link">
                      <span>Explore all 10+ projects</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </a>
                  </div>
                </div>
              </div>

              <!-- Direct Nav Links -->
              <a href="${aboutHref}" class="nav-link nav-rail-link"><span class="nav-text">About</span></a>
              <a href="${resumeHref}" class="nav-link nav-rail-link"><span class="nav-text">Resume</span></a>

              <!-- More Dropdown -->
              <div class="nav-dropdown" id="moreDropdown">
                <button class="nav-link nav-rail-link nav-dropdown-toggle" aria-haspopup="true" aria-expanded="false" aria-controls="moreMenu">
                  <span class="nav-text">More</span>
                  <svg class="dropdown-chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
                    <path d="M2.5 4.5L6 8L9.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <div class="dropdown-menu" id="moreMenu" role="menu">
                  <a role="menuitem" href="${designSystemHref}" class="dropdown-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>
                    <span>Design System</span>
                  </a>
                  <a role="menuitem" href="${privacyHref}" class="dropdown-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    <span>Privacy Policy</span>
                  </a>
                  <div class="dropdown-divider"></div>
                  <a role="menuitem" href="${githubHref}" target="_blank" rel="noopener noreferrer" class="dropdown-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
                    <span>GitHub</span>
                  </a>
                  <a role="menuitem" href="${linkedinHref}" target="_blank" rel="noopener noreferrer" class="dropdown-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                    <span>LinkedIn</span>
                  </a>
                </div>
              </div>
            </div>

            <!-- Right Pod: Quick Actions & Controls -->
            <div class="nav-controls">
              <a href="${emailHref}" class="nav-cta-btn" aria-label="Let's Talk - Email Jay Patel">
                <span>Let's Talk</span>
              </a>

              <button class="theme-toggle" id="themeToggle" aria-label="Toggle dark/light mode" tabindex="0">
                <svg class="lightsaber" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 24" aria-hidden="true" focusable="false">
                  <rect x="2" y="10" width="16" height="4" rx="1" fill="currentColor"/>
                  <rect x="18" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.6"/>
                  <rect class="lightsaber-glow" x="24" y="9" width="36" height="6" rx="3"/>
                  <rect class="lightsaber-blade" x="24" y="10" width="36" height="4" rx="2"/>
                </svg>
              </button>

              <button class="nav-toggle" id="navToggle" aria-label="Toggle navigation" aria-expanded="false" aria-controls="islandExpandedContent">
                <span class="nav-toggle-bar"></span>
                <span class="nav-toggle-bar"></span>
                <span class="nav-toggle-bar"></span>
              </button>
            </div>

          </nav>

          <!-- Mobile Dynamic Island Expanded Body -->
          <div class="island-expanded-content" id="islandExpandedContent" aria-hidden="true" inert>
            <!-- Mobile Touch-Driven Gooey Rail -->
            <div class="mobile-gooey-rail-wrap">
              <nav class="mobile-gooey-rail" aria-label="Mobile Navigation">
                <a href="${homeHref}" class="nav-link mobile-rail-link"><span class="nav-text">Home</span></a>
                <a href="${projectsHref}" class="nav-link mobile-rail-link"><span class="nav-text">Projects</span></a>
                <a href="${aboutHref}" class="nav-link mobile-rail-link"><span class="nav-text">About</span></a>
                <a href="${resumeHref}" class="nav-link mobile-rail-link"><span class="nav-text">Resume</span></a>
                <a href="${emailHref}" class="nav-link mobile-rail-link"><span class="nav-text">Contact</span></a>
              </nav>
            </div>

            <!-- Scrollable Inner Viewport -->
            <div class="island-scroll-body" id="islandScrollBody">
              <div class="mobile-section-label">Featured Work</div>
              <div class="mobile-grid">
                <a href="${avizHref}" class="mobile-card">
                  <div class="mobile-card-icon aviz-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                  </div>
                  <div class="mobile-card-content">
                    <div class="mobile-card-title">Aviz Health</div>
                    <div class="mobile-card-desc">Clinical AI Engine</div>
                  </div>
                </a>

                <a href="${swalookHref}" class="mobile-card">
                  <div class="mobile-card-icon swalook-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                  </div>
                  <div class="mobile-card-content">
                    <div class="mobile-card-title">Swalook CRM</div>
                    <div class="mobile-card-desc">Enterprise SaaS</div>
                  </div>
                </a>

                <a href="${vinitiniHref}" class="mobile-card">
                  <div class="mobile-card-icon vinitini-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                  </div>
                  <div class="mobile-card-content">
                    <div class="mobile-card-title">Vini-Tini</div>
                    <div class="mobile-card-desc">Mixology Platform</div>
                  </div>
                </a>

                <a href="${genuinestHref}" class="mobile-card">
                  <div class="mobile-card-icon genuinest-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/></svg>
                  </div>
                  <div class="mobile-card-content">
                    <div class="mobile-card-title">Genuinest</div>
                    <div class="mobile-card-desc">Community Commerce</div>
                  </div>
                </a>
              </div>

              <a href="${projectsHref}" class="mobile-all-projects">
                <span>Explore All 10+ Projects</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </a>

              <div class="mobile-section-label">Connect & Resources</div>
              <div class="mobile-social-row">
                <a href="${githubHref}" target="_blank" rel="noopener noreferrer" class="mobile-social-pill">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
                  <span>GitHub</span>
                </a>
                <a href="${linkedinHref}" target="_blank" rel="noopener noreferrer" class="mobile-social-pill">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                  <span>LinkedIn</span>
                </a>
                <a href="${designSystemHref}" class="mobile-social-pill">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 10 10 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                  <span>Design System</span>
                </a>
                <a href="${privacyHref}" class="mobile-social-pill">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <span>Privacy</span>
                </a>
                <a href="${emailHref}" class="mobile-social-pill highlight">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  <span>Let's Talk</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- SVG Alpha-Threshold Filter for Gooey Effect (Natively 100% Transparent, zero black artifacts) -->
        <svg class="gooey-svg-filter" aria-hidden="true" style="position: absolute; width: 0; height: 0; pointer-events: none; overflow: hidden;">
          <defs>
            <filter id="gooeyNavFilter" x="-60%" y="-100%" width="220%" height="300%" color-interpolation-filters="sRGB">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -8" result="goo" />
              <feComposite in="SourceGraphic" in2="goo" operator="atop" />
            </filter>
          </defs>
        </svg>
      </header>
    `;
  }

  // Accessibility management for navbar visibility (called by scroll-reveal.js and overlay lifecycle)
  /**
   * Loads the GooeyNav effect (hover/active pill + bubble particles) for the
   * nav rails. Lazy and non-blocking: the effect script is only fetched
   * once the navbar has been injected, and failures degrade silently to the
   * plain rail.
   */
  function loadGooeyEffect() {
    if (document.getElementById('gooeyNavScript')) {
      if (window.initGooeyNav) {
        const nav = document.getElementById('glassNav');
        if (nav) window.initGooeyNav(nav);
      }
      return;
    }
    const script = document.createElement('script');
    script.id = 'gooeyNavScript';
    script.src = '/js/components/gooey-nav.js';
    script.defer = true;
    script.onerror = function () { script.remove(); };
    document.head.appendChild(script);
  }

  function setNavbarAccessibility(nav, visible) {
    if (!nav) return;
    if (visible) {
      nav.classList.add('visible');
      nav.removeAttribute('aria-hidden');
      try { nav.inert = false; } catch { }
    } else {
      nav.classList.remove('visible');
      nav.setAttribute('aria-hidden', 'true');
      try { nav.inert = true; } catch { }

      // If focus is within the navbar when hiding, move it to body to avoid invisible focus trap
      if (nav.contains(document.activeElement)) {
        try { document.activeElement.blur(); } catch { }
      }
    }
  }

  function insertNav() {
    // If a glassNav already exists, replace it for consistency
    const existing = document.getElementById("glassNav");
    const html = buildNavHTML();

    if (existing) {
      existing.outerHTML = html;
    } else {
      document.body.insertAdjacentHTML("afterbegin", html);
    }

    const nav = document.getElementById("glassNav");
    if (!nav) return;

    // 1. Setup Dynamic Island mobile toggle
    const toggle = document.getElementById("navToggle");
    const expandedContent = document.getElementById("islandExpandedContent");
    const overlay = document.getElementById("mobileOverlay");

    if (toggle && expandedContent) {
      try { expandedContent.inert = true; } catch { }
      const onEsc = (e) => {
        if (e.key === 'Escape') {
          setOpen(false);
          setTimeout(() => toggle.focus({ preventScroll: true }), 0);
        }
      };

      let closeTimer = null;

      const setOpen = (open) => {
        if (closeTimer) {
          clearTimeout(closeTimer);
          closeTimer = null;
        }

        if (open) {
          nav.classList.remove('is-closing');
          nav.classList.add('open', 'visible');
          nav.removeAttribute('aria-hidden');
          try { nav.inert = false; } catch { }
          expandedContent.setAttribute('aria-hidden', 'false');
          try { expandedContent.inert = false; } catch { }
          toggle.setAttribute('aria-expanded', 'true');
          toggle.setAttribute('aria-label', 'Close menu');
          document.body.classList.add('no-scroll', 'nav-open');

          document.addEventListener('keydown', onEsc);
          // Re-measure gooey pill after island expansion transition begins & finishes
          requestAnimationFrame(() => {
            if (window.repositionGooeyNav) window.repositionGooeyNav();
          });
          setTimeout(() => {
            if (window.repositionGooeyNav) window.repositionGooeyNav();
          }, 80);
          setTimeout(() => {
            if (window.repositionGooeyNav) window.repositionGooeyNav();
          }, 240);
          setTimeout(() => {
            if (window.repositionGooeyNav) window.repositionGooeyNav();
          }, 360);

          const firstFocusable = expandedContent.querySelector('a, button, [tabindex]:not([tabindex="-1"])');
          if (firstFocusable) {
            setTimeout(() => firstFocusable.focus({ preventScroll: true }), 100);
          }
        } else {
          if (expandedContent.contains(document.activeElement)) {
            try { toggle.focus({ preventScroll: true }); } catch { }
          }
          document.removeEventListener('keydown', onEsc);

          nav.classList.remove('open');
          nav.classList.add('is-closing');
          expandedContent.setAttribute('aria-hidden', 'true');
          try { expandedContent.inert = true; } catch { }
          toggle.setAttribute('aria-expanded', 'false');
          toggle.setAttribute('aria-label', 'Open menu');

          closeTimer = setTimeout(() => {
            nav.classList.remove('is-closing');
            document.body.classList.remove('no-scroll', 'nav-open');
            // Restore desktop-like visibility: setOpen(true) forces
            // `visible`, so without this the bar stays stuck visible on
            // the unreleased hero stepper. Ground truth: hidden while
            // the stepper is unreleased, visible once released (or when
            // no stepper exists on the page).
            const ov = document.querySelector('.text-reveal-container');
            setNavbarAccessibility(nav, !ov || ov.classList.contains('released'));
            closeTimer = null;
          }, 280);
        }
      };

      toggle.addEventListener("click", () => {
        if (nav.classList.contains('is-closing')) return;
        const willOpen = !nav.classList.contains('open');
        setOpen(willOpen);
      });

      toggle.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (nav.classList.contains('is-closing')) return;
          const willOpen = !nav.classList.contains('open');
          setOpen(willOpen);
        }
      });

      if (overlay) {
        overlay.addEventListener("click", () => setOpen(false));
      }

      // Close when clicking the outer header padding or overlay backdrop
      nav.addEventListener("click", (e) => {
        if ((nav.classList.contains("open") || nav.classList.contains("is-closing")) && (e.target === nav || e.target === overlay)) {
          setOpen(false);
        }
      });

      // Close when clicking the identity brand while menu is open
      const brand = document.getElementById("glassNavBrand");
      if (brand) {
        brand.addEventListener("click", () => {
          if (nav.classList.contains("open") || nav.classList.contains("is-closing")) {
            setOpen(false);
          }
        });
      }

      expandedContent.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
          setOpen(false);
          setTimeout(() => toggle.focus({ preventScroll: true }), 0);
        });
      });

      const onResize = () => {
        if (window.innerWidth > 860 && (nav.classList.contains('open') || nav.classList.contains('is-closing'))) {
          setOpen(false);
        }
        if (window.repositionGooeyNav) {
          window.repositionGooeyNav();
        }
      };
      window.addEventListener('resize', onResize, { passive: true });
      window.addEventListener('orientationchange', onResize, { passive: true });

      const onNavigate = () => setOpen(false);
      window.addEventListener('hashchange', onNavigate);
      window.addEventListener('popstate', onNavigate);
    }

    // 2. Setup Multi-Dropdown Support (Projects & More on desktop)
    const dropdowns = Array.from(nav.querySelectorAll('.nav-dropdown'));
    dropdowns.forEach((dd) => {
      const btn = dd.querySelector('.nav-dropdown-toggle');
      if (!btn) return;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dd.classList.contains('open');
        // Close any other open dropdown first
        dropdowns.forEach((other) => {
          if (other !== dd) {
            other.classList.remove('open');
            const otherBtn = other.querySelector('.nav-dropdown-toggle');
            if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
          }
        });

        // Toggle this dropdown
        dd.classList.toggle('open', !isOpen);
        btn.setAttribute('aria-expanded', String(!isOpen));
      });

      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          btn.setAttribute('aria-expanded', 'false');
          dd.classList.remove('open');
          btn.focus({ preventScroll: true });
        }
      });
    });

    // Light dismiss for dropdowns on outside click
    document.addEventListener('click', (e) => {
      dropdowns.forEach((dd) => {
        if (!dd.contains(e.target)) {
          const btn = dd.querySelector('.nav-dropdown-toggle');
          if (btn) btn.setAttribute('aria-expanded', 'false');
          dd.classList.remove('open');
        }
      });
    });

    // Close dropdowns on Global Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dropdowns.forEach((dd) => {
          if (dd.classList.contains('open')) {
            const btn = dd.querySelector('.nav-dropdown-toggle');
            if (btn) {
              btn.setAttribute('aria-expanded', 'false');
              btn.focus({ preventScroll: true });
            }
            dd.classList.remove('open');
          }
        });
      }
    });

    // 2.5 Gooey hover/active nav effect (desktop & mobile rails)
    loadGooeyEffect();

    // 3. Visibility behavior with hero reveal overlay
    // Hidden during the stepper on all viewports, visible after release.
    const syncVisibility = () => {
      const ov = document.querySelector('.text-reveal-container');
      if (!ov || ov.classList.contains('released')) {
        setNavbarAccessibility(nav, true);
      } else {
        setNavbarAccessibility(nav, false);
      }
    };
    const overlayEl = document.querySelector('.text-reveal-container');
    const isReleased = overlayEl && overlayEl.classList.contains('released');
    if (!overlayEl || isReleased) {
      setNavbarAccessibility(nav, true);
    } else {
      setNavbarAccessibility(nav, false);
    }
    if (overlayEl && !isReleased) {
      try {
        const mo = new MutationObserver(() => {
          if (overlayEl.classList.contains('released')) {
            syncVisibility();
            mo.disconnect();
          }
        });
        mo.observe(overlayEl, { attributes: true, attributeFilter: ['class'] });
      } catch { /* noop */ }
    }
    try {
      const mq = window.matchMedia('(max-width: 860px)');
      const onBpChange = () => {
        // Never fight an open/closing menu: visibility is owned by
        // setOpen until the close transition fully settles.
        if (nav.classList.contains('open') || nav.classList.contains('is-closing')) return;
        syncVisibility();
      };
      if (mq && mq.addEventListener) mq.addEventListener('change', onBpChange);
      else window.addEventListener('resize', onBpChange, { passive: true });
    } catch { /* noop */ }
  }

  // Expose navbar accessibility function globally for other components
  window.setNavbarAccessibility = setNavbarAccessibility;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', insertNav);
  } else {
    insertNav();
  }
})();
