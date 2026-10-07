# Projects cards: audit and options, 2026-09-30

Gate R research for the Projects card revamp. Mockups with real screenshots:
`projects-card-options-light.jpg` and `projects-card-options-dark.jpg` in this
folder (quick mockups for choosing a direction, not the build).

## Audit (local build, measured at 390, 768, 1280, 1600 wide, light and dark)

1. No hierarchy. All 32 cards are the same size and anatomy; the four case
   studies differ only by a faint accent border.
2. Length. Page height: 18,245px on a phone (about 22 screens), 9,934px on
   tablet, 7,187px on laptop. Card heights 405 to 641px.
3. Covers. 23 of 32 covers are drawings built from about six repeating
   shapes, so most of the page reads as placeholders. Live screenshots are a
   1440px page shrunk to about 370px, too small to read. Two cover types
   side by side look like two different sites.
4. Dark theme. White screenshots sit raw on dark glass and glare.
5. Dead space. Grid rows stretch every card to the tallest; short
   descriptions (Zchat 88 characters, Genuinest about 230) leave 100px or
   more of empty card (Zchat, Donman, School Of Hatha Yoga).
6. Too many micro lines. Kicker, title, description, tags, destination row,
   status and date, role: seven layers per card. Kicker wording has five
   different grammars and is missing on eleven cards.
7. The "start with the deep dives" strip repeats the four case-study cards
   that sit right below it.
8. Laptop and wide: last row holds 2 of 3. At 1600 wide the grid stays three
   columns inside 1280px.

## References studied (live, captured headless)

- athrix.me/projects (Jay's liked dev portfolio): two columns, screenshot
  inset on a soft backdrop with padding, title and date on one line, status,
  short text, tags, Live and GitHub pills.
- radhekrishna.athrix.me (Jay's liked scroll story): huge titles, images
  drift and tilt around them as you scroll.
- brittanychiang.com: a few featured projects as rows with thumbnails, then
  a full archive table (Year, Project, Made at, Built with, Link).
- vercel.com/templates: text first, screenshot peeking up from the card's
  bottom edge, uniform tiles.
- Hover-preview project lists (common on design portfolios and in UI
  catalogs): list rows reveal a floating preview on hover.

## Options

- A. Framed Shelf (athrix.me model). Same 1/2/3/3 grid. Every cover becomes a
  framed desktop screenshot on a tinted mat with a phone frame overlapping,
  so white screenshots never touch dark glass; drawings sit on the same mat.
  Body tightened: title and date on one line, status line, full
  description, tags, pills (Case study, Live site, GitHub). Footer strip
  removed. Cards about 90 to 110px shorter; page still 32 cards long.
- B. Features + Archive (brittanychiang.com model). The 8 live projects
  become big framed cards (2 across from tablet up); the other 24 become an
  archive list (Year, Project, Role, Built with, Link) whose rows expand in
  place to the full description, with a hover preview on laptop and wide.
  Phone page drops from about 18,200px to roughly 8,000px (estimate).
  Filter rail keeps working across both.
- C. Bento Peek (vercel.com/templates model). Text first; live projects span
  two columns with the screenshot peeking up from the bottom edge; projects
  without a site become compact text tiles with no cover.
- D. Story Index (radhekrishna.athrix.me model). Big project names as a list;
  framed screenshots drift beside them on scroll and hover. Most expressive,
  heaviest motion, needs its own motion brief; phones fall back to a list.

Recommendation: B, with A's framed mat used on the feature cards.
Picks recorded in `decisions/gate-r-answers.md` once Jay chooses.
