/**
 * Stretch Rail: a segmented choice on native radios (css/components/
 * stretch-rail.css). Brief: docs/motion-zen.md section 6b.
 *
 * The radios do the real work, so keyboard (arrow keys) and screen readers
 * behave with no script. This file only adds:
 * - the highlight, moved by transform alone: 0 to 140ms its leading edge
 *   stretches toward the new choice, 140 to 340ms it settles onto it, one
 *   snap curve, no overshoot;
 * - drag on fine pointers (laptop and wide): the highlight follows 1:1,
 *   resists past either end (0.55 rubber, 24px cap), snaps to the nearest
 *   choice in 240ms, a fast flick carries one choice further;
 * - a phone chip (under 600px): one pill showing the choice and its count,
 *   opening a short list (listbox) whose highlight glides between options.
 * Reduced motion: the highlight jumps, no stretch, no drag.
 *
 * Consumers listen for the radios' own change events.
 *
 * @file js/components/stretch-rail.js
 */
(function () {
    'use strict';

    if (window.StretchRail) return;

    var EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
    var RUBBER = 0.55;
    var RUBBER_CAP = 24;
    var FLICK = 0.9; // px per ms

    function media(q) {
        try { return window.matchMedia(q).matches; } catch (e) { return false; }
    }

    function reduced() { return media('(prefers-reduced-motion: reduce)'); }
    function fine() { return media('(hover: hover) and (pointer: fine)'); }

    function mount(host) {
        var rail = host.querySelector('.stretch-rail');
        var thumb = rail && rail.querySelector('.stretch-rail-thumb');
        var inputs = rail ? [].slice.call(rail.querySelectorAll('input[type="radio"]')) : [];
        if (!rail || !thumb || !inputs.length) return null;

        var st = { current: -1, ghost: null, chip: null, drag: null, off: [] };

        function on(el, type, fn, opts) {
            el.addEventListener(type, fn, opts);
            st.off.push(function () { el.removeEventListener(type, fn, opts); });
        }

        function checkedIndex() {
            for (var i = 0; i < inputs.length; i++) if (inputs[i].checked) return i;
            return 0;
        }

        function box(i) {
            var label = inputs[i].nextElementSibling;
            return { x: label.offsetLeft, w: label.offsetWidth };
        }

        function paintAt(el, x, w) {
            el.style.width = w + 'px';
            el.style.transform = 'translateX(' + x + 'px)';
        }

        function painted() {
            return st.ghost || thumb;
        }

        function place(i) {
            var b = box(i);
            paintAt(thumb, b.x, b.w);
            if (st.ghost) paintAt(st.ghost, b.x, b.w);
            st.current = i;
        }

        function stretchTo(i, fromBox) {
            var to = box(i);
            var from = fromBox || (st.current >= 0 ? box(st.current) : null);
            place(i);
            if (!from || reduced() || !thumb.animate || (from.x === to.x && from.w === to.w)) return;
            var right = to.x > from.x;
            var spanX = right ? from.x : to.x;
            var spanW = right ? to.x + to.w - from.x : from.x + from.w - to.x;
            var t = function (x, w) { return 'translateX(' + x + 'px) scaleX(' + (w / to.w) + ')'; };
            painted().animate([
                { transform: t(from.x, from.w) },
                { transform: t(spanX, Math.max(spanW, to.w)), offset: 0.41 },
                { transform: t(to.x, to.w) }
            ], { duration: fromBox ? 240 : 340, easing: EASE });
        }

        on(rail, 'change', function (e) {
            var i = inputs.indexOf(e.target);
            if (i < 0) return;
            var from = st.drag && st.drag.released ? st.drag.released : null;
            st.drag = null;
            stretchTo(i, from);
            syncChip();
        });

        /* ---- Drag on fine pointers ---------------------------------- */

        function enableDrag() {
            if (st.ghost || !fine() || reduced()) return;
            st.ghost = document.createElement('span');
            st.ghost.className = 'stretch-rail-ghost';
            st.ghost.setAttribute('aria-hidden', 'true');
            rail.insertBefore(st.ghost, thumb);
            rail.classList.add('is-draggable');
            place(checkedIndex());

            on(thumb, 'pointerdown', function (e) {
                if (e.button !== 0) return;
                var b = box(checkedIndex());
                st.drag = { startX: e.clientX, x: b.x, w: b.w, cur: b.x, trail: [[performance.now(), e.clientX]] };
                try { thumb.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
                rail.classList.add('is-dragging');
                e.preventDefault();
            });

            on(thumb, 'pointermove', function (e) {
                var d = st.drag;
                if (!d || d.released) return;
                var min = box(0).x;
                var last = box(inputs.length - 1);
                var max = last.x + last.w - d.w;
                var x = d.x + (e.clientX - d.startX);
                if (x < min) x = min - Math.min(RUBBER_CAP, (min - x) * RUBBER);
                if (x > max) x = max + Math.min(RUBBER_CAP, (x - max) * RUBBER);
                d.cur = x;
                st.ghost.style.transform = 'translateX(' + x + 'px)';
                d.trail.push([performance.now(), e.clientX]);
                if (d.trail.length > 6) d.trail.shift();
            });

            function release() {
                var d = st.drag;
                if (!d || d.released) return;
                rail.classList.remove('is-dragging');
                var a = d.trail[0];
                var z = d.trail[d.trail.length - 1];
                var v = z[0] - a[0] > 8 ? (z[1] - a[1]) / (z[0] - a[0]) : 0;
                var centre = d.cur + d.w / 2;
                var best = 0;
                var bestD = Infinity;
                inputs.forEach(function (_, i) {
                    var b = box(i);
                    var dist = Math.abs(b.x + b.w / 2 - centre);
                    if (dist < bestD) { bestD = dist; best = i; }
                });
                if (Math.abs(v) > FLICK) best = Math.max(0, Math.min(inputs.length - 1, best + (v > 0 ? 1 : -1)));
                d.released = { x: d.cur, w: d.w };
                if (best === checkedIndex()) {
                    st.drag = null;
                    stretchTo(best, d.released);
                } else {
                    inputs[best].click(); // fires change, which settles from the drop point
                }
            }

            on(thumb, 'pointerup', release);
            on(thumb, 'pointercancel', release);
        }

        /* ---- Phone chip ---------------------------------------------- */

        function labelText(i) {
            var l = inputs[i].nextElementSibling;
            var name = l.querySelector('.stretch-rail-label');
            return name ? name.textContent.trim() : l.textContent.trim();
        }

        function countText(i) {
            var c = inputs[i].nextElementSibling.querySelector('.stretch-rail-count');
            return c ? c.textContent.trim() : '';
        }

        function buildChip() {
            var legend = rail.querySelector('legend');
            var chip = document.createElement('div');
            chip.className = 'rail-chip';
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pill-btn pill-btn--outline rail-chip-btn';
            btn.setAttribute('aria-haspopup', 'listbox');
            btn.setAttribute('aria-expanded', 'false');
            btn.innerHTML = '<span class="rail-chip-label"></span> <span class="stretch-rail-count"></span>' +
                ' <span class="arrow arrow--down" aria-hidden="true"></span>';
            var panel = document.createElement('div');
            panel.className = 'rail-chip-list';
            panel.hidden = true;
            var glide = document.createElement('span');
            glide.className = 'rail-chip-glide';
            glide.setAttribute('aria-hidden', 'true');
            var list = document.createElement('ul');
            list.setAttribute('role', 'listbox');
            list.setAttribute('aria-label', legend ? legend.textContent.trim() : 'Choices');
            var id = 'railChip' + Math.random().toString(36).slice(2, 7);
            list.id = id;
            btn.setAttribute('aria-controls', id);
            var opts = inputs.map(function (input, i) {
                var li = document.createElement('li');
                li.setAttribute('role', 'option');
                li.tabIndex = -1;
                li.innerHTML = '<span></span><span class="stretch-rail-count"></span>';
                li.firstChild.textContent = labelText(i);
                li.lastChild.textContent = countText(i);
                list.appendChild(li);
                return li;
            });
            panel.appendChild(glide);
            panel.appendChild(list);
            chip.appendChild(btn);
            chip.appendChild(panel);
            host.insertBefore(chip, rail);
            host.classList.add('has-rail-chip');
            st.chip = { el: chip, btn: btn, panel: panel, glide: glide, opts: opts };

            function glideTo(i) {
                glide.style.transform = 'translateY(' + opts[i].offsetTop + 'px)';
            }

            function open() {
                panel.hidden = false;
                btn.setAttribute('aria-expanded', 'true');
                var i = checkedIndex();
                glideTo(i);
                opts[i].focus();
            }

            function close(refocus) {
                if (panel.hidden) return;
                panel.hidden = true;
                btn.setAttribute('aria-expanded', 'false');
                if (refocus) btn.focus();
            }

            function choose(i) {
                if (!inputs[i].checked) inputs[i].click();
                close(true);
            }

            on(btn, 'click', function () { if (panel.hidden) open(); else close(true); });
            opts.forEach(function (li, i) {
                on(li, 'click', function () { choose(i); });
                on(li, 'pointerenter', function () { glideTo(i); });
                on(li, 'focus', function () { glideTo(i); });
                on(li, 'keydown', function (e) {
                    if (e.key === 'ArrowDown') { e.preventDefault(); opts[Math.min(opts.length - 1, i + 1)].focus(); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); opts[Math.max(0, i - 1)].focus(); }
                    else if (e.key === 'Home') { e.preventDefault(); opts[0].focus(); }
                    else if (e.key === 'End') { e.preventDefault(); opts[opts.length - 1].focus(); }
                    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(i); }
                    else if (e.key === 'Escape') { e.preventDefault(); close(true); }
                    else if (e.key === 'Tab') { close(false); }
                });
            });
            on(document, 'pointerdown', function (e) {
                if (!panel.hidden && !chip.contains(e.target)) close(false);
            });
            syncChip();
        }

        function syncChip() {
            if (!st.chip) return;
            var i = checkedIndex();
            st.chip.btn.querySelector('.rail-chip-label').textContent = labelText(i);
            st.chip.btn.querySelector('.stretch-rail-count').textContent = countText(i);
            st.chip.opts.forEach(function (li, j) { li.setAttribute('aria-selected', String(j === i)); });
        }

        /* ---- Start ---------------------------------------------------- */

        function settle() { place(checkedIndex()); }

        buildChip();
        rail.classList.add('is-live');
        settle();
        enableDrag();
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
        if ('ResizeObserver' in window) {
            var ro = new ResizeObserver(settle);
            ro.observe(rail);
            st.off.push(function () { ro.disconnect(); });
        } else {
            on(window, 'resize', settle);
        }
        return st;
    }

    function unmount(host, st) {
        if (!st) return;
        st.off.forEach(function (fn) { fn(); });
        if (st.ghost && st.ghost.parentNode) st.ghost.parentNode.removeChild(st.ghost);
        if (st.chip && st.chip.el.parentNode) st.chip.el.parentNode.removeChild(st.chip.el);
        host.classList.remove('has-rail-chip');
    }

    window.StretchRail = { mount: mount, unmount: unmount };
    if (window.Mount) window.Mount.register('stretch-rail', { mount: mount, unmount: unmount });
})();
