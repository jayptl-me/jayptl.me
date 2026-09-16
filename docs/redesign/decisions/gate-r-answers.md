# Gate R — Locked Decisions (2026-08-26)

These are the four steering answers you gave in response to the research-wave rack.
Source: `sessions/2026-08-26_round1-research-wave.json` (clarify response block).

The rack asked four questions; you answered all four. These steer any future Gate P plan.

---

## Q1 — Color law conflict
**Question:** The repo law says "never blue in dark theme," but you said you like blue. Which wins?
- Offered: Blue rules both themes / Keep the split / Dark becomes lead canvas
- **Your answer: KEEP THE SPLIT — light blue (#2196f3) / dark turquoise (#00b8cc).**
- Effect: the existing two-theme split stands. Do NOT retire the no-blue-in-dark rule.

## Q2 — Redesign scope
**Question:** How much of the site does redesign round one cover?
- Offered: Home below hero only / Home + Projects / Whole site in one pass
- **Your answer: WHOLE SITE IN ONE PASS.**
- Effect: home (below hero), about, projects index, the 4 case-study pages, and system
  pages (404/500/privacy/design-system) are all in scope — not just the homepage.

## Q3 — Doodle vs HUD balance
**Question:** Balance between DIY doodle feel and Iron Man HUD?
- Offered: Doodle-led with HUD accents / Even split / HUD-led with doodle garnish
- **Your answer: DOODLE-LED WITH HUD ACCENTS.**
- Effect: hand-drawn annotations, scribbles, and doodles carry the personality; HUD
  styling appears as accents (e.g. mono readouts on numbers, corner brackets) not as
  the dominant skin.

## Q4 — Motion level
**Question:** How animated should the redesigned page be?
- Offered: Draw-once then rest / Ambient idle loops / Static only + hover
- **Your answer: AMBIENT IDLE LOOPS.**
- Effect: some elements keep a gentle continuous loop (not one-shot draw-on). Must still
  fully collapse under `prefers-reduced-motion` per standing law.

---

## Standing constraints carried into all research (from recon)
- `jayptl.me` is **strictly hand-written vanilla HTML/CSS/JS** — no React/frameworks,
  no third-party UI component deps, no build-step rewrites.
- Zero emoji anywhere in any deliverable.
- One committed accent per surface; mono font for numbers; 65ch body cap; no gradient soup.
- `prefers-reduced-motion` collapse is mandatory.
- Techniques found on React/JS-heavy reference sites must be reported as **portable
  vanilla patterns** (CSS/SVG/canvas/plain JS), flagged if a library would be required.
