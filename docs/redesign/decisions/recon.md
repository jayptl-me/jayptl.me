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
| `index.html` | hero + selected work scroll-stack + project showcase panel |
| `pages/about.html` | roles → story → beyond-code → creative-lab |
| `pages/projects/index.html` | featured case-study callout + full project grid |
| 4 case-study pages | aviz-health, genuinest, swalook, vini-tini |
| System pages | 404, 500, privacy, design-system |

## Architecture & Layout Patterns
Below-hero structure observed and planned:
1. Bio bullet list (role, expertise, leadership, education)
2. GitHub activity heatmap block
3. Results & Milestones — vertical/horizontal stack of result cards (cover, placement badge, event, scale, links)
4. Experience & education — logo + tenure, role, date range
5. Projects pinned up — grid of cards (cover, title, tech tags, placement badge, links)
6. Sticker chips scattered between sections with hand-written captions + interactive affordances

## Constraints that shaped the design
- No framework rewrites; vanilla only.
- All techniques hand-crafted as portable vanilla patterns with zero runtime dependencies.
- Standing taste bans: gradient soup, inset/neumorphism shadows, harsh directional drops.
  Glows must be soft and ambient; solids carry color.
- `prefers-reduced-motion` collapse mandatory.

