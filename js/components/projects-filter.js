/**
 * Projects filter for /projects: listens to the Stretch Rail's radios and
 * shows the matching feature cards and archive rows.
 *
 * Both sections swap exit-first (docs/motion-zen.md section 3): visible
 * items that leave fade out in 160ms, then the new set enters at 180ms
 * with 30ms steps (capped, so a long list never waits). Reduced motion:
 * an instant swap. The readout and the empty state are polite live text.
 *
 * Layout duties after each swap: a section with nothing to show hides,
 * each section's count line updates, and an odd number of feature cards
 * makes the last one span the row (data-wide), so no card is ever alone
 * on a row.
 *
 * Markup: <div data-component="stretch-rail project-filter"
 *              data-rail-target="projectWork"> ... radios ... </div>
 *
 * @file js/components/projects-filter.js
 * @author Jay Patel
 */
(function () {
    'use strict';

    if (window.ProjectsFilter && window.ProjectsFilter.mount) return;

    var EXIT_MS = 160;
    var STEP_MS = 30;
    var MAX_STAGGER = 10;

    function reduced() {
        try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }

    function plural(n) {
        return n + (n === 1 ? ' project' : ' projects');
    }

    function mount(host) {
        var work = document.getElementById(host.getAttribute('data-rail-target') || 'projectWork');
        if (!work) return null;
        var items = [].slice.call(work.querySelectorAll('.case-card, .arch-row'));
        var readout = host.querySelector('.filter-readout');
        var empty = document.getElementById('projectsEmpty');
        var sections = [].slice.call(work.querySelectorAll('.work-section'));
        var run = 0;
        var timers = [];

        function matches(item, value) {
            return value === 'all' || item.getAttribute('data-category') === value;
        }

        function report(n) {
            if (readout) readout.textContent = 'Showing ' + n + ' of ' + items.length;
            if (empty) empty.hidden = n !== 0;
        }

        // Section visibility, counts, and the wide last card.
        function layout() {
            sections.forEach(function (section) {
                var own = [].slice.call(section.querySelectorAll('.case-card, .arch-row'));
                var shown = own.filter(function (el) { return !el.hidden; });
                section.hidden = shown.length === 0;
                var count = section.querySelector('.work-count');
                if (count) {
                    var archive = count.getAttribute('data-count-for') === 'archive';
                    count.textContent = archive
                        ? plural(shown.length) + ', newest first. Open any row for the full story.'
                        : plural(shown.length);
                }
                own.forEach(function (el) { el.removeAttribute('data-wide'); });
                var cards = shown.filter(function (el) { return el.classList.contains('feature-card'); });
                if (cards.length % 2 === 1) cards[cards.length - 1].setAttribute('data-wide', '');
            });
        }

        function clearTimers() {
            timers.forEach(clearTimeout);
            timers = [];
        }

        function apply(value) {
            var id = ++run;
            clearTimers();
            var next = items.filter(function (el) { return matches(el, value); });
            report(next.length);
            if (reduced()) {
                items.forEach(function (el) { el.hidden = next.indexOf(el) < 0; el.classList.remove('is-leaving', 'is-entering'); });
                layout();
                return;
            }
            var leaving = items.filter(function (el) { return !el.hidden && next.indexOf(el) < 0; });
            leaving.forEach(function (el) { el.classList.add('is-leaving'); });
            timers.push(setTimeout(function () {
                if (id !== run) return;
                items.forEach(function (el) {
                    el.classList.remove('is-leaving');
                    var show = next.indexOf(el) >= 0;
                    if (show && el.hidden) {
                        el.hidden = false;
                        el.classList.add('is-entering');
                    } else if (!show) {
                        el.hidden = true;
                    }
                });
                layout();
                // Two frames so the entering items start from their hidden pose.
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () {
                        if (id !== run) return;
                        var k = 0;
                        next.forEach(function (el) {
                            if (!el.classList.contains('is-entering')) return;
                            el.style.transitionDelay = Math.min(k, MAX_STAGGER) * STEP_MS + 'ms';
                            k++;
                            el.classList.remove('is-entering');
                        });
                        timers.push(setTimeout(function () {
                            next.forEach(function (el) { el.style.transitionDelay = ''; });
                        }, 180 + MAX_STAGGER * STEP_MS + 40));
                    });
                });
            }, leaving.length ? EXIT_MS : 0));
        }

        function onChange(e) {
            if (e.target && e.target.type === 'radio') apply(e.target.value);
        }

        host.addEventListener('change', onChange);
        var start = host.querySelector('input[type="radio"]:checked');
        if (start && start.value !== 'all') apply(start.value);
        else layout();
        return { stop: function () { host.removeEventListener('change', onChange); clearTimers(); run++; } };
    }

    function unmount(host, st) {
        if (st) st.stop();
    }

    // The router calls ProjectsFilter.init() after a swap; Mount already
    // rescans on page:ready, so init only asks it to look again.
    window.ProjectsFilter = {
        mount: mount,
        init: function () { if (window.Mount) window.Mount.scan(document); }
    };
    if (window.Mount) window.Mount.register('project-filter', { mount: mount, unmount: unmount });
})();
