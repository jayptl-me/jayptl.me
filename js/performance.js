/**
 * Performance Enhancement Script
 * Handles performance optimization, resource loading, and metrics
 * 
 * @file js/performance.js
 * @author Jay Patel
 */

// Unified PerformanceManager class that handles all performance-related tasks
class PerformanceManager {
    constructor() {
        this.resourcesLoaded = false;
        this.metricsInitialized = false;
        this.observersInitialized = false;
    }

    /**
     * Initialize all performance optimization features
     */
    init() {
        this.setupResourceLoading();
        this.initCoreWebVitals();
        this.optimizeScrollPerformance();
    }

    /**
     * Handle progressive and async loading of resources
     */
    setupResourceLoading() {
        if (this.resourcesLoaded) return;
        window.addEventListener('load', () => {
            requestIdleCallback(() => {
                // Load any deferred resources here
                this.loadDeferredResources();
                this.resourcesLoaded = true;
            });
        });
    }

    /**
     * Load CSS resources asynchronously
     * @param {string} href - URL of the CSS file to load
     * @returns {HTMLLinkElement} - The created link element
     */
    loadCSS(href) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
        return link;
    }

    /**
     * Load any resources that can be deferred until after page load
     */
    loadDeferredResources() {
        // Load non-critical CSS or other resources here
    }

    /**
     * Initialize Core Web Vitals tracking
     */
    initCoreWebVitals() {
        if (this.metricsInitialized) return;
        // Import web-vitals library dynamically if available
        if ('web-vitals' in window) {
            import('https://unpkg.com/web-vitals?module').then(({ getCLS, getFID, getLCP }) => {
                getCLS(this.sendToAnalytics.bind(this));
                getFID(this.sendToAnalytics.bind(this));
                getLCP(this.sendToAnalytics.bind(this));
                this.metricsInitialized = true;
            });
        }
    }

    /**
     * Send metrics to analytics if consent is given
     * @param {Object} metric - Web Vitals metric object
     */
    sendToAnalytics(metric) {
        if (!window.consentManager?.canUseAnalytics()) return;
        window.consentManager.trackEvent('web_vital', {
            event_category: 'Web Vitals',
            event_label: metric.name,
            value: Math.round(metric.value),
            non_interaction: true,
        });
    }

    /**
     * Setup performance optimizations for scrolling
     */
    optimizeScrollPerformance() {
        if (this.observersInitialized || !('IntersectionObserver' in window)) return;
        // Setup lazy loading for images and other elements
        this.setupLazyLoading();
        // Set flag to prevent duplicate initialization
        this.observersInitialized = true;
    }

    /**
     * Initialize lazy loading for images and other content
     */
    setupLazyLoading() {
        // Consolidate lazy loading for [data-lazy] and [data-src] images
        const lazyElements = document.querySelectorAll('[data-lazy], img[data-src]');
        if (!lazyElements.length) return;
        const lazyObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const element = entry.target;
                if (element.tagName === 'IMG' && element.dataset.src) {
                    element.src = element.dataset.src;
                    element.removeAttribute('data-src');
                }
                // Handle other element types as needed
                lazyObserver.unobserve(element);
            });
        }, { rootMargin: '200px' });
        lazyElements.forEach(element => lazyObserver.observe(element));
    }
}

// Initialize performance optimizations
const performanceManager = new PerformanceManager();
if (window.requestIdleCallback) {
    requestIdleCallback(() => performanceManager.init());
} else {
    setTimeout(() => performanceManager.init(), 200);
}
