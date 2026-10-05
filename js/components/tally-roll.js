/**
 * Tally Roll, numbers that count up once when they scroll into view.
 *
 * Markup keeps the real number for no-JS readers and crawlers:
 *   <span data-tally="32">32</span>, <span data-tally="35" data-tally-suffix="+">35+</span>
 *
 * Brief (docs/motion-zen.md section 6a, picked "Count up 800ms"): once per
 * page view at 40% visible, 800ms on the snap curve, mono tabular digits
 * (CSS) so the width never moves. Screen readers always get the final
 * value through aria-label. Reduced motion: the final number, no count.
 *
 * Also exposes window.SnapEase(t), the snap curve as a function, for other
 * scripted motion (Digit Odometer, Commit Field).
 *
 * @file js/components/tally-roll.js
 */
(function () {
    'use strict';

    var DURATION = 800;

    /* cubic-bezier(0.16, 1, 0.3, 1), solved for y at time t. */
    function bezier(p1x, p1y, p2x, p2y) {
        function a(a1, a2) { return 1 - 3 * a2 + 3 * a1; }
        function b(a1, a2) { return 3 * a2 - 6 * a1; }
        function c(a1) { return 3 * a1; }
        function calc(t, a1, a2) { return ((a(a1, a2) * t + b(a1, a2)) * t + c(a1)) * t; }
        function slope(t, a1, a2) { return 3 * a(a1, a2) * t * t + 2 * b(a1, a2) * t + c(a1); }
        return function (x) {
            if (x <= 0) return 0;
            if (x >= 1) return 1;
            var t = x;
            for (var i = 0; i < 8; i++) {
                var s = slope(t, p1x, p2x);
                if (Math.abs(s) < 1e-6) break;
                t -= (calc(t, p1x, p2x) - x) / s;
            }
            return calc(Math.min(1, Math.max(0, t)), p1y, p2y);
        };
    }

    var snap = bezier(0.16, 1, 0.3, 1);
    try {
        if (!window.SnapEase) window.SnapEase = snap;
    } catch (e) { /* noop */ }

    function reduced() {
        try {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) {
            return false;
        }
    }

    function format(n, el) {
        var decimals = Number(el.getAttribute('data-tally-decimals') || 0);
        var text = n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        return text + (el.getAttribute('data-tally-suffix') || '');
    }

    function play(el, target) {
        var start = performance.now();
        function frame(now) {
            var p = Math.min(1, (now - start) / DURATION);
            el.textContent = format(target * snap(p), el);
            if (p < 1) requestAnimationFrame(frame);
            else el.textContent = format(target, el);
        }
        requestAnimationFrame(frame);
    }

    function mount(el) {
        var target = Number(el.getAttribute('data-tally'));
        if (!isFinite(target)) return null;
        el.classList.add('tally');
        el.setAttribute('aria-label', format(target, el));
        if (reduced() || !('IntersectionObserver' in window)) {
            el.textContent = format(target, el);
            return null;
        }
        el.textContent = format(0, el);
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                io.disconnect();
                play(el, target);
            });
        }, { threshold: 0.4 });
        io.observe(el);
        return io;
    }

    function unmount(el, io) {
        if (io) io.disconnect();
    }

    try {
        window.TallyRoll = { format: format };
    } catch (e) { /* noop */ }

    if (window.Mount) {
        window.Mount.register('tally-roll', { selector: '[data-tally]', mount: mount, unmount: unmount });
    }
})();
