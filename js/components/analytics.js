

/**
 * Google Analytics Integration with Consent Management
 * Loads and configures Google Analytics only with user consent
 * @file js/components/analytics.js
 * @author Jay Patel
 */

(function () {
'use strict';


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
        // consent-banner.js is the one loader of the GA script. It fires
        // 'analytics:ready' once gtag is set up for an opted-in visitor (at
        // load, or when they opt in later on /privacy). No polling.
        const start = () => {
            if (this.isLoaded || !window.gtag) return;
            if (!(window.consentBanner && window.consentBanner.hasConsent())) return;
            this.isLoaded = true;
            this.setupPortfolioTracking();
        };
        document.addEventListener('analytics:ready', start);
        start();
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
        // gtag.js reads the arguments object, not an array.
        window.gtag = function gtag() { window.dataLayer.push(arguments); };

        // Set conservative consent mode defaults (deny analytics until explicit user consent)
        // This avoids accidental tracking prior to consent and aligns with Google & GDPR guidance.
        gtag('consent', 'default', {
            'analytics_storage': 'denied',
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
    }


    /**
     * Tracks a page view event.
     * @param {string|null} pagePath
     * @param {string|null} pageTitle
     */
    trackPageView(pagePath = null, pageTitle = null) {
        // Called by page-router.js after each in-page navigation. The page_view
        // itself is sent by GA4's enhanced measurement, which watches history
        // changes (on by default); sending one here too would count every
        // navigation twice. What this does is start the per-page events over.
        void pagePath; void pageTitle;
        if (!this.isAnalyticsReady()) return;
        this.resetPageTracking();
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
        this.setupLeadTracking();
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
        this.resetScrollDepths = () => trackedDepths.clear();
        const trackScrollDepth = () => {
            const scrollable = document.documentElement.scrollHeight - window.innerHeight;
            if (scrollable <= 0) return;
            const scrollPercent = Math.round((window.scrollY / scrollable) * 100);
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
        // pagehide fires on mobile and on back/forward-cache exits, where
        // beforeunload does not; gtag sends it with a beacon.
        window.addEventListener('pagehide', () => {
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
        if (!('IntersectionObserver' in window)) return;
        // Page sections only (not every element with an id), and each one
        // once per page view, so scrolling up and down does not inflate it.
        const seen = new Set();
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                const id = entry.target.id;
                if (entry.isIntersecting && id && !seen.has(id)) {
                    seen.add(id);
                    observer.unobserve(entry.target);
                    this.trackEvent('section_view', {
                        section_id: id,
                        page_path: window.location.pathname,
                        event_category: 'navigation'
                    });
                }
            });
        }, {
            threshold: 0.5,
            rootMargin: '0px 0px -20% 0px'
        });
        const observeAll = () => {
            observer.disconnect();
            seen.clear();
            document.querySelectorAll('main section[id], section[id]').forEach(section => observer.observe(section));
        };
        this.resetSections = observeAll;
        observeAll();
    }

    /**
     * Starts the per-page events over after an in-page navigation swapped
     * the content (scroll depth and section views belong to one page).
     */
    resetPageTracking() {
        if (this.resetScrollDepths) this.resetScrollDepths();
        if (this.resetSections) this.resetSections();
    }

    /**
     * Leads, from one delegated click listener (works across in-page
     * navigations): email and phone links (generate_lead) and links to the
     * booking page (select_content). Outbound links and PDF downloads are
     * left to GA4's enhanced measurement, which already reports them as
     * click and file_download; a second event here would double them.
     * Booking itself is reported by slot-picker.js once the call is booked.
     */
    setupLeadTracking() {
        const where = (el) => {
            const box = el.closest('footer, nav, header, section[id], main');
            if (!box) return 'page';
            return box.id || box.tagName.toLowerCase();
        };
        document.addEventListener('click', (e) => {
            const link = e.target && e.target.closest ? e.target.closest('a[href]') : null;
            if (!link) return;
            const href = link.getAttribute('href') || '';
            if (/^mailto:/i.test(href)) {
                this.trackEvent('generate_lead', { method: 'email', link_location: where(link), page_path: window.location.pathname });
            } else if (/^tel:/i.test(href)) {
                this.trackEvent('generate_lead', { method: 'phone', link_location: where(link), page_path: window.location.pathname });
            } else {
                let url = null;
                try { url = new URL(href, window.location.href); } catch { url = null; }
                if (url && url.origin === window.location.origin && url.pathname.replace(/\/+$/, '') === '/book') {
                    this.trackEvent('select_content', { content_type: 'cta', content_id: 'book', link_location: where(link), page_path: window.location.pathname });
                }
            }
        }, { capture: true, passive: true });
    }


    /**
     * Checks if analytics is ready for tracking.
     * @returns {boolean}
     */
    isAnalyticsReady() {
        // Also checks consent now, so an opt-out during the visit stops
        // every event at once, not only on the next page load.
        return this.isLoaded && typeof window.gtag === 'function' &&
            Boolean(window.consentBanner && window.consentBanner.hasConsent());
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
// (or at once, when the page router adds this script after load). Once only.
const bootAnalytics = () => { if (!window.analyticsManager) window.analyticsManager = new AnalyticsManager(); };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootAnalytics);
else bootAnalytics();

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

})();
