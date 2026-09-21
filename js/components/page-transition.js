/**
 * Page Transition, veil-masked seamless page changes with staged
 * component choreography underneath.
 *
 * A fullscreen pixel veil covers the old document on exit; the reload
 * (including the nav swap) happens invisibly behind it, and the new
 * document dissolves the veil away on entry. One continuous motion.
 *
 * @file js/components/page-transition.js
 */
(function () {
    'use strict';

    var COVER_DURATION = 420;
    var COVER_PIXEL = 320;
    var UNCOVER_DURATION = 640;
    var UNCOVER_PIXEL = 440;

    function reduceMotion() {
        try {
            return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) {
            return false;
        }
    }

    function isHomepageFlow() {
        return Boolean(document.getElementById('preloader') || document.querySelector('.text-reveal-container'));
    }

    function ensureVeil() {
        var veil = document.getElementById('ptVeil');
        if (!veil) {
            veil = document.createElement('div');
            veil.className = 'pt-veil';
            veil.id = 'ptVeil';
            veil.setAttribute('aria-hidden', 'true');
            document.body.insertBefore(veil, document.body.firstChild);
        } else {
            veil.style.display = '';
        }
        return veil;
    }

    function cleanupVeil() {
        var html = document.documentElement;
        html.classList.remove('pt-uncovering');
        html.classList.remove('pt-entering');
        html.classList.add('pt-entered');
        var veil = document.getElementById('ptVeil');
        if (veil && veil.parentNode) veil.parentNode.removeChild(veil);
    }

    function collectItems() {
        var items = [];
        var main = document.querySelector('main');
        if (main) {
            var kids = main.children;
            for (var i = 0; i < kids.length; i++) {
                items.push(kids[i]);
            }
        }
        var footer = document.querySelector('.site-footer');
        if (footer && (!main || !main.contains(footer))) items.push(footer);
        // Cap staged set so long pages stay snappy
        return items.slice(0, 24);
    }

    function markItems(items) {
        for (var i = 0; i < items.length; i++) {
            var el = items[i];
            if (!el.classList.contains('pt-item')) el.classList.add('pt-item');
            el.style.setProperty('--pt-index', String(i));
        }
    }

    function revealEntry() {
        var html = document.documentElement;
        if (reduceMotion()) {
            html.classList.add('pt-entered');
            cleanupVeil();
            return;
        }
        // Homepage owns its own preloader + stepper cinema; hide the veil,
        // do not run the uncover choreography.
        if (isHomepageFlow()) {
            html.classList.add('pt-entered');
            return;
        }

        var veil = document.getElementById('ptVeil');
        var items = collectItems();
        markItems(items);

        html.classList.add('pt-entering', 'pt-uncovering');

        var settled = false;
        function settle() {
            if (settled) return;
            settled = true;
            cleanupVeil();
        }

        // Staged components rise as the veil dissolves away above them.
        var staged = false;
        function stageIn() {
            if (staged) return;
            staged = true;
            for (var i = 0; i < items.length; i++) items[i].classList.add('pt-in');
        }

        if (veil && window.PixelSwap && typeof window.PixelSwap.dissolve === 'function') {
            try {
                window.PixelSwap.dissolve(veil, {
                    pattern: 'center',
                    pixelSize: 50,
                    duration: UNCOVER_DURATION,
                    pixelDuration: UNCOVER_PIXEL,
                    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                    onComplete: settle
                });
                setTimeout(stageIn, 150);
            } catch (e) {
                stageIn();
                settle();
            }
        } else {
            stageIn();
            settle();
        }
        // Safety: never leave content veiled or hidden
        setTimeout(function () { stageIn(); settle(); }, UNCOVER_DURATION + 400);
    }

    function shouldIntercept(anchor) {
        if (!anchor || !anchor.href) return false;
        if (anchor.target === '_blank') return false;
        if (anchor.hasAttribute('download')) return false;
        if (anchor.getAttribute('rel') === 'external') return false;
        var url;
        try {
            url = new URL(anchor.href, window.location.href);
        } catch (e) {
            return false;
        }
        if (url.origin !== window.location.origin) return false;
        // Same-page hash: let native / stepper logic handle it
        if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return false;
        // Pure in-page anchors
        var href = anchor.getAttribute('href');
        if (href && href.charAt(0) === '#') return false;
        return true;
    }

    function bindExit() {
        if (reduceMotion()) return;
        var navigating = false;
        document.addEventListener('click', function (e) {
            if (navigating) return;
            if (e.defaultPrevented) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            if (e.button !== 0) return;
            var anchor = e.target && e.target.closest ? e.target.closest('a[href]') : null;
            if (!anchor) return;
            if (!shouldIntercept(anchor)) return;
            // Bespoke router owns seamless swaps where available; this veil
            // path remains the fallback (full load behind cover).
            try {
                if (window.PageRouter && window.PageRouter.handles(anchor)) return;
            } catch (e) { /* fall through to veil navigation */ }
            // Let the homepage stepper own unreleased overlay anchor flows
            var href = anchor.getAttribute('href');
            if (href && href.charAt(0) === '#' && isHomepageFlow()) return;

            var dest = anchor.href;
            var done = false;
            function go() {
                if (done) return;
                done = true;
                window.location.assign(dest);
            }

            e.preventDefault();
            navigating = true;
            var html = document.documentElement;
            html.classList.remove('pt-entered');
            html.classList.add('pt-exiting', 'pt-covering');
            var veil = ensureVeil();

            if (veil && window.PixelSwap && typeof window.PixelSwap.reveal === 'function') {
                try {
                    window.PixelSwap.reveal(veil, {
                        pattern: 'edges',
                        pixelSize: 50,
                        duration: COVER_DURATION,
                        pixelDuration: COVER_PIXEL,
                        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                        onComplete: go
                    });
                    // Navigate once covered: the reload happens behind the veil.
                    setTimeout(go, Math.max(200, COVER_DURATION - 100));
                } catch (err) {
                    go();
                }
            } else {
                setTimeout(go, 60);
            }
            // Hard safety: never trap the user
            setTimeout(go, 1200);
        }, true);
    }

    function bindCache() {
        window.addEventListener('pageshow', function () {
            document.documentElement.classList.remove('pt-exiting');
            document.documentElement.classList.remove('pt-covering');
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            revealEntry();
            bindExit();
            bindCache();
        });
    } else {
        revealEntry();
        bindExit();
        bindCache();
    }
})();
