# jayptl.me - Portfolio Website

Professional portfolio website showcasing software development, UI/UX design, and creative direction work.

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
├── scripts/                # Build automation
│   ├── build.js            # Build to dist/
│   ├── optimize.js         # Minification
│   ├── validate.js         # Validation
│   └── deploy.js           # Deployment
├── dist/                   # Build output (gitignored)
├── .well-known/            # Security & standards
│   └── security.txt        # Security policy
├── render.yaml             # Render deployment config
├── robots.txt              # Search engine rules
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
