/**
 * Glide Wheel, eased scrolling for desktop mouse wheels only.
 *
 * Brief (docs/motion-zen.md section 6a, picked "Calm, about 1s"):
 * - Each mouse-wheel notch moves a target; the page eases toward it with a
 *   frame-rate independent exponential ease that settles in about 1s,
 *   the continuous form of the snap curve's expo-out tail.
 * - Trackpads, touch, keyboard, scrollbar drags and pinch-zoom stay
 *   native. Trackpads are told apart by fractional, sideways or small
 *   fine-grained deltas; anything uncertain stays native.
 * - Hand-off: off while the home stepper holds the page, native inside
 *   the scroll-stack section (it has its own damping), native inside any
 *   element that can still scroll that way, off while the page is locked
 *   (Command Deck, mobile island, consent dialog).
 * - Any native input cancels a glide in flight. Router swaps reset it.
 * - prefers-reduced-motion: off entirely.
 *
 * API: window.ScrollGlide.to(yOrElement), .stop(), .isGliding()
 *
 * @file js/components/scroll-glide.js
 */
(function () {
    'use strict';

    if (window.ScrollGlide) return;

    var TAU = 185;            // ms; 5.3 x TAU ~ 1s to settle within half a pixel
    var LINE_PX = 40;         // deltaMode 1 (lines) to pixels
    var MIN_NOTCH = 50;       // smaller integer steps are treated as trackpad or accelerated wheels
    var GESTURE_GAP = 180;    // ms of silence that ends a wheel gesture
    var EXTERNAL_DRIFT = 3;   // px of scroll we did not cause that means someone else scrolled

    var target = 0;
    var current = 0;
    var raf = 0;
    var last = 0;
    var gliding = false;
    var lastSetY = -1;
    var gestureKind = null;   // 'mouse' | 'native'
    var gestureAt = 0;
    var reduced = false;

    function motionQuery() {
        try {
            return window.matchMedia('(prefers-reduced-motion: reduce)');
        } catch (e) {
            return null;
        }
    }

    function maxScroll() {
        var doc = document.documentElement;
        return Math.max(0, doc.scrollHeight - window.innerHeight);
    }

    function clamp(v) {
        return Math.min(maxScroll(), Math.max(0, v));
    }

    function setScroll(y) {
        lastSetY = Math.round(y);
        try {
            window.scrollTo({ top: y, left: window.scrollX, behavior: 'instant' });
        } catch (e) {
            window.scrollTo(window.scrollX, y);
        }
    }

    function stop() {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        gliding = false;
        lastSetY = -1;
    }

    function frame(now) {
        var dt = Math.min(64, now - last || 16);
        last = now;
        target = clamp(target);
        current += (target - current) * (1 - Math.exp(-dt / TAU));
        if (Math.abs(target - current) < 0.5) {
            current = target;
            setScroll(current);
            stop();
            return;
        }
        setScroll(current);
        raf = requestAnimationFrame(frame);
    }

    function start() {
        if (gliding) return;
        gliding = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
    }

    function glideBy(dy) {
        if (!gliding) {
            current = window.scrollY;
            target = current;
        }
        target = clamp(target + dy);
        start();
    }

    function to(dest) {
        var y = dest;
        if (dest && typeof dest.getBoundingClientRect === 'function') {
            var pad = 0;
            try {
                pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
            } catch (e) { pad = 0; }
            y = dest.getBoundingClientRect().top + window.scrollY - pad;
        }
        if (typeof y !== 'number' || isNaN(y)) return;
        if (reduced) {
            setScroll(clamp(y));
            return;
        }
        if (!gliding) current = window.scrollY;
        target = clamp(y);
        start();
    }

    /* ---- When the glide must stay out ---------------------------------- */

    function stepperHolds() {
        var overlay = document.querySelector('.text-reveal-container');
        return Boolean(overlay && !overlay.classList.contains('released'));
    }

    function pageLocked() {
        var body = document.body;
        var html = document.documentElement;
        if (!body) return true;
        if (body.classList.contains('no-scroll') || body.classList.contains('nav-open') ||
            body.classList.contains('preloading') || html.classList.contains('no-scroll') ||
            html.classList.contains('deck-open')) return true;
        try {
            if (getComputedStyle(body).overflowY === 'hidden' || getComputedStyle(html).overflowY === 'hidden') return true;
        } catch (e) { /* noop */ }
        return false;
    }

    function insideScrollStack() {
        var stack = document.getElementById('scrollStackContainer');
        if (!stack || window.innerWidth <= 860) return false;
        var r = stack.getBoundingClientRect();
        return r.top <= 1 && r.bottom >= window.innerHeight - 1;
    }

    function nestedScroller(node, dy) {
        var el = node && node.nodeType === 1 ? node : node && node.parentElement;
        while (el && el !== document.body && el !== document.documentElement) {
            var style;
            try { style = getComputedStyle(el); } catch (e) { style = null; }
            if (style && /(auto|scroll|overlay)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1) {
                if (dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
                if (dy < 0 && el.scrollTop > 0) return true;
            }
            el = el.parentElement;
        }
        return false;
    }

    /* ---- Mouse wheel versus trackpad ----------------------------------- */

    function classify(e) {
        if (e.deltaMode === 1 || e.deltaMode === 2) return 'mouse';
        if (e.deltaX !== 0) return 'native';
        var dy = e.deltaY;
        if (!Number.isInteger(dy)) return 'native';
        // Chromium reports trackpads with wheelDeltaY exactly -3x deltaY.
        if (typeof e.wheelDeltaY === 'number' && e.wheelDeltaY !== 0 && e.wheelDeltaY === -3 * dy) return 'native';
        if (Math.abs(dy) < MIN_NOTCH) return 'native';
        return 'mouse';
    }

    function onWheel(e) {
        if (reduced || e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey) {
            if (gliding) stop();
            return;
        }
        var now = performance.now();
        if (!gestureKind || now - gestureAt > GESTURE_GAP) {
            // A gesture that starts while the stepper holds the page stays
            // native to its end, so the release scroll is never cut short.
            gestureKind = stepperHolds() ? 'native' : classify(e);
        }
        else if (gestureKind === 'mouse' && classify(e) === 'native' && e.deltaX !== 0) gestureKind = 'native';
        gestureAt = now;

        if (gestureKind !== 'mouse') {
            if (gliding) stop();
            return;
        }
        var dy = e.deltaY * (e.deltaMode === 1 ? LINE_PX : e.deltaMode === 2 ? window.innerHeight : 1);
        if (stepperHolds() || pageLocked() || insideScrollStack() || nestedScroller(e.target, dy)) {
            if (gliding) stop();
            return;
        }
        e.preventDefault();
        glideBy(dy);
    }

    function onNativeInput() {
        if (gliding) stop();
    }

    function onKey(e) {
        if (!gliding) return;
        var keys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar'];
        if (keys.indexOf(e.key) !== -1) stop();
    }

    function onScroll() {
        if (!gliding || lastSetY < 0) return;
        if (Math.abs(window.scrollY - lastSetY) > EXTERNAL_DRIFT &&
            Math.abs(window.scrollY - current) > EXTERNAL_DRIFT) {
            // Something else moved the page (scrollbar drag, find-in-page).
            stop();
        }
    }

    /* ---- Same-page anchors glide too ----------------------------------- */

    function onClick(e) {
        if (reduced || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
        if (!a) return;
        var id = a.getAttribute('href').slice(1);
        if (!id) return;
        var el = document.getElementById(id);
        if (!el || stepperHolds() || pageLocked()) return;
        e.preventDefault();
        to(el);
        try { history.pushState(history.state, '', '#' + id); } catch (err) { /* noop */ }
        if (!el.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
            el.setAttribute('tabindex', '-1');
        }
        try { el.focus({ preventScroll: true }); } catch (err) { /* noop */ }
    }

    function init() {
        var mq = motionQuery();
        reduced = Boolean(mq && mq.matches);
        if (mq) {
            var onChange = function () {
                reduced = mq.matches;
                if (reduced) stop();
            };
            if (mq.addEventListener) mq.addEventListener('change', onChange);
            else if (mq.addListener) mq.addListener(onChange);
        }
        window.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('touchstart', onNativeInput, { passive: true });
        window.addEventListener('pointerdown', onNativeInput, { passive: true });
        window.addEventListener('keydown', onKey);
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', function () { if (gliding) target = clamp(target); }, { passive: true });
        window.addEventListener('page:ready', stop);
        document.addEventListener('click', onClick);
    }

    init();

    window.ScrollGlide = {
        to: to,
        stop: stop,
        isGliding: function () { return gliding; }
    };
})();
