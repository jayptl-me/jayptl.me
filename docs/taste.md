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
is locked to the hero reveal and nothing else (the preloader has had no
text since 2026-09-30: an ink loop, no fonts).

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

## 12. Liked motion references (learn the feel, 2026-09-28)
From two reference sites Jay liked (a scroll-story site and a dev
portfolio). These describe the feel to learn from. Items marked BUILD are
approved; everything else is taste reference only, not a feature request.
- Glide wheel (BUILD): a desktop mouse wheel eases to a stop over about a
  second instead of stepping in notches. Touch and trackpad stay native.
  The stepper keeps its own scroll control. Each section is researched
  before it gets glide behaviour (AGENTS.md "Research before build").
- Card to cover (BUILD): a clicked project card grows into the case-study
  cover. Every other navigation keeps the pixel veil.
- Cover rise: an image rises from below, grows from about a quarter size
  and untwists from a slight tilt as it scrolls in.
- Sideways gallery: a section pins while vertical scroll moves a row of
  cards sideways, with a progress readout; a title lights up when a card
  passes under it.
- Section progress: headings, HUD labels, and rails fill with the reader's
  progress through their section.
- Drifting stickers: tags and stickers float up and turn at different
  speeds as you scroll, inside the 12deg sticker cap.
- Column cover: vertical bars sweep over the page on navigation. Liked,
  but the pixel veil stays the site transition.
The shared core: motion is tied to scroll position and reverses when you
scroll back, one thing moves at a time, eases are heavy and confident,
nothing auto-plays. Not taken: image flipbooks that swap frames faster
than 3 per second, full-screen menu overlays (the island is ours), and
rotations past the 12deg cap.

## 13. Component vocabulary (built 2026-09-28, awaiting Jay's review)
Jay liked the whole build plan; this is its vocabulary. Names describe the
job. All of it is built (see `docs/motion-zen.md` section 6a for each
brief); it becomes shipped taste once Jay reviews and deploys it.
- Components: Command Deck (Cmd K palette), Role Ledger (expandable
  experience rows), Commit Field (contribution heatmap from a build-time
  snapshot), Stack Chip (inline tech name plus icon), Talk Chip (book a
  call plus copy email), Control Dock (desktop only: deck, sound, back to
  top with progress ring), Ship Status Line (status, date, role on project
  cards), Edge Blur (static bottom blur band), Tally Roll (count up once),
  Digit Odometer (rolling digits for view counts), Glow Follow Card, Clay
  Glare, Pull Button, Ink Spark, Sticker Peel, Lab Folder, Tilt Cover,
  Change Feed, Ink Mark helper, Glide Wheel, Card to Cover, Slot Picker,
  Uptime Strip, View Counter, Now Playing, Beyond the Code toys (Flick
  Ball, Tiny Snake, saber button), Skill Lanes.
- Ink marks joining the sprite: squiggle, marker swipe, scribble out, loop
  arrow, heart (drawn, never a symbol character), hand check, hand box,
  curly brace, starburst, zigzag rule, you-are-here loop, margin note
  arrow. Same laws as section 5: annotate real content, one hand voice.
- New pages: /contact, /book, /now, /uses, /colophon, /changelog, /ai.
- Skipped on purpose: logo loops and marquees, scramble or glitch text,
  WebGL backgrounds, animated borders, gradient text.

## 14. UI system (Jay's picks, 2026-09-30)
Built and reviewed page by page (Projects, About, Resume, Home, Book and
case studies approved live). Briefs: `docs/motion-zen.md` section 6b.
- Four screen tiers, everywhere: phone under 600, tablet 600 to 1023,
  laptop 1024 to 1439, wide 1440 and up. Each page designs its own layout
  per tier; `tests/ui-system.test.mjs` fails any other width (the navbar
  keeps its own and is out of scope).
- Pill family is the one button: filled, outline, quiet (with a drawn
  arrow). 48 / 44 / 40px by tier. Every state: hover on fine pointers,
  press 97%, cancel by sliding off or Escape, hold-to-confirm (600ms) for
  destructive actions, focus ring, disabled, loading, success, error.
- Ink Status is the one loading mark: a loop that travels, then a check
  or a cross, always with spoken words.
- Projects is Features + Archive (Jay's pick, 2026-09-30, replaced the
  32-card grid): 8 feature cards (the case studies and live sites) with a
  framed desktop screenshot and a phone on a tinted grid mat, title and
  dates, status line, full description (never clamped), tags, and pills
  (Case study, Live site); then an archive of the other 24 as Role Ledger
  rows, newest first, that open in place to the drawing on the same mat
  and the full description. Screenshots are captured fully loaded,
  banners declined, and eased down on dark glass; projects without a live
  site keep their drawn blueprint.
- Stretch Rail filter: the highlight stretches to the pick and settles, no
  bounce; drag on a mouse; a chip menu on phones.
- Drawn line arrows and profile marks replace every typed arrow; outside
  links get the drawn up-right arrow (the navbar keeps its glyph).
- One card material (`.sf-card`): clay light, glass dark, 20px corners.
  No lone card on a grid row at any tier.
- Ink Loop Preloader: no text, no fonts, page never hidden, first visit
  per session, none under reduced motion.

## Retired (not taste)
Gradient text washes, inset/neumorphism shadows, full-page flicker,
carousel auto-rotation, emoji, doodle wallpaper, wobble-everything, two
handwriting voices, thin script on glass, handwriting under 16px,
rotation chaos, pre-split `.char` spans + `sandMerge` (replaced 2026-09-16
by runtime SplitText + particle field).

## Rulings log
- 2026-09-30 / UI system round: section 14 above is shipped taste (Jay
  reviewed each page). Gradient text on the About headline removed (the
  section 3 ban). Placeholder "Live Preview" links removed, not replaced.
  Beyond the Code card order kept as written.
- 2026-09-28 / footer: sign-off is "No templates were harmed in the making
  of this site." (hand voice, no heart); layout splits left (sign-off,
  email, consent note) and right (updated date, reads, API status, "Add as
  Preferred Source" on every page), stacking centered on phones. The
  bottom blur band steps away as soon as the footer is on screen.
- 2026-09-28 / phase 3 content picks: Beyond the Code game-dev card gets
  two toys, a flick-the-ball physics sandbox and a tiny snake; the gamer
  card's "currently playing" note comes from Steam through our API, plus
  a manual entry Jay feeds from an admin page on the API service, newest
  wins (Epic and the NVIDIA app have no public activity API); home closing
  band says "Open to full-time roles, contract builds, and forward
  deployed engineering. Based in Anand, India, working in IST."
- 2026-09-28 / build-plan picks (Gate R): glide wheel on desktop wheels
  only, native touch; scroll-linked set (cover rise, sideways gallery,
  section progress, drifting stickers) is learn-only, not built; card to
  cover morph approved for project card to case study; Edge Blur bottom
  only; page view counter counts every visit cookieless, so the footer
  line changes when it ships; one address everywhere, hello@jayptl.me;
  booking is a custom /book page on our own backend with the Meet link
  sent 15 minutes before start.
- 2026-09-27 / hero bookends (locked rule): the homepage text reveal always
  opens with "LOOKING FOR JAY?" and closes with "Ahhhh, Just Jay!". These two
  never change. Only the middle words may be edited, in Jay's voice: casual
  "who is this guy" guesses. Current middle set: THE FULL-STACK DEV? ·
  THE FLUTTER NERD? · THAT AI GUY? · THE INFRA ENGINEER? · THE WEB3 GEEK?
  (Gamer jargon like "FULL-STACK MAIN?" was rejected 2026-09-27.)
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
