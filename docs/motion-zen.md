# Zen-Calm Motion Law — jayptl.me (2026-09-20)

Source of truth for all motion on this site. Every claim traces to shipped
code. Future agents must follow this file before touching any transition,
animation, or choreography. Global laws (Two-Gate, hand-written only,
no trademarks in deliverables) live in `AGENTS.md` and
`.agents/rules/custom-code-policy.md`.

Origin: GATE R Option A (single-curve token freeze), picked 2026-09-20.
GATE P doc plan approved same day. No CSS/JS changed in this step.

## 1. The law in one paragraph

One snap curve for all movement. Exits run faster than entries, with no
stagger and no lift. Entries run slower, with a short delay then a tight
stagger. Content swaps only while invisible. Theme swaps ride one master
clock from the tap point. Only compositor properties move. Reduced motion
collapses everything to a static end state.

## 2. Tokens (use these, nothing else)

- `--ease-snap: cubic-bezier(0.16, 1, 0.3, 1)` — the only motion curve for
  overlays, veils, dissolves, reveals, dropdowns, island morphs.
- `--ease-smooth: cubic-bezier(0.45, 0, 0.15, 1)` — theme master ease only
  (`css/base/variables.css:352-358`).
- Exit: 140-200ms, `opacity` only, `translateY(0)`, `--stagger-delay: 0s`.
- Entry: 240ms + 40ms delay for shells, `180ms ease-out` per child with
  30ms stagger steps (40-280ms band).
- Staged page entry: 520ms + 60ms per index (`css/components/page-transition.css:89-90`).
- Theme master: 380ms + 60ms stagger (`css/base/variables.css:356-359`),
  radial wipe 450ms from tap point (`js/components/theme-toggle.js:137-149`).
- Pixel engine: 50px stride, 1.04 overlap, edges pattern for dissolve,
  center pattern for reveal (`js/components/pixel-swap.js:73-113,170-172`).
- Banned in new work: spring/bounce curves, `ease-in` exits, 50ms presses,
  infinite loops except status/pulse dots, filter or layout animation.

## 3. Sequencing (exit-first, then reveal)

1. Fade/dissolve the outgoing surface first.
2. Swap content while invisible (reset split/particle state here).
3. Reveal the container via pixel clip.
4. Fade the chrome (stepper, hints) with 200ms delay.
5. Play text last (particle replay or split stagger 600ms/char, 50ms delay).

Never play exit and entry at once. Guards in shipped code that enforce
this: `_releasing` and `_hideSeq` in `js/components/scroll-reveal.js`,
`is-closing` lock + 280ms timer in `js/components/navbar.js:356-418`.

## 4. Shipped references (ground truth)

- Mobile island close: `css/components/navbar.css:899-916` (140ms close),
  `css/components/navbar.css:890-896,1010-1025` (240ms + stagger open),
  `css/components/navbar.css:857` (280ms scrim), `js/components/navbar.js:394-418`.
- Stepper exit: `js/components/scroll-reveal.js:1098-1128` hide 350ms
  mobile / 500ms desktop, `js/components/scroll-reveal.js:956-986`
  dissolve edges 800/500.
- Stepper re-entry: `js/components/scroll-reveal.js:335-353` reveal
  center 850/550 + stepper fade 350ms + 200ms delay, text via
  `js/components/scroll-reveal.js:126-143`.
- Theme: `js/components/theme-toggle.js:137-149`,
  `css/components/theme-toggle.css:137-142`, master
  `css/base/variables.css:356-359`.
- Page veil: `js/components/page-transition.js:14-17` cover 420/320 edges,
  uncover 640/440 center, staged `css/components/page-transition.css:89-90`.
- Dropdowns: `css/components/navbar.css:244-254` 180ms snap (keep).

## 4b. Reference-good signatures (Jay likes these)

From Jay's notes (2026-09-20 session): these already feel right and are
good reference for the rest of the site. Not locked, just liked — keep
the feel when working nearby.

1. Mobile island close — `css/components/navbar.css:899-916,857`,
   `js/components/navbar.js:394-418`. 140ms exit with no stagger/no lift,
   240ms + stagger entry, 280ms scrim, `is-closing` lock. Calm because exit
   is faster and together.
2. Stepper exit / re-entry — `js/components/scroll-reveal.js:1098-1128`
   hide, `956-986` dissolve edges 800/500, `335-353` reveal center 850/550
   + stepper fade + text last (`126-143`). Calm because text swaps while
   invisible and replays after reveal.
3. Pixel engine — `js/components/pixel-swap.js:73-172`. 50px stride, 1.04
   overlap, edges dissolve / center reveal, direct clip, no flash, no clone.
4. Theme switch — `js/components/theme-toggle.js:137-149`,
   `css/components/theme-toggle.css:137-142`,
   `css/base/variables.css:356-359`. 380ms master + 450ms radial wipe from
   tap point, stacked icon crossfade, sound lands with visual.

- Note: Jay prefers a quick check before changing items 1-4, with
  before/after, so the feel stays intact. Taste reference, not a lock.
- Case-study components are the approved change surface: cover, rail,
  sections, next-link may be rebuilt or replaced (new components allowed,
  bespoke only). Action-path buttons/pills are approved for tweak since they
  already exist.

## 5. Known violators (do not copy, fix per page)

None currently. All violators found in the 2026-09-20 audit were fixed
2026-09-25 (see Rulings log).

## 6. Per-page annex (research slots, fill one gate at a time)

- Home: stepper + scroll-stack + hero + particle field.
- Projects index: filter + cards + staged entry.
- Case studies (aviz-health, swalook, vini-tini, genuinest): cover/body/foot.
- About / Resume / Design-system / Privacy / 404 / 500: veil + staged entry.
- Each annex records: measured durations, curve used, exit/entry order,
  reduced-motion path, sound hook if any. No annex may introduce a new
  curve without a ruling entry below.

### 6a. Component briefs (Research before build)

Format: scroll mode / hand-off / reduced motion / liked reference.
"Picked" means Jay chose it at Gate R; nothing here ships before that.

- Mount helper (`js/components/mount.js`), picked 2026-09-28 with Gate P:
  no motion of its own. Mounts on `DOMContentLoaded` and on `page:ready`,
  unmounts removed hosts, never binds twice.
- Ink Mark (`js/components/ink-mark.js`), picked 2026-09-28: reuses the
  shipped draw-on exactly (700ms dashoffset, 90ms per stroke, once, at 40%
  visible). Native scroll. Reduced motion: fully drawn. Reference: none,
  it is the existing doodle voice.
- Glide Wheel (`js/components/scroll-glide.js`), picked 2026-09-28
  "Calm, about 1s": desktop mouse-wheel notches only (line-mode deltas, or
  pixel deltas that arrive as large equal steps); trackpads, touch,
  keyboard, scrollbar drags and pinch-zoom stay native. Each notch moves
  the target; the page eases to it with a frame-rate independent
  exponential ease that settles in about 1s (the expo-out tail of
  `--ease-snap`). Hand-off: off while the home stepper holds the page (its
  overlay is not `released`), native inside the scroll-stack section (its
  own 0.14 damping), native inside any element that can still scroll on
  its own axis, and off while the Command Deck or the mobile island is
  open. Any native input (touch, key, scrollbar, trackpad) cancels a glide
  in flight and resyncs. Anchor links and Deck jumps use the same ease.
  Router swaps reset it. Reduced motion: off. Reference: section 12 "Glide
  wheel".
- Command Deck (`js/components/command-deck.js`), picked 2026-09-28 "Rise
  in center": open is scrim 280ms, panel 240ms after a 40ms delay (opacity
  0 to 1, scale 0.98 to 1, snap), result rows 180ms with 30ms steps capped
  at 280ms. Close is 140ms opacity, all together, no lift. Page scroll is
  locked while open (`scrollbar-gutter` keeps layout still); the list
  scrolls natively. Reduced motion: appears and disappears at once.
  Sound: open, row move tick (throttled), select. Reference: section 4b
  item 1 (island open/close).
- Edge Blur (`js/components/edge-blur.js`), picked 2026-09-28 "scales with
  screen, capped at known sizes": fixed bottom band, height by breakpoint:
  48px under 600px wide, 60px to 860px, 72px to 1440px, 88px to 1920px,
  96px above (and never more than 10vh). Static, never animated; fades out
  with a 180ms opacity step over the last 120px of the page. Hidden while
  the home stepper holds the page. Off with `prefers-reduced-transparency`,
  3 layers on touch devices, 5 on desktop. Reduced motion: same, it has no
  motion. Reference: none; the one allowed static blur (ruling 2026-09-28).
- Control Dock (`js/components/control-dock.js`), picked 2026-09-28 "After
  the first screen": desktop fine pointers only, from 861px wide. Fades in
  240ms snap once scrollY passes one viewport, fades out 140ms above it.
  Progress ring is a stroke-dashoffset readout (not an animation; it
  follows scroll with no easing of its own). Back to top uses Glide Wheel's
  ease when available, native smooth otherwise. Sits above Edge Blur.
  Reduced motion: shows and hides at once. Sound: hover tick, toggle.
  Reference: section 4b item 1 (exit faster than entry).
- Talk Chip (`css/components/talk-chip.css`, `js/components/talk-chip.js`):
  no scroll behaviour. Copy email writes a hand note "copied" that fades in
  180ms and out 140ms after 1.6s. Book link is a normal router link.
  Reduced motion: note appears and disappears at once.

Phase 2 briefs, picked 2026-09-28 (all native scroll, no glide hand-off
needed; every one collapses to its finished state under reduced motion):
- Role Ledger "Clip reveal": built on `<details>`. Space opens at once
  (no height animation), then the body reveals top to bottom with a
  240ms snap clip-path, lines staggered 30ms; close is 140ms opacity,
  together. Chevron turns 180ms snap. Reference: 4b item 1.
- Tally Roll and Digit Odometer "Count up 800ms": once per page view when
  40% visible, 800ms on the snap curve, mono tabular digits so width never
  moves. Odometer digit columns roll with transform over the same 800ms.
- Card to Cover "520ms": same-document view transition inside the router
  swap, the card and the cover share one view-transition-name, 520ms
  snap; the rest of the page uses the staged entry (60ms steps). Browsers
  without view transitions keep the pixel veil.
- Pointer follow "Eased follow" (Tilt Cover max 4deg, Glow Follow, Pull
  Button max 6px): values ease toward the pointer and settle in about
  150ms, then return home in 240ms snap on leave. Fine pointers only.
- Ink Spark "Draw out, then fade": four strokes draw outward 240ms with
  the doodle draw-on, then fade 140ms together; one burst on screen.
- Sticker Peel "Lift and drag": hover lifts a corner (transform only),
  drag moves the sticker inside its band with tilt capped at 12deg, drop
  settles in 240ms snap, Reset stickers returns all. Keyboard: Enter picks
  up, arrows move, Enter or Escape drops. Touch keeps native scroll (drag
  is mouse and pen) so a finger on a sticker never traps the page.
- Lab Folder "Fan out": flap opens and up to three FIG cards fan out in
  240ms snap with 60ms steps, tilt within 8deg; close 140ms together.
- Commit Field "Last 12 months": static grid, no motion; hover or focus a
  cell to read its date and count.
- Beyond the Code toys (picked 2026-09-28, "1 and 2 both"): Flick Ball
  and Tiny Snake are small canvases that run only while visible and only
  while played with; nothing auto-plays. Keyboard playable. Touch drags on
  the canvases do not scroll the page (touch-action none, canvases only).
  Reduced motion: the toys still respond to play, never move on their own.
- Slot Picker, Uptime Strip, View Counter, Now Playing: no motion of their
  own beyond 180ms snap state changes; the odometer follows the Tally Roll
  brief. Native scroll.
- Page briefs (phases 3 and 4): every page uses the Glide Wheel on desktop
  mouse wheels and native scroll elsewhere; the home stepper and
  scroll-stack keep their own control; horizontal overflow (Commit Field
  on phones) scrolls natively inside its box. Entry is the shared staged
  entry and pixel veil; case-study cards use Card to Cover. No page adds
  scroll-linked motion (taste section 12 stays learn-only).
- Plan defaults (no open choice): Stack Chip hover lifts 1px with a 180ms
  snap tooltip; Ship Status Line is static; Clay Glare is one 480ms snap
  sweep per hover on a transformed highlight; Change Feed rows use the
  entry timings (180ms, 30ms steps) once when they scroll in.

### 6b. Briefs, UI system round (Gate R picks 2026-09-30, awaiting Gate P)

Tiers used by every brief: phone < 600, tablet 600 to 1023, laptop 1024 to
1439, wide 1440+. Hover exists only on `(hover: hover) and (pointer: fine)`.

- Pill family (all buttons, picked "pill family"): one component, three
  looks (filled, outline, quiet text with drawn arrow), heights 48 phone /
  44 tablet / 40 laptop and wide. States on the snap curve: hover lifts 1px
  and deepens the clay shadow (light) or the rim glow (dark) in 180ms;
  press sinks to scale 0.97 with the shadow collapsing in 140ms (never
  50ms), release returns in 200ms; held past 450ms keeps the pressed look;
  hold-to-confirm only on destructive actions (Clear all data, Cancel
  call): a ring fills over 600ms by clip, releasing early cancels. Cancel:
  pointer leaving or Escape during a press releases without firing.
  Focus-visible: 2px theme ring, 3px offset, no motion. Disabled: muted
  tokens, no hover, `aria-disabled`. Loading: width locked (no layout
  shift), the Ink Status mark takes the label's place centred while the
  live region speaks the words, `aria-busy`. Success and error: Ink Status
  settles, holds 1.6s, then the label returns. (Built 2026-09-30: a mark
  beside a locked-width label would squeeze the text, so it replaces it.)
  Reduced motion: no scale or lift, colour and ring changes only.
- Stretch Rail (Projects filter, picked "stretch rail"): a native radio
  group (fieldset, visually hidden radios, labels) so arrow keys and
  screen readers work with no script. One highlight element moves by
  transform only. Switching: 0 to 140ms the highlight scales along x
  toward the target from its trailing side (leading edge travels first),
  140 to 340ms it translates onto the target and scales back to 1; snap
  curve, no overshoot. Laptop and wide: pointer drag moves the highlight
  1:1, past either end it resists (0.55 rubber factor, 24px cap), release
  snaps to the nearest filter in 240ms, a fast flick carries one filter
  further. The count sits inside the highlight in mono tabular digits. The
  card grid swaps exit-first: 160ms opacity out, then 180ms entry with
  30ms steps. Tablet: full rail, no drag. Phone: one pill chip showing the
  current filter and count opens a short list under it (listbox, highlight
  glides 180ms between options, Escape or outside tap closes, focus
  returns to the chip). Reduced motion: highlight jumps, no stretch, no
  rubber. Reference: taste section 13 vocabulary; segmented-control study
  in `docs/redesign/decisions/gate-r-answers.md` round 2026-09-30.
- Case-File Card (Projects cards, picked "case-file card"): whole card is
  one link (stretched link), cover on top, title, the full description (Jay 2026-09-30: never clamped), one tag
  row (extra tags fold into a "+N" pill), footer strip with status dot,
  status and dates on one line and the role beneath (built 2026-09-30:
  one line wrapped unevenly across a row). Equal heights per row. Hover
  lifts 2px with the clay shadow deepening (dark: rim glow) in 180ms, the
  existing Clay Glare sweep plays once; press scale 0.985; focus ring on
  the whole card. Click runs the existing Card to Cover morph (520ms).
  Columns 1 / 2 / 3 / 3 by tier, gap and padding step per tier. Reduced
  motion: no lift, no glare, morph falls back to the pixel veil.
- Ink Status (loading, success, error; picked "ink scribble"): a 20 to
  24px hand-drawn loop. Loading: the stroke travels around the loop
  (dash offset) at 1.2s per turn, allowed as a status loop under section
  2. Resolve: the loop closes in 240ms, then a check (success) or cross
  (error) draws in 320ms on the snap curve, holds 1.6s, fades 180ms.
  Always paired with a polite live-region message; colour is never the
  only signal. Reduced motion: a static drawn loop, then a static check or
  cross. Used by: pill buttons, copy email, Slot Picker, View Counter,
  Uptime Strip, Now Playing, resume downloads.
- Ink Loop Preloader (home, picked "ink loop to reveal"): no text, no
  fonts, no images. Inline SVG and CSS in the page, under 2 KB, playing
  from the first frame with no script needed. 0 to 420ms a single loop
  draws in the centre (theme ink: blue light, turquoise dark); 420 to
  560ms it closes into a dot; 560 to 880ms the dot opens as a circle
  that reveals the page. The page underneath is fully drawn the whole time
  (no opacity 0), so the largest paint is recorded at first paint. First
  visit per browser session only; a tiny external head script marks
  repeat visits so the overlay never paints; in-site navigation keeps the
  pixel veil. The hero reveal starts when the circle has opened (existing
  hand-off). Reduced motion: no preloader. Ruling needed: the opening
  circle animates a mask radius (paint, not compositor) on one element for
  320ms, first visit only; flagged as the only exception to section 2.
- Drawn Arrow (all link arrows, picked "drawn line arrow"): 16px sprite
  icons in the stack-chip stroke (1.8, round caps): right, up-right, down.
  Hover nudges 2px along the arrow's direction in 180ms; replaces the
  global text-glyph arrow and every typed arrow. Reduced motion: static.
- Doodle sizing (mechanical): every doodle gets explicit width and height
  per tier; the About section-head underline stops falling back to the
  150px default box.
- About page, Phase 2 (approved plan, 2026-09-30): native scroll plus the
  Glide Wheel on desktop wheels; no scroll-linked motion; staged entry and
  pixel veil as before. Changes: section headings hug their underline
  doodle (no floating gap, all pages share section-heading.css); one
  section rhythm per tier (56 / 72 / 96px between sections); the hero
  headline loses its gradient text (taste section 3 ban) for solid ramp
  ink; role cards and Beyond cards join the card family (clay light,
  glass dark, 20px corners) and never leave a lone card on a row (roles:
  1 column phone, 2x2 tablet and laptop, 4 across wide; Beyond: 1 column
  phone, 2x2 from tablet up); the toy Play control becomes a pill; the
  Timeline ledger rows gain hover (fine pointers) and pressed states on
  the snap curve (180ms, press 140ms). Reduced motion: no lift, colour
  changes only. Reference: none new; it is the shipped About content.
- Resume page, Phase 3 (approved plan, 2026-09-30): native scroll plus the
  Glide Wheel on desktop wheels; no scroll-linked motion. Contact row:
  quiet pills with drawn line icons (mail, site, profiles) and the drawn
  up-right arrow on outside links; phone: a 2-column grid of 48px rows,
  tablet: wrapping row, laptop and wide: one line. One-pager tiles join
  the card family; the lead tile (Client-facing / FDE) spans two columns
  so no tier leaves a lone tile (1 column phone, 2 tablet, 4 laptop and
  wide); hover lifts 2px (fine pointers), press 98.5%, focus ring; a
  click shows the Ink Status check in the tile corner for 1.6s with a
  spoken "download started". Print, Markdown and resume.json become quiet
  pills. Print CSS turns the contact pills back into one plain text line.
  Reduced motion: no lift, the check appears drawn.
- Home stepper dots (mechanical): visual dot unchanged, hit area grows to
  44px on phones. Navbar untouched by every brief above.
- Projects cards revamp, Features + Archive (Gate R picks and Gate P
  approval 2026-09-30, plan `docs/redesign/projects-cards-plan-2026-09-30.md`):
  native scroll plus the Glide Wheel on desktop wheels; nothing is tied to
  scroll position. Feature cards (8, 1 column phone, 2 from tablet up):
  the card lifts 1px with the clay shadow (light) or rim glow (dark) in
  180ms snap on fine pointers, and the screenshot inside its frame nudges
  up 4px by transform in the same 180ms; press sinks to 0.985 in 140ms.
  Card to Cover stays on the four case studies. Archive rows (24): the
  Role Ledger clip reveal (space opens at once, body revealed top to
  bottom in 240ms, lines staggered 30ms, close fades in 140ms together).
  Hover preview (laptop and wide, fine pointer only): one preview at a
  time, pinned to the hovered row's right edge, never following the
  pointer; enters in 180ms by opacity plus scale 0.96 to 1, exits in
  140ms; moving to another row exits the old preview first, then enters
  the new one. Filter: the existing exit-first swap covers both sections.
  Reduced motion: no lift, no nudge, no preview, native open and close.
  Reference: the liked dev portfolio's framed screenshots on a padded mat
  (taste section 12 source list), the archive-table pattern from the
  research doc.

## 7. Future-agent checklist (mandatory)

0. Feel first: items 1-4 are Jay-liked references. Check with Jay before
  changing them so the feel stays intact.

1. Read this file + `docs/taste.md` + `AGENTS.md` before any motion edit.
2. Use only Section 2 tokens. No new easings, no new durations.
3. Compositor only: `transform`, `opacity`, `clip-path`. No filter,
  blur, width/height animation on scroll paths.
4. Exits: fast, together, no lift. Entries: slow, delayed, staggered.
5. Swap content only while invisible; replay text after reveal.
6. Theme-affected props use the 380ms master, never local timing.
7. `prefers-reduced-motion: reduce` shows the final state immediately,
  no loop, no stagger (`css/base/reset.css:70-72,129-131` pattern).
8. Sound lands with visuals (~380ms theme, step tick 160ms throttle in
  `js/components/scroll-stack.js:379-387`).
9. Verify with keyboard, touch, resize across 860px breakpoint, and cold
  load behind veil. Never leave content veiled or hidden.
10. New page, section, or component: write its scroll and motion brief in
  section 6 first (glide or native, stepper and scroll-stack hand-off,
  reduced-motion end state, liked reference from `docs/taste.md` section
  12). No code until Jay picks it (AGENTS.md "Research before build").

## 8. Rulings log

- 2026-09-30 / preloader mask exception (Jay approved): the home Ink Loop
  Preloader's opening circle animates a mask radius, a paint property, on
  one element for 320ms, first visit per session only. It is the only
  exception to section 2's compositor-only rule; nothing else may cite it.
- 2026-09-30 / UI system round Gate P approved: briefs in section 6b are
  now the build spec for Phase 0 and Phase 1.

- 2026-09-28 / stepper last-line release (Jay: "too stiff to scroll
  down"): on the last line the first push still only arms the release,
  but a steady, deliberate push inside that same gesture now releases
  once it adds up to 240px and the line has shown for 350ms. Before, a
  continuous wheel never released; you had to stop and scroll again.
  Decelerating momentum never counts, so a single trackpad flick still
  lands on "Ahhhh, Just Jay!" first. Line-mode wheels (Firefox) are
  converted to pixels. Hide/dissolve/reveal/text-last timings unchanged.
  Code: `js/components/scroll-reveal.js` handleWheel.

- 2026-09-28 / phase 2 briefs picked: Role Ledger clip reveal, numbers
  count up 800ms, card to cover 520ms, eased pointer follow, Ink Spark
  draw out then fade, Sticker Peel lift and drag, Lab Folder fan out,
  Commit Field last 12 months. Details in section 6a.

- 2026-09-28 / Gate P approved ("lets build it all"), phase 1 briefs
  picked: Glide Wheel "Calm, about 1s"; Command Deck "Rise in center";
  Edge Blur height scales by breakpoint with hard caps (48/60/72/88/96px,
  max 10vh); Control Dock appears after the first screen. Briefs in
  section 6a. The Glide Wheel's exponential ease is the continuous form
  of the snap curve's tail, not a new curve.

- 2026-09-28 / scroll feel (Jay picked "glide wheel, native touch"):
  desktop mouse wheels get an eased glide to a stop; touch and trackpad
  stay native; the home stepper keeps its own scroll control and the
  glide pauses while it holds the page; scroll-stack keeps its own damping.
  Each section and component is researched for its glide behaviour before
  it is built (checklist item 10). Also approved: project card to
  case-study cover morph using the browser's built-in same-document view
  transitions, pixel veil everywhere else; Edge Blur as a static bottom
  backdrop blur, never animated, allowed as the one exception to the
  no-filter rule in section 7 item 3. Scroll-scrubbed motion (cover rise,
  sideways gallery, section progress) is taste reference only for now.
  No CSS/JS changed in this step.

- 2026-09-25 / nav hover intent (Jay picked "Calm hover"): desktop
  dropdowns open on mouse hover after a 150ms rest and close 300ms after
  the pointer leaves; moving to the other dropdown while one is open
  switches at once. Mouse only (`(hover: hover) and (pointer: fine)`),
  touch and keyboard keep click/tap. These are intent delays, not motion:
  the 180ms snap dropdown animation is unchanged. Menus also close on
  outside click, Escape, focus leaving, picking a link, a router page
  swap, or about a screen of scrolling. Only one popover (Projects, More,
  sound panel) is open at a time. Code: `js/components/navbar.js`.
- 2026-09-25 / known violators fixed: `css/components/forms.css` checkbox/
  radio/toggle transitions and check-bounce/radio-pop keyframes moved to
  `--ease-snap`, overshoot removed. `css/components/buttons.css` and
  `css/components/cards.css` 50ms press transitions moved to
  `--duration-fast` (150ms) + `--ease-snap`; buttons.css base transform
  transition moved off `--ease-spring`. `css/components/scroll-reveal.css`
  liquidEnter/liquidExit moved to `--ease-snap` with overshoot removed
  (exit shortened to 200ms); the jellyIn/`bounce-in` spring flourish on
  the stepper's last item removed (JS and CSS) since it sat outside the
  protected hide/dissolve/reveal/text-last signature below; chevronBob and
  finalHintPulse infinite loops removed, kept as plain hover/state
  transitions. `css/components/hero.css` dead, unreferenced
  `.hero-animated`/`.hero-scroll-indicator`/`.hero-floating-elements`/
  `.hero-particles` blocks (the infinite bounce/float/particle-float loops
  and 1000ms fadeInUp/fadeInScale) deleted outright: nothing in `pages/`
  or `js/` referenced them. `css/components/consent-banner.css`
  dialogSlideIn moved to `--ease-snap`, and its container added to the
  reduced-motion block (previously missing). `css/components/
  theme-toggle.css` svg icon transition moved off local 300ms/500ms onto
  the `--theme-x-duration`/`--theme-x-ease` master clock, and added to the
  reduced-motion block alongside the lightsaber blade/glow. Stepper
  hide/dissolve/reveal/text-last signature (section 4b item 2) left
  untouched, confirmation was not needed since none of those line ranges
  were on the violator list.
- 2026-09-20 / stepper protected: home stepper locked as signature, Jay's
  taste preserved, confirmation required before any stepper change.
  Case-study components approved as primary rebuild surface. Action-path
  buttons/pills approved for tweak.
- 2026-09-20 / law created: Option A frozen as zen-calm, neutral wording,
  no external brand names in deliverables. `docs/taste.md` section 6 now
  points here. CSS/JS untouched; per-page rollout pending separate gates.
