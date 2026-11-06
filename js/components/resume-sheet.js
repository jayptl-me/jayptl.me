/**
 * Resume Sheet (docs/motion-zen.md section 6d): tapping a one-pager tile on
 * /resume opens that resume as a page in a sheet that rises from the
 * bottom, while the page behind sinks. Reading happens in the sheet; the
 * PDF stays the download, from the sheet's head.
 *
 * - The one-pager body is fetched from /assets/resumes/html/<track>.html
 *   and shown in a shadow root, so its styles never touch the site's. Its
 *   stylesheet is loaded before the sheet opens, so it never shows unstyled.
 * - Close: drag the head down past a quarter of the sheet's height or
 *   flick it (24px or more, fast over the last 100ms), Escape, the close
 *   button, or a tap outside.
 * - Falls back to the plain download for a modified click, no showModal or
 *   shadow roots, or a failed fetch. The fallback is the tile's own click,
 *   so page-actions.js still shows the Ink Status check and says it.
 * - Keyboard: the resume body takes focus on open, so arrows and Page Down
 *   scroll it. Focus returns to the tile on close.
 * - Reduced motion: no slide and no sink, it appears and disappears at once.
 *
 * @file js/components/resume-sheet.js
 */
(function () {
    'use strict';

    if (window.ResumeSheet) return;

    var CLOSE_MS = 500;
    var SINK_PX = 26;   // the page behind narrows by this much
    var DROP_PX = 14;   // and drops by this much
    var ROUND_PX = 8;   // and rounds its corners to this
    var FLICK_PX = 24;  // a flick travels at least this far
    var FLICK_SPEED = 0.5; // px per ms, over the last 100ms
    var CSS_URL = '/assets/resumes/html/one-pager.css';
    var LOAD_MS = 4000; // a page that has not arrived by then falls back to the PDF

    var root = document.documentElement;
    var dialog = null;
    var body = null;
    var shadow = null;
    var closing = false;
    var loading = false;
    var lastTile = null;
    var origins = [];   // [{ el, y }] measured once per open, before any sink
    var cache = {};
    var cssReady = null;
    var generation = 0; // bumped by every router swap, so a late load never opens on another page

    function reduced() {
        try {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) {
            return false;
        }
    }

    // The page's theme: set on <html>, or the system's when the visitor never chose.
    function darkTheme() {
        var t = root.getAttribute('data-theme');
        if (t) return t === 'dark';
        try {
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        } catch (e) {
            return false;
        }
    }

    function trackOf(tile) {
        var m = /\/assets\/resumes\/([a-z0-9-]+)\.pdf$/.exec(tile.getAttribute('href') || '');
        return m ? m[1] : null;
    }

    // The page behind: main, the site footer and the navbar sink together,
    // all around the same point, the top centre of the viewport. Origins are
    // measured once, before any sink, so a drag never moves them.
    function measure() {
        var y = window.scrollY;
        origins = Array.prototype.slice.call(document.querySelectorAll('main, .site-footer, #glassNav, .edge-blur'))
            .map(function (el) {
                // Measured against the viewport's top centre: for a fixed
                // element that is minus its own top, for the rest the scroll.
                var top = el.getBoundingClientRect().top;
                var fixed = getComputedStyle(el).position === 'fixed';
                return { el: el, y: fixed ? -top : y - (top + y) };
            });
    }

    function setBehind(u) { // u: 1 fully open, 0 fully closed
        if (reduced()) return;
        var w = window.innerWidth;
        var base = (w - SINK_PX) / w;
        origins.forEach(function (o) {
            o.el.style.setProperty('--rsheet-origin-y', o.y + 'px');
            o.el.style.setProperty('--rsheet-scale', String(1 - (1 - base) * u));
            o.el.style.setProperty('--rsheet-y', (DROP_PX * u) + 'px');
            o.el.style.setProperty('--rsheet-r', (ROUND_PX * u) + 'px');
        });
    }

    function clearBehind() {
        origins.forEach(function (o) {
            ['--rsheet-origin-y', '--rsheet-scale', '--rsheet-y', '--rsheet-r'].forEach(function (p) {
                o.el.style.removeProperty(p);
            });
        });
        origins = [];
    }

    // Everything a closed sheet must not carry into the next open.
    function reset() {
        if (!dialog) return;
        dialog.classList.remove('is-up', 'is-dragging');
        dialog.style.removeProperty('--rsheet-drag');
        root.classList.remove('rsheet-open', 'rsheet-dragging');
        clearBehind();
        closing = false;
    }

    function build() {
        dialog = document.createElement('dialog');
        dialog.className = 'rsheet';
        dialog.setAttribute('aria-labelledby', 'rsheetTitle');
        dialog.innerHTML =
            '<div class="rsheet-head" data-rsheet-drag>' +
                '<span class="rsheet-handle" aria-hidden="true"></span>' +
                '<h2 class="rsheet-title" id="rsheetTitle"></h2>' +
                '<a class="pill-btn pill-btn--outline rsheet-download" download>Download PDF <span class="arrow arrow--down" aria-hidden="true"></span></a>' +
                '<button type="button" class="pill-btn pill-btn--quiet rsheet-close" data-rsheet-close>Close</button>' +
            '</div>' +
            '<div class="rsheet-body" tabindex="0" role="document" aria-labelledby="rsheetTitle"></div>';
        document.body.appendChild(dialog);
        body = dialog.querySelector('.rsheet-body');
        shadow = body.attachShadow({ mode: 'open' });

        dialog.querySelector('[data-rsheet-close]').addEventListener('click', close);
        dialog.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
        dialog.addEventListener('click', function (e) { if (e.target === dialog) close(); });
        // A close the browser forces (a repeated Escape) still cleans up.
        dialog.addEventListener('close', function () {
            if (root.classList.contains('rsheet-open')) reset();
        });
        bindDrag(dialog.querySelector('[data-rsheet-drag]'));
    }

    // The stylesheet, loaded once and ready before the first open.
    function styles() {
        if (cssReady) return cssReady;
        cssReady = new Promise(function (resolve) {
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = CSS_URL;
            var done = function () { resolve(); };
            link.addEventListener('load', done);
            link.addEventListener('error', done);
            setTimeout(done, 1500);
            shadow.appendChild(link);
        });
        return cssReady;
    }

    function load(track) {
        if (cache[track]) return Promise.resolve(cache[track]);
        var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, LOAD_MS);
        return fetch('/assets/resumes/html/' + track + '.html', { credentials: 'same-origin', signal: ctrl ? ctrl.signal : undefined })
            .then(function (res) {
                clearTimeout(timer);
                if (!res.ok) throw new Error('resume ' + res.status);
                return res.text();
            })
            .then(function (text) {
                var doc = new DOMParser().parseFromString(text, 'text/html');
                var src = doc.querySelector('main.sheet');
                if (!src) throw new Error('resume markup');
                // An article, not a second main landmark inside the dialog.
                var sheet = doc.createElement('article');
                sheet.className = 'sheet';
                while (src.firstChild) sheet.appendChild(src.firstChild);
                cache[track] = sheet;
                return sheet;
            });
    }

    // The page load, raced against the same limit, for a fetch that ignores
    // its abort signal.
    function withLimit(p) {
        return Promise.race([p, new Promise(function (resolve, reject) {
            setTimeout(function () { reject(new Error('resume timeout')); }, LOAD_MS + 100);
        })]);
    }

    function open(tile, sheet) {
        reset();
        lastTile = tile;
        var name = tile.querySelector('.resume-track-name');
        dialog.querySelector('.rsheet-title').textContent = (name ? name.textContent.trim() : 'Resume') + ' one-pager';
        var dl = dialog.querySelector('.rsheet-download');
        dl.href = tile.getAttribute('href');
        dl.setAttribute('download', tile.getAttribute('download') || '');

        body.setAttribute('data-theme', darkTheme() ? 'dark' : 'light');
        var old = shadow.querySelector('.sheet');
        if (old) old.remove();
        shadow.appendChild(document.importNode(sheet, true));
        body.scrollTop = 0;

        measure();
        dialog.showModal();
        root.classList.add('rsheet-open');
        setBehind(1);
        try { body.focus({ preventScroll: true }); } catch (e) { body.focus(); }
        // Two frames, so the rise starts from below the screen.
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { if (dialog.open && !closing) dialog.classList.add('is-up'); });
        });
    }

    function close() {
        if (!dialog || closing || !dialog.open) return;
        closing = true;
        dialog.classList.remove('is-up', 'is-dragging');
        root.classList.remove('rsheet-dragging');
        dialog.style.removeProperty('--rsheet-drag');
        setBehind(0);
        function done() {
            if (!closing) return;
            dialog.close();
            reset();
            if (lastTile && lastTile.isConnected) lastTile.focus({ preventScroll: true });
        }
        if (reduced()) done(); else setTimeout(done, CLOSE_MS);
    }

    function bindDrag(handle) {
        handle.addEventListener('pointerdown', function (e) {
            if (e.button > 0 || (e.target.closest && e.target.closest('a, button'))) return;
            var y0 = e.clientY;
            var dy = 0;
            var samples = [{ t: performance.now(), y: e.clientY }];
            var h = dialog.getBoundingClientRect().height;
            handle.setPointerCapture(e.pointerId);
            dialog.classList.add('is-dragging');
            root.classList.add('rsheet-dragging');
            function move(ev) {
                dy = Math.max(0, ev.clientY - y0);
                samples.push({ t: performance.now(), y: ev.clientY });
                dialog.style.setProperty('--rsheet-drag', dy + 'px');
                setBehind(1 - dy / h);
            }
            function up() {
                handle.removeEventListener('pointermove', move);
                handle.removeEventListener('pointerup', up);
                handle.removeEventListener('pointercancel', up);
                dialog.classList.remove('is-dragging');
                root.classList.remove('rsheet-dragging');
                // Speed over the last 100ms only, so a slow drag that ends in a
                // real flick counts and a tiny quick slide does not.
                var now = performance.now();
                var recent = samples.filter(function (s) { return now - s.t <= 100; });
                var first = recent.length ? recent[0] : samples[samples.length - 1];
                var last = samples[samples.length - 1];
                var speed = (last.y - first.y) / Math.max(1, last.t - first.t);
                if (dy > h * 0.25 || (dy >= FLICK_PX && speed > FLICK_SPEED)) {
                    close();
                } else {
                    dialog.style.removeProperty('--rsheet-drag');
                    setBehind(1);
                }
            }
            handle.addEventListener('pointermove', move);
            handle.addEventListener('pointerup', up);
            handle.addEventListener('pointercancel', up);
        });
    }

    // The tile's own download: page-actions.js shows the Ink Status check
    // and says "Download started".
    function download(tile) {
        tile._rsheetPass = true;
        try { tile.click(); } finally { tile._rsheetPass = false; }
    }

    // Capture phase, so the download (and its Ink Status check in
    // page-actions.js) only runs when the sheet is not taking the tap.
    document.addEventListener('click', function (e) {
        var tile = e.target.closest && e.target.closest('a.resume-track[download]');
        if (!tile || tile._rsheetPass || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return;
        if (typeof window.HTMLDialogElement !== 'function' || !('attachShadow' in window.Element.prototype)) return;
        var track = trackOf(tile);
        if (!track) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (loading) return;
        loading = true;
        tile.setAttribute('aria-busy', 'true');
        if (!dialog) build();
        var gen = generation;
        withLimit(Promise.all([load(track), styles()])).then(function (res) {
            loading = false;
            tile.removeAttribute('aria-busy');
            // The visitor may have left /resume while it loaded.
            if (gen === generation && tile.isConnected) open(tile, res[0]);
        }, function () {
            // The page could not be loaded: download the PDF as before.
            loading = false;
            tile.removeAttribute('aria-busy');
            if (gen === generation && tile.isConnected) download(tile);
        });
    }, true);

    // A router swap away from /resume closes the sheet and clears its state.
    window.addEventListener('page:ready', function () {
        generation++;
        loading = false;
        if (dialog && dialog.open) {
            closing = true;
            dialog.close();
        }
        reset();
    });

    window.ResumeSheet = { close: close };
})();
