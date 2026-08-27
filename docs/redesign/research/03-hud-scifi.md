# HUD / Sci-Fi / Tech-Console Web UI - Candidate-Evidence Dossier

Context: jayptl.me redesign candidates. Hand-written vanilla HTML/CSS/JS only, light theme on a skeuomorphic blue ramp (#2196f3). Standing taste bans gradient soup, inset/neumorphism shadows, and harsh directional drop shadows; glows must be soft and ambient; solids carry color. This file gathers named evidence and portable techniques only - no winner is picked and nothing is ranked. Zero emojis in this document.

---

## Section 1 - Named live sites using HUD / console / terminal aesthetics well

### 1. term.m4tt72.com - Matthew (M4TT72) terminal portfolio
URL: https://term.m4tt72.com
A personal portfolio presented as a fully working in-browser shell: boot banner in ASCII, `guest@term.m4tt72.com:~$` prompt, `help` lists commands. It works because the conceit is load-bearing - the terminal IS the navigation, so the aesthetic never reads as decoration.
Portable techniques: command-palette-as-navigation (keyboard input drives section switching); ASCII banner rendered as plain preformatted text, zero images required.

### 2. mattglei.ch - Matt Gleich personal portfolio
URL: https://mattglei.ch
Terminal-flavored developer portfolio whose sections are labeled "LIVE FROM GITHUB", "LIVE FROM APPLE MUSIC", "LIVE FROM STEAM", each streaming real personal data with cache timestamps ("Cached by lcp [21hr ago]"). It works because every sci-fi readout is backed by true live data - the telemetry is real telemetry, which keeps it engineered rather than costumed.
Portable techniques: data-readout panels fed by real APIs (repos, now-playing, recent games); monospace metadata rows with machine-style timestamps as the sole "tech" garnish on otherwise quiet typography.

### 3. terminal.shop - Terminal Coffee
URL: https://terminal.shop
An entire storefront rendered as one long commit message plus `ssh terminal.shop` connection instructions. It works because the bit is committed to completely and the typography does all the work - no gradients, no glows, just mono text and whitespace.
Portable techniques: commit-message / diff formatting as a narrative device for any sequential content (experience history, changelog); copy-to-clipboard command chips (`cat ~/.ssh/known_hosts` style) for contact info.

### 4. ghostty.org - Ghostty terminal emulator
URL: https://ghostty.org
Product landing whose hero is a large character-drawn illustration inside a single `<pre>` block, followed by one sentence and two buttons. It works because the ASCII art delivers the terminal identity instantly while the rest of the page stays almost aggressively plain - contrast between one loud element and total restraint elsewhere.
Portable techniques: ASCII/character art in `<pre>` as a zero-dependency hero graphic (scales by font-size, degrades gracefully); extreme restraint outside the single signature moment.

### 5. starship.rs - Starship cross-shell prompt
URL: https://starship.rs
Docs/landing for a shell prompt tool; the whole page is effectively a series of real config snippets and install commands, so its console look is intrinsic, not applied. Works because content and aesthetic are the same object.
Portable techniques: copyable install-command blocks with a `$` prompt glyph as primary calls to action; documentation-first layout where monospace blocks carry authority against a spare sans body.

### 6. warp.dev - Warp
URL: https://warp.dev
Landing for an AI terminal whose product shots double as HUD dashboards: ticket IDs (WRP-337, ENG-345), status chips, and benchmark readouts ("Cost per PR $26.25 -28%", "PASS 82%" sparkline rows). Works because the instrument-panel density is showing actual product truth.
Portable techniques: ID-prefixed list items (WRP-/ENG- style codes) to make ordinary cards read like mission telemetry; small PASS/fail percentage readouts with inline sparkline scales as proof-of-work widgets.

### 7. linear.app - Linear
URL: https://linear.app
The most restrained engineering-document aesthetic in mainstream SaaS: figure captions literally labeled "FIG 0.2", numbered sub-sections (1.1 Issues, 2.3 Initiatives), dense issue-ID tables. Works because it borrows only blueprint/spec-document conventions - numbering, captioning, tabular rhythm - and zero neon.
Portable techniques: FIG-numbered figure captions and decimal-numbered section indices borrowed from engineering drawings; issue-key prefixes on list items for quiet technical texture.

### 8. bun.sh - Bun
URL: https://bun.sh
Runtime landing built around real terminal transcripts: an auto-playing, hover-to-pause replay of actual `bun install` output, and a five-step walkthrough numbered `01`-`05` where each step is a genuine command with genuine output. Works because the console content is verifiable reality, staged cleanly.
Portable techniques: auto-playing terminal-output replay with hover-to-pause (accessibility-friendly showpiece); oversized two-digit step numerals (`01`, `02`) as section markers.

### 9. vercel.com - Vercel
URL: https://vercel.com
Dark, near-monochrome landing whose recurring motif is a deployment log card - checkmark lines ("Building image from Dockerfile.vercel", "Deployed to Fluid compute") ending in a production URL. Works because one repeated instrument motif carries the entire brand without any sci-fi dressing.
Portable techniques: single recurring "system log" motif reused across sections instead of many competing effects; success-tick log lines as social-proof-of-machinery.

### 10. hudsandguis.com - HUDS+GUIS (reference archive, not a portfolio)
URL: https://www.hudsandguis.com
Long-running archive cataloging fictional film UI (Jurassic World Rebirth, Andor Season 2, Alien: Romulus) tagged by device: schematics, targeting, scanner, holographic, utilitarian, industrial. Useful here as a vocabulary source: study what professional film UI designers consider credible, then steal the grammar (thin strokes, small caps, callout leaders) rather than the neon.
Portable techniques: tag taxonomy for auditing your own pages (is this panel schematic, scanner, or targeting?); film-UI grammar notes - hairline strokes, uppercase micro-labels, leader lines connecting labels to content.

---

## Section 2 - Vanilla technique library (HTML/CSS/SVG/canvas)

Every entry: approach, performance note, accessibility warning where relevant, and the `prefers-reduced-motion` collapse. All techniques below are framework-free unless flagged.

### 2.1 Scanlines (static overlay)
Approach: fixed-position pseudo-element over a panel (not the whole viewport), painted with a repeating linear gradient:
```css
.panel::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    rgba(3, 30, 62, 0.05) 0px, rgba(3, 30, 62, 0.05) 1px,
    transparent 1px, transparent 3px);
}
```
The canonical CRT write-up uses two stacked gradients (horizontal darkening every 2px plus a faint vertical RGB triad every 3px) on `::before` with `background-size: 100% 2px, 3px 100%`: https://aleclownes.com/2017/02/01/crt-display.html
Perf: pure paint, no layout; cheap if confined to small panels. Avoid on huge scrolling surfaces.
Accessibility: none when static; ensure text contrast is measured WITH the overlay on top.
Reduced motion: nothing to collapse (static by design).

### 2.2 Subtle CRT effects (screen-door, flicker, chromatic separation)
Approach: the three-part recipe from the aleclownes.com write-up - screen-door gradient overlay, opacity-jitter `flicker` keyframes on `::after` (0.15s loop), and animated red/blue `text-shadow` offsets for color separation: https://aleclownes.com/2017/02/01/crt-display.html
Perf: the flicker and textShadow animations repaint continuously; text-shadow animation is especially expensive on long text. Confine to one hero panel maximum.
Accessibility: WARNING - the flicker layer modulates opacity up to ~20 times per second across a full-panel area; that flirts with photosensitivity thresholds (see 2.9) and annoys everyone else. Treat full CRT treatment as a demo, not a default.
Reduced motion: under `@media (prefers-reduced-motion: reduce)` remove the flicker and textShadow animations entirely and keep only the static scanline/screen-door layers.

### 2.3 Corner brackets / targeting-reticle frames
Approach A (pure CSS mask, zero extra elements) - Temani Afif's corner-only border: a solid `border` plus a `mask: conic-gradient(at var(--s) var(--s), #0000 75%, #000 0) 0 0 / calc(100% - var(--s)) calc(100% - var(--s)), conic-gradient(#000 0 0) content-box` knocks the border out everywhere except the four corners: https://css-tip.com/corner-only-border/ (hover variant: https://css-tip.com/corner-only-border-image/)
Approach B (classic, most compatible) - four tiny corner spans or two pseudo-elements using `border-top`+`border-left` / `border-bottom`+`border-right`, absolutely positioned; on hover, transition corner offsets outward for a lock-on feel.
Perf: static masks/borders are free; hover transitions animate only position/width of tiny elements.
Accessibility: purely decorative - wrap in `aria-hidden="true"` (pseudo-elements are already ignored by AT).
Reduced motion: drop the hover transition; brackets may stay static.

### 2.4 Radial arc-reactor style loaders (conic ring progress)
Approach: `background: conic-gradient(var(--blue) calc(var(--p)*1%), transparent 0)` on a round element, inner circle punched with a mask or an inset disc; rotate a gap segment for the idle loader state. `conic-gradient()` is Baseline, widely available since November 2020: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/conic-gradient
For a smooth animated sweep, register the custom property so the gradient itself interpolates - `@property --p { syntax: "<percentage>"; ... }` then `@keyframes` to `--p: 100%`; `@property` is Baseline newly-available since July 2024 (Firefox 128 was the last holdout): https://developer.mozilla.org/en-US/docs/Web/CSS/@property
Fallback path: SVG `<circle>` with `stroke-dasharray`/`stroke-dashoffset` (animatable attribute, Baseline since March 2020) driven by rAF - rock solid everywhere: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dashoffset
Perf: conic version repaints on each frame; SVG stroke version composites cheaply. Either way keep it small (40-80px).
Accessibility: pair with visually-hidden text ("Loading, 60 percent") - a bare spinning arc communicates nothing to screen readers.
Reduced motion: freeze at a static partial arc (e.g. 75 percent) or swap to a determinate progress bar.

### 2.5 Animated dashed / marching panel borders
Approach A (SVG rect): `<rect>` with `vector-effect="non-scaling-stroke"`, `stroke-dasharray`, and a CSS keyframe stepping `stroke-dashoffset` (property is animatable; see MDN above: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dashoffset). Marching ants along a rounded rect is ~6 lines.
Approach B (rotating conic highlight): registered `--angle` custom property spun by keyframes feeding `conic-gradient(from var(--angle), ...)` masked to a border ring - the popular "glowing orbit border". Both primitives documented at the MDN pages above (conic: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/conic-gradient ; @property: https://developer.mozilla.org/en-US/docs/Web/CSS/@property). Note for Jay's taste: use ONE slow accent dot traveling a hairline track rather than a full rainbow orbit - solids carry color, and the blue ramp gives you the accent.
Perf: dashoffset steps repaint stroke geometry; the conic version repaints the border box each frame. Limit to one focal panel; never animate borders on grids of cards simultaneously.
Accessibility: none specific (decorative); avoid pairing fast marching dashes with flashing status colors.
Reduced motion: stop the animation; render the dashes static (dashoffset frozen).

### 2.6 Decode / typing text effects
Typewriter (CSS only): the classic `overflow: hidden` + `white-space: nowrap` + `animation: typing Ns steps(40, end)` with an animated `border-right` caret, fully documented with variants at CSS-Tricks: https://css-tricks.com/snippets/css/typewriter-effect/
Typewriter (JS, rotating phrases): same page hosts the standard vanilla char-by-char routine (type/delete cycle with randomized delay) - no dependency needed: https://css-tricks.com/snippets/css/typewriter-effect/
Decode/scramble (characters cycling through glyphs before settling): implement in ~30 lines of vanilla JS (setInterval swapping unresolved chars from a glyph pool, locking letters left-to-right). Caveat per dossier rules: no primary implementation URL was successfully retrieved during this research pass (candidate sources 404'd), so treat the scramble variant as an uncited candidate until a reference is pinned.
Accessibility WARNING (both effects): text that types in is invisible to screen readers mid-animation and can be missed entirely; keep final text present in the DOM (animate a clipped overlay, or set full text immediately and animate opacity), never inject meaning solely through the animation.
Perf: JS timers mutating text nodes cause layout per tick - restrict to one headline; prefer the pure-CSS steps() version which animates width once.
Reduced motion: skip straight to the fully-rendered string (no typing, no caret blink).

### 2.7 Radar sweeps
Approach: composition of two cited primitives - a square panel with concentric `repeating-radial-gradient` rings and crosshair lines (static), plus a sweep wedge built from `conic-gradient(from var(--angle), rgba(33,150,243,0.35), transparent 60deg)` rotated via a registered `--angle` property (primitives: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/conic-gradient and https://developer.mozilla.org/en-US/docs/Web/CSS/@property). Blips are positioned dots revealed on a delayed timeline.
Perf: one compositor-friendly rotation if you put the wedge on its own layer (`will-change: transform`) instead of animating the gradient angle directly.
Accessibility: continuous rotational motion is a vestibular trigger for some users (see MDN's discussion: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion); do not place reading text adjacent to a moving sweep.
Reduced motion: replace the rotating wedge with a static sector highlight.

### 2.8 Data-readout tickers
Observed working at: https://mattglei.ch (LIVE FROM GitHub / Apple Music / Steam rows) and https://www.warp.dev (benchmark readout rows).
Approach: definition-list semantics (`<dl>` of metric/value pairs) styled in mono with uppercase micro-labels; values update via `textContent` on fetch. For a horizontally crawling strip, adapt Temani Afif's modern-CSS infinite marquee pattern: https://css-tip.com/logo-marquee/
Perf: DOM text updates are cheap at human cadence (throttle to seconds); marquee uses transform translation (compositor-only) - duplicate the content track for seamless looping.
Accessibility: crawlers must pause on hover AND on keyboard focus; mark duplicated track copies `aria-hidden`. Live-updating numbers should use `aria-live="off"` unless genuinely important (constant chatter is worse than silence).
Reduced motion: freeze the crawl into a static wrapped row; keep value updates.

### 2.9 Flash safety and soft glow discipline (applies to ALL of the above)
WCAG 2.3.1 Three Flashes or Below Threshold (Level A): nothing may flash more than three times in any one-second period, or exceed the general/red flash thresholds - this is non-negotiable baseline content law, not a nice-to-have: https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html
Glow discipline for a light-theme blue-ramp site: ambient glows only - e.g. `box-shadow: 0 0 24px rgba(33,150,243,0.18), 0 0 2px rgba(33,150,243,0.25)` on ONE active element (the reactor core, the focused panel edge); text glow limited to `text-shadow: 0 0 12px rgba(33,150,243,0.25)` on display-size type, never body text. The negative example is the CRT chromatic-separation recipe (animated multi-offset colored text-shadows across all text), which reads cheap precisely because it is everywhere at once: https://aleclownes.com/2017/02/01/crt-display.html . This also honors the standing ban on harsh directional shadows: glow spreads radially and faintly; it never casts directionally.
Reduced motion: pulsing glows become steady glows.

### 2.10 Blueprint grid grounds
Approach A (two gradients): Temani Afif's dashed-line grid from stacked gradients - https://css-tip.com/grid-dashed-lines/
Approach B (solid hairline graph paper): layered `linear-gradient`s as background-image with hard stops at 1px, `background-size` controlling cell pitch; add a coarser major-line layer at 5x pitch for engineering-paper depth.
Approach C (ready-made SVG patterns): Hero Patterns offers Graph Paper and Circuit Board repeatable SVG backgrounds, free to use: https://heropatterns.com
Perf: static background paint only; bake low opacity INTO the gradient colors (e.g. rgba blue at 0.06-0.10) rather than stacking an extra overlay element.
Accessibility: keep grid luminance delta tiny so foreground text contrast is unaffected (contrast rules: https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html covers flash only; measure normal contrast separately under WCAG 1.4.3).
Reduced motion: n/a (static).

### 2.11 Global reduced-motion collapse pattern
Baseline media query, supported broadly since January 2020 across all engines: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
Recommended blanket for this portfolio:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```
plus per-effect static fallbacks listed above (typed text renders complete; sweeps freeze; tickers unwrap). Vestibular-trigger rationale and per-OS user settings are documented on the same MDN page.

---

## Section 3 - Techno / engineered display and mono font candidates (free licenses)

Google Fonts specimens verified this session are marked VERIFIED; additional well-known Google Fonts candidates are listed with specimen URLs but were not individually re-fetched this pass.

### Verified this session

Space Grotesk (VERIFIED) - https://fonts.google.com/specimen/Space+Grotesk
Variable sans by Florian Karsten; weights 300 Light - 700 Bold. Google's own tags: Techno, Rugged, Stiff, Vintage, Loud. Character: grotesque skeleton with quirky ink-trap details; engineered without being costume. Reads premium in display sizes, especially 500-600 with tight tracking. Pairing note: strong identity face for headings against any clean mono (JetBrains Mono / IBM Plex Mono) for labels and code; too characterful for long body text.

JetBrains Mono (VERIFIED) - https://fonts.google.com/specimen/JetBrainsMono (specimen page title: JetBrains Mono - https://fonts.google.com/specimen/JetBrains+Mono)
Variable monospace by JetBrains (Philipp Nurullin, Konstantin Bulenkov); weights 100 Thin - 800 ExtraBold, each with italic. Character: taller x-height, open apertures, designed for long reading in editors - calm authority rather than hacker cosplay. Reads premium; the current default of serious dev-tool sites. Pairing note: ideal data/readout face under Space Grotesk headings; its 800 weight can even carry small headers.

IBM Plex Mono (VERIFIED) - https://fonts.google.com/specimen/IBM+Plex+Mono
By Mike Abbink with Bold Monday; static weights 100 Thin - 700 Bold plus italics. Google's tags include Calm, Business, Futuristic. Character: neutral-humanist mono with corporate-engineering pedigree (IBM heritage). Reads premium-institutional, slightly warmer than JetBrains Mono. Pairing note: best when the portfolio wants "reliable engineer" rather than "sci-fi"; pairs with almost any geometric sans including Space Grotesk.

### Additional candidates (specimen URLs, not re-fetched this session)

Chakra Petch - https://fonts.google.com/specimen/Chakra+Petch
Squared-corner techno Thai/Latin family, weights 300-700 + italics. Character: chamfered corners give instant cockpit-panel flavor. Flag: premium in tiny uppercase label doses; turns cheesy fast at heading sizes or in long runs.

Rajdhani - https://fonts.google.com/specimen/Rajdhani
Condensed squared techno sans, 300-700. Character: HUD-instrument condensed caps. Flag: good for numeric readouts and nav labels; body-text use reads budget-gaming.

Orbitron - https://fonts.google.com/specimen/Orbitron
Geometric squared display face, 400-900, variable. Character: pure science-fiction movie poster. Flag: the most over-associated with sci-fi parody on this list - tends to read cheap except as a rare one-word display accent, if at all.

Share Tech Mono - https://fonts.google.com/specimen/Share+Tech+Mono
Single-weight techno mono. Character: thin, terminal-ish, distinctive. Flag: single weight limits hierarchy; pleasant for readouts, risky as the only mono (no bold for emphasis).

Fira Code - https://fonts.google.com/specimen/Fira+Code
Programming mono with ligatures, 300-700 variable. Character: developer-native credibility. Flag: ligatures off for marketing display; otherwise premium-neutral, similar tier to JetBrains Mono.

General pairing guidance for the blue-ramp light theme: one identity sans (Space Grotesk class) + one workhorse mono (JetBrains/IBM Plex class) covers the entire HUD vocabulary - micro-labels, readouts, logs - without a third face. Display faces like Orbitron/Chakra Petch are accent spices at most.

---

## Section 4 - Restraint guide: engineered-premium vs costume-party

The satirical baseline worth keeping pinned: "You. Are. Over-designing." - Motherfucking Website's rant exists because decoration without function is the failure mode; it closes on "Good design is as little design as possible": https://motherfuckingwebsite.com

Where the line sits, evidenced by the sites in Section 1:

1. One idea per surface, executed totally. Ghostty spends its entire novelty budget on one ASCII hero and stays silent everywhere else (https://ghostty.org). Terminal.shop commits to exactly one conceit - the commit message - and lets typography carry it (https://terminal.shop). Costume-party smell: three unrelated effects (scanlines AND radar AND decode text) competing on one page.

2. The aesthetic must be load-bearing. On term.m4tt72.com the terminal IS the navigation (https://term.m4tt72.com); on starship.rs the console look is the product itself (https://starship.rs); on bun.sh every terminal transcript is real reproducible output (https://bun.sh). If you delete the HUD dressing and the page still works identically, the dressing was decoration; if the page breaks conceptually, it was structure.

3. Real data beats fake telemetry. mattglei.ch's readouts impress because they are genuinely live - his actual repos, music, and games (https://mattglei.ch). Fake "SYS.STATUS: NOMINAL" strings are the fastest route to costume-party. Rule for the portfolio: every readout must trace to something true (GitHub stats, real project metrics, actual uptime).

4. Borrow spec-document grammar, not neon. Linear proves FIG-numbered captions, decimal section indices, and issue-ID tables deliver "engineered" more credibly than any glow (https://linear.app). Warp's density works because ticket IDs and pass-rate numbers are information (https://www.warp.dev). Premium = precision cues; cheap = luminance tricks.

5. Glow is a spotlight, not ambience. Vercel runs an entire brand on one quiet log-card motif with no neon at all (https://vercel.com). Reserve soft radial blue glow (per Section 2.9) for exactly one focal element per view. Everything glowing = everything invisible.

6. Motion obeys the visitor. Continuous sweeps, crawls, and flickers must collapse under prefers-reduced-motion (Section 2.11) and stay under WCAG flash thresholds (https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html). Film-UI references like HUDS+GUIS show why professionals lean on hairline strokes, uppercase micro-labels, and leader lines - grammar that survives being static (https://www.hudsandguis.com).

Tasteful exemplars to emulate (all Section 1): Linear, Vercel, Ghostty, terminal.shop, mattglei.ch, bun.sh.
Cautionary direction (named honestly): full-page CRT flicker treatments per the aleclownes.com recipe are technically excellent but sit at the costume end for a professional portfolio - mine them for the static scanline layer only (https://aleclownes.com/2017/02/01/crt-display.html).

Fit notes for jayptl.me specifically (candidates, not conclusions): the blue ramp (#2196f3) already provides the accent color a HUD needs, so the cheapest path to engineered-premium may be structural grammar first - FIG-style captions, corner-bracket focus states, one live-data readout row - with glow and motion added last, one element at a time, always collapsible.

---

## Source index (all URLs cited above)

Live sites: https://term.m4tt72.com | https://mattglei.ch | https://terminal.shop | https://ghostty.org | https://starship.rs | https://www.warp.dev | https://linear.app | https://bun.sh | https://vercel.com | https://www.hudsandguis.com
Techniques: https://css-tricks.com/snippets/css/typewriter-effect/ | https://aleclownes.com/2017/02/01/crt-display.html | https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/conic-gradient | https://developer.mozilla.org/en-US/docs/Web/CSS/@property | https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dashoffset | https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion | https://css-tip.com/corner-only-border/ | https://css-tip.com/corner-only-border-image/ | https://css-tip.com/grid-dashed-lines/ | https://css-tip.com/logo-marquee/ | https://heropatterns.com | https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html
Fonts: https://fonts.google.com/specimen/Space+Grotesk | https://fonts.google.com/specimen/JetBrains+Mono | https://fonts.google.com/specimen/IBM+Plex+Mono | https://fonts.google.com/specimen/Chakra+Petch | https://fonts.google.com/specimen/Rajdhani | https://fonts.google.com/specimen/Orbitron | https://fonts.google.com/specimen/Share+Tech+Mono | https://fonts.google.com/specimen/Fira+Code
Restraint: https://motherfuckingwebsite.com
