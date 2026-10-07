/**
 * Change Feed, a dated list of site updates.
 *
 *   <ol class="change-feed" data-component="change-feed">
 *     <li><time datetime="2026-09-28">Sep 28, 2026</time> <p>...</p></li>
 *   </ol>
 *
 * The newest entry, when it is under 30 days old, gets a hand-written
 * "new" tag. Brief (docs/motion-zen.md section 6a): rows fade in once
 * when the list scrolls into view, 180ms each in 30ms steps capped at
 * 280ms. Reduced motion: rows are simply there.
 *
 * @file js/components/change-feed.js
 */
(function () {
    'use strict';

    var FRESH_DAYS = 30;

    function reduced() {
        try {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) {
            return false;
        }
    }

    function mount(list) {
        var rows = Array.from(list.children);
        rows.forEach(function (row, i) {
            row.style.setProperty('--row', String(Math.min(i, 8)));
        });
        var first = rows[0] && rows[0].querySelector('time[datetime]');
        if (first && !list.querySelector('.feed-new')) {
            var age = (Date.now() - new Date(first.getAttribute('datetime')).getTime()) / 86400000;
            if (age >= 0 && age < FRESH_DAYS) {
                var tag = document.createElement('span');
                tag.className = 'feed-new hand';
                tag.textContent = 'new';
                first.insertAdjacentElement('afterend', tag);
            }
        }
        if (reduced() || !('IntersectionObserver' in window)) return null;
        list.classList.add('is-waiting');
        var io = new IntersectionObserver(function (entries) {
            if (!entries.some(function (e) { return e.isIntersecting; })) return;
            io.disconnect();
            list.classList.remove('is-waiting');
            list.classList.add('is-in');
        }, { threshold: 0.15 });
        io.observe(list);
        return io;
    }

    if (window.Mount) {
        window.Mount.register('change-feed', {
            mount: mount,
            unmount: function (el, io) { if (io) io.disconnect(); }
        });
    }
})();
