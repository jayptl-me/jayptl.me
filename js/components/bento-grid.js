/**
 * Bento Grid Component
 * Handles auto-scrolling animation and overlay reveal for bento grid
 * 
 * @file components/bento-grid.js
 * @author Jay Patel
 */

class BentoGrid {
  constructor() {
    this.container = document.querySelector('.bento-grid-scroll-container');
    this.overlay = document.getElementById('bentoOverlay');
    this.section = document.querySelector('.bento-grid-section');
    this.scrollSpeed = 1.2; // pixels per frame for horizontal scroll
    this.isPaused = false;
    this.scrollDirection = 1; // 1 for right, -1 for left
    this.animationFrameId = null;
    this.hasRevealed = false;
    
    if (this.container && this.overlay && this.section) {
      this.init();
    }
  }

  init() {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReducedMotion) {
      console.log('Reduced motion preferred, auto-scroll disabled');
      this.revealGrid();
      return;
    }

    // Handle scroll-based reveal
    this.setupScrollReveal();

    // Pause on user interaction with grid
    this.container.addEventListener('wheel', (e) => {
      if (!this.hasRevealed) return;
      this.isPaused = true;
      this.resetPauseTimer();
    });

    // Support horizontal scrolling with mouse wheel
    this.container.addEventListener('wheel', (e) => {
      if (!this.hasRevealed) return;
      if (Math.abs(e.deltaX) === 0 && Math.abs(e.deltaY) > 0) {
        e.preventDefault();
        this.container.scrollLeft += e.deltaY;
      }
    }, { passive: false });

    // Pause on touch
    this.container.addEventListener('touchstart', () => {
      if (!this.hasRevealed) return;
      this.isPaused = true;
      this.resetPauseTimer();
    });

    // Handle intersection observer for performance
    this.setupIntersectionObserver();
  }

  setupScrollReveal() {
    const revealThreshold = window.innerHeight * 0.3;
    const hideThreshold = window.innerHeight * 0.8;

    const handleScroll = () => {
      const sectionRect = this.section.getBoundingClientRect();
      
      // Reveal when scrolling down into section
      if (sectionRect.top < revealThreshold && !this.hasRevealed) {
        this.revealGrid();
      }
      // Hide when scrolling back up out of section
      else if (sectionRect.top > hideThreshold && this.hasRevealed) {
        this.hideGrid();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
  }

  revealGrid() {
    this.hasRevealed = true;
    
    // Ensure overlay is visible first
    if (this.overlay) {
      this.overlay.style.display = 'flex';
      this.overlay.classList.remove('hidden');
      
      // Animate overlay out
      requestAnimationFrame(() => {
        this.overlay.classList.add('revealing');
      });
    }

    // Reveal grid
    if (this.container) {
      this.container.classList.add('revealed');
      
      // Start auto-scroll after reveal
      setTimeout(() => {
        this.startAutoScroll();
      }, 300);
    }
  }

  hideGrid() {
    this.hasRevealed = false;
    this.stopAutoScroll();
    
    // Bring overlay back
    if (this.overlay) {
      this.overlay.style.display = 'flex';
      this.overlay.classList.remove('revealing');
      this.overlay.classList.add('hidden');
      
      // Remove hidden class to reset for next reveal
      setTimeout(() => {
        this.overlay.classList.remove('hidden');
      }, 600);
    }

    // Hide grid
    if (this.container) {
      this.container.classList.remove('revealed');
    }
  }

  setupIntersectionObserver() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && this.hasRevealed) {
            this.startAutoScroll();
          } else {
            this.stopAutoScroll();
          }
        });
      },
      {
        threshold: 0.1,
      }
    );

    observer.observe(this.section);
  }

  startAutoScroll() {
    if (this.animationFrameId || !this.hasRevealed) return; // Already running or not revealed

    const scroll = () => {
      if (!this.isPaused && this.container && this.hasRevealed) {
        const maxScroll = this.container.scrollWidth - this.container.clientWidth;
        const currentScroll = this.container.scrollLeft;

        // Smooth horizontal scroll
        this.container.scrollLeft += this.scrollSpeed * this.scrollDirection;

        // Reverse direction at boundaries with smooth transition
        if (currentScroll >= maxScroll - 10 && this.scrollDirection === 1) {
          this.scrollDirection = -1; // Scroll left
        } else if (currentScroll <= 10 && this.scrollDirection === -1) {
          this.scrollDirection = 1; // Scroll right
        }
      }

      this.animationFrameId = requestAnimationFrame(scroll);
    };

    this.animationFrameId = requestAnimationFrame(scroll);
  }

  stopAutoScroll() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  resetPauseTimer() {
    // Clear existing timer
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
    }

    // Resume auto-scroll after 3 seconds of no interaction
    this.pauseTimer = setTimeout(() => {
      this.isPaused = false;
    }, 3000);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new BentoGrid();
  });
} else {
  new BentoGrid();
}

// Export for use in other modules if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BentoGrid;
}
