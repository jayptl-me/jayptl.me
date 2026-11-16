/**
 * Overlap Deck Component, Bespoke Zero-Dependency Physical Print Stack
 *
 * Second, parallel build of the homepage "Selected work" section, sitting next
 * to the current .scroll-stack block, which stays live and untouched.
 *
 * Motion architecture. This reuses the patterns already proven in
 * js/components/scroll-stack.js and js/components/scroll-glide.js rather than
 * inventing a parallel engine:
 * - Frame-rate independent exponential ease toward a target, the same curve
 *   scroll-glide.js settles a wheel notch with. A flick therefore carries and
 *   comes to rest without a step discontinuity.
 * - Geometry cached on resize and on intersection, never measured per frame.
 * - IntersectionObserver gates the loop, so the deck costs nothing off screen.
 * - Compositor-only writes per frame: transform and opacity. No CSS filter is
 *   recalculated in the loop, and no transform-style: preserve-3d is used, so a
 *   tilted neighbour can never paint over the focused sheet.
 * - Parallax: the shot layer inside a sheet translates against the sheet, so it
 *   travels slower than the sheet itself.
 * - Wheel intent follows scroll-glide.js: a sideways or shift wheel is deck
 *   travel, a plain vertical mouse wheel stays with the page.
 * - prefers-reduced-motion: the loop never starts, no transform is written, and
 *   the deck presents its end state, one readable row of sheets.
 *
 * Control surface: pills and keyboard only. The "STACK // 01 OF 04" counter is
 * gone, and the status element it used to carry is now a real role="status"
 * live region that announces the sheet that took focus.
 *
 * @file components/overlap-deck.js
 * @author Jay Patel
 */
(function () {
    'use strict';

    var STEP = 0.07;            // neighbour offset as a fraction of the track
    var PARALLAX = 0.045;        // a fifth of the old drift: the shot is no longer
                               // oversized to hide the travel, so most of it goes
    var DEPTH_SCALE = 0.055;     // scale a neighbour gives up per sheet of distance
    var DEPTH_SHADE = 0.30;      // shade opacity per sheet of distance
    var TAU = 165;               // ms, the ease time constant
    var LINE_PX = 40;            // deltaMode 1 (lines) to pixels
    var GESTURE_GAP = 180;       // ms of silence that ends a wheel gesture
    var INERTIA_MS = 120;        // how far a release velocity is allowed to carry
    var MOVE_MIN_MS = 8;         // a faster sample than this is a coalesced burst
    var DRAG_CANCEL_PX = 6;      // travel that turns a press into a drag
    var VELOCITY_SMOOTH = 0.4;   // weight of the newest sample in the velocity
    var SOUND_THROTTLE_MS = 160;

    function clamp(v, min, max) {
        return Math.min(max, Math.max(min, v));
    }

    class OverlapDeck {
        constructor(root) {
            this.root = root;
            this.viewport = root.querySelector('[data-workdeck-viewport]');
            this.track = root.querySelector('[data-workdeck-track]');
            this.sheets = this.track ? Array.from(this.track.querySelectorAll('[data-workdeck-sheet]')) : [];
            this.pills = Array.from(root.querySelectorAll('[data-workdeck-pill]'));
            this.live = root.querySelector('[data-workdeck-live]');

            this.total = this.sheets.length;
            this.target = 0;
            this.pos = 0;
            this.velocity = 0;
            this.lastTime = 0;
            this.animating = false;
            this.inView = false;
            this.stepPx = 140;
            this.activeIndex = -1;
            this.lastSoundTime = 0;
            this.dragging = false;
            this.dragStartX = 0;
            this.dragStartPos = 0;
            this.dragMoved = 0;
            this.dragLastX = 0;
            this.dragLastTime = 0;
            this.gestureAt = 0;
            this.soundManager = window.SoundManager || null;

            this.reducedMotion = false;
            try {
                this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            } catch { /* noop */ }

            this.frame = this.frame.bind(this);
            this._onWheel = this._onWheel.bind(this);
            this._onKeyDown = this._onKeyDown.bind(this);
            this._onPointerDown = this._onPointerDown.bind(this);
            this._onPointerMove = this._onPointerMove.bind(this);
            this._onPointerUp = this._onPointerUp.bind(this);
            this._onClickCapture = this._onClickCapture.bind(this);
            this._onResize = this._onResize.bind(this);
            this._onMotionChange = this._onMotionChange.bind(this);
            this._resizeTimer = 0;
            this._rafId = 0;
            this._destroyed = false;

            if (this.total > 0 && this.viewport) {
                this.init();
            }
        }

        init() {
            var self = this;

            this.updateGeometry();

            if ('IntersectionObserver' in window) {
                this.observer = new IntersectionObserver(function (entries) {
                    entries.forEach(function (entry) {
                        self.inView = entry.isIntersecting;
                        if (self.inView) {
                            self.updateGeometry();
                            self.setActive(Math.round(self.target));
                        }
                    });
                }, { rootMargin: '200px 0px 200px 0px' });
                this.observer.observe(this.root);
            } else {
                this.inView = true;
            }

            this.viewport.addEventListener('wheel', this._onWheel, { passive: false });
            this.viewport.addEventListener('keydown', this._onKeyDown);
            this.viewport.addEventListener('pointerdown', this._onPointerDown);
            this.viewport.addEventListener('pointermove', this._onPointerMove);
            this.viewport.addEventListener('pointerup', this._onPointerUp);
            this.viewport.addEventListener('pointercancel', this._onPointerUp);
            this.viewport.addEventListener('click', this._onClickCapture, true);

            this.pills.forEach(function (pill, idx) {
                pill.addEventListener('click', function () {
                    self.goTo(idx);
                });
            });

            window.addEventListener('resize', this._onResize, { passive: true });

            try {
                this._motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
                if (this._motionQuery) {
                    if (this._motionQuery.addEventListener) this._motionQuery.addEventListener('change', this._onMotionChange);
                    else if (this._motionQuery.addListener) this._motionQuery.addListener(this._onMotionChange);
                }
            } catch { /* noop */ }

            // The deck starts at rest on sheet one: styles, not an animation.
            // Under reduced motion nothing is written at all, the CSS grid is
            // the end state.
            this.pos = this.target;
            if (!this.reducedMotion) this.render(this.pos);
            this.setActive(Math.round(this.target));
        }

        updateGeometry() {
            if (!this.track) return;
            var width = this.track.offsetWidth || 1040;
            this.stepPx = width * STEP;
        }

        /* ---- Frame loop -------------------------------------------------- */

        start() {
            if (this.reducedMotion || this.animating) return;
            this.animating = true;
            this.lastTime = 0;
            try {
                this._rafId = window.requestAnimationFrame(this.frame);
            } catch {
                this.animating = false;
            }
        }

        frame(now) {
            if (this._destroyed) {
                this.animating = false;
                return;
            }
            var dt = Math.min(64, now - this.lastTime || 16);
            this.lastTime = now;
            var diff = this.target - this.pos;
            var decay = 1 - Math.exp(-dt / TAU);

            if (Math.abs(diff) < 0.0005) {
                this.pos = this.target;
                this.render(this.pos);
                this.animating = false;
                return;
            }
            this.pos += diff * decay;
            this.render(this.pos);
            this._rafId = window.requestAnimationFrame(this.frame);
        }

        render(pos) {
            if (this.reducedMotion) {
                // Reduced motion never writes a transform: the CSS row is the
                // layout and only the focus state moves.
                this.setActive(Math.round(clamp(pos, 0, this.total - 1)));
                return;
            }
            var active = Math.round(clamp(pos, 0, this.total - 1));
            if (active !== this.activeIndex) this.setActive(active);

            for (var i = 0; i < this.total; i++) {
                var sheet = this.sheets[i];
                var delta = i - pos;
                var distance = Math.abs(delta);
                var x = delta * this.stepPx;
                var scale = 1 - Math.min(distance, 2) * DEPTH_SCALE;

                sheet.style.transform = 'translate3d(' + x.toFixed(1) + 'px, 0, 0) scale(' + scale.toFixed(3) + ')';

                // Stacking and hit testing only change at a threshold, so they
                // are written when they change and not on every frame.
                var z = 50 - Math.round(distance * 10);
                if (sheet._wdZ !== z) {
                    sheet._wdZ = z;
                    sheet.style.zIndex = String(z);
                }
                var pe = distance < 0.4 ? 'auto' : 'none';
                if (sheet._wdPE !== pe) {
                    sheet._wdPE = pe;
                    sheet.style.pointerEvents = pe;
                }

                var shade = sheet.querySelector('[data-workdeck-shade]');
                if (shade) shade.style.opacity = (Math.min(distance, 2) * DEPTH_SHADE).toFixed(3);

                var move = sheet.querySelector('[data-workdeck-shot-move]');
                if (move) {
                    // The shot gives back part of the travel, so it moves slower
                    // than the sheet carrying it.
                    move.style.transform = 'translate3d(' + (-x * PARALLAX).toFixed(1) + 'px, 0, 0)';
                }
            }
        }

        /* ---- Focus state -------------------------------------------------- */

        setActive(index) {
            var next = clamp(index, 0, this.total - 1);
            if (next === this.activeIndex) return;
            this.activeIndex = next;

            for (var i = 0; i < this.total; i++) {
                var sheet = this.sheets[i];
                var isActive = i === next;
                sheet.classList.toggle('is-active', isActive);
                sheet.setAttribute('data-side', isActive ? 'active' : (i > next ? 'next' : 'prev'));
            }

            for (var p = 0; p < this.pills.length; p++) {
                var on = p === next;
                this.pills[p].classList.toggle('is-active', on);
                this.pills[p].setAttribute('aria-selected', on ? 'true' : 'false');
            }

            // The accessible path the dropped counter used to carry.
            if (this.live) {
                var title = this.sheets[next].getAttribute('data-title') || 'Project';
                var when = this.sheets[next].getAttribute('data-when') || '';
                this.live.textContent = when
                    ? title + ', sheet ' + (next + 1) + ' of ' + this.total + ', ' + when
                    : title + ', sheet ' + (next + 1) + ' of ' + this.total;
            }

            this.playThrottledTick();
        }

        playThrottledTick() {
            var now = Date.now();
            if (now - this.lastSoundTime < SOUND_THROTTLE_MS) return;
            this.lastSoundTime = now;
            if (this.soundManager && typeof this.soundManager.playTickSound === 'function') {
                this.soundManager.playTickSound();
            }
        }

        goTo(index) {
            var next = clamp(index, 0, this.total - 1);
            this.target = next;
            this.velocity = 0;
            if (this.reducedMotion) {
                // The end state with no journey: the CSS row is the layout, so
                // this moves by state alone and writes no transform at all.
                this.pos = next;
                this.setActive(next);
                return;
            }
            this.start();
        }

        /* ---- Wheel: sideways intent drives the deck ----------------------- */

        _onWheel(e) {
            if (this.reducedMotion || e.defaultPrevented || e.ctrlKey || e.metaKey) return;
            // Sideways only when sideways travel dominates: a trackpad scroll that
            // drifts a little sideways stays with the page (D-152 wheel fix).
            var sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY);
            var shifted = e.shiftKey && e.deltaY !== 0;
            if (!sideways && !shifted) return;   // vertical travel stays with the page

            var now = Date.now();
            if (now - this.gestureAt > GESTURE_GAP) this.velocity = 0;
            this.gestureAt = now;

            var raw = sideways ? e.deltaX : e.deltaY;
            var px = raw * (e.deltaMode === 1 ? LINE_PX : e.deltaMode === 2 ? window.innerHeight : 1);
            var atEdge = (px > 0 && this.target >= this.total - 1) || (px < 0 && this.target <= 0);
            if (atEdge) return;                  // let the page have it at the ends

            e.preventDefault();
            // One sheet step of pointer travel is one sheet; a mouse wheel notch
            // is coarser than a trackpad pixel, so the units are shared.
            this.target = clamp(this.target + px / this.stepPx, 0, this.total - 1);
            this.start();
        }

        /* ---- Keyboard ----------------------------------------------------- */

        _onKeyDown(e) {
            if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
            var key = e.key;
            if (key === 'ArrowRight' || key === 'ArrowDown') {
                e.preventDefault();
                this.step(1);
            } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
                e.preventDefault();
                this.step(-1);
            } else if (key === 'Home') {
                e.preventDefault();
                this.goTo(0);
            } else if (key === 'End') {
                e.preventDefault();
                this.goTo(this.total - 1);
            }
        }

        step(direction) {
            var from = this.reducedMotion ? this.activeIndex : Math.round(this.target);
            this.goTo(from + direction);
        }

        /* ---- Pointer drag with inertia ------------------------------------ */

        _onPointerDown(e) {
            if (this.reducedMotion) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            this.dragging = true;
            this.suppressClick = false;
            this.dragStartX = e.clientX;
            this.dragLastX = e.clientX;
            this.dragStartPos = this.target;
            this.dragMoved = 0;
            this.dragLastTime = Date.now();
            this.velocity = 0;
            try {
                this.viewport.setPointerCapture(e.pointerId);
            } catch { /* noop */ }
            this.viewport.classList.add('is-dragging');
        }

        _onPointerMove(e) {
            if (!this.dragging) return;
            var now = Date.now();
            var dt = Math.max(MOVE_MIN_MS, now - this.dragLastTime);
            var dx = e.clientX - this.dragLastX;
            this.dragLastX = e.clientX;
            this.dragLastTime = now;
            this.dragMoved += Math.abs(dx);

            var units = -(e.clientX - this.dragStartX) / this.stepPx;
            this.target = clamp(this.dragStartPos + units, 0, this.total - 1);
            // Instantaneous velocity in sheet units per ms, smoothed so one
            // jittery sample cannot decide how far the flick carries.
            var instant = -dx / this.stepPx / dt;
            this.velocity = this.velocity * (1 - VELOCITY_SMOOTH) + instant * VELOCITY_SMOOTH;
            this.pos = this.target;
            this.render(this.pos);
        }

        _onPointerUp(e) {
            if (!this.dragging) return;
            this.dragging = false;
            this.viewport.classList.remove('is-dragging');
            try {
                if (e.pointerId !== undefined) this.viewport.releasePointerCapture(e.pointerId);
            } catch { /* noop */ }

            if (this.dragMoved > DRAG_CANCEL_PX) this.suppressClick = true;

            // A slow release has near-zero velocity, so this simply snaps to the
            // nearest sheet; a fast one carries past it and the ease settles it.
            var carried = this.target + this.velocity * INERTIA_MS;
            this.target = clamp(Math.round(carried), 0, this.total - 1);
            this.velocity = 0;
            this.start();
        }

        _onClickCapture(e) {
            if (!this.suppressClick) return;
            this.suppressClick = false;
            e.preventDefault();
            e.stopPropagation();
        }

        /* ---- Housekeeping ------------------------------------------------- */

        _onResize() {
            clearTimeout(this._resizeTimer);
            var self = this;
            this._resizeTimer = setTimeout(function () {
                self.updateGeometry();
                self.render(self.pos);
            }, 100);
        }

        _onMotionChange(e) {
            this.reducedMotion = e.matches;
            if (this.reducedMotion) {
                this.animating = false;
                try { window.cancelAnimationFrame(this._rafId); } catch { /* noop */ }
                this.resetStyles();
                this.setActive(Math.round(this.target));
            } else {
                this.render(this.pos);
            }
        }

        resetStyles() {
            for (var i = 0; i < this.total; i++) {
                this.sheets[i].style.transform = '';
                this.sheets[i].style.zIndex = '';
                this.sheets[i].style.pointerEvents = '';
                var shade = this.sheets[i].querySelector('[data-workdeck-shade]');
                if (shade) shade.style.opacity = '';
                var move = this.sheets[i].querySelector('[data-workdeck-shot-move]');
                if (move) move.style.transform = '';
            }
        }

        destroy() {
            this._destroyed = true;
            this.animating = false;
            this.dragging = false;
            try { window.cancelAnimationFrame(this._rafId); } catch { /* noop */ }
            clearTimeout(this._resizeTimer);
            try {
                if (this.observer && typeof this.observer.disconnect === 'function') this.observer.disconnect();
            } catch { /* noop */ }
            this.observer = null;
            try {
                window.removeEventListener('resize', this._onResize);
                if (this._motionQuery && this._onMotionChange) {
                    if (this._motionQuery.removeEventListener) this._motionQuery.removeEventListener('change', this._onMotionChange);
                    else if (this._motionQuery.removeListener) this._motionQuery.removeListener(this._onMotionChange);
                }
            } catch { /* noop */ }
            this._motionQuery = null;
            this.root = null;
            this.viewport = null;
            this.track = null;
            this.sheets = [];
            this.pills = [];
            this.live = null;
        }
    }

    function init() {
        try {
            if (window.overlapDeck && typeof window.overlapDeck.destroy === 'function') {
                window.overlapDeck.destroy();
            }
        } catch { /* noop */ }
        var root = document.getElementById('overlapDeck') || document.getElementById('selected-work-deck');
        window.overlapDeck = root ? new OverlapDeck(root) : null;
    }

    /* Re-scan hook for seamless revisits, the scroll-stack.js convention. */
    try {
        window.OverlapDeckRefresh = init;
    } catch { /* noop */ }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    try {
        window.addEventListener('page:ready', init);
    } catch { /* noop */ }
})();
