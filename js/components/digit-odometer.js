/**
 * Digit Odometer, rolling digit columns that settle on a value. Used for
 * page views, which arrive from the API after the page has loaded.
 *
 *   <span class="odometer" data-odometer aria-live="off"></span>
 *   window.DigitOdometer.set(el, 1234)
 *
 * Brief (docs/motion-zen.md section 6a): each digit is a column of 0 to 9
 * moved with transform over 800ms on the snap curve; width never moves
 * (mono tabular digits). The accessible name is the formatted number.
 * Reduced motion: columns jump to the value.
 *
 * @file js/components/digit-odometer.js
 */
(function () {
    'use strict';

    if (window.DigitOdometer) return;

    function reduced() {
        try {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) {
            return false;
        }
    }

    function column() {
        var col = document.createElement('span');
        col.className = 'odo-col';
        var reel = document.createElement('span');
        reel.className = 'odo-reel';
        for (var d = 0; d <= 9; d++) {
            var digit = document.createElement('span');
            digit.textContent = String(d);
            reel.appendChild(digit);
        }
        col.appendChild(reel);
        return col;
    }

    function set(el, value) {
        var n = Math.max(0, Math.floor(Number(value) || 0));
        var text = n.toLocaleString('en-US');
        el.classList.add('odometer');
        el.setAttribute('aria-label', text);
        var face = el.querySelector(':scope > .odo-face');
        if (!face) {
            el.textContent = '';
            face = document.createElement('span');
            face.className = 'odo-face';
            face.setAttribute('aria-hidden', 'true');
            el.appendChild(face);
        }
        // Rebuild the slots to match the new length, then roll each reel.
        var chars = text.split('');
        var slots = Array.from(face.children);
        while (slots.length > chars.length) face.removeChild(slots.shift());
        while (slots.length < chars.length) {
            var fresh = column();
            face.insertBefore(fresh, face.firstChild);
            slots.unshift(fresh);
        }
        var instant = reduced();
        chars.forEach(function (ch, i) {
            var slot = slots[i];
            if (!/\d/.test(ch)) {
                slot.className = 'odo-sep';
                slot.textContent = ch;
                return;
            }
            if (!slot.classList.contains('odo-col')) {
                var col = column();
                face.replaceChild(col, slot);
                slot = col;
            }
            var reel = slot.firstChild;
            if (instant) reel.style.transition = 'none';
            // Two frames so a fresh column starts at 0 and rolls up.
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    reel.style.transform = 'translateY(' + (-Number(ch) * 10) + '%)';
                });
            });
        });
    }

    window.DigitOdometer = { set: set };
})();
