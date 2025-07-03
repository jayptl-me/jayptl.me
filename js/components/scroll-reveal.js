/**
 * Ultra-Strict Scroll-to-Reveal Text Component
 * Handles scroll-based text revelation with absolute single-step control
 * 
 * @file components/scroll-reveal.js
 * @author Jay Patel
 */

class ScrollRevealComponent {
    constructor() {
        this.container = document.querySelector('.text-reveal-container');
        this.listElement = document.querySelector('.text-reveal-list');
        this.items = document.querySelectorAll('.text-reveal-item');
        
        // Configuration
        this.currentIndex = 0;
        this.scrollThreshold = 15; // Minimum scroll distance to trigger step
        this.lastScrollY = window.scrollY;
        this.scrollCooldown = false;
        this.cooldownDuration = 1200; // 1.2 second cooldown - ultra strict
        this.isMobile = window.innerWidth <= 768;
        
        // Ultra-strict scroll control
        this.isProcessingScroll = false;
        this.lastStepTime = 0;
        this.minStepInterval = 1200; // Minimum 1.2 seconds between steps
        this.scrollEventLocked = false;
        this.debounceTimer = null;
        this.accumulatedScroll = 0;
        this.scrollResetTimer = null;
        
        this.init();
    }
    
    init() {
        if (!this.container || !this.listElement || !this.items.length) {
            console.warn('Scroll reveal elements not found');
            return;
        }
        
        this.setupEventListeners();
        this.setupIntersectionObserver();
        this.initializeItems();
        
        console.log('ScrollRevealComponent initialized with ultra-strict controls');
    }
    
    initializeItems() {
        console.log('Initializing items, found:', this.items.length);
        
        // Hide all items initially except the first one
        this.items.forEach((item, index) => {
            item.classList.remove('revealed', 'active');
            item.style.opacity = '0';
            item.style.pointerEvents = 'none';
            item.style.transform = 'translate(-50%, -50%)';
            
            if (index === 0) {
                // Show only the first item
                setTimeout(() => {
                    this.revealItem(item);
                }, 100);
            }
        });
    }
    
    setupEventListeners() {
        // Ultra-strict scroll event with heavy debouncing
        let scrollLocked = false;
        const handleScroll = () => {
            if (scrollLocked) return;
            
            scrollLocked = true;
            
            // Clear any existing debounce timer
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }
            
            // Debounce scroll events to prevent rapid firing
            this.debounceTimer = setTimeout(() => {
                this.handleScroll();
                scrollLocked = false;
            }, 100); // 100ms debounce
        };
        
        window.addEventListener('scroll', handleScroll, { passive: true });
        
        // Keyboard navigation
        document.addEventListener('keydown', this.handleKeyboard.bind(this));
        
        // Touch events for mobile
        if (this.isMobile) {
            this.setupTouchEvents();
        }
        
        // Wheel event for stepper scrolling - very strict
        this.container.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        
        // Responsive resize handler
        window.addEventListener('resize', this.handleResize.bind(this));
    }
    
    setupTouchEvents() {
        let startY = 0;
        let startX = 0;
        
        this.container.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            startX = e.touches[0].clientX;
        }, { passive: true });
        
        this.container.addEventListener('touchend', (e) => {
            if (!this.container.classList.contains('in-view') || 
                this.scrollCooldown || 
                this.isProcessingScroll ||
                this.scrollEventLocked) return;
            
            const endY = e.changedTouches[0].clientY;
            const endX = e.changedTouches[0].clientX;
            const deltaY = startY - endY;
            const deltaX = Math.abs(startX - endX);
            
            // Check minimum time interval
            const now = Date.now();
            if (now - this.lastStepTime < this.minStepInterval) {
                return;
            }
            
            // Ultra-strict single swipe trigger
            if (Math.abs(deltaY) > 40 && deltaX < 100) {
                this.executeStep(deltaY > 0 ? 1 : -1);
            }
        }, { passive: true });
    }
    
    handleResize() {
        this.isMobile = window.innerWidth <= 768;
    }
    
    setupIntersectionObserver() {
        const options = {
            root: null,
            rootMargin: this.isMobile ? '-5% 0px -5% 0px' : '-10% 0px -10% 0px',
            threshold: [0.1, 0.3, 0.5, 0.7, 0.9]
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.container.classList.add('in-view');
                } else {
                    this.container.classList.remove('in-view');
                }
            });
        }, options);
        
        observer.observe(this.container);
    }
    
    handleScroll() {
        // Ultra-strict guards to prevent multiple steps
        if (!this.container.classList.contains('in-view') || 
            this.scrollCooldown || 
            this.isProcessingScroll ||
            this.scrollEventLocked) {
            return;
        }
        
        // Check minimum time interval between steps
        const now = Date.now();
        if (now - this.lastStepTime < this.minStepInterval) {
            return;
        }
        
        const currentScrollY = window.scrollY;
        const scrollDelta = currentScrollY - this.lastScrollY;
        
        // Accumulate scroll to prevent tiny movements from triggering steps
        this.accumulatedScroll += scrollDelta;
        
        // Reset accumulated scroll after no scrolling for a while
        if (this.scrollResetTimer) {
            clearTimeout(this.scrollResetTimer);
        }
        this.scrollResetTimer = setTimeout(() => {
            this.accumulatedScroll = 0;
        }, 200);
        
        // Only trigger on significant accumulated scroll movement
        if (Math.abs(this.accumulatedScroll) > this.scrollThreshold) {
            const direction = this.accumulatedScroll > 0 ? 1 : -1;
            this.executeStep(direction);
            this.accumulatedScroll = 0; // Reset after step
        }
        
        this.lastScrollY = currentScrollY;
    }
    
    executeStep(direction) {
        // Lock all scroll processing immediately
        this.isProcessingScroll = true;
        this.scrollEventLocked = true;
        this.lastStepTime = Date.now();
        
        // Execute only ONE step regardless of scroll intensity
        if (direction > 0 && this.currentIndex < this.items.length - 1) {
            // Scrolling down - reveal ONLY next item
            this.stepDown();
        } else if (direction < 0 && this.currentIndex > 0) {
            // Scrolling up - go ONLY to previous item
            this.stepUp();
        }
        
        // Immediate and extended cooldown to prevent multiple steps
        this.activateCooldown();
        
        // Reset all locks after extended cooldown
        setTimeout(() => {
            this.isProcessingScroll = false;
            this.scrollEventLocked = false;
        }, this.cooldownDuration);
    }
    
    activateCooldown() {
        this.scrollCooldown = true;
        setTimeout(() => {
            this.scrollCooldown = false;
        }, this.cooldownDuration);
    }
    
    handleWheel(e) {
        if (!this.container.classList.contains('in-view') || 
            this.scrollCooldown || 
            this.isProcessingScroll ||
            this.scrollEventLocked) return;
        
        // Check minimum time interval
        const now = Date.now();
        if (now - this.lastStepTime < this.minStepInterval) {
            return;
        }
        
        // Prevent default scroll behavior when in stepper mode
        e.preventDefault();
        
        // Determine direction but allow only ONE step per wheel event
        const direction = e.deltaY > 0 ? 1 : -1;
        this.executeStep(direction);
    }
    
    handleKeyboard(e) {
        if (!this.container.classList.contains('in-view') || 
            this.isProcessingScroll ||
            this.scrollEventLocked) return;
        
        // Check minimum time interval
        const now = Date.now();
        if (now - this.lastStepTime < this.minStepInterval) {
            return;
        }
        
        switch(e.key) {
            case 'ArrowUp':
                e.preventDefault();
                if (this.currentIndex > 0) {
                    this.executeStep(-1);
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (this.currentIndex < this.items.length - 1) {
                    this.executeStep(1);
                }
                break;
            case ' ': // Spacebar
                e.preventDefault();
                if (this.currentIndex < this.items.length - 1) {
                    this.executeStep(1);
                }
                break;
        }
    }
    
    stepUp() {
        if (this.currentIndex > 0) {
            // Ultra-strict single-step: hide current item and show ONLY the previous one
            this.hideItem(this.items[this.currentIndex]);
            this.currentIndex--;
            this.revealItem(this.items[this.currentIndex]);
            console.log(`Stepped UP to item ${this.currentIndex}`);
        }
    }
    
    stepDown() {
        if (this.currentIndex < this.items.length - 1) {
            // Ultra-strict single-step: hide current item and show ONLY the next one
            this.hideItem(this.items[this.currentIndex]);
            this.currentIndex++;
            this.revealItem(this.items[this.currentIndex]);
            console.log(`Stepped DOWN to item ${this.currentIndex}`);
        }
    }
    
    goToSection(index) {
        if (index < 0 || index >= this.items.length) return;
        
        // Hide current item
        if (this.currentIndex !== index) {
            this.hideItem(this.items[this.currentIndex]);
        }
        
        this.currentIndex = index;
        // Show target item
        this.revealItem(this.items[index]);
    }
    
    revealItem(item) {
        console.log('Revealing item:', item);
        
        // Hide all other items first
        this.items.forEach(otherItem => {
            if (otherItem !== item) {
                this.hideItem(otherItem);
            }
        });
        
        item.classList.add('revealed', 'active');
        
        // Animate characters with staggered delay - responsive timing
        const chars = item.querySelectorAll('.char');
        const charDelay = this.isMobile ? 30 : 50;
        
        chars.forEach((char, index) => {
            setTimeout(() => {
                char.classList.add('animate-in');
            }, index * charDelay);
        });
        
        // Set initial position and animate in
        item.style.opacity = '0';
        item.style.transform = 'translate(-50%, -50%) translateY(20px)';
        item.style.pointerEvents = 'auto';
        
        requestAnimationFrame(() => {
            const duration = this.isMobile ? '0.4s' : '0.6s';
            item.style.transition = `transform ${duration} ease-out, opacity ${duration} ease-out`;
            item.style.transform = 'translate(-50%, -50%)';
            item.style.opacity = '1';
        });
    }
    
    hideItem(item) {
        if (!item.classList.contains('revealed')) return;
        
        const duration = this.isMobile ? '0.3s' : '0.4s';
        
        item.style.transition = `transform ${duration} ease-in, opacity ${duration} ease-in`;
        item.style.transform = 'translate(-50%, -50%) translateY(-20px)';
        item.style.opacity = '0';
        item.style.pointerEvents = 'none';
        
        setTimeout(() => {
            item.classList.remove('revealed', 'active');
            
            // Reset character animations
            const chars = item.querySelectorAll('.char');
            chars.forEach(char => {
                char.classList.remove('animate-in');
            });
            
            // Reset styles for next reveal
            item.style.transform = 'translate(-50%, -50%)';
            item.style.opacity = '0';
            item.style.transition = '';
        }, this.isMobile ? 300 : 400);
    }
    
    getScrollPercentage() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
        return Math.min((scrollTop / documentHeight) * 100, 100);
    }
    
    // Public methods
    getCurrentSection() {
        return {
            index: this.currentIndex,
            progress: (this.currentIndex / (this.items.length - 1)) * 100
        };
    }
    
    // Cleanup method
    destroy() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        if (this.scrollResetTimer) {
            clearTimeout(this.scrollResetTimer);
        }
        
        console.log('ScrollRevealComponent destroyed');
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.scrollRevealComponent = new ScrollRevealComponent();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScrollRevealComponent;
}
