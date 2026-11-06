/**
 * Press State for the pill family (css/components/buttons.css).
 *
 * One delegated set of listeners gives every .pill-btn on the page, and
 * every pill that arrives with a router swap, the full state set:
 * - pressed and held: .is-pressed while a pointer or Space/Enter is down;
 * - cancel: sliding more than 8px off the pill, a pointercancel, or Escape
 *   during a press releases it and the click never fires;
 * - hold to confirm: pills with data-hold-confirm fire only after a 600ms
 *   hold (pointer or Space/Enter); letting go early cancels, a ring fills
 *   while holding. Listeners receive a normal click;
 * - busy: PillPress.busy(el, promise) locks the width, sets aria-busy and
 *   runs Ink Status, then settles to success or error for 1.6s.
 *
 * - squish: every pressable thing squashes on press, sized by what it is
 *   (section 6e; see the Squish block at the end of this file).
 * - gel: the squishy controls get the painted gel's layers and its press
 *   state (D-103; see the Gel block at the end of this file).
 *
 * Brief (docs/motion-zen.md sections 6b and 6e). Reduced motion is handled
 * in CSS for the pill states and here for the squish.
 *
 * @file js/components/press-state.js
 */
(function () {
    'use strict';

    if (window.PillPress) return;

    var HOLD_MS = 600;
    var SETTLE_MS = 1600;
    var SLOP = 8;
    var NS = 'http://www.w3.org/2000/svg';

    var active = null;   // { el, pointerId, hold, confirmed }
    var suppress = null; // element whose next click is swallowed

    function pillOf(target) {
        return target && target.closest ? target.closest('.pill-btn') : null;
    }

    function inert(el) {
        return el.disabled || el.getAttribute('aria-disabled') === 'true' || el.getAttribute('aria-busy') === 'true';
    }

    function ring(el) {
        var svg = el.querySelector(':scope > .pill-hold');
        if (svg) return svg;
        svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class', 'pill-hold');
        svg.setAttribute('viewBox', '0 0 100 40');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.setAttribute('aria-hidden', 'true');
        var r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', '1');
        r.setAttribute('y', '1');
        r.setAttribute('width', '98');
        r.setAttribute('height', '38');
        r.setAttribute('rx', '19');
        r.setAttribute('pathLength', '1');
        svg.appendChild(r);
        el.appendChild(svg);
        return svg;
    }

    function start(el, pointerId) {
        el.classList.add('is-press-managed', 'is-pressed');
        active = { el: el, pointerId: pointerId, hold: null, confirmed: false };
        if (el.hasAttribute('data-hold-confirm')) {
            ring(el);
            // Two frames so the ring's transition starts from empty.
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    if (active && active.el === el) el.classList.add('is-holding');
                });
            });
            active.hold = setTimeout(function () {
                if (!active || active.el !== el) return;
                active.confirmed = true;
                active.hold = null;
                el.classList.remove('is-holding', 'is-pressed');
                el.setAttribute('data-hold-done', '');
                el.click();
            }, HOLD_MS);
        }
    }

    function cancel() {
        if (!active) return;
        var el = active.el;
        if (active.hold) clearTimeout(active.hold);
        el.classList.remove('is-pressed', 'is-holding');
        suppress = el;
        active = null;
    }

    function release() {
        if (!active) return;
        var el = active.el;
        el.classList.remove('is-pressed', 'is-holding');
        if (active.hold) {
            // Let go before the hold completed: nothing fires.
            clearTimeout(active.hold);
            suppress = el;
        } else if (active.confirmed) {
            // The confirmed click already fired; swallow the native one.
            suppress = el;
        }
        active = null;
    }

    document.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        var el = pillOf(e.target);
        if (!el || inert(el)) return;
        suppress = null;
        start(el, e.pointerId);
    }, true);

    document.addEventListener('pointermove', function (e) {
        if (!active || e.pointerId !== active.pointerId) return;
        var r = active.el.getBoundingClientRect();
        if (e.clientX < r.left - SLOP || e.clientX > r.right + SLOP || e.clientY < r.top - SLOP || e.clientY > r.bottom + SLOP) {
            cancel();
        }
    }, true);

    document.addEventListener('pointerup', function (e) {
        if (active && e.pointerId === active.pointerId) release();
    }, true);

    document.addEventListener('pointercancel', function () { cancel(); }, true);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && active) {
            cancel();
            return;
        }
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            var el = pillOf(document.activeElement);
            if (!el || inert(el) || active) return;
            suppress = null;
            start(el, 'key');
        }
    }, true);

    document.addEventListener('keyup', function (e) {
        if ((e.key === ' ' || e.key === 'Enter') && active && active.pointerId === 'key') release();
    }, true);

    // Enter fires click on keydown for links and buttons, before a hold can
    // complete; hold-to-confirm pills only accept the confirmed click.
    document.addEventListener('click', function (e) {
        var el = pillOf(e.target);
        if (!el) return;
        if (el.hasAttribute('data-hold-done')) {
            el.removeAttribute('data-hold-done');
            return;
        }
        if (suppress === el || el.hasAttribute('data-hold-confirm') || inert(el)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            suppress = null;
        }
    }, true);

    /**
     * Run a promise with the busy state: width locked (no layout shift),
     * aria-busy, Ink Status in the icon slot, then success or error for
     * 1.6s. Returns the promise's own result.
     */
    function busy(el, promise, messages) {
        if (!el) return promise;
        var ink = el.querySelector(':scope > .ink-status');
        if (!ink && window.InkStatus) {
            ink = window.InkStatus.make();
            el.insertBefore(ink, el.firstChild);
        }
        el.style.width = el.getBoundingClientRect().width + 'px';
        el.classList.remove('is-ok', 'is-bad');
        el.setAttribute('aria-busy', 'true');
        if (window.InkStatus) window.InkStatus.set(ink, 'loading');
        var msgs = messages || {};
        if (msgs.loading && window.InkStatus) window.InkStatus.say(msgs.loading);

        function settle(ok) {
            el.removeAttribute('aria-busy');
            el.classList.add(ok ? 'is-ok' : 'is-bad');
            if (window.InkStatus) {
                window.InkStatus.set(ink, ok ? 'ok' : 'bad');
                var text = ok ? msgs.ok : msgs.bad;
                if (text) window.InkStatus.say(text);
            }
            clearTimeout(el._pillSettle);
            el._pillSettle = setTimeout(function () {
                el.classList.remove('is-ok', 'is-bad');
                if (window.InkStatus) window.InkStatus.set(ink, 'idle');
                el.style.width = '';
            }, SETTLE_MS + 560);
        }

        return Promise.resolve(promise).then(function (v) { settle(true); return v; },
            function (err) { settle(false); throw err; });
    }

    /** Show success or error on a pill without a promise (copy email). */
    function flash(el, ok, message) {
        return busy(el, ok ? Promise.resolve() : Promise.reject(new Error('failed')), ok ? { ok: message } : { bad: message })
            .catch(function () { /* already shown */ });
    }

    window.PillPress = { busy: busy, flash: flash, HOLD_MS: HOLD_MS };

    /* ---- Squish (docs/motion-zen.md section 6e) --------------------------
     * Every pressable thing squashes on press down and comes back on
     * release, sized by what it is (Jay, 2026-11-05):
     * - squishy: floats free, short side 64px or less, 8px or more from its
     *   neighbour. Squash by a fixed 2px on the short axis, wider by up to
     *   1.5px a side, then spring back (4.8% past rest, about 353ms).
     * - firm: everything bigger or crowded. Sinks evenly, at most 3%, by
     *   3px on its height, with no overshoot.
     * Rows, docked bars and text links are solid and never listed here.
     * The scale property stacks with each element's own transform, and a
     * new press starts from wherever the last one is (interruptible).
     * Keyboard presses squash too. Reduced motion: no squash at all.
     */
    var SQUISHY = '.pill-btn, .theme-toggle, .audio-toggle, .work-deck-pill, .scroll-stack-pill, ' +
        '.day-pill, .slot-pill, .mobile-all-projects, .mobile-social-pill';
    var FIRM = '.case-card[data-linked], .resume-track, .mobile-card, .card-interactive, ' +
        '.card-default, .card-elevated, .card-glass, .card-accent, .dropdown-card, .work-card, ' +
        '.project-card, .feature-card';
    // Only things that do something press: a card that is just a box of
    // text stays still (a false affordance otherwise).
    var INTERACTIVE = 'a[href], button, summary, label, [role="button"], .card-interactive, [data-linked]';
    var PRESS_MS = 110;
    var FIRM_BACK_MS = 140;
    var TOUCH_DELAY = 90; // a finger may be starting a scroll: wait before squashing
    var SQUISH_SLOP = 8;
    var root = document.documentElement;

    // A damped spring sampled into CSS linear():
    // x(t) = 1 - e^(-z*w*t) * (cos(wd*t) + (z*w/wd) * sin(wd*t))
    function springCurve(stiffness, damping, mass, points) {
        var w = Math.sqrt(stiffness / mass);
        var z = damping / (2 * Math.sqrt(stiffness * mass));
        var wd = w * Math.sqrt(1 - z * z);
        var dur = 6 / (z * w);
        var out = [];
        for (var i = 0; i <= points; i++) {
            var t = (i / points) * dur;
            var x = 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
            out.push(Math.round(x * 1000) / 1000);
        }
        out[out.length - 1] = 1;
        return { easing: 'linear(' + out.join(', ') + ')', ms: Math.min(Math.round(dur * 1000), 360) };
    }

    function supports(prop, value) {
        try {
            return !!(window.CSS && window.CSS.supports && window.CSS.supports(prop, value));
        } catch (e) {
            return false;
        }
    }

    // Without the scale property or element animations, the old fixed press
    // scales stay as they are (squish.css only acts under html.squish-on).
    var canSquish = supports('scale', '1') && typeof window.HTMLElement.prototype.animate === 'function';

    var spring = { easing: 'cubic-bezier(0.16, 1, 0.3, 1)', ms: 200 };
    if (supports('transition-timing-function', 'linear(0, 1)')) spring = springCurve(600, 34, 1, 40);

    function reducedMotion() {
        try {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) {
            return false;
        }
    }

    // The box that sits among neighbours: the element itself, or the wrapper
    // it is the only child of (a pill inside its own list item).
    function spacer(el) {
        var node = el;
        for (var i = 0; i < 2; i++) {
            var p = node.parentElement;
            if (!p || p.children.length !== 1 || p === document.body) break;
            node = p;
        }
        return node;
    }

    function gapToNeighbours(el) {
        var node = spacer(el);
        var a = node.getBoundingClientRect();
        var gap = Infinity;
        [node.previousElementSibling, node.nextElementSibling].forEach(function (n) {
            if (!n) return;
            var b = n.getBoundingClientRect();
            if (!b.width && !b.height) return;
            var dx = Math.max(0, b.left - a.right, a.left - b.right);
            var dy = Math.max(0, b.top - a.bottom, a.top - b.bottom);
            gap = Math.min(gap, Math.max(dx, dy));
        });
        return gap;
    }

    // The scale to squash to, as { x, y, spring }.
    function squashFor(el, squishy) {
        var r = el.getBoundingClientRect();
        var w = r.width;
        var h = r.height;
        if (!w || !h) return null;
        if (squishy && Math.min(w, h) <= 64 && gapToNeighbours(el) >= 8) {
            var sy = 1 - 2 / h;
            return { x: Math.min(1 / sy, 1 + 3 / w), y: sy, spring: true };
        }
        var s = Math.max(0.97, 1 - 3 / h);
        return { x: s, y: s, spring: false };
    }

    function currentScale(el) {
        var v = getComputedStyle(el).scale;
        if (!v || v === 'none') return '1 1';
        var parts = v.split(' ');
        return parts.length === 1 ? v + ' ' + v : v;
    }

    function animateScale(el, to, ms, easing, done) {
        var from = currentScale(el);
        if (el._squish) el._squish.cancel();
        var anim = el.animate([{ scale: from }, { scale: to }], { duration: ms, easing: easing, fill: 'forwards' });
        el._squish = anim;
        if (done) {
            anim.onfinish = function () {
                if (el._squish === anim) {
                    anim.cancel();
                    el._squish = null;
                }
            };
        }
    }

    var squished = null; // { el, spring, src } where src is a pointerId or 'key'

    function squishDown(el, src) {
        if (reducedMotion() || inert(el)) return;
        var squishy = el.matches(SQUISHY);
        var to = squashFor(el, squishy);
        if (!to) return;
        if (squished && squished.el !== el) squishUp();
        squished = { el: el, spring: to.spring, src: src };
        animateScale(el, to.x + ' ' + to.y, PRESS_MS, 'ease-out', false);
    }

    function squishUp(src) {
        if (!squished || (src !== undefined && squished.src !== src)) return;
        var el = squished.el;
        var back = squished.spring;
        squished = null;
        animateScale(el, '1 1', back ? spring.ms : FIRM_BACK_MS,
            back ? spring.easing : 'cubic-bezier(0, 0, 0.2, 1)', true);
    }

    function pressable(target) {
        if (!target || !target.closest) return null;
        // A booking pill is the label after its radio input, and the keyboard
        // focus sits on the input.
        if (target.matches && target.matches('input') && target.nextElementSibling &&
            target.nextElementSibling.matches('.day-pill, .slot-pill')) {
            return target.nextElementSibling;
        }
        var el = target.closest(SQUISHY + ', ' + FIRM);
        if (!el || !el.matches(INTERACTIVE)) return null;
        // The talk chip is docked in the navbar: solid, whatever its pills are.
        if (el.closest('.talk-chip')) return null;
        return el;
    }

    if (canSquish) {
        root.classList.add('squish-on');

        document.addEventListener('pointerdown', function (e) {
            if (e.button !== 0 || e.isPrimary === false) return;
            var el = pressable(e.target);
            if (!el) return;
            var id = e.pointerId;
            var x0 = e.clientX;
            var y0 = e.clientY;
            var mouse = e.pointerType === 'mouse';
            var timer = null;
            function end() {
                clearTimeout(timer);
                window.removeEventListener('pointermove', move, true);
                window.removeEventListener('pointerup', up, true);
                window.removeEventListener('pointercancel', up, true);
                squishUp(id);
            }
            function up(ev) {
                if (ev.pointerId !== id) return;
                // A quick tap lifts before the touch delay: it still gets the
                // whole press, a squash and then the spring back.
                if (ev.type === 'pointerup' && timer !== null && !(squished && squished.el === el)) {
                    clearTimeout(timer);
                    timer = null;
                    squishDown(el, id);
                    setTimeout(function () { end(); }, PRESS_MS);
                    window.removeEventListener('pointermove', move, true);
                    window.removeEventListener('pointerup', up, true);
                    window.removeEventListener('pointercancel', up, true);
                    return;
                }
                end();
            }
            // Sliding off releases: a mouse that leaves the element (plus the
            // slop), a finger that moves past the slop (it is scrolling).
            function move(ev) {
                if (ev.pointerId !== id) return;
                if (mouse) {
                    var r = el.getBoundingClientRect();
                    if (ev.clientX < r.left - SQUISH_SLOP || ev.clientX > r.right + SQUISH_SLOP ||
                        ev.clientY < r.top - SQUISH_SLOP || ev.clientY > r.bottom + SQUISH_SLOP) end();
                } else if (Math.abs(ev.clientX - x0) > SQUISH_SLOP || Math.abs(ev.clientY - y0) > SQUISH_SLOP) {
                    end();
                }
            }
            window.addEventListener('pointermove', move, true);
            window.addEventListener('pointerup', up, true);
            window.addEventListener('pointercancel', up, true);
            if (mouse) squishDown(el, id);
            else timer = setTimeout(function () { timer = null; squishDown(el, id); }, TOUCH_DELAY);
        }, { capture: true, passive: true });

        document.addEventListener('keydown', function (e) {
            if ((e.key !== ' ' && e.key !== 'Enter') || e.repeat) return;
            var el = pressable(document.activeElement);
            if (el) squishDown(el, 'key');
        }, true);

        document.addEventListener('keyup', function (e) {
            if (e.key === ' ' || e.key === 'Enter') squishUp('key');
        }, true);
    }

    window.Squish = { squashFor: squashFor, spring: spring, SQUISHY: SQUISHY, FIRM: FIRM };

    /* ---- Gel (D-103, css/components/gel.css) ------------------------------
     * The squishy controls wear a painted gel: two empty layers, a shadow in
     * the gel's own colour and a tinted body with its highlight and caustic,
     * added here so no page markup changes. Filled and "on" controls are
     * filled gel, the rest clear gel. Controls with no body of their own stay
     * as they are: quiet text pills and the navbar's icon-only theme toggle.
     * The talk chip is solid and never gets one. Hosts get them on load,
     * after every router swap, and when a script builds them later (the
     * navbar, the sound toggle, the booking pills). The press moves transform and opacity only, settling with no
     * overshoot; the squash itself stays on the D-71 spring above. Reduced
     * motion: colour and shadow only (in the stylesheet).
     */
    var GEL_SKIP = '.pill-btn--quiet, .pill-btn:not(.pill-btn--filled):not(.pill-btn--outline), .glass-nav .theme-toggle';

    function gelCandidate(el) {
        return el.matches(SQUISHY) && el.matches(INTERACTIVE) && !el.matches(GEL_SKIP) && !el.closest('.talk-chip');
    }

    function gelLayer(name) {
        var span = document.createElement('span');
        span.className = name;
        span.setAttribute('aria-hidden', 'true');
        return span;
    }

    function gelInject(el) {
        el.classList.add('has-gel');
        // The deck and stack tabs are tiny: their highlight sits higher.
        if (el.matches('.work-deck-pill, .scroll-stack-pill')) el.classList.add('gel--tab');
        if (el.querySelector(':scope > .gel-body')) return false;
        var body = gelLayer('gel-body');
        el.insertBefore(body, el.firstChild);
        el.insertBefore(gelLayer('gel-shadow'), body);
        return true;
    }

    function gelScan(scope) {
        var hosts = (scope || document).querySelectorAll(SQUISHY);
        for (var i = 0; i < hosts.length; i++) {
            if (gelCandidate(hosts[i])) gelInject(hosts[i]);
        }
    }

    // The layers settle on a critically damped curve (stiffness 1730), so
    // colour, shadow and light never bounce.
    function criticalCurve(stiffness, points) {
        var w = Math.sqrt(stiffness);
        var dur = 7 / w;
        var out = [];
        for (var i = 0; i <= points; i++) {
            var t = (i / points) * dur;
            out.push(Math.round((1 - Math.exp(-w * t) * (1 + w * t)) * 10000) / 10000);
        }
        out[out.length - 1] = 1;
        return 'linear(' + out.join(', ') + ')';
    }

    if (supports('transition-timing-function', 'linear(0, 1)')) {
        root.style.setProperty('--gel-firm', criticalCurve(1730, 29));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { gelScan(document); });
    } else {
        gelScan(document);
    }
    window.addEventListener('page:ready', function () { gelScan(document); });

    if (typeof MutationObserver === 'function' && document.documentElement) {
        new MutationObserver(function (records) {
            for (var i = 0; i < records.length; i++) {
                var r = records[i];
                // A host whose children were replaced gets its layers back.
                if (r.target.nodeType === 1 && r.target.matches(SQUISHY) && gelCandidate(r.target)) gelInject(r.target);
                for (var j = 0; j < r.addedNodes.length; j++) {
                    var n = r.addedNodes[j];
                    if (n.nodeType !== 1) continue;
                    if (n.matches(SQUISHY) && gelCandidate(n)) gelInject(n);
                    if (n.firstElementChild) gelScan(n);
                }
            }
        }).observe(document.documentElement, { childList: true, subtree: true });
    }

    // The gel's own press state, for every gel host and also under reduced
    // motion (when the squash never runs): held while down, released on up,
    // by sliding off, Escape or losing the window.
    var gelHeld = null; // { el, id, timer }

    function gelHost(target) {
        var el = pressable(target);
        return el && el.classList.contains('has-gel') && !inert(el) ? el : null;
    }

    function gelUp() {
        if (!gelHeld) return;
        clearTimeout(gelHeld.timer);
        gelHeld.el.classList.remove('gel-held');
        gelHeld = null;
    }

    document.addEventListener('pointerdown', function (e) {
        if (e.button !== 0 || e.isPrimary === false) return;
        var el = gelHost(e.target);
        if (!el) return;
        gelUp();
        var held = { el: el, id: e.pointerId, x: e.clientX, y: e.clientY, mouse: e.pointerType === 'mouse', timer: null };
        gelHeld = held;
        if (held.mouse) el.classList.add('gel-held');
        else held.timer = setTimeout(function () { held.timer = null; el.classList.add('gel-held'); }, TOUCH_DELAY);
    }, { capture: true, passive: true });

    window.addEventListener('pointermove', function (e) {
        if (!gelHeld || e.pointerId !== gelHeld.id) return;
        if (gelHeld.mouse) {
            var r = gelHeld.el.getBoundingClientRect();
            if (e.clientX < r.left - SQUISH_SLOP || e.clientX > r.right + SQUISH_SLOP ||
                e.clientY < r.top - SQUISH_SLOP || e.clientY > r.bottom + SQUISH_SLOP) gelUp();
        } else if (Math.abs(e.clientX - gelHeld.x) > SQUISH_SLOP || Math.abs(e.clientY - gelHeld.y) > SQUISH_SLOP) {
            gelUp();
        }
    }, true);

    window.addEventListener('pointerup', function (e) {
        if (!gelHeld || e.pointerId !== gelHeld.id) return;
        // A quick tap lifts before the touch delay: it still shows the press.
        if (gelHeld.timer !== null) {
            var tapped = gelHeld;
            clearTimeout(tapped.timer);
            tapped.timer = null;
            tapped.el.classList.add('gel-held');
            setTimeout(function () { if (gelHeld === tapped) gelUp(); }, PRESS_MS);
            return;
        }
        gelUp();
    }, true);

    window.addEventListener('pointercancel', gelUp, true);
    window.addEventListener('blur', gelUp);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            gelUp();
            return;
        }
        if ((e.key !== ' ' && e.key !== 'Enter') || e.repeat) return;
        var el = gelHost(document.activeElement);
        if (!el) return;
        gelUp();
        gelHeld = { el: el, id: 'key', timer: null };
        el.classList.add('gel-held');
    }, true);

    document.addEventListener('keyup', function (e) {
        if ((e.key === ' ' || e.key === 'Enter') && gelHeld && gelHeld.id === 'key') gelUp();
    }, true);

    window.Gel = { scan: gelScan };
})();
