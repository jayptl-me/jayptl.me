/**
 * Performance Enhancement Script - SIMPLIFIED
 * Essential performance optimizations only
 * 
 * @file js/performance.js
 * @author Jay Patel
 */

// Simple performance optimizations
class PerformanceManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupLazyLoading();
        this.optimizeScrollPerformance();
    }

    setupLazyLoading() {
        // Only if there are images with data-src
        const lazyImages = document.querySelectorAll('img[data-src]');
        if (!lazyImages.length) return;

        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            });
        });

        lazyImages.forEach(img => imageObserver.observe(img));
    }

    optimizeScrollPerformance() {
        // Throttle scroll events for better performance
        let ticking = false;
        const scrollHandler = () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    // Scroll-based operations go here if needed
                    ticking = false;
                });
                ticking = true;
            }
        };
        
        window.addEventListener('scroll', scrollHandler, { passive: true });
    }
}

// Auto-initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new PerformanceManager());
} else {
    new PerformanceManager();
}
