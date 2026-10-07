/**
 * Ink Spark, four short hand-drawn strokes burst from a click on the
 * playful surfaces (sticker reset, Beyond the Code cards, 404).
 *
 *   <button data-spark>...</button>   any element with data-spark
 *
 * Brief (docs/motion-zen.md section 6a, picked "Draw out, then fade"):
 * strokes draw outward in 240ms with the doodle draw-on, then fade
 * together in 140ms. One burst on screen at a time, never looping.
 * Keyboard clicks burst from the element's center. Reduced motion: none.
 *
 * @file js/components/ink-spark.js
 */
(function () {
    'use strict';

    if (window.InkSpark) return;

    var SVG_NS = 'http://www.w3.org/2000/svg';
    var LIFE = 240 + 140 + 60;
    var current = null;

    function reduced() {
        try {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) {
            return false;
        }
    }

    function burst(x, y) {
        if (current && current.parentNode) current.parentNode.removeChild(current);
        var svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('class', 'ink-spark');
        svg.setAttribute('viewBox', '-32 -32 64 64');
        svg.setAttribute('aria-hidden', 'true');
        svg.style.left = x + 'px';
        svg.style.top = y + 'px';
        // Four strokes, slightly uneven like a hand flick.
        var base = Math.random() * 90;
        for (var i = 0; i < 4; i++) {
            var a = (base + i * 90 + (Math.random() * 24 - 12)) * Math.PI / 180;
            var r1 = 9 + Math.random() * 3;
            var r2 = 20 + Math.random() * 7;
            var bend = (Math.random() * 6 - 3);
            var x1 = Math.cos(a) * r1;
            var y1 = Math.sin(a) * r1;
            var x2 = Math.cos(a) * r2;
            var y2 = Math.sin(a) * r2;
            var cx = (x1 + x2) / 2 - Math.sin(a) * bend;
            var cy = (y1 + y2) / 2 + Math.cos(a) * bend;
            var path = document.createElementNS(SVG_NS, 'path');
            path.setAttribute('d', 'M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + x2.toFixed(1) + ' ' + y2.toFixed(1));
            path.setAttribute('pathLength', '1');
            svg.appendChild(path);
        }
        document.body.appendChild(svg);
        current = svg;
        setTimeout(function () {
            if (svg.parentNode) svg.parentNode.removeChild(svg);
            if (current === svg) current = null;
        }, LIFE);
    }

    document.addEventListener('click', function (e) {
        if (reduced()) return;
        var host = e.target && e.target.closest ? e.target.closest('[data-spark]') : null;
        if (!host) return;
        var x = e.clientX;
        var y = e.clientY;
        if (!e.detail || (x === 0 && y === 0)) {
            var r = host.getBoundingClientRect();
            x = r.left + r.width / 2;
            y = r.top + r.height / 2;
        }
        burst(x, y);
    });

    window.InkSpark = { burst: burst };
})();
