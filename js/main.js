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

// Auto-scroll from introduction to bento grid
class IntroAutoScroll {
    constructor() {
        this.introSection = document.getElementById('introduction');
        this.bentoSection = document.getElementById('bento-showcase');
        this.autoScrollDelay = 5000; // 5 seconds
        this.hasScrolled = false;
        
        if (this.introSection && this.bentoSection) {
            this.init();
        }
    }

    init() {
        // Check if user is on introduction section
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !this.hasScrolled) {
                        this.startAutoScrollTimer();
                    }
                });
            },
            {
                threshold: 0.5,
            }
        );

        observer.observe(this.introSection);

        // Cancel auto-scroll if user manually scrolls
        let scrollTimeout;
        window.addEventListener('wheel', () => {
            this.hasScrolled = true;
            clearTimeout(this.autoScrollTimer);
        }, { once: true, passive: true });

        window.addEventListener('touchmove', () => {
            this.hasScrolled = true;
            clearTimeout(this.autoScrollTimer);
        }, { once: true, passive: true });
    }

    startAutoScrollTimer() {
        this.autoScrollTimer = setTimeout(() => {
            if (!this.hasScrolled) {
                this.scrollToBento();
            }
        }, this.autoScrollDelay);
    }

    scrollToBento() {
        this.hasScrolled = true;
        const rect = this.bentoGrid.getBoundingClientRect();
        const currentScrollY = window.pageYOffset;
        const targetScrollY = currentScrollY + rect.top - 20;
        window.scrollTo({ top: targetScrollY, behavior: 'auto' });
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize scroll indicator (components handles auto-init; this is a safety check)
    if (typeof ScrollIndicator !== 'undefined') {
        if (!window.scrollIndicator) window.scrollIndicator = new ScrollIndicator();
    }

    // Initialize auto-scroll from introduction to bento grid
    new IntroAutoScroll();

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

            // Only control visibility when reveal overlay is released
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
                    // Wait for overlay release animation to finish before scrolling
                    const scrollHandler = () => {
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    };
                    // Attach both transitionend and animationend for robustness
                    overlay.addEventListener('transitionend', scrollHandler, { once: true });
                    overlay.addEventListener('animationend', scrollHandler, { once: true });
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
