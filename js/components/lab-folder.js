/**
 * Lab Folder, a folder that fans out up to three FIG cards.
 *
 * Markup works without JS (the cards simply show in a row):
 *   <div class="lab-folder" data-component="lab-folder">
 *     <button class="lab-folder-tab" type="button" aria-expanded="true"
 *             aria-controls="labCards">...</button>
 *     <ul class="lab-folder-cards" id="labCards">
 *       <li class="lab-card">...</li>
 *     </ul>
 *   </div>
 *
 * Brief (docs/motion-zen.md section 6a, picked "Fan out"): the flap opens
 * and the cards fan out in 240ms snap with 60ms steps, tilted within 8deg;
 * closing tucks them back in 140ms, together. Escape closes and returns
 * focus to the folder. Reduced motion: cards show and hide at once.
 *
 * @file js/components/lab-folder.js
 */
(function () {
    'use strict';

    var CLOSE_MS = 140;
    var FAN = [-7, 0, 6];

    function sound() {
        try {
            if (window.SoundManager && window.SoundManager.playSelectSound) window.SoundManager.playSelectSound();
        } catch (e) { /* noop */ }
    }

    function mount(root) {
        var tab = root.querySelector('.lab-folder-tab');
        var list = root.querySelector('.lab-folder-cards');
        if (!tab || !list) return null;
        var cards = Array.from(list.children);
        cards.forEach(function (card, i) {
            card.style.setProperty('--fan', (FAN[i] !== undefined ? FAN[i] : 0) + 'deg');
            card.style.setProperty('--i', String(i));
        });
        var timer = null;

        function setOpen(open) {
            clearTimeout(timer);
            tab.setAttribute('aria-expanded', open ? 'true' : 'false');
            if (open) {
                list.hidden = false;
                root.classList.remove('is-closing');
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () { root.classList.add('is-open'); });
                });
                sound();
            } else {
                root.classList.remove('is-open');
                root.classList.add('is-closing');
                timer = setTimeout(function () {
                    list.hidden = true;
                    root.classList.remove('is-closing');
                }, CLOSE_MS);
            }
        }

        function onClick() {
            setOpen(tab.getAttribute('aria-expanded') !== 'true');
        }

        function onKey(e) {
            if (e.key === 'Escape' && tab.getAttribute('aria-expanded') === 'true') {
                setOpen(false);
                tab.focus();
            }
        }

        root.classList.add('is-enhanced');
        list.hidden = true;
        tab.setAttribute('aria-expanded', 'false');
        tab.addEventListener('click', onClick);
        root.addEventListener('keydown', onKey);
        return {
            destroy: function () {
                clearTimeout(timer);
                tab.removeEventListener('click', onClick);
                root.removeEventListener('keydown', onKey);
            }
        };
    }

    if (window.Mount) {
        window.Mount.register('lab-folder', {
            mount: mount,
            unmount: function (el, state) { if (state) state.destroy(); }
        });
    }
})();
