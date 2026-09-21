/**
 * Doodle System (Gate P redesign)
 * - Sprite is inlined once per page as <svg id="doodleSprite"> (canonical
 *   copy of assets/doodle-sprite.svg). No fetch: zero extra requests, no
 *   FOUC, works on file://. ensureSprite() only warns when a page uses
 *   <use href="#d-..."> without the inline sprite.
 * - Reset stickers toy: re-rolls sticker rotation (--r) within +/-12deg.
 * - Draw-on: opt-in INLINE svg.doodle-draw / svg.icon-draw only (sprite
 *   <use> clones live in shadow DOM and cannot be dash-animated). Shapes
 *   carry pathLength="1", so CSS animates dashoffset 1 -> 0; JS only
 *   staggers via --d and toggles .is-drawn on IntersectionObserver.
 * - Caps .sticker--idle to one sticker so the ambient bob never multiplies.
 * - Fills the footer "Updated <time>" from document.lastModified.
 * All effects are progressive enhancements; no-js keeps static art fully
 * drawn, and prefers-reduced-motion collapses to fully drawn.
 *
 * @file components/doodle.js
 */
(function () {
    'use strict';

    /* Owned handles so seamless revisits can re-scan without leaking. */
    var drawObserver = null;
    var caseRailHandler = null;

    /* ---- Inline sprite guard (no fetch) ------------------------------------ */
    function ensureSprite() {
        if (document.getElementById('doodleSprite')) return;
        try {
            if (document.querySelector('use[href^="#d-"]')) {
                if (window.console && typeof console.warn === 'function') {
                    console.warn('[doodle] page uses #d-… symbols without an inline #doodleSprite');
                }
            }
        } catch (e) { /* selector support varies; sprite check is advisory */ }
    }

    /* ---- Reset stickers toy ---------------------------------------------- */
    function randomRotation() {
        // Cap variance at the +/-12deg standing law (dossier 02 anti-pattern 8)
        return (Math.random() * 24 - 12).toFixed(1) + 'deg';
    }

    function initStickerReset() {
        var btn = document.getElementById('resetStickers');
        var zone = document.getElementById('stickerZone');
        if (!btn || !zone) return;
        btn.addEventListener('click', function () {
            var stickers = zone.querySelectorAll('.sticker');
            stickers.forEach(function (sticker) {
                sticker.style.setProperty('--r', randomRotation());
            });
            // Gentle feedback sound where available
            if (window.SoundManager) window.SoundManager.playHoverSound();
        });
    }

    /* ---- Footer "Updated" date from document.lastModified ---------------- */
    function initUpdatedDate() {
        var el = document.getElementById('footerUpdated');
        if (!el) return;
        try {
            var d = new Date(document.lastModified);
            if (!isNaN(d.getTime())) {
                el.textContent = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                el.setAttribute('datetime', d.toISOString());
            }
        } catch (e) { /* leave the fallback text */ }
    }

    /* ---- Case-study numbered side-rail scrollspy ------------------------- */
    function initCaseRail() {
        if (caseRailHandler) {
            try { window.removeEventListener('scroll', caseRailHandler); } catch (e) { /* noop */ }
            caseRailHandler = null;
        }
        var rail = document.querySelector('.case-rail');
        if (!rail) return;
        var links = Array.from(rail.querySelectorAll('a'));
        var targets = links
            .map(function (a) {
                var el = document.querySelector(a.getAttribute('href'));
                return el ? { link: a, el: el } : null;
            })
            .filter(Boolean);
        if (targets.length < 2) return;

        var onScroll = function () {
            var pos = window.scrollY + 140; // offset for fixed nav
            var current = targets[0];
            for (var i = 0; i < targets.length; i++) {
                if (pos >= targets[i].el.getBoundingClientRect().top + window.scrollY) {
                    current = targets[i];
                }
            }
            targets.forEach(function (t) {
                t.link.classList.toggle('active', t === current);
            });
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        caseRailHandler = onScroll;
        onScroll();
    }

    /* ---- Hand-drawn draw-on (pathLength=1 CSS, zero measuring) ------------- */
    /* Opt-in: add class="doodle-draw" (or "icon-draw") to an INLINE svg (not
       a <use> sprite instance, shadow-DOM clones can't be dash-animated).
       Every stroked shape carries pathLength="1", so doodle.css hides
       strokes with stroke-dashoffset:1 and draws them to 0 on .is-drawn.
       JS only staggers children via --d and flips the class on first
       reveal. Respects prefers-reduced-motion (collapses to fully drawn). */
    function initDoodleDraw() {
        if (drawObserver) {
            try { drawObserver.disconnect(); } catch (e) { /* noop */ }
            drawObserver = null;
        }
        var drawings = document.querySelectorAll('.doodle-draw, .icon-draw');
        if (!drawings.length) return;
        var reduceMotion = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion || !('IntersectionObserver' in window)) {
            drawings.forEach(function (el) { el.classList.add('is-drawn'); });
            return;
        }
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var el = entry.target;
                io.unobserve(el);
                var shapes = el.tagName.toLowerCase() === 'svg'
                    ? el.querySelectorAll('path, circle, ellipse, line, polyline, polygon, rect')
                    : [el];
                shapes.forEach(function (s, i) {
                    s.style.setProperty('--d', (Math.min(i, 12) * 90) + 'ms');
                });
                // Two frames so per-shape --d values apply before the flip.
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () {
                        el.classList.add('is-drawn');
                    });
                });
            });
        }, { threshold: 0.4 });
        drawObserver = io;
        drawings.forEach(function (el) { io.observe(el); });
    }

    /* ---- Cap ambient idle bob to ONE sticker ----------------------------- */
    function capIdleStickers() {
        var idle = document.querySelectorAll('.sticker--idle');
        idle.forEach(function (el, i) {
            if (i > 0) el.classList.remove('sticker--idle');
        });
    }

    function init() {
        ensureSprite();
        initDoodleDraw();
        capIdleStickers();
        initStickerReset();
        initUpdatedDate();
        initCaseRail();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* Re-scan hook for seamless revisits (same document shell). */
    try {
        window.Doodle = { init: init };
    } catch (e) { /* noop */ }
})();
