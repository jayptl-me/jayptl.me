# jayptl.me - Portfolio Website

Professional portfolio website showcasing software development, UI/UX design, and creative direction work.

## Agent readiness

This site is built to be consumable by AI agents and crawlers without a browser:

- **Content without JavaScript**, every page's meaningful content (H1, copy, project descriptions) and JSON-LD structured data live in the raw HTML.
- **Markdown content negotiation** ([acceptmarkdown.com](https://acceptmarkdown.com)), send `Accept: text/markdown` to any page URL to get its Markdown twin, or fetch the `.md` companion directly (`/index.md`, `/about.md`, `/projects/aviz-health.md`, …). Negotiated responses carry `Vary: Accept`.
- **Structured JSON errors**, `/api/*` paths and JSON-preferring clients get `{ error: { code, message, hint } }` bodies (404/405/406) instead of HTML error pages when served through `scripts/server.js`.
- **Machine-readable surface**:
  - [`/openapi.json`](openapi.json), OpenAPI 3.1 description of the public endpoints
  - [`/llms.txt`](llms.txt), curated index for LLMs ([llmstxt.org](https://llmstxt.org) format)
  - `/llms-full.txt`, all pages flattened to Markdown (generated at build time)
- **AI crawlers allowed**, `robots.txt` explicitly allows GPTBot, ClaudeBot, ChatGPT-User, PerplexityBot, Google-Extended, Applebot-Extended, DeepSeekBot, and more.
- Production is a **Render static site** (`render.yaml`, `runtime: static`) behind Cloudflare; the negotiation, JSON errors, clean URLs and security headers ship through `dist/.htaccess` parity files and Render's route/header config. `scripts/server.js` (Node) provides the same behaviours for local preview and non-Render hosts. The backend API is a **separate Render web service** (`services/api`, live at `api.jayptl.me`) — it is intentionally not part of this static deploy.

### Verification

```bash
curl -si -H "Accept: text/markdown" https://jayptl.me/          # markdown + Vary: Accept
curl -s https://api.jayptl.me/v1/health                        # {"ok":true,...} — separate API service
bun run test                                                   # clean build + the behaviour suite
```

### Cloudflare / WAF notes (dashboard, not repo)

The domain is proxied through Cloudflare in front of Render. Two settings live only in the Cloudflare dashboard:

1. **Bot AI allowlist**, Security → Bots: disable "Block AI bots"/Bot Fight Mode challenges for this zone (or add WAF exceptions for `GPTBot`, `ClaudeBot`, `ChatGPT-User`, `PerplexityBot`). As of 2026-08 these four received 403s from the edge even though the origin serves them.
2. **Apex canonicalization**, `www.jayptl.me` 301s to the apex, matching the canonical tags, sitemap and llms.txt. Keep it that way: if the redirect is ever flipped to `apex → www`, update canonicals/sitemap/llms.txt to the www host instead.

## Features

- **Responsive Design** - Mobile-first approach, works on all devices
- **Dark/Light Theme** - System preference detection with manual toggle
- **Performance Optimized** - Lighthouse score 95+, fast loading
- **Accessible** - WCAG 2.1 AA compliant
- **SEO Optimized** - Structured data, sitemap, meta tags
- **Modern Stack** - Vanilla HTML/CSS/JS, no frameworks
- **Production Build** - Automated build pipeline with Bun

## Project Structure

```
jayptl.me/
├── index.html              # Home page
├── pages/                  # Content pages
│   ├── about.html          # About page
│   ├── resume.html         # Resume page
│   ├── contact.html        # Contact page
│   ├── book.html           # Book-a-call page
│   ├── now.html            # /now page
│   ├── uses.html           # /uses page
│   ├── colophon.html       # Colophon
│   ├── changelog.html      # Site changelog
│   ├── ai.html             # AI details page
│   ├── projects/           # Projects index & case studies
│   │   ├── index.html
│   │   ├── aviz-health.html
│   │   ├── swalook.html
│   │   ├── genuinest.html
│   │   └── vini-tini.html
│   ├── privacy.html        # Privacy policy
│   ├── design-system.html  # Design system showcase
│   ├── 404.html            # Error page
│   └── 500.html            # Server error page
├── css/                    # Stylesheets
│   ├── main.css            # Main entry point (critical CSS is inlined per page)
│   ├── base/               # Reset, fonts, variables, theme
│   ├── components/         # Component styles (doodle, hud, sticker, navbar, etc.)
│   ├── layout/             # Layout patterns
│   ├── pages/              # Page-specific styles
│   └── utilities/          # Utility classes
├── js/                     # JavaScript
│   ├── main.js             # Main entry
│   ├── performance.js      # Web Vitals performance monitoring
│   ├── theme-detection.js  # Early FOUC-prevention theme boot
│   └── components/         # Component scripts (theme-toggle, navbar, doodle, etc.)
├── assets/                 # Images, case-study screenshots, fonts, icons
│   ├── fonts/              # Self-hosted woff2 font subsets
│   ├── icons/              # Dual-render SVG icons
│   ├── case-studies/       # Project screenshots
│   ├── resumes/            # Role-specific resume PDFs
│   └── doodle-sprite.svg   # Shared SVG doodle sprite
├── markdown/               # Markdown twins of each page (copied into dist/)
├── services/api/           # The backend API (separate Render web service, api.jayptl.me)
├── preview/                # Dev sandboxes (font stack preview, contact sheet)
├── tests/                  # node:test suites (negotiation, server, artifacts)
├── scripts/                # Build, server, and optimization automation
│   └── migrations/         # One-time migration & codemod scripts
├── dist/                   # Build output (gitignored)
├── .well-known/            # Security & standards
│   └── security.txt        # Security policy
├── render.yaml             # Render deployment config
├── robots.txt              # Search engine + AI crawler rules
├── llms.txt                # Curated index for LLMs (llmstxt.org)
├── openapi.json            # OpenAPI 3.1 description of the site
├── sitemap.xml             # SEO sitemap
└── site.webmanifest        # PWA manifest
```

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) 1.4.4+ (dependency install and build)
- [Node](https://nodejs.org) 26+ (most scripts and the preview server run on Node)

### Installation

```bash
# Install dependencies
bun install

# Build for production
bun run build

# Preview the production build (http://localhost:8000)
bun run serve:dist
```

There is no watch-mode dev server: edit, `bun run build`, then `bun run serve:dist`.

## Deployment (Render)

This project is configured for Render deployment via `render.yaml` as a static site:

```yaml
Build Command: bun install --frozen-lockfile && bun run test:deploy && node scripts/prune-public.js
Publish Directory: ./dist
```

**Deploy Steps:**
1. Push to GitHub: `git push origin main`
2. Render auto-builds and deploys on commit
3. Site live at the custom domain, proxied through Cloudflare

**Local Testing:**
```bash
bun run build        # Build to dist/
bun run serve:dist   # Test locally
```

The routes and headers Render serves are declared in `render.yaml`; keep that file authoritative.

## Tech Stack

- **HTML5** - Semantic markup, structured data
- **CSS3** - Custom properties, Grid, Flexbox
- **JavaScript** - Vanilla JS, no dependencies
- **Bun** - Dependency install and build orchestration
- **Node** - Build tooling, preview server, tests
- **Render** - Static site hosting (this repo) + a separate web service for `services/api`

## Key Features

- **Custom Cursor** - Interactive cursor effects
- **Scroll Animations** - Hand-rolled reveals (`scroll-reveal.js`, `split-text.js`, `particle-text.js`)
- **Bento Grid** - Dynamic skill showcase
- **Theme Toggle** - Persistent dark/light mode
- **Cookie Consent** - GDPR compliant
- **Analytics** - Google Analytics integration (consent-gated)
- **PWA Ready** - Web app manifest included (no service worker)

## Performance

- **Lighthouse Score:** 95+ (Performance, Accessibility, Best Practices, SEO)
- **Critical CSS:** Inlined for fast first paint
- **Lazy Loading:** Images and non-critical resources
- **Minification:** CSS/JS optimized in build
- **Compression:** Brotli/Gzip via Render CDN
- **Caching:** Long-term cache for static assets

## Security

Headers configured via `render.yaml` (mirrored in `_headers` and the generated `dist/.htaccess`):

- Content-Security-Policy (self + GA/GTM/Cloudflare Insights + api.jayptl.me)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 0 (header retired; CSP carries the load)
- Referrer-Policy: strict-origin-when-cross-origin
- Strict-Transport-Security (HSTS)
- Permissions-Policy (all sensors denied)
- Cross-Origin-Opener-Policy: same-origin
- Cross-Origin-Resource-Policy: same-site

Security policy: `.well-known/security.txt` (RFC 9116)

## Available Scripts

```bash
bun run build           # Build to dist/
bun run serve:dist      # Preview dist/ locally (Node server, localhost:8000)
bun run optimize        # Minify assets
bun run validate        # Check for errors
bun run lint            # oxlint
bun run test            # Clean build + behaviour suites
bun run test:deploy     # Full deploy build + suites (what Render runs)
bun run deploy:prepare  # Full build pipeline + public prune
```

## Troubleshooting

**Build fails:**
```bash
rm -rf dist node_modules
bun install
bun run build
```

**Pages not loading:**
- Check `render.yaml` routes
- Verify files in `dist/`
- Check browser console

**Theme not persisting:**
- Check browser localStorage
- Verify `theme-detection.js` loads

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

## Author

**Jay Patel**
- Website: [jayptl.me](https://jayptl.me)
- GitHub: [@jayptl-me](https://github.com/jayptl-me)

---

Built by Jay Patel
