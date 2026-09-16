#!/usr/bin/env node
// Gate P Phase 5 (part 2): add numbered side-rail nav + hand-voice next links
// to the four case-study pages. Idempotent: skips if the rail already exists.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const pages = ['aviz-health', 'swalook', 'genuinest', 'vini-tini'];

for (const slug of pages) {
  const file = path.join(ROOT, 'pages', 'projects', `${slug}.html`);
  let html = fs.readFileSync(file, 'utf8');
  const orig = html;

  // 1) Insert the numbered rail right after <article class="case-body"> opening tag.
  //    The rail is generated from existing case-section h2 text (1..N).
  if (!html.includes('class="case-rail"')) {
    // Grab the section headings to build rail labels
    const h2Re = /<h2><span class="case-section-no hud-readout">(\d+)<\/span>\s*([^<]+)<\/h2>/g;
    const labels = [];
    let m;
    while ((m = h2Re.exec(html))) labels.push({ n: m[1], text: m[2].trim() });
    // Trim trailing punctuation fragments from headings used in the rail
    const clean = (s) => s.replace(/[—–\-–].*$/, '').replace(/\s+$/, '').trim();
    const railLinks = labels
      .map((l) => `<a href="#cs-${l.n}">${l.n}</a>`)
      .join('\n        ');

    if (labels.length) {
      const rail = `\n        <nav class="case-rail" aria-label="Sections">
          ${railLinks}
        </nav>\n`;
      html = html.replace(
        /(<article class="case-body">)/,
        (match, open) => open + rail
      );
    }
  }

  // 2) Add matching id anchors to each case-section (cs-01 ...)
  html = html.replace(
    /<section class="case-section">\s*<h2><span class="case-section-no hud-readout">(\d+)<\/span>/g,
    '<section class="case-section" id="cs-$1">\n                <h2><span class="case-section-no hud-readout">$1</span>'
  );

  // 3) Hand voice on the next-case link
  html = html.replace(
    /(<nav class="case-next"[^>]*>)\s*(<a[^>]*>)([^<]*)(<\/a>)/,
    (match, navOpen, aOpen, text, aClose) =>
      `${navOpen}<p class="hand">up next</p>${aOpen}${text}${aClose}`
  );

  if (html !== orig) {
    fs.writeFileSync(file, html);
    console.log('updated', slug);
  } else {
    console.log('no change', slug);
  }
}
console.log('done');
