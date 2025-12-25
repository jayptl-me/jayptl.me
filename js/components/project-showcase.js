/**
 * Project Showcase Component
 * Handles the project showcase and work carousel synchronization
 * 
 * @file components/project-showcase.js
 * @author Jay Patel
 */

(function () {
    'use strict';

    class ProjectShowcase {
        constructor() {
            this.showcase = document.getElementById('projectShowcase');
            this.carousel = document.getElementById('workCarousel');
            this.track = this.carousel?.querySelector('.work-carousel-track');
            this.dotsContainer = document.getElementById('carouselDots');
            this.prevBtn = document.querySelector('.carousel-prev');
            this.nextBtn = document.querySelector('.carousel-next');
            
            this.panels = [];
            this.slides = [];
            this.currentIndex = 0;
            this.autoScrollPaused = false;
            this.isAnimating = false;

            if (this.showcase && this.carousel && this.track) {
                this.init();
            }
        }

        init() {
            // Get showcase panels and slides
            this.panels = Array.from(this.showcase.querySelectorAll('.showcase-panel'));
            this.slides = Array.from(this.track.querySelectorAll('.work-slide:not([aria-hidden])'));
            
            // Clone slides for infinite scroll effect
            this.cloneSlides();
            
            // Create navigation dots
            this.createDots();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup intersection observer
            this.setupIntersectionObserver();
            
            // Set initial active state
            this.updateActiveStates(0);
            
            // Setup auto-rotation
            this.startAutoRotation();
        }

        cloneSlides() {
            // Clone all slides and append for seamless infinite scroll
            this.slides.forEach(slide => {
                const clone = slide.cloneNode(true);
                clone.setAttribute('aria-hidden', 'true');
                clone.removeAttribute('data-index');
                // Remove preview from clones to avoid duplicate popups
                const clonePreview = clone.querySelector('.slide-preview');
                if (clonePreview) {
                    clonePreview.remove();
                }
                this.track.appendChild(clone);
            });
        }

        createDots() {
            if (!this.dotsContainer) return;
            
            this.slides.forEach((_, index) => {
                const dot = document.createElement('button');
                dot.className = 'carousel-dot' + (index === 0 ? ' active' : '');
                dot.setAttribute('aria-label', `View project ${index + 1}`);
                dot.addEventListener('click', () => this.goToSlide(index));
                this.dotsContainer.appendChild(dot);
            });
        }

        setupEventListeners() {
            // Navigation buttons
            if (this.prevBtn) {
                this.prevBtn.addEventListener('click', () => this.navigate(-1));
            }
            if (this.nextBtn) {
                this.nextBtn.addEventListener('click', () => this.navigate(1));
            }

            // Click on slides to select
            const allSlides = this.track.querySelectorAll('.work-slide');
            allSlides.forEach((slide, index) => {
                slide.addEventListener('click', () => {
                    const realIndex = index % this.slides.length;
                    this.goToSlide(realIndex);
                });
            });

            // Pause on hover (showcase and carousel)
            this.showcase.addEventListener('mouseenter', () => this.pauseAutoRotation());
            this.showcase.addEventListener('mouseleave', () => this.resumeAutoRotation());
            this.track.addEventListener('mouseenter', () => this.pauseAutoScroll());
            this.track.addEventListener('mouseleave', () => this.resumeAutoScroll());

            // Touch support for carousel
            let touchStartX = 0;
            let touchEndX = 0;

            this.track.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
                this.pauseAutoScroll();
            }, { passive: true });

            this.track.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].screenX;
                this.handleSwipe(touchStartX, touchEndX);
                this.resumeAutoScroll();
            }, { passive: true });

            // Keyboard navigation
            this.carousel.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft') {
                    this.navigate(-1);
                } else if (e.key === 'ArrowRight') {
                    this.navigate(1);
                }
            });
            
            // Make carousel focusable for keyboard
            this.carousel.setAttribute('tabindex', '0');
            this.carousel.setAttribute('role', 'region');
            this.carousel.setAttribute('aria-label', 'Project carousel');
        }

        setupIntersectionObserver() {
            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            this.resumeAutoScroll();
                            this.resumeAutoRotation();
                        } else {
                            this.pauseAutoScroll();
                            this.pauseAutoRotation();
                        }
                    });
                },
                { threshold: 0.3 }
            );

            observer.observe(this.carousel);
        }

        navigate(direction) {
            if (this.isAnimating) return;
            
            const newIndex = (this.currentIndex + direction + this.slides.length) % this.slides.length;
            this.goToSlide(newIndex);
        }

        goToSlide(index) {
            if (this.isAnimating || index === this.currentIndex) return;
            
            this.isAnimating = true;
            this.currentIndex = index;
            this.updateActiveStates(index);
            
            // Reset animation lock after transition
            setTimeout(() => {
                this.isAnimating = false;
            }, 500);
        }

        updateActiveStates(index) {
            // Update showcase panels
            this.panels.forEach((panel, i) => {
                panel.classList.toggle('active', i === index);
            });
            
            // Update dots
            this.updateDots(index);
            
            // Update slides visual state
            const allSlides = this.track.querySelectorAll('.work-slide');
            allSlides.forEach((slide, i) => {
                const realIndex = i % this.slides.length;
                slide.classList.toggle('active', realIndex === index);
            });
            
            // Announce to screen readers
            this.announceChange(index);
        }

        updateDots(index) {
            if (!this.dotsContainer) return;
            
            const dots = this.dotsContainer.querySelectorAll('.carousel-dot');
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === index);
            });
        }

        announceChange(index) {
            // Create or update live region for accessibility
            let announcer = document.getElementById('carouselAnnouncer');
            if (!announcer) {
                announcer = document.createElement('div');
                announcer.id = 'carouselAnnouncer';
                announcer.setAttribute('aria-live', 'polite');
                announcer.setAttribute('aria-atomic', 'true');
                announcer.className = 'sr-only';
                this.carousel.appendChild(announcer);
            }
            
            const projectNumber = index + 1;
            announcer.textContent = `Viewing project ${projectNumber} of ${this.slides.length}`;
        }

        handleSwipe(startX, endX) {
            const threshold = 50;
            const diff = startX - endX;
            
            if (Math.abs(diff) > threshold) {
                if (diff > 0) {
                    this.navigate(1); // Swipe left, go next
                } else {
                    this.navigate(-1); // Swipe right, go prev
                }
            }
        }

        startAutoRotation() {
            this.autoRotationInterval = setInterval(() => {
                if (!this.autoScrollPaused) {
                    this.navigate(1);
                }
            }, 5000); // Change every 5 seconds
        }

        pauseAutoRotation() {
            this.autoScrollPaused = true;
        }

        resumeAutoRotation() {
            this.autoScrollPaused = false;
        }

        pauseAutoScroll() {
            this.track.style.animationPlayState = 'paused';
            this.pauseAutoRotation();
        }

        resumeAutoScroll() {
            this.track.style.animationPlayState = 'running';
            this.resumeAutoRotation();
        }
    }

    // Mini card interactions
    class MiniCardInteractions {
        constructor() {
            this.miniCards = document.querySelectorAll('.mini-card');
            
            if (this.miniCards.length > 0) {
                this.init();
            }
        }

        init() {
            this.miniCards.forEach(card => {
                // Add subtle hover sound/haptic feedback placeholder
                card.addEventListener('click', () => {
                    this.handleCardClick(card);
                });
                
                // Keyboard accessibility
                card.setAttribute('tabindex', '0');
                card.setAttribute('role', 'button');
                card.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.handleCardClick(card);
                    }
                });
            });
        }

        handleCardClick(card) {
            // Pulse animation on click
            card.style.transform = 'scale(0.95)';
            setTimeout(() => {
                card.style.transform = '';
            }, 150);
            
            // Future: Open modal, show details, etc.
        }
    }

    // Initialize when DOM is ready
    function init() {
        new ProjectShowcase();
        new MiniCardInteractions();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
