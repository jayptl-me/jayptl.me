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
        // Save preference to a cookie for 1 year
        document.cookie = `preferred-theme=${theme};path=/;max-age=31536000;SameSite=Lax`;
    }

    getThemePreference() {
        const cookies = document.cookie.split('; ');
        const themeCookie = cookies.find(row => row.startsWith('preferred-theme='));
        if (themeCookie) {
            const theme = themeCookie.split('=')[1];
            return theme;
        }
        return null;
    }

    getCurrentTheme() {
        return document.documentElement.getAttribute('data-theme') || (this.mediaQuery.matches ? 'dark' : 'light');
    }
}

// Navigation Management - REMOVED (no navigation in current HTML)

// Animation Manager - SIMPLIFIED (removed unused animations)
class AnimationManager {
    constructor() {
        this.initScrollAnimations();
    }

    initScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);

        // Add animation classes to elements that actually exist
        const animatedElements = document.querySelectorAll('.text-reveal-item');
        animatedElements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = 'all 0.6s ease';
            observer.observe(el);
        });
    }
}

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
        return function() {
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
    // Initialize only what's actually used
    new AnimationManager();
    // PerformanceManager is now handled in js/performance.js
    
    // Initialize scroll indicator
    if (typeof ScrollIndicator !== 'undefined') {
        new ScrollIndicator();
    }
    
    // Add loading animation
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.5s ease';
        document.body.style.opacity = '1';
    }, 100);
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Pause animations when tab is not visible
        document.body.style.animationPlayState = 'paused';
    } else {
        // Resume animations when tab becomes visible
        document.body.style.animationPlayState = 'running';
    }
});
