/**
 * Role Ledger, experience rows that expand to their details.
 *
 * Content ships as real HTML on <details>/<summary>, so it works with no
 * JS, prints, and is read by crawlers. This helper only adds the motion.
 *
 * Brief (docs/motion-zen.md section 6a, picked "Clip reveal"): the space
 * opens at once (height is never animated), then the body is revealed
 * top to bottom by a 240ms snap clip with lines staggered 30ms. Closing
 * fades the body out in 140ms, together, before the row collapses.
 * Reduced motion: native open and close, no animation.
 *
 * Markup:
 *   <div class="role-ledger" data-component="role-ledger">
 *     <details class="role">
 *       <summary class="role-head">...</summary>
 *       <div class="role-body">...</div>
 *     </details>
 *   </div>
 *
 * @file js/components/role-ledger.js
 */
(function () {
    'use strict';

    var CLOSE_MS = 140;

    function reduced() {
        try {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) {
            return false;
        }
    }

    function indexLines(details) {
        var body = details.querySelector('.role-body');
        if (!body) return;
        var lines = body.querySelectorAll(':scope > *, :scope > ul > li');
        for (var i = 0; i < lines.length; i++) {
            lines[i].style.setProperty('--line', String(Math.min(i, 8)));
        }
    }

    function sound(kind) {
        try {
            var sm = window.SoundManager;
            if (sm && kind === 'open' && typeof sm.playSelectSound === 'function') sm.playSelectSound();
        } catch (e) { /* noop */ }
    }

    function mount(root) {
        var rows = Array.from(root.querySelectorAll('details.role'));
        var handlers = [];
        rows.forEach(function (details) {
            indexLines(details);
            var summary = details.querySelector('summary');
            if (!summary) return;
            var onClick = function (e) {
                if (reduced()) return;
                if (details.open) {
                    // Fade out first, collapse after; exit is faster than entry.
                    e.preventDefault();
                    if (details.classList.contains('is-closing')) return;
                    details.classList.remove('is-revealing');
                    details.classList.add('is-closing');
                    setTimeout(function () {
                        details.open = false;
                        details.classList.remove('is-closing');
                    }, CLOSE_MS);
                }
            };
            var onToggle = function () {
                if (!details.open) return;
                sound('open');
                if (reduced()) return;
                details.classList.remove('is-revealing');
                // Restart the reveal on the next frame.
                requestAnimationFrame(function () {
                    details.classList.add('is-revealing');
                });
            };
            summary.addEventListener('click', onClick);
            details.addEventListener('toggle', onToggle);
            handlers.push({ summary: summary, details: details, onClick: onClick, onToggle: onToggle });
        });
        return handlers;
    }

    function unmount(root, handlers) {
        (handlers || []).forEach(function (h) {
            h.summary.removeEventListener('click', h.onClick);
            h.details.removeEventListener('toggle', h.onToggle);
        });
    }

    if (window.Mount) {
        window.Mount.register('role-ledger', { mount: mount, unmount: unmount });
    }
})();
