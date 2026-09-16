# Gate P — Implementation Plan: Doodle-Led Redesign (Whole Site)

Status: **APPROVED 2026-09-02.** Font stack **A — Engineer Notebook** chosen via live preview
(`preview/font-stack-preview.html`). All decisions locked; implementation underway.
Prepared: 2026-09-02. Source research: Architectural Gate R (complete).
Decisions locked in `docs/redesign/decisions/gate-r-answers.md`.


This plan gates all implementation. Nothing in `css/`, `pages/`, `js/`, or `markdown/` is
edited until this document is approved (Two-Gate Law, AGENTS.md).

---

## 1. Goal

Redesign the whole site in one pass — keeping the **hero** (locked) and the existing
**two-theme split** (light blue `#2196f3`, dark turquoise `#00b8cc`) — so everything below
the hero finally matches the hero's quality. The voice is **doodle-led with HUD accents**:
hand-drawn annotations, scribbles, and sticker chips carry the personality; Iron-Man HUD
grammar (mono readouts, corner brackets, micro-labels, FIG-style captions) appears as
accents on data, never as the dominant skin. Motion is **ambient idle loops** that fully
collapse under `prefers-reduced-motion`.

## 2. Commit of record (Architectural Pillars, from Gate R)

| Pillar | What it gives the plan |
|---|---|
| Portfolio Structures | Section order, project-card anatomy, timeline expanders, activity heatmap, sticker chips, bento layout, footer sign-offs, narrative ordering |
| Doodle Craft | Hand-drawn technique library, handwriting guidance, sticker rules, anti-patterns |
| HUD & Sci-Fi Elements | Vanilla HUD technique library (brackets, readouts, scanlines, glow discipline), restraint law, typography |
| Typography | Font pairing candidates with weights/load, legibility floors, load discipline, anti-patterns |
| Decisions | Architectural non-negotiables and design constraints |


## 3. Non-negotiables (from Gate R answers + standing laws)

1. **Theme split stands.** Light = blue ramp `#2196f3`. Dark = turquoise `#00b8cc`. Never blue in dark.
2. **Whole site, one pass.** Home (below hero), about, projects index, 4 case studies, system pages.
3. **Doodle-led, HUD accents.** One handwriting face. HUD = mono labels, corner brackets, micro-readouts.
4. **Ambient idle loops.** Gentle continuous motion; full collapse under `prefers-reduced-motion`.
5. Vanilla HTML/CSS/JS only — no frameworks, no third-party UI libs, no new build-step rewrites.
6. Zero emojis. No gradients (flat inks; hairlines allowed). No inset/neumorphism, no harsh directional shadows.
7. **Hero is locked** — the redesign starts *below* it and does not touch the scroll-reveal text system.
8. **No fabricated facts.** Every readout traces to a real number (repos, metrics in the case studies, `document.lastModified`).

## 4. Decided design direction

### 4.1 Font stack — **Candidate A: "Engineer Notebook"** (CHOSEN 2026-09-02)
(Space Grotesk display · IBM Plex Sans body · Architects Daughter handwriting · IBM Plex Mono readouts — dossier 04 §1A)

Chosen from the live A-vs-E preview. Drafting-desk DNA across all four roles: the geometric
grotesque display, humanist body, ruled-paper script, and matched mono read like one
engineer's kit. Architects Daughter's gray-pencil tone keeps annotations subordinate to the
committed `#2196f3` accent in light; on dark, annotation ink darkens toward near-black-teal
per dossier 04 §3 glass-contrast rules (pure turquoise scripts fail 4.5:1 at annotation size).

Type roles:
| Role | Face | Notes |
|---|---|---|
| Display/headings | Space Grotesk (500, 700) | Section numbers, case-study hero, page heroes |
| Body | IBM Plex Sans (400, 600) | Open apertures; strong on translucent surfaces |
| Handwriting | Architects Daughter (400) | Annotations, captions, sticker labels; ONE casual voice; NEVER body text |
| HUD/mono | IBM Plex Mono (400, 600) | Numbers, micro-labels, FIG captions, log rows |

Load: self-host latin woff2 files in `assets/fonts/`, `font-display: swap` for body/mono,
`optional` for the handwriting garnish, `size-adjust` fallbacks to kill reflow (dossier 04 §2).

### 4.2 The one handwriting face
**Architects Daughter** is the *only* casual voice (dossier 04 §1A). No second script. Floors:
annotations ≥16px; captions ≥18px where informative; anything below 14px is decorative and
`aria-hidden` (dossier 04 §3). On dark glass surfaces, use the darker near-black-teal ink for
text-bearing annotations.

### 4.3 Color law applied
No new palette. The blue ramp and turquoise ramp stay the only hues. Doodle ink = neutral
ink or the *single committed accent* per surface, never both at once (dossier 02 anti-pattern 6).
Hand-drawn lines use the accent at reduced alpha.

### 4.4 Markup & asset conventions
- Shared SVG sprite `assets/doodle-sprite.svg` (`<symbol>`: arrow, circle, underline-squiggle,
  bracket-left/right, star-burst, tape, scissors). Author once, reuse via `<svg><use>`.
  Custom-authored SVG paths, exported to inline SVG, committed as a file.
- Project/sticker images stay **placeholders** (current `showcase-image-placeholder` pattern),
  to be filled by Jay — never invented art (taste rule).


## 5. Implementation phases (each = one commit, reviewable)

### Phase 0 — Design-token & font foundation
Files: `css/base/variables.css`, `css/base/theme.css`, `css/base/fonts.css`, `css/critical.css` (head-critical vars), + new `assets/fonts/` (self-hosted latin woff2), new `assets/doodle-sprite.svg`.
- Add new semantic tokens alongside existing ones: `--font-display`, `--font-body`,
  `--font-hand`, `--font-mono` remapped to new faces; `--ink-hand`, `--doodle-line`,
  `--hud-label`, `--corner-accent`, `--paper-grid` (subtle, alpha ≤8%).
- Keep `--primary-*`/`--accent-*`/`--theme-*` untouched so existing components keep working.
- Replace the Google-Fonts `@import` with local `@font-face` latin subsets.
- Do **not** restyle any component yet — foundation compiles and visually no-ops.

### Phase 1 — Shared design language (new CSS component layer)
New files under `css/components/`: `doodle.css`, `hud.css`, `sticker.css`, `section-heading.css`.
No page markup changes yet.
- `doodle.css`: sprite `<use>` placement, hand-drawn underline/circle annotation styles,
  marker-highlight band (`color-mix` flat fill + `box-decoration-break`), paper-grid ground util.
- `hud.css`: corner brackets (mask approach A, dossier 03 §2.3), mono micro-label/readout
  styles, FIG-caption style, scanline overlay (static, panel-only), glow discipline (one focal element).
- `sticker.css`: rotated sticker chips with `--r` variance ±12deg max, Architects Daughter captions
  counter-rotated, ambient drop shadow, mobile collapse to inline strip.
- `section-heading.css`: numbered-section heading pattern (01., 02., ...) with doodle underline.
- All idle loops gated by `@media (prefers-reduced-motion: no-preference)`.

### Phase 2 — Homepage below hero (`index.html`, `css/pages/home.css`, new `js/components/doodle.js`)
Rebuild the section under the existing hero. Keep the current project showcase section as the
baseline content (taste rule) and restructure it plus new sections:
Order (proof-first with doodle accents at boundaries):
1. **Bio strip** — 3-4 first-person bullets with role-label inline links.
2. **Now / live-data rail** — mono readout row of STATIC REAL METRICS (decision 2026-09-02):
   shipped-project count, case-study-sourced stats, `document.lastModified`-style freshness.
   No external image service, no snapshot refresh step. All real; no fake telemetry.
3. **Selected work** — showcase REPLACED (decision 2026-09-02): the carousel and its hover
   previews are retired for a calm, research-style featured layout (cover + placement badge on
   cover corner + tech-tag run + links row). NEW visuals and NEW sounds: `sound-manager.js`
   gains a fresh, quieter SFX set for the new showcase interactions; old carousel sounds are
   removed with the carousel.
4. **Sticker chips** between sections with Architects Daughter captions + a "Reset stickers" toy — the single interactive doodle system, footer control.
5. **Footer sign-off** — "Hand-written HTML/CSS/JS — no frameworks, no trackers" line + Reset
   stickers button.

Motion budget (whole page): one ambient loop max per viewport (idle bob on one sticker or a
slow corner-bracket pulse), nothing flashing (WCAG 2.3.1), everything reduced-motion-collapsible.

### Phase 3 — About page (`pages/about.html`, `css/pages/about.css`)
- Apply shared section-heading + doodle accents.
- Retain existing sections (roles → story → beyond-code → creative-lab) and content.
- Add Architects Daughter margin annotations beside role cards; sticker chips at section boundaries.
- Convert role cards to the project-card anatomy where it fits; keep the story prose at ≤65ch.
- HUD readout treatment on the beyond-code stat-ish claims only where a real number exists.

### Phase 4 — Projects index (`pages/projects/index.html`, `css/pages/projects.css`)
- Apply shared language; card grid gets the cover-badge + tag-run + links-row anatomy.
- Add a mono "index" header treatment (e.g., `PRJ-01`-style keys) — restrained, one accent.
- Keep the featured case-study callout, reskinned with doodle frame.

### Phase 5 — 4 case-study pages (`pages/projects/*.html`, `css/pages/case-study.css`)
- Shared case-study hero: FIG-numbered figures ("FIG 1 — ..." captions), section numbers,
  sticky side-rail with numbered section indices on wide screens.
- Keep every real metric already in the copy; present stats in mono readouts.
- Add "next case study" footer nav with a doodle arrow.
- Content copy is preserved 1:1; structure/skin only.


### Phase 6 — System pages (`404`, `500`, `privacy`, `design-system`)
- 404/500: one doodle (torn-paper edge or hand-drawn "lost" arrow) + mono error code;
  ≤1 torn edge per viewport.
- Privacy: prose at 65ch, section numbers, minimal decoration.
- Design-system page: rebuild it to document the *new* tokens/typography/components so it
  stays the single source of truth after the redesign.

### Phase 7 — Cross-cutting audit & reduced-motion law
- Global reduced-motion collapse (dossier 03 §2.11 blanket + per-effect static fallbacks).
- Verify no blue-in-dark, no emoji, no gradient text (the `.gradient-text` usage should be
  flattened to solid accent by the end).
- Keyboard focus: corner-bracket focus rings replace any default-dotted loss.
- CSP `style-src` may drop `https://fonts.googleapis.com` once fonts are self-hosted; check
  `font-src` accordingly.

### Phase 8 — Build, validate, preview, iterate
- `bun run build && bun run validate` + `bun run deploy:preview` (port 8000 habit).
- Run the node test suite (`bun run test`).
- Manual pass in light + dark, mobile, reduced-motion emulation, keyboard-only.

## 6. File inventory (new vs modified)

New:
- `css/components/{doodle,hud,sticker,section-heading}.css`
- `assets/doodle-sprite.svg`, `assets/fonts/*.woff2` (self-hosted latin subsets)
- `js/components/doodle.js` (draw-on + reset-stickers toy), `js/components/live-rail.js`
- `docs/redesign/plan/README.md` (this file)

Modified (sources only — `dist/` is build output):
- `css/base/{variables,theme,fonts}.css`, `css/critical.css` (inline head vars on pages), `css/main.css` (imports)
- `css/pages/{home,about,projects,case-study,404,500,privacy}.css`
- `index.html`, `pages/about.html`, `pages/projects/index.html`, `pages/projects/{aviz-health,swalook,genuinest,vini-tini}.html`
- `pages/404.html`, `pages/500.html`, `pages/privacy.html`, `pages/design-system.html`
- All pages' inline `<head>` critical-style blocks where tokens/fonts change

Not touched: hero scroll-reveal text system (locked), `js/components/project-showcase.js`
carousel mechanics, sound manager, consent/analytics, theme-detection script, markdown
companions (updated only if visible page copy changes; the redesign is structural).

## 7. What is deliberately NOT in scope

- No framework adoption, no build-step HTML templating.
- No new pages, no copy rewrites, no new projects added.
- No blue in the dark theme; no new accent hues.
- No third-party runtime doodle/HUD libraries — all techniques are hand-written vanilla
  or build-time-generated, committed as static SVG.


## 8. Decided calls (from the approval rack, 2026-09-02)

1. **Live-data rail** — static real metrics; no third-party images, no refresh step.
2. **Showcase** — REPLACED with a calm featured layout; new visuals AND new sounds
   (`sound-manager.js` reworked for the new interactions; carousel SFX retired with the carousel).
3. **System pages** — full pass; design-system page rebuilt to document the new tokens/components.
4. **Font stack** — A vs E, decided by the live preview at `preview/font-stack-preview.html` (pending).

## 9. Approval

Gate P font decision passes when Jay picks a stack from the preview at
`preview/font-stack-preview.html`. Work then proceeds Phase 0 → 8 with a reviewable commit
per phase. All other scope decisions above are approved and locked.
