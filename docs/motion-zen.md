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

## 8. Rulings log

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
