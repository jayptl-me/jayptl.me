/**
 * Theme Toggle Component
 * Provides manual control for toggling between light and dark themes
 * 
 * @file js/components/theme-toggle.js
 * @author Jay Patel
 */

class ThemeToggle {
    constructor() {
        this.toggles = Array.from(document.querySelectorAll('.theme-toggle'));
        this.onClick = this.onClick.bind(this);
        this.init();
    }

    init() {
        // Always register global listeners and sync theme, even if no toggles exist
        this.toggles.forEach(btn => btn.addEventListener('click', this.onClick));

        window.addEventListener('themechange', (e) => {
            this.updateToggleState(e.detail.theme);
        });

        if (window.themeManager) {
            this.updateToggleState(window.themeManager.getCurrentTheme());
        }
    }

    onClick() {
        if (window.themeManager) {
            window.themeManager.toggleTheme();
        }
    }

    updateToggleState(theme) {
        this.toggles.forEach(btn => btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false'));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.themeToggleComponent = new ThemeToggle();
});
