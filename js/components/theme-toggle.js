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

        // Calculate click/tap coordinates, or use button center for keyboard triggers
        let origin = null;
        if (typeof e.clientX === 'number' && typeof e.clientY === 'number' && (e.clientX !== 0 || e.clientY !== 0)) {
            origin = { x: e.clientX, y: e.clientY };
        } else {
            const rect = btn.getBoundingClientRect();
            origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
        
        // Toggle theme with origin
        const newTheme = window.themeManager.toggleTheme({ origin });
        
        // Play lightsaber sound effect
        if (window.SoundManager) {
            if (newTheme === 'dark') {
                // Switching to dark mode - ignite the saber
                window.SoundManager.playLightsaberIgnite();
            } else {
                // Switching to light mode - retract the saber
                window.SoundManager.playLightsaberRetract();
            }
        }
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
            applyTheme(theme, opts = {}) {
                const setDOMTheme = () => {
                    document.documentElement.setAttribute('data-theme', theme);
                    document.documentElement.style.colorScheme = theme;
                    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
                };

                const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                const canViewTransition = Boolean(document.startViewTransition && !reduceMotion && opts.animate !== false);

                if (!canViewTransition) {
                    setDOMTheme();
                    return;
                }

                let origin = opts.origin;
                if (!origin) {
                    const toggleBtn = document.querySelector('.theme-toggle');
                    if (toggleBtn) {
                        const rect = toggleBtn.getBoundingClientRect();
                        origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                    } else {
                        origin = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
                    }
                }

                const transition = document.startViewTransition(() => {
                    setDOMTheme();
                });

                const x = origin.x;
                const y = origin.y;
                const endRadius = Math.hypot(
                    Math.max(x, window.innerWidth - x),
                    Math.max(y, window.innerHeight - y)
                );

                transition.ready.then(() => {
                    document.documentElement.animate(
                        {
                            clipPath: [
                                `circle(0px at ${x}px ${y}px)`,
                                `circle(${endRadius}px at ${x}px ${y}px)`
                            ]
                        },
                        {
                            duration: 450,
                            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                            pseudoElement: '::view-transition-new(root)'
                        }
                    );
                }).catch(() => { });
            },
            toggleTheme(opts = {}) {
                const current = manager.getCurrentTheme();
                const next = current === 'dark' ? 'light' : 'dark';
                setStored(next);
                manager.applyTheme(next, { animate: true, origin: opts.origin });
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
