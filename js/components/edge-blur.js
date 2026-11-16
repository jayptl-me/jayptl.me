/**
 * Edge Blur, a static band at the bottom of the viewport where content
 * softly blurs out before it reaches the edge.
 *
 * Brief (docs/motion-zen.md section 6a): five stacked layers, each with a
 * stronger backdrop blur and its own gradient mask, so the blur ramps up
 * toward the edge. Height steps by breakpoint with hard caps (CSS). Never
 * animated; it fades away once the footer comes on screen and
 * while the home stepper holds the page. Off with reduced transparency.
 *
 * @file js/components/edge-blur.js
 */
(function () {
    'use strict';

    if (!window.Mount) return;

    var LAYERS = 5;
    var END_ZONE = 120; // px from the bottom where the band steps away

    var band = null;
    var overlayWatch = null;
    var ticking = false;
    // The footer's visibility comes from an IntersectionObserver, so a scroll
    // frame never measures layout (perf benchmark 16 Nov: this read was the
    // top long-frame script while scrolling home on desktop).
    var footerWatch = null;
    var watchedFooter = null;
    var footerOnScreen = false;

    function stepperHolds() {
        var overlay = document.querySelector('.text-reveal-container');
        return Boolean(overlay && !overlay.classList.contains('released'));
    }

    function watchFooter() {
        var footer = document.querySelector('body > footer');
        if (footer === watchedFooter) return;
        if (footerWatch) footerWatch.disconnect();
        footerWatch = null;
        watchedFooter = footer;
        footerOnScreen = false;
        if (!footer || !('IntersectionObserver' in window)) return;
        footerWatch = new IntersectionObserver(function (entries) {
            footerOnScreen = entries[entries.length - 1].isIntersecting;
            queue();
        });
        footerWatch.observe(footer);
    }

    function update() {
        ticking = false;
        if (!band) return;
        // Step away once the footer is on screen, so its lines never sit
        // under the blur, or near the end on pages without one.
        var atEnd;
        if (watchedFooter && footerWatch) {
            atEnd = footerOnScreen;
        } else if (watchedFooter) {
            atEnd = watchedFooter.getBoundingClientRect().top < window.innerHeight;
        } else {
            var doc = document.documentElement;
            atEnd = window.scrollY + window.innerHeight >= doc.scrollHeight - END_ZONE;
        }
        band.classList.toggle('is-away', atEnd || stepperHolds());
    }

    function queue() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(update);
    }

    function watchOverlay() {
        if (overlayWatch) {
            overlayWatch.disconnect();
            overlayWatch = null;
        }
        var overlay = document.querySelector('.text-reveal-container');
        if (!overlay || !('MutationObserver' in window)) return;
        overlayWatch = new MutationObserver(queue);
        overlayWatch.observe(overlay, { attributes: true, attributeFilter: ['class'] });
    }

    function mount() {
        band = document.createElement('div');
        band.className = 'edge-blur';
        band.setAttribute('aria-hidden', 'true');
        for (var i = 0; i < LAYERS; i++) {
            var layer = document.createElement('div');
            layer.className = 'edge-blur-layer';
            layer.style.setProperty('--i', String(i));
            band.appendChild(layer);
        }
        var tint = document.createElement('div');
        tint.className = 'edge-blur-tint';
        band.appendChild(tint);
        document.body.appendChild(band);
        window.addEventListener('scroll', queue, { passive: true });
        window.addEventListener('resize', queue, { passive: true });
        watchOverlay();
        watchFooter();
        update();
    }

    function refresh() {
        if (band && !band.isConnected) document.body.appendChild(band);
        watchOverlay();
        watchFooter();
        queue();
    }

    window.Mount.register('edge-blur', { global: true, mount: mount, refresh: refresh });
})();
