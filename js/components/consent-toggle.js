/**
 * Analytics Consent Toggle
 * A floating button that shows consent status and allows users to toggle analytics consent
 * 
 * @file components/consent-toggle.js
 * @author Jay Patel
 */

class ConsentToggle {
    constructor() {
        this.expanded = false;
        this.toggleButton = null;
        this.initialized = false;
        
        // Only initialize after DOM content is loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }
    
    /**
     * Initialize the consent toggle button
     */
    init() {
        if (this.initialized) return;
        
        this.createToggleButton();
        this.addEventListeners();
        this.updateButtonState();
        this.initialized = true;
        
        // Update button state when consent manager changes
        if (window.consentManager) {
            // Use setTimeout to ensure this happens after ConsentManager is fully initialized
            setTimeout(() => this.updateButtonState(), 500);
        }
    }
    
    /**
     * Create the toggle button HTML and append to the DOM
     */
    createToggleButton() {
        const toggleHTML = `
            <button class="consent-toggle" id="consentToggle" aria-label="Toggle analytics consent" title="Analytics consent settings">
                <svg class="consent-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm0 1c-2.33 0-7 1.17-7 3.5V17h14v-1.5c0-2.33-4.67-3.5-7-3.5zm0-8c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm0 4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm0 6c1.11 0 2-.89 2-2 0-1.11-.89-2-2-2-1.11 0-2 .89-2 2 0 1.11.89 2 2 2zm8-9c.55 0 1 .45 1 1v3.5c0 .55-.45 1-1 1s-1-.45-1-1v-3.5c0-.55.45-1 1-1zm0 8.5c.55 0 1 .45 1 1s-.45 1-1 1h-1.5c-.55 0-1-.45-1-1s.45-1 1-1h1.5zm-15-10.5c0-.55.45-1 1-1s1 .45 1 1v3.5c0 .55-.45 1-1 1s-1-.45-1-1v-3.5zm2.5 10.5h-1.5c-.55 0-1-.45-1-1s.45-1 1-1h1.5c.55 0-1 .45-1 1s-.45 1-1 1z"/>
                </svg>
                <div class="consent-toggle-content">
                    <span class="consent-toggle-text">Analytics: <span class="consent-toggle-status">Disabled</span></span>
                </div>
            </button>
        `;
        
        document.body.insertAdjacentHTML('beforeend', toggleHTML);
        this.toggleButton = document.getElementById('consentToggle');
    }
    
    /**
     * Add event listeners for button interactions
     */
    addEventListeners() {
        if (!this.toggleButton) return;
        
        // Toggle expand/collapse state on click
        this.toggleButton.addEventListener('click', (e) => {
            if (this.expanded) {
                this.toggleConsent();
            } else {
                this.expandButton();
            }
        });
        
        // Close on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.expanded) {
                this.collapseButton();
            }
        });
        
        // Close on click outside
        document.addEventListener('click', (e) => {
            if (this.expanded && this.toggleButton && !this.toggleButton.contains(e.target)) {
                this.collapseButton();
            }
        });
    }
    
    /**
     * Expand the button to show the consent status
     */
    expandButton() {
        if (!this.toggleButton) return;
        
        this.toggleButton.classList.add('expanded');
        this.expanded = true;
        
        // Auto collapse after 5 seconds
        setTimeout(() => {
            if (this.expanded) {
                this.collapseButton();
            }
        }, 5000);
    }
    
    /**
     * Collapse the button to its compact state
     */
    collapseButton() {
        if (!this.toggleButton) return;
        
        this.toggleButton.classList.remove('expanded');
        this.expanded = false;
    }
    
    /**
     * Toggle the analytics consent status
     */
    toggleConsent() {
        if (!window.consentManager) return;
        
        const currentStatus = window.consentManager.getConsentStatus();
        
        if (currentStatus.granted) {
            window.consentManager.revokeConsent();
            // The consent manager's revokeConsent method already shows a confirmation
        } else {
            window.consentManager.grantConsent();
            // The consent manager's grantConsent method already shows a confirmation
        }
        
        this.updateButtonState();
        this.collapseButton();
    }
    
    /**
     * Update the button state based on current consent status
     */
    updateButtonState() {
        if (!this.toggleButton || !window.consentManager) return;
        
        const consentStatus = window.consentManager.getConsentStatus();
        const statusElement = this.toggleButton.querySelector('.consent-toggle-status');
        
        if (consentStatus.granted) {
            this.toggleButton.classList.add('consent-granted');
            if (statusElement) statusElement.textContent = 'Enabled';
        } else {
            this.toggleButton.classList.remove('consent-granted');
            if (statusElement) statusElement.textContent = 'Disabled';
        }
    }
    
    // The showNotification method has been removed as it's redundant
    // We're now using the ConsentManager's showConsentConfirmation method instead
}

// Initialize when the script loads
const consentToggle = new ConsentToggle();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConsentToggle;
}
