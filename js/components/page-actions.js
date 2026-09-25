"use strict";

/**
 * Small page behaviors that used to live in inline scripts and handlers.
 * Kept external so the Content-Security-Policy can drop 'unsafe-inline'.
 *
 * - [data-action="print"]: opens the print dialog (resume page).
 * - <body data-nav-visible>: shows the injected navbar right away
 *   (design-system page).
 *
 * @file js/components/page-actions.js
 */

(function () {
    if (window.__pageActionsBound) return;
    window.__pageActionsBound = true;

    // Delegated, so it also works after in-place page swaps.
    document.addEventListener('click', function (event) {
        var trigger = event.target.closest && event.target.closest('[data-action="print"]');
        if (!trigger) return;
        event.preventDefault();
        window.print();
    });

    function revealNav() {
        if (!document.body || !document.body.hasAttribute('data-nav-visible')) return;
        setTimeout(function () {
            var navbar = document.getElementById('glassNav');
            if (navbar) navbar.classList.add('visible');
        }, 100);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', revealNav);
    } else {
        revealNav();
    }
})();
