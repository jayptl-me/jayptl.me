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
        this.applyTheme(initialTheme);

        this.mediaQuery.addEventListener('change', e => {
            if (!this.userPreference) {
                this.applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.colorScheme = theme;

        // Dispatch a custom event to notify other components of the theme change
        window.dispatchEvent(new CustomEvent('themechange', {
            detail: { theme }
        }));
    }

    toggleTheme() {
        const currentTheme = this.getCurrentTheme();
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        this.setThemePreference(newTheme);
        this.applyTheme(newTheme);

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

// Particle Effect class is now in js/components/particle-effect.js

// Initialize enhanced theme manager and make it globally available
window.themeManager = new ThemeManager();

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize scroll indicator (components handles auto-init; this is a safety check)
    if (typeof ScrollIndicator !== 'undefined') {
        if (!window.scrollIndicator) window.scrollIndicator = new ScrollIndicator();
    }

    // Hide/Show glass navbar based on scroll direction after reveal is released
    const glassNav = document.getElementById('glassNav');
    if (glassNav) {
        let lastY = window.scrollY;
        let ticking = false;

        const onScroll = () => {
            const y = window.scrollY;
            const goingDown = y > lastY + 2; // small threshold
            const goingUp = y < lastY - 2;
            lastY = y;

            // Only control visibility when reveal overlay is released
            const overlayReleased = document.querySelector('.text-reveal-container')?.classList.contains('released');
            if (!overlayReleased) return;

            if (goingDown) {
                glassNav.classList.add('visible');
            } else if (goingUp) {
                glassNav.classList.remove('visible');
            }
        };

        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    onScroll();
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });

        // Enhance nav link UX: active state and smooth anchor scrolling when overlay is released
        const navLinks = Array.from(glassNav.querySelectorAll('.nav-link[href^="#"]'));
        const sections = navLinks
            .map(a => document.querySelector(a.getAttribute('href')))
            .filter(Boolean);

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

        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
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
                if (!released) {
                    // If overlay still active, release it first by jumping to final step and performing one stepDown
                    e.preventDefault();
                    try {
                        const comp = window.scrollRevealComponent;
                        if (comp) {
                            // Jump to last item and release
                            comp.goToSection(comp.items.length - 1);
                            comp.stepDown();
                        }
                    } catch { }
                    // Delay smooth scroll slightly to allow release animation
                    setTimeout(() => {
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 350);
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
