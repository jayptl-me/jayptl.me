/**
 * Jay Patel Portfolio - Main JavaScript
 * Core functionality and component initialization
 * 
 * @file js/main.js
 * @author Jay Patel
 */

// Enhanced theme system that actively detects and responds to system preference changes
class ThemeManager {
    constructor() {
        this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        this.userPreference = this.getThemePreference();
        this.init();
    }

    init() {
        const initialTheme = this.userPreference || (this.mediaQuery.matches ? 'dark' : 'light');
        this.applyTheme(initialTheme, { animate: false });

        this.mediaQuery.addEventListener('change', e => {
            if (!this.userPreference) {
                this.applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    applyTheme(theme, opts = {}) {
        const setDOMTheme = () => {
            document.documentElement.setAttribute('data-theme', theme);
            document.documentElement.style.colorScheme = theme;

            // Dispatch a custom event to notify other components of the theme change
            window.dispatchEvent(new CustomEvent('themechange', {
                detail: { theme }
            }));
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
    }

    toggleTheme(opts = {}) {
        const currentTheme = this.getCurrentTheme();
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        this.setThemePreference(newTheme);
        this.applyTheme(newTheme, { animate: true, origin: opts.origin });

        return newTheme;
    }

    setThemePreference(theme) {
        this.userPreference = theme;

        // Save to localStorage (primary method)
        try {
            localStorage.setItem('user-theme-preference', theme);
        } catch (e) {
            console.warn('Failed to save theme preference to localStorage:', e);
        }

        // Save to cookie as fallback for cross-session persistence
        try {
            document.cookie = `preferred-theme=${theme};path=/;max-age=31536000;SameSite=Lax`;
        } catch (e) {
            console.warn('Failed to save theme preference to cookie:', e);
        }
    }

    getThemePreference() {
        // Try localStorage first (primary method)
        try {
            const stored = localStorage.getItem('user-theme-preference');
            if (stored && (stored === 'light' || stored === 'dark')) {
                return stored;
            }
        } catch (e) {
            console.warn('Failed to read theme preference from localStorage:', e);
        }

        // Fallback to cookie
        try {
            const cookies = document.cookie.split('; ');
            const themeCookie = cookies.find(row => row.startsWith('preferred-theme='));
            if (themeCookie) {
                const theme = themeCookie.split('=')[1];
                if (theme === 'light' || theme === 'dark') {
                    // Migrate cookie value to localStorage for future use
                    try {
                        localStorage.setItem('user-theme-preference', theme);
                    } catch (e) {
                        // Silent fail for migration
                    }
                    return theme;
                }
            }
        } catch (e) {
            console.warn('Failed to read theme preference from cookie:', e);
        }

        return null;
    }

    getCurrentTheme() {
        return document.documentElement.getAttribute('data-theme') || (this.mediaQuery.matches ? 'dark' : 'light');
    }
}

// Navigation Management - REMOVED (no navigation in current HTML)

// Animation handled by components/scroll-reveal.js; removing duplicate logic

// Form Management - REMOVED (no forms in current HTML)

// Analytics utility functions - REMOVED (no GA setup)

// Utility Functions
class Utils {
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function () {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }
}

// Initialize enhanced theme manager and make it globally available
window.themeManager = new ThemeManager();

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {

    // Hide/Show glass navbar based on scroll direction after reveal is released
    const glassNav = document.getElementById('glassNav');
    if (glassNav) {
        let lastY = window.scrollY;
        const navLinks = Array.from(glassNav.querySelectorAll('.nav-link[href^="#"]'));
        const sections = navLinks
            .map(a => document.querySelector(a.getAttribute('href')))
            .filter(Boolean);

        const onScroll = () => {
            const y = window.scrollY;
            const goingDown = y > lastY + 2; // small threshold
            const goingUp = y < lastY - 2;
            lastY = y;

            // Mobile sheet stays put while open; never auto-hide under the drawer.
            const isMobile = (() => {
                try {
                    return window.matchMedia && window.matchMedia('(max-width: 860px)').matches;
                } catch { return false; }
            })();
            if (isMobile && (glassNav.classList.contains('open') || glassNav.classList.contains('is-closing'))) {
                lastY = y;
                return;
            }

            // Only control visibility when reveal overlay is released.
            // Mobile mirrors desktop: visible on open, then same hide/show after release.
            const overlayReleased = document.querySelector('.text-reveal-container')?.classList.contains('released');
            if (overlayReleased) {
                if (goingDown) {
                    if (window.setNavbarAccessibility) {
                        window.setNavbarAccessibility(glassNav, true);
                    } else {
                        glassNav.classList.add('visible');
                    }
                } else if (goingUp) {
                    if (window.setNavbarAccessibility) {
                        window.setNavbarAccessibility(glassNav, false);
                    } else {
                        glassNav.classList.remove('visible');
                    }
                }
            }
        };

        const setActiveLink = () => {
            // Only when overlay released
            const overlayReleased = document.querySelector('.text-reveal-container')?.classList.contains('released');
            if (!overlayReleased) return;
            const y = window.scrollY + 80; // offset for fixed nav height
            let active = null;
            for (const sec of sections) {
                const rect = sec.getBoundingClientRect();
                const top = rect.top + window.scrollY;
                if (y >= top) active = sec;
            }
            navLinks.forEach(a => a.classList.toggle('active', active && a.getAttribute('href') === '#' + active.id));
        };

        // Single scroll event listener for both handlers
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    onScroll();
                    setActiveLink();
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });

        // Anchor click behavior: wait for overlay release, then smooth scroll
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const targetId = link.getAttribute('href').slice(1);
                const target = document.getElementById(targetId);
                if (!target) return;
                const overlay = document.querySelector('.text-reveal-container');
                const released = overlay?.classList.contains('released');
                // If no overlay exists, scroll immediately
                if (!overlay) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    return;
                }
                if (!released) {
                    e.preventDefault();
                    const comp = window.scrollRevealComponent;
                    if (comp && typeof comp.releaseToTarget === 'function') {
                        comp.releaseToTarget(target);
                    } else {
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                } else {
                    // Overlay already released
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }
});

// Handle page visibility changes
// Keep minimal visibility handlers if needed later
