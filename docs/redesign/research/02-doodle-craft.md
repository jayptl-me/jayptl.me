# Doodle-Craft / Hand-Drawn Web Design - Candidate-Evidence Dossier

Context: jayptl.me redesign candidates. Hand-written vanilla HTML/CSS/JS only; light theme skeuomorphic blue ramp (#2196f3), dark theme turquoise glassmorphism (#00b8cc); zero gradients, zero inset shadows, ambient centered shadows only; prefers-reduced-motion collapse mandatory. This file gathers named evidence and portable techniques only - no winner picked, nothing ranked. Zero emojis.

Verification legend: [LIVE] = extracted/confirmed this session (2026-08-26); [SECONDHAND] = surfaced via search-result description, visual not independently verified.

---

## Section 1 - Named live sites with genuine hand-drawn / doodle aesthetics

### 1. Rough Notation - roughnotation.com [LIVE]
URL: https://roughnotation.com (source: https://github.com/rough-stuff/rough-notation)
The reference implementation of hand-drawn web annotation: underline, box, circle, highlight, strike-through, crossed-off, and multi-side brackets, animatable in ordered groups. It works because the doodles are FUNCTIONAL - each squiggle marks up real content, so the style is doing communication work, not decorating.
Portable techniques: the full annotation vocabulary (which style fits which emphasis job); animation ordering (annotation groups reveal one by one).

### 2. Rough.js - roughjs.com [LIVE]
URL: https://roughjs.com (MIT, author Preet Shihn)
Graphics library that draws lines/curves/arcs/polygons/circles in a sketchy hand-drawn style on Canvas or SVG; under 9kB gzipped; signature hachure fills (diagonal pencil-stroke shading with configurable angle/gap/weight). The engine underneath Rough Notation.
Portable techniques: generated-once SVG assets (draw card borders/arrows at build time, paste the SVG output - zero runtime dependency); hachure fill as accent texture inside badges/chips.

### 3. Excalidraw - excalidraw.com [LIVE]
URL: https://excalidraw.com (OSS whiteboard)
Proof that a whole product surface can live in the hand-drawn register while staying legible and professional. The sketch style is applied to geometry, never to text rendering.
Portable techniques: export Excalidraw drawings as SVG assets for diagrams/illustrations; the principle "wobbly shapes, clean type".

### 4. Parth Mittal - mittalparth.dev [LIVE, local capture]
Source: local capture `/Users/jay/.hermes/cache/web/mittalparth.dev-a06672daca.md`
Sticker chips with handwritten captions scattered BETWEEN sections ("this is where the work happens", "oh, I also dance :)"), scissors cut-line graphics between hackathon cards, and a Reset stickers control. Works because doodles are personal (real hobbies, real jokes) and interactive (touchable, resettable).
Portable techniques: sticker-asides between sections rewarding scroll; one interactive toy control as footer easter egg.

### 5. CSS Tip: Hand-Drawn Underline using border-shape - css-tip.com [LIVE]
URL: https://css-tip.com/hand-drawn-underline (by Temani Afif; archive: https://css-tip.com/archive/)
Pure-CSS hand-drawn underline via the new `border-shape` property - no images, no JS. Archive lists more hand-drawn/sketch recipes by the same author.
Portable techniques: single-property sketchy underlines for nav links and headings; check browser support before committing (border-shape is very new - needs a fallback).

### 6. Lynn Fisher - lynnandtonic.com [LIVE]
URL: https://www.lynnandtonic.com (currently "v. XIX")
Nineteen complete art-directed redesigns of one personal site, version number worn proudly in the nav; famously responsive-art-driven (her a-single-div project: https://a.singlediv.com). Works because reinvention IS the content.
Portable techniques: versioned redesign identity ("v.X") as a personality beat; treating your own site's evolution as portfolio material (mirrors taniarascia.com's Redesigns series).

### 7. Byooooob / New Valley Labs (playful illustration sites) [SECONDHAND]
Directory evidence: https://reallygooddesigns.com/websites-with-illustrations/ (entries #8 Byooooob, #35 New Valley Labs - animated flowers moving eyes/hands)
Listed as living examples of full-illustration playful sites; visuals not independently verified this session - review before citing further.

### 8. Historical hand-drawn web canon [SECONDHAND]
Smashing Magazine roundup: https://www.smashingmagazine.com/2008/06/hand-drawing-style-in-modern-web-design-volume-2/
Documents the classic era of sketch-style portfolios (taped notes, torn paper, notebook grounds). Useful as an anti-pattern source too - the 2008 wave died when doodle became wallpaper rather than voice.

---

## Section 2 - Vanilla technique library (HTML/CSS/SVG, no framework)

Every entry: approach, support, perf, reduced-motion behavior.

1. **SVG draw-on strokes** (underlines, arrows, circles): inline `<svg><path>` with `stroke-dasharray` = path length and `stroke-dashoffset` animated to 0 on intersection (one tiny IntersectionObserver). Support: universal. Perf: transform/opacity-class animations only; animate `stroke-dashoffset` sparingly (it is a paint property - acceptable for short paths). Reduced motion: skip straight to fully drawn (`stroke-dashoffset: 0`, no transition).
2. **Sketchy edge wobble**: SVG filter `<feTurbulence>` + `<feDisplacementMap>` (scale 2-4) applied ONLY to decorative borders/dividers via `filter: url(#squiggle)`; never to body text. Support: all evergreen; Safari perf on large filtered areas is weak. Perf: apply to small elements; avoid animating turbulence seed per frame (constant re-render). Reduced motion: static filter is fine (it is not motion).
3. **border-shape hand-drawn underline** (https://css-tip.com/hand-drawn-underline/): pure CSS, four declarations class recipes. Support: bleeding-edge only - gate behind `@supports (border-shape: ...)` with a plain dotted-underline fallback. Perf: trivial.
4. **Hand-drawn annotation assets as SVG sprite**: author once in Excalidraw (or trace Rough.js output): arrow, circle, underline-squiggle, bracket-left/right, star-burst; ship as `<symbol>` sprite; place with absolutely-positioned `<svg><use>` over headings/badges. Support: universal. Perf: one HTTP-less inline sprite. Reduced motion: n/a (static).
5. **Marker-highlight text band**: flat translucent band behind text using `background: color-mix(in srgb, var(--accent) 22%, transparent)` on an inline element with `box-decoration-break: clone; padding: .1em .3em` - reads as highlighter WITHOUT any gradient (flat fill, hard edges). Slight rotation (-1deg) on the band sells the hand-made feel. Support: universal (color-mix evergreen; fallback rgba). Reduced motion: n/a.
6. **Paper grid ground**: `background-image: repeating-linear-gradient(0deg, line-color 0 1px, transparent 1px 24px), repeating-linear-gradient(90deg, ...)` - renders as crisp flat hairlines (graph paper), not a blended gradient; keep line alpha <= 8% so it stays texture, not pattern-noise. Dot-grid variant via `radial-gradient(circle, dot 1px, transparent 1px)` tiled. Support: universal. Perf: cheap, GPU-inert. Reduced motion: n/a.
7. **Sticker chips**: rotated cards (`rotate: var(--r)`) with `filter: drop-shadow(...)` ambient shadow, caption in handwriting face counter-rotated slightly; scatter between sections like mittalparth.dev. Optional Reset button randomizing `--r` in 4 lines of JS. Reduced motion: hide entrance animations, keep static stickers.
8. **Torn-paper / deckle edge**: `clip-path: polygon(...)` with 12-18 jittered points along one edge, or CSS `mask` with an SVG zigzag strip repeated horizontally. Support: universal. Perf: static, cheap. Use sparingly (max one torn edge per viewport).
9. **Rough.js build-time generation**: run Rough.js in a script ONCE to emit SVG paths for card frames/arrows; commit the SVGs. Gets hand-drawn geometry with ZERO runtime dependency - the clean answer to the third-party-law tension. Runtime alternative if Jay accepts two vendored micro-libs (~13kB total): rough-notation for scroll-triggered annotations.
10. **Global reduced-motion collapse**: wrap every draw-on/idle effect in `@media (prefers-reduced-motion: no-preference) { ... }` so the default state is fully-drawn static art.

---

## Section 3 - Handwritten / casual font candidates (free, Google Fonts)

Heading/display-casual:
- **Caveat** (variable 400-700): true handwriting flow, excellent x-height, the safest "annotated by a human" face; strong at 20px+. https://fonts.google.com/specimen/Caveat
- **Permanent Marker**: thick felt-marker display; ONE-word accents only (badges, sticker captions); reads childish above 3 words. https://fonts.google.com/specimen/Permanent+Marker
- **Patrick Hand**: print-style, most legible casual face at small sizes; good for long-ish handwritten lines. https://fonts.google.com/specimen/Patrick+Hand
- **Shadows Into Light**: tall narrow pencil face, airy; pairs well as annotation against geometric sans bodies. https://fonts.google.com/specimen/Shadows+Into+Light
- **Gochi Hand**: ballpoint-pen character, slightly techy slant - bridges doodle and engineering registers. https://fonts.google.com/specimen/Gochi+Hand
- **Kalam** (300/400/700): devanagari+latin handwriting; heavier weights hold up on glass backgrounds better than thin pencil faces. https://fonts.google.com/specimen/Kalam

Annotation/mono bridge for HUD readouts (pairs with any above):
- **JetBrains Mono** (also carried in hud-scifi.md section 3): real mono, tabular numerals, reads premium. https://www.jetbrains.com/lp/mono/
- Caveat-as-label trick: handwriting at ALL-CAPS + wide letter-spacing stops reading "script" and starts reading "stencil" - useful where doodle meets HUD.

Load discipline: subset via Google Fonts `text=` param for annotation faces used only on fixed strings (stickers/captions) - cuts Caveat to <10KB; `font-display: swap` everywhere; fallback stack `"Segoe Script", "Bradley Hand", cursive` sized +2% larger than the webfont to reduce swap reflow (handwriting faces run narrow).

---

## Section 4 - Anti-patterns (ways doodle style turns cheap)

1. **Doodle wallpaper**: lined-paper background + tape graphics on EVERY surface (the 2008 wave, https://www.smashingmagazine.com/2008/06/hand-drawing-style-in-modern-web-design-volume-2/) - kills hierarchy; doodles must annotate content, not replace layout.
2. **Wobble everything**: feTurbulence displacement on text or large panels = illegible + Safari jank. Wobble shapes, never words.
3. **Two-plus handwriting faces competing**: one handwriting voice per page; a second casual face instantly reads scrapbook-mess.
4. **Thin script on glass**: light-weight handwriting (Shadows Into Light 400) on turquoise glass fails contrast; use Kalam 500+/Caveat 600+ on dark surfaces.
5. **Decoration without interaction**: static doodles age fast (evidence across structures.md anti-pattern #10); give at least one doodle system a toy (reset, hover redraw).
6. **Emoji standing in for drawn doodles**: reads lazy and violates the zero-emoji deliverable law; actual SVG strokes cost little and look authored.
7. **Handwriting below 16px**: script letterforms disintegrate; captions start at 16px, annotations at 18px+.
8. **Random rotation chaos**: rotations beyond +/-12deg break scanning; cap variance, align baselines within sections.
