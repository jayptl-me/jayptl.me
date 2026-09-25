"use strict";

/**
 * Homepage preloader. Loaded synchronously in <head> so it initializes
 * before first paint, same as the former inline block.
 * @file js/preloader.js
 */

// Preloader functionality
class PreloaderManager {
    constructor() {
        this.progress = 0;
        this.progressBar = null;
        this.progressText = null;
        this.preloader = null;
        this.resources = [];
        this.loadedResources = 0;
        this.init();
    }

    init() {
        // Get DOM elements
        this.preloader = document.getElementById('preloader');
        this.progressBar = document.getElementById('progressBar');
        this.progressText = document.getElementById('progressText');

        // Start monitoring resources
        this.collectResources();
        this.startProgress();
    }

    collectResources() {
        // Minimal collection retained for potential future metrics; monitorCSS removed for simplicity
        const links = document.querySelectorAll('link[rel="stylesheet"]');
        const images = document.querySelectorAll('img[src]');
        this.resources = [...Array.from(links), ...Array.from(images), document];
    }

    // Removed monitorCSS method (not used); progress is now time + load-event driven

    startProgress() {
        // Add pulsing state while we wait for window load
        if (this.progressText) {
            this.progressText.classList.add('pulsing');
            this.progressText.textContent = '0%';
        }
        this.monitorResources();
        // Safety timeout: if load event delays >4s, start simulation anyway
        this.safetyTimeout = setTimeout(() => {
            if (!this.simulationStarted) this.beginSimulation();
        }, 4000);
    }

    beginSimulation() {
        if (this.simulationStarted) return;
        this.simulationStarted = true;
        if (this.progressText) this.progressText.classList.remove('pulsing');
        this.simulateProgress();
    }

    simulateProgress() {
        // Smooth full simulation from 0 (or current) to 100
        const start = this.progress;
        const target = 100;
        const duration = 800; // ms
        const startTime = performance.now();
        const step = (now) => {
            const elapsed = now - startTime;
            const t = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
            const value = start + (target - start) * eased;
            this.updateProgress(value);
            if (t < 1) requestAnimationFrame(step); else this.finishLoading();
        };
        requestAnimationFrame(step);
    }

    updateProgress(progress) {
        this.progress = Math.min(progress, 100);
        if (this.progressBar) {
            this.progressBar.style.width = this.progress + '%';
        }
        // Don't overwrite pulsing text until simulation starts
        if (this.progressText && !this.progressText.classList.contains('pulsing')) {
            this.progressText.textContent = Math.floor(this.progress) + '%';
        }
    }

    isCSSReady() {
        try {
            const sheets = document.styleSheets;
            for (let i = 0; i < sheets.length; i++) {
                const sheet = sheets[i];
                if (sheet.href && sheet.href.indexOf('/css/main.css') !== -1) {
                    return Boolean(sheet.cssRules && sheet.cssRules.length > 0);
                }
            }
        } catch (e) {
            return true; // CORS / security fallback
        }
        return false;
    }

    monitorResources() {
        const triggerReady = () => {
            if (this.isCSSReady() || document.readyState === 'complete') {
                this.beginSimulation();
            } else {
                const interval = setInterval(() => {
                    if (this.isCSSReady() || this.simulationStarted) {
                        clearInterval(interval);
                        this.beginSimulation();
                    }
                }, 50);
                setTimeout(() => {
                    clearInterval(interval);
                    this.beginSimulation();
                }, 2000);
            }
        };

        if (document.readyState === 'complete') {
            triggerReady();
        } else {
            window.addEventListener('load', triggerReady, { once: true });
        }
    }

    finishLoading() {
        if (this.finished) return;
        this.finished = true;
        clearTimeout(this.safetyTimeout);
        this.updateProgress(100);
        setTimeout(() => this.hidePreloader(), 250);
    }

    hidePreloader() {
        if (!this.preloader) return;
        var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var tmode = document.body.getAttribute('data-transition') || 'pixels';

        if (!reduceMotion && tmode === 'pixels' && window.PixelSwap) {
            this.hidePreloaderPixel();
            return;
        }

        this.preloader.classList.add('hidden');
        setTimeout(function () {
            var host = document.querySelector('[data-particle-text]');
            var inst = host && window.ParticleText && window.ParticleText.of(host);
            if (inst) { inst.unpause(); inst.replay(); }
        }, 400);

        // Remove preloading class from body to reveal content
        document.body.classList.remove('preloading');

        // Trigger content reveal animations
        this.revealContent();

        // Remove preloader from DOM after transition
        setTimeout(() => {
            if (this.preloader && this.preloader.parentNode) {
                this.preloader.parentNode.removeChild(this.preloader);
            }
        }, 500);
    }

    hidePreloaderPixel() {
        var self = this;
        var targetContainer = document.querySelector('.text-reveal-container') || document.getElementById('home');

        if (window.SoundManager) window.SoundManager.playStepperEnter();

        // Remove preloader immediately so "Loading... 100%" doesn't clash with expanding content pixels
        if (this.preloader) {
            this.preloader.style.display = 'none';
            if (this.preloader.parentNode) {
                this.preloader.parentNode.removeChild(this.preloader);
            }
        }

        document.body.classList.remove('preloading');

        var host = document.querySelector('[data-particle-text]');
        var inst = host && window.ParticleText && window.ParticleText.of(host);
        if (inst) { inst.unpause(); inst.replay({ duration: 900, stagger: 180 }); }

        window.PixelSwap.reveal(targetContainer, {
            pattern: 'center',
            pixelSize: 50,
            duration: 950,
            pixelDuration: 600,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            onComplete: function () {
                self.revealContent();
            }
        });
    }

    revealContent() {
        // Add a slight delay to ensure smooth transitions
        setTimeout(() => {
            const mainElements = document.querySelectorAll('main, .hero, .site-footer, .consent-settings-toggle');
            mainElements.forEach((el, index) => {
                setTimeout(() => {
                    el.style.opacity = '1';
                    el.style.visibility = 'visible';
                }, index * 100); // Stagger the reveals
            });
        }, 100);
    }
}

// Initialize preloader when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new PreloaderManager();
    });
} else {
    new PreloaderManager();
}
