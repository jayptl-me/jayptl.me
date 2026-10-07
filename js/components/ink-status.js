/**
 * Ink Status, the site's one loading, success and error mark.
 *
 * A hand-drawn loop whose stroke travels while waiting, then closes and
 * draws a check (success) or a cross (error). Every state change can be
 * paired with a spoken message through InkStatus.say(), so colour and
 * motion are never the only signal.
 *
 *   var mark = InkStatus.make();          // <svg class="ink-status">
 *   InkStatus.set(mark, 'loading');       // 'loading' | 'ok' | 'bad' | 'idle'
 *   InkStatus.say('Slots loaded');        // polite live region
 *
 * Markup hosts can ask for one: <span data-ink-status></span> gets a mark
 * on DOMContentLoaded and on every router swap (page:ready).
 *
 * Brief (docs/motion-zen.md section 6b): loop travels at 1.2s per turn,
 * closes in 240ms, the check or cross draws in 320ms on the snap curve.
 * Reduced motion: static loop, then a static check or cross (CSS).
 *
 * @file js/components/ink-status.js
 */
(function () {
    'use strict';

    if (window.InkStatus) return;

    var NS = 'http://www.w3.org/2000/svg';
    var LOOP = 'M12 3.5c4.9-.3 8.6 3.1 8.4 7.6-.2 4.8-4.2 8.6-8.9 8.4-4.4-.2-7.6-3.7-7.4-8 .2-4.1 3.4-7.3 7.2-7.6 2.6-.2 4.9 1 6 3.1';
    var CHECK = 'M8 12.4l2.7 2.7L16.3 9';
    var CROSS = 'M8.6 8.6l6.8 6.8M15.4 8.6l-6.8 6.8';
    var STATES = ['is-loading', 'is-ok', 'is-bad'];

    function path(cls, d) {
        var p = document.createElementNS(NS, 'path');
        p.setAttribute('class', cls);
        p.setAttribute('pathLength', '1');
        p.setAttribute('d', d);
        return p;
    }

    function make(extraClass) {
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class', 'ink-status' + (extraClass ? ' ' + extraClass : ''));
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        svg.appendChild(path('ink-loop', LOOP));
        svg.appendChild(path('ink-check', CHECK));
        svg.appendChild(path('ink-cross', CROSS));
        return svg;
    }

    function set(svg, state) {
        if (!svg) return;
        STATES.forEach(function (c) { svg.classList.remove(c); });
        if (state === 'loading') svg.classList.add('is-loading');
        else if (state === 'ok') svg.classList.add('is-ok');
        else if (state === 'bad') svg.classList.add('is-bad');
    }

    function liveRegion() {
        var el = document.getElementById('inkStatusLive');
        if (!el) {
            el = document.createElement('div');
            el.id = 'inkStatusLive';
            el.className = 'sr-only';
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            document.body.appendChild(el);
        }
        return el;
    }

    function say(text) {
        var el = liveRegion();
        // Clear first so the same message twice is still announced.
        el.textContent = '';
        setTimeout(function () { el.textContent = text || ''; }, 30);
    }

    function scan(root) {
        (root || document).querySelectorAll('[data-ink-status]:not([data-ink-ready])').forEach(function (host) {
            host.setAttribute('data-ink-ready', '');
            host.appendChild(make(host.getAttribute('data-ink-status') || ''));
        });
    }

    window.InkStatus = { make: make, set: set, say: say, scan: scan };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { scan(); });
    } else {
        scan();
    }
    document.addEventListener('page:ready', function () { scan(); });
})();
