# Recon — Current Site & Constraints (2026-08-26)

Read-only inventory taken before the research wave. Source:
`sessions/2026-08-26_round1-research-wave.json`.

## jayptl.me — what exists today
Strictly hand-written HTML/CSS/JS, zero frameworks. Two themes, never mixed:
- **Light** = skeuomorphic blue ramp (`#2196f3`)
- **Dark** = turquoise glassmorphism (`#00b8cc`)

Deployed on Render.

### Surface map (the canvas the redesign works on)
| Surface | Sections today |
|---|---|
| `index.html` | hero (LOCKED — you like it) + one big project showcase panel. That's all. |
| `pages/about.html` | roles → story → beyond-code → creative-lab |
| `pages/projects/index.html` | featured case-study callout + full project grid |
| 4 case-study pages | aviz-health, genuinest, swalook, vini-tini |
| System pages | 404, 500, privacy, design-system |

## Reference site — Parth Mittal (`mittalparth.dev`)
Full-text capture saved at `research/reference/mittalparth-dev.fulltext.md`.
Below-hero structure observed there (see `research/01-portfolio-structures.md` §1):
1. Bio bullet list (role, hackathon count, leadership, education, fun-fact)
2. GitHub activity heatmap block
3. Hackathons — vertical stack of result cards (cover, placement badge, event, scale, links)
4. Experience & education — logo + tenure, role, date range, "Show more" expanders
5. Projects pinned up — grid of cards (cover, title, tech tags, placement badge, links)
6. Sticker chips scattered between sections with hand-written captions + "Reset stickers" control

Steal-worthy patterns from Mittal: placement badge on the cover-image corner (credibility
reads before the title); the "Reset stickers" affordance (playful + interactive).

## Constraints that shaped the research
- No framework rewrites; vanilla only.
- Techniques from React/JS-heavy sites reported as portable vanilla patterns.
- Standing taste bans: gradient soup, inset/neumorphism shadows, harsh directional drops.
  Glows must be soft and ambient; solids carry color.
- `prefers-reduced-motion` collapse mandatory.
