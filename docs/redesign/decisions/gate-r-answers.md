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

---

# Round 2026-09-30: UI system (audit in ../ui-audit-2026-09-30.md)

## Locked (Jay, 2026-09-30)
- Q1 Button system: PILL FAMILY. Every button grows from the Talk Chip
  pill (the navbar "Book 15 min" look): filled, outline, quiet
  text-with-arrow. Heights 48 phone, 44 tablet, 40 desktop.
- Q3 Project cards: CASE-FILE CARD. Cover, title, one-line pitch, one tag
  row, footer strip (status dot, status, dates, role). Equal heights per
  row, whole card clickable with the card to cover morph. 1 / 2 / 3
  columns on phone / tablet / desktop.
- Q4 Link arrows: DRAWN LINE ARROW in the stack-chip stroke style, 2 px
  nudge on hover; real GitHub, LinkedIn, Hugging Face icons on the resume
  contact row. Replaces the global text-glyph arrow.
- Q5 Loading look: INK SCRIBBLE. A small hand-drawn loop draws itself,
  then settles into a check (success) or a cross (error).

## Locked, second pass (Jay, 2026-09-30, question tool)
- Q2 Projects filter row: STRETCH RAIL. One clay (light) / glass (dark)
  strip; the highlight's leading edge stretches to the new filter, the
  trailing edge follows; drag or flick on desktop; count inside the
  highlight. Phone: one chip ("Client work, 13") opening a short menu.
  Learned from a reference catalog's segmented control and glide select;
  clean-room, no bounce (motion-zen).
- Q6 "Out of layout" Book button: THE RECTANGLE ONE, the "Book it" submit
  on /book (the only square-cornered Book button). Pill family fixes it.
- Q7 Preloader: INK LOOP TO REVEAL. No text, no fonts. A hand-drawn loop
  draws itself, closes into a dot, the dot opens as a circle revealing the
  page. Inline, under 2 KB, CSS-driven from first frame, page fully drawn
  underneath (not hidden), first visit per session only, about 900 ms
  cap, none under reduced motion. Replaces the text and fake-percentage
  preloader.
- Q8 Measuring: NO INSTALL. Real loading metrics in the browser pane
  (visible) before and after, then PageSpeed Insights on the live site
  after deploy.

## Agent calls (mechanical, no rack)
- Four screen tiers everywhere: phone < 600, tablet 600 to 1023, laptop
  1024 to 1439, wide 1440+.
- Every interactive component gets idle, hover (pointer only), pressed and
  held, focus-visible, disabled, loading, success, error, cancel, on the
  motion-zen clock.
- 44 px minimum tap targets on phones.
- About section-head doodle gets a real height (150 px default box bug).

## Locked, third pass and Gate P (Jay, 2026-09-30, question tool)
- Covers for the 28 projects without screenshots: DRAWN BLUEPRINT. A
  hand-drawn line cover from each project's own shape on the paper grid, in
  theme ink. The 4 case studies use their real screenshots.
- Motion exception: ALLOWED. The preloader's opening circle may animate a
  mask radius (one element, 320ms, first visit only). Logged in
  docs/motion-zen.md rulings.
- Gate P: APPROVED "start Phase 0". Plan page:
  https://claude.ai/artifact/8RT3fL882pcH5oqKWLYoWf (v1). Phase 0
  foundation, then Phase 1 Projects, then Jay reviews live.

## Phase 1 review (Jay, 2026-09-30, question tool)
- Projects page: APPROVED, go to About (Phase 2).
- Card text: KEEP FULL DESCRIPTIONS on case-file cards (supersedes the
  "one-line pitch" wording in the card brief; nothing is clamped).

## Phase 2 review (Jay, 2026-09-30, question tool)
- About page: APPROVED, go to Resume (Phase 3).
- Beyond the Code card order: KEEP (Gamer, Game dev, Homelab, Sound).

## Phase 3 review (Jay, 2026-09-30, question tool)
- Resume page: APPROVED, go to Home (Phase 4).

## Phase 4 review (Jay, 2026-09-30, question tool)
- Home page: APPROVED, go to Phase 5 (book, contact, case studies).
- Removed "Live Preview" placeholder links: LEAVE THEM OUT.

## Phase 5 review and follow-ups (Jay, 2026-09-30, question tool)
- Phase 5: APPROVED. Screenshots: "get better loaded screenshots";
  recaptured Aviz (avizhealthcare.com), Genuinest (genuinest.com), Hugging
  Face profile; Swalook from Jay's own billing screenshot (demo data).
- Proof pass: JAY CHECKS IT HIMSELF (no browser pane for the agent).
- Tini "published on Hugging Face" copy while the model page is not
  public: LEAVE IT FOR NOW (open item).

## Projects cards revamp (Jay, 2026-09-30, question tool)
Research: docs/redesign/projects-cards-audit-and-options-2026-09-30.md
(mockups projects-card-options-light.jpg and -dark.jpg).
- Layout: B, FEATURES + ARCHIVE (live projects as big cards, the rest as an
  expandable archive list; brittanychiang.com model).
- Covers: DESKTOP + PHONE ON A MAT (framed, padded, tinted mat).
- Projects without a live site: KEEP THE DRAWINGS (shown on the mat in the
  open archive row and in the hover preview).
- Descriptions: FULL TEXT, ONE TAP AWAY (feature cards always full; archive
  rows open in place to the full text). Refines the Phase 1 "keep full
  descriptions" ruling: nothing is clamped or cut.
- Gate P: plan at docs/redesign/projects-cards-plan-2026-09-30.md, awaiting
  approval.
- Gate P: APPROVED "build it" (2026-09-30). Deep-dives strip: REMOVE.
  Whyknot: ARCHIVE WITH ITS LINK (8 feature cards).

## Live links and honesty fixes (Jay, 2026-10-07, chat)
- Thhiya links to https://www.thhiya.com/#home (site back online; full
  gallery recaptured, replacing the 900px recovered frames).
- School Of Hatha Yoga is live at https://schoolofhathayoga.org/ (agent
  had wrongly called it unrelated): now a feature card with a gallery;
  9 feature cards, the ninth spans the row.
- Ai-Vestor: "live on Render" (was "deployed on Oracle Cloud").
- Model hub profile is jayptl-rq; only jayptl-rq/vini-pico is public, so
  every "Tini is published" claim was corrected and the profile linked.
- Committed and pushed to main on Jay's request (commit 49f8c07). The
  staged removal of AGENTS.md from git (local exclude) was left as found,
  not committed: Jay to decide.
- Follow-ups (Jay, 2026-10-08, question tool): AGENTS.md STAYS ON GITHUB
  (staged removal undone; the local exclude line stays, it only covers
  untracked copies). NDS Services and Within MOVE TO PERSONAL (private
  repos). Zchat is a PERSONAL PROJECT FROM 2021. ALL SOCIALS REMOVED from
  the site (31 projects). Donman 2023, Product-X 2025, HMS 2025, Ambica
  2026 confirmed. Ai-Vestor: frontend on Render, backend on Oracle Cloud;
  the resume keeps Oracle Cloud.
