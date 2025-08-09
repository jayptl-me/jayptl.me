
"use strict";

/**
 * Consent Banner Component
 * GDPR/Privacy compliant consent management for Google Analytics
 * Integrates with theme system and manages user preferences
 * 
 * @file js/components/consent-banner.js
 * @author Jay Patel
 */

class ConsentBanner {
    constructor() {
        this.consentKey = 'user-analytics-consent';
        this.consentBannerKey = 'consent-banner-shown';
        this.consentData = this.getStoredConsent();
        this.banner = null;

        this.init();
    }

    init() {
        // Don't show banner anymore - only use the FAB settings toggle
        // Initialize Google Analytics based on consent
        this.initializeAnalytics();

        // Initialize consent settings toggle
        this.initConsentToggle();
    }

    initConsentToggle() {
        const toggle = document.getElementById('consentSettingsToggle');
        const indicator = document.getElementById('consentStatusIndicator');

        if (toggle && indicator) {
            // Update indicator based on current consent status
            this.updateConsentIndicator();

            // Add click handler
            toggle.addEventListener('click', () => {
                this.showConsentSettings();
            });
        }
    }

    updateConsentIndicator() {
        const indicator = document.getElementById('consentStatusIndicator');
        if (!indicator) return;

        indicator.classList.remove('accepted', 'declined');

        if (this.consentData.hasResponded) {
            if (this.consentData.accepted) {
                indicator.classList.add('accepted');
            } else {
                indicator.classList.add('declined');
            }
        }
    }

    showConsentSettings() {
        const currentStatus = this.consentData.hasResponded
            ? (this.consentData.accepted ? 'Analytics enabled' : 'Analytics disabled')
            : 'Not set';

        const message = `Current Privacy Settings:
        
Analytics Status: ${currentStatus}

What would you like to do?

Enable Analytics - Help improve this portfolio
Disable Analytics - Browse privately
Reset - Show the consent banner again

Analytics helps me understand which sections are most engaging and improve the user experience. No personal information is collected.`;

        // Create a custom dialog
        this.createSettingsDialog();
    }

    createSettingsDialog() {
        // Remove existing dialog if any
        const existingDialog = document.getElementById('consent-settings-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }

        const dialog = document.createElement('div');
        dialog.id = 'consent-settings-dialog';
        dialog.className = 'consent-settings-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'consent-dialog-title');
        dialog.setAttribute('aria-describedby', 'consent-dialog-desc');

        const currentStatus = this.consentData.hasResponded
            ? (this.consentData.accepted ? 'Analytics enabled' : 'Analytics disabled')
            : 'Not set';

        dialog.innerHTML = `
            <div class="consent-settings-dialog-overlay" onclick="window.consentBanner?.closeSettingsDialog()"></div>
            <div class="consent-settings-dialog-content">
                <div class="consent-settings-dialog-header">
                    <div class="consent-settings-dialog-titlewrap">
                        <h3 id="consent-dialog-title">Privacy Settings</h3>
                                <p id="consent-dialog-desc" class="consent-dialog-subtitle">You're in control. Adjust analytics preferences for this site.</p>
                    </div>
                    <button class="consent-settings-dialog-close" onclick="window.consentBanner?.closeSettingsDialog()" aria-label="Close dialog">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
                            <path d="M18.3 5.71a.996.996 0 0 0-1.41 0L12 10.59 7.11 5.7A.996.996 0 1 0 5.7 7.11L10.59 12 5.7 16.89a.996.996 0 1 0 1.41 1.41L12 13.41l4.89 4.89a.996.996 0 1 0 1.41-1.41L13.41 12l4.89-4.89c.38-.38.38-1.02 0-1.4z"/>
                        </svg>
                    </button>
                </div>
                <div class="consent-settings-dialog-body">
                    <div class="consent-current-status">
                        <span class="consent-status-label">Current Status:</span>
                        <span class="consent-status-value ${this.consentData.hasResponded ? (this.consentData.accepted ? 'accepted' : 'declined') : 'not-set'}">${currentStatus}</span>
                    </div>
                    <div class="consent-toggle-row" role="group" aria-labelledby="analyticsToggleLabel">
                        <div class="toggle-text">
                            <h4 id="analyticsToggleLabel">Analytics</h4>
                            <p class="toggle-subtext">Help improve this site with anonymous usage insights. No personal data collected.</p>
                        </div>
                        <button class="consent-switch" id="analyticsSwitch" aria-pressed="${this.consentData.accepted && this.consentData.hasResponded ? 'true' : 'false'}" aria-label="Toggle analytics">
                            <span class="switch-handle"></span>
                            <span class="switch-label-on">On</span>
                            <span class="switch-label-off">Off</span>
                        </button>
                    </div>
                    
                    <div class="consent-settings-info">
                        <h4>About Analytics</h4>
                        <p>This portfolio uses Google Analytics to understand how visitors interact with the site, helping me improve the user experience.</p>
                        
                        <h4>What we track:</h4>
                        <ul class="consent-feature-list">
                            <li>Page views and navigation patterns</li>
                            <li>Time spent on different sections</li>
                            <li>Device and browser information (anonymized)</li>
                            <li>Geographic region (country level only)</li>
                        </ul>
                        
                        <h4>What we DON'T track:</h4>
                        <ul class="consent-feature-list">
                            <li>Personal information or identity</li>
                            <li>Exact location or IP address</li>
                            <li>Keystrokes or form inputs</li>
                            <li>Cross-site browsing activity</li>
                        </ul>
                        
                        <p><a href="/privacy.html" target="_blank" rel="noopener">Read our full Privacy Policy</a> for complete details.</p>
                    </div>
                </div>
                <div class="consent-settings-dialog-actions">
                    <button class="consent-dialog-btn consent-dialog-btn-enable" onclick="window.consentBanner?.enableAnalytics()">
                        Enable Analytics
                    </button>
                    <button class="consent-dialog-btn consent-dialog-btn-disable" onclick="window.consentBanner?.disableAnalytics()">
                        Disable Analytics
                    </button>
                    <button class="consent-dialog-btn consent-dialog-btn-reset" onclick="window.consentBanner?.resetConsentFromDialog()">
                        Reset Consent
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);
        // lock body scroll while dialog is open
        this._prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        // Focus the dialog
        setTimeout(() => {
            dialog.querySelector('.consent-dialog-btn-enable')?.focus();
        }, 100);

        // Add handlers: Escape, focus trap, and switch init
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                this.closeSettingsDialog();
                return;
            }
            if (e.key === 'Tab') {
                // Basic focus trap inside dialog content
                const focusable = dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                const focusables = Array.from(focusable).filter(el => !el.hasAttribute('disabled'));
                if (focusables.length === 0) return;
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    last.focus();
                    e.preventDefault();
                } else if (!e.shiftKey && document.activeElement === last) {
                    first.focus();
                    e.preventDefault();
                }
            }
        };
        document.addEventListener('keydown', handleKeydown);

        // Initialize switch state and handlers
        const switchEl = dialog.querySelector('#analyticsSwitch');
        if (switchEl) {
            this._syncSwitch(switchEl);
            switchEl.addEventListener('click', () => {
                const next = !(this.consentData.accepted && this.consentData.hasResponded);
                this.setConsentInline(next);
                this._syncSwitch(switchEl);
                this._syncStatusChip(dialog);
            });
            switchEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    switchEl.click();
                }
            });
        }

        // store cleanup to remove listeners on close
        this._dialogKeydownHandler = handleKeydown;
    }

    closeSettingsDialog() {
        const dialog = document.getElementById('consent-settings-dialog');
        if (dialog) {
            // Reset cursor state before removing dialog
            if (window.customCursor) {
                window.customCursor.setHoverState(false);
            }
            dialog.remove();
            // restore body scroll
            if (this._prevOverflow !== undefined) {
                document.body.style.overflow = this._prevOverflow;
                this._prevOverflow = undefined;
            }
            if (this._dialogKeydownHandler) {
                document.removeEventListener('keydown', this._dialogKeydownHandler);
                this._dialogKeydownHandler = null;
            }
        }
    }

    enableAnalytics() {
        this.saveConsent(true, true);
        this.initializeAnalytics();
        this.updateConsentIndicator();
        this.closeSettingsDialog();

        // Show confirmation message
        this.showConfirmation('Analytics enabled. Thank you for helping improve this portfolio!');
    }

    disableAnalytics() {
        this.saveConsent(false, true);
        this.disableAnalyticsTracking();
        this.updateConsentIndicator();
        this.closeSettingsDialog();

        // Show confirmation message
        this.showConfirmation('Analytics disabled. Your privacy choice has been respected.');
    }

    resetConsentFromDialog() {
        // Reset consent data
        this.resetConsent();
        this.updateConsentIndicator();
        this.closeSettingsDialog();

        // Show confirmation message
        this.showConfirmation('Consent settings have been reset.');
    }

    acceptConsent() {
        this.saveConsent(true, true);
        this.initializeAnalytics();

        // Show confirmation message
        this.showConfirmation('Analytics enabled. Thank you for helping improve this portfolio!');
    }

    declineConsent() {
        this.saveConsent(false, true);
        this.disableAnalyticsTracking();

        // Show confirmation message
        this.showConfirmation('Analytics disabled. Your privacy choice has been respected.');
    }

    dismissBanner() {
        // No longer needed since we don't show the banner
        // but keep method for backward compatibility
        this.markBannerAsDismissed();

        // Default to no analytics if dismissed without choice
        this.saveConsent(false, false);
    }

    showSettings() {
        alert(`Analytics Settings:
        
🎯 What we track:
• Page views and navigation patterns
• Time spent on different sections  
• Device and browser information (anonymized)
• Geographic region (country level only)

🔒 What we DON'T track:
• Personal information or identity
• Exact location or IP address
• Keystrokes or form inputs
• Cross-site browsing activity

📊 Purpose:
This data helps me understand which portfolio sections are most engaging and improve the user experience.

You can change your preference anytime by clearing your browser cookies for this site.`);
    }

    showPrivacyInfo() {
        alert(`Privacy Information:
        
This portfolio is built with privacy in mind:

✅ Analytics Purpose: Only to improve portfolio presentation and user experience
✅ Data Minimization: Only essential interaction data is collected
✅ No Personal Data: No names, emails, or personal information stored
✅ Anonymized: All data is processed anonymously by Google Analytics
✅ Your Choice: You can opt-out anytime

For questions about data handling, you can contact me through the portfolio contact section.`);
    }

    showConfirmation(message) {
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: var(--theme-primary);
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 45;
            font-size: 14px;
            max-width: 300px;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Remove after delay
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    setConsentInline(accepted) {
        // Save without closing the dialog; update analytics and indicator
        this.saveConsent(accepted, true);
        if (accepted) {
            this.initializeAnalytics();
        } else {
            this.disableAnalyticsTracking();
        }
        this.updateConsentIndicator();
        this.showConfirmation(accepted ? 'Analytics enabled.' : 'Analytics disabled.');
    }

    _syncSwitch(switchEl) {
        const isOn = this.consentData.accepted && this.consentData.hasResponded;
        switchEl.classList.toggle('is-on', isOn);
        switchEl.setAttribute('aria-pressed', isOn ? 'true' : 'false');
    }

    _syncStatusChip(root = document) {
        const statusEl = root.querySelector('.consent-status-value');
        if (!statusEl) return;
        statusEl.classList.remove('accepted', 'declined', 'not-set');
        const has = this.consentData.hasResponded;
        const txt = has ? (this.consentData.accepted ? 'Analytics enabled' : 'Analytics disabled') : 'Not set';
        statusEl.textContent = txt;
        statusEl.classList.add(has ? (this.consentData.accepted ? 'accepted' : 'declined') : 'not-set');
    }

    saveConsent(accepted, hasResponded = true) {
        const consentData = {
            accepted,
            hasResponded,
            timestamp: Date.now(),
            version: '1.0'
        };

        // Save to localStorage
        localStorage.setItem(this.consentKey, JSON.stringify(consentData));

        // Save to cookie as backup (1 year expiry)
        const expires = new Date();
        expires.setFullYear(expires.getFullYear() + 1);
        document.cookie = `${this.consentKey}=${JSON.stringify(consentData)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;

        this.consentData = consentData;
    }

    getStoredConsent() {
        // Try localStorage first
        const stored = localStorage.getItem(this.consentKey);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.warn('Invalid consent data in localStorage');
            }
        }

        // Fallback to cookie
        const cookies = document.cookie.split('; ');
        const consentCookie = cookies.find(row => row.startsWith(`${this.consentKey}=`));
        if (consentCookie) {
            try {
                const value = decodeURIComponent(consentCookie.split('=')[1]);
                return JSON.parse(value);
            } catch (e) {
                console.warn('Invalid consent data in cookie');
            }
        }

        // Default state
        return {
            accepted: false,
            hasResponded: false,
            timestamp: null,
            version: '1.0'
        };
    }

    markBannerAsDismissed() {
        localStorage.setItem(this.consentBannerKey, 'true');
        const expires = new Date();
        expires.setDate(expires.getDate() + 7); // Show again after 1 week if dismissed
        document.cookie = `${this.consentBannerKey}=true;expires=${expires.toUTCString()};path=/;SameSite=Lax`;
    }

    hasBeenDismissed() {
        return localStorage.getItem(this.consentBannerKey) === 'true' ||
            document.cookie.includes(`${this.consentBannerKey}=true`);
    }

    initializeAnalytics() {
        if (this.consentData.accepted && this.consentData.hasResponded) {
            this.loadGoogleAnalytics();
        }
    }

    loadGoogleAnalytics() {
        // Replace 'GA_MEASUREMENT_ID' with your actual Google Analytics 4 Measurement ID
        const GA_MEASUREMENT_ID = 'G-GGZTYJVH9J'; // Your actual GA4 Measurement ID

        // Load Google Analytics
        const script1 = document.createElement('script');
        script1.async = true;
        script1.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
        document.head.appendChild(script1);

        // Initialize gtag
        window.dataLayer = window.dataLayer || [];
        function gtag() { dataLayer.push(arguments); }
        window.gtag = gtag;

        // Update consent for analytics
        gtag('consent', 'update', {
            'analytics_storage': 'granted'
        });

        gtag('js', new Date());
        gtag('config', GA_MEASUREMENT_ID, {
            anonymize_ip: true,
            cookie_flags: 'SameSite=Lax;Secure',
            send_page_view: true,
            allow_google_signals: false,
            allow_ad_personalization_signals: false
        });

        console.log('Google Analytics initialized with consent');
    }

    disableAnalyticsTracking() {
        // Disable Google Analytics through consent mode
        if (window.gtag) {
            window.gtag('consent', 'update', {
                'analytics_storage': 'denied'
            });
        }

        // Clear any existing GA cookies
        const gaCookies = document.cookie.split(';').filter(cookie =>
            cookie.trim().startsWith('_ga') ||
            cookie.trim().startsWith('_gid') ||
            cookie.trim().startsWith('_gat')
        );

        gaCookies.forEach(cookie => {
            const cookieName = cookie.split('=')[0].trim();
            document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${window.location.hostname}`;
            document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        });

        console.log('Google Analytics disabled and cookies cleared');
    }

    addKeyboardListeners() {
        if (!this.banner) return;

        this.banner.addEventListener('keydown', (e) => {
            // Handle Escape key
            if (e.key === 'Escape') {
                this.dismissBanner();
            }

            // Handle Tab navigation
            if (e.key === 'Tab') {
                const focusableElements = this.banner.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];

                if (e.shiftKey && document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                } else if (!e.shiftKey && document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        });
    }

    // Public method to check current consent status
    hasConsent() {
        return this.consentData.accepted && this.consentData.hasResponded;
    }

    // Public method to reset consent (for testing or user request)
    resetConsent() {
        localStorage.removeItem(this.consentKey);
        localStorage.removeItem(this.consentBannerKey);
        document.cookie = `${this.consentKey}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        document.cookie = `${this.consentBannerKey}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;

        this.consentData = {
            accepted: false,
            hasResponded: false,
            timestamp: null,
            version: '1.0'
        };

        // Update the indicator without reloading the page
        this.updateConsentIndicator();

        // Disable analytics tracking
        this.disableAnalyticsTracking();
    }
}

// Initialize consent banner when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.consentBanner = new ConsentBanner();
});

// Export for module use if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConsentBanner;
}
