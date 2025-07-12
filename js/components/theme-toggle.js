/**
 * Theme Toggle Component
 * Provides manual control for toggling between light and dark themes
 * 
 * @file js/components/theme-toggle.js
 * @author Jay Patel
 */

class ThemeToggle {
    constructor() {
        this.themeToggle = document.getElementById('themeToggle');
        this.init();
    }
    
    init() {
        if (!this.themeToggle) {
            return;
        }
        
        this.themeToggle.addEventListener('click', this.toggleTheme.bind(this));
        
        window.addEventListener('themechange', (e) => {
            this.updateToggleState(e.detail.theme);
        });

        if (window.themeManager) {
            this.updateToggleState(window.themeManager.getCurrentTheme());
        }
    }
    
    toggleTheme() {
        if (window.themeManager) {
            const newTheme = window.themeManager.toggleTheme();
        }
    }

    updateToggleState(theme) {
        if (this.themeToggle) {
            this.themeToggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.themeToggleComponent = new ThemeToggle();
});
