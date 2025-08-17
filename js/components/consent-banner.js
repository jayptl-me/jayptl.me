
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

        // Overlay
        const overlay = document.createElement('div');
        overlay.className = 'consent-settings-dialog-overlay';
        overlay.addEventListener('click', () => this.closeSettingsDialog());
        dialog.appendChild(overlay);

        // Content wrapper
        const content = document.createElement('div');
        content.className = 'consent-settings-dialog-content';

        // Header
        const header = document.createElement('div');
        header.className = 'consent-settings-dialog-header';

        const titlewrap = document.createElement('div');
        titlewrap.className = 'consent-settings-dialog-titlewrap';
        const h3 = document.createElement('h3');
        h3.id = 'consent-dialog-title';
        h3.textContent = 'Privacy Settings';
        const pdesc = document.createElement('p');
        pdesc.id = 'consent-dialog-desc';
        pdesc.className = 'consent-dialog-subtitle';
        pdesc.textContent = "You're in control. Adjust analytics preferences for this site.";
        titlewrap.appendChild(h3);
        titlewrap.appendChild(pdesc);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'consent-settings-dialog-close';
        closeBtn.setAttribute('aria-label', 'Close dialog');
        // Build close icon SVG via DOM to avoid innerHTML
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('xmlns', svgNS);
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', '20');
        svg.setAttribute('height', '20');
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', 'M18.3 5.71a.996.996 0 0 0-1.41 0L12 10.59 7.11 5.7A.996.996 0 1 0 5.7 7.11L10.59 12 5.7 16.89a.996.996 0 1 0 1.41 1.41L12 13.41l4.89 4.89a.996.996 0 1 0 1.41-1.41L13.41 12l4.89-4.89c.38-.38.38-1.02 0-1.4z');
        svg.appendChild(path);
        closeBtn.appendChild(svg);
        closeBtn.addEventListener('click', () => this.closeSettingsDialog());

        header.appendChild(titlewrap);
        header.appendChild(closeBtn);

        // Body
        const body = document.createElement('div');
        body.className = 'consent-settings-dialog-body';

        const currentStatusWrap = document.createElement('div');
        currentStatusWrap.className = 'consent-current-status';
        const statusLabel = document.createElement('span');
        statusLabel.className = 'consent-status-label';
        statusLabel.textContent = 'Current Status:';
        const statusValue = document.createElement('span');
        statusValue.className = `consent-status-value ${this.consentData.hasResponded ? (this.consentData.accepted ? 'accepted' : 'declined') : 'not-set'}`;
        statusValue.textContent = this.consentData.hasResponded ? (this.consentData.accepted ? 'Analytics enabled' : 'Analytics disabled') : 'Not set';
        currentStatusWrap.appendChild(statusLabel);
        currentStatusWrap.appendChild(statusValue);

        // Toggle row
        const toggleRow = document.createElement('div');
        toggleRow.className = 'consent-toggle-row';
        toggleRow.setAttribute('role', 'group');
        toggleRow.setAttribute('aria-labelledby', 'analyticsToggleLabel');

        const toggleText = document.createElement('div');
        toggleText.className = 'toggle-text';
        const h4 = document.createElement('h4');
        h4.id = 'analyticsToggleLabel';
        h4.textContent = 'Analytics';
        const toggleP = document.createElement('p');
        toggleP.className = 'toggle-subtext';
        toggleP.textContent = 'Help improve this site with anonymous usage insights. No personal data collected.';
        toggleText.appendChild(h4);
        toggleText.appendChild(toggleP);

        // Switch - accessible
        const switchBtn = document.createElement('button');
        switchBtn.className = 'consent-switch';
        switchBtn.id = 'analyticsSwitch';
        const isOn = this.consentData.accepted && this.consentData.hasResponded;
        switchBtn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
        switchBtn.setAttribute('aria-label', 'Toggle analytics');
        switchBtn.tabIndex = 0;
        // inner structure for switch (build via DOM to avoid innerHTML)
        const handle = document.createElement('span');
        handle.className = 'switch-handle';
        switchBtn.appendChild(handle);
        // click toggles consent
        switchBtn.addEventListener('click', () => {
            const next = !(this.consentData.accepted && this.consentData.hasResponded);
            this.setConsentInline(next);
            // update UI
            const isNowOn = this.consentData.accepted && this.consentData.hasResponded;
            switchBtn.classList.toggle('is-on', isNowOn);
            switchBtn.setAttribute('aria-pressed', isNowOn ? 'true' : 'false');
            statusValue.className = `consent-status-value ${this.consentData.hasResponded ? (this.consentData.accepted ? 'accepted' : 'declined') : 'not-set'}`;
            statusValue.textContent = this.consentData.hasResponded ? (this.consentData.accepted ? 'Analytics enabled' : 'Analytics disabled') : 'Not set';
        });

        toggleRow.appendChild(toggleText);
        toggleRow.appendChild(switchBtn);

        // Info section built with DOM APIs (avoids innerHTML for dynamic content)
        const info = document.createElement('div');
        info.className = 'consent-settings-info';

        const aboutH4 = document.createElement('h4');
        aboutH4.textContent = 'About Analytics';
        const aboutP = document.createElement('p');
        aboutP.textContent = 'This portfolio uses Google Analytics to understand how visitors interact with the site, helping me improve the user experience.';

        const whatH4 = document.createElement('h4');
        whatH4.textContent = 'What we track:';
        const ulTrack = document.createElement('ul');
        ulTrack.className = 'consent-feature-list';
        ['Page views and navigation patterns', 'Time spent on different sections', 'Device and browser information (anonymized)', 'Geographic region (country level only)']
            .forEach(txt => {
                const li = document.createElement('li');
                li.textContent = txt;
                ulTrack.appendChild(li);
            });

        const dontH4 = document.createElement('h4');
        dontH4.textContent = "What we DON'T track:";
        const ulDont = document.createElement('ul');
        ulDont.className = 'consent-feature-list';
        ['Personal information or identity', 'Exact location or IP address', 'Keystrokes or form inputs', 'Cross-site browsing activity']
            .forEach(txt => {
                const li = document.createElement('li');
                li.textContent = txt;
                ulDont.appendChild(li);
            });

        const privacyP = document.createElement('p');
        const privacyLink = document.createElement('a');
        privacyLink.href = '/privacy.html';
        privacyLink.target = '_blank';
        privacyLink.rel = 'noopener';
        privacyLink.textContent = 'Read our full Privacy Policy';
        privacyP.appendChild(privacyLink);
        privacyP.appendChild(document.createTextNode(' for complete details.'));

        info.appendChild(aboutH4);
        info.appendChild(aboutP);
        info.appendChild(whatH4);
        info.appendChild(ulTrack);
        info.appendChild(dontH4);
        info.appendChild(ulDont);
        info.appendChild(privacyP);

        // assemble
        body.appendChild(currentStatusWrap);
        body.appendChild(toggleRow);
        body.appendChild(info);

        content.appendChild(header);
        content.appendChild(body);

        dialog.appendChild(content);

        document.body.appendChild(dialog);
        // lock body scroll while dialog is open
        // Always capture the current overflow so we restore the exact value on close
        this._prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        // Focus the dialog
        setTimeout(() => {
            dialog.querySelector('.consent-switch')?.focus();
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

        // Initialize switch visual state
        const switchEl = document.getElementById('analyticsSwitch');
        if (switchEl) {
            this._syncSwitch(switchEl);
            // keyboard activation
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
            // restore body scroll (if we captured a value) and clear stored value
            if (typeof this._prevOverflow !== 'undefined') {
                document.body.style.overflow = this._prevOverflow;
            }
            this._prevOverflow = undefined;
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
        // Use encodeURIComponent to avoid breaking cookie format
        let cookieStr = `${this.consentKey}=${encodeURIComponent(JSON.stringify(consentData))};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
        // Add Secure flag when served over HTTPS
        try {
            if (window.location && window.location.protocol === 'https:') {
                cookieStr += ';Secure';
            }
        } catch (e) {
            // silent
        }
        document.cookie = cookieStr;

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

    }

    disableAnalyticsTracking() {
        // Disable Google Analytics through consent mode
        if (window.gtag) {
            window.gtag('consent', 'update', {
                'analytics_storage': 'denied'
            });
        }

        // Attempt to clear any existing GA cookies using several permutations.
        const cookieNames = ['_ga', '_gid', '_gat'];
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        const baseDomain = parts.length > 2 ? parts.slice(-2).join('.') : hostname;
        // Unique variants: subdomain, bare, eTLD+1 (with/without dot)
        const domainVariants = [`.${hostname}`, hostname, `.${baseDomain}`, baseDomain]
            .filter((v, i, arr) => arr.indexOf(v) === i);
        const pathVariants = ['/', ''];
        const secureVariants = ['', ';Secure'];

        cookieNames.forEach(name => {
            // brute-force attempt: try common domain/path/secure combinations
            domainVariants.forEach(domain => {
                pathVariants.forEach(path => {
                    secureVariants.forEach(secureFlag => {
                        try {
                            // Expire cookie
                            const cookieStr = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path || '/'};domain=${domain};SameSite=Lax${secureFlag}`;
                            document.cookie = cookieStr;
                        } catch (e) {
                            // ignore
                        }
                    });
                });
            });

            // also try without domain attribute
            try {
                document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax`;
            } catch (e) { }
        });

        // Also try to remove the consent cookie we set
        try {
            const consentName = this.consentKey;
            domainVariants.forEach(domain => {
                pathVariants.forEach(path => {
                    secureVariants.forEach(secureFlag => {
                        try {
                            document.cookie = `${consentName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path || '/'};domain=${domain};SameSite=Lax${secureFlag}`;
                        } catch (e) { }
                    });
                });
            });
            document.cookie = `${consentName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax`;
        } catch (e) { }

        // Google Analytics disabled and cookie removal attempted (client-side best-effort)
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
