/**
 * Ink Mark, hand-drawn annotations that draw themselves on.
 *
 * Turns <span data-ink="squiggle">ships the story</span> into the same
 * text plus an inline, aria-hidden SVG stroke, so the shipped draw-on
 * (doodle.css, pathLength=1, dashoffset 1 -> 0) can animate it. Sprite
 * <use> copies cannot be dash-animated, so this path table is the single
 * source for animated marks; assets/doodle-sprite.svg carries the same
 * shapes for static use.
 *
 * Placement comes from the mark (data-ink-place overrides it):
 *   under   stroke under the text          (squiggle)
 *   behind  highlighter swipe behind text  (marker)
 *   over    crossed out                    (scribble-out)
 *   around  drawn around the text          (box, here)
 *   side    brace on the left of a block   (brace)
 *   solo    inline mark on its own         (heart, check, burst, loop-arrow, margin)
 *   block   full-width divider             (zigzag)
 *
 * An empty host renders as solo. Reduced motion and no-JS keep the
 * text untouched and the mark fully drawn.
 *
 * @file js/components/ink-mark.js
 */
(function () {
    'use strict';

    var SVG_NS = 'http://www.w3.org/2000/svg';

    /* viewBox, stroke width, default placement, stretch, paths. Stretched
       marks use non-scaling strokes so the line weight stays hand-sized. */
    var MARKS = {
        squiggle: {
            box: '0 0 120 12', w: 2.4, place: 'under', stretch: true,
            d: ['M3 7 C9 2 13 2 17 6 S25 11 30 6 S38 1 43 6 S51 11 56 6 S64 2 69 6 S77 10 82 6 S90 2 95 6 S103 10 108 6 S114 3 117 5']
        },
        marker: {
            box: '0 0 120 24', w: 13, place: 'behind', stretch: true,
            d: ['M6 15 C30 12 62 14 88 11 C100 10 108 10 114 10']
        },
        'scribble-out': {
            box: '0 0 120 24', w: 2.2, place: 'over', stretch: true,
            d: ['M3 13 C12 6 18 18 26 11 C34 4 40 18 49 11 C58 4 64 18 73 11 C82 4 88 18 97 11 C104 6 110 14 117 10']
        },
        'loop-arrow': {
            box: '0 0 72 40', w: 2.2, place: 'solo',
            d: ['M4 30 C14 30 22 26 26 18 C30 10 24 4 19 8 C14 12 20 22 32 24 C44 26 54 22 64 17 M56 12 L64 17 L57 24']
        },
        heart: {
            box: '0 0 24 22', w: 2, place: 'solo',
            d: ['M12 20 C6 15 2 11 2.8 7 C3.6 3.4 8 2.4 10.4 5.2 C11.2 6.1 11.7 7 12 7.8 C12.6 6 14 3.8 16.6 3.4 C20 3 22 6 21.2 9 C20.2 13 16 16.4 12.4 20.4']
        },
        check: {
            box: '0 0 24 24', w: 2.4, place: 'solo',
            d: ['M4 13 C6 14.5 8 16.5 9.5 19 C12 13 15.5 8 20.5 4']
        },
        box: {
            box: '0 0 100 40', w: 2, place: 'around', stretch: true,
            d: ['M5 6 C35 4 68 5 95 5 C96 15 96 26 95 35 C66 36 34 36 6 35 C4 25 4 14 6 4 L12 5']
        },
        brace: {
            box: '0 0 20 100', w: 2.2, place: 'side', stretch: true,
            d: ['M16 3 C9 4 8 8 8 16 L8 40 C8 46 6 49 2 50 C6 51 8 54 8 60 L8 84 C8 92 9 96 16 97']
        },
        burst: {
            box: '0 0 64 64', w: 1.8, place: 'solo',
            d: ['M32 1.5 L37.6 11.1 L46.7 6.6 L46.7 17.3 L58.3 16.8 L52.8 26.4 L61.2 32 L53.9 37.9 L58.6 47.4 L47 47 L46.9 57.9 L37.8 53.6 L32 63 L26.8 51.5 L16.8 58.4 L17.4 46.6 L5.1 47.5 L12.2 37.3 L1.3 32 L11.3 26.4 L6.4 17.2 L17.8 17.8 L16.1 4.4 L26.1 9.9 L32 1.5 L37.6 11.1']
        },
        zigzag: {
            box: '0 0 240 12', w: 2, place: 'block',
            d: ['M2 7 L10 3 L17 9 L25 3 L33 9 L40 4 L48 9 L56 3 L63 8 L71 3 L79 9 L86 4 L94 9 L102 3 L109 8 L117 3 L125 9 L132 4 L140 9 L148 3 L155 8 L163 3 L171 9 L178 4 L186 9 L194 3 L201 8 L209 3 L217 9 L224 4 L232 8 L238 6']
        },
        here: {
            box: '0 0 80 48', w: 2.2, place: 'around', stretch: true,
            d: ['M52 8 C40 3 18 5 10 14 C3 22 8 34 24 38 C42 42 64 38 70 28 C75 19 66 10 52 8 C44 7 36 9 32 12 M70 31 C73 36 75 40 77 45']
        },
        margin: {
            box: '0 0 64 40', w: 2, place: 'solo',
            d: ['M4 6 C16 4 30 8 38 18 C44 25 48 30 57 32 M49 27 L57 32 L50 37']
        }
    };

    function buildSvg(name, spec, place) {
        var svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('class', 'ink-svg doodle-draw');
        svg.setAttribute('viewBox', spec.box);
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        if (spec.stretch && place !== 'solo') svg.setAttribute('preserveAspectRatio', 'none');
        spec.d.forEach(function (d) {
            var path = document.createElementNS(SVG_NS, 'path');
            path.setAttribute('d', d);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', 'currentColor');
            path.setAttribute('stroke-width', String(spec.w));
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('stroke-linejoin', 'round');
            path.setAttribute('pathLength', '1');
            if (spec.stretch && place !== 'solo') path.setAttribute('vector-effect', 'non-scaling-stroke');
            svg.appendChild(path);
        });
        return svg;
    }

    function mount(el) {
        var name = el.getAttribute('data-ink');
        var spec = MARKS[name];
        if (!spec || el.querySelector(':scope > .ink-svg')) return null;
        var hasText = (el.textContent || '').trim().length > 0;
        var place = el.getAttribute('data-ink-place') || spec.place;
        if (!hasText && place !== 'block') place = 'solo';
        el.classList.add('ink', 'ink--' + place, 'ink--' + name);
        if (!hasText) el.setAttribute('aria-hidden', 'true');
        var svg = buildSvg(name, spec, place);
        if (place === 'side' || (place === 'solo' && el.hasAttribute('data-ink-before'))) {
            el.insertBefore(svg, el.firstChild);
        } else {
            el.appendChild(svg);
        }
        try {
            if (window.Doodle && typeof window.Doodle.draw === 'function') window.Doodle.draw(svg);
            else svg.classList.add('is-drawn');
        } catch (e) {
            svg.classList.add('is-drawn');
        }
        return svg;
    }

    function unmount(el, svg) {
        if (svg && svg.parentNode) svg.parentNode.removeChild(svg);
    }

    try {
        window.InkMark = { marks: Object.keys(MARKS), mount: mount };
    } catch (e) { /* noop */ }

    if (window.Mount) {
        window.Mount.register('ink-mark', { selector: '[data-ink]', mount: mount, unmount: unmount });
    }
})();
