
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
        this.bottomHint = null;
        this.stepper = null;
        this.stepperDots = [];
        this.stepperLeftFill = null;
        this.stepperRightFill = null;

        // Configuration
        this.currentIndex = 0;
        this.scrollThreshold = 30; // Increased minimum scroll distance to trigger step
        this.lastScrollY = window.scrollY;
        this.scrollCooldown = false;
        this.isMobile = window.innerWidth <= 768;
        // Strict cooldowns for ultra-precise one-step-at-a-time control
        this.cooldownDuration = this.isMobile ? 400 : 500;

        // Ultra-strict scroll control
        this.isProcessingScroll = false;
        this.lastStepTime = 0;
        this.minStepInterval = this.isMobile ? 350 : 450; // Longer intervals for stricter stepping
        this.scrollEventLocked = false;
        this.debounceTimer = null;
        this.accumulatedScroll = 0;
        this.scrollResetTimer = null;
        this.releaseArmed = false; // require one more scroll on last item to release
        this.hasReleased = false; // avoid re-engaging overlay after release

        this.init();
    }

    init() {
        if (!this.container || !this.listElement || !this.items.length) {
            return;
        }

        this.setupEventListeners();
        this.setupIntersectionObserver();
        this.initializeItems();
        this.createStepper();

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
                        // Re-engage overlay when hero comes back into view, even after release
                        // Seamless re-engagement: add a subtle fade/slide-in before locking
                        const wasReleased = this.container.classList.contains('released');
                        this.container.classList.remove('released');
                        this.container.classList.remove('liquid-exit');
                        this.container.classList.add('reengaging');
                        this.container.classList.add('liquid-enter');
                        this.container.style.display = '';
                        if (this.stepper) {
                            this.stepper.style.display = '';
                        }
                        // We are re-engaging; allow stepper to handle input again
                        this.hasReleased = false;
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
                        this.updateStepper();
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

        // Disable window scroll listener to ensure stepper-only control
        // Scrolling steps are handled via wheel/touch/keyboard on the overlay

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

    createStepper() {
        if (!this.container || !this.items?.length) return;

        // Avoid duplicate
        if (this.stepper && this.stepper.isConnected) return;

        const stepper = document.createElement('div');
        stepper.className = 'reveal-stepper';
        stepper.setAttribute('role', 'group');
        stepper.setAttribute('aria-label', 'Reveal navigation');

        // Dots in center (only element needed)
        const dotsWrap = document.createElement('div');
        dotsWrap.className = 'stepper-dots';
        this.stepperDots = [];
        this.items.forEach((_, i) => {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'stepper-dot';
            dot.setAttribute('aria-label', `Go to step ${i + 1}`);
            dot.addEventListener('click', () => {
                this.goToSection(i);
                this.updateStepper();
            });
            this.stepperDots.push(dot);
            dotsWrap.appendChild(dot);
        });

        // Assemble: only dots (gradient bars are CSS pseudo-elements)
        stepper.appendChild(dotsWrap);

        this.container.appendChild(stepper);
        this.stepper = stepper;
        this.updateStepper();
    }

    updateStepper() {
        if (!this.stepper) return;

        // Update dots
        this.stepperDots.forEach((dot, i) => {
            dot.classList.toggle('active', i === this.currentIndex);
            dot.setAttribute('aria-current', i === this.currentIndex ? 'step' : 'false');
        });

        // Calculate progress (starts at 100% and depletes as we scroll down)
        const total = Math.max(this.items.length - 1, 1);
        const progressRatio = Math.min(Math.max(this.currentIndex / total, 0), 1);
        const remainingProgress = 1 - progressRatio; // Invert: start at 100%, go to 0%

        // Update animated gradient bars with progress classes
        // Remove all progress classes first
        this.stepper.classList.remove('progress-0', 'progress-20', 'progress-40',
            'progress-60', 'progress-80', 'progress-100');

        // Add appropriate progress class based on remaining progress
        const progressPercent = Math.round(remainingProgress * 100);
        let progressClass = 'progress-0';

        if (progressPercent >= 95) {
            progressClass = 'progress-100';
        } else if (progressPercent >= 75) {
            progressClass = 'progress-80';
        } else if (progressPercent >= 55) {
            progressClass = 'progress-60';
        } else if (progressPercent >= 35) {
            progressClass = 'progress-40';
        } else if (progressPercent >= 15) {
            progressClass = 'progress-20';
        }

        this.stepper.classList.add(progressClass);
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

            // Ultra-strict single swipe trigger with higher threshold
            if (Math.abs(deltaY) > 60 && deltaX < 80) {
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

        // Window scroll is ignored in strict stepper mode
        return;

        this.lastScrollY = currentScrollY;
    }

    executeStep(direction) {
        // Triple-lock all scroll processing immediately for ultra-strict control
        this.isProcessingScroll = true;
        this.scrollEventLocked = true;
        this.scrollCooldown = true;
        this.lastStepTime = Date.now();

        // Execute only ONE step regardless of scroll intensity
        if (direction > 0 && this.currentIndex < this.items.length - 1) {
            // Scrolling down - reveal ONLY next item
            this.stepDown();
        } else if (direction < 0 && this.currentIndex > 0) {
            // Scrolling up - go ONLY to previous item
            this.stepUp();
        }

        // Extended cooldown to ensure absolutely no multiple steps
        const extendedCooldown = this.cooldownDuration * 1.2;

        // Reset all locks after extended cooldown
        setTimeout(() => {
            this.isProcessingScroll = false;
            this.scrollEventLocked = false;
            this.scrollCooldown = false;
        }, extendedCooldown);
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

        // Require a more significant scroll delta to trigger step (stricter control)
        const minScrollDelta = this.isMobile ? 25 : 35;
        if (Math.abs(e.deltaY) < minScrollDelta) {
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
            this.updateStepper();
        }
    }

    stepDown() {
        if (this.currentIndex < this.items.length - 1) {
            // Ultra-strict single-step: hide current item and show ONLY the next one
            this.hideItem(this.items[this.currentIndex]);
            this.currentIndex++;
            this.revealItem(this.items[this.currentIndex]);
            this.updateStepper();
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

                // Release native scroll with fluid fade of overlay (stay fixed during fade)
                this.unlockBodyScroll();
                this.container.classList.add('releasing');
                // After fade finishes, fully remove overlay from flow and enable scroll snap
                setTimeout(() => {
                    this.container.classList.remove('releasing');
                    this.container.classList.add('released');
                    this.container.style.display = 'none';
                    // Enable scroll snap for strict one-step-at-a-time scrolling
                    this.enableScrollSnap();
                }, 420);
                this.hasReleased = true;
                if (this.bottomHint) this.bottomHint.classList.add('hidden');
                if (this.stepper) this.stepper.style.display = 'none';
            } catch (err) {
                this.unlockBodyScroll();
                this.container.classList.add('released');
                this.container.style.display = 'none';
                this.hasReleased = true;
                if (this.bottomHint) this.bottomHint.classList.add('hidden');
                if (this.stepper) this.stepper.style.display = 'none';
                // Enable scroll snap even on error
                this.enableScrollSnap();
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
        this.updateStepper();
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
        if (this._scrollLocked) return;
        this._scrollLocked = true;
        this._scrollYBeforeLock = window.scrollY || 0;
        document.body.classList.add('lock-scroll');
        // iOS-friendly scroll lock
        document.body.style.position = 'fixed';
        document.body.style.top = `-${this._scrollYBeforeLock}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
        document.body.style.overflow = 'hidden';
        document.documentElement.style.scrollBehavior = 'auto';
    }

    unlockBodyScroll() {
        if (!this._scrollLocked) return;
        this._scrollLocked = false;
        document.body.classList.remove('lock-scroll');
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        // Restore scroll to previous position to avoid jump
        window.scrollTo(0, this._scrollYBeforeLock || 0);
        document.documentElement.style.scrollBehavior = '';
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

    // Enable scroll snap for strict step-by-step scrolling after overlay release
    enableScrollSnap() {
        document.body.classList.add('scroll-snap-enabled');

        // Add scroll-snap-section class to main content sections
        const sections = ['#about', '#projects', '#contact'];
        sections.forEach(selector => {
            const section = document.querySelector(selector);
            if (section) {
                section.classList.add('scroll-snap-section');
            }
        });

        // Also add to hero if it exists
        const hero = document.querySelector('.hero');
        if (hero) {
            hero.classList.add('scroll-snap-section');
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
