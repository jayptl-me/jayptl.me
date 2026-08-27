# Portfolio Structures Dossier — Everything Below the Hero

Candidate-evidence dossier for the jayptl.me redesign. Scope: how strong personal dev/designer portfolios structure all content below the hero — sections, components, ordering, transitions, personality. Evidence-gathering only: no winner is picked, nothing is ranked. Every claim carries the URL it was observed on. Constraint carried throughout: jayptl.me is hand-written vanilla HTML/CSS/JS with a light skeuomorphic blue ramp (#2196f3) and a dark turquoise glassmorphism theme (#00b8cc), never mixed — so every anatomy pattern in Section 2 is portable to a no-framework static page.

---

## Section 1 — Named live portfolios: below-hero structure + steal-worthy ideas

### 1. Parth Mittal — mittalparth.dev
Source: local full-text capture at `/Users/jay/.hermes/cache/web/mittalparth.dev-a06672daca.md` (live site: https://mittalparth.dev)

Below-hero section order, exactly as captured:
1. Bio bullet list (current role, hackathon count, leadership, education, one fun-fact line ending in a Times Square feature link).
2. **GitHub activity** block — embedded contribution heatmap labeled `@mittal-parth` (https://github.com/mittal-parth).
3. **Hackathons** — vertical stack of result cards: event cover image, placement badge ("1st Runner Up", "Winner"), event icon + name, one-line outcome with scale ("2nd among 5K+ applications"), and an Article/YouTube link row. A scissors PNG (`clip.webp`) appears between cards like a cut line.
4. **Experience & education** — logo + company + tenure heading, role title, date range, one-line summary, and a "Show more" expander on each card; education follows under its own subheading.
5. **Projects pinned up** — grid of project cards: cover image, title, tech-tag run, placement badge ("Winner - ETHIndia'24, $5000 in grants" — https://devfolio.co/projects/khoj-3336), one-line description, GitHub/Video/Live link row.
6. Sticker chips scattered between sections with hand-written captions: "this is where the work happens" (https://mittalparth.dev/assets/sticker-macbook.webp), "oh, I also dance :)" (https://mittalparth.dev/assets/sticker-shoes.webp), "coffee is overrated, ask for sushi", "meditation is the secret to my energy", plus a "Reset stickers" control at the very bottom.

Steal-worthy:
- **Placement badge on the cover image corner** — the win ("Winner", "1st Runner Up") sits ON the project/hackathon cover, so credibility reads before the title does.
- **The "Reset stickers" affordance** — stickers are playful AND interactive; a small JS control that re-randomizes their rotation turns decoration into a toy.

### 2. Brittany Chiang — brittanychiang.com
Source: https://brittanychiang.com (implementation reference: https://github.com/bchiang7/v4)

Below-hero order: About (first-person prose with inline employer links, closing hobby line incl. a Korok-seeds joke) → Experience (ordered list; each entry is linked employer + role, paragraph of concrete scope, then a trailing row of tech chips; one entry embeds press links to 9to5mac.com and theverge.com as proof) → Projects (four cards with screenshot, description, star-count link, tech chips; ends in "View Full Project Archive") → Writing (thumbnail + year + title rows) → footer easter egg ("Click to time travel" spinning TARDIS gif).

Steal-worthy:
- **Numbered section headings** (01. About, 02. Experience...) with a sticky side-rail layout — gives long pages a spine; documented in her public source, https://github.com/bchiang7/v4.
- **Press-proof inside job entries** — a third-party article link about your work beats describing it (observed in the Apple Music co-op entry, https://brittanychiang.com).

### 3. Josh W. Comeau — joshwcomeau.com
Source: https://www.joshwcomeau.com

Below-hero order: interactive generative-art header with an "Edit the generative art" control → Articles and Tutorials (long list, each item title + teaser + "Read more") → Browse By Category (CSS / React / Animation / Career / ...) → Popular Content, a numbered 01–10 ranked list → footer.

Steal-worthy:
- **"Popular Content" countdown** — after an overwhelming full archive, a numbered top-10 tells a first-time visitor exactly where to start (https://www.joshwcomeau.com).
- **Share-the-trick culture** — his "Sneaky Header Blocker Trick" post exists because a tiny UI detail on his own homepage was worth explaining (https://www.joshwcomeau.com/css/header-blockers/) — a pattern Jay could mirror by writing up his own hero.

### 4. Emil Kowalski — emilkowal.ski
Source: https://emilkowal.ski

Below-hero order: "Today" — two short paragraphs naming current employer (Linear web team) and previous (Vercel design team) → Projects: four rows, each "name — one-line description" (Sonner, Vaul, animations.dev, aiforui.dev) → Writing: ten rows in the same two-line pattern → Newsletter signup → "More": one sentence pointing to Twitter and GitHub.

Steal-worthy:
- **The two-line row unit** — bold name + em-dash subtitle, repeated for both projects and writing; maximum information density with literally zero images (https://emilkowal.ski).
- **A dated urgency banner above the fold** ("Enrollment for my animation course is open! 9 days left") — proof that a live-feeling site needs something time-stamped near the top (https://animations.dev/, linked from https://emilkowal.ski).

### 5. Anthony Fu — antfu.me
Source: https://antfu.me

Below-hero order: one continuous prose intro where every claim is an inline link cluster organized by role-labels — "Creator of Vitest/Slidev/VueUse/UnoCSS/Elk", "Core team of Vue/Nuxt/Vite", "Maintaining Shiki..." → pointers to talks, posts, podcast, streams, generative experiments at https://100.antfu.me, photos, and a /use page → horizontal rule → "Find me on" social row → sponsor block with a transparency link explaining where money goes (https://antfu.me/posts/sponsorship-forwarding) → CC BY-NC-SA footer.

Steal-worthy:
- **Role-labeled inline link clusters** — instead of a skills grid, verbs ("Creator of", "Core team of", "Maintaining") do the categorization inside running text (https://antfu.me).
- **The /uses page pattern** — offloading hardware/software gear talk to a subpage keeps the home page tight (https://antfu.me/use).

### 6. Brian Lovin — brianlovin.com
Source: https://brianlovin.com

Below-hero order: avatar + single-sentence identity ("software designer living in San Francisco, currently making AI products at Notion") → Writing (five most recent titles) → **Projects as a flat index**: fourteen entries, each "Name \\ one-line description", spanning wildly different shapes — HN reader (https://brianlovin.com/hn), App Dissection (https://brianlovin.com/app-dissection), a tools list (https://brianlovin.com/stack), AMA, TIL, Listening, Sites, a podcast (https://designdetails.fm/), a YouTube playlist, CLI tools.

Steal-worthy:
- **Index-then-detail architecture** — the home page is a table of contents; every row links to its own richly designed page, so the homepage never rots while subpages stay fresh (https://brianlovin.com).
- **Treating non-code outputs as projects** — podcasts, playlists, and curated lists sit at equal rank with software (https://brianlovin.com/sites, https://designdetails.fm/).

### 7. Rauno Freiberg — rauno.me
Source: https://rauno.me

Below-hero order: essentially none in the traditional sense — a typographic statement ("is an Estonian interaction designer working with Vercel and Devouring Details") followed by navigation to Craft (https://rauno.me/craft), Projects (https://rauno.me/projects), Field Notes (https://rauno.me/notes), History of Software Design (https://historyofsoftware.org/), plus a stack of one-line mantras: "Make it fast. / Make it beautiful. / ... / Make it."

Steal-worthy:
- **Annual craft-review microsites** — separate domains per year, https://2023.rauno.me/ and https://2022.rauno.me/, that deep-dive one year of interaction polish; the portfolio stays minimal because depth lives elsewhere.
- **Mantra stack as a values statement** — seven short imperative lines communicate taste faster than an About paragraph (https://rauno.me).

### 8. Paco Coursey — paco.me
Source: https://paco.me

Below-hero order: two-line intro (Webmaster at Linear, previously Vercel design system) → "Building" → Craft link (https://paco.me/craft) → Projects: three icon-marked rows (cmdk, Writer, Next Themes) → Writing rows → **"Now"** — a dated-in-spirit living paragraph about what he is enjoying and learning, including music-curation links (https://paco.me/writing/redesign-2021 among writing) → Connect.

Steal-worthy:
- **A "Now" section as the last content block** — signals aliveness without a blog commitment (https://paco.me).
- **One-line-per-project humility** — cmdk (https://github.com/pacocoursey/cmdk) gets the same compact row as everything else; restraint reads as confidence.

### 9. Maggie Appleton — maggieappleton.com
Source: https://maggieappleton.com

Below-hero order: The Garden (defined right in the nav as "imperfect notes, essays, and ideas growing slowly over time", https://maggieappleton.com/garden) → Essays (illustrated cards with recency metadata like "Essay about 1 year ago") → Notes (plain title list) → Patterns (her own design-pattern catalog, https://maggieappleton.com/patterns) → Library (books read / "books I like the idea of having read").

Steal-worthy:
- **Growth-stage metadata on content cards** — every item carries age and type, which makes the whole site feel tended rather than abandoned (https://maggieappleton.com/garden-history explains the philosophy).
- **Honest library framing** — labeling part of your reading list "books I like the idea of having read" is a personality beat that costs one line (https://maggieappleton.com/library).

### 10. Tania Rascia — taniarascia.com
Source: https://www.taniarascia.com

Below-hero order: recent posts with retro pixel thumbnails (floppy-disk logos, konami tile) → **"Shelves"**: categorized article collections presented like a reading room, each shelf with a count and a first-person rationale ("The guides I wished I had when I was learning to code", https://www.taniarascia.com/shelves/#fundamentals) → Series cards (How to Code in JavaScript, Year in Review, Redesigns of this website) → **dated project ledger**: year + name + one-liner + a consistent Article / Demo / Source triple-link row (Keyboard Accordion 2022, TakeNote 2020, Chip8 2019, Sokoban 2021, Snek 2019, New Moon 2015).

Steal-worthy:
- **The triple-link project row** — Article | Demo | Source on every project, uniformly; visitors learn the rhythm once and scan forever (https://www.taniarascia.com).
- **Documenting your own redesigns as content** — a whole series about iterating on the site itself (https://www.taniarascia.com/series/redesigns/) — directly relevant to a redesign launch story.

### 11. Cassidy Williams — cassidoo.co
Source: https://cassidoo.co

Below-hero order: identity line built on voice, not credentials ("I like to make memes and dreams and software") → current-role paragraph with inline links → newsletter push → **recent posts feed** with dates, one-line summaries, and hash-tag chips (#learning, #technical, #personal) → "View posts by tag" cloud → a **"read a random one!"** link into a random post (example target: https://cassidoo.co/post/c-section).

Steal-worthy:
- **Random-post lottery link** — one anchor tag that makes an archive feel enormous and alive (https://cassidoo.co).
- **Tag taxonomy as visible scaffolding** — hashtags on every feed item double as mood board of what the person cares about (https://cassidoo.co/tag/personal).

### 12. Sam Rose — samwho.dev
Source: https://samwho.dev (page title renders as "Hi. I'm Sam.")

Below-hero order: chatty multi-paragraph intro admitting human specifics ("I buy more books than I read, I'm scared of spiders and wasps, and I put ice in my whisky") → visual essay cards, each fronted by an animated SVG/GIF preview (Big O, Bloom Filters, Turing Machines, etc.) → employer context with sample posts → newsletter → podcast appearances and talks lists → **a live widget showing his New York Times games results for today** (Wordle, Connections, Mini) → Quizzes he built (https://jsdate.wtf/, https://e-mail.wtf/) → Miscellaneous experiments, including Ping (https://samwho.dev/ping), "lets you send me a push notification any time you want" → proud-of CLI tools with silly one-liners → book-reviewing acknowledgments.

Steal-worthy:
- **Live personal-data widgets** — today's Wordle results rendered on the page is proof-of-life no static "about me" matches (https://samwho.dev).
- **Animated card covers** — every essay card moves, making a pure-text archive feel like a game shelf; implementable with looping GIF/SVG in a plain `<a>` card.

### Supporting observation — Lee Robinson, leerob.io
Source: https://leerob.io

Included as contrast rather than a full entry: below the hero there is only a bio paragraph (family, music, angel investing) then Notes and Blogs link lists — proof-first to the point of being a link hub. Useful evidence for Section 3/4 about how far "minimal" can go before personality disappears (https://leerob.io).

---

## Section 2 — Section anatomy library (vanilla HTML/CSS, no framework)

Every pattern below assumes semantic HTML plus one stylesheet; no build step, no dependencies. Theme tokens shown as CSS custom properties so the same markup serves both the blue ramp light theme and the turquoise glass dark theme.

### 2.1 Project card (cover image + tag chips + placement badge + links row)

Observed composite of https://mittalparth.dev (badge over cover, tag run, GitHub/Video/Live row), https://brittanychiang.com (screenshot + stars + tech chips), https://www.taniarascia.com (Article/Demo/Source row).

```html
<article class="project-card">
  <a class="card-cover" href="https://playkhoj.com/" aria-label="Khoj live demo">
    <img src="assets/khoj-cover.webp" alt="Khoj treasure-hunt app screen" loading="lazy">
    <span class="placement-badge">Winner - ETHIndia'24</span>
  </a>
  <div class="card-body">
    <h3><a href="https://playkhoj.com/">Khoj</a></h3>
    <p>A geo-location based treasure hunt app.</p>
    <ul class="tag-row" aria-label="Technologies used">
      <li>Solidity</li><li>TypeScript</li><li>React</li>
    </ul>
    <ul class="links-row">
      <li><a href="https://github.com/mittal-parth/Khoj">GitHub</a></li>
      <li><a href="https://youtu.be/98OJuvBur6s">Video</a></li>
      <li><a href="https://playkhoj.com/">Live</a></li>
    </ul>
  </div>
</article>
```

```css
.project-card {
  border-radius: 14px;
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--line);
}
.card-cover { position: relative; display: block; aspect-ratio: 16 / 9; }
.card-cover img { width: 100%; height: 100%; object-fit: cover; }
.placement-badge {
  position: absolute; top: 12px; left: 12px;
  padding: 4px 10px; border-radius: 999px;
  font-size: .72rem; font-weight: 700; letter-spacing: .02em;
  background: var(--accent);          /* #2196f3 light / #00b8cc dark */
  color: var(--on-accent);
  box-shadow: 0 2px 8px rgb(0 0 0 / .25);
}
.tag-row, .links-row { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; margin: 0; padding: 0; }
.tag-row li {
  font-size: .72rem; padding: 3px 9px; border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent-strong);
}
.links-row li + li::before { content: "\00B7"; margin-right: 6px; color: var(--muted); }
```

Notes: `aspect-ratio` reserves cover space so the grid never jumps while images load; the badge is a child of the cover link so hover states unify; dot-separated links row mirrors taniarascia.com's Article/Demo/Source rhythm (https://www.taniarascia.com).

### 2.2 Experience timeline cards with "Show more" expanders

Observed on https://mittalparth.dev (logo + tenure + role + summary + Show more) and https://brittanychiang.com (role paragraphs + tech chips). Vanilla mechanism: `<details>`/`<summary>` needs zero JS; a styled variant animates with `grid-template-rows`.

```html
<ol class="timeline">
  <li class="entry">
    <header>
      <img class="logo" src="assets/oracle.jpg" alt="" width="40" height="40">
      <div>
        <h3>Member of Technical Staff · <a href="https://www.oracle.com/in/">Oracle, India</a></h3>
        <p class="meta">Oct 2025 – Present · 3 yrs 3 mos total</p>
      </div>
    </header>
    <p>Control Plane team, Exadata Database as a Service.</p>
    <details class="more">
      <summary>Show more</summary>
      <p>Longer detail bullets here…</p>
    </details>
  </li>
</ol>
```

```css
.timeline { list-style: none; margin: 0; padding: 0; position: relative; }
.timeline::before {           /* the rail */
  content: ""; position: absolute; left: 19px; top: 8px; bottom: 8px;
  width: 2px; background: color-mix(in srgb, var(--accent) 35%, transparent);
}
.entry { position: relative; padding-left: 56px; margin-bottom: 28px; }
.entry::before {              /* the node */
  content: ""; position: absolute; left: 12px; top: 6px;
  width: 16px; height: 16px; border-radius: 50%;
  background: var(--accent); border: 3px solid var(--bg);
}
.more summary { cursor: pointer; color: var(--accent-strong); user-select: none; }
.more[open] summary .lbl, /* optional label swap via CSS only */
.more summary::marker { content: ""; }
```

Alternative without `<details>` (for animation control): wrap hidden content in `.reveal > .inner { display:grid; grid-template-rows: 0fr; transition: grid-template-rows .3s; } .reveal.open > .inner { grid-template-rows: 1fr; }` and toggle one class with three lines of JS. The `0fr -> 1fr` grid trick animates height without knowing it (works in all evergreen browsers).

### 2.3 Stats / GitHub-graph embeds

Observed: Parth embeds a full GitHub activity heatmap mid-page (https://mittalparth.dev). No-JS options:

- **Chart as an image service** — `https://ghchart.rshah.org/<username>` returns a contributions SVG you drop straight into `<img>` (documented at https://ghchart.rshah.org/). Zero build cost.
- **Stats cards as images** — the github-readme-stats project serves plain `<img>` endpoints (repo: https://github.com/anuraghazra/github-readme-stats) usable outside READMEs too.
- **Dual-theme swap without JS** — serve different art per scheme with `<picture>`:

```html
<picture>
  <source srcset="chart-dark.svg" media="(prefers-color-scheme: dark)">
  <img src="chart-light.svg" alt="GitHub contributions for @jayptl, last year" width="720" height="140" loading="lazy">
</picture>
```

- If the heatmap itself matters, generate a static SVG at deploy time (or commit-time via cron) from the GitHub contributions API (https://docs.github.com/en/rest/activity/events) and ship it as a file — keeps the runtime dependency-free even though generation is scripted.

### 2.4 Sticker-chip asides with captions

Observed on https://mittalparth.dev: rotated sticker images with hand-written captions ("this is where the work happens", "oh, I also dance :)") scattered between sections, plus a "Reset stickers" control. Vanilla approach:

```html
<aside class="sticker" style="--r:-7deg; --x:78%">
  <img src="assets/sticker-shoes.webp" alt="">
  <span class="caption">oh, I also dance :)</span>
</aside>
```

```css
.sticker {
  position: absolute;               /* parent section gets position:relative */
  inset-inline-start: var(--x);
  rotate: var(--r);
  width: 92px; text-align: center;
  filter: drop-shadow(0 4px 6px rgb(0 0 0 / .18));
}
.sticker .caption {
  display: block; margin-top: 4px;
  font-family: "Caveat", "Segoe Script", cursive;   /* load Caveat via @font-face */
  font-size: .95rem; color: var(--ink-soft);
  rotate: calc(var(--r) * -.35);
}
```

JS for a Reset control (mirrors the observed behavior): collect `.sticker` nodes, on click reassign each `style.setProperty('--r', rand(-12,12)+'deg')`. On narrow screens either hide half the stickers (`display:none` under a media query) or convert them to an inline flex strip so they stop overlapping text.

### 2.5 Bento grids

Observed lineage: dashboard-like mixed-size tiles across modern portfolios (e.g., project + stats + aside tiles on https://mittalparth.dev; Maggie Appleton's mixed-type card wall at https://maggieappleton.com). Pure-CSS approach with named spans:

```html
<section class="bento">
  <article class="tile span2">…flagship project…</article>
  <article class="tile">…github chart…</article>
  <article class="tile">…now playing / now building…</article>
  <article class="tile tall">…sticker + caption…</article>
</section>
```

```css
.bento {
  display: grid; gap: 12px;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 150px;
}
.tile { border-radius: 16px; padding: 18px; background: var(--surface); border: 1px solid var(--line); }
.span2 { grid-column: span 2; }
.tall  { grid-row: span 2; }
@media (max-width: 720px){ .bento { grid-template-columns: repeat(2,1fr); } .span2{grid-column: span 2;} }
```

Glassmorphism fit for the dark theme: `background: color-mix(in srgb, var(--accent) 8%, transparent); backdrop-filter: blur(10px); border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);` — keeps tiles turquoise-tinted without introducing new hues.

### 2.6 Footer sign-offs

Observed: Anthony Fu ends with a license + year + sponsor transparency link (https://antfu.me); Brittany Chiang ends with a clickable easter egg ("Click to time travel" TARDIS, https://brittanychiang.com); Parth ends with "Reset stickers" (https://mittalparth.dev); Paco ends with a simple Connect line (https://paco.me).

```html
<footer>
  <p class="signoff">Hand-written HTML/CSS/JS — no frameworks, no trackers.</p>
  <p class="meta"><time datetime="2026-08">Updated Aug 2026</time> · <a href="mailto:hi@jayptl.me">hi@jayptl.me</a> · <button id="reset-stickers" type="button">Reset stickers</button></p>
</footer>
```

Vanilla touches: `document.lastModified` can fill the `<time>` automatically if you accept server/file mtime; a mailto with a spelled-out address survives copy-paste better than icon-only links (contrast observed across https://paco.me vs icon-heavy sites).

---

## Section 3 — Narrative flow: ordering strategies observed

Three recurring below-hero architectures across the twelve primaries (all URLs above):

**A. Proof-first (credentials lead).**
Order: short About -> Experience -> Projects -> Writing/footer. Observed on https://brittanychiang.com, https://emilkowal.ski (Today -> Projects -> Writing), https://leerob.io (bio -> notes -> blogs), https://paco.me (intro -> Building -> Projects). Personality arrives late but lands hard when it does — Chiang's Korok-seed line and TARDIS footer, Emil's terse wit. Risk observed at https://leerob.io: with no playful artifact anywhere, the page reads as an executive summary.

**B. Story-first / play-first (identity leads).**
Order: persona intro -> artifacts-as-evidence -> meta/fun blocks. Observed on https://samwho.dev (whisky-and-wasps intro before any credential), https://mittalparth.dev (fun-fact bullet and heatmap before hackathon proof), https://cassidoo.co ("memes and dreams and software"), https://maggieappleton.com (garden philosophy before essays). Credibility still appears early-ish but framed narratively (Parth's "15x Hackathon Winner" is in his headline bullet list, not a resume block).

**C. Work-is-the-portfolio (artifacts ARE the page).**
Order: one-paragraph identity -> the works themselves, heavily cross-linked. Observed on https://www.joshwcomeau.com (articles dominate; categories and a top-10 curate them), https://brianlovin.com (index of everything), https://antfu.me (prose made entirely of project links), https://www.taniarascia.com (posts + shelves + project ledger). The "about" is implied by what you choose to show.

**Transition mechanics observed:**
- Horizontal rules as chapter breaks — https://antfu.me uses bare `<hr>` between intro, socials, and sponsor blocks; https://paco.me separates Now and Connect the same way.
- Numbered headings as wayfinding — 01./02./03. section labels at https://brittanychiang.com (per https://github.com/bchiang7/v4) and a literal 01–10 popularity countdown at https://www.joshwcomeau.com.
- Physical-world metaphors as separators — Parth's scissors/clip graphic between hackathon cards implies "cut here" (https://mittalparth.dev/assets/sticker-macbook.webp siblings; clip.webp between cards in the capture).
- Scatter-decor as connective tissue — stickers placed BETWEEN sections rather than inside them (capture of https://mittalparth.dev), so they reward scrolling instead of interrupting reading.
- Recency metadata everywhere — "Jul 6, 2026" stamps (https://cassidoo.co), "about 1 year ago" (https://maggieappleton.com), month-year rows (https://leerob.io): freshness cues are the cheapest perceived-aliveness device observed.

**Where personality beats land best (observed placements):**
- Inside the FIRST paragraph of About, as a closing sentence (Chiang's climbing/Hyrule line, https://brittanychiang.com; Sam's spider confession, https://samwho.dev).
- At section boundaries as captions on decor (Parth's sticker captions between Hackathons and Experience, capture of https://mittalparth.dev).
- In the final scroll position as an easter egg (TARDIS, https://brittanychiang.com; Reset stickers, https://mittalparth.dev; mantras, https://rauno.me).
- As microcopy on functional elements — "read a random one!" (https://cassidoo.co), "books I like the idea of having read" (https://maggieappleton.com/library).

---

## Section 4 — Anti-patterns: what makes below-hero feel dead or corporate

Each item cites observed counter-evidence from the live sites above.

1. **Uniform identical card grids.** Rows of same-sized featureless tiles flatten hierarchy. Counter-examples: bento-style mixed spans (Section 2.5), Brittany's alternating project emphasis (https://brittanychiang.com), Maggie's varied illustrated cards (https://maggieappleton.com).
2. **Skill bars / percentage proficiency charts.** None of the twelve strong portfolios shows a single "CSS 80%" bar; competence is demonstrated through linked artifacts instead (https://antfu.me, https://github.com/mittal-parth via https://mittalparth.dev). Their absence is itself evidence.
3. **Corporate third-person bios.** Every strong example writes in first person with at least one human specific: "husband, dad, programmer, whisky-drinker" (https://samwho.dev), "memes and dreams and software" (https://cassidoo.co). Passive "John is a results-driven engineer" phrasing appears nowhere in the set.
4. **Undated, context-free experience lists.** Strong timelines always carry duration and one scope line ("· 3 yrs 3 mos", "Working on various projects in the Database as a Service, Control Plane team" — capture of https://mittalparth.dev; Chiang's full paragraphs per role, https://brittanychiang.com). Logo-wall-without-narrative reads as filler.
5. **Project cards with no live link or no artifact.** Every project entry across https://www.taniarascia.com carries Demo + Source; Parth's carry GitHub + Video + Live. Cards linking nowhere (or only to a private repo) break the proof chain.
6. **Link-hub drift.** When everything below the hero collapses into undifferentiated link lists, personality dies — the risk visible at https://leerob.io, and actively avoided by peers at similar seniority who add one living artifact (heatmap at https://mittalparth.dev, Now section at https://paco.me, NYT-results widget at https://samwho.dev).
7. **Dead footer.** Footers that are just icon stacks squander the final scroll beat. Observed alternatives: easter eggs (https://brittanychiang.com), an interactive control ("Reset stickers", https://mittalparth.dev), a values/mantra restatement (https://rauno.me), a sign-off sentence stating how the site was built (candidate pattern; observed spirit at https://antfu.me's CC/license line).
8. **No freshness signals.** Pages without any date, "now", or activity surface feel abandoned regardless of quality. Cheapest observed fixes: recency stamps on feed items (https://cassidoo.co), age labels on cards (https://maggieappleton.com), an embedded activity graph (https://mittalparth.dev).
9. **Personality only in the hero.** Sites that spend all whimsy above the fold and go sterile below lose the visitor mid-scroll; the strong set deliberately re-injects voice at boundaries and footer (sticker captions mid-page at https://mittalparth.dev; TARDIS at https://brittanychiang.com).
10. **Decoration with no interaction.** Static ornament ages instantly; the memorable decor pieces observed are all touchable — editable generative header (https://www.joshwcomeau.com), resettable stickers (https://mittalparth.dev), random-post dice roll (https://cassidoo.co), push-notification toy (https://samwho.dev/ping).

---

## Appendix — Source inventory

Primary sites extracted live or from local capture (all fetched August 26, 2026):
| Person | URL |
|---|---|
| Parth Mittal | https://mittalparth.dev (+ local capture `/Users/jay/.hermes/cache/web/mittalparth.dev-a06672daca.md`) |
| Brittany Chiang | https://brittanychiang.com |
| Josh W. Comeau | https://www.joshwcomeau.com |
| Emil Kowalski | https://emilkowal.ski |
| Anthony Fu | https://antfu.me |
| Brian Lovin | https://brianlovin.com |
| Rauno Freiberg | https://rauno.me |
| Paco Coursey | https://paco.me |
| Maggie Appleton | https://maggieappleton.com |
| Tania Rascia | https://www.taniarascia.com |
| Cassidy Williams | https://cassidoo.co |
| Sam Rose | https://samwho.dev |

Supporting citations: https://leerob.io, https://github.com/bchiang7/v4, https://ghchart.rshah.org/, https://github.com/anuraghazra/github-readme-stats, https://docs.github.com/en/rest/activity/events, https://devfolio.co/projects/khoj-3336, https://jsdate.wtf/, https://e-mail.wtf/, https://samwho.dev/ping, https://antfu.me/use, https://antfu.me/posts/sponsorship-forwarding, https://www.taniarascia.com/series/redesigns/, https://maggieappleton.com/garden-history, https://100.antfu.me/.
