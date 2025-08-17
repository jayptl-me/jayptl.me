/**
 * Custom Cursor Component
 * Interactive glassmorphic cursor with smooth animations
 * 
 * @file js/components/custom-cursor.js
 * @author Jay Patel
 */

class CustomCursor {
    constructor() {
        this.cursor = null;
        this.follower = null;
        this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.isVisible = true;
        this.currentX = 0;
        this.currentY = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.followerX = 0;
        this.followerY = 0;

        // Animation settings
        this.ease = 0.15;
        this.followerEase = 0.08;

        // State tracking
        this.isHovering = false;
        this.isClicking = false;
        this.isTextMode = false;

        this.init();
    }

    init() {
        if (this.isTouch) {
            return; // Don't initialize on touch devices
        }

        this.createCursorElements();
        this.setupEventListeners();
        this.startAnimationLoop();
    }

    createCursorElements() {
        // Create main cursor
        this.cursor = document.createElement('div');
        this.cursor.className = 'custom-cursor';
        this.cursor.setAttribute('aria-hidden', 'true');
        document.body.appendChild(this.cursor);

        // Create follower cursor
        this.follower = document.createElement('div');
        this.follower.className = 'cursor-follower';
        this.follower.setAttribute('aria-hidden', 'true');
        document.body.appendChild(this.follower);

        // Set initial position
        this.updateCursorPosition(window.innerWidth / 2, window.innerHeight / 2);
    }

    setupEventListeners() {
        // Mouse movement
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));

        // Mouse enter/leave
        document.addEventListener('mouseenter', this.handleMouseEnter.bind(this));
        document.addEventListener('mouseleave', this.handleMouseLeave.bind(this));

        // Document-wide mouseleave for safety
        document.addEventListener('mouseleave', () => {
            this.setHoverState(false);
            this.setTextState(false);
        });

        // Mouse down/up
        document.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));

        // Click events for ripple effect
        document.addEventListener('click', this.handleClick.bind(this));

        // Hover events for interactive elements
        this.setupHoverEvents();

        // Text input events
        this.setupTextEvents();

        // DOM mutation observer for cleanup
        this.setupMutationObserver();

        // Window events
        window.addEventListener('resize', this.handleResize.bind(this));
        window.addEventListener('scroll', this.handleScroll.bind(this));
    }

    setupHoverEvents() {
        // Use event delegation for better dynamic content support
        document.addEventListener('mouseenter', this.handleElementHover.bind(this), true);
        document.addEventListener('mouseleave', this.handleElementHover.bind(this), true);
    }

    handleElementHover(e) {
        const element = e.target;
        const isEntering = e.type === 'mouseenter';

        // Safety check: ensure element still exists in DOM
        if (!element || !document.contains(element)) {
            this.setHoverState(false);
            this.setTextState(false);
            return;
        }

        // Check if element is interactive
        if (this.isInteractiveElement(element)) {
            this.setHoverState(isEntering);
        }
        // Check if element is a text input
        else if (this.isTextElement(element)) {
            this.setTextState(isEntering);
        }
        // If leaving an element and not entering a new interactive one, reset state
        else if (!isEntering) {
            this.setHoverState(false);
            this.setTextState(false);
        }
    }

    isInteractiveElement(element) {
        // Check if element is interactive, guard against non-Elements and walk up DOM
        if (!(element instanceof Element)) return false;
        const selector = 'a, button, [role="button"], .clickable, input[type="button"], input[type="submit"], .btn, .consent-btn, .consent-dialog-btn, .consent-settings-toggle, .consent-settings-dialog-close';
        return !!element.closest(selector);
    }

    setupTextEvents() {
        // Text events are now handled in setupHoverEvents for better integration
    }

    handleTextElementMouseEnter(e) {
        // Removed - now handled in handleElementHover
    }

    handleTextElementMouseLeave(e) {
        // Removed - now handled in handleElementHover
    }

    isTextElement(element) {
        if (!(element instanceof Element)) return false;
        const selector = 'input[type="text"], input[type="email"], input[type="password"], textarea, [contenteditable]';
        return !!element.closest(selector);
    }

    handleMouseMove(e) {
        this.targetX = e.clientX;
        this.targetY = e.clientY;
    }

    handleMouseEnter() {
        this.setVisibility(true);
    }

    handleMouseLeave() {
        this.setVisibility(false);
    }

    handleMouseDown() {
        this.setClickState(true);
    }

    handleMouseUp() {
        this.setClickState(false);
    }

    handleClick(e) {
        this.createRippleEffect(e.clientX, e.clientY);
    }

    handleResize() {
        // Update cursor position on resize
        if (!this.isVisible) {
            this.updateCursorPosition(window.innerWidth / 2, window.innerHeight / 2);
        }
    }

    handleScroll() {
        // Optional: Add scroll-based effects here
    }

    setHoverState(isHovering) {
        this.isHovering = isHovering;
        this.updateCursorClasses();
    }

    setClickState(isClicking) {
        this.isClicking = isClicking;
        this.updateCursorClasses();
    }

    setTextState(isTextMode) {
        this.isTextMode = isTextMode;
        this.updateCursorClasses();
    }

    setVisibility(isVisible) {
        this.isVisible = isVisible;
        this.updateCursorClasses();
    }

    updateCursorClasses() {
        if (!this.cursor || !this.follower) return;

        // Reset classes
        this.cursor.className = 'custom-cursor';
        this.follower.className = 'cursor-follower';

        // Add state classes
        if (!this.isVisible) {
            this.cursor.classList.add('hidden');
            this.follower.classList.add('hidden');
        } else {
            if (this.isTextMode) {
                this.cursor.classList.add('text');
                this.follower.classList.add('text');
            } else if (this.isClicking) {
                this.cursor.classList.add('click');
                this.follower.classList.add('click');
            } else if (this.isHovering) {
                this.cursor.classList.add('hover');
                this.follower.classList.add('hover');
            }
        }
    }

    createRippleEffect(x, y) {
        const ripple = document.createElement('div');
        ripple.className = 'cursor-ripple';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        document.body.appendChild(ripple);

        // Remove ripple after animation
        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 600);
    }

    startAnimationLoop() {
        const animate = () => {
            // Smooth cursor movement
            this.currentX += (this.targetX - this.currentX) * this.ease;
            this.currentY += (this.targetY - this.currentY) * this.ease;

            // Smooth follower movement (slower)
            this.followerX += (this.targetX - this.followerX) * this.followerEase;
            this.followerY += (this.targetY - this.followerY) * this.followerEase;

            this.updateCursorPosition(this.currentX, this.currentY);
            this.updateFollowerPosition(this.followerX, this.followerY);

            requestAnimationFrame(animate);
        };

        animate();
    }

    updateCursorPosition(x, y) {
        if (this.cursor) {
            this.cursor.style.left = x + 'px';
            this.cursor.style.top = y + 'px';
        }
    }

    updateFollowerPosition(x, y) {
        if (this.follower) {
            this.follower.style.left = x + 'px';
            this.follower.style.top = y + 'px';
        }
    }

    setupMutationObserver() {
        // Create observer to watch for DOM changes
        this.mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    // Check if any removed nodes were interactive elements we were hovering
                    mutation.removedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // If an interactive element or dialog is removed, reset cursor state
                            if (this.isInteractiveElement && this.isInteractiveElement(node) ||
                                node.classList?.contains('consent-settings-dialog') ||
                                node.querySelector?.('.consent-settings-dialog-close')) {
                                this.setHoverState(false);
                                this.setTextState(false);
                            }
                        }
                    });
                }
            });
        });

        // Start observing
        this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Public methods for external control
    hide() {
        this.setVisibility(false);
    }

    show() {
        this.setVisibility(true);
    }

    setState(state) {
        // Reset all states
        this.isHovering = false;
        this.isClicking = false;
        this.isTextMode = false;

        // Set new state
        switch (state) {
            case 'hover':
                this.isHovering = true;
                break;
            case 'click':
                this.isClicking = true;
                break;
            case 'text':
                this.isTextMode = true;
                break;
            case 'loading':
                this.cursor?.classList.add('loading');
                break;
            case 'disabled':
                this.cursor?.classList.add('disabled');
                break;
            case 'error':
                this.cursor?.classList.add('error');
                break;
            case 'success':
                this.cursor?.classList.add('success');
                break;
        }

        this.updateCursorClasses();
    }

    destroy() {
        // Remove event listeners
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseenter', this.handleMouseEnter);
        document.removeEventListener('mouseleave', this.handleMouseLeave);
        document.removeEventListener('mousedown', this.handleMouseDown);
        document.removeEventListener('mouseup', this.handleMouseUp);
        document.removeEventListener('click', this.handleClick);

        // Disconnect mutation observer
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }

        // Remove cursor elements
        if (this.cursor) {
            this.cursor.remove();
        }
        if (this.follower) {
            this.follower.remove();
        }
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if not on touch device
    if (!('ontouchstart' in window) && !navigator.maxTouchPoints) {
        window.customCursor = new CustomCursor();

        // Optional: Expose cursor control to global scope
        window.setCursorState = (state) => {
            if (window.customCursor) {
                window.customCursor.setState(state);
            }
        };
    }
});
