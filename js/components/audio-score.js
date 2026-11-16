/**
 * Audio Score Component
 * Score wiring. Observes homepage sections and generic anchors and
 * shifts the ambient bed per room; sections themselves make no sound,
 * motion carries them (D-146). Hover is silent. Taps on pills,
 * stickers and filters voice a select. Router aware for soft
 * navigations; the page change itself is silent.
 *
 * Everything is gated on the master pref and stays silent by default.
 * No audio files, no network, no blocking of taps or scroll.
 *
 * @file js/components/audio-score.js
 * @author Jay Patel
 */
(function () {
    'use strict';

    function sound() {
        try {
            return window.SoundManager || null;
        } catch {
            return null;
        }
    }

    function masterOn() {
        try {
            var sm = sound();
            return Boolean(sm && sm.prefs && sm.prefs.master);
        } catch {
            return false;
        }
    }

    function reducedMotion() {
        try {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch {
            return false;
        }
    }

    // Home section to motif name. Generic anchors can use
    // data-audio-motif="work" style attributes on any page.
    var SELECTOR_TO_MOTIF = [
        ['#intro', 'intro'],
        ['#now', 'now'],
        ['#selected-work', 'work'],
        ['.home-section--sticker', 'sticker'],
        ['#about-teaser', 'about'],
        ['.site-footer', 'footer'],
        ['.page-footer', 'footer'],
        ['.about-roles', 'work'],
        ['.beyond-code', 'about'],
        ['.creative-lab', 'sticker'],
        ['.projects-page', 'work']
    ];

    var observer = null;

    function motifFor(el) {
        try {
            if (el && el.getAttribute) {
                var direct = el.getAttribute('data-audio-motif');
                if (direct) return direct;
            }
        } catch { /* noop */ }
        return 'generic';
    }

    function bindMotifObserver() {
        var sm = sound();
        if (!sm) return;
        try {
            if (observer) observer.disconnect();
        } catch { /* noop */ }

        var targets = [];
        try {
            SELECTOR_TO_MOTIF.forEach(function (pair) {
                var nodes = document.querySelectorAll(pair[0]);
                nodes.forEach(function (node) {
                    if (targets.indexOf(node) === -1) {
                        node.setAttribute('data-audio-motif', node.getAttribute('data-audio-motif') || pair[1]);
                        targets.push(node);
                    }
                });
            });
            var extra = document.querySelectorAll('[data-audio-motif]');
            extra.forEach(function (node) {
                if (targets.indexOf(node) === -1) targets.push(node);
            });
        } catch { targets = []; }

        if (!targets.length || !('IntersectionObserver' in window)) return;

        try {
            observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    var name = motifFor(entry.target);
                    try {
                        if (sound()) sound().setBedScene(name);
                    } catch { /* score never breaks scroll */ }
                });
            }, { threshold: 0.35 });
            targets.forEach(function (t) {
                try { observer.observe(t); } catch { /* noop */ }
            });
        } catch { /* noop */ }

        // Section arrive and leave (D-192): a line across the middle of the
        // screen, so tall sections such as Selected work count too. The
        // manager applies the calm limits (D-129).
        try {
            if (lineObserver) lineObserver.disconnect();
            var inside = new WeakSet();
            lineObserver = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    var sm = sound();
                    if (!sm || !masterOn()) return;
                    var name = motifFor(entry.target);
                    try {
                        if (entry.isIntersecting) {
                            inside.add(entry.target);
                            sm.playMotif('arrive', name);
                        } else if (inside.has(entry.target)) {
                            inside.delete(entry.target);
                            sm.playMotif('leave', name);
                        }
                    } catch { /* score never breaks scroll */ }
                });
            }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
            targets.forEach(function (t) {
                try { lineObserver.observe(t); } catch { /* noop */ }
            });
        } catch { /* noop */ }
    }

    var lineObserver = null;

    // The riser plays once per page change. A routed link click plays it
    // with the cover; page:ready then plays it only for a navigation no
    // click voiced (back and forward).
    var RISER_NAV_MS = 4000;
    var riserAt = 0;

    function playRiser() {
        try {
            var sm = sound();
            if (sm && masterOn() && !reducedMotion()) sm.playRiser();
        } catch { /* noop */ }
    }

    function riserForPageReady() {
        if (riserAt && Date.now() - riserAt < RISER_NAV_MS) {
            riserAt = 0;
            return;
        }
        riserAt = 0;
        playRiser();
    }

    function wireClicks() {
        var lastTap = 0;
        document.addEventListener('click', function (e) {
            try {
                if (!masterOn()) return;
                var sm = sound();
                if (!sm) return;
                var anchor = e.target && e.target.closest ? e.target.closest('a[href]') : null;
                if (anchor && window.PageRouter && typeof window.PageRouter.handles === 'function') {
                    try {
                        if (window.PageRouter.handles(anchor)) {
                            sm.playRiser();
                            riserAt = Date.now();
                            return;
                        }
                    } catch { /* fall through */ }
                }
                var pill = e.target && e.target.closest ? e.target.closest('.scroll-stack-pill, .sticker, .filter-btn') : null;
                if (pill) {
                    var now = Date.now();
                    if (now - lastTap < 140) return;
                    lastTap = now;
                    sm.playSelectSound();
                }
            } catch { /* taps never break */ }
        }, { passive: true });
    }

    // Hover by intent (D-194): the manager only plays once the pointer
    // settles on a link, button or card; travel and flicks stay silent.
    var HOVER_TARGETS = 'a[href], button, [role="button"], .card, [data-hover-sound]';
    function wireHover() {
        var lastEl = null;
        document.addEventListener('pointerover', function (e) {
            try {
                if (e.pointerType !== 'mouse' || !masterOn()) return;
                var el = e.target && e.target.closest ? e.target.closest(HOVER_TARGETS) : null;
                if (!el || el === lastEl) return;
                lastEl = el;
                var sm = sound();
                if (sm && sm.playHoverSound) sm.playHoverSound(el);
            } catch { /* hover never breaks */ }
        }, { passive: true });
    }

    function init() {
        bindMotifObserver();
        wireClicks();
        wireHover();
        window.addEventListener('page:ready', function () {
            try {
                bindMotifObserver();
                riserForPageReady();
            } catch { /* noop */ }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
