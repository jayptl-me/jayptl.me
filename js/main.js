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

            // Dispatch custom event for theme change
            const event = new CustomEvent('themechange', {
                detail: { theme: theme }
            });
            document.dispatchEvent(event);
        }
    }

    watchSystemTheme() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
            // Only update if theme is set to auto
            if (this.currentTheme === 'auto') {
                // Dispatch theme change event even for auto mode
                const event = new CustomEvent('themechange', {
                    detail: { theme: 'auto', systemTheme: e.matches ? 'dark' : 'light' }
                });
                document.dispatchEvent(event);
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

// Analytics utility functions
const Analytics = {
    trackEvent(eventName, parameters = {}) {
        if (window.consentManager?.canUseAnalytics()) {
            window.consentManager.trackEvent(eventName, parameters);
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

// Initialize theme manager immediately and make it globally available
window.themeManager = new ThemeManager();

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize all other managers
    new NavigationManager();
    new AnimationManager();
    new FormManager();
    
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
