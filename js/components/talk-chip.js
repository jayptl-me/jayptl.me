/**
 * Talk Chip, "Book 15 min" plus "Copy email", reused everywhere.
 *
 * The book half is a plain link (the router handles it). The copy half is
 * any button with data-copy: one delegated listener copies the value,
 * shows a hand-written "copied" note beside it for 1.6s, and announces it
 * to screen readers. Works for chips that arrive with a router swap.
 *
 * Brief (docs/motion-zen.md section 6a): note fades in 180ms, out 140ms,
 * snap curve. Reduced motion: appears and disappears at once.
 * UI system round (section 6b): page pills also show the Ink Status check
 * or cross, and the note is placed per screen: beside the copy pill when
 * the spot is free, otherwise below or above it, whichever covers no text.
 *
 * @file js/components/talk-chip.js
 */
(function () {
    'use strict';

    if (window.TalkChip) return;

    var HOLD_MS = 1600;

    function liveRegion() {
        var el = document.getElementById('talkChipLive');
        if (!el) {
            el = document.createElement('div');
            el.id = 'talkChipLive';
            el.className = 'sr-only';
            el.setAttribute('aria-live', 'polite');
            el.setAttribute('role', 'status');
            document.body.appendChild(el);
        }
        return el;
    }

    function writeClipboard(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(text); });
            }
        } catch (e) { /* fall through */ }
        return Promise.resolve(fallback(text));
    }

    function fallback(text) {
        var area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(area);
        return ok;
    }

    function swapLabel(btn, ok) {
        var label = btn.querySelector('span');
        if (!label) return;
        if (!btn._label) btn._label = label.textContent;
        label.textContent = ok ? 'Copied' : btn.getAttribute('data-copy');
        clearTimeout(btn._timer);
        btn._timer = setTimeout(function () { label.textContent = btn._label; }, HOLD_MS);
    }

    var GUTTER = 16;
    var GAP = 10;
    var TEXTY = 'p, h1, h2, h3, h4, h5, h6, li, dt, dd, a, button, label, figcaption, blockquote, .hand, .ink';

    /** True when the note's box would sit on other text or past the edge. */
    function collides(host, box) {
        if (box.left < GUTTER / 2 || box.right > window.innerWidth - GUTTER / 2 || box.top < 0) return true;
        var xs = [box.left + 2, (box.left + box.right) / 2, box.right - 2];
        var ys = [box.top + 2, (box.top + box.bottom) / 2, box.bottom - 2];
        for (var i = 0; i < xs.length; i++) {
            for (var j = 0; j < ys.length; j++) {
                var hits = document.elementsFromPoint ? document.elementsFromPoint(xs[i], ys[j]) : [];
                for (var k = 0; k < hits.length; k++) {
                    var el = hits[k];
                    if (host.contains(el)) continue;
                    if (el.closest && el.closest(TEXTY) && !el.closest('.site-nav, #glassNav')) return true;
                }
            }
        }
        return false;
    }

    /**
     * Beside the pill, below it, or above it: the first spot that stays on
     * screen and covers no other text. Phones try below first, since the
     * stacked pills leave no room beside. Falls back to the first spot.
     */
    function placeNote(host, btn, note) {
        var hostBox = host.getBoundingClientRect();
        var btnBox = btn.getBoundingClientRect();
        note.style.visibility = 'hidden';
        note.classList.remove('talk-chip-note--right', 'talk-chip-note--above', 'talk-chip-note--below');
        var w = note.getBoundingClientRect().width || 80;
        var h = note.getBoundingClientRect().height || 24;
        var cx = btnBox.left + btnBox.width / 2;
        var spots = {
            right: { cls: 'talk-chip-note--right', left: btnBox.right + GAP, top: btnBox.top + btnBox.height / 2,
                box: { left: btnBox.right + GAP, right: btnBox.right + GAP + w, top: btnBox.top + btnBox.height / 2 - h / 2, bottom: btnBox.top + btnBox.height / 2 + h / 2 } },
            below: { cls: 'talk-chip-note--below', left: cx, top: btnBox.bottom + 6,
                box: { left: cx - w / 2, right: cx + w / 2, top: btnBox.bottom + 6, bottom: btnBox.bottom + 6 + h } },
            above: { cls: 'talk-chip-note--above', left: cx, top: btnBox.top - 6 - h,
                box: { left: cx - w / 2, right: cx + w / 2, top: btnBox.top - 6 - h, bottom: btnBox.top - 6 } }
        };
        var order = window.innerWidth < 600 ? ['below', 'above', 'right'] : ['right', 'below', 'above'];
        var pick = order[0];
        for (var i = 0; i < order.length; i++) {
            if (!collides(host, spots[order[i]].box)) { pick = order[i]; break; }
        }
        var spot = spots[pick];
        note.classList.add(spot.cls);
        note.style.left = (spot.left - hostBox.left) + 'px';
        note.style.top = (spot.top - hostBox.top) + 'px';
        note.style.visibility = '';
    }

    function showNote(btn, ok) {
        var host = btn.closest('.talk-chip');
        if (!host) {
            // Pills outside a chip (mobile island) say it in their own label.
            swapLabel(btn, ok);
            return;
        }
        var note = host.querySelector('.talk-chip-note');
        if (!note) {
            note = document.createElement('span');
            note.className = 'talk-chip-note hand';
            note.setAttribute('aria-hidden', 'true');
            host.appendChild(note);
        }
        note.textContent = ok ? 'copied' : btn.getAttribute('data-copy');
        if (!host.classList.contains('talk-chip--nav')) placeNote(host, btn, note);
        note.classList.add('is-shown');
        clearTimeout(note._timer);
        note._timer = setTimeout(function () {
            note.classList.remove('is-shown');
        }, ok ? HOLD_MS : HOLD_MS * 2);
    }

    document.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('button[data-copy]') : null;
        if (!btn) return;
        e.preventDefault();
        var value = btn.getAttribute('data-copy');
        writeClipboard(value).then(function (ok) {
            showNote(btn, ok);
            if (btn.classList.contains('pill-btn') && window.PillPress) window.PillPress.flash(btn, ok);
            liveRegion().textContent = ok ? 'Copied ' + value : 'Copy failed, the address is ' + value;
            try {
                if (ok && window.SoundManager && typeof window.SoundManager.playSelectSound === 'function') {
                    window.SoundManager.playSelectSound();
                }
            } catch (err) { /* noop */ }
        });
    });

    window.TalkChip = { copy: writeClipboard };
})();
