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
    function buildNavHTML() {
        const onHome = location.pathname === "/" || /index\.html?$/.test(location.pathname);
        const projectsHref = onHome ? "#projects" : "/#projects";

        return `
      <header id="glassNav" class="glass-nav" aria-label="Primary Navigation" role="banner">
        <nav class="glass-nav-inner" role="navigation" aria-label="Primary">
          <button class="nav-toggle" id="navToggle" aria-label="Toggle navigation" aria-expanded="false" aria-controls="navMenu">
            <span class="nav-toggle-bar"></span>
            <span class="nav-toggle-bar"></span>
            <span class="nav-toggle-bar"></span>
          </button>

          <div class="nav-left" id="navMenu">
            <a href="/" class="nav-link" aria-label="Home">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 3l9 8h-3v9h-5v-6H11v6H6v-9H3z"/></svg>
              <span class="nav-text">Home</span>
            </a>
            <a href="${projectsHref}" class="nav-link" aria-label="Projects">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
              <span class="nav-text">Projects</span>
            </a>
            <a href="/privacy.html" class="nav-link" aria-label="Privacy">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 1L3 5v6c0 5 3.8 9.7 9 11 5.2-1.3 9-6 9-11V5l-9-4zm0 18.9C8.1 18.3 5.5 14.9 5.1 11h13.8c-.4 3.9-3 7.3-6.9 8.9zM19 9H5V6.3l7-3.1 7 3.1V9z"/></svg>
              <span class="nav-text">Privacy</span>
            </a>
          </div>

          <div class="nav-center">
            <a href="/" id="glassNavBrand" class="nav-brand" aria-label="Brand" tabindex="0">Jay Patel</a>
          </div>

          <div class="nav-right">
            <button class="theme-toggle" id="themeToggle" aria-label="Toggle dark/light mode" tabindex="0">
              <svg class="sun-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2a7 7 0 1 1 0-14 7 7 0 0 1 0 14zm0-15a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0V5a1 1 0 0 1 1-1zm0 15a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0v-1a1 1 0 0 1 1-1zm9-9h-1a1 1 0 0 1 0-2h1a1 1 0 0 1 0 2zM4 12H3a1 1 0 0 1 0-2h1a1 1 0 0 1 0 2zm14.95-5.05a1 1 0 0 1 0 1.414l-.707.707a1 1 0 1 1-1.414-1.414l.707-.707a1 1 0 0 1 1.414 0zm-11.9 11.9a1 1 0 0 1 0 1.414l-.707.707a1 1 0 0 1-1.414-1.414l.707-.707a1 1 0 0 1 1.414 0z" />
              </svg>
              <svg class="moon-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M10 7a7 7 0 0 0 12 4.9v.1c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2h.1A6.979 6.979 0 0 0 10 7zm-6 5a8 8 0 0 0 15.062 3.762A9 9 0 0 1 8.238 4.938 7.999 7.999 0 0 0 4 12z" />
              </svg>
            </button>

            <a href="https://github.com/jayptl-me" class="icon-btn" target="_blank" rel="noopener" aria-label="GitHub">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.9-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.57 2.34 1.11 2.91.85.09-.66.35-1.11.64-1.37-2.22-.26-4.56-1.14-4.56-5.09 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.3.1-2.7 0 0 .85-.28 2.8 1.05a9.43 9.43 0 0 1 5.1 0c1.95-1.33 2.8-1.05 2.8-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.64 1.03 2.76 0 3.96-2.34 4.82-4.57 5.07.36.32.68.95.68 1.92 0 1.38-.01 2.5-.01 2.84 0 .27.18.6.69.49A10.04 10.04 0 0 0 22 12.26C22 6.58 17.52 2 12 2z"/></svg>
            </a>
            <a href="https://www.linkedin.com/in/jayptl/" class="icon-btn" target="_blank" rel="noopener" aria-label="LinkedIn">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8.5h4V24h-4V8.5zM8.5 8.5h3.8v2.1h.1c.5-1 1.8-2.1 3.7-2.1 4 0 4.8 2.6 4.8 6v9.5h-4V15.8c0-2 0-4.5-2.7-4.5-2.7 0-3.1 2.1-3.1 4.3V24h-4V8.5z"/></svg>
            </a>
          </div>
        </nav>
      </header>
    `;
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

        // Setup mobile toggling
        const nav = document.getElementById("glassNav");
        const toggle = document.getElementById("navToggle");
        const menu = document.getElementById("navMenu");
        if (toggle && menu) {
            toggle.addEventListener("click", () => {
                const open = nav.classList.toggle("open");
                toggle.setAttribute("aria-expanded", String(open));
            });
        }

        // Visibility behavior
        const overlay = document.querySelector('.text-reveal-container');
        const isReleased = overlay && overlay.classList.contains('released');
        if (!overlay || isReleased) {
            nav.classList.add('visible');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', insertNav);
    } else {
        insertNav();
    }
})();
