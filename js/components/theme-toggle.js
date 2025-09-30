/**
 * Theme Toggle Component
 * Provides manual control for toggling between light and dark themes
 * 
 * @file js/components/theme-toggle.js
 * @author Jay Patel
 */

class ThemeToggle {
    constructor() {
        // Bind handlers
        this.onDocumentClick = this.onDocumentClick.bind(this);
        this.onThemeChange = this.onThemeChange.bind(this);
        this.init();
    }

    init() {
        // Delegate clicks so dynamically-inserted toggles work
        document.addEventListener('click', this.onDocumentClick);

        // Listen for theme changes to update ARIA state
        window.addEventListener('themechange', this.onThemeChange);

        // If no global themeManager exists (some pages might not load js/main.js),
        // provide a lightweight fallback so toggles still work.
        if (!window.themeManager) {
            window.themeManager = this.createFallbackManager();
        }

        // Initialize state
        this.onThemeChange({ detail: { theme: window.themeManager.getCurrentTheme() } });
    }

    onDocumentClick(e) {
        const btn = e.target.closest && e.target.closest('.theme-toggle');
        if (!btn) return;
        e.preventDefault();
        window.themeManager.toggleTheme();
    }

    onThemeChange(e) {
        const theme = (e && e.detail && e.detail.theme) || window.themeManager.getCurrentTheme();
        const toggles = Array.from(document.querySelectorAll('.theme-toggle'));
        toggles.forEach(btn => btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false'));
    }

    // Minimal fallback theme manager used only when no global manager exists.
    createFallbackManager() {
        const self = this;
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        function getStored() {
            try {
                const s = localStorage.getItem('user-theme-preference');
                if (s === 'dark' || s === 'light') return s;
            } catch { }
            try {
                const cookies = document.cookie.split('; ');
                const found = cookies.find(c => c.startsWith('preferred-theme='));
                if (found) {
                    const val = found.split('=')[1];
                    if (val === 'dark' || val === 'light') return val;
                }
            } catch { }
            return null;
        }

        function setStored(theme) {
            try { localStorage.setItem('user-theme-preference', theme); } catch { }
            try { document.cookie = `preferred-theme=${theme};path=/;max-age=31536000;SameSite=Lax`; } catch { }
        }

        const manager = {
            getCurrentTheme() {
                return document.documentElement.getAttribute('data-theme') || getStored() || (mediaQuery.matches ? 'dark' : 'light');
            },
            applyTheme(theme) {
                document.documentElement.setAttribute('data-theme', theme);
                document.documentElement.style.colorScheme = theme;
                // Dispatch the same event other components listen to
                window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
            },
            toggleTheme() {
                const current = manager.getCurrentTheme();
                const next = current === 'dark' ? 'light' : 'dark';
                setStored(next);
                manager.applyTheme(next);
                return next;
            }
        };

        // Initialize theme from stored or system pref
        const initial = manager.getCurrentTheme();
        manager.applyTheme(initial);

        // Also react to system changes if user hasn't explicitly set a preference
        mediaQuery.addEventListener && mediaQuery.addEventListener('change', (e) => {
            const stored = getStored();
            if (!stored) {
                manager.applyTheme(e.matches ? 'dark' : 'light');
            }
        });

        return manager;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.themeToggleComponent = new ThemeToggle();
});
