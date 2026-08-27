# Typography Pairings — Candidate-Evidence Dossier (jayptl.me redesign)

Scope: free-licensed, self-hostable type stacks for a hand-written vanilla HTML/CSS/JS portfolio. Two committed themes: light skeuomorphic BLUE ramp (#2196f3 family), dark turquoise GLASSMORPHISM (#00b8cc family). Redesign direction: doodle-led annotations plus Iron-Man HUD mono readouts on numbers. Standing laws honored: one committed accent per surface, mono for numbers, 65ch body cap, zero gradients, prefers-reduced-motion collapse.

Method note: every woff2 weight in this dossier was measured directly from the live Google Fonts CSS2 API (`https://fonts.googleapis.com/css2?family=...&display=swap`) by counting served latin-subset files and their Content-Length bytes on 2026-08-26; license fields come from the `google/fonts` GitHub repository directory (ofl / apache / ufl) per family. KB figures are the latin subset only — other subsets load lazily via unicode-range and are not part of first paint cost. This dossier gathers candidates only; it deliberately names no winner and no ranking.

---

## 1. Pairing candidates (4-role stacks)

### A. Engineer Notebook
Vibe: lab-notebook engineering — a geometric-grotesque skeleton with pencil annotations and instrument-panel numerics.

| Role | Face | Weights | License / repo dir | Measured latin woff2 |
|---|---|---|---|---|
| Display/headings | Space Grotesk | 500, 700 | OFL, google/fonts/ofl/spacegrotesk | 43.6 KB (2 static weights; variable build also available) |
| Body | IBM Plex Sans | 400, 600 | OFL, ofl/ibmplexsans | 78.6 KB |
| Handwriting/annotation | Architects Daughter | 400 | OFL, ofl/architectsdaughter | 12.8 KB |
| HUD mono | IBM Plex Mono | 400, 600 | OFL, ofl/ibmplexmono | 19.7 KB |

Sources: https://fonts.google.com/specimen/Space+Grotesk · https://fonts.google.com/specimen/IBM+Plex+Sans · https://fonts.google.com/specimen/Architects+Daughter · https://fonts.google.com/specimen/IBM+Plex+Mono

Character: Space Grotesk is a techy grotesque with quirky ink-trap details — engineered but personable ([specimen](https://fonts.google.com/specimen/Space+Grotesk)). IBM Plex Sans carries an "engineering" pedigree with open apertures and good screen economy ([about](https://fonts.google.com/specimen/IBM+Plex+Sans/about)). Architects Daughter reads as printed-on-graph-paper handwriting: legible, tidy, slightly stiff — annotation rather than scrawl ([specimen](https://fonts.google.com/specimen/Architects+Daughter)). IBM Plex Mono matches Plex Sans's skeleton so numerals look like they came off the same drafting board ([specimen](https://fonts.google.com/specimen/IBM+Plex+Mono)).

Why the voices work together: all four share drafting-desk DNA — the grotesque display, humanist body, ruled-paper script, and matched mono read like one engineer's kit rather than four downloads.

Load: ~154.7 KB total across 7 latin files.

Against the themes: light BLUE ramp — strong; Space Grotesk's crisp geometry sits naturally on skeuomorphic paper/card surfaces, and Architects Daughter's gray-pencil tone keeps annotations subordinate to the committed #2196f3 accent. Dark turquoise glass — strong but watch contrast: IBM Plex Sans at 400 over translucent panels needs the semi-opaque underlay discipline in Section 3; the Plex Mono readouts feel native to glass HUD chrome.

### B. Comic DIY
Vibe: zine-and-sticker energy — shouty comic display, friendly rounded body, marker scribbles, chunky terminal numerals.

| Role | Face | Weights | License / repo dir | Measured latin woff2 |
|---|---|---|---|---|
| Display/headings | Bangers | 400 | OFL, ofl/bangers | 16.8 KB |
| Body | Comic Neue | 400, 700 | OFL, ofl/comicneue | 25.4 KB |
| Handwriting/annotation | Gochi Hand | 400 | OFL, ofl/gochihand | 19.2 KB |
| HUD mono | VT323 | 400 | OFL, ofl/vt323 | 7.0 KB |

Sources: https://fonts.google.com/specimen/Bangers · https://fonts.google.com/specimen/Comic+Neue · https://fonts.google.com/specimen/Gochi+Hand · https://fonts.google.com/specimen/VT323

Character: Bangers is all-caps comic-book burst lettering built for impact lines ([specimen](https://fonts.google.com/specimen/Bangers)). Comic Neue is the cleaned-up, professionalized successor to Comic Sans, designed specifically to fix its discredited predecessor ([official site](https://comicneue.com/), [Google Fonts entry](https://fonts.google.com/specimen/Comic+Neue)). Gochi Hand is a casual teenage-handwriting pen face ([specimen](https://fonts.google.com/specimen/Gochi+Hand)). VT323 is a chunky low-res terminal face whose pixel grid echoes sticker-chip corners ([specimen](https://fonts.google.com/specimen/VT323)).

Why the voices work together: every voice is unapologetically informal at the same register; the risk is uniform informality, so the mono's rigid pixel grid supplies the counterpoint that keeps the page from dissolving.

Load: ~68.4 KB total across 5 latin files — the lightest stack in this set.

Against the themes: light BLUE — good; comic outlines pair well with doodle arrows and blue-ramp chips. Dark turquoise glass — mixed; VT323's thin pixel strokes are fragile over busy blurred backgrounds (see Section 3), so reserve it for larger readouts or thicken with weight/color.

### C. Blueprint Technical
Vibe: drafting-table schematic — squared techno display, neutral workhorse body, architect's print annotations, squarish HUD numerals.

| Role | Face | Weights | License / repo dir | Measured latin woff2 |
|---|---|---|---|---|
| Display/headings | Chakra Petch | 600, 700 | OFL, ofl/chakrapetch | 19.4 KB |
| Body | Work Sans | 400–600 (variable, single file) | OFL, ofl/worksans | 49.3 KB |
| Handwriting/annotation | Kalam Light + Regular | 300, 400 | OFL, ofl/kalam | 26.6 KB |
| HUD mono | Share Tech Mono | 400 | OFL, ofl/sharetechmono | 7.2 KB |

Sources: https://fonts.google.com/specimen/Chakra+Petch · https://fonts.google.com/specimen/Work+Sans · https://fonts.google.com/specimen/Kalam · https://fonts.google.com/specimen/Share+Tech+Mono

Character: Chakra Petch is a squared, corner-cut techno family with italic variants — it looks pre-drilled for bracket ornaments ([specimen](https://fonts.google.com/specimen/Chakra+Petch)). Work Sans is a restrained grotesque made for long-form screen text ([about](https://fonts.google.com/specimen/Work+Sans/about)); its variable file spans the full range in one download ([variable axes listed](https://developers.google.com/fonts/docs/getting_started#quickstart_examples)). Kalam is a Devanagari+Latin handwriting family derived from real pen strokes — more fountain-pen than felt-tip ([specimen](https://fonts.google.com/specimen/Kalam)). Share Tech Mono is a compact square-tech monospace ([specimen](https://fonts.google.com/specimen/Share+Tech+Mono)).

Why the voices Work together: the squared-corner geometry of Chakra Petch and Share Tech Mono literally rhymes with Iron-Man HUD corner brackets, while Kalam's pen strokes keep it human. One caveat gathered during research: Share Tech Mono has a single weight and no tabular figures guarantee — verify digit alignment before committing it to column readouts ([alternate-figures background](https://practicaltypography.com/alternate-figures.html)).

Load: ~102.5 KB total across 5 latin files.

Against the themes: light BLUE — excellent; blueprint schematics historically live on blue grounds. Dark turquoise — excellent; the squared faces read as HUD instrumentation against glass, though Kalam Light needs the size floor below when used on translucent surfaces.

### D. Marker Graffiti
Vibe: street-marker poster — fat brush display, neutral body, tall skinny marker caps, wide techno numerals.

| Role | Face | Weights | License / repo dir | Measured latin woff2 |
|---|---|---|---|---|
| Display/headings | Permanent Marker | 400 | Apache, apache/permanentmarker | 28.6 KB |
| Body | Inter | 14..32 opsz, 400–700 wght (variable) | OFL, ofl/inter | 71.3 KB |
| Handwriting/annotation | Shadows Into Light | 400 | OFL, ofl/shadowsintolight | 15.6 KB |
| HUD mono | Martian Mono | 400–700 (variable) | OFL, ofl/martianmono | 23.0 KB |

Sources: https://fonts.google.com/specimen/Permanent+Marker · https://fonts.google.com/specimen/Inter · https://fonts.google.com/specimen/Shadows+Into+Light · https://fonts.google.com/specimen/Martian+Mono

Character: Permanent Marker is thick, textured, slightly grungy marker writing ([specimen](https://fonts.google.com/specimen/Permanent+Marker); Apache-licensed per its [google/fonts metadata](https://github.com/google/fonts/tree/main/apache/permanentmarker)). Inter is designed for computer screens with a tall x-height and extensive numeral features including tabular figures ([site](https://rsms.me/inter/), [GitHub](https://github.com/rsms/inter)). Shadows Into Light is tall, narrow, casual handwritten caps-height script ([specimen](https://fonts.google.com/specimen/Shadows+Into+Light)). Martian Mono is a wide, squarish mono with heavy weights that survive tiny sizes ([site](https://evilmartians.com/chronicles/meet-martian-mono)).

Why the voices work together: maximum contrast strategy — the loud marker display and skinny annotation squeeze a deliberately neutral body between them, so the page stays readable while the garnish shouts.

Load: ~138.5 KB total across 4 latin files.

Against the themes: light BLUE — good; marker black-blue reads as graffiti over paper. Dark turquoise glass — workable with care; Inter's sturdiness handles translucency, but Permanent Marker's rough edges can shimmer against blur, so keep display sizes large enough that texture becomes character rather than noise.

### E. Clean With Handwritten Garnish
Vibe: quiet editorial surface with doodles applied like wax seals — serif-flavored display, invisible-workhorse body, casual pen notes, modern mono.

| Role | Face | Weights | License / repo dir | Measured latin woff2 |
|---|---|---|---|---|
| Display/headings | Fraunces | opsz 9..144, wght 400..700 (variable) | OFL, ofl/fraunces | 65.8 KB |
| Body | Inter | same variable file as candidate D | OFL, ofl/inter | 71.3 KB (shared if both candidates ship) |
| Handwriting/annotation | Caveat | 400..700 (variable) | OFL, ofl/caveat | 72.8 KB |
| HUD mono | Geist Mono | 400..700 (variable) | OFL, ofl/geistmono | 22.6 KB |

Sources: https://fonts.google.com/specimen/Fraunces · https://fonts.google.com/specimen/Caveat · https://fonts.google.com/specimen/Geist+Mono (Inter sourced above)

Character: Fraunces is an "old style" display serif with wonky optical-size personality ([specimen](https://fonts.google.com/specimen/Fraunces), [project site](https://fraunces.github.io/)). Caveat converts real ballpoint handwriting into a clean connected script ([specimen](https://fonts.google.com/specimen/Caveat)). Geist Mono pairs with Vercel's Geist sans and ships a full variable range ([site](https://vercel.com/font), [GitHub](https://github.com/vercel/geist-font)). Inter again supplies the neutral body ([site](https://rsms.me/inter/)).

Why the voices work together: the garnish law in action — three disciplined voices carry structure while one warm script does all the hand-drawn talking, matching Jay's one-committed-accent-per-surface rule in typographic form.

Load: ~232.5 KB standalone across 4 variable latin files; drops materially if Inter is shared with candidate D or if Caveat is subset with `text=` since annotation strings are short (Section 2).

Against the themes: light BLUE — distinctive; Fraunces gives the skeuomorphic surface a printed-almanac warmth. Dark turquoise — strong; Caveat's connected strokes stay legible over blur better than thin caps scripts, and Geist Mono's even rhythm suits glass data readouts.

### F. Retro Terminal HUD
Vibe: CRT console — pixel-terminal display, humanist body, marker accents, phosphor numerals.

| Role | Face | Weights | License / repo dir | Measured latin woff2 |
|---|---|---|---|---|
| Display/headings | VT323 | 400 | OFL, ofl/vt323 | 7.0 KB |
| Body | Saira | 400..700 (variable, one file) | OFL, ofl/saira | 32.2 KB |
| Handwriting/annotation | Permanent Marker | 400 (shared with candidate D) | Apache, apache/permanentmarker | 28.6 KB |
| HUD mono | Share Tech Mono | 400 (shared with candidate C) | OFL, ofl/sharetechmono | 7.2 KB |

Sources: https://fonts.google.com/specimen/VT323 · https://fonts.google.com/specimen/Saira · others above

Character: VT323 doubles here as display — its glyph shapes echo 1990s DOS terminals ([specimen](https://fonts.google.com/specimen/VT323)). Saira is a sans with semi-condensed width axis heritage, built for both display and text sizes ([specimen](https://fonts.google.com/specimen/Saira)). Permanent Marker brings the human hand ([above](https://fonts.google.com/specimen/Permanent+Marker)).

Why the voices work together: the mono IS the theme voice; body and annotation orbit it. This is the most thematic-but-riskiest stack — everything hinges on whether pixel displays still read as crafted in five years (see anti-patterns).

Load: ~75.0 KB total across 4 latin files.

Against the themes: light BLUE — decent, retro-computing flavor. Dark turquoise glass — thematically perfect (phosphor terminals were teal-green) but the least accessible pairing here; every VT323 use must clear the Section 3 floors or be decorative-only.

---

## 2. Load discipline

**font-display values.** The CSS API accepts `display=swap` and friends; MDN defines swap as an extremely small block period with an infinite swap period, while optional has an extremely small block period and no swap period at all ([MDN font-display](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display), [CSS API docs](https://developers.google.com/fonts/docs/css2#use_font-display)). Practical split for this project: body and mono faces want `swap` so text never goes invisible; decorative handwriting used only for garnish can safely run `optional` — if it misses its window the fallback renders and nobody's comprehension suffers. Display faces sit between: `swap` with a metric-compatible fallback tuned via `size-adjust`, which scales glyph outlines and metrics of a fallback to reduce reflow when the real font lands ([MDN size-adjust](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/size-adjust)).

**Subsetting.** Google's `text=` parameter returns a font optimized to just those characters — up to 90% smaller — and applies to all families in one request, so different subsets need separate requests ([CSS API docs](https://developers.google.com/fonts/docs/css2#optimizing_your_font_requests)). This is tailor-made for handwriting garnish: subset Caveat or Shadows Into Light to exactly the words that appear as annotations. Self-hosting route: download the css2 response, keep only the `latin` unicode-range block per family, and self-host those woff2 files — non-latin subsets never load unless their unicode-range is hit ([unicode-range descriptor](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/unicode-range)).

**Fallback stability.** Casual faces have wildly different metrics than system fallbacks; without tuning, swap causes visible layout shift. Use `size-adjust` plus ascent/descent overrides on a local() fallback block to pin layout while the webfont loads ([MDN size-adjust](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/size-adjust)). For handwriting especially, design the layout so a fallback cursive/system font failing to arrive changes zero box positions — annotations should be absolutely positioned or inline-block sized independently of their text content where feasible.

**Variable fonts.** Candidates C, D, E lean on variable builds: one woff2 covers a continuous weight range, often without additional latency versus multiple statics, and legacy browsers get nearest static instances back automatically ([CSS API axis ranges](https://developers.google.com/fonts/docs/css2#axis_ranges), [legacy fallback table](https://developers.google.com/fonts/docs/css2#legacy_browser_support)). For a zero-dependency portfolio the wins concentrate in the mono role: Geist Mono (one file, 22.6 KB, weights 400–700) and Martian Mono (one file, 23.0 KB) each replace two static downloads with one variable file. Shantell Sans additionally exposes INFM, SPAC, SHAP custom axes for informal-formal control ([about page](https://fonts.google.com/specimen/Shantell+Sans/about)) — though a probe request combining INFM with wght was rejected HTTP 400 by the live CSS2 API on 2026-08-26, so treat multi-axis requests as unverified until tested.

---

## 3. Legibility rules

**Minimum sizes for handwriting faces.** WCAG 2.2 SC 1.4.3 requires 4.5:1 contrast for normal text and 3:1 for large text — defined as at least 18pt (24 px) regular or 14pt (~18.66 px) bold ([contrast-minimum quick reference](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [SC text](https://www.w3.org/TR/WCAG22/#contrast-minimum)). Casual faces need extra headroom beyond these floors because their x-heights and stroke contrasts run lower than text faces: guidance for accessible typography puts body text around 16 px minimum with 18 px preferred, and recommends generous line spacing ([Section508.gov typography guidance](https://www.section508.gov/develop/fonts-typography/), [fruto design tips](https://fruto.design/blog/10-essential-tips-for-choosing-accessible-fonts-for-educational-digital-products)). Translated into roles for this dossier: handwriting as *headings* — floor around 24 px (the WCAG large-text threshold) since heading duty means the words must parse at a glance; handwriting as *annotations* — floor around 16 px, never below 14 px, and always paired with a plain-text equivalent nearby (aria-label, visually-hidden span, or adjacent body text) because decorative scripts fail assistive parsing and skim reading alike. Anything smaller than 14 px in a script face is decoration, not information — mark it aria-hidden and accept its loss.

**Contrast gotchas on glass backgrounds.** NN/g's glassmorphism guidance flags readability as the top failure mode — text too light or too dark over busy backgrounds — and recommends meeting contrast requirements by controlling what sits behind the panel ([NN/g article](https://www.nngroup.com/articles/glassmorphism/)). Axess Lab documents the same failure: transparency reduces contrast and blur causes sensory pain for some users; body text needs 4.5:1 regardless of how pretty the frost is ([Axess Lab](https://axesslab.com/glassmorphism-meets-accessibility-can-frosted-glass-be-inclusive/)). Practitioner writeups converge on two mitigations: semi-opaque overlays between glass layer and text, and matching text tone opposite to the glass tint (dark text on light-tint glass, light text on dark-tint glass) ([uxpilot best practices](https://uxpilot.ai/blogs/glassmorphism-ui), [pravinkumar.co](https://www.pravinkumar.co/blog/should-you-use-glassmorphism-website-2026)). For the turquoise theme specifically: handwriting in #00b8cc-family tints over frosted panels will miss 4.5:1 at annotation sizes — either darken the ink toward near-black-teal for text-bearing annotations or confine pure-accent scripts to large decorative moments that also exist in accessible form elsewhere.

**Casing and tracking conventions for HUD mono readouts.** All-caps strings need positive letter-spacing to remain parseable — Butterick's practical typography treats spaced capitals as the standard remedy for caps illegibility ([all-caps chapter](https://practicaltypography.com/all-caps.html)). Convention for this project: uppercase HUD labels at 10–12 px with 0.08em+ tracking, digits kept in tabular alignment via font-feature-settings "tnum" where the face supports it (Inter and Martian Mono do; verify per-face before relying on it — see [MDN font-variant-numeric](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric) and [tabular figures rationale](https://practicaltypography.com/alternate-figures.html)), and unit suffixes ("MS", "PCT") in reduced opacity so digits dominate. Mono exists to make columns of numbers scan — tabular figures are essential for vertically aligned numeric grids ([Butterick](https://practicaltypography.com/alternate-figures.html)).

---

## 4. Anti-patterns

Gathered failure modes — combos and habits that tip DIY from crafted to childish:

- **Two competing handwriting voices on one surface.** Marker display + scrawled annotation + script logo = birthday card. Pick one hand; let mono and sans do the rest. Every candidate stack above commits to exactly one casual face.
- **Handwriting for body text.** Long paragraphs in any script face collapse readability; the UX community consensus floors body text at 16–18 px in normal faces already ([ux.stackexchange synthesis](https://ux.stackexchange.com/questions/211/is-there-an-optimal-font-size)) — script faces need more, not less. Keep hands for headings and garnish.
- **All-caps without tracking, or tracked-out lowercase.** Caps need letterspacing; adding tracking to lowercase body breaks word recognition ([Butterick all-caps](https://practicaltypography.com/all-caps.html)).
- **Proportional-digit mono.** A HUD readout whose digits jitter width on every frame defeats the entire point of mono; confirm tabular figures exist before committing ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric)).
- **Decorative display at small sizes.** Pixel faces (VT323) and textured markers (Permanent Marker) below ~20 px turn mushy; if it cannot hold its size floor, it is the wrong face for that slot.
- **Accent-color handwriting on accent-colored surfaces.** Violates the one-committed-accent law twice over — the script disappears AND the surface loses hierarchy. Annotations should be neutral ink or the single committed accent, never both fighting.
- **Gradient-filled display text.** Explicitly out of scope per standing laws, and doubly cheapening next to hand-drawn marks; flat inks only.
- **Loading five families when three tell the story.** Each extra family is latency and another voice arguing; the candidates above cap at four roles total.
- **Simulated handwriting via rotated system fonts or SVG-text tricks instead of a real hand face.** Reads as uncanny; a licensed casual face costs 13–73 KB and lands honestly.

---

## Source index

Primary specimens and foundry pages: Google Fonts specimen URLs cited inline throughout Section 1 (fonts.google.com/specimen/...). Engineering and accessibility claims: developers.google.com/fonts/docs/css2 (subsetting, font-display parameter, variable axis syntax, legacy fallbacks) · developer.mozilla.org font-display / size-adjust / unicode-range / font-variant-numeric pages (behavior definitions, baseline browser support tables captured 2026-08-26) · w3.org WCAG 2.2 contrast-minimum SC text and WAI Understanding document · nngroup.com glassmorphism best practices · axesslab.com glassmorphism accessibility · uxpilot.ai and pravinkumar.co practitioner glassmorphism writeups · section508.gov typography guidance · fruto.design accessible font sizing · practicaltypography.com all-caps and alternate-figures chapters · rsms.me/inter and github.com/rsms/inter · vercel.com/font and github.com/vercel/geist-font · fraunces.github.io · evilmartians.com Martian Mono announcement · comicneue.com.

Measurement provenance: all KB figures from HEAD requests against fonts.gstatic.com woff2 URLs returned by the css2 API with `User-Agent: Chrome/126`, latin subset, normal style only, 2026-08-26. Variable flag determined by presence of a ranged `font-weight:` declaration in the served @font-face block. License directories confirmed by fetching METADATA.pb from the corresponding path in github.com/google/fonts. No ranking, no winner selection — candidates gathered for downstream decision.
