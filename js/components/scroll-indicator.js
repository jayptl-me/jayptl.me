/**
 * Scroll Indicator Component
 * Shows page scroll progress with a progress bar
 * 
 * @file components/scroll-indicator.js
 * @author Jay Patel
 */

class ScrollIndicator {
    constructor() {
        this.progressBar = document.querySelector('.progress-bar');
        this.lastScrollDepth = 0;
        this.scrollDepthThresholds = [25, 50, 75, 100];
        this.trackedDepths = new Set();
        
        this.init();
    }
    
    init() {
        if (!this.progressBar) {
            console.warn('ScrollIndicator: Progress bar element not found');
            return;
        }
        
        this.setupEventListeners();
        this.updateProgress(); // Initial update
        
        console.log('ScrollIndicator initialized');
    }
    
    setupEventListeners() {
        // Throttled scroll event
        let scrollTimeout;
        const handleScroll = () => {
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }
            
            scrollTimeout = setTimeout(() => {
                this.updateProgress();
                this.trackScrollDepth();
            }, 16); // ~60fps
        };
        
        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', () => this.updateProgress(), { passive: true });
    }
    
    updateProgress() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollProgress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
        
        // Clamp between 0 and 100
        const clampedProgress = Math.min(Math.max(scrollProgress, 0), 100);
        
        // Update progress bar
        this.progressBar.style.width = `${clampedProgress}%`;
        
        // Update aria label for accessibility
        this.progressBar.setAttribute('aria-label', `Page scroll progress: ${Math.round(clampedProgress)}%`);
        
        return clampedProgress;
    }
    
    trackScrollDepth() {
        const currentDepth = this.updateProgress();
        
        // Track scroll depth milestones for analytics
        this.scrollDepthThresholds.forEach(threshold => {
            if (currentDepth >= threshold && !this.trackedDepths.has(threshold)) {
                this.trackedDepths.add(threshold);
                
                // Track analytics event
                if (typeof AnalyticsHelper !== 'undefined') {
                    AnalyticsHelper.trackScrollDepth(threshold);
                }
                
                console.log(`Scroll depth milestone reached: ${threshold}%`);
            }
        });
    }
    
    // Public methods
    getScrollProgress() {
        return this.updateProgress();
    }
    
    resetTrackedDepths() {
        this.trackedDepths.clear();
    }
    
    // Cleanup method
    destroy() {
        window.removeEventListener('scroll', this.handleScroll);
        window.removeEventListener('resize', this.updateProgress);
        console.log('ScrollIndicator destroyed');
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.scrollIndicator = new ScrollIndicator();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScrollIndicator;
}
