/**
 * Archive Peek: a preview of a closed archive row's cover (its drawing, or
 * its screenshot) while the pointer rests on the row, on /projects.
 *
 * Brief (docs/motion-zen.md section 6b, "Projects cards revamp"): laptop
 * and wide with a fine pointer only. One preview at a time, pinned to the
 * hovered row (it never follows the pointer). Enters in 180ms by opacity
 * and scale 0.96 to 1; leaves in 140ms; moving to another row exits the
 * old preview first, then enters the new one. Open rows show their own
 * cover, so they get no preview. Reduced motion: no preview at all.
 * It also opens a row named in the URL hash (the Command Deck links to
 * /projects#project-id), so a link to an archive project lands open.
 *
 * Markup: <div class="archive role-ledger" data-component="role-ledger archive-peek">
 *           <details class="role arch-row"> ... <div class="arch-cover">...</div> ...
 *
 * @file js/components/archive-peek.js
 */
(function () {
    'use strict';

    var EXIT_MS = 140;
    var WIDTH = 220;

    function allowed() {
        try {
            return window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)').matches &&
                !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) {
            return false;
        }
    }

    function mount(root) {
        var peek = document.createElement('div');
        peek.className = 'arch-peek';
        peek.setAttribute('aria-hidden', 'true');
        root.appendChild(peek);

        var current = null;
        var timer = 0;

        function place(row) {
            var head = row.querySelector('summary');
            var h = WIDTH * 10 / 16;
            var y = row.offsetTop + (head ? head.offsetHeight : 56) / 2 - h / 2;
            var max = root.offsetHeight - h;
            peek.style.setProperty('--peek-y', Math.round(Math.max(0, Math.min(y, max))) + 'px');
        }

        function fill(row) {
            var cover = row.querySelector('.arch-cover');
            peek.textContent = '';
            if (!cover) return false;
            var copy = cover.cloneNode(true);
            copy.querySelectorAll('img').forEach(function (img) { img.loading = 'eager'; });
            peek.appendChild(copy);
            return true;
        }

        function enter(row) {
            if (!fill(row)) return;
            place(row);
            requestAnimationFrame(function () {
                if (current === row) peek.classList.add('is-in');
            });
        }

        function show(row) {
            if (row === current) return;
            clearTimeout(timer);
            var wasIn = peek.classList.contains('is-in');
            current = row;
            if (!wasIn) {
                enter(row);
                return;
            }
            peek.classList.remove('is-in');
            timer = setTimeout(function () {
                if (current === row) enter(row);
            }, EXIT_MS);
        }

        function hide() {
            clearTimeout(timer);
            current = null;
            peek.classList.remove('is-in');
        }

        function onOver(e) {
            if (!allowed()) return;
            var head = e.target && e.target.closest ? e.target.closest('.arch-head') : null;
            var row = head ? head.parentElement : null;
            if (!row || row.open || row.hidden) {
                if (!head) return;
                hide();
                return;
            }
            show(row);
        }

        function onToggle(e) {
            if (e.target === current && current.open) hide();
        }

        // A link to a row (the Command Deck uses /projects#project-id) opens it.
        function openFromHash() {
            var id = decodeURIComponent((window.location.hash || '').slice(1));
            if (!id) return;
            var row = document.getElementById(id);
            if (row && root.contains(row) && row.tagName === 'DETAILS') {
                row.open = true;
                row.scrollIntoView({ block: 'center' });
            }
        }

        root.addEventListener('pointerover', onOver);
        root.addEventListener('pointerleave', hide);
        root.addEventListener('toggle', onToggle, true);
        window.addEventListener('hashchange', openFromHash);
        openFromHash();
        return { peek: peek, onOver: onOver, onToggle: onToggle, hide: hide, onHash: openFromHash, timer: function () { return timer; } };
    }

    function unmount(root, st) {
        if (!st) return;
        clearTimeout(st.timer());
        root.removeEventListener('pointerover', st.onOver);
        root.removeEventListener('pointerleave', st.hide);
        root.removeEventListener('toggle', st.onToggle, true);
        window.removeEventListener('hashchange', st.onHash);
        if (st.peek.parentNode) st.peek.parentNode.removeChild(st.peek);
    }

    if (window.Mount) window.Mount.register('archive-peek', { mount: mount, unmount: unmount });
})();
