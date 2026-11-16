// Nanotech hero loop (D-204, D-207): the hero's particles search, build
// "LOOKING FOR", wonder, build "JAY", then "?", and let go, forever. Calm and
// cheap: fine dust, no shadowBlur, four fills per frame, and a word that holds
// still stops the drawing loop until the next stage. Reduced motion keeps the
// static "LOOKING FOR JAY?". A fake canvas stands in for the browser's.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(root, 'js/components/particle-text.js'), 'utf8');
const HOME = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function setup({ reduced = false, loop = 'LOOKING FOR|JAY|?' } = {}) {
  const window = new Window({ url: 'https://jayptl.me/', innerWidth: 1280, innerHeight: 800 });
  const document = window.document;
  let clock = 1000;
  window.performance.now = () => clock;
  const frames = [];
  const timers = [];
  window.requestAnimationFrame = (cb) => { frames.push(cb); return frames.length; };
  window.cancelAnimationFrame = () => { frames.length = 0; };
  window.setTimeout = (cb, ms) => { timers.push({ cb, at: clock + ms }); return timers.length; };
  window.clearTimeout = (id) => { if (timers[id - 1]) timers[id - 1].cb = null; };
  window.matchMedia = (q) => ({ matches: /reduce/.test(q) ? reduced : false, media: q, addEventListener() {}, removeEventListener() {} });
  delete window.ResizeObserver;
  delete window.IntersectionObserver;
  const log = { fills: 0, arcs: 0, clears: 0, shadow: [], perFrame: [] };
  const ctx = (canvas) => ({
    canvas, fillStyle: '', globalAlpha: 1, font: '', textAlign: '', textBaseline: '',
    set shadowBlur(v) { log.shadow.push(v); }, get shadowBlur() { return 0; }, shadowColor: '',
    setTransform() {}, clearRect() { log.clears++; log.perFrame.push({ fills: 0, arcs: 0 }); },
    beginPath() {}, moveTo() {}, closePath() {},
    arc() { log.arcs++; const f = log.perFrame[log.perFrame.length - 1]; if (f) f.arcs++; },
    fill() { log.fills++; const f = log.perFrame[log.perFrame.length - 1]; if (f) f.fills++; },
    fillRect() { const f = log.perFrame[log.perFrame.length - 1]; if (f) f.arcs++; },
    fillText() {},
    measureText: (t) => ({ width: String(t).length * 30, actualBoundingBoxLeft: 0, actualBoundingBoxRight: String(t).length * 30, actualBoundingBoxAscent: 40, actualBoundingBoxDescent: 10 }),
    getImageData: (x, y, w, h) => {
      // A solid block in the middle stands in for the glyphs.
      const data = new Uint8ClampedArray(w * h * 4);
      for (let yy = Math.floor(h * 0.3); yy < Math.floor(h * 0.7); yy++) for (let xx = Math.floor(w * 0.3); xx < Math.floor(w * 0.7); xx++) data[(yy * w + xx) * 4 + 3] = 255;
      return { data };
    }
  });
  window.HTMLCanvasElement.prototype.getContext = function () { return this._ctx || (this._ctx = ctx(this)); };
  document.body.innerHTML = `<div class="particle-text" data-particle-text="LOOKING FOR JAY?" ${loop ? `data-pt-loop="${loop}"` : ''} data-pt-manual style="font-size:64px"><canvas class="particle-text__canvas"></canvas></div>`;
  const host = document.querySelector('.particle-text');
  host.getBoundingClientRect = () => ({ width: 800, height: 300, top: 0, left: 0, right: 800, bottom: 300 });
  const fn = new Function('window', 'document', 'performance', 'requestAnimationFrame', 'IntersectionObserver', 'ResizeObserver', SRC);
  fn(window, document, window.performance, window.requestAnimationFrame, undefined, undefined);
  const inst = window.ParticleText.of(host);
  const step = (ms = 16, n = 1) => {
    for (let i = 0; i < n; i++) {
      clock += ms;
      timers.forEach((t) => { if (t.cb && t.at <= clock) { const cb = t.cb; t.cb = null; cb(); } });
      frames.splice(0).forEach((cb) => cb(clock));
    }
  };
  return { window, inst, log, step, frames, timers, tick: () => clock };
}

const settle = () => new Promise((r) => setTimeout(r, 20));

test('hero markup: the loop words are on the hero particle text', () => {
  assert.ok(/data-particle-text="LOOKING FOR JAY\?" data-pt-loop="LOOKING FOR\|JAY\|\?"/.test(HOME));
});

test('loop: stages run search, LOOKING FOR, wonder, JAY, ?, let go', async () => {
  const s = setup();
  await settle();
  assert.ok(s.inst.loopOn, 'loop not on after build');
  const names = s.inst.loopState.stages.map((st) => st.mode + (st.mode === 'form' ? ':' + s.inst.opts.loop[st.word] : ''));
  assert.deepEqual(names, ['search', 'form:LOOKING FOR', 'drift', 'form:JAY', 'form:?', 'release']);
});

test('loop: each frame draws in four fills, no glow, fine dust', async () => {
  const s = setup();
  await settle();
  s.inst.replay();
  s.step(16, 30);
  const frames = s.log.perFrame.filter((f) => f.arcs > 0);
  assert.ok(frames.length > 10, `only ${frames.length} drawn frames`);
  assert.ok(frames.every((f) => f.fills === 4), `fills per frame: ${[...new Set(frames.map((f) => f.fills))]}`);
  assert.ok(!s.log.shadow.some((v) => v > 0), 'shadowBlur used');
  assert.ok(s.inst.particles.every((p) => p.size >= 0.8 && p.size <= 1.8), 'particles are not fine dust');
});

test('loop: a word that holds still stops drawing and sleeps to the next stage', async () => {
  const s = setup();
  await settle();
  s.inst.replay();
  // Run into the first form stage, then watch it frame by frame until it rests.
  s.step(16, Math.ceil(4300 / 16));
  const L = s.inst.loopState;
  assert.equal(L.stages[L.si].mode, 'form');
  const formIndex = L.si;
  let slept = false;
  for (let i = 0; i < Math.ceil(4500 / 16) && L.si === formIndex; i++) {
    s.step(16, 1);
    if (s.frames.length === 0 && s.timers.some((t) => t.cb)) { slept = true; break; }
  }
  assert.ok(slept, 'the formed word never stopped drawing within its stage');
  const drawnBefore = s.log.clears;
  s.step(16, 20);
  assert.equal(s.log.clears, drawnBefore, 'drew while sleeping');
});

test('loop: pause clears the sleep timer', async () => {
  const s = setup();
  await settle();
  s.inst.replay();
  s.step(16, Math.ceil(4300 / 16));
  for (let i = 0; i < 300 && !s.timers.some((t) => t.cb); i++) s.step(16, 1);
  s.inst.pause();
  assert.equal(s.timers.filter((t) => t.cb).length, 0);
});

test('loop: reduced motion keeps the static full text, no loop', async () => {
  const s = setup({ reduced: true });
  await settle();
  assert.equal(s.inst.loopOn, false);
  assert.ok(s.inst.formed);
});

test('loop, negative control: without data-pt-loop the old gather runs', async () => {
  const s = setup({ loop: null });
  await settle();
  assert.equal(s.inst.loopOn, false);
});
