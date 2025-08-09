
"use strict";

/**
 * Google Analytics Integration with Consent Management
 * Loads and configures Google Analytics only with user consent
 * @file js/components/analytics.js
 * @author Jay Patel
 */


/**
 * @class AnalyticsManager
 * @classdesc Handles Google Analytics integration with consent management and custom portfolio tracking.
 */
class AnalyticsManager {
    /**
     * @constructor
     */
    constructor() {
        /** @type {string} Google Analytics Measurement ID */
        this.GA_MEASUREMENT_ID = 'G-GGZTYJVH9J'; // Your actual GA4 Measurement ID
        /** @type {boolean} Indicates if GA script is loaded */
        this.isLoaded = false;
        this.init();
    }

    /**
     * Initializes consent check and analytics loading.
     */
    init() {
        this.waitForConsent();
    }

    /**
     * Waits for user consent before loading Google Analytics.
     */
    waitForConsent() {
        const checkConsent = () => {
            if (window.consentBanner && window.consentBanner.hasConsent()) {
                this.loadGoogleAnalytics();
            } else {
                setTimeout(checkConsent, 100);
            }
        };
        checkConsent();
    }


    /**
     * Loads the Google Analytics script and initializes gtag.
     */
    loadGoogleAnalytics() {
        if (this.isLoaded || window.gtag) return;
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${this.GA_MEASUREMENT_ID}`;
        script.onload = () => this.initializeGtag();
        document.head.appendChild(script);
        this.isLoaded = true;
    }


    /**
     * Initializes gtag and configures Google Analytics.
     */
    initializeGtag() {
        window.dataLayer = window.dataLayer || [];
        window.gtag = (...args) => window.dataLayer.push(args);

        // Set consent mode defaults
        gtag('consent', 'default', {
            'analytics_storage': 'granted',
            'ad_storage': 'denied',
            'personalization_storage': 'denied',
            'functionality_storage': 'granted',
            'security_storage': 'granted'
        });

        gtag('js', new Date());
        gtag('config', this.GA_MEASUREMENT_ID, {
            // Privacy-first configuration
            anonymize_ip: true,
            cookie_flags: 'SameSite=Lax;Secure',
            send_page_view: true,
            allow_google_signals: false,
            allow_ad_personalization_signals: false,

            // Cookie settings
            cookie_expires: 365 * 24 * 60 * 60, // 1 year in seconds
            cookie_update: true,
            cookie_domain: 'auto',

            // Debug mode (set to false for production)
            debug_mode: false,

            // Enhanced measurement is controlled in GA4 dashboard
            // These settings ensure compatibility
            page_title: document.title,
            page_location: window.location.href
        });

        // Track initial page view
        this.trackPageView();
        this.setupPortfolioTracking();
        console.log('Google Analytics initialized with privacy-first configuration');
    }


    /**
     * Tracks a page view event.
     * @param {string|null} pagePath
     * @param {string|null} pageTitle
     */
    trackPageView(pagePath = null, pageTitle = null) {
        if (!this.isAnalyticsReady()) return;
        const params = {};
        if (pagePath) params.page_path = pagePath;
        if (pageTitle) params.page_title = pageTitle;
        gtag('event', 'page_view', params);
    }


    /**
     * Tracks a custom event.
     * @param {string} eventName
     * @param {Object} parameters
     */
    trackEvent(eventName, parameters = {}) {
        if (!this.isAnalyticsReady()) return;
        gtag('event', eventName, parameters);
    }


    /**
     * Sets up custom portfolio tracking events.
     */
    setupPortfolioTracking() {
        window.addEventListener('themechange', e => {
            this.trackEvent('theme_change', {
                theme: e.detail.theme,
                event_category: 'user_preference'
            });
        });
        this.setupScrollTracking();
        this.setupTimeTracking();
        this.setupSectionTracking();
    }


    /**
     * Tracks scroll depth milestones using throttled event listener.
     */
    setupScrollTracking() {
        const scrollDepths = [25, 50, 75, 90];
        const trackedDepths = new Set();
        const trackScrollDepth = () => {
            const scrollPercent = Math.round(
                (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
            );
            scrollDepths.forEach(depth => {
                if (scrollPercent >= depth && !trackedDepths.has(depth)) {
                    trackedDepths.add(depth);
                    this.trackEvent('scroll_depth', {
                        scroll_depth: depth,
                        event_category: 'engagement'
                    });
                }
            });
        };
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    trackScrollDepth();
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });
    }


    /**
     * Tracks time milestones and total session duration.
     */
    setupTimeTracking() {
        const startTime = Date.now();
        const timepoints = [10, 30, 60, 120, 300]; // seconds
        timepoints.forEach(seconds => {
            setTimeout(() => {
                this.trackEvent('time_on_page', {
                    time_seconds: seconds,
                    event_category: 'engagement'
                });
            }, seconds * 1000);
        });
        window.addEventListener('beforeunload', () => {
            const timeSpent = Math.round((Date.now() - startTime) / 1000);
            this.trackEvent('session_duration', {
                duration_seconds: timeSpent,
                event_category: 'engagement'
            });
        });
    }


    /**
     * Tracks when portfolio sections come into view using IntersectionObserver.
     */
    setupSectionTracking() {
        const sections = document.querySelectorAll('[id]');
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.target.id) {
                    this.trackEvent('section_view', {
                        section_id: entry.target.id,
                        event_category: 'navigation'
                    });
                }
            });
        }, {
            threshold: 0.5,
            rootMargin: '0px 0px -20% 0px'
        });
        sections.forEach(section => observer.observe(section));
    }


    /**
     * Checks if analytics is ready for tracking.
     * @returns {boolean}
     */
    isAnalyticsReady() {
        return this.isLoaded && typeof gtag !== 'undefined';
    }


    /**
     * Tracks button click events.
     * @param {string} buttonName
     * @param {string} location
     */
    trackButtonClick(buttonName, location = '') {
        this.trackEvent('button_click', {
            button_name: buttonName,
            button_location: location,
            event_category: 'interaction'
        });
    }

    /**
     * Tracks file download events.
     * @param {string} fileName
     * @param {string} fileType
     */
    trackDownload(fileName, fileType = '') {
        this.trackEvent('file_download', {
            file_name: fileName,
            file_type: fileType,
            event_category: 'download'
        });
    }

    /**
     * Tracks contact form submissions.
     * @param {string} method
     */
    trackContactFormSubmission(method = '') {
        this.trackEvent('contact_form_submit', {
            contact_method: method,
            event_category: 'lead'
        });
    }

    /**
     * Tracks external link clicks.
     * @param {string} url
     * @param {string} linkText
     */
    trackExternalLink(url, linkText = '') {
        this.trackEvent('external_link_click', {
            link_url: url,
            link_text: linkText,
            event_category: 'outbound'
        });
    }
}


// Initialize analytics manager
document.addEventListener('DOMContentLoaded', () => {
    window.analyticsManager = new AnalyticsManager();
});

// Utility function to easily track events from anywhere
window.trackEvent = (eventName, parameters = {}) => {
    if (window.analyticsManager) {
        window.analyticsManager.trackEvent(eventName, parameters);
    }
};

// Export for module use if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalyticsManager;
}
