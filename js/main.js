// Theme Management
class ThemeManager {
    constructor() {
        this.themeKey = 'preferred-theme';
        
        // Check if there's an explicit data-theme on HTML, respect that first
        const htmlTheme = document.documentElement.getAttribute('data-theme');
        
        // Otherwise use stored theme or default to 'light'
        this.currentTheme = htmlTheme || this.getStoredTheme() || 'light';
        
        // Ensure HTML has the correct data-theme attribute
        if (this.currentTheme !== 'auto' && document.documentElement.getAttribute('data-theme') !== this.currentTheme) {
            document.documentElement.setAttribute('data-theme', this.currentTheme);
        }
        
        this.initTheme();
        this.watchSystemTheme();
    }

    getStoredTheme() {
        try {
            return localStorage.getItem(this.themeKey);
        } catch (e) {
            return null;
        }
    }

    setStoredTheme(theme) {
        try {
            localStorage.setItem(this.themeKey, theme);
        } catch (e) {
            console.warn('Could not save theme preference');
        }
    }

    getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    getCurrentTheme() {
        return this.currentTheme;
    }

    initTheme() {
        this.setTheme(this.currentTheme);
    }

    createThemeEvent(theme) {
        // For auto theme, include the actual system theme in the event detail
        const detail = theme === 'auto' 
            ? { theme: 'auto', systemTheme: this.getSystemTheme() } 
            : { theme: theme };
            
        return new CustomEvent('themechange', { detail });
    }

    setTheme(theme) {
        if (['light', 'dark', 'auto'].includes(theme)) {
            this.currentTheme = theme;
            
            if (theme === 'auto') {
                // For auto, let CSS @media (prefers-color-scheme) handle it
                document.documentElement.removeAttribute('data-theme');
                this.setStoredTheme('auto');
            } else {
                // For manual theme selection, set data-theme attribute
                document.documentElement.setAttribute('data-theme', theme);
                this.setStoredTheme(theme);
            }

            // Add body classes for theme
            document.body.classList.remove('theme-light', 'theme-dark', 'theme-auto');
            document.body.classList.add(`theme-${theme}`);

            // Dispatch custom event for theme change using the helper method
            document.dispatchEvent(this.createThemeEvent(theme));
        }
    }

    watchSystemTheme() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
            // Only update if theme is set to auto
            if (this.currentTheme === 'auto') {
                // Dispatch theme change event using the helper method
                document.dispatchEvent(this.createThemeEvent('auto'));
            }
        });
    }

    toggleTheme() {
        // Cycle through: light -> dark -> auto -> light...
        let nextTheme;
        if (this.currentTheme === 'light') {
            nextTheme = 'dark';
        } else if (this.currentTheme === 'dark') {
            nextTheme = 'auto';
        } else {
            nextTheme = 'light';
        }
        
        this.setTheme(nextTheme);
    }
}

// Navigation Management
class NavigationManager {
    constructor() {
        this.hamburger = document.querySelector('.hamburger');
        this.navMenu = document.querySelector('.nav__menu');
        this.navLinks = document.querySelectorAll('.nav__link');
        this.navbar = document.querySelector('.nav');
        
        this.initNavigation();
        this.initSmoothScrolling();
        this.initScrollEffects();
    }

    initNavigation() {
        if (this.hamburger && this.navMenu) {
            this.hamburger.addEventListener('click', () => {
                this.hamburger.classList.toggle('hamburger--active');
                this.navMenu.classList.toggle('nav__menu--active');
            });

            // Close mobile menu when clicking on a link
            this.navLinks.forEach(link => {
                link.addEventListener('click', () => {
                    this.hamburger.classList.remove('hamburger--active');
                    this.navMenu.classList.remove('nav__menu--active');
                });
            });
        }
    }

    initSmoothScrolling() {
        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href');
                const targetSection = document.querySelector(targetId);
                
                if (targetSection) {
                    const offsetTop = targetSection.offsetTop - 70; // Account for fixed navbar
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    initScrollEffects() {
        if (this.navbar) {
            window.addEventListener('scroll', () => {
                if (window.scrollY > 100) {
                    this.navbar.classList.add('nav--scrolled');
                } else {
                    this.navbar.classList.remove('nav--scrolled');
                }
            });
        }
    }
}

// Animation Manager
class AnimationManager {
    constructor() {
        this.initScrollAnimations();
        this.initTypingEffect();
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

        // Add animation classes to elements
        const animatedElements = document.querySelectorAll('.project-card, .about-content, .contact-content');
        animatedElements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = 'all 0.6s ease';
            observer.observe(el);
        });
    }

    initTypingEffect() {
        const heroSubtitle = document.querySelector('.hero-subtitle');
        if (heroSubtitle) {
            const text = heroSubtitle.textContent;
            heroSubtitle.textContent = '';
            
            let i = 0;
            const typeWriter = () => {
                if (i < text.length) {
                    heroSubtitle.textContent += text.charAt(i);
                    i++;
                    setTimeout(typeWriter, 50);
                }
            };
            
            // Start typing effect after a small delay
            setTimeout(typeWriter, 1000);
        }
    }
}

// Form Management
class FormManager {
    constructor() {
        this.contactForm = document.querySelector('.contact-form');
        this.initContactForm();
    }

    initContactForm() {
        if (this.contactForm) {
            this.contactForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmission();
            });
        }
    }

    handleFormSubmission() {
        const formData = new FormData(this.contactForm);
        const data = {
            name: formData.get('name'),
            email: formData.get('email'),
            message: formData.get('message')
        };

        // Track form submission analytics
        this.trackFormSubmission('contact_form');

        // Show success message (you can replace this with actual form submission logic)
        this.showNotification('Message sent successfully! I\'ll get back to you soon.', 'success');
        this.contactForm.reset();
    }

    trackFormSubmission(formName) {
        Analytics.trackEvent('form_submit', {
            event_category: 'engagement',
            event_label: formName
        });
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification--${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);

        // Show notification (allow a moment for the DOM to update)
        setTimeout(() => {
            notification.classList.add('notification--visible');
        }, 10);

        // Hide notification after 3 seconds
        setTimeout(() => {
            notification.classList.remove('notification--visible');
            
            // Remove from DOM after animation completes
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// Analytics utility functions
const Analytics = {
    trackEvent(eventName, parameters = {}) {
        if (window.consentManager?.canUseAnalytics()) {
            window.consentManagerManager.trackEvent(eventName, parameters);
        }
    },
    
    trackPageView(title = document.title, location = window.location.href) {
        if (window.consentManager?.canUseAnalytics()) {
            window.consentManager.trackPageView(title, location);
        }
    },
    
    trackButtonClick(buttonName) {
        this.trackEvent('button_click', {
            event_category: 'engagement',
            event_label: buttonName
        });
    },
    
    trackScrollDepth(percentage) {
        this.trackEvent('scroll_depth', {
            event_category: 'engagement',
            value: percentage
        });
    }
};

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

// Initialize theme manager immediately and make it globally available
window.themeManager = new ThemeManager();

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize all managers
    new NavigationManager();
    new AnimationManager();
    new FormManager();
    // PerformanceManager is now handled in js/performance.js
    
    // Initialize scroll indicator
    if (typeof ScrollIndicator !== 'undefined') {
        new ScrollIndicator();
    }
    
    // Initialize theme toggle if exists
    if (typeof ThemeToggle !== 'undefined' && document.querySelector('.theme-toggle')) {
        new ThemeToggle();
    }
    
    // ConsentManager auto-initializes in consent-manager.js
    
    // Optional: Initialize particle effect (uncomment if you want particles)
    // if (typeof ParticleEffect !== 'undefined') {
    //     new ParticleEffect();
    // }
    
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

// Performance Optimization Manager
class PerformanceManager {
    constructor() {
        this.initLazyLoading();
    }

    initLazyLoading() {
        const images = document.querySelectorAll('img[data-src]');
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            });
        });

        images.forEach(img => imageObserver.observe(img));
    }
}
