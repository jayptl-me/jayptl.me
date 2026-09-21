/**
 * Audio Score Component
 * Bespoke full score wiring. Observes homepage sections and generic
 * motif anchors, shifts the ambient bed per room, plays quiet two
 * note motifs on entry, and adds soft hover and tap voices to nav,
 * pills, cards, and stickers. Router aware for soft navigations.
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
        } catch (e) {
            return null;
        }
    }

    function masterOn() {
        try {
            var sm = sound();
            return Boolean(sm && sm.prefs && sm.prefs.master);
        } catch (e) {
            return false;
        }
    }

    function reducedMotion() {
        try {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) {
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
        } catch (e) { /* noop */ }
        return 'generic';
    }

    function bindMotifObserver() {
        var sm = sound();
        if (!sm) return;
        try {
            if (observer) observer.disconnect();
        } catch (e) { /* noop */ }

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
        } catch (e) { targets = []; }

        if (!targets.length || !('IntersectionObserver' in window)) return;

        try {
            observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    var name = motifFor(entry.target);
                    try {
                        if (sound()) {
                            sound().setBedScene(name);
                            sound().playMotif(name);
                        }
                    } catch (err) { /* score never breaks scroll */ }
                });
            }, { threshold: 0.35 });
            targets.forEach(function (t) {
                try { observer.observe(t); } catch (e) { /* noop */ }
            });
        } catch (e) { /* noop */ }
    }

    function playRiser() {
        try {
            var sm = sound();
            if (sm && masterOn() && !reducedMotion()) sm.playRiser();
        } catch (e) { /* noop */ }
    }

    function wireClicks() {
        var lastTap = 0;
        document.addEventListener('click', function (e) {
            try {
                if (!masterOn()) return;
                if (reducedMotion()) return;
                var sm = sound();
                if (!sm) return;
                var anchor = e.target && e.target.closest ? e.target.closest('a[href]') : null;
                if (anchor && window.PageRouter && typeof window.PageRouter.handles === 'function') {
                    try {
                        if (window.PageRouter.handles(anchor)) {
                            sm.playRiser();
                            return;
                        }
                    } catch (err) { /* fall through */ }
                }
                var pill = e.target && e.target.closest ? e.target.closest('.scroll-stack-pill, .sticker, .filter-btn') : null;
                if (pill) {
                    var now = Date.now();
                    if (now - lastTap < 140) return;
                    lastTap = now;
                    sm.playSelectSound();
                }
            } catch (err) { /* taps never break */ }
        }, { passive: true });
    }

    function wireHovers() {
        var lastHover = 0;
        document.addEventListener('pointerover', function (e) {
            try {
                if (!masterOn()) return;
                if (reducedMotion()) return;
                var sm = sound();
                if (!sm) return;
                var t = e.target && e.target.closest
                    ? e.target.closest('.scroll-stack-pill, .scroll-stack-card, .sticker, .nav-link, .dropdown-card, .audio-toggle')
                    : null;
                if (!t) return;
                var now = Date.now();
                if (now - lastHover < 110) return;
                lastHover = now;
                sm.playHoverSound();
            } catch (err) { /* hover stays silent */ }
        }, { passive: true });
    }

    function init() {
        bindMotifObserver();
        wireClicks();
        wireHovers();
        window.addEventListener('page:ready', function () {
            try {
                bindMotifObserver();
                playRiser();
            } catch (e) { /* noop */ }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
