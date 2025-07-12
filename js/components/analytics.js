/**
 * Google Analytics Integration with Consent Management
 * Loads and configures Google Analytics only with user consent
 * 
 * @file js/components/analytics.js
 * @author Jay Patel
 */

class AnalyticsManager {
    constructor() {
        // Replace with your actual Google Analytics 4 Measurement ID
        this.GA_MEASUREMENT_ID = 'G-XXXXXXXXXX'; // TODO: Update this with your real GA4 ID
        this.isLoaded = false;
        this.init();
    }

    init() {
        // Wait for consent banner to be ready
        this.waitForConsent();
    }

    waitForConsent() {
        const checkConsent = () => {
            if (window.consentBanner) {
                if (window.consentBanner.hasConsent()) {
                    this.loadGoogleAnalytics();
                }
            } else {
                // Retry if consent banner not ready yet
                setTimeout(checkConsent, 100);
            }
        };

        checkConsent();
    }

    loadGoogleAnalytics() {
        if (this.isLoaded) return;

        // Load Google Analytics script
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${this.GA_MEASUREMENT_ID}`;
        script.onload = () => {
            this.initializeGtag();
        };
        document.head.appendChild(script);

        this.isLoaded = true;
    }

    initializeGtag() {
        // Initialize dataLayer
        window.dataLayer = window.dataLayer || [];

        function gtag() {
            dataLayer.push(arguments);
        }

        window.gtag = gtag;

        // Configure Google Analytics
        gtag('js', new Date());
        gtag('config', this.GA_MEASUREMENT_ID, {
            // Privacy-focused configuration
            anonymize_ip: true,
            cookie_flags: 'SameSite=Lax;Secure',
            send_page_view: true,

            // Enhanced privacy settings
            allow_google_signals: false,
            allow_ad_personalization_signals: false,

            // Custom parameters for portfolio analytics
            custom_map: {
                'custom_parameter_1': 'portfolio_section'
            }
        });

        // Track initial page view
        this.trackPageView();

        // Set up custom events for portfolio interactions
        this.setupPortfolioTracking();

        console.log('Google Analytics initialized with privacy-first configuration');
    }

    trackPageView(pagePath = null, pageTitle = null) {
        if (!this.isAnalyticsReady()) return;

        const params = {};
        if (pagePath) params.page_path = pagePath;
        if (pageTitle) params.page_title = pageTitle;

        gtag('event', 'page_view', params);
    }

    trackEvent(eventName, parameters = {}) {
        if (!this.isAnalyticsReady()) return;

        gtag('event', eventName, parameters);
    }

    setupPortfolioTracking() {
        // Track theme changes
        window.addEventListener('themechange', (e) => {
            this.trackEvent('theme_change', {
                theme: e.detail.theme,
                event_category: 'user_preference'
            });
        });

        // Track scroll depth
        this.setupScrollTracking();

        // Track time on page
        this.setupTimeTracking();

        // Track portfolio section interactions
        this.setupSectionTracking();
    }

    setupScrollTracking() {
        let scrollDepths = [25, 50, 75, 90];
        let trackedDepths = new Set();

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

        // Throttled scroll tracking
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

    setupTimeTracking() {
        const startTime = Date.now();

        // Track time milestones
        const timepoints = [10, 30, 60, 120, 300]; // seconds
        timepoints.forEach(seconds => {
            setTimeout(() => {
                this.trackEvent('time_on_page', {
                    time_seconds: seconds,
                    event_category: 'engagement'
                });
            }, seconds * 1000);
        });

        // Track total time on page when leaving
        window.addEventListener('beforeunload', () => {
            const timeSpent = Math.round((Date.now() - startTime) / 1000);
            this.trackEvent('session_duration', {
                duration_seconds: timeSpent,
                event_category: 'engagement'
            });
        });
    }

    setupSectionTracking() {
        // Track when different portfolio sections come into view
        const sections = document.querySelectorAll('[id]');

        const observer = new IntersectionObserver((entries) => {
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

    isAnalyticsReady() {
        return this.isLoaded && typeof gtag !== 'undefined';
    }

    // Public methods for custom tracking
    trackButtonClick(buttonName, location = '') {
        this.trackEvent('button_click', {
            button_name: buttonName,
            button_location: location,
            event_category: 'interaction'
        });
    }

    trackDownload(fileName, fileType = '') {
        this.trackEvent('file_download', {
            file_name: fileName,
            file_type: fileType,
            event_category: 'download'
        });
    }

    trackContactFormSubmission(method = '') {
        this.trackEvent('contact_form_submit', {
            contact_method: method,
            event_category: 'lead'
        });
    }

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
window.trackEvent = function (eventName, parameters = {}) {
    if (window.analyticsManager) {
        window.analyticsManager.trackEvent(eventName, parameters);
    }
};

// Export for module use if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalyticsManager;
}
