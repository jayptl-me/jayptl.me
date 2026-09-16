/**
 * Custom Cursor Component (perf revision A: compositor-only, idle-gated)
 * Interactive cursor with transform-only positioning — no layout per frame,
 * no backdrop-filter / blend repaint, paused when idle or tab hidden.
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
        this.ease = 0.2;
        this.followerEase = 0.12;

        // State tracking
        this.isHovering = false;
        this.isClicking = false;
        this.isTextMode = false;

        // Loop / idle management (perf: never run rAF when nothing moves)
        this.rafId = 0;
        this.loopRunning = false;
        this._idleTimer = null;
        this._firstMoveArmed = false;

        this.init();
    }

    init() {
        // Mobile / touch: keep native cursor (parity with existing CSS media query)
        if (this.isTouch) {
            return;
        }
        // Coarse pointers: no custom cursor
        try {
            if (window.matchMedia && !window.matchMedia('(pointer: fine)').matches) {
                return;
            }
            // Reduced motion: skip decorative cursor loop entirely
            if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                return;
            }
        } catch (e) { /* conservative: continue */ }

        // Defer creation out of the initial TBT window: idle or first mousemove
        const start = () => {
            if (this.cursor) return; // already started
            this.createCursorElements();
            this.setupEventListeners();
            this.setCursorVars(window.innerWidth / 2, window.innerHeight / 2);
            this.currentX = this.targetX = window.innerWidth / 2;
            this.currentY = this.targetY = window.innerHeight / 2;
            this.followerX = this.targetX;
            this.followerY = this.targetY;
        };

        // If the user never moves a mouse (keyboard-only / Lighthouse desktop
        // without input), never start the loop at all.
        this._firstMoveArmed = true;
        const onFirstMove = (e) => {
            this.targetX = e.clientX;
            this.targetY = e.clientY;
            if (this._idleCallback) {
                try { cancelIdleCallback(this._idleCallback); } catch (err) { /* noop */ }
                this._idleCallback = null;
            }
            start();
            this.kick();
            window.removeEventListener('mousemove', onFirstMove);
            this._firstMoveArmed = false;
        };
        window.addEventListener('mousemove', onFirstMove, { passive: true });

        // Idle fallback: create elements (but NOT the loop) so hover states are
        // ready, without burning main-thread during load.
        const scheduleIdle = (fn) => {
            if ('requestIdleCallback' in window) {
                return window.requestIdleCallback(fn, { timeout: 2500 });
            }
            return setTimeout(() => fn({ didTimeout: true }), 1800);
        };
        this._idleCallback = scheduleIdle(() => {
            this._idleCallback = null;
            // Only pre-create if a mouse is actually present; otherwise stay dormant.
            if (this._firstMoveArmed) return;
            start();
        });
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
    }

    // Compositor-only positioning: CSS vars consumed by a single transform.
    // Never touches left/top/width/height per frame (those force layout).
    setCursorVars(x, y) {
        if (this.cursor) {
            this.cursor.style.setProperty('--cx', x.toFixed(1) + 'px');
            this.cursor.style.setProperty('--cy', y.toFixed(1) + 'px');
        }
    }

    setFollowerVars(x, y) {
        if (this.follower) {
            this.follower.style.setProperty('--cx', x.toFixed(1) + 'px');
            this.follower.style.setProperty('--cy', y.toFixed(1) + 'px');
        }
    }

    setupEventListeners() {
        // Mouse movement: record target only, wake loop. Passive, no layout reads.
        this._moveHandler = (e) => {
            this.targetX = e.clientX;
            this.targetY = e.clientY;
            this.kick();
        };
        document.addEventListener('mousemove', this._moveHandler, { passive: true });

        // Hover: single throttled mouseover (rAF-flag) instead of capture-phase
        // mouseenter/mouseleave on document which fires for every element.
        this._hoverTicking = false;
        this._hoverHandler = (e) => {
            if (this._hoverTicking) return;
            this._hoverTicking = true;
            const t = e.target;
            window.requestAnimationFrame(() => {
                this._hoverTicking = false;
                if (!(t instanceof Element) || !document.contains(t)) {
                    this.setHoverState(false);
                    this.setTextState(false);
                    return;
                }
                // One closest() pass for both states (no layout reads).
                const interactive = t.closest
                    ? t.closest('a, button, [role="button"], .clickable, input[type="button"], input[type="submit"], .btn, .consent-btn, .consent-dialog-btn, .consent-settings-toggle, .consent-settings-dialog-close')
                    : null;
                if (interactive) {
                    this.setHoverState(true);
                    this.setTextState(false);
                    return;
                }
                const text = t.closest
                    ? t.closest('input[type="text"], input[type="email"], input[type="password"], textarea, [contenteditable]')
                    : null;
                if (text) {
                    this.setHoverState(false);
                    this.setTextState(true);
                    return;
                }
                this.setHoverState(false);
                this.setTextState(false);
            });
        };
        document.addEventListener('mouseover', this._hoverHandler, { passive: true });

        // Mouse down/up
        this._downHandler = () => this.setClickState(true);
        this._upHandler = () => this.setClickState(false);
        document.addEventListener('mousedown', this._downHandler, { passive: true });
        document.addEventListener('mouseup', this._upHandler, { passive: true });

        // Click ripple: capped to a single live node, transform/opacity animated.
        this._clickHandler = (e) => this.createRippleEffect(e.clientX, e.clientY);
        document.addEventListener('click', this._clickHandler, { passive: true });

        // Focus events for keyboard navigation (toggle text mode when inputs gain/lose focus)
        this._focusInHandler = (e) => {
            if (this.isTextElement(e.target)) {
                this.setTextState(true);
            }
        };

        this._focusOutHandler = (e) => {
            if (this.isTextElement(e.target)) {
                this.setTextState(false);
            }
        };

        document.addEventListener('focusin', this._focusInHandler);
        document.addEventListener('focusout', this._focusOutHandler);

        // Pause loop when tab hidden / window blurred (Lighthouse "Other" time).
        this._visHandler = () => {
            if (document.hidden) this.stopLoop();
            else this.kick();
        };
        this._blurHandler = () => this.stopLoop();
        document.addEventListener('visibilitychange', this._visHandler);
        window.addEventListener('blur', this._blurHandler);

        window.addEventListener('resize', this.handleResize.bind(this), { passive: true });
    }

    isInteractiveElement(element) {
        // Check if element is interactive, guard against non-Elements and walk up DOM
        if (!(element instanceof Element)) return false;
        const selector = 'a, button, [role="button"], .clickable, input[type="button"], input[type="submit"], .btn, .consent-btn, .consent-dialog-btn, .consent-settings-toggle, .consent-settings-dialog-close';
        return !!element.closest(selector);
    }

    isTextElement(element) {
        if (!(element instanceof Element)) return false;
        const selector = 'input[type="text"], input[type="email"], input[type="password"], textarea, [contenteditable]';
        return !!element.closest(selector);
    }

    handleResize() {
        // Update cursor position on resize
        if (!this.isVisible) {
            this.currentX = this.targetX = window.innerWidth / 2;
            this.currentY = this.targetY = window.innerHeight / 2;
            this.followerX = this.targetX;
            this.followerY = this.targetY;
            this.setCursorVars(this.currentX, this.currentY);
            this.setFollowerVars(this.followerX, this.followerY);
        }
    }

    setHoverState(isHovering) {
        if (this.isHovering === isHovering) return;
        this.isHovering = isHovering;
        this.updateCursorClasses();
    }

    setClickState(isClicking) {
        if (this.isClicking === isClicking) return;
        this.isClicking = isClicking;
        this.updateCursorClasses();
    }

    setTextState(isTextMode) {
        if (this.isTextMode === isTextMode) return;
        this.isTextMode = isTextMode;
        this.updateCursorClasses();
    }

    setVisibility(isVisible) {
        if (this.isVisible === isVisible) return;
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
        if (!this.cursor || document.hidden) return;
        // Cap: reuse single ripple node instead of unbounded DOM churn.
        if (!this._ripple) {
            this._ripple = document.createElement('div');
            this._ripple.className = 'cursor-ripple';
            this._ripple.setAttribute('aria-hidden', 'true');
        }
        const ripple = this._ripple;
        if (!ripple.isConnected) document.body.appendChild(ripple);
        ripple.style.setProperty('--cx', x + 'px');
        ripple.style.setProperty('--cy', y + 'px');
        // Restart a transform/opacity-only animation (no layout).
        ripple.classList.remove('play');
        void ripple.offsetWidth; // single read on a detached-from-layout fixed node; no thrash loop
        ripple.classList.add('play');
        clearTimeout(this._rippleTimer);
        this._rippleTimer = setTimeout(() => {
            if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
        }, 650);
    }

    // Wake the loop; auto-sleeps after convergence + 1.2s idle grace.
    kick() {
        if (!this.cursor || document.hidden) return;
        if (this.loopRunning) {
            this.pokeIdle();
            return;
        }
        this.startAnimationLoop();
        this.pokeIdle();
    }

    pokeIdle() {
        clearTimeout(this._idleTimer);
        this._idleTimer = setTimeout(() => this.stopLoop(), 1200);
    }

    startAnimationLoop() {
        if (this.loopRunning) return;
        this.loopRunning = true;
        const animate = () => {
            if (!this.loopRunning) {
                this.rafId = 0;
                return;
            }
            // Smooth cursor movement
            this.currentX += (this.targetX - this.currentX) * this.ease;
            this.currentY += (this.targetY - this.currentY) * this.ease;

            // Smooth follower movement (slower)
            this.followerX += (this.targetX - this.followerX) * this.followerEase;
            this.followerY += (this.targetY - this.followerY) * this.followerEase;

            this.setCursorVars(this.currentX, this.currentY);
            this.setFollowerVars(this.followerX, this.followerY);

            // Sleep when converged (sub-pixel) — kills the infinite-loop TBT cost.
            const dx = Math.abs(this.targetX - this.currentX);
            const dy = Math.abs(this.targetY - this.currentY);
            const fdx = Math.abs(this.targetX - this.followerX);
            const fdy = Math.abs(this.targetY - this.followerY);
            if (dx < 0.1 && dy < 0.1 && fdx < 0.3 && fdy < 0.3) {
                // Snap to exact target to avoid drift, then idle out via pokeIdle().
                this.setCursorVars(this.targetX, this.targetY);
                this.setFollowerVars(this.targetX, this.targetY);
                this.currentX = this.targetX;
                this.currentY = this.targetY;
                this.followerX = this.targetX;
                this.followerY = this.targetY;
            }

            this.rafId = requestAnimationFrame(animate);
        };

        this.rafId = requestAnimationFrame(animate);
    }

    stopLoop() {
        this.loopRunning = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = 0;
        }
        clearTimeout(this._idleTimer);
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
        this.stopLoop();
        clearTimeout(this._idleTimer);
        clearTimeout(this._rippleTimer);
        if (this._idleCallback) {
            try {
                if ('cancelIdleCallback' in window) cancelIdleCallback(this._idleCallback);
                else clearTimeout(this._idleCallback);
            } catch (e) { /* noop */ }
            this._idleCallback = null;
        }
        // Remove event listeners
        if (this._moveHandler) document.removeEventListener('mousemove', this._moveHandler);
        if (this._hoverHandler) document.removeEventListener('mouseover', this._hoverHandler);
        if (this._downHandler) document.removeEventListener('mousedown', this._downHandler);
        if (this._upHandler) document.removeEventListener('mouseup', this._upHandler);
        if (this._clickHandler) document.removeEventListener('click', this._clickHandler);
        if (this._focusInHandler) document.removeEventListener('focusin', this._focusInHandler);
        if (this._focusOutHandler) document.removeEventListener('focusout', this._focusOutHandler);
        if (this._visHandler) document.removeEventListener('visibilitychange', this._visHandler);
        if (this._blurHandler) window.removeEventListener('blur', this._blurHandler);

        // Remove cursor elements
        if (this.cursor) {
            this.cursor.remove();
            this.cursor = null;
        }
        if (this.follower) {
            this.follower.remove();
            this.follower = null;
        }
        if (this._ripple && this._ripple.parentNode) {
            this._ripple.parentNode.removeChild(this._ripple);
            this._ripple = null;
        }
    }
}

// Auto-initialize when DOM is ready (gated: fine pointer, no touch, no reduced motion)
document.addEventListener('DOMContentLoaded', () => {
    let ok = true;
    try {
        if (('ontouchstart' in window) || navigator.maxTouchPoints > 0) ok = false;
        else if (window.matchMedia && !window.matchMedia('(pointer: fine)').matches) ok = false;
        else if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ok = false;
    } catch (e) { /* default to init */ }
    if (!ok) return;
    window.customCursor = new CustomCursor();

    // Optional: Expose cursor control to global scope
    window.setCursorState = (state) => {
        if (window.customCursor) {
            window.customCursor.setState(state);
        }
    };
});
