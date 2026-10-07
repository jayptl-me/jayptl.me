<!-- owner-rules -->
> **Owner rules come first.** Read `~/.agents/OWNER.md` before anything else: it sets the autonomy
> model and the only gates that wait for Jay, and it wins over this file. The rules below are this
> project's facts and additions; if one conflicts with OWNER.md, follow OWNER.md and raise it with Jay.
<!-- /owner-rules -->

# jayptl.me, Project Rules (AGENTS.md)

Project-level brain. Global laws live in Hermes memory; only jayptl.me facts belong here.

## Hard rules

- STRICTLY hand-written HTML/CSS/JS. No frameworks, no build-step rewrites.
- 100% ORIGINAL, BESPOKE IMPLEMENTATION. All UI features, animations, layouts, and components must be written completely from scratch in custom vanilla HTML/CSS/JS. UI concepts, snippets, or blocks from prompts, documentation, or the web may serve ONLY as conceptual inspiration for our own custom implementations.
- ZERO external proprietary dependencies or registries. Never fetch from, install, import, or configure private/commercial registries (e.g. commercial component registries, private registries, paid UI kits, or authenticated npm scopes).
- ZERO third-party trademark/product names in deliverables, source code, docstrings, comments, or commit messages. Never brand or attribute our bespoke code to external proprietary libraries.
- Light theme = skeuomorphic BLUE ramp (#2196f3). NEVER turquoise in light mode.
- Dark theme = glassmorphism TURQUOISE ramp (#00b8cc). NEVER blue in dark mode.
- Zero emojis in deliverables.
- Zero em dashes in deliverables. Use commas, colons, or periods instead.
- Homepage hero reveal bookends are LOCKED: it always opens "LOOKING FOR JAY?" and closes "Ahhhh, Just Jay!". Only the middle words may change (see `docs/taste.md` rulings log).
- No AI co-authors. Commits and PRs never carry `Co-authored-by` trailers for Claude or any other AI tool. Add a `Co-authored-by` trailer only for a real person who actually co-wrote the change.
- Research before build (Jay's rule, 2026-09-28). Every new page, section, or component gets its own written scroll and motion brief BEFORE any code: how it scrolls (glide wheel on desktop mouse wheels, native scroll on touch and trackpad), how it hands off to the stepper (which keeps its own scroll control) and scroll-stack, its reduced-motion end state, and which liked reference in `docs/taste.md` section 12 it follows. The brief goes in `docs/motion-zen.md` section 6 and passes Gate R before Gate P.
- Every edit, however small, is checked against `docs/taste.md`, `docs/motion-zen.md`, `.agents/rules/custom-code-policy.md`, and this file before it lands.

## Local agent memory (gitignored, for local safety)

`.agents/memory/` holds agent memory for this repo so no context is lost when a chat is deleted. It is listed in `.gitignore` and must NEVER be committed, force-added, or copied into `dist/`.

- Start of every session: read `.agents/memory/MEMORY.md`, then any entry it points to that fits the task.
- `facts/`: one durable fact per file (who Jay is, feedback, decisions, reference pointers) with a short frontmatter `name` and `description`. Update an existing file instead of duplicating, and delete facts that turn out wrong.
- `sessions/`: one summary per working session: what was studied, what Jay decided, verified facts, what changed in the repo, and the next step.
- `artifacts/`: every published claude.ai artifact for this repo. After each publish, save the editable source and the page as published, and update `artifacts/INDEX.md` with its URL and version history. `transcripts/`: exported chat zips.
- After adding anything, add one line to `MEMORY.md`.
- Never store secrets here (tokens, OAuth secrets, Redis URLs, passwords). Those live in `.env` or the host's env settings only.
- Anything that is a rule for every agent belongs in this file or `docs/`, not only in memory.

## Theme Taste & Aesthetics Specification

The portfolio uses two fundamentally distinct design languages across light and dark modes. Agents must NEVER mix their tokens, visual materials, or color ramps.

### 1. Dark Mode Taste: "Liquid Glass" (Turquoise Ramp)
- **Vibe & Mood**: Sci-Fi, deep space refractive liquid glass, glowing neon reflections, sleek obsidian aesthetic.
- **Color Palette**: STRICTLY Turquoise ramp (`#00b8cc`, `var(--accent-400)`, `var(--accent-500)`, `var(--accent-300)`). **NEVER blue in dark mode.**
- **Materiality & Surfaces**:
  - Translucent obsidian/slate surfaces (`linear-gradient(135deg, rgba(14, 22, 33, 0.78), rgba(8, 13, 20, 0.88))`).
  - High blur refraction: `backdrop-filter: blur(20px) saturate(160%)`.
  - Specular rim reflections: crisp white/translucent inner highlight on the top edge (`inset 0 1px 1px 0 rgba(255, 255, 255, 0.22)`).
  - Ambient edge glow: diffuse turquoise perimeter glow (`0 0 20px -2px rgba(0, 184, 204, 0.15)`).
  - Neon accents: glowing cyan/turquoise badges, status indicators, and lightsaber beam.

### 2. Light Mode Taste: "Soft Calm Clay & Light Play UI" (Skeuomorphic Blue Ramp)
- **Vibe & Mood**: Tactile, organic, calm, premium porcelain/clay extrusion with directional ambient lighting and physical depth.
- **Color Palette**: STRICTLY Skeuomorphic Blue ramp (`#2196f3`, `var(--primary-500)`, `var(--primary-600)`, `var(--primary-900)`). **NEVER turquoise in light mode.**
- **Materiality & Surfaces**:
  - Opaque-matte porcelain/clay surfaces (`rgba(244, 248, 252, 0.94)` or `#ffffff`).
  - Tactile depth via dual diffused shadows: soft ambient spread (`0 12px 30px -6px rgba(33, 150, 243, 0.18)`) + close contact shadow (`0 4px 12px rgba(0, 0, 0, 0.05)`).
  - Light Play inner bevels: top inner highlight catching an overhead light source (`inset 0 2px 1px rgba(255, 255, 255, 0.95)`) and bottom ambient shadow rim (`inset 0 -2px 1px rgba(33, 150, 243, 0.10)`).
  - Pill buttons and cards feel physically pressable and extruded, rather than flat or harsh.

## Ops & Deployment Architecture

- **100% Pure Static Site**: `jayptl.me` is strictly hosted as a pure static site on Render's global CDN (`runtime: static` in `render.yaml`), NOT as a Node server. Zero server spin-downs, zero cold starts, instant edge delivery.
- **Render Static Routing Rules**:
  - Render Static Sites **DO NOT** read `_redirects` files (which are only for Netlify/Cloudflare).
  - Clean URLs (`/about`, `/resume`, `/projects`, etc.) work natively via directory-based `index.html` structure generated by `scripts/build.js` (`dist/<route>/index.html`).
  - Render blueprint `render.yaml` declares `runtime: static`, `staticPublishPath: ./dist`, security `headers:`, and fallback `routes:`.
  - When adding any new page to `pages/`, `scripts/build.js` automatically generates its `dist/<slug>/index.html` file, and regression tests in `tests/artifacts.test.mjs` verify coverage.
- **Security headers**: `scripts/security-headers.js` is the single source of truth (CSP, HSTS, frame, referrer, permissions, COOP/CORP). `scripts/build.js` stamps the CSP `<meta>` into every built page, and `tests/security-headers.test.mjs` fails if `render.yaml` or `_headers` drift from it. The CSP has no `unsafe-inline` for scripts: never add inline `<script>` blocks or `on*=` handlers, put behavior in `js/` files.
- **API service (`services/api/`)**: a separate zero-dependency Node service (views, uptime, booking, now playing) meant for its own Render free web service; it is NOT part of the static site or `render.yaml`. The site talks to it only through `js/components/site-api.js`; while `API_BASE` there is empty, every API feature stays hidden. Turning it on means setting `API_BASE` and adding the same origin to `connect-src` in `scripts/security-headers.js` (a test enforces the match). Setup steps live in `services/api/README.md`. Secrets only in the host's env settings.
- Dev server habitually runs on port 8000 (`scripts/preview.js` serves `dist/` with directory `index.html` resolution).
- `dist/` is build output; edit sources in `pages/`, `css/`, `js/`, `markdown/`.
- **Clean-build deployment rule (no stale files, ever)**: `scripts/build.js` wipes `dist/` at startup, so every invocation path builds from scratch. `scripts/validate.js` fails the deploy when any source is newer than `dist/build-info.json`. Never ship a `dist/` that was built before the latest source change, rebuild with `rm -rf dist && node scripts/build.js`.
