/**
 * Stack Chip, an inline tech name with a small hand-sized glyph.
 *
 * Markup stays readable without JS: <span class="stack-chip"
 * data-stack="flutter">Flutter</span>. The helper prepends the glyph and,
 * when the name appears on at least two project cards, a tooltip such as
 * "In 11 of 31 projects" (also read out through visually hidden text).
 *
 * The counts below are checked against the project cards' tags by
 * tests/content-components.test.mjs, so they cannot drift.
 *
 * Brief (docs/motion-zen.md section 6a): hover lifts 1px, tooltip fades
 * in 180ms snap. Reduced motion: no lift, tooltip appears at once.
 *
 * @file js/components/stack-chip.js
 */
(function () {
    'use strict';

    var SVG_NS = 'http://www.w3.org/2000/svg';
    var TOTAL = 31;

    /* Glyphs are 24x24 strokes in currentColor. `match` is the tag
       pattern the test uses to recount projects. */
    var STACK = {
        flutter: { projects: 11, match: 'flutter', d: 'M13 3 4 12l3 3M13 11l-5 5 5 5h5l-5-5 5-5M18 3h-5' },
        nextjs: { projects: 8, match: 'next\\.js', d: 'M3.5 5.5h17v13h-17zM3.5 9.5h17M7 13l2.5 2.5L7 18' },
        react: { projects: 5, match: '\\breact\\b(?! native)', d: 'M12 12m-1.4 0a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0M12 7.5c5 0 9 2 9 4.5s-4 4.5-9 4.5-9-2-9-4.5 4-4.5 9-4.5zM8.1 9.75c2.5-4.3 6.2-6.9 8.4-5.6s1.9 5.8-.6 10.1-6.2 6.9-8.4 5.6-1.9-5.8.6-10.1zM15.9 9.75c2.5 4.3 2.8 8.8.6 10.1s-5.9-1.3-8.4-5.6-2.8-8.8-.6-10.1 5.9 1.3 8.4 5.6z' },
        'react-native': { projects: 2, match: 'react native', d: 'M7.5 2.5h9a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V4a1.5 1.5 0 0 1 1.5-1.5zM10.5 18.5h3' },
        typescript: { projects: 1, match: 'typescript', d: 'M8 7 3 12l5 5M16 7l5 5-5 5M14 4l-4 16' },
        bun: { projects: 9, match: '\\bbun\\b|hono', d: 'M13 2 4.5 13.5H12L11 22l8.5-11.5H12z' },
        node: { projects: 3, match: 'node\\.js|express', d: 'M12 2.5 20.5 7.5v9L12 21.5 3.5 16.5v-9zM12 8v8M9 10.5l3-2.5 3 2.5' },
        python: { projects: 3, match: 'python|pytorch|fastapi|tensorflow|keras', d: 'M9 4.5h5a3 3 0 0 1 3 3V11H9a3 3 0 0 0-3 3v2.5M15 19.5h-5a3 3 0 0 1-3-3V13h8a3 3 0 0 0 3-3V7.5M10.5 7.5h.01M13.5 16.5h.01' },
        postgres: { projects: 2, match: 'postgres', d: 'M4.5 6c0-1.7 3.4-3 7.5-3s7.5 1.3 7.5 3-3.4 3-7.5 3-7.5-1.3-7.5-3zM4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3' },
        firebase: { projects: 3, match: 'firebase', d: 'M12 2.5c1 3 4.5 5.5 4.5 10a4.5 4.5 0 0 1-9 0c0-2.5 1.5-4 2.5-5 .3 1.8 1 2.8 2 3.5 0-3.5-1-6-0-8.5z' },
        docker: { projects: 1, match: 'docker', d: 'M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16zM3.5 8 12 12.5 20.5 8M12 12.5v8' },
        ai: { projects: 5, match: 'gemini|ollama|langchain|pytorch|huggingface|lstm|bitnet|tensorflow', d: 'M8 5.5h8a2.5 2.5 0 0 1 2.5 2.5v8a2.5 2.5 0 0 1-2.5 2.5H8A2.5 2.5 0 0 1 5.5 16V8A2.5 2.5 0 0 1 8 5.5zM9.5 2.5v3M14.5 2.5v3M9.5 18.5v3M14.5 18.5v3M2.5 9.5h3M2.5 14.5h3M18.5 9.5h3M18.5 14.5h3M10 10h4v4h-4z' },
        solidity: { projects: 0, match: 'solidity|web3|ethereum', d: 'M12 2.5 5.5 12 12 15.5 18.5 12zM5.5 13.5 12 21.5l6.5-8L12 17z' },
        homelab: { projects: 1, match: 'minio|coolify|traefik', d: 'M4 4.5h16v5H4zM4 14.5h16v5H4zM7.5 7h.01M7.5 17h.01M11 7h5M11 17h5' }
    };

    var uid = 0;

    function glyph(d) {
        var svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('class', 'stack-chip-icon');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        var path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-width', '1.8');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(path);
        return svg;
    }

    function mount(el) {
        var spec = STACK[el.getAttribute('data-stack')];
        if (!spec || el.querySelector('.stack-chip-icon')) return null;
        el.classList.add('stack-chip');
        el.insertBefore(glyph(spec.d), el.firstChild);
        // data-tip="" opts out (dense grids); a value replaces the count.
        var tipText = el.hasAttribute('data-tip') ? el.getAttribute('data-tip') :
            (spec.projects >= 2 ? 'In ' + spec.projects + ' of ' + TOTAL + ' projects' : '');
        if (!tipText) return null;
        var tip = document.createElement('span');
        tip.className = 'stack-chip-tip';
        tip.setAttribute('role', 'tooltip');
        tip.id = 'stackTip' + (++uid);
        tip.textContent = tipText;
        el.appendChild(tip);
        el.setAttribute('aria-describedby', tip.id);
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
        // Escape dismisses the tooltip until the pointer or focus leaves.
        var onKey = function (e) {
            if (e.key === 'Escape') el.classList.add('is-tip-dismissed');
        };
        var onLeave = function () { el.classList.remove('is-tip-dismissed'); };
        el.addEventListener('keydown', onKey);
        el.addEventListener('pointerleave', onLeave);
        el.addEventListener('blur', onLeave);
        return { tip: tip, onKey: onKey, onLeave: onLeave };
    }

    function unmount(el, state) {
        if (!state) return;
        el.removeEventListener('keydown', state.onKey);
        el.removeEventListener('pointerleave', state.onLeave);
        el.removeEventListener('blur', state.onLeave);
        if (state.tip.parentNode) state.tip.parentNode.removeChild(state.tip);
    }

    try {
        window.StackChip = { stack: STACK, total: TOTAL };
    } catch (e) { /* noop */ }

    if (window.Mount) {
        window.Mount.register('stack-chip', { selector: '[data-stack]', mount: mount, unmount: unmount });
    }
})();
