"use strict";

/**
 * Home Ink Loop Preloader: skip rule and hero hand-off.
 *
 * The preloader itself is inline SVG and CSS in index.html and plays and
 * dismisses itself with no script. This file, loaded synchronously in
 * <head> so it runs before first paint, only:
 * 1. marks repeat visits in this browser session (and reduced motion) with
 *    html.no-preloader, so the overlay never paints for them;
 * 2. when the opening circle finishes (or at once when skipped), unlocks
 *    scroll (body.preloading) and hands off to the hero particle text, as
 *    the old preloader did.
 * Nothing on the page is ever hidden, so the largest paint is the real
 * content at first paint. Brief: docs/motion-zen.md section 6b.
 *
 * @file js/preloader.js
 */
(function () {
    var KEY = 'jayptl-preloaded';
    var root = document.documentElement;
    var reduce = false;
    try {
        reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { reduce = false; }

    var seen = false;
    try {
        seen = window.sessionStorage.getItem(KEY) === '1';
        window.sessionStorage.setItem(KEY, '1');
    } catch (e) { seen = false; }

    var skip = seen || reduce;
    if (skip) root.classList.add('no-preloader');

    var done = false;

    function heroText() {
        var host = document.querySelector('[data-particle-text]');
        return host && window.ParticleText ? window.ParticleText.of(host) : null;
    }

    function finish(played) {
        if (done) return;
        done = true;
        document.body.classList.remove('preloading');
        var pre = document.getElementById('preloader');
        if (pre && pre.parentNode) pre.parentNode.removeChild(pre);
        if (!played) return;
        // The gather ran once under the overlay; replay it as the circle opens.
        var inst = heroText();
        if (inst) {
            inst.unpause();
            inst.replay({ duration: 900, stagger: 180 });
        }
        try {
            if (window.SoundManager && window.SoundManager.playStepperEnter) window.SoundManager.playStepperEnter();
        } catch (e) { /* sound is optional */ }
    }

    function start() {
        var pre = document.getElementById('preloader');
        if (skip || !pre) {
            finish(false);
            return;
        }
        pre.addEventListener('animationend', function (e) {
            if (e.animationName === 'pl-open') finish(true);
        });
        // The circle opens at 880ms; never hold the page past 1.5s.
        setTimeout(function () { finish(true); }, 1500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
