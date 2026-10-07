"use strict";

/**
 * Small page behaviors that used to live in inline scripts and handlers.
 * Kept external so the Content-Security-Policy can drop 'unsafe-inline'.
 *
 * - [data-action="print"]: opens the print dialog (resume page).
 * - <body data-nav-visible>: shows the injected navbar right away
 *   (design-system page).
 * - a.resume-track[download]: the tile shows the Ink Status check for
 *   1.6s and says "Download started" (the browser owns the download
 *   itself, so this confirms the start, never a finish it cannot see).
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

    var SETTLE_MS = 1600;

    document.addEventListener('click', function (event) {
        var tile = event.target.closest && event.target.closest('a.resume-track[download]');
        if (!tile || !window.InkStatus) return;
        var ink = tile.querySelector(':scope > .ink-status');
        if (!ink) {
            ink = window.InkStatus.make();
            tile.appendChild(ink);
        }
        window.InkStatus.set(ink, 'idle');
        // Next frame, so the check draws even on a second click.
        requestAnimationFrame(function () { window.InkStatus.set(ink, 'ok'); });
        var name = tile.querySelector('.resume-track-name');
        window.InkStatus.say('Download started, ' + (name ? name.textContent.trim() : 'resume') + ' one-pager');
        clearTimeout(tile._inkTimer);
        tile._inkTimer = setTimeout(function () {
            if (ink.parentNode) ink.parentNode.removeChild(ink);
        }, SETTLE_MS + 560);
    });

    // Design system page: the state demos on the pill family tile.
    document.addEventListener('click', function (event) {
        var demo = event.target.closest && event.target.closest('[data-demo-busy], [data-demo-hold]');
        if (!demo || !window.PillPress) return;
        if (demo.hasAttribute('data-demo-hold')) {
            window.PillPress.flash(demo, true, 'Confirmed after the hold');
            return;
        }
        var ok = demo.getAttribute('data-demo-busy') === 'ok';
        window.PillPress.busy(demo, new Promise(function (resolve, reject) {
            setTimeout(ok ? resolve : function () { reject(new Error('demo')); }, 1200);
        }), { loading: 'Working', ok: 'Done', bad: 'That did not work' }).catch(function () {});
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
