/**
 * Performance Enhancement Script
 * Handles progressive loading of non-critical resources
 */

// Function to load CSS asynchronously
function loadCSS(href) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
    return link;
}

// Load non-critical CSS after page load
window.addEventListener('load', function() {
    // Add a small delay to prioritize other critical resources
    setTimeout(() => {
        // Any additional CSS that wasn't preloaded can be loaded here
        // Currently all CSS is being loaded via the preload mechanism
    }, 100);
});

// Enhance scroll performance
if (window.requestIdleCallback) {
    requestIdleCallback(() => {
        // Initialize scroll performance optimizations when browser is idle
        if ('IntersectionObserver' in window) {
            // Enhanced intersection observer setup can go here
        }
    });
}
