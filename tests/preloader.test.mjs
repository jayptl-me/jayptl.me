// Signature preloader (D-80 look, D-81 plumbing; brief in docs/motion-zen.md section 6b).
//
// Each check is paired with a negative control that proves it can fail:
//   - structure: index.html as written. The overlay is inline and first in the body,
//     the main stylesheet comes after it, the critical block after that (so the cascade
//     keeps its old order), and there is one inline script.
//   - cascade: the built page in a DOM with styles, at phone width: the hero keeps its
//     16px side padding, which it only gets when the critical block wins its ties.
//   - behaviour: the real inline script from index.html, run in a small sandbox with a
//     virtual clock. Nothing here re-implements the hold; it only drives the page's own
//     script and reads the classes it sets.
//   - the shipped fallbacks: theme-toggle.js when the head script is blocked, the
//     stepper's keyboard during the hold, and the router's page CSS order from home.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const HOME = read('index.html');
const THEME_FILE = read('js/theme-detection.js');
const THEME_TOGGLE = read('js/components/theme-toggle.js');
const SCROLL_REVEAL = read('js/components/scroll-reveal.js');
const ROUTER = read('js/components/page-router.js');

function inlineScripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter(([, attrs]) => { const a = attrs.replace(/=\s*("[^"]*"|'[^']*')/g, (m, v) => '=' + v[0] + (/^.(application\/(ld\+)?json).$/i.test(v) ? v.slice(1, -1) : '') + v[0]); return !/(?:^|\s)src\s*=/i.test(a) && !/(?:^|\s)type\s*=\s*["']?application\/(ld\+)?json/i.test(a); })
    .map(([whole, , body]) => ({ whole, body, at: html.indexOf(whole) }));
}

const homeScript = () => {
  const found = inlineScripts(HOME);
  assert.equal(found.length, 1, 'index.html must carry exactly one inline script');
  return found[0].body;
};

/* ---- structure ------------------------------------------------------------ */

const MAIN_CSS = /<link rel="stylesheet" href="\/css\/main\.css">/;
const CRITICAL = /<style>(?:(?!<\/style>)[\s\S])*?\.hero-container(?:(?!<\/style>)[\s\S])*?<\/style>/;

function structureViolations(html) {
  const v = [];
  const headEnd = html.search(/<\/head>/i);
  const bodyOpen = /<body\b([^>]*)>/i.exec(html);
  if (headEnd < 0 || !bodyOpen) return ['no head or body'];
  const head = html.slice(0, headEnd);
  const afterBody = html.slice(bodyOpen.index + bodyOpen[0].length);

  const scripts = inlineScripts(html);
  if (scripts.length !== 1) v.push(`${scripts.length} inline scripts, exactly one is allowed (D-81)`);
  for (const s of scripts) {
    if (s.at > headEnd) v.push('the inline script is not in <head>');
    const before = html.slice(0, s.at);
    const opens = (before.match(/<!-- htmlmin:ignore -->/g) || []).length;
    if (opens % 2 !== 1) v.push('the inline script is not wrapped in htmlmin:ignore, so the minifier would change its hash');
  }
  if (/<script[^>]+src="\/js\/preloader\.js"/i.test(html)) v.push('the external preloader script is still loaded');
  if (/<script[^>]+src="\/js\/theme-detection\.js"/i.test(html)) v.push('the external theme script is still loaded; it is merged into the inline script');

  if (/\bclass="[^"]*\bpreloading\b/.test(bodyOpen[1])) v.push('body still ships class="preloading"');
  if (/body\.preloading/.test(html)) v.push('a body.preloading rule is still in the page');
  if (/\.no-js\s+(?:\.pl\b|#preloader)/.test(html)) v.push('the overlay is still gated on html.no-js');

  const firstEl = /^(?:\s|<!--[\s\S]*?-->)*<([a-z0-9-]+)\b([^>]*)>/i.exec(afterBody);
  if (!firstEl || firstEl[1] !== 'div' || !/\bid="preloader"/.test(firstEl[2]) || !/\bclass="pl"/.test(firstEl[2])) {
    v.push('the overlay <div class="pl" id="preloader"> is not the first element in <body>');
  }
  if (MAIN_CSS.test(head)) v.push('main.css is still render-blocking in <head>');
  const overlayAt = afterBody.indexOf('id="preloader"');
  const cssAt = afterBody.search(MAIN_CSS);
  if (cssAt < 0) v.push('main.css is not linked in <body>');
  else if (overlayAt < 0 || cssAt < overlayAt) v.push('main.css is linked before the overlay');

  // Cascade order: before D-81 the critical block came after main.css and won its ties.
  const headStyles = [...head.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  if (headStyles.some((css) => !/^\s*\/\* Signature preloader/.test(css))) {
    v.push('a head <style> other than the preloader block sits before main.css and loses every tie to it');
  }
  const critAt = afterBody.search(CRITICAL);
  if (critAt < 0 || cssAt < 0 || critAt < cssAt) v.push('the critical block does not come after main.css');
  return v;
}

function preloaderCss(html) {
  const m = /<style>\s*\/\* Signature preloader[\s\S]*?<\/style>/.exec(html);
  return m ? m[0] : '';
}

function lookViolations(html) {
  const v = [];
  const css = preloaderCss(html);
  if (!css) return ['no preloader style block'];
  const rule = (sel) => {
    const at = css.indexOf(sel + '{');
    return at < 0 ? '' : css.slice(at, css.indexOf('}', at) + 1);
  };
  const light = rule('.pl');
  const dark = rule('html[data-theme="dark"] .pl');
  if (!/#2196f3/i.test(light)) v.push('light ink is not the blue ramp #2196f3');
  if (/#00b8cc|#26c9d8|#4dd6e2|#009fb3/i.test(light)) v.push('turquoise in the light rule');
  if (!/#00b8cc/i.test(dark)) v.push('dark ink is not the turquoise ramp #00b8cc');
  if (/#2196f3|#1976d2|#42a5f5|#1e88e5/i.test(dark)) v.push('blue in the dark rule');
  if (!/html\.pl-on\{overflow:hidden[;}]/.test(css)) v.push('scroll is not locked through html.pl-on');
  if (/mask|clip-path|\btop\s*[:]|transition:[^;}]*\b(top|left|height|width)\b/.test(css.replace(/top:100%/, ''))) {
    v.push('the exit animates something other than transform and opacity');
  }
  if (!/html\.pl-rm \.pl-sig,html\.pl-rm \.pl-dot\{animation:none;stroke-dashoffset:0\}/.test(css)) v.push('reduced motion does not show the static mark');
  // The CSS failsafe must free both the paper and the scroll lock, and only after the
  // script's own hard ceiling (8 s) plus the minimum and the lift have had their time.
  const fs1 = /\.pl\{[^}]*animation:pl-fs 1ms (\d+(?:\.\d+)?)s forwards/.exec(css);
  const fs2 = /html\.pl-on\{overflow:hidden;animation:pl-ov 1ms (\d+(?:\.\d+)?)s forwards\}/.exec(css);
  if (!fs1 || Number(fs1[1]) < 10) v.push('the paper failsafe fires before the script ceiling, minimum and lift can finish');
  if (!fs2 || !/@keyframes pl-ov\{to\{overflow:visible\}\}/.test(css)) v.push('the failsafe does not release the scroll lock');
  else if (Number(fs2[1]) !== Number(fs1 && fs1[1])) v.push('the paper and scroll failsafes do not fire together');
  if (!/@media print\{\.pl\{display:none!important\}html\.pl-on\{overflow:visible\}\}/.test(css)) v.push('printing during the hold prints the blank paper');
  return v;
}

test('preloader structure: overlay first, main.css after it, critical CSS after that, one hashed inline script', () => {
  assert.deepEqual(structureViolations(HOME), []);
});

test('preloader structure, negative control: each regression is caught', () => {
  const css = '<link rel="stylesheet" href="/css/main.css">';
  const cssBackInHead = HOME.replace(css, '').replace('</head>', `${css}\n</head>`);
  assert.ok(structureViolations(cssBackInHead).some((x) => /main\.css is still render-blocking/.test(x)));
  const crit = CRITICAL.exec(HOME)[0];
  const critInHead = HOME.replace(crit, '').replace('<!-- Theme color for light and dark -->', `${crit}\n    <!-- Theme color for light and dark -->`);
  assert.notEqual(critInHead, HOME);
  assert.ok(structureViolations(critInHead).some((x) => /loses every tie|does not come after main\.css/.test(x)));
  const preloading = HOME.replace(/<body\b([^>]*)>/, '<body class="preloading"$1>');
  const gated = HOME.replace('</style>', 'html.no-js .pl{display:none}</style>');
  assert.ok(structureViolations(gated).some((x) => /gated on html\.no-js/.test(x)));
  assert.ok(structureViolations(preloading).some((x) => /preloading/.test(x)));
  const second = HOME.replace('</head>', '<script>void 0</script>\n</head>');
  assert.ok(structureViolations(second).some((x) => /2 inline scripts/.test(x)));
  const unwrapped = HOME.replace(/<!-- htmlmin:ignore -->/g, '');
  assert.ok(structureViolations(unwrapped).some((x) => /htmlmin:ignore/.test(x)));
  const external = HOME.replace('</head>', '<script src="/js/preloader.js"></script>\n</head>');
  assert.ok(structureViolations(external).some((x) => /external preloader/.test(x)));
  const dataSrc = HOME.replace('</head>', '<script data-src="x">void 0</script>\n</head>');
  assert.ok(structureViolations(dataSrc).some((x) => /2 inline scripts/.test(x)), 'data-src is not a src');
});

test('preloader: the old external hold script is gone', () => {
  assert.equal(fs.existsSync(path.join(root, 'js/preloader.js')), false);
});

test('preloader look: ramps, transform-only exit, static mark, failsafe frees scroll, print skips the paper', () => {
  assert.deepEqual(lookViolations(HOME), []);
});

test('preloader look, negative control: a mixed ramp, a mask exit, a scroll-blind failsafe or a printed paper is caught', () => {
  const css = preloaderCss(HOME);
  const swap = (from, to) => { assert.ok(css.includes(from), from); return HOME.replace(css, css.replace(from, to)); };
  assert.ok(lookViolations(swap('html[data-theme="dark"] .pl{background:#031315;color:#00b8cc}', 'html[data-theme="dark"] .pl{background:#031315;color:#2196f3}')).some((x) => /dark ink|blue in the dark/.test(x)));
  assert.ok(lookViolations(swap('html.pl-out .pl{transform:translateY(-118%)}', 'html.pl-out .pl{mask-size:0}')).some((x) => /transform and opacity/.test(x)));
  assert.ok(lookViolations(swap('@keyframes pl-ov{to{overflow:visible}}', '')).some((x) => /scroll lock/.test(x)));
  assert.ok(lookViolations(swap('animation:pl-fs 1ms 10s forwards', 'animation:pl-fs 1ms 6.5s forwards')).some((x) => /failsafe fires before/.test(x)));
  assert.ok(lookViolations(swap('@media print{.pl{display:none!important}html.pl-on{overflow:visible}}', '')).some((x) => /print/.test(x)));
});

test('preloader: the signature path lives in one place and is marked as a stand-in', () => {
  const sigs = HOME.match(/<path class="pl-sig"/g) || [];
  assert.equal(sigs.length, 1, 'exactly one signature path');
  assert.match(HOME, /<!-- Signature STAND-IN[^>]*-->\s*<svg class="pl-mark"/, 'the stand-in note sits right above the mark');
  for (const rel of ['css/main.css', 'js/main.js']) assert.doesNotMatch(read(rel), /pl-sig/);
});

test('preloader: no em dashes or emojis in the preloader block', () => {
  const block = [preloaderCss(HOME), homeScript(), (/<div class="pl"[\s\S]*?<\/div>/.exec(HOME) || [''])[0]].join('\n');
  assert.ok(block.length > 500);
  assert.doesNotMatch(block, /\u2014/);
  assert.doesNotMatch(block, /\p{Extended_Pictographic}/u);
});

/* ---- cascade: the built page at phone width -------------------------------- */

// The built home page with main.css inlined where its link stands, so the document order
// (and so the cascade order) is exactly what a browser sees. Scripts are not run.
function builtHome() {
  const dist = path.join(root, 'dist');
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(dist, 'css/main.css'), 'utf8');
  return { html, css };
}

function heroSidePadding(html, css, width) {
  const page = html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<link rel="?stylesheet"? href="?\/css\/main\.css"?\s*\/?>/, () => `<style>${css}</style>`);
  const window = new Window({
    width, height: 800, url: 'http://localhost/',
    settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true, disableIframePageLoading: true }
  });
  window.document.write(page);
  const el = window.document.querySelector('.hero-container');
  const value = window.getComputedStyle(el).paddingLeft;
  window.happyDOM.abort();
  window.close();
  return value;
}

const px = (v) => (/rem$/.test(v) ? parseFloat(v) * 16 : parseFloat(v));

test('cascade: on a phone the hero keeps the critical 16px side padding (main.css does not win the tie)', () => {
  const { html, css } = builtHome();
  assert.equal(px(heroSidePadding(html, css, 375)), 16);
});

test('cascade, negative control: with the critical block before main.css, hero.css wins and the phone hero gets 12px all round', () => {
  const { html, css } = builtHome();
  const crit = /<style>(?:(?!<\/style>)[\s\S])*?\.hero-container(?:(?!<\/style>)[\s\S])*?<\/style>/.exec(html);
  assert.ok(crit, 'the built page carries the critical block');
  const moved = html.replace(crit[0], '').replace(/<\/head>/i, `${crit[0]}</head>`);
  assert.equal(px(heroSidePadding(moved, css, 375)), 12);
});

/* ---- behaviour: the page's own script on a virtual clock ------------------- */

function simulate(script, opts = {}) {
  const o = {
    paintAt: 40, dclAt: 300, until: 15000, seen: null, reduce: false, osDark: false,
    stored: null, cookie: '', storageThrows: false, particle: true, transition: true,
    cssAt: 0, mainAt: 0, rafThrows: false, ...opts
  };
  // The signature's draw starts 80 ms after the overlay is first styled; under reduced
  // motion it does not animate at all.
  if (!('animAt' in opts)) o.animAt = o.reduce ? null : o.paintAt + 80;
  let now = 0;
  let seq = 0;
  const queue = [];
  const at = (time, fn) => { queue.push({ time, seq: seq++, fn }); return seq; };
  const log = [];
  const classes = new Set(['no-js']);
  const attrs = {};
  const style = {};
  // The overlay element. When the exit class lands, the browser would fire transitionend:
  // first a bubbled one from the fading mark and one from the curved edge (both must be
  // ignored), then the paper's own when its lift ends (840 ms, or 200 ms under reduced motion).
  const overlay = { listeners: [], addEventListener(type, fn) { if (type === 'transitionend') this.listeners.push(fn); } };
  const child = {};
  const fire = (ev) => overlay.listeners.forEach((fn) => fn(ev));
  const classList = {
    add: (...c) => c.forEach((x) => {
      if (classes.has(x)) return;
      classes.add(x); log.push([now, '+' + x]);
      if (x === 'pl-out' && o.transition) {
        const rm = classes.has('pl-rm');
        at(now + 160, () => fire({ target: child, propertyName: 'opacity', pseudoElement: '' }));
        at(now + 500, () => fire({ target: overlay, propertyName: 'transform', pseudoElement: '::after' }));
        at(now + (rm ? 200 : 840), () => fire({ target: overlay, propertyName: rm ? 'opacity' : 'transform', pseudoElement: '' }));
      }
    }),
    remove: (...c) => c.forEach((x) => { if (classes.has(x)) { classes.delete(x); log.push([now, '-' + x]); } }),
    contains: (x) => classes.has(x)
  };
  const store = (init) => {
    const m = new Map(Object.entries(init));
    const guard = () => { if (o.storageThrows) throw new Error('storage blocked'); };
    return {
      getItem: (k) => { guard(); return m.has(k) ? m.get(k) : null; },
      setItem: (k, val) => { guard(); m.set(k, String(val)); },
      removeItem: (k) => { guard(); m.delete(k); },
      _m: m
    };
  };
  const session = store(o.seen ? { 'jayptl-preloaded': o.seen } : {});
  const local = store(o.stored ? { 'user-theme-preference': o.stored } : {});
  const docListeners = {};
  const events = [];
  const replays = [];
  const host = { particle: true };
  let inert = false;
  const win = {
    setTimeout: (fn, ms) => at(now + Math.max(0, Number(ms) || 0), fn),
    clearTimeout: () => {},
    requestAnimationFrame: (fn) => { if (o.rafThrows) throw new Error('rAF blocked'); return at(Math.max(now, o.paintAt), () => fn(now)); },
    performance: { now: () => now },
    PerformanceObserver: class {
      constructor(cb) { this.cb = cb; }
      observe() {
        const cb = this.cb;
        at(o.paintAt, () => cb({ getEntries: () => [{ name: 'first-paint', startTime: o.paintAt }, { name: 'first-contentful-paint', startTime: o.paintAt }] }));
      }
    },
    matchMedia: (q) => ({ matches: /dark/.test(q) ? o.osDark : /reduce/.test(q) ? o.reduce : false }),
    localStorage: local,
    sessionStorage: session,
    Event: class { constructor(type) { this.type = type; } },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    addEventListener: () => {},
    dispatchEvent: (e) => { events.push([now, e.type]); return true; },
    ParticleText: o.particle ? { of: (h) => (h === host ? { unpause() {}, replay: (r) => replays.push([now, r]) } : null) } : undefined,
    SoundManager: { playStepperEnter: () => events.push([now, 'sound']) }
  };
  win.window = win;
  const root = {
    classList, style,
    setAttribute: (k, val) => { attrs[k] = String(val); },
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    hasAttribute: (k) => k in attrs,
    get inert() { return inert; },
    set inert(val) { if (Boolean(val) !== inert) { inert = Boolean(val); log.push([now, (inert ? '+' : '-') + 'inert']); } }
  };
  const mainEl = { tag: 'main' };
  const cssLink = { get sheet() { return now >= o.cssAt ? {} : null; } };
  win.document = {
    documentElement: root,
    get cookie() { return o.cookie; },
    addEventListener: (type, fn) => { (docListeners[type] ||= []).push(fn); },
    querySelector: (sel) => {
      if (sel === '[data-particle-text]') return host;
      if (sel === 'main') return now >= o.mainAt ? mainEl : null;
      if (sel === 'link[href="/css/main.css"]') return cssLink;
      return null;
    },
    getElementById: (id) => (id === 'preloader' ? overlay : null)
  };
  if (o.animAt != null) {
    at(o.animAt, () => (docListeners.animationstart || []).forEach((fn) => fn({ type: 'animationstart', animationName: 'pl-w' })));
    at(o.animAt + 920, () => (docListeners.animationstart || []).forEach((fn) => fn({ type: 'animationstart', animationName: 'pl-w' })));
  }
  if (o.dclAt != null) at(o.dclAt, () => (docListeners.DOMContentLoaded || []).forEach((fn) => fn({ type: 'DOMContentLoaded' })));
  let threw = null;
  try { vm.runInNewContext(script, win); } catch (e) { threw = e; }
  while (queue.length) {
    queue.sort((a, b) => a.time - b.time || a.seq - b.seq);
    const next = queue.shift();
    if (next.time > o.until) break;
    now = next.time;
    next.fn();
  }
  return { log, classes, attrs, style, events, replays, threw, session: session._m, local: local._m, inert: () => inert };
}

const when = (run, mark) => { const hit = run.log.find(([, m]) => m === mark); return hit ? hit[0] : null; };

// The writing ("jay" plus the j's dot) ends 1140 ms after the overlay is first styled;
// the exit may not start before 1200 ms (the write plus one short beat).
const MIN_HOLD = 1200;

function holdViolations(script) {
  const v = [];
  const check = (name, opts, lo, hi) => {
    const run = simulate(script, opts);
    const paint = opts.paintAt ?? 40;
    const reduce = opts.reduce;
    const anim = 'animAt' in opts ? opts.animAt : reduce ? null : paint + 80;
    const start = anim != null ? anim - 80 : paint;
    if (when(run, '+pl-on') !== 0) v.push(`${name}: the hold class is not set before first paint`);
    if (when(run, '+inert') !== 0) v.push(`${name}: the page is not inert during the hold`);
    const exit = when(run, '+pl-out');
    if (exit == null) { v.push(`${name}: never exits`); return run; }
    if (exit - start < MIN_HOLD) v.push(`${name}: exits ${exit - start} ms after the overlay started, before the writing ends`);
    if (exit < lo || exit > hi) v.push(`${name}: exit at ${exit} ms, expected ${lo} to ${hi}`);
    if (when(run, '-pl-on') !== exit) v.push(`${name}: scroll is not released when the exit starts`);
    if (when(run, '-inert') !== exit) v.push(`${name}: the page is not made live again when the exit starts`);
    if (run.classes.has('pl-on')) v.push(`${name}: scroll is still locked at the end`);
    const clearAt = opts.transition === false ? 3000 : reduce ? 200 : 840;
    if (when(run, '-pl-out') !== exit + clearAt) v.push(`${name}: the overlay is cleared at ${when(run, '-pl-out')} ms, expected ${exit + clearAt} (when its own lift ends)`);
    if (!run.events.some(([t, e]) => t === exit && e === 'pl:out')) v.push(`${name}: no pl:out at the exit`);
    if (run.session.get('jayptl-preloaded') !== '1') v.push(`${name}: the session flag is not set`);
    return run;
  };
  const fast = check('fast load', { paintAt: 40, dclAt: 300 }, 1240, 1240);
  if (!fast.replays.some(([t, r]) => t === when(fast, '+pl-out') + 160 && r.duration === 900 && r.stagger === 180)) {
    v.push('fast load: the hero particle text is not replayed 160 ms into the exit');
  }
  check('no transitionend (fallback)', { dclAt: 300, transition: false }, 1240, 1240);
  check('late paint', { paintAt: 900, dclAt: 950 }, 2100, 2100);
  check('overlay styled after first paint', { paintAt: 56, animAt: 305, dclAt: 300 }, 1425, 1425);
  check('slow load', { dclAt: 4000 }, 4000, 4000);
  check('stuck load, page styled', { dclAt: null }, 5000, 5000);
  check('stuck load, main.css late', { dclAt: null, cssAt: 6500 }, 6500, 6500);
  check('stuck load, main not parsed yet', { dclAt: null, mainAt: 7000 }, 7000, 7000);
  check('stuck load, never styled (hard ceiling)', { dclAt: null, cssAt: Infinity }, 8000, 8000);
  check('requestAnimationFrame throws', { dclAt: null, rafThrows: true }, 5000, 5000);
  const rm = check('reduced motion', { reduce: true, dclAt: 1800 }, 1800, 1800);
  if (when(rm, '+pl-rm') !== 0) v.push('reduced motion: the static-mark class is not set before first paint');
  check('reduced motion, fast load', { reduce: true, dclAt: 300 }, 1240, 1240);

  const repeat = simulate(script, { seen: '1' });
  if (repeat.log.some(([, m]) => /pl-(on|out)|inert/.test(m))) v.push('repeat visit: the preloader still plays');
  if (repeat.attrs['data-theme'] == null) v.push('repeat visit: the theme is not set');
  const blocked = simulate(script, { storageThrows: true, dclAt: 300 });
  if (when(blocked, '+pl-out') == null) v.push('storage blocked: the hold never ends');
  return v;
}

test('preloader hold: covers the writing, ends at DOMContentLoaded or a styled page, hard ceiling, inert and scroll released at exit, once per session', () => {
  assert.deepEqual(holdViolations(homeScript()), []);
});

test('preloader hold, negative control: each broken rule is caught', () => {
  const s = homeScript();
  const mutate = (from, to) => { const m = s.replace(from, to); assert.notEqual(m, s, `mutation did not apply: ${from}`); return holdViolations(m); };
  assert.ok(mutate('12e2-(', '1e3-(').some((x) => /before the writing ends/.test(x)));
  assert.ok(mutate("e.animationName==='pl-w'", '0').some((x) => /overlay styled after first paint.*before the writing ends/.test(x)));
  assert.ok(mutate('setTimeout(cap,5e3)', 'setTimeout(cap,9e3)').some((x) => /page styled: exit at 9000/.test(x)));
  assert.ok(mutate('if(ok()||', 'if(1||').some((x) => /main\.css late: exit at 5000/.test(x)));
  assert.ok(mutate('performance.now()>=8e3', '0').some((x) => /never styled \(hard ceiling\): never exits/.test(x)));
  assert.ok(mutate("c.remove('pl-on');", '').some((x) => /scroll/.test(x)));
  assert.ok(mutate('h.inert=!0;', '').some((x) => /not inert/.test(x)));
  assert.ok(mutate('h.inert=!1;', '').some((x) => /made live again/.test(x)));
  assert.ok(mutate('e&&(e.target!==o||e.pseudoElement)', '0').some((x) => /cleared at .*when its own lift ends/.test(x)));
  assert.ok(mutate("if(o)o.addEventListener('transitionend',off);setTimeout(off,3e3);", 'setTimeout(off,860);').some((x) => /cleared at/.test(x)));
  assert.ok(mutate('if(seen)return;', '').some((x) => /repeat visit: the preloader still plays/.test(x)));
  // Registering the timers after a step that can throw leaves the page held for good.
  const reg = "d.addEventListener('DOMContentLoaded',function(){setTimeout(end,0)});setTimeout(cap,5e3);";
  const raf = 'try{requestAnimationFrame(function(){if(!s)t=performance.now()})}catch(x){}';
  assert.ok(s.includes(reg) && s.includes(raf));
  const late = s.replace(reg, '').replace(raf, 'requestAnimationFrame(function(){if(!s)t=performance.now()});' + reg);
  assert.ok(holdViolations(late).some((x) => /requestAnimationFrame throws: never exits/.test(x)));
});

/* ---- the merged theme rule must stay the same as js/theme-detection.js ------ */

const THEME_CASES = [
  {}, { osDark: true }, { stored: 'dark' }, { stored: 'light', osDark: true }, { stored: 'bogus', osDark: true },
  { cookie: 'a=1; preferred-theme=dark' }, { cookie: 'preferred-theme=light', osDark: true },
  { stored: 'dark', cookie: 'preferred-theme=light' }, { cookie: 'preferred-theme=blue', osDark: true },
  { storageThrows: true, osDark: true }, { storageThrows: true, cookie: 'preferred-theme=dark' }
];

function themeOf(script, o, keep = true) {
  const r = simulate(script, { ...o, seen: '1', dclAt: null, until: 0 });
  const out = { theme: r.attrs['data-theme'], scheme: r.style.colorScheme, js: r.classes.has('js'), noJs: r.classes.has('no-js') };
  if (keep) out.kept = r.local.get('user-theme-preference') ?? null;
  return out;
}

function themeDiffs(script, keep = true) {
  return THEME_CASES
    .map((o) => ({ o, inline: themeOf(script, o, keep), file: themeOf(THEME_FILE, o, keep) }))
    .filter(({ inline, file }) => JSON.stringify(inline) !== JSON.stringify(file))
    .map(({ o, inline, file }) => `${JSON.stringify(o)}: got ${JSON.stringify(inline)} vs file ${JSON.stringify(file)}`);
}

test('preloader theme: the merged inline theme rule matches js/theme-detection.js in every case', () => {
  assert.deepEqual(themeDiffs(homeScript()), []);
});

test('preloader theme, negative control: a drifted storage key or cookie name is caught', () => {
  const s = homeScript();
  const key = s.replace("'user-theme-preference'", "'theme'");
  assert.notEqual(key, s);
  assert.ok(themeDiffs(key).length > 0);
  const cookie = s.replace("'preferred-theme='", "'theme='");
  assert.notEqual(cookie, s);
  assert.ok(themeDiffs(cookie).length > 0);
});

// When the hashed head script is blocked (a CSP drift, an edge rewrite), the deferred
// theme-toggle.js must still apply the saved theme and swap no-js for js, so the consent
// settings toggle (hidden under .no-js) comes back.
test('blocked head script: theme-toggle.js applies the saved theme and the js flag, as theme-detection.js would', () => {
  assert.deepEqual(themeDiffs(THEME_TOGGLE, false), []);
});

test('blocked head script, negative control: without the fallback the theme and the js flag are lost', () => {
  const call = 'applyHeadScriptFallback();';
  assert.ok(THEME_TOGGLE.includes(call));
  assert.ok(themeDiffs(THEME_TOGGLE.replace(call, ''), false).length > 0);
});

/* ---- the stepper's keyboard during the hold -------------------------------- */

function keyStepped(src, holding) {
  const window = new Window({ url: 'http://localhost/' });
  const document = window.document;
  if (holding) document.documentElement.classList.add('pl-on');
  const module = { exports: {} };
  new Function('window', 'document', 'module', src)(window, document, module);
  const Stepper = module.exports;
  let stepped = 0;
  const fake = {
    _releasing: false, isProcessingScroll: false, scrollEventLocked: false,
    container: { classList: { contains: (c) => c === 'in-view', add() {}, remove() {} } },
    lastStepTime: 0, minStepInterval: 0, currentIndex: 0, items: [1, 2, 3],
    executeStep() { stepped++; }, updateStepper() {}
  };
  for (const key of ['ArrowDown', ' ']) Stepper.prototype.handleKeyboard.call(fake, { key, preventDefault() {} });
  window.close();
  return stepped;
}

test('stepper: keys do nothing while the preloader holds, and work after it', () => {
  assert.equal(keyStepped(SCROLL_REVEAL, true), 0);
  assert.ok(keyStepped(SCROLL_REVEAL, false) > 0);
});

test('stepper, negative control: without the hold check the keys move the stepper under the cover', () => {
  const guard = "if (document.documentElement.classList.contains('pl-on')) return;";
  assert.ok(SCROLL_REVEAL.includes(guard));
  assert.ok(keyStepped(SCROLL_REVEAL.replace(guard, ''), true) > 0);
});

/* ---- the router keeps page CSS after main.css when it leaves home ----------- */

function routerOrder(src) {
  const window = new Window({
    url: 'https://jayptl.me/',
    settings: { disableJavaScriptEvaluation: false, disableCSSFileLoading: true, disableJavaScriptFileLoading: true }
  });
  const document = window.document;
  document.head.innerHTML = '<style>/* Signature preloader */</style>';
  document.body.innerHTML = '<div class="pl" id="preloader"></div><link rel="stylesheet" href="/css/main.css"><style id="crit">.hero-container{}</style><div class="pt-veil"></div><main></main>';
  new Function('window', 'document', 'DOMParser', 'fetch', 'navigator', src)(window, document, window.DOMParser, async () => ({}), window.navigator);
  const about = new window.DOMParser().parseFromString(
    '<html><head><link rel="stylesheet" href="/css/main.css"><link rel="stylesheet" href="/css/pages/about.css"><link rel="stylesheet" href="/css/pages/extra.css"></head><body><main></main></body></html>', 'text/html');
  window.PageRouter.syncPageStyles(about);
  const order = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map((n) => n.getAttribute('href') || n.id || 'head-style');
  window.happyDOM.abort();
  window.close();
  return order;
}

test('router: leaving home, page CSS lands after main.css and its critical block, in order', () => {
  assert.deepEqual(routerOrder(ROUTER), ['head-style', '/css/main.css', 'crit', '/css/pages/about.css', '/css/pages/extra.css']);
});

test('router, negative control: appending page CSS to the head puts it before main.css', () => {
  const insert = 'insertPageStyle(link);';
  assert.ok(ROUTER.includes(insert));
  const old = ROUTER.replace(insert, '(document.head || document.documentElement).appendChild(link);');
  assert.notDeepEqual(routerOrder(old), ['head-style', '/css/main.css', 'crit', '/css/pages/about.css', '/css/pages/extra.css']);
});
