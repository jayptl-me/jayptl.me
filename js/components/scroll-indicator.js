"use strict";


/**
 * Scroll Indicator Component
 * Shows page scroll progress with a progress bar
 * 
 * @file components/scroll-indicator.js
 * @author Jay Patel
 */

class ScrollIndicator {
    constructor() {
        this.progressBar = document.querySelector('.progress-bar');
        this.lastScrollDepth = 0;
        this.scrollDepthThresholds = [25, 50, 75, 100];
        this.trackedDepths = new Set();

        this.init();
    }

    init() {
        if (!this.progressBar) {
            return;
        }

        this.setupEventListeners();
        this.updateProgress(); // Initial update
    }

    setupEventListeners() {
        this._resizeHandler = () => this.updateProgress();
        let scrollTimeout;
        this._scrollHandler = () => {
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }
            scrollTimeout = setTimeout(() => {
                this.updateProgress();
                this.trackScrollDepth();
            }, 16);
        };

        window.addEventListener('scroll', this._scrollHandler, { passive: true });
        window.addEventListener('resize', this._resizeHandler, { passive: true });
    }

    updateProgress() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollProgress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;

        // Clamp between 0 and 100
        const clampedProgress = Math.min(Math.max(scrollProgress, 0), 100);

        // Update progress bar
        this.progressBar.style.width = `${clampedProgress}%`;

        // Update aria label for accessibility
        this.progressBar.setAttribute('aria-label', `Page scroll progress: ${Math.round(clampedProgress)}%`);

        return clampedProgress;
    }

    trackScrollDepth() {
        const currentDepth = this.updateProgress();

        // Track scroll depth milestones for analytics
        this.scrollDepthThresholds.forEach(threshold => {
            if (currentDepth >= threshold && !this.trackedDepths.has(threshold)) {
                this.trackedDepths.add(threshold);

                // Track analytics event
                if (typeof AnalyticsHelper !== 'undefined') {
                    AnalyticsHelper.trackScrollDepth(threshold);
                }
            }
        });
    }

    // Public methods
    getScrollProgress() {
        return this.updateProgress();
    }

    resetTrackedDepths() {
        this.trackedDepths.clear();
    }

    // Cleanup method
    destroy() {
        if (this._scrollHandler) window.removeEventListener('scroll', this._scrollHandler);
        if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (!window.scrollIndicator) {
        window.scrollIndicator = new ScrollIndicator();
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScrollIndicator;
}
