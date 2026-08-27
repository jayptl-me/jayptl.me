# jayptl.me - Portfolio Website

Professional portfolio website showcasing software development, UI/UX design, and creative direction work.

## 🤖 Agent readiness

This site is built to be consumable by AI agents and crawlers without a browser:

- **Content without JavaScript** — every page's meaningful content (H1, copy, project descriptions) and JSON-LD structured data live in the raw HTML.
- **Markdown content negotiation** ([acceptmarkdown.com](https://acceptmarkdown.com)) — send `Accept: text/markdown` to any page URL to get its Markdown twin, or fetch the `.md` companion directly (`/index.md`, `/about.md`, `/projects/aviz-health.md`, …). Negotiated responses carry `Vary: Accept`.
- **Structured JSON errors** — `/api/*` paths and JSON-preferring clients get `{ error: { code, message, hint } }` bodies (404/405/406) instead of HTML error pages.
- **Machine-readable surface**:
  - [`/openapi.json`](openapi.json) — OpenAPI 3.1 description of every public endpoint
  - [`/llms.txt`](llms.txt) — curated index for LLMs ([llmstxt.org](https://llmstxt.org) format)
  - `/llms-full.txt` — all pages flattened to Markdown (generated at build time)
  - `/api/health` — JSON liveness probe (Render health check)
- **AI crawlers allowed** — `robots.txt` explicitly allows GPTBot, ClaudeBot, ChatGPT-User, PerplexityBot, Google-Extended, Applebot-Extended, DeepSeekBot, and more.
- Serving uses `scripts/server.js` (Node), which implements the negotiation, JSON errors, clean URLs, security headers, and caching. `render.yaml` deploys it as a Render web service. The `_redirects` / `_headers` / `.htaccess` files remain for static-host/Apache parity (the `.htaccess` includes equivalent Apache negotiation rules).

### Verification

```bash
curl -si -H "Accept: text/markdown" https://jayptl.me/          # markdown + Vary: Accept
curl -s https://jayptl.me/api/health                              # {"status":"ok",...}
curl -s -H "Accept: application/json" https://jayptl.me/api/nope  # JSON 404 with hint
npm test                                                          # build + 50 behavior tests
```

### Cloudflare / WAF notes (dashboard, not repo)

The domain is proxied through Cloudflare in front of Render. Two settings live only in the Cloudflare dashboard:

1. **Bot AI allowlist** — Security → Bots: disable "Block AI bots"/Bot Fight Mode challenges for this zone (or add WAF exceptions for `GPTBot`, `ClaudeBot`, `ChatGPT-User`, `PerplexityBot`). As of 2026-08 these four received 403s from the edge even though the origin serves them.
2. **Apex canonicalization** — `jayptl.me` currently 301s to `www.jayptl.me` while all canonical tags/sitemap use the apex. Flip the redirect to `www → apex` (recommended, matches canonicals) or update canonicals/sitemap/llms.txt to the www host.

## ✨ Features

- **Responsive Design** - Mobile-first approach, works on all devices
- **Dark/Light Theme** - System preference detection with manual toggle
- **Performance Optimized** - Lighthouse score 95+, fast loading
- **Accessible** - WCAG 2.1 AA compliant
- **SEO Optimized** - Structured data, sitemap, meta tags
- **Modern Stack** - Vanilla HTML/CSS/JS, no frameworks
- **Production Build** - Automated build pipeline with Bun

## 📁 Project Structure

```
jayptl.me/
├── index.html              # Home page
├── pages/                  # Content pages
│   ├── about.html          # About page
│   ├── privacy.html        # Privacy policy
│   ├── design-system.html  # Design system showcase
│   ├── 404.html            # Error page
│   └── 500.html            # Server error page
├── css/                    # Stylesheets
│   ├── main.css            # Main entry point
│   ├── base/               # Reset, fonts, variables
│   ├── components/         # Component styles
│   ├── layout/             # Layout patterns
│   ├── pages/              # Page-specific styles
│   └── utilities/          # Utility classes
├── js/                     # JavaScript
│   ├── main.js             # Main entry
│   ├── performance.js      # Performance monitoring
│   └── components/         # Component scripts
├── assets/                 # Images, icons, fonts
├── markdown/               # Markdown twins of each page (copied into dist/)
├── tests/                  # node:test suites (negotiation, server, artifacts)
├── scripts/                # Build automation
│   ├── build.js            # Build to dist/
│   ├── server.js           # Production server (negotiation + JSON errors)
│   ├── optimize.js         # Minification
│   ├── validate.js         # Validation
│   └── deploy.js           # Deployment
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

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) 1.0.0+ (fast JavaScript runtime)

### Installation

```bash
# Install dependencies
bun install

# Start development server
bun run dev
# Opens at http://localhost:8000

# Build for production
bun run build

# Preview production build
bun run serve:dist
```

## 🌐 Deployment (Render)

This project is configured for Render deployment via `render.yaml`:

```yaml
Build Command: bun install && bun run build
Publish Directory: ./dist
```

**Deploy Steps:**
1. Push to GitHub: `git push origin main`
2. Render auto-builds and deploys
3. Site live at your custom domain

**Local Testing:**
```bash
bun run build        # Build to dist/
bun run serve:dist   # Test locally
```

See `RENDER_DEPLOYMENT.md` for detailed setup instructions.

## 🛠️ Tech Stack

- **HTML5** - Semantic markup, structured data
- **CSS3** - Custom properties, Grid, Flexbox
- **JavaScript** - Vanilla JS, no dependencies
- **Bun** - Fast runtime and build tool
- **Render** - Static site hosting

## 🎨 Key Features

- **Custom Cursor** - Interactive cursor effects
- **Scroll Animations** - GSAP-powered reveals
- **Bento Grid** - Dynamic skill showcase
- **Theme Toggle** - Persistent dark/light mode
- **Cookie Consent** - GDPR compliant
- **Analytics** - Google Analytics integration
- **PWA Ready** - Web app manifest included

## ⚡ Performance

- **Lighthouse Score:** 95+ (Performance, Accessibility, Best Practices, SEO)
- **Critical CSS:** Inlined for fast first paint
- **Lazy Loading:** Images and non-critical resources
- **Minification:** CSS/JS optimized in build
- **Compression:** Brotli/Gzip via Render CDN
- **Caching:** Long-term cache for static assets

## 🔐 Security

Headers configured via `render.yaml`:
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Strict-Transport-Security (HSTS)

Security policy: `.well-known/security.txt` (RFC 9116)

## 📝 Available Scripts

```bash
bun run dev             # Start dev server (localhost:8000)
bun run build           # Build to dist/
bun run serve:dist      # Preview dist/ locally
bun run optimize        # Minify assets
bun run validate        # Check for errors
bun run deploy:prepare  # Full build pipeline
```

## 🐛 Troubleshooting

**Build fails:**
```bash
rm -rf dist node_modules
bun install
bun run build
```

**Pages not loading:**
- Check `render.yaml` routes
- Verify files in `dist/pages/`
- Check browser console

**Theme not persisting:**
- Check browser localStorage
- Verify `theme-detection.js` loads

## 📄 License

MIT License - See LICENSE file

## 👤 Author

**Jay Patel**
- Website: [jayptl.me](https://jayptl.me)
- GitHub: [@jayptl-me](https://github.com/jayptl-me)

---

Built with ❤️ by Jay Patel
