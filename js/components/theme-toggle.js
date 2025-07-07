/**
 * Theme Toggle Component
 * Optional theme toggle button that you can add to your site
 * 
 * @file js/components/theme-toggle.js
 * @author Jay Patel
 */

class ThemeToggle {
    constructor(selector = '.theme-toggle') {
        this.button = document.querySelector(selector);
        if (!this.button) {
            console.warn('ThemeToggle: No element found with selector:', selector);
            return;
        }
        
        this.init();
    }
    
    init() {
        this.createButton();
        this.attachEventListeners();
        this.updateButtonState();
    }
    
    createButton() {
        // Create button HTML if it doesn't exist
        if (!this.button.innerHTML.trim()) {
            this.button.innerHTML = `
                <span class="theme-toggle__icon">
                    <svg class="theme-toggle__sun" width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/>
                        <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <svg class="theme-toggle__moon" width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </span>
                <span class="theme-toggle__text">
                    <span class="theme-toggle__light-text">Light</span>
                    <span class="theme-toggle__dark-text">Dark</span>
                    <span class="theme-toggle__auto-text">Auto</span>
                </span>
            `;
        }
        
        // Add CSS classes
        this.button.classList.add('theme-toggle');
        this.button.setAttribute('aria-label', 'Toggle theme');
        this.button.setAttribute('type', 'button');
    }
    
    attachEventListeners() {
        this.button.addEventListener('click', () => this.toggleTheme());
        
        // Listen for theme changes
        document.addEventListener('themechange', (e) => {
            this.updateButtonState(e.detail.theme);
        });
    }
    
    toggleTheme() {
        if (!window.themeManager) {
            console.warn('ThemeToggle: ThemeManager not found');
            return;
        }
        
        const currentTheme = window.themeManager.getCurrentTheme();
        const systemTheme = window.themeManager.getSystemTheme();
        
        // Cycle through: light -> dark -> auto -> light...
        let nextTheme;
        if (currentTheme === 'light') {
            nextTheme = 'dark';
        } else if (currentTheme === 'dark') {
            nextTheme = 'auto';
        } else {
            nextTheme = 'light';
        }
        
        window.themeManager.setTheme(nextTheme);
    }
    
    updateButtonState(theme = null) {
        if (!theme && window.themeManager) {
            theme = window.themeManager.getCurrentTheme();
        }
        
        // Remove all theme classes
        this.button.classList.remove('theme-toggle--light', 'theme-toggle--dark', 'theme-toggle--auto');
        
        // Add current theme class
        if (theme) {
            this.button.classList.add(`theme-toggle--${theme}`);
        }
        
        // Update aria-label
        const labels = {
            light: 'Switch to dark theme',
            dark: 'Switch to auto theme',
            auto: 'Switch to light theme'
        };
        
        this.button.setAttribute('aria-label', labels[theme] || 'Toggle theme');
    }
}

// Auto-initialize if element exists
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.theme-toggle')) {
        new ThemeToggle();
    }
});

// Export for manual initialization
window.ThemeToggle = ThemeToggle;
