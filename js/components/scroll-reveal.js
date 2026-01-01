
"use strict";

/**
 * Ultra-Strict Scroll-to-Reveal Text Component
 * Handles scroll-based text revelation with absolute single-step control
 * 
 * @file components/scroll-reveal.js
 * @author Jay Patel
 */

class ScrollRevealComponent {
    // Configuration constants for better maintainability
    static SCROLL_THRESHOLD_DEFAULT = 20;
    static MOBILE_COOLDOWN_DURATION = 400;
    static DESKTOP_COOLDOWN_DURATION = 500;
    static MOBILE_STEP_INTERVAL = 350;
    static DESKTOP_STEP_INTERVAL = 450;
    static MOBILE_BREAKPOINT = 768;

    constructor() {
        this.container = document.querySelector('.text-reveal-container');
        this.listElement = document.querySelector('.text-reveal-list');
        this.items = document.querySelectorAll('.text-reveal-item');
        this.bottomHint = document.getElementById('bottomScrollHint');
        this.stepper = null;
        this.stepperDots = [];
        this.stepperLeftFill = null;
        this.stepperRightFill = null;

        // Configuration
        this.currentIndex = 0;
        this.scrollThreshold = ScrollRevealComponent.SCROLL_THRESHOLD_DEFAULT; // Decreased minimum scroll distance to trigger step (faster reveal)
        this.lastScrollY = window.scrollY;
        this.scrollCooldown = false;
        this.isMobile = window.innerWidth <= ScrollRevealComponent.MOBILE_BREAKPOINT;
        // Reduced cooldowns for faster stepper response
        this.cooldownDuration = this.isMobile ? ScrollRevealComponent.MOBILE_COOLDOWN_DURATION : ScrollRevealComponent.DESKTOP_COOLDOWN_DURATION;

        // Ultra-strict scroll control
        this.isProcessingScroll = false;
        this.lastStepTime = 0;
        this.minStepInterval = this.isMobile ? ScrollRevealComponent.MOBILE_STEP_INTERVAL : ScrollRevealComponent.DESKTOP_STEP_INTERVAL; // Longer intervals for stricter stepping
        this.scrollEventLocked = false;
        this.debounceTimer = null;
        this.accumulatedScroll = 0;
        this.scrollResetTimer = null;
        this.releaseArmed = false; // require one more scroll on last item to release
        this._releaseDisarmTimer = null; // timer to auto-disarm the armed state
        this.hasReleased = false; // avoid re-engaging overlay after release
        this.isTransitioning = false; // prevent multiple transitions
        this._scrollTriggerHandler = null; // reference for cleanup

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

        // New scroll trigger system for better UX transitions
        this.setupScrollTriggers();

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
                        // Play enter sound on re-engagement
                        if (window.SoundManager) window.SoundManager.playStepperEnter();
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

    // Initial load animation - more dramatic timing
    animateInitialLoad(item) {
        item.classList.add('revealed', 'active');
        item.style.opacity = '1';
        item.style.transform = 'translate(-50%, -50%)';
        item.style.pointerEvents = 'auto';

        const chars = item.querySelectorAll('.char');
        const stagger = this.isMobile ? 50 : 70; // Slower stagger for dramatic effect

        // Animate each character with staggered delay
        chars.forEach((char, i) => {
            char.classList.remove('animate-in', 'initial-load');
            char.style.animationDelay = '';
            void char.offsetWidth;

            char.style.animationDelay = `${i * stagger}ms`;
            char.classList.add('animate-in', 'initial-load');
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
        this._keyboardHandler = this.handleKeyboard.bind(this);
        document.addEventListener('keydown', this._keyboardHandler);

        // Touch events for mobile
        if (this.isMobile) {
            this.setupTouchEvents();
        }

        // Wheel event for stepper scrolling - very strict
        this._wheelHandler = this.handleWheel.bind(this);
        this.container.addEventListener('wheel', this._wheelHandler, { passive: false });

        // Responsive resize handler
        this._resizeHandler = this.handleResize.bind(this);
        window.addEventListener('resize', this._resizeHandler);
    }

    // New scroll trigger system for responsive UX transitions
    setupScrollTriggers() {
        // Track scroll direction and momentum
        let lastScrollY = window.scrollY;
        let scrollDirection = 0;
        let isScrolling = false;
        let rafId = null;

        // Cache viewport height to avoid layout thrashing
        let viewportHeight = window.innerHeight;
        window.addEventListener('resize', () => {
            viewportHeight = window.innerHeight;
        }, { passive: true });

        const onScroll = () => {
            const currentScrollY = window.scrollY;

            // Minimal direction check
            if (Math.abs(currentScrollY - lastScrollY) > 5) {
                scrollDirection = currentScrollY > lastScrollY ? 1 : -1;
            }
            lastScrollY = currentScrollY;

            // Check transitions (throttled via RAF is implied by nature of scroll, 
            // but we add a logic gate to avoid expensive DOM checks on every frame)
            this.checkScrollUpTransition(scrollDirection, viewportHeight);

            // Clear scrolling flag
            clearTimeout(isScrolling);
            isScrolling = setTimeout(() => {
                scrollDirection = 0;
            }, 150);
        };

        // Throttled scroll listener using requestAnimationFrame
        const scrollTriggerHandler = () => {
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
                onScroll();
                rafId = null;
            });
        };

        // Global scroll listener for transitions (separate from stepper control)
        window.addEventListener('scroll', scrollTriggerHandler, { passive: true });

        // Store reference for cleanup
        this._scrollTriggerHandler = scrollTriggerHandler;
    }

    // Check if we should transition back to scroll reveal when scrolling up
    checkScrollUpTransition(scrollDirection, cachedViewportHeight) {
        // Only check if overlay is released and user is scrolling up
        if (!this.container.classList.contains('released') || scrollDirection >= 0) {
            return;
        }

        // Optimization: Quick fail if we are nowhere near the top
        // (Assuming intro is at the top, if we are far down, no need to query DOM)
        if (window.scrollY > (cachedViewportHeight || window.innerHeight) * 2) {
            return;
        }

        // Find the introduction section
        const introSection = document.getElementById('introduction') || document.querySelector('.introduction-section');
        if (!introSection) return;

        // Get the introduction title element
        const introTitle = introSection.querySelector('h2') || introSection.querySelector('.intro-headline');
        if (!introTitle) return;

        // Check if intro title is below 75% of viewport
        const titleRect = introTitle.getBoundingClientRect();
        const vh = cachedViewportHeight || window.innerHeight;
        const threshold75 = vh * 0.75;

        // If title is below 75% mark, transition back to scroll reveal
        if (titleRect.top > threshold75) {
            this.transitionToScrollReveal();
        }
    }

    // Transition back to scroll reveal overlay
    transitionToScrollReveal() {
        // Prevent multiple transitions
        if (!this.container.classList.contains('released') || this.isTransitioning) {
            return;
        }

        this.isTransitioning = true;

        // Re-engage the overlay
        this.container.classList.remove('released');
        this.container.classList.add('reengaging', 'liquid-enter');
        this.container.style.display = '';
        // Play enter sound
        if (window.SoundManager) window.SoundManager.playStepperEnter();

        if (this.stepper) {
            this.stepper.style.display = '';
        }

        // Reset state
        this.hasReleased = false;
        this.releaseArmed = false;

        // Show the final item ("Ahhhh, Just Jay!")
        requestAnimationFrame(() => {
            this.container.classList.remove('reveal-hidden');
            this.lockBodyScroll();

            // Start at the final item
            this.items.forEach(item => this.hideItem(item));
            this.currentIndex = this.items.length - 1;
            this.revealItem(this.items[this.currentIndex]);
            this.updateStepper();

            // Reset scroll state
            this.accumulatedScroll = 0;
            this.lastScrollY = window.scrollY;
            this.lastStepTime = Date.now();
            this.isProcessingScroll = false;
            this.scrollEventLocked = false;

            // Clean up transition state
            setTimeout(() => {
                this.container.classList.remove('reengaging');
                this.isTransitioning = false;
            }, 300);

            // Handle liquid-enter animation end
            const onEnterEnd = () => {
                this.container.classList.remove('liquid-enter');
                this.container.removeEventListener('animationend', onEnterEnd);
            };
            this.container.addEventListener('animationend', onEnterEnd);
        });

        // Show bottom hint
        if (this.bottomHint) {
            this.bottomHint.classList.remove('hidden');
        }
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

        // Toggle armed state class for visual indication (CSS can style .release-armed on container too)
        if (this.releaseArmed) {
            this.stepper.classList.add('armed');
        } else {
            this.stepper.classList.remove('armed');
        }
    }

    setupTouchEvents() {
        let startY = 0;
        let startX = 0;
        let isVerticalSwipe = false;

        // Touch start - capture initial position
        // Use passive: false to allow preventDefault in touchmove
        this._touchStartHandler = (e) => {
            startY = e.touches[0].clientY;
            startX = e.touches[0].clientX;
            isVerticalSwipe = false;
        };
        this.container.addEventListener('touchstart', this._touchStartHandler, { passive: false });

        // Touch move - prevent pull-to-refresh on vertical swipes within the stepper
        this._touchMoveHandler = (e) => {
            if (!this.container.classList.contains('in-view') ||
                this.container.classList.contains('released')) return;

            const currentY = e.touches[0].clientY;
            const currentX = e.touches[0].clientX;
            const deltaY = Math.abs(startY - currentY);
            const deltaX = Math.abs(startX - currentX);

            // Detect vertical swipe (more vertical than horizontal movement)
            if (deltaY > 10 && deltaY > deltaX) {
                isVerticalSwipe = true;
                // Prevent browser pull-to-refresh and native scroll
                e.preventDefault();
            }
        };
        this.container.addEventListener('touchmove', this._touchMoveHandler, { passive: false });

        // Touch end - execute the swipe action
        this._touchEndHandler = (e) => {
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

            // Swipe threshold - lowered for snappier response (was 60, now 40)
            if (Math.abs(deltaY) > 40 && deltaX < 80) {
                const direction = deltaY > 0 ? 1 : -1;
                const atLast = this.currentIndex >= this.items.length - 1;

                // If at last item and swiping down, behave like wheel: arm first, then release
                if (atLast && direction > 0) {
                    if (!this.releaseArmed) {
                        // Arm the release (intermediate clip/stepper state)
                        this.releaseArmed = true;
                        this.container.classList.add('release-armed');
                        if (this.bottomHint) this.bottomHint.classList.add('armed');
                        this.updateStepper();

                        if (this._releaseDisarmTimer) clearTimeout(this._releaseDisarmTimer);
                        this._releaseDisarmTimer = setTimeout(() => {
                            this.releaseArmed = false;
                            this.container.classList.remove('release-armed');
                            if (this.bottomHint) this.bottomHint.classList.remove('armed');
                            this.updateStepper();
                            this._releaseDisarmTimer = null;
                        }, 900);
                    } else {
                        // Already armed -> perform final release
                        if (this._releaseDisarmTimer) { clearTimeout(this._releaseDisarmTimer); this._releaseDisarmTimer = null; }
                        this.stepDown();
                    }
                } else if (this.releaseArmed && direction < 0) {
                    // Cancel armed release on upward swipe and step up one
                    this.releaseArmed = false;
                    this.container.classList.remove('release-armed');
                    if (this._releaseDisarmTimer) { clearTimeout(this._releaseDisarmTimer); this._releaseDisarmTimer = null; }
                    if (this.bottomHint) this.bottomHint.classList.remove('armed');
                    this.updateStepper();
                    this.executeStep(-1);
                } else {
                    this.executeStep(direction);
                }
            }
        };
        this.container.addEventListener('touchend', this._touchEndHandler, { passive: true });
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
        this._containerObserver = observer;
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
        // If you need to ignore scroll, use a conditional return here
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

        // Require a less significant scroll delta to trigger step (faster reveal)
        const minScrollDelta = this.isMobile ? 10 : 15;
        if (Math.abs(e.deltaY) < minScrollDelta) {
            return;
        }

        // Determine direction early
        const direction = e.deltaY > 0 ? 1 : -1;
        const atLast = this.currentIndex >= this.items.length - 1;

        // If at last item and scrolling down, arm release first; second scroll releases
        if (atLast && direction > 0) {
            // Prevent default to keep overlay until fully released
            e.preventDefault();

            if (!this.releaseArmed) {
                this.releaseArmed = true;
                this.container.classList.add('release-armed');
                if (this.bottomHint) this.bottomHint.classList.add('armed');
                this.updateStepper();

                if (this._releaseDisarmTimer) clearTimeout(this._releaseDisarmTimer);
                this._releaseDisarmTimer = setTimeout(() => {
                    this.releaseArmed = false;
                    this.container.classList.remove('release-armed');
                    if (this.bottomHint) this.bottomHint.classList.remove('armed');
                    this.updateStepper();
                    this._releaseDisarmTimer = null;
                }, 900);
            } else {
                if (this._releaseDisarmTimer) { clearTimeout(this._releaseDisarmTimer); this._releaseDisarmTimer = null; }
                // Second scroll while armed -> release to native scroll
                this.stepDown();
            }
            return; // handled
        }

        // If an armed release exists and user scrolls up, cancel it and step up
        if (this.releaseArmed && direction < 0) {
            e.preventDefault();
            this.releaseArmed = false;
            this.container.classList.remove('release-armed');
            if (this._releaseDisarmTimer) { clearTimeout(this._releaseDisarmTimer); this._releaseDisarmTimer = null; }
            if (this.bottomHint) this.bottomHint.classList.remove('armed');
            this.updateStepper();
            this.executeStep(-1);
            return;
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
                    if (!this.releaseArmed) {
                        this.releaseArmed = true;
                        this.container.classList.add('release-armed');
                        if (this.bottomHint) this.bottomHint.classList.add('armed');
                        this.updateStepper();

                        if (this._releaseDisarmTimer) clearTimeout(this._releaseDisarmTimer);
                        this._releaseDisarmTimer = setTimeout(() => {
                            this.releaseArmed = false;
                            this.container.classList.remove('release-armed');
                            if (this.bottomHint) this.bottomHint.classList.remove('armed');
                            this.updateStepper();
                            this._releaseDisarmTimer = null;
                        }, 900);
                    } else {
                        if (this._releaseDisarmTimer) { clearTimeout(this._releaseDisarmTimer); this._releaseDisarmTimer = null; }
                        this.stepDown();
                    }
                }
                break;
            case ' ': // Spacebar
                e.preventDefault();
                if (this.currentIndex < this.items.length - 1) {
                    this.executeStep(1);
                } else {
                    if (!this.releaseArmed) {
                        this.releaseArmed = true;
                        this.container.classList.add('release-armed');
                        if (this.bottomHint) this.bottomHint.classList.add('armed');
                        this.updateStepper();

                        if (this._releaseDisarmTimer) clearTimeout(this._releaseDisarmTimer);
                        this._releaseDisarmTimer = setTimeout(() => {
                            this.releaseArmed = false;
                            this.container.classList.remove('release-armed');
                            if (this.bottomHint) this.bottomHint.classList.remove('armed');
                            this.updateStepper();
                            this._releaseDisarmTimer = null;
                        }, 900);
                    } else {
                        if (this._releaseDisarmTimer) { clearTimeout(this._releaseDisarmTimer); this._releaseDisarmTimer = null; }
                        this.stepDown();
                    }
                }
                break;
        }
    }

    stepUp() {
        if (this.currentIndex > 0) {
            // Ultra-strict single-step: hide current item and show ONLY the previous one
            this.hideItem(this.items[this.currentIndex]);
            // Cancel any armed release when moving up
            if (this.releaseArmed) {
                this.releaseArmed = false;
                this.container.classList.remove('release-armed');
                if (this._releaseDisarmTimer) { clearTimeout(this._releaseDisarmTimer); this._releaseDisarmTimer = null; }
                if (this.bottomHint) this.bottomHint.classList.remove('armed');
            }
            this.currentIndex--;
            this.revealItem(this.items[this.currentIndex]);
            this.updateStepper();
            // Play step up sound
            if (window.SoundManager) window.SoundManager.playStepUp();
        }
    }

    stepDown() {
        if (this.currentIndex < this.items.length - 1) {
            // Ultra-strict single-step: hide current item and show ONLY the next one
            this.hideItem(this.items[this.currentIndex]);
            this.currentIndex++;
            this.revealItem(this.items[this.currentIndex]);
            this.updateStepper();
            // Play step down sound
            if (window.SoundManager) window.SoundManager.playStepDown();
        } else {
            // On last item: fade out the current item, reveal the navbar, and release to native scroll
            try {
                const glassNav = document.getElementById('glassNav');
                if (glassNav) {
                    if (window.setNavbarAccessibility) {
                        window.setNavbarAccessibility(glassNav, true);
                    } else {
                        glassNav.classList.add('visible');
                    }
                }

                // Fade the final item out for a smoother transition
                const currentItem = this.items[this.currentIndex];
                if (currentItem) {
                    this.hideItem(currentItem);
                }

                // Release native scroll with fluid fade of overlay (stay fixed during fade)
                this.unlockBodyScroll();
                this.container.classList.add('releasing');
                // Play exit sound
                if (window.SoundManager) window.SoundManager.playStepperExit();
                // clear any armed state
                this.releaseArmed = false;
                this.container.classList.remove('release-armed');
                if (this._releaseDisarmTimer) { clearTimeout(this._releaseDisarmTimer); this._releaseDisarmTimer = null; }
                if (this.bottomHint) this.bottomHint.classList.remove('armed');
                // After fade finishes, fully remove overlay and enable natural scrolling
                setTimeout(() => {
                    this.container.classList.remove('releasing');
                    this.container.classList.add('released');
                    this.container.style.display = 'none';

                    // Enable natural scrolling without scroll snap constraints
                    this.enableNaturalScrolling();

                    // Smoothly scroll to intro section near the top with a small padding
                    setTimeout(() => {
                        this.scrollToIntroSection();
                    }, 100);
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
                // Enable natural scrolling even on error
                this.enableNaturalScrolling();
                // Try to scroll to intro section even on error
                setTimeout(() => this.scrollToIntroSection(), 100);
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
        item.style.opacity = '1';
        item.style.transform = 'translate(-50%, -50%)';
        item.style.pointerEvents = 'auto';

        // Get all characters for sequential left-to-right animation
        const chars = item.querySelectorAll('.char');
        const stagger = this.isMobile ? 40 : 55; // ms between each character

        // Animate characters with staggered delay
        chars.forEach((char, i) => {
            // Reset state
            char.classList.remove('animate-in', 'initial-load');
            char.style.animationDelay = '';

            // Trigger reflow for animation restart
            void char.offsetWidth;

            // Apply staggered delay and start animation
            char.style.animationDelay = `${i * stagger}ms`;
            char.classList.add('animate-in');
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


    // Enable scroll snap for strict step-by-step scrolling after overlay release
    // Enable natural scrolling after overlay release
    enableNaturalScrolling() {
        // Remove any scroll restrictions
        document.body.classList.remove('lock-scroll');
        document.documentElement.style.scrollBehavior = 'smooth';

        // Natural scrolling enabled - overlay released
    }

    // Smoothly scroll to introduction section near the top with a small padding
    scrollToIntroSection() {
        const introSection = document.querySelector('#introduction') || document.querySelector('.introduction-section');

        if (introSection) {
            // Get the absolute position of the introduction section
            const sectionRect = introSection.getBoundingClientRect();
            const sectionPageY = window.scrollY + sectionRect.top;

            // Account for fixed navbar if present
            let navOffset = 0;
            const navEl = document.getElementById('glassNav') || document.querySelector('.glass-nav');
            if (navEl && navEl.offsetHeight) {
                const navStyle = window.getComputedStyle(navEl);
                if (navStyle.position === 'fixed' || navStyle.position === 'sticky') {
                    navOffset = navEl.offsetHeight;
                }
            }

            // Use a small fixed padding so the intro is positioned close to the top
            // Adjust `paddingPx` if you want more/less space (pixels)
            const paddingPx = 6;
            const viewportOffset = paddingPx;
            const targetTop = Math.max(0, Math.round(sectionPageY - viewportOffset - navOffset));

            // Scrolling to intro section at 20% from top (computed values available for debugging if needed)

            // Smooth scroll to the calculated position
            try {
                window.scrollTo({
                    top: targetTop,
                    behavior: 'smooth'
                });
            } catch (err) {
                // Fallback for older browsers
                window.scrollTo(0, targetTop);
            }
        } else {
            // Fallback: scroll down a viewport height
            const targetTop = window.scrollY + window.innerHeight * 0.9;
            try {
                window.scrollTo({
                    top: targetTop,
                    behavior: 'smooth'
                });
            } catch (err) {
                window.scrollTo(0, targetTop);
            }
        }
    }

    // Cleanup method - comprehensive
    destroy() {
        // Clear timers
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        if (this.scrollResetTimer) {
            clearTimeout(this.scrollResetTimer);
            this.scrollResetTimer = null;
        }
        if (this._releaseDisarmTimer) {
            clearTimeout(this._releaseDisarmTimer);
            this._releaseDisarmTimer = null;
        }

        // Remove event listeners
        try {
            if (this._scrollTriggerHandler) {
                window.removeEventListener('scroll', this._scrollTriggerHandler);
                this._scrollTriggerHandler = null;
            }
            if (this._keyboardHandler) {
                document.removeEventListener('keydown', this._keyboardHandler);
                this._keyboardHandler = null;
            }
            if (this._wheelHandler && this.container) {
                this.container.removeEventListener('wheel', this._wheelHandler, { passive: false });
                this._wheelHandler = null;
            }
            if (this._resizeHandler) {
                window.removeEventListener('resize', this._resizeHandler);
                this._resizeHandler = null;
            }
            // Clean up touch event handlers
            if (this.container) {
                if (this._touchStartHandler) {
                    this.container.removeEventListener('touchstart', this._touchStartHandler);
                    this._touchStartHandler = null;
                }
                if (this._touchMoveHandler) {
                    this.container.removeEventListener('touchmove', this._touchMoveHandler);
                    this._touchMoveHandler = null;
                }
                if (this._touchEndHandler) {
                    this.container.removeEventListener('touchend', this._touchEndHandler);
                    this._touchEndHandler = null;
                }
            }
        } catch (err) {
            // defensive: ignore errors during cleanup
        }

        // Disconnect observers
        try {
            if (this._containerObserver && typeof this._containerObserver.disconnect === 'function') {
                this._containerObserver.disconnect();
                this._containerObserver = null;
            }
            if (this._heroObserver && typeof this._heroObserver.disconnect === 'function') {
                this._heroObserver.disconnect();
                this._heroObserver = null;
            }
        } catch (err) {
            // ignore
        }

        // Null out handler references and DOM refs to help GC
        this._keyboardHandler = null;
        this._wheelHandler = null;
        this._resizeHandler = null;
        this._scrollTriggerHandler = null;

        // Null DOM references (do not modify the DOM structure here)
        this.container = null;
        this.listElement = null;
        this.items = null;
        this.stepper = null;
        this.stepperDots = null;
        this.bottomHint = null;
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
