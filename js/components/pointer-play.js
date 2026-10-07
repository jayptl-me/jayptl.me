/**
 * Pointer Play: Glow Follow, Tilt Cover and Pull Button.
 *
 *   data-glow   a soft ramp-colored light follows the pointer inside a card
 *   data-tilt   a cover leans up to 4deg toward the pointer
 *   data-pull   a main call to action drifts up to 6px toward the pointer
 *
 * Brief (docs/motion-zen.md section 6a, picked "Eased follow"): values
 * ease toward the pointer and settle in about 150ms, then return home in
 * 240ms on the snap curve when the pointer leaves. Transform only, no
 * filters. Fine pointers only; off with reduced motion.
 *
 * @file js/components/pointer-play.js
 */
(function () {
    'use strict';

    var TAU = 30;        // ms; about 150ms to settle
    var TILT_MAX = 4;    // deg
    var PULL_MAX = 6;    // px

    function allowed() {
        try {
            return window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
                !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) {
            return false;
        }
    }

    function follower(el, kind) {
        var target = { x: 0, y: 0 };
        var cur = { x: 0, y: 0 };
        var raf = 0;
        var last = 0;
        var rect = null;
        var spot = null;

        if (kind === 'glow') {
            spot = document.createElement('span');
            spot.className = 'glow-spot';
            spot.setAttribute('aria-hidden', 'true');
            el.appendChild(spot);
        }

        function write() {
            if (kind === 'glow') {
                el.style.setProperty('--gx', cur.x.toFixed(1) + 'px');
                el.style.setProperty('--gy', cur.y.toFixed(1) + 'px');
            } else if (kind === 'tilt') {
                el.style.setProperty('--tilt-x', (-cur.y * TILT_MAX).toFixed(2) + 'deg');
                el.style.setProperty('--tilt-y', (cur.x * TILT_MAX).toFixed(2) + 'deg');
            } else {
                el.style.setProperty('--pull-x', (cur.x * PULL_MAX).toFixed(2) + 'px');
                el.style.setProperty('--pull-y', (cur.y * PULL_MAX).toFixed(2) + 'px');
            }
        }

        function frame(now) {
            var dt = Math.min(64, now - last || 16);
            last = now;
            var k = 1 - Math.exp(-dt / TAU);
            cur.x += (target.x - cur.x) * k;
            cur.y += (target.y - cur.y) * k;
            write();
            if (Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) > 0.01) {
                raf = requestAnimationFrame(frame);
            } else {
                raf = 0;
            }
        }

        function onEnter() {
            if (!allowed()) return;
            rect = el.getBoundingClientRect();
            el.classList.remove('is-returning');
            el.classList.add('is-following');
        }

        function onMove(e) {
            if (!allowed()) return;
            if (!rect) rect = el.getBoundingClientRect();
            var px = e.clientX - rect.left;
            var py = e.clientY - rect.top;
            if (kind === 'glow') {
                target.x = px;
                target.y = py;
                if (!el.classList.contains('is-following')) {
                    cur.x = px;
                    cur.y = py;
                    el.classList.add('is-following');
                }
            } else {
                // -1..1 from the center
                target.x = Math.max(-1, Math.min(1, (px / rect.width) * 2 - 1));
                target.y = Math.max(-1, Math.min(1, (py / rect.height) * 2 - 1));
            }
            if (!raf) {
                last = performance.now();
                raf = requestAnimationFrame(frame);
            }
        }

        function onLeave() {
            if (raf) cancelAnimationFrame(raf);
            raf = 0;
            rect = null;
            el.classList.remove('is-following');
            if (kind === 'glow') return; // the light just fades out
            el.classList.add('is-returning');
            target.x = target.y = cur.x = cur.y = 0;
            write();
        }

        el.addEventListener('pointerenter', onEnter);
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerleave', onLeave);
        return {
            destroy: function () {
                if (raf) cancelAnimationFrame(raf);
                el.removeEventListener('pointerenter', onEnter);
                el.removeEventListener('pointermove', onMove);
                el.removeEventListener('pointerleave', onLeave);
                if (spot && spot.parentNode) spot.parentNode.removeChild(spot);
            }
        };
    }

    function register(kind) {
        window.Mount.register('pointer-' + kind, {
            selector: '[data-' + kind + ']',
            mount: function (el) {
                el.classList.add(kind === 'glow' ? 'glow-follow' : kind === 'tilt' ? 'tilt-cover' : 'pull-button');
                return follower(el, kind);
            },
            unmount: function (el, state) {
                if (state) state.destroy();
            }
        });
    }

    if (window.Mount) {
        register('glow');
        register('tilt');
        register('pull');
    }
})();
