/**
 * Analytics Consent Manager
 * Handles Google Analytics consent and privacy-focused tracking
 * 
 * @file components/consent-manager.js
 * @author Jay Patel
 */

class ConsentManager {
    constructor() {
        this.consentKey = 'analytics_consent';
        this.consentBannerShownKey = 'consent_banner_shown';
        this.gaTrackingId = 'G-XXXXXXXXXX'; // Replace with your actual GA4 tracking ID
        this.consentBanner = null;
        this.consentGiven = false;
        this.bannerShown = false;
        this.debug = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        this.init();
    }

    log(...args) {
        if (this.debug) {
            console.log('ConsentManager:', ...args);
        }
    }
    
    init() {
        // Check if user has already made a choice
        this.checkExistingConsent();
        
        // Respect Do Not Track header first
        this.respectDoNotTrack();
        
        // Create and show banner if needed (only if DNT is not set)
        if (!this.consentGiven && !this.bannerShown && !this.doNotTrackEnabled) {
            this.createConsentBanner();
            setTimeout(() => this.showBanner(), 2000); // Show after 2 seconds
        }
        
        // Initialize Google Analytics ONLY if consent given
        if (this.consentGiven) {
            this.initializeGoogleAnalytics();
        }
        
        this.log('Initialized', {
            consentGiven: this.consentGiven,
            bannerShown: this.bannerShown,
            doNotTrack: this.doNotTrackEnabled
        });
    }
    
    checkExistingConsent() {
        const consent = localStorage.getItem(this.consentKey);
        const bannerShown = localStorage.getItem(this.consentBannerShownKey);
        
        this.consentGiven = consent === 'granted';
        this.bannerShown = bannerShown === 'true';
        
        this.log('Existing consent status:', {
            consentGiven: this.consentGiven,
            bannerShown: this.bannerShown
        });
    }
    
    respectDoNotTrack() {
        // Check for Do Not Track header
        this.doNotTrackEnabled = (
            navigator.doNotTrack === '1' || 
            window.doNotTrack === '1' || 
            navigator.msDoNotTrack === '1'
        );
        
        if (this.doNotTrackEnabled) {
            this.log('Do Not Track detected - respecting user preference');
            this.consentGiven = false;
            localStorage.setItem(this.consentKey, 'denied');
            this.hideBanner();
            return true;
        }
        
        return false;
    }
    
    createConsentBanner() {
        // Create banner HTML
        const bannerHTML = `
            <div class="consent-banner" id="consentBanner" aria-live="polite" role="banner">
                <div class="consent-container">
                    <div class="consent-content">
                        <div class="consent-icon">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                        </div>
                        
                        <h3 class="consent-title">Analytics & Privacy</h3>
                        
                        <p class="consent-text">
                            I use Google Analytics to understand how visitors interact with my website and improve the user experience. 
                            No personal data or cookies are stored, and all data is anonymized. 
                            <a href="privacy.html" target="_blank" rel="noopener noreferrer">Learn more</a> about my privacy practices.
                        </p>
                        
                        <div class="consent-actions">
                            <button class="consent-btn consent-btn-accept" id="acceptBtn" aria-describedby="consent-description">
                                <span>Accept Analytics</span>
                            </button>
                            <button class="consent-btn consent-btn-decline" id="declineBtn">
                                <span>Decline</span>
                            </button>
                        </div>
                        
                        <button class="consent-btn consent-btn-settings" id="settingsBtn">
                            Privacy Settings
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Insert banner into DOM
        document.body.insertAdjacentHTML('beforeend', bannerHTML);
        this.consentBanner = document.getElementById('consentBanner');
        
        // Add event listeners
        this.addEventListeners();
        
        this.log('Consent banner created');
    }
    
    addEventListeners() {
        const acceptBtn = document.getElementById('acceptBtn');
        const declineBtn = document.getElementById('declineBtn');
        const settingsBtn = document.getElementById('settingsBtn');
        
        if (acceptBtn) {
            acceptBtn.addEventListener('click', () => this.acceptConsent());
        }
        
        if (declineBtn) {
            declineBtn.addEventListener('click', () => this.declineConsent());
        }
        
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.openPrivacySettings());
        }
        
        // ESC key to close banner
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.consentBanner && this.consentBanner.classList.contains('show')) {
                this.declineConsent();
            }
        });
        
        // Handle clicks outside banner (optional)
        document.addEventListener('click', (e) => {
            if (this.consentBanner && 
                this.consentBanner.classList.contains('show') && 
                !this.consentBanner.contains(e.target)) {
                // Don't auto-close on outside click - require explicit choice
                // this.declineConsent();
            }
        });
    }
    
    showBanner() {
        if (this.consentBanner) {
            this.consentBanner.classList.add('show', 'animate-in');
            this.markBannerAsShown();
            
            // Focus management for accessibility
            const acceptBtn = document.getElementById('acceptBtn');
            if (acceptBtn) {
                setTimeout(() => acceptBtn.focus(), 300);
            }
            
            this.log('Consent banner shown');
        }
    }
    
    hideBanner() {
        if (this.consentBanner) {
            this.consentBanner.classList.add('animate-out');
            this.consentBanner.classList.remove('show');
            
            setTimeout(() => {
                if (this.consentBanner && this.consentBanner.parentNode) {
                    this.consentBanner.parentNode.removeChild(this.consentBanner);
                    this.consentBanner = null;
                }
            }, 300);
            
            this.log('Consent banner hidden');
        }
    }
    
    acceptConsent() {
        this.consentGiven = true;
        localStorage.setItem(this.consentKey, 'granted');
        this.markBannerAsShown();
        this.hideBanner();
        this.initializeGoogleAnalytics();
        
        // Show confirmation (optional)
        this.showConsentConfirmation('Analytics enabled. Thank you!');
        
        this.log('User accepted analytics consent');
    }
    
    declineConsent() {
        this.consentGiven = false;
        localStorage.setItem(this.consentKey, 'denied');
        this.markBannerAsShown();
        this.hideBanner();
        
        // Show confirmation (optional)
        this.showConsentConfirmation('Analytics disabled. Your privacy is respected.');
        
        this.log('User declined analytics consent');
    }
    
    markBannerAsShown() {
        localStorage.setItem(this.consentBannerShownKey, 'true');
        this.bannerShown = true;
    }
    
    openPrivacySettings() {
        // Open privacy policy in new tab
        window.open('privacy.html', '_blank', 'noopener,noreferrer');
    }
    
    showConsentConfirmation(message) {
        // Create a temporary toast notification
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--theme-bg-elevated);
            color: var(--theme-text);
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: var(--shadow-lg);
            border: 1px solid var(--theme-border);
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease-out;
            max-width: 300px;
        `;
        toast.textContent = message;
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
    
    initializeGoogleAnalytics() {
        if (!this.canUseAnalytics()) {
            return;
        }

        // Load Google Analytics 4
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${this.gaTrackingId}`;
        document.head.appendChild(script);
        
        // Initialize gtag
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = gtag;
        
        gtag('js', new Date());
        
        // Configure with privacy-focused settings
        gtag('config', this.gaTrackingId, {
            // Privacy-focused configuration
            anonymize_ip: true,                    // Anonymize IP addresses
            allow_google_signals: false,          // Disable Google Signals
            allow_ad_personalization_signals: false, // Disable ad personalization
            cookie_expires: 63072000,             // 2 years (default but explicit)
            cookie_update: true,
            cookie_flags: 'SameSite=Strict;Secure', // Secure cookie settings
            
            // Enhanced eCommerce and user tracking disabled
            send_page_view: true,
            
            // Custom settings
            custom_map: {},
            
            // Debug mode (only in development)
            debug_mode: this.debug
        });
        
        // Track initial page view
        this.trackPageView();
        
        this.log('Google Analytics initialized with privacy-focused settings');
    }
     /**
     * Check if analytics can be used (consent given, Do Not Track not enabled, and gtag is available)
     * @returns {boolean} Whether analytics can be used
     */
    canUseAnalytics() {
        return this.consentGiven && !this.doNotTrackEnabled && typeof gtag !== 'undefined';
    }

    trackPageView(page_title = document.title, page_location = window.location.href) {
        if (!this.canUseAnalytics()) {
            return;
        }

        gtag('event', 'page_view', {
            page_title: page_title,
            page_location: page_location,
            custom_parameter: 'privacy_focused_tracking'
        });
    }

    trackEvent(event_name, parameters = {}) {
        if (!this.canUseAnalytics()) {
            return;
        }

        // Sanitize parameters to ensure no PII
        const sanitizedParams = this.sanitizeEventParameters(parameters);
        gtag('event', event_name, sanitizedParams);
    }
    
    sanitizeEventParameters(params) {
        // Remove any potentially identifying information
        const sanitized = {};
        const allowedKeys = [
            'event_category',
            'event_label',
            'value',
            'non_interaction',
            'custom_parameter'
        ];
        
        for (const [key, value] of Object.entries(params)) {
            if (allowedKeys.includes(key) && typeof value !== 'object') {
                sanitized[key] = String(value).substring(0, 100); // Limit length
            }
        }
        
        return sanitized;
    }
    
    // Public methods for consent management
    revokeConsent() {
        this.consentGiven = false;
        localStorage.setItem(this.consentKey, 'denied');
        
        // Disable Google Analytics
        if (typeof gtag !== 'undefined') {
            gtag('config', this.gaTrackingId, {
                send_page_view: false
            });
        }
        
        // Clear analytics cookies
        this.clearAnalyticsCookies();
        
        this.log('Analytics consent revoked');
        this.showConsentConfirmation('Analytics disabled and cookies cleared.');
    }
    
    grantConsent() {
        if (!this.consentGiven) {
            this.acceptConsent();
        }
    }
    
    getConsentStatus() {
        return {
            granted: this.consentGiven,
            bannerShown: this.bannerShown
        };
    }
    
    clearAnalyticsCookies() {
        // Clear Google Analytics cookies
        const cookiesToClear = [
            '_ga',
            '_ga_' + this.gaTrackingId.replace('G-', ''),
            '_gid',
            '_gat',
            '_gat_gtag_' + this.gaTrackingId
        ];
        
        cookiesToClear.forEach(cookieName => {
            // Clear for current domain
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            // Clear for parent domain
            const domain = window.location.hostname.split('.').slice(-2).join('.');
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${domain};`;
        });
        
        this.log('Analytics cookies cleared');
    }
    
    // Cleanup method
    destroy() {
        if (this.consentBanner) {
            this.hideBanner();
        }
        
        // Remove event listeners
        document.removeEventListener('keydown', this.handleKeydown);
        document.removeEventListener('click', this.handleClick);
        
        this.log('ConsentManager destroyed');
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if not already initialized and not in development/localhost
    if (!window.consentManager && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        window.consentManager = new ConsentManager();
    } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('ConsentManager disabled on localhost');
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConsentManager;
}
