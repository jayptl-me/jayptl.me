/**
 * PixelSwap — Raw SVG ClipPath Dissolve & Reveal Engine
 *
 * Direct content-revealing pixel transitions:
 * - Native SVG <clipPath> with animated <rect> elements.
 * - Zero DOM cloning (0 memory bloat, no 4.2GB browser freezes).
 * - Zero solid cover plates or background wash curtains (no white flash, no artificial snap).
 * - Content is revealed or dissolved directly through expanding/shrinking pixel windows.
 * - 50px default cell stride harmonizes 1:1 with the architectural site grid.
 *
 * @file components/pixel-swap.js
 */
(function (root) {
    'use strict';

    var MAX_PIXELS = 260;

    var PATTERNS = {
        random: function () { return null; },
        center: function (x, y) { return Math.hypot(x - 0.5, y - 0.5) / Math.SQRT1_2; },
        edges: function (x, y) { return Math.min(x, 1 - x, y, 1 - y) * 2; },
        'edges-rev': function (x, y) { return 1 - Math.min(x, 1 - x, y, 1 - y) * 2; },
        'left-to-right': function (x) { return x; },
        'right-to-left': function (x) { return 1 - x; },
        'top-to-bottom': function (_x, y) { return y; },
        'bottom-to-top': function (_x, y) { return 1 - y; },
        diagonal: function (x, y) { return (x + y) / 2; },
        spiral: function (x, y) {
            var angle = (Math.atan2(y - 0.5, x - 0.5) + Math.PI) / (Math.PI * 2);
            var radius = Math.hypot(x - 0.5, y - 0.5) / Math.SQRT1_2;
            return (angle + radius) % 1;
        }
    };

    var EASINGS = {
        linear: 'linear',
        ease: 'ease',
        'ease-out': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'cubic-bezier(0.22, 1, 0.36, 1)': 'cubic-bezier(0.22, 1, 0.36, 1)'
    };

    function clamp(val, min, max) {
        return Math.min(Math.max(val, min), max);
    }

    function pseudoNoise(seed) {
        var v = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
        return v - Math.floor(v);
    }

    var uidCounter = 0;
    var activeTransitions = new WeakMap();
    var svgRoot = null;

    function getSvgRoot() {
        if (!svgRoot || !svgRoot.isConnected) {
            svgRoot = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgRoot.className.baseVal = 'pixel-swap-svg-root';
            svgRoot.setAttribute('aria-hidden', 'true');
            svgRoot.style.position = 'fixed';
            svgRoot.style.top = '0';
            svgRoot.style.left = '0';
            svgRoot.style.width = '0';
            svgRoot.style.height = '0';
            svgRoot.style.overflow = 'hidden';
            svgRoot.style.pointerEvents = 'none';
            svgRoot.style.zIndex = '-9999';
            (document.body || document.documentElement).appendChild(svgRoot);
        }
        return svgRoot;
    }

    function buildGrid(width, height, requestedSize, patternName, randomness) {
        var baseSize = requestedSize || 50;
        var cols = Math.max(1, Math.ceil(width / baseSize));
        var rows = Math.max(1, Math.ceil(height / baseSize));
        var size = baseSize;

        // If viewport has an excessive count of cells (e.g. 4K / ultrawide displays),
        // step up size in integer multiples of the architectural 50px site grid (e.g. 100px)
        // so every tile covers an exact 2x2 grid stride with zero subpixel shear.
        if (cols * rows > 750) {
            size = baseSize * 2;
            cols = Math.max(1, Math.ceil(width / size));
            rows = Math.max(1, Math.ceil(height / size));
        }

        var originX = 0;
        var originY = 0;
        var patternFn = PATTERNS[patternName] || PATTERNS.center;
        var mix = clamp(randomness || 0, 0, 1);
        var pixels = [];

        for (var r = 0; r < rows; r++) {
            for (var c = 0; c < cols; c++) {
                var index = r * cols + c;
                var nx = cols <= 1 ? 0.5 : c / (cols - 1);
                var ny = rows <= 1 ? 0.5 : r / (rows - 1);
                var base = patternFn(nx, ny);
                var rand = pseudoNoise(index + 1);
                var offset = (base === null) ? rand : base * (1 - mix) + rand * mix;

                pixels.push({
                    id: index,
                    x: originX + c * size,
                    y: originY + r * size,
                    offset: clamp(offset, 0, 1)
                });
            }
        }

        return { pixels: pixels, size: size, cols: cols, rows: rows, width: width, height: height };
    }

    /**
     * Animate element via SVG ClipPath Dissolve / Reveal with zen calm pacing.
     *
     * @param {HTMLElement} element - Target element to clip
     * @param {Object} options
     *   - mode: 'reveal' (0 -> 1) or 'dissolve' (1 -> 0)
     *   - pattern: 'center' | 'edges' | 'edges-rev' | 'random' | 'spiral' | 'diagonal'
     *   - pixelSize: number (default 50)
     *   - duration: number in ms (default 950)
     *   - pixelDuration: number in ms (default 600)
     *   - randomness: number 0..1 (default 0)
     *   - onStart: function
     *   - onComplete: function
     */
    function animateClip(element, options) {
        if (!element) return null;

        var opts = options || {};
        var mode = opts.mode === 'dissolve' ? 'dissolve' : 'reveal';
        var pattern = opts.pattern || (mode === 'reveal' ? 'center' : 'edges');
        // Zen calm pacing: gentle deliberate duration with smooth wave propagation
        var duration = Math.max(300, opts.duration || 950);
        var pixelDuration = clamp(opts.pixelDuration || 600, 150, duration);
        var pixelSize = opts.pixelSize || 50;
        var randomness = opts.randomness || 0;
        var onStart = typeof opts.onStart === 'function' ? opts.onStart : null;
        var onComplete = typeof opts.onComplete === 'function' ? opts.onComplete : null;

        // Cancel existing transition on this element if any
        if (activeTransitions.has(element)) {
            activeTransitions.get(element).cancel();
        }

        var isReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (isReduced) {
            if (onStart) onStart();
            if (onComplete) onComplete();
            return null;
        }

        var rect = element.getBoundingClientRect();
        var width = rect.width || window.innerWidth || document.documentElement.clientWidth;
        var height = rect.height || window.innerHeight || document.documentElement.clientHeight;

        var grid = buildGrid(width, height, pixelSize, pattern, randomness);
        var clipId = 'px-clip-' + (++uidCounter);

        var clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        clipPath.id = clipId;
        clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse');

        var rootSvg = getSvgRoot();
        var rectElements = [];
        var animations = [];

        // 1.04 scale so expanding pixels overlap slightly and eliminate subpixel gaps
        var startScale = mode === 'reveal' ? 0 : 1.04;
        var endScale = mode === 'reveal' ? 1.04 : 0;

        for (var i = 0; i < grid.pixels.length; i++) {
            var px = grid.pixels[i];

            // SVG Clip rect
            var rectEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rectEl.setAttribute('x', px.x);
            rectEl.setAttribute('y', px.y);
            rectEl.setAttribute('width', grid.size);
            rectEl.setAttribute('height', grid.size);
            rectEl.setAttribute('transform-origin', (px.x + grid.size / 2) + 'px ' + (px.y + grid.size / 2) + 'px');
            clipPath.appendChild(rectEl);
            rectElements.push({ el: rectEl, offset: px.offset });
        }

        rootSvg.appendChild(clipPath);

        element.classList.add('pixel-swap-host');
        element.style.clipPath = 'url(#' + clipId + ')';
        element.style.webkitClipPath = 'url(#' + clipId + ')';

        if (onStart) {
            try { onStart(); } catch (e) { console.error(e); }
        }

        var spread = Math.max(0, duration - pixelDuration);
        var easing = EASINGS[opts.easing] || EASINGS['ease-out'];

        // Animate clip rects
        rectElements.forEach(function (item) {
            var delay = item.offset * spread;
            var anim = item.el.animate([
                { transform: 'scale(' + startScale + ')' },
                { transform: 'scale(' + endScale + ')' }
            ], {
                duration: pixelDuration,
                delay: delay,
                easing: easing,
                fill: 'both'
            });
            animations.push(anim);
        });

        var settled = false;
        function finish() {
            if (settled) return;
            settled = true;

            animations.forEach(function (a) { a.cancel(); });
            element.style.clipPath = '';
            element.style.webkitClipPath = '';
            element.classList.remove('pixel-swap-host');

            if (clipPath.parentNode) {
                clipPath.parentNode.removeChild(clipPath);
            }
            activeTransitions.delete(element);

            if (onComplete) {
                try { onComplete(); } catch (e) { console.error(e); }
            }
        }

        var timer = setTimeout(finish, duration + 20);

        var controller = {
            cancel: function () {
                clearTimeout(timer);
                finish();
            }
        };

        activeTransitions.set(element, controller);
        return controller;
    }

    var PixelSwap = {
        /**
         * Reveal target content via expanding pixel tiles.
         */
        reveal: function (element, options) {
            var opts = Object.assign({}, options, { mode: 'reveal' });
            return animateClip(element, opts);
        },

        /**
         * Dissolve target content via shrinking pixel tiles.
         */
        dissolve: function (element, options) {
            var opts = Object.assign({}, options, { mode: 'dissolve' });
            return animateClip(element, opts);
        }
    };

    root.PixelSwap = PixelSwap;

})(typeof window !== 'undefined' ? window : this);
