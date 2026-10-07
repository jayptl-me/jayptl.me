# Projects cards revamp: plan (Gate P), 2026-09-30

Research and picks: `projects-cards-audit-and-options-2026-09-30.md`,
`decisions/gate-r-answers.md` ("Projects cards revamp"). Scope: the
/projects page cards only. Navbar, hero copy, and the Stretch Rail are
untouched.

## Shape

1. Hero (unchanged). The "start with the deep dives" strip is removed: the
   first four feature cards are the case studies, so it only repeated them.
2. Filter row: the Stretch Rail filters both sections below; the readout
   counts both ("Showing 8 live and 24 more").
3. Live work: 8 feature cards. Aviz, Swalook, Genuinest, Vini & Tini (case
   studies), then Thhiya, BhawBhaw, Ambica Impex, Ai-Vestor (live sites).
   Whyknot, a launch-teaser page, sits in the archive with its link, which
   keeps the count even so no card is ever alone on a row.
4. Archive: the other 24 projects, newest first.

## Feature card

- Cover: framed desktop screenshot (browser bar, top of the page) on a
  tinted grid mat with padding, the phone screenshot overlapping bottom
  right in a phone frame. Vini & Tini has no phone view, desktop only.
  Light: clay mat on the blue ramp. Dark: glass mat on the turquoise ramp,
  so white screenshots never sit raw on glass.
- Body: title and dates on one line; status line (dot, status, role); full
  description (never clamped); tags; pills: Case study (filled) when there
  is one, Live site (outline, drawn up-right arrow), GitHub when public.
  The dashed footer strip goes.
- Grid: 1 column phone, 2 columns tablet, laptop and wide.
- Card to Cover (the approved morph into the case-study cover) stays on the
  four case studies.
- Images: new 960x600 desktop crops and 300px-wide phone crops from the
  galleries, with width and height set, lazy below the fold.

## Archive row

- Built on the existing Role Ledger (`details` and `summary`, works with no
  script, crawlable, prints).
- Closed row, laptop and wide: Year, Project (with kicker), Role, Built with
  (up to 3 tags), Status or Link. Tablet: Year, Project, Built with, Link.
  Phone: two lines, Year and Project, then role and stack, with the chevron.
- Open row: the project's drawing on the same mat (kept, per the pick),
  full description, all tags, link pill (Live site, GitHub, or none).
- Hover preview, laptop and wide with a fine pointer only: the row's cover
  (drawing, or screenshot for Whyknot) appears at the row's right edge.

## Motion brief (goes into docs/motion-zen.md section 6b before code)

- Feature cards: the existing card lift (1px, clay shadow or rim glow,
  180ms snap); the screenshot inside the frame nudges up 4px on hover,
  transform only. Press 0.985 in 140ms.
- Archive rows: the Role Ledger clip reveal (space opens at once, body
  revealed top to bottom in 240ms, lines staggered 30ms, close fades in
  140ms).
- Hover preview: one preview at a time, pinned to the row (it never
  follows the pointer); appears 180ms opacity plus scale 0.96 to 1, leaves
  140ms; switching rows exits first, then enters.
- Filter swap: the existing exit-first swap across both sections.
- Reduced motion: no lift, no nudge, no preview, native open and close.

## Build order

1. Motion brief into `docs/motion-zen.md` section 6b.
2. Image crops (sips on the Mac, as before) into each project's folder.
3. Markup in `pages/projects/index.html` (one-off script, drawings reused).
4. CSS in `css/pages/projects.css` on the four tiers; mat and frame as a
   small shared part of the card surface.
5. JS: `projects-filter.js` covers features and rows; a small hover-preview
   mount; `command-deck.js` indexes archive rows too.
6. Markdown twin lists live work and the archive.
7. Tests: 8 features and 24 rows; every row is a details/summary with a
   drawing; no lone card at any tier; images carry dimensions; command deck
   still finds all 32; tier ratchet.
8. Build and test on the box, rerun the audit at 390, 768, 1280, 1600 in
   both themes, send screenshots. Target: phone page under 9,500px (now
   18,245px).

Nothing is committed without Jay saying so.
