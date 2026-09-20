/**
 * Featured Work (Gate P redesign)
 * Calm interaction layer for the new homepage work grid: quiet hover sounds
 * on cards (replacing the retired carousel's slide sounds) and a subtle
 * "tilt" affordance on the cover badge. No auto-rotation, no carousel.
 *
 * @file components/featured-work.js
 */
(function () {
    'use strict';

    class FeaturedWork {
        constructor() {
            this.grid = document.getElementById('workGrid');
            this.soundManager = window.SoundManager || null;
            this.lastHoverSoundTime = 0;
            this.hoverSoundThrottle = 180; // ms between hover sounds
            this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            if (this.grid) this.init();
        }

        init() {
            const cards = this.grid.querySelectorAll('.work-card');

            cards.forEach((card) => {
                // Quiet tick on hover (throttled) — the new "calm" signature
                card.addEventListener('mouseenter', () => {
                    this.playHoverSound();
                });

                // Subtle lift on the cover only, via a class (CSS transitions)
                card.addEventListener('mouseenter', () => {
                    if (!this.reducedMotion) card.classList.add('work-card--hover');
                });
                card.addEventListener('mouseleave', () => {
                    card.classList.remove('work-card--hover');
                });
            });
        }

        playHoverSound() {
            const now = Date.now();
            if (this.soundManager && now - this.lastHoverSoundTime > this.hoverSoundThrottle) {
                this.soundManager.playHoverSound();
                this.lastHoverSoundTime = now;
            }
        }
    }

    function init() {
        window.FeaturedWorkInstance = new FeaturedWork();
    }

    /* Re-scan hook for seamless revisits (old nodes detach, new grid binds). */
    try {
        window.FeaturedWorkRefresh = init;
    } catch (e) { /* noop */ }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
