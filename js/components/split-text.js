/**
 * SplitText — vanilla split-stagger text reveal (Gate P, S1).
 * Custom vanilla split-stagger text reveal with zero external dependencies
 * (no GSAP): splitType chars/words, per-letter delay, duration, threshold,
 * rootMargin, once, and a completion signal. Runs on CSS transitions
 * (opacity/transform only) driven by an IntersectionObserver.
 *
 * Host markup (written as plain text; JS does the splitting):
 *   <p class="split-host" data-split="chars" data-split-delay="55"
 *      data-split-duration="600" data-split-threshold="0.1"
 *      data-split-root-margin="0px" aria-label="Cross platform dev">
 *     CROSS PLATFORM DEV
 *   </p>
 *
 * Hosts with [data-split-manual] are split but never auto-played — the
 * owner (scroll-reveal stepper) calls SplitText.play()/reset() instead.
 * Completion: host gets [data-split-done] + a `splittext:done` CustomEvent
 * (mirrors onLetterAnimationComplete).
 *
 * Chars are aria-hidden; the host keeps the accessible name. Reduced motion
 * (or no IntersectionObserver): hosts render fully shown immediately.
 *
 * @file components/split-text.js
 */
(function () {
    'use strict';

    var DEFAULT_DELAY = 50; // ms between letters default
    var DEFAULT_DURATION = 600; // ms per letter
    var DEFAULT_THRESHOLD = 0.1;

    function readOpts(host) {
        var d = host.dataset;
        function num(key, fallback) {
            var v = parseFloat(d[key]);
            return isNaN(v) ? fallback : v;
        }
        return {
            type: (d.split === 'words' || d.split === 'lines') ? d.split : 'chars',
            delay: num('splitDelay', DEFAULT_DELAY),
            duration: num('splitDuration', DEFAULT_DURATION),
            threshold: num('splitThreshold', DEFAULT_THRESHOLD),
            rootMargin: d.splitRootMargin || '0px',
            once: d.splitOnce !== 'false',
            manual: host.hasAttribute('data-split-manual')
        };
    }

    /* Wrap one word's characters; returns the word span. */
    function wrapWord(doc, text, withChars) {
        var word = doc.createElement('span');
        word.className = 'split-word';
        word.setAttribute('aria-hidden', 'true');
        if (!withChars) {
            word.textContent = text;
            return word;
        }
        Array.prototype.forEach.call(text, function (ch, i) {
            var c = doc.createElement('span');
            c.className = 'split-char';
            c.textContent = ch;
            word.appendChild(c);
        });
        return word;
    }

    /* Split every text node under host into word/char spans (keeps
       wrapper elements such as .word-jay intact). */
    function split(host) {
        if (!host || host._splitText) {
            return (host && host._splitText) || null;
        }
        var opts = readOpts(host);
        var doc = host.ownerDocument;
        var walker = doc.createTreeWalker(host, NodeFilter.SHOW_TEXT, null);
        var nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);

        var units = [];
        nodes.forEach(function (node) {
            var frag = doc.createDocumentFragment();
            var parts = node.textContent.split(/(\s+)/);
            parts.forEach(function (part) {
                if (!part) return;
                if (/^\s+$/.test(part)) {
                    frag.appendChild(doc.createTextNode(' '));
                    return;
                }
                if (opts.type === 'words') {
                    var w = wrapWord(doc, part, false);
                    w.style.setProperty('--d', (units.length * opts.delay) + 'ms');
                    units.push(w);
                    frag.appendChild(w);
                } else {
                    var word = wrapWord(doc, part, true);
                    Array.prototype.forEach.call(word.childNodes, function (c) {
                        c.style.setProperty('--d', (units.length * opts.delay) + 'ms');
                        units.push(c);
                    });
                    frag.appendChild(word);
                }
            });
            node.parentNode.replaceChild(frag, node);
        });

        if (!host.hasAttribute('aria-label')) {
            host.setAttribute('aria-label', host.textContent.replace(/\s+/g, ' ').trim());
        }

        var state = {
            host: host,
            opts: opts,
            units: units,
            played: false,
            doneTimer: null,
            io: null
        };
        host._splitText = state;
        host.setAttribute('data-split-mounted', 'true');
        host.style.setProperty('--split-dur', opts.duration + 'ms');

        if (!opts.manual && 'IntersectionObserver' in window) {
            state.io = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    if (opts.once && state.io) state.io.unobserve(host);
                    play(host);
                });
            }, { threshold: opts.threshold, rootMargin: opts.rootMargin });
            state.io.observe(host);
        }
        return state;
    }

    function finish(host, state) {
        host.setAttribute('data-split-done', 'true');
        host.classList.add('is-split');
        state.played = true;
        host.dispatchEvent(new CustomEvent('splittext:done', { bubbles: true }));
    }

    function play(host) {
        var state = host && host._splitText;
        if (!state || state.played) return;
        var reduceMotion = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion || !('IntersectionObserver' in window)) {
            finish(host, state);
            return;
        }
        // Force reflow between reset and play so the transition re-runs.
        void host.offsetWidth;
        host.classList.add('is-split');
        state.played = true;
        var total = state.units.length * state.opts.delay + state.opts.duration + 60;
        state.doneTimer = setTimeout(function () {
            state.doneTimer = null;
            host.setAttribute('data-split-done', 'true');
            host.dispatchEvent(new CustomEvent('splittext:done', { bubbles: true }));
        }, total);
    }

    function reset(host) {
        var state = host && host._splitText;
        if (!state) return;
        if (state.doneTimer !== null) {
            clearTimeout(state.doneTimer);
            state.doneTimer = null;
        }
        host.classList.remove('is-split');
        host.removeAttribute('data-split-done');
        state.played = false;
    }

    function destroy(host) {
        var state = host && host._splitText;
        if (!state) return;
        if (state.doneTimer !== null) {
            clearTimeout(state.doneTimer);
            state.doneTimer = null;
        }
        if (state.io) state.io.disconnect();
        // Leave the host in its final visible state (never strand hidden text).
        host.classList.add('is-split');
        host.setAttribute('data-split-done', 'true');
        delete host._splitText;
        host.removeAttribute('data-split-mounted');
    }

    function init() {
        var hosts = document.querySelectorAll('[data-split]:not([data-split-mounted])');
        hosts.forEach(function (host) { split(host); });
        // Reduced-motion / no-IO: show everything immediately.
        var reduceMotion = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion || !('IntersectionObserver' in window)) {
            hosts.forEach(function (host) { play(host); });
        }
    }

    window.SplitText = {
        init: init,
        split: split,
        play: play,
        reset: reset,
        destroy: destroy,
        of: function (host) { return (host && host._splitText) || null; }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
