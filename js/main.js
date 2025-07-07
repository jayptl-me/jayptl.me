// Initialize theme as early as possible to prevent flash
(function() {
    const userPreference = localStorage.getItem('theme-preference');
    const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    
    // Apply theme immediately to prevent flash
    if (userPreference === 'light' || userPreference === 'dark') {
        document.documentElement.setAttribute('data-theme', userPreference);
    } else {
        // Use system preference or remove attribute for CSS to handle
        document.documentElement.removeAttribute('data-theme');
    }
    
    // Set color-scheme for optimal browser UI
    document.documentElement.style.colorScheme = 'light dark';
})();

// Theme Detection Utilities
const ThemeUtils = {
    getCurrentTheme() {
        return window.themeManager ? window.themeManager.getCurrentTheme() : 
               (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    },
    
    getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    },
    
    onThemeChange(callback) {
        document.addEventListener('themechange', callback);
    },
    
    offThemeChange(callback) {
        document.removeEventListener('themechange', callback);
    }
};

// Make utilities globally available
window.ThemeUtils = ThemeUtils;

// Enhanced Theme Management with Device Detection
class ThemeManager {
    constructor() {
        this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        this.currentTheme = null;
        this.userPreference = localStorage.getItem('theme-preference');
        
        this.initTheme();
        this.watchSystemTheme();
        this.applyColorScheme();
    }

    initTheme() {
        // Priority: 1. User preference, 2. System preference, 3. Light (default)
        if (this.userPreference && ['light', 'dark', 'auto'].includes(this.userPreference)) {
            if (this.userPreference === 'auto') {
                this.setAutoTheme();
            } else {
                this.applyTheme(this.userPreference);
            }
        } else {
            // Default to auto theme (follow system preference)
            this.setAutoTheme();
        }
    }

    setAutoTheme() {
        // Remove data-theme attribute to let CSS media queries handle it
        document.documentElement.removeAttribute('data-theme');
        this.currentTheme = this.mediaQuery.matches ? 'dark' : 'light';
        
        // Update meta theme-color for mobile browsers
        this.updateMetaThemeColor();
        
        // Dispatch theme change event
        this.dispatchThemeChange();
    }

    applyTheme(theme) {
        if (!['light', 'dark'].includes(theme)) return;
        
        document.documentElement.setAttribute('data-theme', theme);
        this.currentTheme = theme;
        
        // Update meta theme-color for mobile browsers
        this.updateMetaThemeColor();
        
        // Dispatch theme change event
        this.dispatchThemeChange();
    }

    updateMetaThemeColor() {
        // Update theme-color meta tag for mobile browsers
        const themeColorMeta = document.querySelector('meta[name="theme-color"]') || 
                              document.createElement('meta');
        
        if (!themeColorMeta.parentNode) {
            themeColorMeta.setAttribute('name', 'theme-color');
            document.head.appendChild(themeColorMeta);
        }
        
        // Get the current theme background color
        const bgColor = this.currentTheme === 'dark' ? '#000000' : '#ffffff';
        themeColorMeta.setAttribute('content', bgColor);
    }

    applyColorScheme() {
        // Set color-scheme property for optimal browser UI
        document.documentElement.style.colorScheme = this.currentTheme || 'light dark';
    }

    watchSystemTheme() {
        this.mediaQuery.addEventListener('change', (e) => {
            // Only update if using auto theme (no data-theme attribute)
            if (!document.documentElement.hasAttribute('data-theme')) {
                this.currentTheme = e.matches ? 'dark' : 'light';
                this.updateMetaThemeColor();
                this.dispatchThemeChange();
            }
        });
    }

    dispatchThemeChange() {
        // Dispatch custom event for other components to listen to
        const event = new CustomEvent('themechange', {
            detail: { theme: this.currentTheme }
        });
        document.dispatchEvent(event);
    }

    // Public methods for theme control
    setTheme(theme) {
        if (theme === 'auto') {
            localStorage.setItem('theme-preference', 'auto');
            this.userPreference = 'auto';
            this.setAutoTheme();
        } else if (['light', 'dark'].includes(theme)) {
            localStorage.setItem('theme-preference', theme);
            this.userPreference = theme;
            this.applyTheme(theme);
        }
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    getCurrentTheme() {
        return this.currentTheme;
    }

    getSystemTheme() {
        return this.mediaQuery.matches ? 'dark' : 'light';
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
        AnalyticsHelper.trackFormSubmission('contact_form');

        // Show success message (you can replace this with actual form submission logic)
        this.showNotification('Message sent successfully! I\'ll get back to you soon.', 'success');
        this.contactForm.reset();
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '1rem 1.5rem',
            borderRadius: '8px',
            color: 'white',
            backgroundColor: type === 'success' ? '#26A69A' : '#333',
            zIndex: '10000',
            transform: 'translateX(400px)',
            transition: 'transform 0.3s ease'
        });

        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Hide notification after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// Analytics Helper Functions
class AnalyticsHelper {
    static trackEvent(eventName, parameters = {}) {
        if (window.consentManager && window.consentManager.consentGiven) {
            window.consentManager.trackEvent(eventName, parameters);
        }
    }
    
    static trackPageView(title = document.title, location = window.location.href) {
        if (window.consentManager && window.consentManager.consentGiven) {
            window.consentManager.trackPageView(title, location);
        }
    }
    
    static trackFormSubmission(formName) {
        this.trackEvent('form_submit', {
            event_category: 'engagement',
            event_label: formName
        });
    }
    
    static trackButtonClick(buttonName) {
        this.trackEvent('button_click', {
            event_category: 'engagement',
            event_label: buttonName
        });
    }
    
    static trackScrollDepth(percentage) {
        this.trackEvent('scroll_depth', {
            event_category: 'engagement',
            value: percentage
        });
    }
}

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

// Particle Effect (Optional Enhancement)
class ParticleEffect {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.init();
    }

    init() {
        // Create canvas for particles
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '-1';
        this.canvas.style.opacity = '0.1';
        
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        
        this.resize();
        this.createParticles();
        this.animate();
        
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createParticles() {
        const particleCount = Math.floor(window.innerWidth / 20);
        
        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                radius: Math.random() * 2 + 1
            });
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            // Wrap around edges
            if (particle.x < 0) particle.x = this.canvas.width;
            if (particle.x > this.canvas.width) particle.x = 0;
            if (particle.y < 0) particle.y = this.canvas.height;
            if (particle.y > this.canvas.height) particle.y = 0;
            
            // Draw particle
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = getComputedStyle(document.documentElement)
                .getPropertyValue('--current-primary');
            this.ctx.fill();
        });
        
        requestAnimationFrame(() => this.animate());
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize all managers
    window.themeManager = new ThemeManager();
    new NavigationManager();
    new AnimationManager();
    new FormManager();
    
    // Initialize scroll indicator
    if (typeof ScrollIndicator !== 'undefined') {
        new ScrollIndicator();
    }
    
    // Initialize consent manager (already auto-initialized in consent-manager.js)
    // Access via window.consentManager if needed
    
    // Optional: Initialize particle effect (uncomment if you want particles)
    // new ParticleEffect();
    
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

// Performance optimization: Lazy load images when they come into view
const lazyLoadImages = () => {
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
};

// Initialize lazy loading
lazyLoadImages();
