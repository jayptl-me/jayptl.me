
"use strict";

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
        this.bottomHint = document.getElementById('bottomScrollHint');

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
        this.releaseArmed = false; // require one more scroll on last item to release

        this.init();
    }

    init() {
        if (!this.container || !this.listElement || !this.items.length) {
            return;
        }

        this.setupEventListeners();
        this.setupIntersectionObserver();
        this.initializeItems();

        // Lock page scroll until reveal is complete
        this.lockBodyScroll();
        // Ensure overlay is interactive from start
        this.container.classList.add('in-view');
        if (this.bottomHint) this.bottomHint.classList.remove('hidden');

        // Observe when hero section comes back into view to re-enable reveal (no hard reset)
        const hero = document.getElementById('home');
        if (hero) {
            const obs = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Seamless re-engagement: add a subtle fade/slide-in before locking
                        const wasReleased = this.container.classList.contains('released');
                        this.container.classList.remove('released');
                        this.container.classList.remove('liquid-exit');
                        this.container.classList.add('reengaging');
                        this.container.classList.add('liquid-enter');
                        this.container.style.display = '';
                        // allow one frame for CSS to pick up the reengaging state
                        requestAnimationFrame(() => {
                            // keep mask opaque during re-engagement
                            this.container.classList.remove('reveal-hidden');
                            this.lockBodyScroll();
                            // If we are coming back from released state, start at the final item ("Ahhhh, Just Jay!")
                            if (wasReleased && this.items.length) {
                                // Hide everything and reveal only the final item
                                this.items.forEach(it => this.hideItem(it));
                                this.currentIndex = this.items.length - 1;
                                this.revealItem(this.items[this.currentIndex]);
                                // Reset scroll accumulators and add a tiny guard to avoid immediate double-step
                                this.accumulatedScroll = 0;
                                this.lastScrollY = window.scrollY;
                                this.lastStepTime = Date.now();
                                this.isProcessingScroll = false;
                                this.scrollEventLocked = false;
                            }
                            // remove reengaging after transition
                            setTimeout(() => this.container.classList.remove('reengaging'), 300);
                            // clean up liquid-enter after animation completes
                            const onEnterEnd = () => {
                                this.container.classList.remove('liquid-enter');
                                this.container.removeEventListener('animationend', onEnterEnd);
                            };
                            this.container.addEventListener('animationend', onEnterEnd);
                        });
                        // Keep the bottom hint visible even on the last item; release happens on next scroll
                        if (this.bottomHint) this.bottomHint.classList.remove('hidden');
                        this.releaseArmed = false;
                        // Reverse scroll will step back one-by-one from the final item
                    }
                });
            }, { threshold: 0.6 });
            obs.observe(hero);
            this._heroObserver = obs;
        }
    }

    initializeItems() {
        // Hide all items initially except the first one
        this.items.forEach((item, index) => {
            item.classList.remove('revealed', 'active');
            item.style.opacity = '0';
            item.style.pointerEvents = 'none';
            item.style.transform = 'translate(-50%, -50%)';

            if (index === 0) {
                // Animate the "WHO AM I?" text on initial load with a slight delay for better UX
                setTimeout(() => {
                    this.animateInitialLoad(item);
                }, 500); // Delay to allow page to settle
            }
        });
    }

    // New method for initial load animation
    animateInitialLoad(item) {
        item.classList.add('revealed', 'active');

        // Animate characters with staggered delay for initial reveal
        const chars = item.querySelectorAll('.char');
        const charDelay = this.isMobile ? 50 : 80; // Slightly slower for initial impact

        // Start with a more dramatic initial position
        item.style.opacity = '0';
        item.style.transform = 'translate(-50%, -50%) translateY(40px) scale(0.95)';
        item.style.pointerEvents = 'auto';

        // Animate container first
        requestAnimationFrame(() => {
            const duration = this.isMobile ? '0.8s' : '1s'; // Longer duration for initial reveal
            item.style.transition = `transform ${duration} cubic-bezier(0.34, 1.56, 0.64, 1), opacity ${duration} ease-out`;
            item.style.transform = 'translate(-50%, -50%) scale(1)';
            item.style.opacity = '1';
        });

        // Then animate characters with staggered delay and special initial class
        chars.forEach((char, index) => {
            setTimeout(() => {
                char.classList.add('animate-in', 'initial-load');
            }, 300 + (index * charDelay)); // Add 300ms delay after container starts animating
        });
    }

    setupEventListeners() {
        // Ultra-strict scroll event with heavy debouncing
        let scrollLocked = false;
        const handleScroll = () => {
            if (this.container.classList.contains('released')) return;
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
                const direction = deltaY > 0 ? 1 : -1;
                const atLast = this.currentIndex >= this.items.length - 1;
                if (atLast && direction > 0) {
                    // Release on last item swipe down; native scrolling will proceed
                    this.stepDown();
                } else {
                    this.executeStep(direction);
                }
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
        if (this.container.classList.contains('released') ||
            !this.container.classList.contains('in-view') ||
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
        if (this.container.classList.contains('released') ||
            !this.container.classList.contains('in-view') ||
            this.scrollCooldown ||
            this.isProcessingScroll ||
            this.scrollEventLocked) return;

        // Check minimum time interval
        const now = Date.now();
        if (now - this.lastStepTime < this.minStepInterval) {
            return;
        }

        // Determine direction early
        const direction = e.deltaY > 0 ? 1 : -1;
        const atLast = this.currentIndex >= this.items.length - 1;

        // If at last item and scrolling down, release immediately (no second scroll required)
        if (atLast && direction > 0) {
            this.stepDown(); // triggers release
            return; // do not preventDefault; allow native scroll
        }

        // Prevent default scroll behavior when in stepper mode
        e.preventDefault();
        this.executeStep(direction);
    }

    handleKeyboard(e) {
        if (this.container.classList.contains('released') ||
            !this.container.classList.contains('in-view') ||
            this.isProcessingScroll ||
            this.scrollEventLocked) return;

        // Check minimum time interval
        const now = Date.now();
        if (now - this.lastStepTime < this.minStepInterval) {
            return;
        }

        switch (e.key) {
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
                } else {
                    // On last item, release immediately
                    this.stepDown();
                }
                break;
            case ' ': // Spacebar
                e.preventDefault();
                if (this.currentIndex < this.items.length - 1) {
                    this.executeStep(1);
                } else {
                    // On last item, release immediately
                    this.stepDown();
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
        }
    }

    stepDown() {
        if (this.currentIndex < this.items.length - 1) {
            // Ultra-strict single-step: hide current item and show ONLY the next one
            this.hideItem(this.items[this.currentIndex]);
            this.currentIndex++;
            this.revealItem(this.items[this.currentIndex]);
        } else {
            // On last item: fade out the current item, reveal the navbar, and release to native scroll
            try {
                const glassNav = document.getElementById('glassNav');
                if (glassNav) {
                    glassNav.classList.add('visible');
                }

                // Fade the final item out for a smoother transition
                const currentItem = this.items[this.currentIndex];
                if (currentItem) {
                    this.hideItem(currentItem);
                }

                // Release native scroll
                this.unlockBodyScroll();
                this.container.classList.add('released');
                this.container.classList.add('liquid-exit');
                const onAnimEnd = () => {
                    this.container.classList.remove('liquid-exit');
                    this.container.removeEventListener('animationend', onAnimEnd);
                };
                this.container.addEventListener('animationend', onAnimEnd);
                if (this.bottomHint) this.bottomHint.classList.add('hidden');
            } catch (err) {
                this.unlockBodyScroll();
                this.container.classList.add('released');
                if (this.bottomHint) this.bottomHint.classList.add('hidden');
            }
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
            item.style.transition = `transform ${duration} cubic-bezier(0.22, 1, 0.36, 1), opacity ${duration} ease-out`;
            item.style.transform = 'translate(-50%, -50%)';
            item.style.opacity = '1';
        });

        // Toggle bottom hint and lock based on position
        const atLast = this.currentIndex >= this.items.length - 1;
        // Keep the bottom hint visible while overlay is active
        if (this.bottomHint) this.bottomHint.classList.remove('hidden');
        // While showing the last item, keep the overlay fixed and the page locked.
        // Only when the user scrolls down again from the last item (handled in stepDown), release to native scroll.
        this.container.classList.remove('reveal-hidden');
        this.container.classList.remove('released');
        this.container.classList.remove('liquid-exit');
        this.lockBodyScroll();

        // Add a subtle spring bounce when the last item becomes active
        if (atLast) {
            item.classList.add('bounce-in');
        } else {
            item.classList.remove('bounce-in');
            this.releaseArmed = false;
        }
    }

    hideItem(item) {
        if (!item.classList.contains('revealed')) return;

        const duration = this.isMobile ? '0.35s' : '0.5s';

        item.style.transition = `transform ${duration} ease-in, opacity ${duration} ease-in`;
        item.style.transform = 'translate(-50%, -50%) translateY(-20px)';
        item.style.opacity = '0';
        item.style.pointerEvents = 'none';

        setTimeout(() => {
            item.classList.remove('revealed', 'active');
            item.classList.remove('bounce-in');

            // Reset character animations
            const chars = item.querySelectorAll('.char');
            chars.forEach(char => {
                char.classList.remove('animate-in', 'initial-load');
            });

            // Reset styles for next reveal
            item.style.transform = 'translate(-50%, -50%)';
            item.style.opacity = '0';
            item.style.transition = '';
        }, this.isMobile ? 300 : 400);
    }

    // Final message removed

    lockBodyScroll() {
        document.body.classList.add('lock-scroll');
    }

    unlockBodyScroll() {
        document.body.classList.remove('lock-scroll');
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
