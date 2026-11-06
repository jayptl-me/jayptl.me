/**
 * Headline Arrival: an inner page's headline arrives once, word by word,
 * each word rising out of a soft blur (docs/motion-zen.md section 6d).
 *
 * Text stays text: only text nodes are split into word spans and the
 * spaces between them are kept, so the heading reads the same to
 * assistive tech. Element children (ink marks) arrive as one unit and
 * keep their own markup. The words start when the staged entry reveals
 * the heading's block, so they never play under the veil.
 *
 * Home is excluded: its particle text and stepper own the hero. A case
 * study reached by the card-to-cover morph is excluded too: the morph is
 * already its title's entrance. Reduced motion is handled in CSS: the
 * words are simply there.
 *
 * @file js/components/arrive.js
 */
(function () {
    'use strict';

    var SAFETY_MS = 1200;

    // Words break only at real spaces (a no-break space keeps its pair), and
    // a run that touches the unit before it (a period after an ink mark)
    // stays on that unit's line.
    function split(h) {
        var i = 0;
        var last = null;
        Array.prototype.slice.call(h.childNodes).forEach(function (node) {
            if (node.nodeType === 3) {
                var frag = document.createDocumentFragment();
                var touching = last && node.previousSibling === last;
                node.nodeValue.split(/([ \t\n\r]+)/).forEach(function (part, k) {
                    if (!part) return;
                    if (/^[ \t\n\r]+$/.test(part)) {
                        frag.appendChild(document.createTextNode(part));
                        touching = false;
                        return;
                    }
                    var w = document.createElement('span');
                    w.className = 'arrive-w arrive-t';
                    w.style.setProperty('--i', String(i++));
                    w.textContent = part;
                    if (k === 0 && touching) {
                        var nb = document.createElement('span');
                        nb.className = 'arrive-nb';
                        h.insertBefore(nb, last);
                        nb.appendChild(last);
                        nb.appendChild(w);
                        last = nb;
                        return;
                    }
                    frag.appendChild(w);
                    last = w;
                });
                h.replaceChild(frag, node);
            } else if (node.nodeType === 1) {
                node.classList.add('arrive-w');
                node.style.setProperty('--i', String(i++));
                last = node;
            }
        });
    }

    // A router swap still behind its cover, before its staged entry began:
    // the page is not showing yet.
    function covered() {
        var html = document.documentElement;
        if (html.classList.contains('pt-exiting') || html.classList.contains('pt-covering')) return true;
        return !!document.querySelector('main.pt-swapped') && !html.classList.contains('pt-entering');
    }

    function mount(h, retried) {
        if (document.documentElement.classList.contains('pt-morphing')) return null;
        if (!retried && covered()) {
            // Loaded by the router before its staged entry began: try again
            // once the swap announces itself.
            var retry = function () {
                window.removeEventListener('page:ready', retry);
                if (h.isConnected && !h.classList.contains('arrive')) h._arrive = mount(h, true);
            };
            window.addEventListener('page:ready', retry);
            return { stop: function () { window.removeEventListener('page:ready', retry); if (h._arrive) h._arrive.stop(); } };
        }
        split(h);
        h.classList.add('arrive', 'is-waiting');
        var item = h.closest('.pt-item');
        var observer = null;
        var timer = null;

        function start() {
            if (observer) observer.disconnect();
            clearTimeout(timer);
            observer = null;
            h.classList.remove('is-waiting');
            h.classList.add('is-arriving');
        }

        var entering = document.documentElement.classList.contains('pt-entering');
        if (!item || !entering || item.classList.contains('pt-in')) {
            start();
        } else {
            observer = new MutationObserver(function () {
                if (item.classList.contains('pt-in')) start();
            });
            observer.observe(item, { attributes: true, attributeFilter: ['class'] });
            // Never leave the headline hidden.
            timer = setTimeout(start, SAFETY_MS);
        }
        return { stop: function () { if (observer) observer.disconnect(); clearTimeout(timer); } };
    }

    function unmount(h, state) {
        if (state) state.stop();
    }

    function register() {
        if (!window.Mount) return;
        window.Mount.register('arrive', {
            selector: 'main h1:not(.split-host)',
            mount: function (h) {
                // One headline per page: the first one in main.
                var first = document.querySelector('main h1');
                if (h !== first || document.querySelector('.text-reveal-container')) return null;
                return mount(h);
            },
            unmount: unmount
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', register);
    } else {
        register();
    }
})();
