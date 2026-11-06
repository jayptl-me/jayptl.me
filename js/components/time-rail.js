/**
 * Time Rail, a drawn rail in the left gutter of the /resume Experience rows.
 *
 * Brief: docs/motion-zen.md section 6c, Gate R answers D-48. The rail reads
 * scroll and never drives it: no wheel listener, nothing cancelled, no
 * scroll control taken from any component. One passive scroll listener and
 * one rAF read per frame, the same pattern as control-dock.js update().
 * Stops sit at their own row heads in reading order (no time axis), so they
 * move when a ledger row opens or closes; geometry is measured on the
 * ledger's toggle events and on resize, never on scroll. The marker and the
 * fill move by transform only. Laptop and wide only (the stylesheet hides
 * the rail below 1024px). Decoration, not a control: aria-hidden, no focus,
 * no click, no sound, hidden in print.
 *
 * Reduced motion: the static, fully drawn end state. The line is full
 * length, every stop reads at once, the marker holds at the last stop and
 * nothing follows the scroll.
 *
 * Markup (pages/resume.html):
 *   <div class="time-rail-host" data-component="time-rail">
 *     <div class="time-rail" aria-hidden="true">
 *       <span class="time-rail-spine"></span><span class="time-rail-fill"></span>
 *       <span class="time-rail-stop"><span class="time-rail-dot"></span><span class="time-rail-year">2022</span></span>
 *       <span class="time-rail-marker"></span>
 *     </div>
 *     <div class="role-ledger" data-component="role-ledger">...</div>
 *   </div>
 *
 * @file js/components/time-rail.js
 */
(function () {
    'use strict';

    if (!window.Mount) return;

    var READ_LINE = 0.4; // the reading line sits 40% down the viewport

    function query(q) {
        try {
            return window.matchMedia(q);
        } catch (e) {
            return null;
        }
    }

    function stepperHolds() {
        var overlay = document.querySelector('.text-reveal-container');
        return Boolean(overlay && !overlay.classList.contains('released'));
    }

    function listen(mq, fn) {
        if (!mq) return;
        if (typeof mq.addEventListener === 'function') mq.addEventListener('change', fn);
        else if (typeof mq.addListener === 'function') mq.addListener(fn);
    }

    function unlisten(mq, fn) {
        if (!mq) return;
        if (typeof mq.removeEventListener === 'function') mq.removeEventListener('change', fn);
        else if (typeof mq.removeListener === 'function') mq.removeListener(fn);
    }

    function mount(host) {
        var rail = host.querySelector('.time-rail');
        var ledger = host.querySelector('.role-ledger');
        if (!rail || !ledger) return null;

        var rows = Array.prototype.slice.call(ledger.querySelectorAll('details.role'));
        var stops = Array.prototype.slice.call(rail.querySelectorAll('.time-rail-stop'));
        var spine = rail.querySelector('.time-rail-spine');
        var fill = rail.querySelector('.time-rail-fill');
        var marker = rail.querySelector('.time-rail-marker');
        var wideQ = query('(min-width: 1024px)');
        var calmQ = query('(prefers-reduced-motion: reduce)');

        var ys = [];       // stop centres, px from the host top
        var hostTop = 0;   // host top in document coordinates
        var viewH = 0;     // cached viewport height
        var shown = -2;    // last active index written
        var ticking = false;
        var needMeasure = false;
        var following = false;
        var live = false;

        function wide() {
            return Boolean(wideQ && wideQ.matches);
        }

        function calm() {
            return Boolean(calmQ && calmQ.matches);
        }

        // Layout reads, then writes. Runs on mount, toggle and resize only.
        function measureNow() {
            needMeasure = false;
            var scrollY = window.scrollY;
            var box = host.getBoundingClientRect();
            hostTop = box.top + scrollY;
            viewH = window.innerHeight;
            ys = rows.map(function (row) {
                var head = row.querySelector('summary') || row;
                var r = head.getBoundingClientRect();
                return Math.round(r.top - box.top + r.height / 2);
            });
            var n = Math.min(ys.length, stops.length);
            for (var i = 0; i < n; i++) {
                stops[i].style.transform = 'translateY(' + ys[i] + 'px)';
            }
            if (n) {
                var span = Math.max(0, ys[n - 1] - ys[0]);
                spine.style.top = ys[0] + 'px';
                spine.style.height = span + 'px';
                fill.style.top = ys[0] + 'px';
                fill.style.height = span + 'px';
            }
            if (!live) {
                live = true;
                rail.classList.add('is-live');
            }
            if (!following) settle();
        }

        // The reduced-motion end state: drawn in full, marker at the end.
        function settle() {
            var n = Math.min(ys.length, stops.length);
            if (!n) return;
            marker.style.transform = 'translateY(' + ys[n - 1] + 'px)';
            fill.style.transform = 'scaleY(1)';
            for (var i = 0; i < n; i++) {
                stops[i].classList.add('is-reached');
                stops[i].classList.remove('is-active');
            }
            shown = -2;
        }

        // The scroll path: one read of the scroll position, transforms only.
        function update() {
            var n = Math.min(ys.length, stops.length);
            if (!following || !n || stepperHolds()) return;
            var line = window.scrollY + viewH * READ_LINE - hostTop;
            var first = ys[0];
            var last = ys[n - 1];
            var at = Math.min(last, Math.max(first, line));
            marker.style.transform = 'translateY(' + at + 'px)';
            fill.style.transform = 'scaleY(' + (last > first ? (at - first) / (last - first) : 1) + ')';
            var active = -1;
            for (var i = 0; i < n; i++) {
                if (ys[i] <= at + 0.5) active = i;
            }
            if (active === shown) return;
            shown = active;
            for (var j = 0; j < n; j++) {
                stops[j].classList.toggle('is-reached', j <= active);
                stops[j].classList.toggle('is-active', j === active);
            }
        }

        function frame() {
            ticking = false;
            if (needMeasure) measureNow();
            update();
        }

        function queue() {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(frame);
        }

        function remeasure() {
            if (!wide()) return;
            needMeasure = true;
            queue();
        }

        function onScroll() {
            queue();
        }

        function sync() {
            var follow = wide() && !calm();
            if (follow && !following) {
                window.addEventListener('scroll', onScroll, { passive: true });
            } else if (!follow && following) {
                window.removeEventListener('scroll', onScroll, { passive: true });
            }
            following = follow;
            if (wide()) {
                measureNow();
                if (following) {
                    shown = -2;
                    queue();
                }
            }
        }

        window.addEventListener('resize', remeasure, { passive: true });
        window.addEventListener('load', remeasure);
        rows.forEach(function (row) {
            row.addEventListener('toggle', remeasure);
        });
        listen(wideQ, sync);
        listen(calmQ, sync);
        try {
            if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
        } catch (e) { /* noop */ }

        sync();

        return {
            teardown: function () {
                window.removeEventListener('scroll', onScroll, { passive: true });
                window.removeEventListener('resize', remeasure, { passive: true });
                window.removeEventListener('load', remeasure);
                rows.forEach(function (row) {
                    row.removeEventListener('toggle', remeasure);
                });
                unlisten(wideQ, sync);
                unlisten(calmQ, sync);
                following = false;
            }
        };
    }

    function unmount(host, state) {
        if (state && typeof state.teardown === 'function') state.teardown();
    }

    window.Mount.register('time-rail', { mount: mount, unmount: unmount });
})();
