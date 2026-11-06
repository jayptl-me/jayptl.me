// One pen (decision D-74): every drawn doodle on the site is the same pen.
//
// In a real browser, for every visible doodle path on every built page, in both
// themes, at a wide and a phone viewport:
//   - the stroke on screen is 2px plus or minus 0.2 (1.6 to 2.4), worked out in
//     screen pixels from the element's own transform, never read off a viewBox;
//   - caps and joins are round, and the mark is a stroke, never a fill or a gradient;
//   - a dashed (draw-on) stroke is laid out 1:1, so its on-screen length divided by
//     its user length is 1.0 and the one dash of pathLength="1" covers the line.
//
// Doodles are: sprite marks (<use href="...#d-*">), Ink Marks (svg.ink-svg) and the
// about page's Beyond-card icons. The highlighter swipe (d-marker, ink--marker) is a
// band, not a pen line, and is the one named exemption.
//
// It needs a headless browser, which the host build and CI do not have. Set
// ONE_PEN_DRIVER to a browser automation module directory (and ONE_PEN_BROWSER to an
// executable if the module cannot find its own) to run it; without them it skips.
// It reads dist/, so run it after a build (bun run test builds first).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const DRIVER = process.env.ONE_PEN_DRIVER || '';
const BROWSER = process.env.ONE_PEN_BROWSER || '';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json',
};

function routes() {
  const found = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== 'assets' && entry.name !== 'pages') walk(full); }
      else if (entry.name === 'index.html') {
        const rel = path.relative(dist, dir).split(path.sep).join('/');
        found.push('/' + (rel ? rel + '/' : ''));
      }
    }
  })(dist);
  for (const name of ['404.html', '500.html']) {
    if (fs.existsSync(path.join(dist, name)) && !found.includes('/' + name.replace('.html', '') + '/')) {
      found.push('/' + name);
    }
  }
  return found.sort();
}

function serve() {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(dist, rel);
    if (!file.startsWith(dist)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    else if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html';
    if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// Runs in the page. Returns one record per drawn element of every visible doodle.
async function probePage() {
  const records = [];
  const singular = (a, b, c, d) => {
    const s = a * a + b * b + c * c + d * d;
    const det = a * d - b * c;
    const t = Math.sqrt(Math.max(0, s * s - 4 * det * det));
    return [Math.sqrt(Math.max(0, (s - t) / 2)), Math.sqrt((s + t) / 2)];
  };
  const visible = (el) => {
    if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const SHAPES = 'path, circle, ellipse, line, polyline, polygon, rect';

  // On-screen length over user length for a geometry element, under linear map L.
  function lengthRatio(el, L) {
    if (typeof el.getTotalLength !== 'function') return null;
    const total = el.getTotalLength();
    if (!total) return null;
    const n = 400;
    let user = 0;
    let screen = 0;
    let prev = el.getPointAtLength(0);
    for (let i = 1; i <= n; i++) {
      const p = el.getPointAtLength((total * i) / n);
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      const step = Math.hypot(dx, dy);
      // A move between sub-paths is not drawn; skip the jump.
      if (step <= (total / n) * 1.5) {
        user += step;
        screen += Math.hypot(L[0] * dx + L[2] * dy, L[1] * dx + L[3] * dy);
      }
      prev = p;
    }
    return user ? screen / user : null;
  }

  function check(el, style, L, where, geometry) {
    const problems = [];
    const stroke = style.stroke || 'none';
    const fill = style.fill || 'none';
    if (/url\(/.test(stroke) || /url\(/.test(fill)) problems.push('gradient');
    if (fill !== 'none' && !/^rgba\(.*,\s*0\)$/.test(fill)) problems.push('filled (' + fill + ')');
    if (stroke === 'none') {
      problems.push('not a stroke');
      records.push({ where, problems });
      return;
    }
    const sw = parseFloat(style.strokeWidth);
    const nss = style.vectorEffect === 'non-scaling-stroke';
    const [s0, s1] = nss ? [1, 1] : singular(L[0], L[1], L[2], L[3]);
    const lo = +(sw * s0).toFixed(2);
    const hi = +(sw * s1).toFixed(2);
    if (lo < 1.6 || hi > 2.4) problems.push('stroke ' + lo + (lo === hi ? '' : '-' + hi) + 'px');
    if (style.strokeLinecap !== 'round') problems.push('cap ' + style.strokeLinecap);
    if (style.strokeLinejoin !== 'round') problems.push('join ' + style.strokeLinejoin);
    let ratio = null;
    if (style.strokeDasharray && style.strokeDasharray !== 'none') {
      ratio = lengthRatio(geometry || el, L);
      if (ratio !== null) {
        ratio = +ratio.toFixed(3);
        if (Math.abs(ratio - 1) > 0.02) problems.push('dash ratio ' + ratio);
      }
    }
    records.push({ where, lo, hi, ratio, problems });
  }

  // 1. Sprite marks: <use href="#d-..."> or href="/assets/doodle-sprite.svg#d-...".
  const external = {};
  for (const use of document.querySelectorAll('use')) {
    const href = use.getAttribute('href') || use.getAttribute('xlink:href') || '';
    const m = href.match(/^(.*)#(d-[\w-]+)$/);
    if (!m) continue;
    const svg = use.ownerSVGElement;
    if (!svg || !visible(svg)) continue;
    const id = m[2];
    const where = 'use#' + id + ' in ' + (svg.getAttribute('class') || svg.parentElement.getAttribute('class') || svg.parentElement.tagName.toLowerCase());
    if (id === 'd-marker') { records.push({ where, exempt: true, problems: [] }); continue; }
    let symbol;
    let computed = true;
    if (m[1]) {
      if (!(m[1] in external)) {
        const text = await (await fetch(m[1])).text();
        external[m[1]] = new DOMParser().parseFromString(text, 'image/svg+xml');
      }
      symbol = external[m[1]].getElementById(id);
      computed = false;
    } else {
      symbol = document.getElementById(id);
    }
    if (!symbol) { records.push({ where, problems: ['missing symbol'] }); continue; }
    const ctm = use.getScreenCTM();
    const svgStyle = getComputedStyle(svg);
    const vbAttr = svg.getAttribute('viewBox');
    const W = vbAttr ? +vbAttr.split(/[\s,]+/)[2] : parseFloat(svgStyle.width);
    const H = vbAttr ? +vbAttr.split(/[\s,]+/)[3] : parseFloat(svgStyle.height);
    const vb = (symbol.getAttribute('viewBox') || '0 0 ' + W + ' ' + H).split(/[\s,]+/).map(Number);
    const par = symbol.getAttribute('preserveAspectRatio') || 'xMidYMid meet';
    let sx = W / vb[2];
    let sy = H / vb[3];
    if (!/none/.test(par)) { const s = /slice/.test(par) ? Math.max(sx, sy) : Math.min(sx, sy); sx = s; sy = s; }
    const L = [ctm.a * sx, ctm.b * sx, ctm.c * sy, ctm.d * sy];
    for (const shape of symbol.querySelectorAll(SHAPES)) {
      let style;
      if (computed) {
        style = getComputedStyle(shape);
      } else {
        const a = (n, d) => shape.getAttribute(n) || d;
        style = {
          stroke: a('stroke', 'none'), fill: a('fill', 'black'), strokeWidth: a('stroke-width', '1'),
          vectorEffect: a('vector-effect', 'none'), strokeLinecap: a('stroke-linecap', 'butt'),
          strokeLinejoin: a('stroke-linejoin', 'miter'), strokeDasharray: a('stroke-dasharray', 'none'),
        };
      }
      check(shape, style, L, where, null);
    }
  }

  // 2. Ink Marks and 3. Beyond-card icons: inline svg, measured directly.
  for (const svg of document.querySelectorAll('svg.ink-svg, svg.beyond-icon, .beyond-icon svg')) {
    if (!visible(svg)) continue;
    const host = svg.closest('[data-ink]');
    const name = host ? 'ink:' + host.getAttribute('data-ink') : 'beyond-icon';
    if (host && host.classList.contains('ink--marker')) { records.push({ where: name, exempt: true, problems: [] }); continue; }
    for (const shape of svg.querySelectorAll(SHAPES)) {
      if (shape.closest('defs, symbol, clipPath, mask')) continue;
      if (!shape.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      const ctm = shape.getScreenCTM();
      check(shape, getComputedStyle(shape), [ctm.a, ctm.b, ctm.c, ctm.d], name, null);
    }
  }
  return records;
}

test('one pen: every visible doodle is a 2px round pen with a 1:1 dash', { skip: !DRIVER && 'set ONE_PEN_DRIVER to run the browser probe' }, async () => {
  assert.ok(fs.existsSync(path.join(dist, 'index.html')), 'dist/ is built');
  const driver = createRequire(import.meta.url)(DRIVER);
  const server = await serve();
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await driver.chromium.launch(BROWSER ? { executablePath: BROWSER } : {});
  const pages = routes();
  const bad = [];
  const seen = new Set();
  let measured = 0;
  let exempt = 0;
  try {
    for (const theme of ['light', 'dark']) {
      for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
        await context.addInitScript((t) => {
          try { localStorage.setItem('user-theme-preference', t); } catch (e) { /* noop */ }
        }, theme);
        await context.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
        const page = await context.newPage();
        for (const route of pages) {
          await page.goto(origin + route, { waitUntil: 'load' });
          await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
          const records = await page.evaluate(probePage);
          if (process.env.ONE_PEN_REPORT) {
            fs.appendFileSync(process.env.ONE_PEN_REPORT, records.map((r) => JSON.stringify({ theme, width: viewport.width, route, ...r })).join('\n') + '\n');
          }
          for (const r of records) {
            if (r.exempt) { exempt++; continue; }
            measured++;
            seen.add(route + ' ' + r.where.split(' in ')[0]);
            if (r.problems.length) bad.push(`${theme} ${viewport.width} ${route} ${r.where}: ${r.problems.join(', ')}`);
          }
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  // Prove the instrument sees the marks it is meant to judge before believing a pass.
  for (const must of ['/ use#d-arrow', '/ use#d-sparkle', '/ ink:squiggle', '/about/ beyond-icon', '/about/ use#d-underline', '/design-system/ ink:brace']) {
    assert.ok([...seen].some((s) => s === must), `the probe measured ${must}`);
  }
  assert.ok(measured > 200, `measured ${measured} drawn elements (${exempt} exempt)`);
  assert.deepEqual(bad, [], `${bad.length} of ${measured} drawn elements are off the pen:\n` + bad.slice(0, 60).join('\n'));
});

// Review finding 12: a fit that runs mid-transform (a squashed card, a sinking
// sheet) must not stick. A resize refits from the observer's layout box, which
// ignores ancestor transforms, and an unchanged box is left alone so a resize
// notice cannot loop. Runs without a browser.
test('ink mark: a resize refits from the layout box, not a transformed one, and skips an unchanged box', () => {
  const window = new Window({ url: 'https://jayptl.me/' });
  window.matchMedia = (q) => ({ matches: q.includes('reduce'), media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  // The rendered box is mid-squash: 95% of the 240x12 layout box.
  window.SVGElement.prototype.getBoundingClientRect = () => ({ width: 228, height: 11.4, top: 0, left: 0, right: 228, bottom: 11.4 });
  const observers = [];
  window.ResizeObserver = class {
    constructor(cb) { this.cb = cb; this.targets = []; observers.push(this); }
    observe(t) { this.targets.push(t); }
    disconnect() {}
  };
  window.document.body.innerHTML = '<span data-ink="squiggle">ships</span>';
  const code = fs.readFileSync(path.join(root, 'js/components/ink-mark.js'), 'utf8');
  new Function('window', 'document', code)(window, window.document);
  const host = window.document.querySelector('[data-ink]');
  window.InkMark.mount(host);
  const svg = host.querySelector('svg');
  const ink = path.join('js', 'components', 'ink-mark.js');
  assert.equal(observers.length, 1, `${ink} observes resizes`);
  observers[0].cb([{ target: svg, contentRect: { width: 240, height: 12 } }]);
  assert.equal(svg.getAttribute('viewBox'), '0 0 240.0 12.0', 'the refit uses the layout box');
  assert.ok(svg.querySelector('path').getAttribute('d').startsWith('M6.0 7.0 C18.0 2.0'));
  svg.querySelector('path').setAttribute('d', 'untouched');
  observers[0].cb([{ target: svg, contentRect: { width: 240, height: 12 } }]);
  assert.equal(svg.querySelector('path').getAttribute('d'), 'untouched', 'an unchanged box is not redrawn');
});
