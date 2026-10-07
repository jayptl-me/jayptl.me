# How this site is made.

> How jayptl.me is built: hand-written HTML, CSS and JS with no frameworks, two themes, one motion law, synthesized sound, a strict CSP, and a tiny API.

Jay Patel's site, and every line of its HTML, CSS and JavaScript is hand-written. No framework, no UI kit, no CDN script. The design system page shows every token and component.

## Built with

- **Code**: Plain HTML, CSS and JavaScript. Each component is one CSS file and one script, mounted again after every page swap.
- **Build**: A small Node script copies the sources, minifies them, and writes one clean URL folder per page. The deploy fails if the build is older than any source file.
- **Type**: Space Grotesk for display, IBM Plex Sans for reading, IBM Plex Mono for every number, Architects Daughter for the hand notes. All self-hosted.
- **Themes**: Light is porcelain clay on a blue ramp; dark is liquid glass on a turquoise ramp. They never share a color.
- **Motion**: One snap curve for everything. Exits are faster than entries, only transform and opacity move, and reduced motion always shows the finished page.
- **Sound**: Every effect, the saber swoosh included, is synthesized live with the Web Audio API. Zero audio files. Off until you switch it on.
- **Privacy**: A strict Content Security Policy with no inline scripts. Analytics load only after you say yes. The view counter needs no cookies.
- **Hosting**: A static site on Render's CDN. A separate small API, written with no dependencies, counts views and books calls.
- **For machines**: Every page has a markdown twin, plus [llms.txt](https://jayptl.me/llms.txt), [openapi.json](https://jayptl.me/openapi.json) and [humans.txt](https://jayptl.me/humans.txt).

## API uptime

The API's own health, measured once a minute, shown whenever the API is reachable.

## Shipping cadence

GitHub contributions over the last 12 months, saved when the site was built.

## Latest changes

### Sep 28, 2026

Command Deck (Cmd K), eased mouse-wheel scrolling, the bottom blur band, twelve new ink marks, and seven new pages.

### Sep 27, 2026

Seven role-cut resume PDFs, and the hero's opening and closing lines locked.

### Sep 25, 2026

Calmer hover menus in the navbar, and every leftover animation moved onto the one motion curve.

[Full changelog](https://jayptl.me/changelog)
