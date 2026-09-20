/**
 * Scroll Stack Component — Bespoke Zero-Dependency Horizontal & Mobile Deck Stack
 *
 * Performance & Motion Architecture:
 * - Continuous Mathematical Curves: Zero threshold jumps or step discontinuities
 *   between active, incoming, and stacked states. All offsets (X, Y, rotY, rotZ, scale, opacity)
 *   converge continuously to identity (0, 0, 0, 0, 1, 1) at delta = 0, eliminating transition jitter.
 * - Damped Lerp Interpolation: An active RAF loop interpolates the focal point toward target scroll
 *   position with exponential damping (lerp factor 0.14), smoothing out discrete mousewheel notches
 *   and trackpad bursts into silky 60/120fps motion.
 * - Pure Compositor Transforms: Operates strictly on GPU-accelerated translate3d (pixels), rotateY,
 *   rotateZ, scale, and opacity. Zero dynamic CSS filter recalculations and zero layout thrashing.
 * - Geometry Caching: Section scroll boundaries and container metrics are cached on resize and
 *   viewport intersection, ensuring zero DOM measurement overhead on scroll ticks.
 * - Mobile Pinned Scale Stack: window-scroll sticky pins just under the HUD
 *   with a per-card stagger; earlier cards scale toward 0.85 over the next
 *   10vh via a rAF throttle. Transform-only, full copy always visible.
 *
 * @file components/scroll-stack.js
 * @author Jay Patel
 */
(function () {
    'use strict';

    class ScrollStack {
        constructor() {
            this.container = document.getElementById('scrollStackContainer');
            this.stage = document.getElementById('scrollStackStage');
            this.viewport = document.getElementById('scrollStackViewport');
            this.track = document.getElementById('scrollStackTrack');
            this.cards = this.track ? Array.from(this.track.querySelectorAll('.scroll-stack-card')) : [];
            this.readout = document.getElementById('scrollStackReadout');
            this.meterFill = document.getElementById('scrollStackMeterFill');
            this.pills = this.stage ? Array.from(this.stage.querySelectorAll('.scroll-stack-pill')) : [];

            this.totalCards = this.cards.length;
            this.breakpoint = 860;
            this.soundManager = window.SoundManager || null;
            this.lastActiveIndex = -1;
            this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            // Geometry Cache
            this.cachedContainerTop = 0;
            this.cachedContainerHeight = 0;
            this.cachedViewportHeight = 0;
            this.cachedTotalScrollable = 1;
            this.cachedTrackWidth = 1000;

            // Mobile pinned-stack cache (layout tops are scroll-stable)
            this.mobileTrackTop = 0;
            this.mobileCardOffsets = [];
            this.mobileTickQueued = false;

            // Damped Animation State (Lerp)
            this.targetFocus = 0;
            this.currentFocus = 0;
            this.isAnimating = false;
            this.isInView = false;

            // Sound Throttling
            this.lastSoundTime = 0;
            this.soundThrottleMs = 160;

            // Bind loop
            this.renderLoop = this.renderLoop.bind(this);
            this._onScroll = null;
            this._onResize = null;
            this._onMotionChange = null;
            this._rafId = 0;
            this._destroyed = false;

            if (this.container && this.cards.length > 0) {
                this.init();
            }
        }

        init() {
            // Assign index property for CSS sticky calculations and telemetry
            this.cards.forEach((card, i) => {
                card.style.setProperty('--card-index', i);
            });

            this.checkMode();
            this.updateGeometry();

            // IntersectionObserver gates the loop when offscreen (0% CPU)
            if ('IntersectionObserver' in window) {
                this.observer = new IntersectionObserver(
                    (entries) => {
                        entries.forEach((entry) => {
                            this.isInView = entry.isIntersecting;
                            if (this.isInView) {
                                this.updateGeometry();
                                this.onScroll();
                            }
                        });
                    },
                    { rootMargin: '200px 0px 200px 0px' }
                );
                this.observer.observe(this.container);
            } else {
                this.isInView = true;
            }

            // Passive window scroll listener
            this._onScroll = () => {
                if (this.isInView) {
                    this.onScroll();
                }
            };
            window.addEventListener('scroll', this._onScroll, { passive: true });

            // Debounced resize listener
            let resizeTimer;
            this._onResize = () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    this.checkMode();
                    this.updateGeometry();
                    this.onScroll();
                }, 100);
            };
            window.addEventListener('resize', this._onResize, { passive: true });

            // Reduced motion media query listener
            this._motionQuery = null;
            try {
                this._motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            } catch (e) { /* noop */ }
            this._onMotionChange = (e) => {
                this.reducedMotion = e.matches;
                this.checkMode();
                this.onScroll();
            };
            try {
                if (this._motionQuery && this._onMotionChange) {
                    if (this._motionQuery.addEventListener) this._motionQuery.addEventListener('change', this._onMotionChange);
                    else if (this._motionQuery.addListener) this._motionQuery.addListener(this._onMotionChange);
                }
            } catch (e) { /* noop */ }

            // Interactive jump pills
            this.pills.forEach((pill, idx) => {
                pill.addEventListener('click', () => {
                    this.jumpToCard(idx);
                });
            });

            // Hover acoustic feedback
            this.cards.forEach((card) => {
                card.addEventListener('mouseenter', () => {
                    if (!this.reducedMotion) {
                        this.playThrottledTick();
                    }
                });
            });

            // Initial calculation
            this.onScroll();
        }

        updateGeometry() {
            if (!this.container) return;
            const rect = this.container.getBoundingClientRect();
            const scrollY = window.scrollY || window.pageYOffset;
            this.cachedContainerTop = rect.top + scrollY;
            this.cachedContainerHeight = this.container.offsetHeight;
            this.cachedViewportHeight = window.innerHeight;
            this.cachedTotalScrollable = Math.max(1, this.cachedContainerHeight - this.cachedViewportHeight);
            this.cachedTrackWidth = this.track ? this.track.offsetWidth : 1000;

            // Cache mobile layout tops while the track itself is untransformed,
            // so pin-start math stays correct at any scroll position.
            const isMobile = window.innerWidth <= this.breakpoint && !this.reducedMotion;
            if (isMobile && this.track) {
                const trackRect = this.track.getBoundingClientRect();
                this.mobileTrackTop = trackRect.top + scrollY;
                this.mobileCardOffsets = this.cards.map((card) => card.offsetTop);
            }
        }

        checkMode() {
            const isDesktop = window.innerWidth > this.breakpoint && !this.reducedMotion;

            if (isDesktop) {
                this.container.classList.add('is-scroll-driven');
            } else {
                this.container.classList.remove('is-scroll-driven');
                this.resetCardStyles();
            }
        }

        onScroll() {
            const isDesktop = window.innerWidth > this.breakpoint && !this.reducedMotion;

            if (isDesktop) {
                const scrollY = window.scrollY || window.pageYOffset;
                const scrolledDistance = scrollY - this.cachedContainerTop;
                const progress = Math.min(Math.max(scrolledDistance / this.cachedTotalScrollable, 0), 1);

                this.targetFocus = progress * (this.totalCards - 1);

                if (!this.isAnimating) {
                    this.isAnimating = true;
                    try { cancelAnimationFrame(this._rafId); } catch (e) { /* noop */ }
                    this._rafId = window.requestAnimationFrame(this.renderLoop);
                }
            } else if (!this.reducedMotion) {
                this.queueMobileStack();
            }
        }

        renderLoop() {
            if (this._destroyed) {
                this.isAnimating = false;
                return;
            }
            const isDesktop = window.innerWidth > this.breakpoint && !this.reducedMotion;
            if (!isDesktop) {
                this.isAnimating = false;
                return;
            }

            // Lerp smoothing: smoothly interpolate currentFocus toward targetFocus
            const focusDiff = this.targetFocus - this.currentFocus;

            if (Math.abs(focusDiff) > 0.0004) {
                this.currentFocus += focusDiff * 0.14;
                this.renderDesktopTransforms(this.currentFocus);
                this._rafId = window.requestAnimationFrame(this.renderLoop);
            } else {
                this.currentFocus = this.targetFocus;
                this.renderDesktopTransforms(this.currentFocus);
                this.isAnimating = false;
            }
        }

        renderDesktopTransforms(focus) {
            const activeIndex = Math.min(Math.max(Math.round(focus), 0), this.totalCards - 1);

            if (activeIndex !== this.lastActiveIndex) {
                this.onActiveCardChange(activeIndex);
                this.lastActiveIndex = activeIndex;
            }

            const runwayWidth = this.cachedTrackWidth * 1.04;

            this.cards.forEach((card, i) => {
                const delta = i - focus;

                if (delta >= 0) {
                    // ========================================================
                    // APPROACHING / ACTIVE FOCUS (delta >= 0)
                    // At delta = 0: x=0, y=0, rotY=0, rotZ=0, scale=1, opacity=1
                    // Continuous glide from right into center focus.
                    // ========================================================
                    const xOffset = delta * runwayWidth;
                    const rotY = Math.min(delta * 9, 13);
                    const rotZ = Math.min(delta * 1.2, 2.0);
                    const scale = Math.max(1 - delta * 0.045, 0.90);
                    const opacity = Math.min(1, Math.max(0, 1.18 - delta));
                    const zIndex = 20 + (this.totalCards - i);
                    const pointerEvents = delta < 0.25 ? 'auto' : 'none';

                    card.style.transform = `translate3d(${xOffset.toFixed(1)}px, 0px, 0px) rotateY(${rotY.toFixed(2)}deg) rotateZ(${rotZ.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
                    card.style.opacity = opacity.toFixed(3);
                    card.style.filter = 'none';
                    card.style.zIndex = zIndex;
                    card.style.pointerEvents = pointerEvents;
                } else {
                    // ========================================================
                    // RECEDING / STACKED ON LEFT (delta < 0)
                    // Let p = -delta > 0.
                    // Perfectly continuous transition at p = 0 with ZERO jump:
                    // All offsets smoothly scale with p from 0 to resting slot!
                    // ========================================================
                    const p = -delta;
                    const pClamped = Math.min(p, 1);

                    // Peeking deck resting slots: card 0 at -64px, card 1 at -48px, etc.
                    const restingX = -(64 - (i * 16));
                    const xOffset = restingX * pClamped;

                    const restingY = (i * 3 - 4);
                    const yOffset = restingY * pClamped;

                    const rotY = -Math.min(p * 11, 14);
                    const rotZ = -(p * 1.4) + (i * 0.3 * pClamped);
                    const scale = Math.max(1 - p * 0.05, 0.88);
                    const opacity = Math.max(1 - p * 0.40, 0.32);
                    const zIndex = i + 1;
                    const pointerEvents = p > 0.5 ? 'none' : 'auto';

                    card.style.transform = `translate3d(${xOffset.toFixed(1)}px, ${yOffset.toFixed(1)}px, 0px) rotateY(${rotY.toFixed(2)}deg) rotateZ(${rotZ.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
                    card.style.opacity = opacity.toFixed(3);
                    card.style.filter = 'none';
                    card.style.zIndex = zIndex;
                    card.style.pointerEvents = pointerEvents;
                }
            });
        }

        queueMobileStack() {
            if (this.mobileTickQueued) return;
            this.mobileTickQueued = true;
            window.requestAnimationFrame(() => {
                this.mobileTickQueued = false;
                this.renderMobileStack();
            });
        }

        renderMobileStack() {
            if (this.cards.length === 0) return;

            const viewportH = window.innerHeight || this.cachedViewportHeight || 700;
            const scrollY = window.scrollY || window.pageYOffset;
            // Pin line sits just under the sticky HUD header with a 10px
            // per-card stagger (mirrors CSS). Scale settles over the next 10%
            // of viewport travel; earlier cards shrink toward 0.85 while the
            // last card stays full for readability.
            const pinLine = 84;
            const settleSpan = Math.max(1, viewportH * 0.1);
            const staggerStep = 10;
            const floorScale = 0.85;
            const scaleStep = 0.03;

            let activeIdx = 0;

            this.cards.forEach((card, idx) => {
                const layoutTop = (this.mobileCardOffsets[idx] || card.offsetTop);
                const pinTop = pinLine + (idx * staggerStep);
                const pinStart = (this.mobileTrackTop || 0) + layoutTop - pinTop;
                const raw = (scrollY - pinStart) / settleSpan;
                const progress = raw < 0 ? 0 : (raw > 1 ? 1 : raw);

                const isLast = idx === this.cards.length - 1;
                const restingScale = isLast ? 1 : Math.min(0.97, floorScale + (idx * scaleStep));
                const scale = 1 - (progress * (1 - restingScale));

                // Compositor-only: scale pinned cards, never clip copy or blur text.
                card.style.transform = `translate3d(0, 0, 0) scale(${scale.toFixed(4)})`;
                card.style.opacity = '1';
                card.style.filter = 'none';

                if (scrollY + 8 >= pinStart) activeIdx = idx;
            });

            if (activeIdx !== this.lastActiveIndex) {
                this.onActiveCardChange(activeIdx);
                this.lastActiveIndex = activeIdx;
            }
        }

        onActiveCardChange(index) {
            // Update HUD Readout
            if (this.readout) {
                const formattedCur = String(index + 1).padStart(2, '0');
                const formattedTot = String(this.totalCards).padStart(2, '0');
                this.readout.textContent = `STACK // ${formattedCur} OF ${formattedTot}`;
            }

            // Update Progress Meter
            if (this.meterFill) {
                const percent = ((index + 1) / this.totalCards) * 100;
                this.meterFill.style.width = `${percent}%`;
            }

            // Update HUD Pills
            this.pills.forEach((pill, idx) => {
                const isActive = idx === index;
                pill.classList.toggle('is-active', isActive);
                pill.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });

            // Throttled audio tick
            this.playThrottledTick();
        }

        playThrottledTick() {
            const now = Date.now();
            if (now - this.lastSoundTime < this.soundThrottleMs) return;
            this.lastSoundTime = now;

            if (this.soundManager && typeof this.soundManager.playHoverSound === 'function') {
                this.soundManager.playHoverSound();
            }
        }

        jumpToCard(targetIndex) {
            const isDesktop = window.innerWidth > this.breakpoint && !this.reducedMotion;

            if (isDesktop) {
                const targetProgress = this.totalCards > 1 ? targetIndex / (this.totalCards - 1) : 0;
                const targetY = this.cachedContainerTop + (targetProgress * this.cachedTotalScrollable);

                window.scrollTo({
                    top: targetY,
                    behavior: 'smooth'
                });
            } else if (this.cards[targetIndex]) {
                const pinTop = 84 + (targetIndex * 10);
                const layoutTop = (this.mobileCardOffsets[targetIndex] || this.cards[targetIndex].offsetTop);
                const cardAbsoluteTop = (this.mobileTrackTop || 0) + layoutTop;
                const targetY = Math.max(0, cardAbsoluteTop - pinTop);

                window.scrollTo({
                    top: targetY,
                    behavior: 'smooth'
                });
            }
        }

        resetCardStyles() {
            this.cards.forEach((card) => {
                card.style.transform = '';
                card.style.opacity = '';
                card.style.filter = '';
                card.style.zIndex = '';
                card.style.pointerEvents = '';
            });
        }

        destroy() {
            this._destroyed = true;
            this.isAnimating = false;
            try { cancelAnimationFrame(this._rafId); } catch (e) { /* noop */ }
            try {
                if (this.observer && typeof this.observer.disconnect === 'function') this.observer.disconnect();
            } catch (e) { /* noop */ }
            this.observer = null;
            try {
                if (this._onScroll) window.removeEventListener('scroll', this._onScroll);
                if (this._onResize) window.removeEventListener('resize', this._onResize);
                if (this._motionQuery && this._onMotionChange) {
                    if (this._motionQuery.removeEventListener) this._motionQuery.removeEventListener('change', this._onMotionChange);
                    else if (this._motionQuery.removeListener) this._motionQuery.removeListener(this._onMotionChange);
                }
            } catch (e) { /* noop */ }
            this._onScroll = null;
            this._onResize = null;
            this._onMotionChange = null;
            this.container = null;
            this.stage = null;
            this.viewport = null;
            this.track = null;
            this.cards = [];
            this.pills = [];
        }
    }

    function init() {
        try {
            if (window.scrollStack && typeof window.scrollStack.destroy === 'function') {
                window.scrollStack.destroy();
            }
        } catch (e) { /* noop */ }
        window.scrollStack = new ScrollStack();
    }

    /* Re-scan hook for seamless revisits. */
    try {
        window.ScrollStackRefresh = init;
    } catch (e) { /* noop */ }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
