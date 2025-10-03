/**
 * Bento Grid Component
 * Handles auto-scrolling animation for bento grid
 * 
 * @file components/bento-grid.js
 * @author Jay Patel
 */

class BentoGrid {
  constructor() {
    this.container = document.querySelector('.bento-grid-scroll-container');
    this.scrollSpeed = 1; // pixels per frame
    this.isHovering = false;
    this.isPaused = false;
    this.scrollDirection = 1; // 1 for down, -1 for up
    this.animationFrameId = null;
    
    if (this.container) {
      this.init();
    }
  }

  init() {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReducedMotion) {
      console.log('Reduced motion preferred, auto-scroll disabled');
      return;
    }

    // Pause on hover
    this.container.addEventListener('mouseenter', () => {
      this.isHovering = true;
    });

    this.container.addEventListener('mouseleave', () => {
      this.isHovering = false;
    });

    // Pause on user scroll
    this.container.addEventListener('wheel', () => {
      this.isPaused = true;
      this.resetPauseTimer();
    });

    // Pause on touch
    this.container.addEventListener('touchstart', () => {
      this.isPaused = true;
      this.resetPauseTimer();
    });

    // Start auto-scroll
    this.startAutoScroll();

    // Handle intersection observer for performance
    this.setupIntersectionObserver();
  }

  setupIntersectionObserver() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
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

    observer.observe(this.container);
  }

  startAutoScroll() {
    if (this.animationFrameId) return; // Already running

    const scroll = () => {
      if (!this.isHovering && !this.isPaused && this.container) {
        const maxScroll = this.container.scrollHeight - this.container.clientHeight;
        const currentScroll = this.container.scrollTop;

        // Smooth scroll
        this.container.scrollTop += this.scrollSpeed * this.scrollDirection;

        // Reverse direction at boundaries
        if (currentScroll >= maxScroll - 10) {
          this.scrollDirection = -1; // Scroll up
        } else if (currentScroll <= 10) {
          this.scrollDirection = 1; // Scroll down
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
