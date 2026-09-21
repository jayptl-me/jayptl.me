# Jay's Taste — jayptl.me (extracted from code, 2026-09-16)

How this site is supposed to look, move, and read. Every claim traces to
shipped code; rulings at the bottom resolved contradictions found by
code search. Global laws (Two-Gate, hand-written only) live in AGENTS.md.

## 1. Hand-made, not framework-made
Vanilla HTML/CSS/JS, no frameworks, no build-step rewrites, zero runtime
dependencies (verified: `package.json` carries build tooling only, no CDN
scripts — analytics preconnects are the sole third parties, behind strict
`self`-first CSP). Self-hosted fonts. IIFE + `'use strict'` + JSDoc file
headers. ITCSS-layered stylesheets with design tokens. Footer signoff states
it outright.

## 2. Two themes that never mix
Light = skeuomorphic blue ramp (`#2196f3` family: `1976d2`, `bbdefb`,
`90caf9`, `e3f2fd`). Dark = glassmorphism turquoise ramp (`#00b8cc`
family: `26c9d8`, `4dd0e1`, `2dd4bf`, `b3f4f8`). NEVER blue in dark —
enforced through tokens (`--theme-icon`, `--theme-icon-glow-rgb`), never
raw hex in components. Surfaces split by theme too: skeu raised shadows
light, glass glow tokens dark.

## 3. Color: ramps, accents, disciplined gradients
Semantic accents ride alongside the ramps: amber/red (`fbbf24`, `d97706`,
`dc2626`) for warning/danger, purple-blue (`7c3aed`) for info, teal
(`0f766e`) for success — see the icon modifier classes. Gradients are
allowed INSIDE the ramp: icon fills (`--icon-gradient-start/end`),
ambient glows, progress fills, `--theme-gradient-text` backgrounds.
Banned: gradient text washes, competing hues, more than one accent per
surface. (Ruling 1, 2026-09-16.)

## 4. Four type voices, one locked hero face
Display Space Grotesk, body IBM Plex Sans (65ch cap), hand Architects
Daughter (annotations only, 16px floor, exactly one casual voice), mono
IBM Plex Mono with tabular numerals for every number/readout. Audiowide
is locked to the hero reveal + preloader and nothing else.

## 5. Doodle-led, HUD accents
Hand-drawn SVG annotations in `currentColor` (round caps, zero-gradient
strokes): arrow, underline, circle, brackets, sparkle, tape, scissors,
asterisk. Flat marker band, paper grid at 8% alpha max, one torn edge per
viewport max, stickers capped at ±12deg with one idle bob and a reset toy.
HUD grammar (micro-labels, readouts, corner frames, FIG captions) only
where real data exists — fake telemetry is banned.

## 6. Motion on the compositor, stillness by default
Full law: `docs/motion-zen.md` (GATE R Option A, 2026-09-20). One snap
curve `cubic-bezier(0.16, 1, 0.3, 1)`; exits 140-200ms together with no
lift, entries 240-520ms delayed with 60ms stagger; pixel edges-exit /
center-reveal; theme 380ms single clock; opacity/transform/clip only.
Stale easings noted here previously (`(0,0,0.2,1)`, spring
`(0.2,0.8,0.2,1)`) remain in old components as violators — do not copy,
see `motion-zen.md` section 5. 27+ `prefers-reduced-motion` guards —
every effect collapses to a static, fully-drawn end state. Nothing
flashes faster than 3x/sec. Canvas work is capped (DPR <= 2, particle
budgets) and paused when hidden.

## 7. Tactile play, never decoration-only
Sound effects (hover, stepper steps, lightsaber theme toggle), custom
cursor, hover lifts, the sticker reset toy. At least one interactive toy
per doodle system; static doodles must earn their place by annotating
content.

## 8. Accessibility is load-bearing
sr-only H1s, polite live-region hero announcements, labelled controls,
`focus-visible` rings, 16px type floors, hand-ink contrast checked on
glass, canvas hosts expose `role="img"` + sr-only text, split chars are
`aria-hidden` behind a labelled host.

## 9. Performance discipline
Critical shell inline + preloaded stylesheet (single source of truth per
rule — no inline copies), two-frame animation restarts instead of sync
reflows, debounced observers, cached viewport reads, `scrollbar-gutter:
stable` so locks never shift layout.

## 10. Machine-readable hospitality
`humans.txt`, `llms.txt` + `llms-full.txt`, `openapi.json`, sitemap, and a
markdown companion per route. The site courts crawlers and agents as
first-class readers.

## 11. Trust, stated honestly
Analytics (GA + Cloudflare Insights) load ONLY after explicit consent —
consent-mode defaults deny; strict CSP; privacy/cookie controls on
`pages/privacy.html`. Footers read "Analytics only with your consent."
(Ruling 2, 2026-09-16.)

## Retired (not taste)
Gradient text washes, inset/neumorphism shadows, full-page flicker,
carousel auto-rotation, emoji, doodle wallpaper, wobble-everything, two
handwriting voices, thin script on glass, handwriting under 16px,
rotation chaos, pre-split `.char` spans + `sandMerge` (replaced 2026-09-16
by runtime SplitText + particle field).

## Rulings log
- 2026-09-16 / gradients: document current in-ramp gradient use as the
  taste; the "no gradients" ban is narrowed to gradient text. Edited
  `pages/design-system.html` color law + Retired tile.
- 2026-09-16 / trackers: footers reworded to "Analytics only with your
  consent" (`index.html` ×2, `pages/design-system.html`); analytics stays
  consent-gated as built.
- 2026-09-16 / dead CSS: `sandMerge` / `.char` / `.text-line` / `.word`
  rules deleted from `css/components/scroll-reveal.css` (~150 lines).
- 2026-09-16 / critical CSS: inline text-reveal + `.gradient-text` copies
  deleted from `index.html` head; `css/components/scroll-reveal.css` is
  the single source (preloader shell stays inline and covers first paint).

## Known follow-ups (found, not yet ruled)
- `css/critical.css` is unlinked build residue duplicating live rules.
- Dormant `--theme-gradient-text` tokens + `.gradient-text` rules have no
  consumers since the char spans were removed.
- `data-role` attributes on hero items are context-only (no JS reads them).
