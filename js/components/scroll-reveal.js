
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
        this.stepperWrapper = null;
        this.stepperHint = null;
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
        this._releasing = false; // release transition in flight — blocks re-entry until it settles
        this._releaseDisarmTimer = null; // timer to auto-disarm the armed state
        this.hasReleased = false; // avoid re-engaging overlay after release
        this.hasScrolledAway = false; // only re-engage when user has scrolled away and returned
        this.isTransitioning = false; // prevent multiple transitions
        this._scrollTriggerHandler = null; // reference for cleanup

        this.init();
    }

    init() {
        if (!this.container || !this.listElement || !this.items.length) {
            return;
        }

        // Check if arriving via anchor/hash targeting below-hero sections
        const hash = window.location.hash;
        if (hash && hash !== '#home' && document.querySelector(hash)) {
            this.container.classList.add('released');
            this.container.style.display = 'none';
            this.hasReleased = true;
            this.unlockBodyScroll();
            return;
        }

        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }
        window.scrollTo(0, 0);

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

    // Initial load animation - particle gather / split stagger
    animateInitialLoad(item) {
        item.classList.add('revealed', 'active');
        item.style.opacity = '1';
        item.style.transform = 'translate(-50%, -50%)';
        item.style.pointerEvents = 'auto';

        this.playItemText(item);
    }

    /* Reveal 1 = particle canvas, Reveal 2+ = runtime split stagger.
       Both are progressive enhancements; missing globals fail silently
       and the item still shows via the revealed/active classes. */
    playItemText(item) {
        var ptHost = item.querySelector('[data-particle-text]');
        if (ptHost && window.ParticleText) {
            var inst = window.ParticleText.mount(ptHost);
            if (inst) {
                inst.unpause();
                // Fresh scatter-gather on every reveal (the mount gather
                // ran once behind the preloader).
                inst.replay();
                return;
            }
        }
        var splitHost = item.querySelector('[data-split]');
        if (splitHost && window.SplitText) {
            if (!splitHost._splitText) window.SplitText.split(splitHost);
            window.SplitText.play(splitHost);
        }
    }

    /* Pause canvas loops and reset split state so re-reveals replay. */
    pauseItemText(item) {
        var ptHost = item.querySelector('[data-particle-text]');
        if (ptHost && window.ParticleText) {
            var inst = window.ParticleText.of(ptHost);
            if (inst) inst.pause();
        }
        var splitHost = item.querySelector('[data-split]');
        if (splitHost && window.SplitText) window.SplitText.reset(splitHost);
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

        // Hashchange listener for deep links or in-page anchor navigation
        this._hashHandler = () => {
            const hash = window.location.hash;
            if (hash && hash !== '#home') {
                const target = document.querySelector(hash);
                if (target) {
                    this.releaseToTarget(target);
                }
            } else if (hash === '#home') {
                if (this.container && this.container.classList.contains('released')) {
                    this.transitionToScrollReveal();
                }
            }
        };
        window.addEventListener('hashchange', this._hashHandler);
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

            // Track if user has scrolled away from hero into the document
            if (currentScrollY > 100) {
                this.hasScrolledAway = true;
            }

            // Minimal direction check
            if (Math.abs(currentScrollY - lastScrollY) > 5) {
                scrollDirection = currentScrollY > lastScrollY ? 1 : -1;
            }
            lastScrollY = currentScrollY;

            // Check transitions only once user has scrolled away from hero
            if (this.hasScrolledAway) {
                this.checkScrollUpTransition(scrollDirection, viewportHeight);
            }

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

        // Stepper must NEVER re-engage unless scroll is strictly at the top
        if (window.scrollY > 2) {
            return;
        }

        // Find the intro section and ensure it is 100% off the bottom of the viewport
        const introSection = document.getElementById('intro');
        if (introSection) {
            const introRect = introSection.getBoundingClientRect();
            const vh = cachedViewportHeight || window.innerHeight;
            if (introRect.top < vh - 2) {
                return;
            }
        }

        this.transitionToScrollReveal();
    }

    // Transition back to scroll reveal overlay
    transitionToScrollReveal() {
        // Prevent multiple transitions, and never re-engage mid-release.
        if (!this.container.classList.contains('released') || this.isTransitioning || this._releasing) {
            return;
        }

        this.isTransitioning = true;
        this.lockBodyScroll();
        window.scrollTo(0, 0);

        // Reset state
        this.hasReleased = false;
        this.hasScrolledAway = false;
        this.releaseArmed = false;

        // Reset scroll state
        this.accumulatedScroll = 0;
        this.lastScrollY = 0;
        this.lastStepTime = Date.now();
        this.isProcessingScroll = false;
        this.scrollEventLocked = false;

        // Play enter sound
        if (window.SoundManager) window.SoundManager.playStepperEnter();

        // Prepare final item ("Ahhhh, Just Jay!") without bounce animation conflict
        if (this.items.length) {
            this.items.forEach(item => this.hideItem(item));
            this.currentIndex = this.items.length - 1;
            this.revealItem(this.items[this.currentIndex], true);
        }
        this.updateStepper();

        // Re-engage overlay container
        this.container.classList.remove('released', 'liquid-exit', 'reengaging', 'liquid-enter', 'reveal-hidden');
        document.body.classList.remove('grid-morph-out');

        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const tmode = document.body.getAttribute('data-transition') || 'pixels';

        if (!reduceMotion && tmode === 'pixels' && window.PixelSwap) {
            // Static transform ensures userSpaceOnUse SVG clip coordinates never shear or jitter
            this.container.style.display = '';
            this.showStepper(true);

            window.PixelSwap.reveal(this.container, {
                pattern: 'center',
                pixelSize: 50,
                duration: 850,
                pixelDuration: 550,
                onComplete: () => {
                    this.isTransitioning = false;
                }
            });
        } else {
            this.container.style.display = '';
            this.showStepper();
            this.isTransitioning = false;
        }

        if (this.bottomHint) {
            this.bottomHint.classList.remove('hidden');
        }
    }

    createStepper() {
        if (!this.container || !this.items?.length) return;

        // Avoid duplicate
        if (this.stepperWrapper && this.stepperWrapper.isConnected) return;
        if (this.stepper && this.stepper.isConnected) return;

        // Wrapper to host floating scroll hint and liquid glass stepper pill
        const wrapper = document.createElement('div');
        wrapper.className = 'stepper-wrapper';

        // Floating Scroll Hint directly above the pill
        const hint = document.createElement('button');
        hint.type = 'button';
        hint.className = 'stepper-scroll-hint';
        hint.setAttribute('aria-label', 'Scroll');
        hint.innerHTML = `
            <span class="scroll-hint-label">SCROLL</span>
            <svg class="scroll-hint-chevron" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        hint.addEventListener('click', () => {
            this.stepDown();
        });
        wrapper.appendChild(hint);
        this.stepperHint = hint;

        // Option A: Liquid Glass Stepper Pill
        const stepper = document.createElement('div');
        stepper.className = 'reveal-stepper';
        stepper.setAttribute('role', 'group');
        stepper.setAttribute('aria-label', 'Reveal navigation');

        // Dots in center
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

        stepper.appendChild(dotsWrap);
        wrapper.appendChild(stepper);

        this.container.appendChild(wrapper);
        this.stepper = stepper;
        this.stepperWrapper = wrapper;
        this.updateStepper();
    }

    triggerSquish() {
        // Disabled: bottom pill remains steady without bouncing on scroll
    }

    showStepper(fade = false) {
        const el = this.stepperWrapper || this.stepper;
        if (!el) return;
        el.style.display = '';
        if (fade) {
            el.style.opacity = '0';
            el.style.transition = 'opacity 350ms var(--ease-out) 200ms';
            requestAnimationFrame(() => {
                el.style.opacity = '1';
            });
        } else {
            el.style.opacity = '1';
            el.style.transition = '';
        }
    }

    hideStepper() {
        const el = this.stepperWrapper || this.stepper;
        if (!el) return;
        el.style.display = 'none';
    }

    updateStepper() {
        if (!this.stepper) return;

        // Update dots
        this.stepperDots.forEach((dot, i) => {
            dot.classList.toggle('active', i === this.currentIndex);
            dot.setAttribute('aria-current', i === this.currentIndex ? 'step' : 'false');
        });

        const isLast = this.currentIndex >= this.items.length - 1;

        // Update Scroll Hint text and visual state
        if (this.stepperHint) {
            const labelEl = this.stepperHint.querySelector('.scroll-hint-label');
            if (labelEl) {
                labelEl.textContent = isLast ? 'SCROLL TO KNOW' : 'SCROLL';
            }
            this.stepperHint.setAttribute('aria-label', isLast ? 'Scroll to know' : 'Scroll');
            this.stepperHint.classList.toggle('is-final', isLast);
        }

        // Calculate progress (starts at 100% and depletes as we scroll down)
        const total = Math.max(this.items.length - 1, 1);
        const progressRatio = Math.min(Math.max(this.currentIndex / total, 0), 1);
        const remainingProgress = 1 - progressRatio; // Invert: start at 100%, go to 0%

        // Update animated gradient bars with progress classes
        this.stepper.classList.remove('progress-0', 'progress-20', 'progress-40',
            'progress-60', 'progress-80', 'progress-100');

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

        // Toggle armed state class for visual indication
        if (this.releaseArmed) {
            this.stepper.classList.add('armed');
            if (this.stepperHint) this.stepperHint.classList.add('armed');
        } else {
            this.stepper.classList.remove('armed');
            if (this.stepperHint) this.stepperHint.classList.remove('armed');
        }
    }

    setupTouchEvents() {
        let startY = 0;
        let startX = 0;
        let isVerticalSwipe = false;

        // Touch start - capture initial position
        // Use passive: false to allow preventDefault in touchmove
        this._touchStartHandler = (e) => {
            if (this._releasing) {
                e.preventDefault();
                return;
            }
            startY = e.touches[0].clientY;
            startX = e.touches[0].clientX;
            isVerticalSwipe = false;
        };
        this.container.addEventListener('touchstart', this._touchStartHandler, { passive: false });

        // Touch move - prevent pull-to-refresh on vertical swipes within the stepper
        this._touchMoveHandler = (e) => {
            if (this._releasing) {
                e.preventDefault();
                return;
            }
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
            if (this._releasing) {
                e.preventDefault();
                return;
            }
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
        if (this._releasing) {
            e.preventDefault();
            return;
        }

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
        if (this._releasing) {
            e.preventDefault();
            return;
        }

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
            case 'PageUp':
            case 'Home':
                e.preventDefault();
                if (this.currentIndex > 0) {
                    this.goToSection(0);
                    this.updateStepper();
                }
                break;
            case 'PageDown':
            case 'End':
                e.preventDefault();
                if (this.currentIndex < this.items.length - 1) {
                    this.goToSection(this.items.length - 1);
                    this.updateStepper();
                } else {
                    this.stepDown();
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
            // On last item: release to native scroll with pixel dissolve or fade.
            // Guarded: a second input must not start a second release while this one settles.
            if (this._releasing) return;
            this._releasing = true;
            try {
                const glassNav = document.getElementById('glassNav');
                if (glassNav) {
                    if (window.setNavbarAccessibility) {
                        window.setNavbarAccessibility(glassNav, true);
                    } else {
                        glassNav.classList.add('visible');
                    }
                }

                // clear any armed state
                this.releaseArmed = false;
                this.container.classList.remove('release-armed');
                if (this._releaseDisarmTimer) { clearTimeout(this._releaseDisarmTimer); this._releaseDisarmTimer = null; }
                if (this.bottomHint) this.bottomHint.classList.add('hidden');
                this.hideStepper();

                const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                const tmode = document.body.getAttribute('data-transition') || 'pixels';

                if (!reduceMotion && tmode === 'pixels' && window.PixelSwap) {
                    this.releaseWithPixels();
                } else {
                    // Fade the final item out for a smoother transition
                    const currentItem = this.items[this.currentIndex];
                    if (currentItem) {
                        this.hideItem(currentItem);
                    }

                    // Keep scroll locked while container fades out!
                    this.container.classList.add('releasing');
                    if (window.SoundManager) window.SoundManager.playStepperExit();
                    setTimeout(() => {
                        this.container.classList.remove('releasing');
                        this.container.classList.add('released');
                        this.container.style.display = 'none';
                        this._releasing = false;
                        this.hasReleased = true;

                        // Unlock body scroll and enable smooth scrolling only after overlay is hidden
                        this.unlockBodyScroll();
                        this.enableNaturalScrolling();
                        this.scrollToIntroSection();
                    }, 420);
                }
            } catch (err) {
                this._releasing = false;
                this.container.classList.add('released');
                this.container.style.display = 'none';
                this.hasReleased = true;
                if (this.bottomHint) this.bottomHint.classList.add('hidden');
                this.hideStepper();
                this.unlockBodyScroll();
                this.enableNaturalScrolling();
                setTimeout(() => this.scrollToIntroSection(), 100);
            }
        }
    }

    releaseWithPixels(onFinish) {
        if (window.SoundManager) window.SoundManager.playStepperExit();
        this.hideStepper();

        const currentItem = this.items[this.currentIndex];

        // Dissolve the overlay container via pixel clip (edges pattern).
        // Scroll remains strictly locked at (0, 0) throughout the entire dissolve!
        window.PixelSwap.dissolve(this.container, {
            pattern: 'edges',
            pixelSize: 50,
            duration: 800,
            pixelDuration: 500,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            onComplete: () => {
                if (currentItem) this.pauseItemText(currentItem);
                this.container.classList.add('released');
                this.container.style.display = 'none';
                this._releasing = false;
                this.hasReleased = true;
                this.hasScrolledAway = false;
                this.unlockBodyScroll();
                this.enableNaturalScrolling();
                if (typeof onFinish === 'function') {
                    onFinish();
                } else {
                    this.scrollToIntroSection();
                }
            }
        });
    }

    // Programmatic release targeting an anchor element (e.g. from nav clicks)
    releaseToTarget(targetElement) {
        if (!this.container || this.container.classList.contains('released')) {
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            return;
        }

        if (this._releasing) return;
        this._releasing = true;

        const glassNav = document.getElementById('glassNav');
        if (glassNav) {
            if (window.setNavbarAccessibility) {
                window.setNavbarAccessibility(glassNav, true);
            } else {
                glassNav.classList.add('visible');
            }
        }

        if (this.bottomHint) this.bottomHint.classList.add('hidden');
        this.hideStepper();

        const onFinish = () => {
            if (targetElement) {
                setTimeout(() => {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 50);
            }
        };

        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const tmode = document.body.getAttribute('data-transition') || 'pixels';

        if (!reduceMotion && tmode === 'pixels' && window.PixelSwap) {
            this.releaseWithPixels(onFinish);
        } else {
            const currentItem = this.items[this.currentIndex];
            if (currentItem) this.hideItem(currentItem);
            this.container.classList.add('releasing');
            if (window.SoundManager) window.SoundManager.playStepperExit();
            setTimeout(() => {
                this.container.classList.remove('releasing');
                this.container.classList.add('released');
                this.container.style.display = 'none';
                this._releasing = false;
                this.hasReleased = true;
                this.unlockBodyScroll();
                this.enableNaturalScrolling();
                onFinish();
            }, 350);
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
        this.updateStepper();
    }

    revealItem(item, skipBounce = false) {
        // Invalidate any pending hideItem cleanup for this item: re-engage
        // paths hide-then-reveal in the same tick, and the deferred hide
        // must not stomp the fresh reveal 300-400ms later.
        item._hideSeq = (item._hideSeq || 0) + 1;

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

        // Reveal 1 (particle) / Reveal 2+ (split) text effects
        this.playItemText(item);

        // Toggle bottom hint and lock based on position
        const atLast = this.currentIndex >= this.items.length - 1;

        // While showing the last item, keep the overlay fixed and the page locked.
        // Only when the user scrolls down again from the last item (handled in stepDown), release to native scroll.
        this.container.classList.remove('reveal-hidden');
        this.container.classList.remove('released');
        this.container.classList.remove('liquid-exit');
        this.lockBodyScroll();

        // Add a subtle spring bounce when the last item becomes active
        if (atLast && !skipBounce) {
            item.classList.add('bounce-in');
        } else {
            item.classList.remove('bounce-in');
            this.releaseArmed = false;
        }
        this.updateStepper();
    }

    hideItem(item) {
        if (!item.classList.contains('revealed')) return;

        // Sequence-guard the deferred cleanup below: if the item is
        // re-revealed before the timer fires, the stale timeout bails
        // instead of stomping the fresh reveal.
        item._hideSeq = (item._hideSeq || 0) + 1;
        const hideSeq = item._hideSeq;

        // Stop canvas work and reset split state so the next reveal replays.
        this.pauseItemText(item);

        const duration = this.isMobile ? '0.35s' : '0.5s';

        item.style.transition = `transform ${duration} ease-in, opacity ${duration} ease-in`;
        item.style.transform = 'translate(-50%, -50%) translateY(-20px)';
        item.style.opacity = '0';
        item.style.pointerEvents = 'none';

        setTimeout(() => {
            if (item._hideSeq !== hideSeq) return; // re-revealed since: keep it
            item.classList.remove('revealed', 'active');
            item.classList.remove('bounce-in');

            // Reset styles for next reveal (split state already reset by
            // pauseItemText so the next reveal replays from hidden)
            item.style.transform = 'translate(-50%, -50%)';
            item.style.opacity = '0';
            item.style.transition = '';
        }, this.isMobile ? 300 : 400);
    }


    setBelowSectionsInert(inert) {
        try {
            const sections = document.querySelectorAll('main > section:not(.hero)');
            sections.forEach(sec => {
                if (inert) {
                    sec.setAttribute('inert', '');
                } else {
                    sec.removeAttribute('inert');
                }
            });
        } catch (e) {
            // Browser might not support querySelector or inert
        }
    }

    lockBodyScroll() {
        if (this._scrollLocked) return;
        this._scrollLocked = true;
        // Overflow and overscroll lock on both html and body
        document.documentElement.classList.add('lock-scroll');
        document.body.classList.add('lock-scroll');
        document.body.style.overflow = 'hidden';
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo(0, 0);
        this.setBelowSectionsInert(true);
    }

    unlockBodyScroll() {
        if (!this._scrollLocked) return;
        this._scrollLocked = false;
        document.documentElement.classList.remove('lock-scroll');
        document.body.classList.remove('lock-scroll');
        document.body.style.overflow = '';
        document.documentElement.style.scrollBehavior = '';
        this.setBelowSectionsInert(false);
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

    // Enable natural scrolling after overlay release
    enableNaturalScrolling() {
        // Remove any scroll restrictions
        document.documentElement.classList.remove('lock-scroll');
        document.body.classList.remove('lock-scroll');
        document.documentElement.style.scrollBehavior = 'smooth';
    }

    // Smoothly scroll to introduction section near the top with a small padding
    scrollToIntroSection() {
        const introSection = document.querySelector('#intro') || document.querySelector('#introduction') || document.querySelector('.introduction-section');

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

        // Teardown particle/split instances owned by the overlay
        try {
            if (this.container) {
                if (window.ParticleText) {
                    this.container.querySelectorAll('[data-particle-text]').forEach(function (host) {
                        var inst = window.ParticleText.of(host);
                        if (inst) inst.destroy();
                    });
                }
                if (window.SplitText) {
                    this.container.querySelectorAll('[data-split]').forEach(function (host) {
                        window.SplitText.destroy(host);
                    });
                }
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
        this.stepperWrapper = null;
        this.stepperHint = null;
        this.stepperDots = null;
        this.bottomHint = null;
    }
}

// Grid micro-gesture for T1/T4 ground rounds: dip the persistent site grid
// at each transition beat. Skipped under reduced motion (CSS holds full).
window.gridDip = function () {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.body.classList.add('grid-dip');
    setTimeout(function () { document.body.classList.remove('grid-dip'); }, 900);
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.scrollRevealComponent = new ScrollRevealComponent();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScrollRevealComponent;
}
