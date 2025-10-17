# Jay Patel - Portfolio Website

A modern, high-performance portfolio website built with plain HTML, CSS, and JavaScript.

## Features

- **Responsive Design**: Works perfectly on all devices
- **Dark/Light Theme**: Toggle between themes with smooth transitions
- **Modern CSS**: Uses CSS custom properties (variables) and modern layout techniques
- **Professional Animations**: Smooth scroll animations and hover effects
- **Clean Code**: Well-organized and maintainable code structure
- **Semantic HTML**: Accessible and SEO-friendly markup
- **Production-Ready**: Professional build pipeline with minification and optimization
- **Performance Optimized**: PageSpeed Insights score of 94+

## Project Structure

```
jayptl.me/
├── index.html              # Main HTML file
├── about.html              # About page
├── privacy.html            # Privacy policy
├── 404.html                # Custom 404 page
├── css/                    # Stylesheets
│   ├── main.css           # Main stylesheet
│   ├── base/              # Base styles
│   ├── components/        # Component styles
│   ├── layout/            # Layout styles
│   └── utilities/         # Utility classes
├── js/                     # JavaScript files
│   ├── main.js            # Main script
│   └── components/        # Component scripts
├── assets/                 # Static assets
│   ├── icons/             # Icons and favicons
│   └── privacy-structured-data.json
├── scripts/                # Build and deployment scripts
│   ├── build.js           # Production build
│   ├── optimize.js        # Asset optimization
│   ├── validate.js        # Pre-deployment validation
│   ├── deploy.js          # Deployment automation
│   └── preview.js         # Local preview server
├── robots.txt              # Search engine directives
├── sitemap.xml             # Site structure for SEO
├── humans.txt              # Credits and team info
├── site.webmanifest        # PWA manifest
└── package.json            # Project metadata
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) 1.0.0 or higher (or Node.js 18.0.0+)

### Installation

```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Clone the repository
git clone https://github.com/jayptl-me/jayptl.me.git
cd jayptl.me

# Install dependencies
bun install
```

### Development

```bash
# Start development server on http://localhost:8000
bun run dev
```

### Production Build

```bash
# Complete build, optimization, and validation
bun run deploy:prepare

# Or run steps individually:
bun run build      # Build files to dist/
bun run optimize   # Minify CSS, JS, and HTML
bun run validate   # Check for errors

# Preview production build locally
bun run deploy:preview
```

## Deployment

Deploy to different platforms using Bun:

```bash
# GitHub Pages
DEPLOY_TYPE=github bun run deploy

# Netlify
DEPLOY_TYPE=netlify bun run deploy

# Vercel
DEPLOY_TYPE=vercel bun run deploy

# Manual (build only)
bun run deploy:prepare
```

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md)

## Customization

### Colors & Theme

All colors are defined as CSS custom properties in `css/main.css`. Update the color variables in the `:root` section to change the theme:

```css
:root {
  --color-primary-500: #2196f3; /* Change primary color */
  --color-accent-500: #2196f3; /* Change accent color */
  /* ... other color variables */
}
```

### Content

- Update personal information in `index.html`
- Replace placeholder text with your own content
- Add your own images to the `assets/` directory
- Update contact links and social media URLs

### Styling

- All styles are in `css/main.css`
- Uses a mobile-first responsive approach
- Organized with clear sections and comments
- Uses CSS Grid and Flexbox for layouts

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Performance Features

- **Asset Optimization**: Automated minification of CSS, JS, and HTML
- **Efficient Caching**: Long-term caching for static assets (1 year)
- **GZIP Compression**: Enabled via .htaccess configuration
- **Lazy Loading**: Images loaded on demand
- **Smooth Animations**: GPU-accelerated with `will-change` optimization
- **Minimal JavaScript**: Pure vanilla JS with no frameworks
- **PageSpeed Score**: 94+ on mobile and desktop

### Optimization Results

After running the build pipeline:
- CSS: ~3 KB saved through minification
- JavaScript: ~7 KB saved through minification
- HTML: Additional savings from minification
- Total reduction: ~30% file size decrease

## SEO, Crawling & Metadata

- `robots.txt` allows full crawl and references the sitemap.
- `sitemap.xml` lists core URLs (`/`, `/privacy.html`). Update as you add pages.
- Canonical tags point to HTTPS.
- Person JSON-LD structured data in `index.html`.
- Custom `404.html` improves UX and correct error signaling.
- `.well-known/security.txt` and `humans.txt` included for transparency.

### Adding a New Page
1. Create the HTML file.
2. Add a canonical link tag pointing to its HTTPS URL.
3. Link it internally (navigation / footer / body links).
4. Add it to `sitemap.xml`.
5. Deploy, then optionally request indexing in Search Console.

## Caching & Headers (Render Hosting)

Suggested cache policy (configure via Render or CDN):

```
/*
  Cache-Control: max-age=60, public
/css/*
  Cache-Control: max-age=86400, public
/js/*
  Cache-Control: max-age=86400, public
/assets/*.png
  Cache-Control: max-age=31536000, public, immutable
/assets/*.ico
  Cache-Control: max-age=31536000, public, immutable
/robots.txt
  Cache-Control: max-age=3600, public
/sitemap.xml
  Cache-Control: max-age=3600, public
/.well-known/security.txt
  Cache-Control: max-age=86400, public
/humans.txt
  Cache-Control: max-age=86400, public
```

If you introduce hashed filenames later, raise those assets to `max-age=31536000, immutable` safely.

## 404 Page

`404.html` returns a proper 404 and sets `noindex,follow` so it is not indexed but can still help discovery of any links on it.

## Security Disclosure

`security.txt` lists a contact email and expiry; update the `Expires` field annually.

## Build Scripts

- `bun run build` - Build production files to dist/
- `bun run optimize` - Minify all assets
- `bun run validate` - Validate build before deployment
- `bun run deploy:prepare` - Complete build pipeline
- `bun run deploy:preview` - Preview production build locally
- `bun run deploy` - Deploy to configured platform
- `bun run dev` - Start development server

## CI/CD Integration

GitHub Actions workflow is included for automated deployment:
- Triggered on push to main branch
- Builds and optimizes assets
- Deploys to GitHub Pages
- Runs Lighthouse performance tests

See `.github/workflows/deploy.yml` for configuration.

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
DEPLOY_TYPE=manual          # Deployment target
DEPLOY_SERVER=server.com    # For rsync deployment
DEPLOY_USER=username        # SSH username
DEPLOY_PATH=/var/www/html   # Server path
PORT=8000                   # Preview server port
```

## Troubleshooting

### Build Issues

If build fails:
```bash
# Clean and rebuild
bun run clean
bun install
bun run deploy:prepare
```

### Port Already in Use

Change the preview port:
```bash
PORT=8080 bun run deploy:preview
```

### Deployment Errors

Check validation output:
```bash
bun run validate
```

For more help, see [DEPLOYMENT.md](DEPLOYMENT.md)

## Performance Monitoring

Run Lighthouse audits:
```bash
bun run lighthouse
```

Or use PageSpeed Insights:
https://pagespeed.web.dev/

## Security

- CSP headers configured
- HTTPS enforced
- XSS protection enabled
- Clickjacking prevention
- HSTS enabled

Security contact: See `.well-known/security.txt`

## Future Enhancements

- [ ] Image optimization pipeline (WebP conversion)
- [ ] Service Worker for offline support
- [ ] Critical CSS extraction
- [ ] Asset hashing for cache busting
- [ ] Automated screenshot generation
- [ ] Performance budget enforcement

## License

MIT License - feel free to use this template for your own portfolio!

## Support

- **Issues**: [GitHub Issues](https://github.com/jayptl-me/jayptl.me/issues)
- **Documentation**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Website**: [jayptl.me](https://jayptl.me)

## Contributing

Feel free to fork this project and submit pull requests for any improvements.

---

**Built by 🤍 Jay Patel**
