/**
 * Sticker Peel, pick stickers up and move them around their band.
 *
 * Builds on the sticker system (css/components/sticker.css). Hosts are
 * .sticker-zone elements; each .sticker inside becomes movable.
 *
 * Brief (docs/motion-zen.md section 6a, picked "Lift and drag"): hover
 * lifts a corner (transform only); dragging moves the sticker inside its
 * band and tilts it with the drag, capped at 12deg; dropping settles in
 * 240ms snap. "Reset stickers" returns every sticker home. Touch keeps
 * native scrolling (drag is mouse and pen; keyboard works everywhere). Keyboard: Enter
 * or Space picks up, arrow keys move, Enter, Space or Escape drops.
 * Reduced motion: dragging still works, settling is instant.
 *
 * @file js/components/sticker-peel.js
 */
(function () {
    'use strict';

    var STEP = 12;     // px per arrow press
    var TILT = 12;     // deg cap, the sticker law

    function sound(kind) {
        try {
            var sm = window.SoundManager;
            if (!sm) return;
            if (kind === 'pick' && sm.playSelectSound) sm.playSelectSound();
            if (kind === 'drop' && sm.playHoverSound) sm.playHoverSound();
        } catch (e) { /* noop */ }
    }

    function announce(zone, text) {
        var live = zone.querySelector('.sticker-live');
        if (!live) {
            live = document.createElement('span');
            live.className = 'sticker-live sr-only';
            live.setAttribute('aria-live', 'polite');
            zone.appendChild(live);
        }
        live.textContent = text;
    }

    function clampToZone(zone, sticker, x, y) {
        var z = zone.getBoundingClientRect();
        var s = sticker.getBoundingClientRect();
        var baseLeft = s.left - (sticker._x || 0);
        var baseTop = s.top - (sticker._y || 0);
        var minX = z.left - baseLeft;
        var maxX = z.right - (baseLeft + s.width);
        var minY = z.top - baseTop - 24;
        var maxY = z.bottom - (baseTop + s.height) + 24;
        return {
            x: Math.max(minX, Math.min(maxX, x)),
            y: Math.max(minY, Math.min(maxY, y))
        };
    }

    function place(sticker, x, y) {
        sticker._x = x;
        sticker._y = y;
        sticker.style.setProperty('--sx', x.toFixed(1) + 'px');
        sticker.style.setProperty('--sy', y.toFixed(1) + 'px');
    }

    function mount(zone) {
        var stickers = Array.from(zone.querySelectorAll('.sticker'));
        var drag = null;
        var held = null;

        stickers.forEach(function (st) {
            st.classList.add('sticker--peel');
            st.setAttribute('tabindex', '0');
            st.setAttribute('role', 'button');
            st.setAttribute('aria-pressed', 'false');
            var caption = st.querySelector('.sticker-caption');
            st.setAttribute('aria-label', 'Sticker, ' + (caption ? caption.textContent.trim() : '') + '. Enter picks it up, arrow keys move it.');
            st._home = st.style.getPropertyValue('--r') || '';
            st._x = 0;
            st._y = 0;
        });

        function onDown(e) {
            var st = e.target.closest && e.target.closest('.sticker');
            // Touch keeps native scrolling; mouse and pen drag.
            if (!st || !zone.contains(st) || e.button !== 0 || e.pointerType === 'touch') return;
            e.preventDefault();
            st.setPointerCapture(e.pointerId);
            drag = { st: st, id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: st._x || 0, oy: st._y || 0, lx: e.clientX };
            st.classList.add('is-dragging');
            st.classList.remove('sticker--idle');
            sound('pick');
        }

        function onMove(e) {
            if (!drag || e.pointerId !== drag.id) return;
            var p = clampToZone(zone, drag.st, drag.ox + e.clientX - drag.sx, drag.oy + e.clientY - drag.sy);
            place(drag.st, p.x, p.y);
            var tilt = Math.max(-TILT, Math.min(TILT, (e.clientX - drag.lx) * 0.8));
            drag.st.style.setProperty('--r', tilt.toFixed(1) + 'deg');
            drag.lx = e.clientX;
        }

        function onUp(e) {
            if (!drag || e.pointerId !== drag.id) return;
            var st = drag.st;
            st.classList.remove('is-dragging');
            // Settle to a resting tilt inside the cap.
            st.style.setProperty('--r', ((Math.random() * 12) - 6).toFixed(1) + 'deg');
            drag = null;
            sound('drop');
        }

        function onKey(e) {
            var st = e.target.closest && e.target.closest('.sticker');
            if (!st || !zone.contains(st)) return;
            var caption = (st.querySelector('.sticker-caption') || st).textContent.trim();
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (held === st) {
                    held = null;
                    st.classList.remove('is-held');
                    st.setAttribute('aria-pressed', 'false');
                    announce(zone, 'Dropped ' + caption);
                    sound('drop');
                } else {
                    if (held) {
                        held.classList.remove('is-held');
                        held.setAttribute('aria-pressed', 'false');
                    }
                    held = st;
                    st.classList.add('is-held');
                    st.setAttribute('aria-pressed', 'true');
                    announce(zone, 'Picked up ' + caption + '. Arrow keys move it, Enter drops it.');
                    sound('pick');
                }
                return;
            }
            if (e.key === 'Escape' && held === st) {
                held = null;
                st.classList.remove('is-held');
                st.setAttribute('aria-pressed', 'false');
                announce(zone, 'Dropped ' + caption);
                return;
            }
            if (held !== st) return;
            var dx = { ArrowLeft: -STEP, ArrowRight: STEP }[e.key] || 0;
            var dy = { ArrowUp: -STEP, ArrowDown: STEP }[e.key] || 0;
            if (!dx && !dy) return;
            e.preventDefault();
            var p = clampToZone(zone, st, (st._x || 0) + dx, (st._y || 0) + dy);
            place(st, p.x, p.y);
        }

        function reset() {
            stickers.forEach(function (st) {
                place(st, 0, 0);
                st.classList.remove('is-held');
                st.setAttribute('aria-pressed', 'false');
            });
            held = null;
        }

        var resetBtn = document.getElementById('resetStickers');
        zone.addEventListener('pointerdown', onDown);
        zone.addEventListener('pointermove', onMove);
        zone.addEventListener('pointerup', onUp);
        zone.addEventListener('pointercancel', onUp);
        zone.addEventListener('keydown', onKey);
        if (resetBtn) resetBtn.addEventListener('click', reset);

        return {
            destroy: function () {
                zone.removeEventListener('pointerdown', onDown);
                zone.removeEventListener('pointermove', onMove);
                zone.removeEventListener('pointerup', onUp);
                zone.removeEventListener('pointercancel', onUp);
                zone.removeEventListener('keydown', onKey);
                if (resetBtn) resetBtn.removeEventListener('click', reset);
            }
        };
    }

    if (window.Mount) {
        window.Mount.register('sticker-peel', {
            selector: '.sticker-zone',
            mount: mount,
            unmount: function (zone, state) { if (state) state.destroy(); }
        });
    }
})();
