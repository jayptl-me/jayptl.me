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
 * Brief (docs/motion-zen.md section 6b). Reduced motion is handled in CSS.
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
})();
