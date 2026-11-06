// Tests for the sound manager and the audio score: one quiet felt family
// in both themes (D-140, D-144 to D-146), recordings made once and
// replayed (D-128), identical repeats (D-142), and silence on hover,
// scroll, sections and page changes. The audio engine is a recording
// stub: every node, connection, start, stop and automation event is kept
// so the graph can be checked without sound.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const SM = 'js/components/sound-manager.js';
const AS = 'js/components/audio-score.js';

const GLOBALS = [
  'window', 'document', 'navigator', 'location', 'localStorage', 'performance',
  'CustomEvent', 'setTimeout', 'clearTimeout', 'Math', 'console'
];

// Only what the visitor does makes a sound.
const VOICED = ['press', 'release', 'select', 'pick', 'drop', 'success', 'themeDark', 'themeLight'];
// Passing, scrolling and page changes stay silent (D-146).
const SILENT = ['hover', 'tick', 'stepDown', 'stepUp', 'stepperEnter', 'stepperExit', 'riser', 'motif'];

// Every public voice the site called before D-73, with its argument.
const LEGACY = [
  ['playSelectSound'], ['playHoverSound'], ['playLightsaberIgnite'],
  ['playLightsaberRetract'], ['playStepUp'], ['playStepDown'],
  ['playStepperEnter'], ['playStepperExit'], ['playRiser'], ['playMotif', 'intro']
];
const LEGACY_VOICED = [['playSelectSound'], ['playLightsaberIgnite'], ['playLightsaberRetract']];
const LEGACY_SILENT = LEGACY.filter((c) => !LEGACY_VOICED.some((v) => v[0] === c[0]));

const E4 = 323.63, G4 = 384.87, A4 = 432;

const PREFS_KEY = 'jayptl.sound.prefs.v1';

/* ---- Recording audio stub ------------------------------------------- */

class Param {
  constructor(value) { this.value = value; this.events = []; }
  setValueAtTime(v, t) { this.events.push({ kind: 'set', v, t }); return this; }
  linearRampToValueAtTime(v, t) { this.events.push({ kind: 'lin', v, t }); return this; }
  exponentialRampToValueAtTime(v, t) {
    // Browsers throw here too.
    if (!(Math.abs(v) > 0)) throw new RangeError('exponential ramp to zero');
    this.events.push({ kind: 'exp', v, t });
    return this;
  }
  setTargetAtTime(v, t, c) { this.events.push({ kind: 'target', v, t, c }); return this; }
  setValueCurveAtTime(arr, t, d) {
    this.events.push({ kind: 'curve', v: Math.max(...arr), t, d });
    return this;
  }
  cancelScheduledValues(t) { this.events = this.events.filter((e) => e.t < t); return this; }
  cancelAndHoldAtTime(t) { return this.cancelScheduledValues(t); }
  // Loudest value the param takes. A first setValueAtTime replaces the
  // starting value, so the starting value counts only without one.
  peak() {
    const values = this.events.map((e) => Math.abs(e.v));
    if (!this.events.length || this.events[0].kind !== 'set') values.push(Math.abs(this.value));
    return Math.max(...values);
  }
}

function fakeAudio({ state = 'running' } = {}) {
  const contexts = [];
  function node(ctx, kind, extra) {
    const n = Object.assign({
      kind,
      born: ctx.currentTime,
      outputs: [],
      connect(dest) { this.outputs.push(dest); return dest; },
      disconnect() { this.outputs = []; }
    }, extra);
    ctx.nodes.push(n);
    return n;
  }
  function source(ctx, kind, extra) {
    return node(ctx, kind, Object.assign({
      startAt: null,
      stopAt: null,
      start(t = 0, offset = 0) { this.startAt = t; this.offset = offset; },
      stop(t = 0) { this.stopAt = t; }
    }, extra));
  }
  class FakeAudioContext {
    constructor() {
      this.state = state;
      this.currentTime = 0;
      this.sampleRate = 4000;
      this.nodes = [];
      this.resumeCalls = 0;
      this.destination = node(this, 'destination');
      contexts.push(this);
    }
    createGain() { return node(this, 'gain', { gain: new Param(1) }); }
    createOscillator() {
      return source(this, 'osc', { type: 'sine', frequency: new Param(0), detune: new Param(0) });
    }
    createBufferSource() { return source(this, 'noise', { buffer: null, loop: false }); }
    createStereoPanner() { return node(this, 'panner', { pan: new Param(0) }); }
    createBiquadFilter() {
      return node(this, 'filter', { type: 'lowpass', frequency: new Param(350), Q: new Param(1), gain: new Param(0) });
    }
    createDynamicsCompressor() {
      return node(this, 'compressor', {
        threshold: new Param(-24), knee: new Param(30), ratio: new Param(12),
        attack: new Param(0.003), release: new Param(0.25)
      });
    }
    createBuffer(channels, length, sampleRate) {
      const data = new Float32Array(length);
      const buf = { length, sampleRate, numberOfChannels: channels, getChannelData: () => data };
      this.buffers = (this.buffers || []).concat([buf]);
      return buf;
    }
    resume() {
      this.resumeCalls++;
      return Promise.resolve().then(() => { this.state = 'running'; });
    }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
  }
  // A recording context: builds the same graph, then hands back a buffer.
  const offline = [];
  class FakeOfflineAudioContext extends FakeAudioContext {
    constructor(channels, length, sampleRate) {
      super();
      contexts.pop();
      offline.push(this);
      this.length = length;
      this.sampleRate = sampleRate;
      this.renders = 0;
    }
    startRendering() {
      this.renders++;
      return Promise.resolve({ recording: true, length: this.length, sampleRate: this.sampleRate, from: this });
    }
  }
  return { Ctor: FakeAudioContext, Offline: FakeOfflineAudioContext, contexts, offline };
}

/* ---- Harness -------------------------------------------------------- */

function run(win, rel, math) {
  const fn = new Function(...GLOBALS, src(rel));
  fn(...GLOBALS.map((name) => {
    if (name === 'Math') return math;
    if (name === 'console') return console;
    if (name === 'setTimeout') return setTimeout;
    if (name === 'clearTimeout') return clearTimeout;
    const v = win[name];
    return typeof v === 'function' && !/^[A-Z]/.test(name) ? v.bind(win) : v;
  }));
}

function setup({
  theme = 'light', system = 'light', reduced = false, state = 'running',
  prefs = { master: true, bed: false, motifs: true, level: 'low' },
  random = 0.5, score = false, router = null, record = false
} = {}) {
  const window = new Window({ url: 'https://jayptl.me/' });
  window.matchMedia = (query) => ({
    matches: query.includes('reduce') ? reduced
      : query.includes('prefers-color-scheme: dark') ? system === 'dark' : false,
    media: query,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}
  });
  // Scripts take their immediate init path, as they do when deferred.
  Object.defineProperty(window.document, 'readyState', { get: () => 'complete', configurable: true });
  if (theme) window.document.documentElement.setAttribute('data-theme', theme);
  if (prefs) window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  const audio = fakeAudio({ state });
  window.AudioContext = audio.Ctor;
  if (record) {
    window.OfflineAudioContext = audio.Offline;
    window.requestIdleCallback = (fn) => setTimeout(fn, 0);
  } else {
    delete window.OfflineAudioContext;
  }
  if (router) window.PageRouter = router;
  const math = random === null
    ? Math
    : Object.assign(Object.create(Math), { random: typeof random === 'function' ? random : () => random });
  run(window, SM, math);
  if (score) run(window, AS, math);
  return {
    window,
    document: window.document,
    sm: window.SoundManager,
    audio,
    ctx: () => audio.contexts[0]
  };
}

const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const isSource = (n) => n.kind === 'osc' || n.kind === 'noise';
const mark = (env) => (env.ctx() ? env.ctx().nodes.length : 0);
const since = (env, m) => (env.ctx() ? env.ctx().nodes.slice(m) : []);
const sources = (nodes) => nodes.filter(isSource);
const oscs = (nodes) => nodes.filter((n) => n.kind === 'osc');
const cents = (a, b) => 1200 * Math.log2(a / b);

function startFreq(osc) {
  const first = osc.frequency.events.find((e) => e.kind === 'set');
  return first ? first.v : osc.frequency.value;
}

function freqValues(osc) {
  const values = osc.frequency.events.map((e) => e.v);
  if (osc.frequency.value > 0) values.push(osc.frequency.value);
  return values.filter((v) => v > 0);
}

// Loudest gain from a source to the speakers: the product of every gain
// node's peak along the loudest path.
function pathGain(n) {
  if (n.kind === 'destination') return 1;
  const own = n.kind === 'gain' ? n.gain.peak() : 1;
  const outs = n.outputs.filter((o) => o && o.kind);
  if (!outs.length) return 0;
  return own * Math.max(...outs.map(pathGain));
}

// The first automated gain downstream of a source: its envelope.
function envelopeOf(srcNode) {
  const queue = [...srcNode.outputs];
  const seen = new Set();
  while (queue.length) {
    const n = queue.shift();
    if (!n || !n.kind || seen.has(n)) continue;
    seen.add(n);
    if (n.kind === 'gain' && n.gain.events.length) return n.gain;
    queue.push(...n.outputs);
  }
  return null;
}

function tailProblems(nodes, label) {
  const problems = [];
  sources(nodes).forEach((s, i) => {
    const name = `${label} source ${i}`;
    const env = envelopeOf(s);
    if (!env) { problems.push(`${name}: no envelope`); return; }
    const ev = env.events;
    const peak = env.peak();
    const under = (v) => (20 * Math.log10(Math.abs(v) / peak)).toFixed(1);
    const last = ev[ev.length - 1];
    if (last.v !== 0) {
      problems.push(`${name}: is cut while still ${under(last.v)} dB under its peak, not silent`);
      return;
    }
    const before = ev[ev.length - 2];
    if (!before || Math.abs(before.v) > peak * 1.001e-3) {
      problems.push(`${name}: falls only to ${under(before ? before.v : peak)} dB under its peak before it is zeroed`);
    }
    if (s.stopAt === null || last.t > s.stopAt + 1e-9) {
      problems.push(`${name}: stops at ${s.stopAt} before its tail ends at ${last.t}`);
    }
  });
  return problems;
}

function pointer(env, el, type, init = {}) {
  const Ctor = env.window.PointerEvent || env.window.MouseEvent;
  el.dispatchEvent(new Ctor(type, Object.assign({ bubbles: true, cancelable: true, button: 0, pointerId: 1 }, init)));
}

// Plays one legacy method or one new event, a few seconds after the last.
function playOne(env, call) {
  const c = env.ctx();
  c.currentTime += 3;
  const m = mark(env);
  if (typeof call === 'string') env.sm.play(call, { i: 3, name: 'work' });
  else env.sm[call[0]](call[1]);
  return since(env, m);
}

/* ---- Engine fixes, each written failing first ------------------------- */

test('sound fix: the volume is applied once, at the master gain', async () => {
  const env = setup();
  env.sm.setMasterEnabled(true);
  const low = env.sm.masterVolume;
  let m = mark(env);
  env.sm.playSelectSound();
  await settle();
  const peakLow = Math.max(...sources(since(env, m)).map(pathGain));

  env.sm.setVolumeLevel('med');
  const med = env.sm.masterVolume;
  m = mark(env);
  env.sm.playSelectSound();
  await settle();
  const peakMed = Math.max(...sources(since(env, m)).map(pathGain));

  assert.ok(med > low, 'Med is louder than Low');
  const moved = peakMed / peakLow;
  assert.ok(Math.abs(moved - med / low) < 1e-9,
    `Low to Med moved the voice by ${moved.toFixed(3)}x; applied once it is ${(med / low).toFixed(3)}x`);
});

test('sound fix: no voice is cut before its tail, in either palette', () => {
  const problems = [];
  ['light', 'dark'].forEach((theme) => {
    const env = setup({ theme });
    env.sm.setMasterEnabled(true);
    LEGACY_VOICED.forEach((call) => problems.push(...tailProblems(playOne(env, call), `${theme} ${call[0]}`)));
    if (typeof env.sm.play === 'function') {
      VOICED.forEach((name) => {
        const nodes = playOne(env, name);
        if (!sources(nodes).length) problems.push(`${theme} ${name}: played nothing`);
        problems.push(...tailProblems(nodes, `${theme} ${name}`));
      });
    }
  });
  assert.deepEqual(problems, []);
});

test('score fix: a routed link click plays the riser once for its page change', () => {
  const env = setup({ score: true, router: { handles: () => true } });
  env.sm.setMasterEnabled(true);
  let risers = 0;
  const original = env.sm.playRiser;
  env.sm.playRiser = function () { risers++; return original.apply(this, arguments); };
  env.document.body.innerHTML = '<a href="#about">About</a>';
  env.document.addEventListener('click', (e) => e.preventDefault(), true);
  env.document.querySelector('a').dispatchEvent(new env.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  env.window.dispatchEvent(new env.window.CustomEvent('page:ready'));
  assert.equal(risers, 1, 'the click and page:ready each played it');
});

test('score: a back or forward page change with no click still plays the riser once', () => {
  const env = setup({ score: true, router: { handles: () => true } });
  env.sm.setMasterEnabled(true);
  let risers = 0;
  const original = env.sm.playRiser;
  env.sm.playRiser = function () { risers++; return original.apply(this, arguments); };
  env.window.dispatchEvent(new env.window.CustomEvent('page:ready'));
  assert.equal(risers, 1);
});

test('sound fix: copying the email plays the press, then one soft note, not a second press', async () => {
  const env = setup();
  env.sm.setMasterEnabled(true);
  env.document.body.innerHTML = '<button class="talk-chip-copy pill-btn" type="button" data-copy="x">Copy email</button>';
  const btn = env.document.querySelector('button');
  const c = env.ctx();
  c.currentTime = 1;
  const m = mark(env);
  pointer(env, btn, 'pointerdown');
  c.currentTime = 1.1;
  pointer(env, btn, 'pointerup');
  await settle();
  const heard = sources(since(env, m)).length;

  c.currentTime = 1.2;
  const m2 = mark(env);
  // What js/components/talk-chip.js:157-158 does once the copy succeeds.
  env.sm.playSuccessSound();
  await settle();
  const after = oscs(since(env, m2));
  assert.ok(heard > 0, 'the press gesture is heard');
  assert.ok(after.length > 0 && after.every((o) => Math.abs(cents(startFreq(o), A4)) < 0.5 || Math.abs(cents(startFreq(o), 2 * A4)) < 0.5),
    'the copy success is not one soft A4 note');
  assert.ok(!after.some((o) => Math.abs(cents(startFreq(o), E4)) < 0.5), 'the copy success repeated the press');
});

test('sound fix: the first sound after the context was paused still plays', async () => {
  const env = setup();
  env.sm.setMasterEnabled(true);
  const c = env.ctx();
  c.state = 'suspended';
  const m = mark(env);
  env.sm.playSelectSound();
  await settle();
  assert.ok(c.resumeCalls > 0, 'the context was asked to resume');
  assert.ok(sources(since(env, m)).length > 0, 'the first sound after the pause was dropped');
});

test('sound: a sound whose resume lands too late is skipped, not burst out later', async () => {
  const env = setup();
  env.sm.setMasterEnabled(true);
  const c = env.ctx();
  c.state = 'suspended';
  c.resume = () => new Promise((resolve) => setTimeout(() => { c.state = 'running'; resolve(); }, 450));
  const m = mark(env);
  env.sm.playPressSound();
  await settle(500);
  assert.equal(sources(since(env, m)).length, 0);
});

test('sound fix: the press sound lands on pointer down and the release on let go', async () => {
  const env = setup({ theme: 'light' });
  env.sm.setMasterEnabled(true);
  env.document.body.innerHTML = '<button class="btn" type="button">Go</button>';
  const btn = env.document.querySelector('button');
  const c = env.ctx();
  c.currentTime = 3;
  let m = mark(env);
  pointer(env, btn, 'pointerdown');
  await settle();
  const down = since(env, m);
  assert.ok(sources(down).length > 0, 'nothing plays on pointer down');
  assert.ok(oscs(down).some((o) => Math.abs(cents(startFreq(o), E4)) < 0.5), 'pointer down plays the felt press, E4 falling');

  c.currentTime = 3.1;
  m = mark(env);
  pointer(env, btn, 'pointerup');
  await settle();
  const up = since(env, m);
  const rel = oscs(up).find((o) => Math.abs(cents(startFreq(o), G4)) < 0.5);
  assert.ok(rel, 'let go plays the felt release from G4');
  const end = rel.frequency.events.find((e) => e.kind === 'exp');
  assert.ok(end && Math.abs(cents(end.v, A4)) < 0.5, 'the release rises to A4 as the control springs back up');
  assert.ok(!oscs(up).some((o) => Math.abs(cents(startFreq(o), E4)) < 0.5), 'let go does not repeat the press');
});

test('sound: a cancelled press plays no release, and only the primary button presses', async () => {
  const env = setup();
  env.sm.setMasterEnabled(true);
  env.document.body.innerHTML = '<button class="btn" type="button">Go</button>';
  const btn = env.document.querySelector('button');
  const c = env.ctx();
  c.currentTime = 5;
  pointer(env, btn, 'pointerdown');
  pointer(env, btn, 'pointercancel');
  c.currentTime = 5.2;
  let m = mark(env);
  pointer(env, btn, 'pointerup');
  await settle();
  assert.equal(sources(since(env, m)).length, 0, 'a cancelled press still released');

  await settle(130);
  c.currentTime = 6;
  m = mark(env);
  pointer(env, btn, 'pointerdown', { button: 2 });
  await settle();
  assert.equal(sources(since(env, m)).length, 0, 'a right click pressed');
});

const PENTATONIC = new Set([0, 3, 5, 7, 10]); // A C D E G above A
function on432(f) {
  return [1, 2.76, 3.98, 5.4].some((ratio) => {
    const c = cents(f / ratio, 432);
    const semis = Math.round(c / 100);
    return Math.abs(c - semis * 100) < 1 && PENTATONIC.has(((semis % 12) + 12) % 12);
  });
}

test('sound fix: pitched voices use the 432 Hz tuning, with no A of the 440 tuning anywhere', () => {
  const offTable = [];
  const on440 = [];
  ['light', 'dark'].forEach((theme) => {
    const env = setup({ theme });
    env.sm.setMasterEnabled(true);
    const pitched = [['playSuccessSound'], ['playLightsaberIgnite'], ['playLightsaberRetract']];
    const calls = pitched.concat(VOICED);
    calls.forEach((call) => {
      const label = `${theme} ${typeof call === 'string' ? call : call[0]}`;
      oscs(playOne(env, call)).forEach((o) => {
        const steady = !o.frequency.events.some((e) => e.kind === 'exp' || e.kind === 'curve');
        if (steady && !on432(startFreq(o))) offTable.push(`${label}: ${startFreq(o).toFixed(2)} Hz`);
      });
    });
    LEGACY_VOICED.map((c) => c).concat(VOICED).forEach((call) => {
      const label = `${theme} ${typeof call === 'string' ? call : call[0]}`;
      oscs(playOne(env, call)).forEach((o) => freqValues(o).forEach((f) => {
        const off = cents(f, 440);
        if (Math.abs(off - Math.round(off / 1200) * 1200) < 5) on440.push(`${label}: ${f.toFixed(2)} Hz`);
      }));
    });
  });
  assert.deepEqual(offTable, [], 'steady pitches off the 432 pentatonic table');
  assert.deepEqual(on440, [], 'pitches on the A of the 440 tuning');
});

test('sound fix: repeats are identical, no per-play detune or level move (D-142)', async () => {
  const env = setup({ random: null });
  env.sm.setMasterEnabled(true);
  const firsts = [];
  const peaks = [];
  const offsets = [];
  for (let i = 0; i < 3; i++) {
    const nodes = playOne(env, ['playSelectSound']);
    await settle();
    firsts.push(startFreq(oscs(nodes)[0]));
    peaks.push(Math.max(...sources(nodes).map(pathGain)));
    offsets.push(nodes.filter((n) => n.kind === 'noise').map((n) => n.offset).join(','));
  }
  assert.equal(new Set(firsts).size, 1, `three plays gave ${firsts.join(', ')} Hz`);
  assert.equal(new Set(offsets).size, 1, `the thump started at different noise offsets: ${offsets.join(' | ')}`);
  assert.equal(new Set(peaks.map((p) => p.toFixed(9))).size, 1, `three plays peaked at ${peaks.join(', ')}`);
});

/* ---- Palettes follow the theme --------------------------------------- */

// The press body: its pitch and the lowpass it sits under.
function pressBody(env) {
  const nodes = playOne(env, ['playSelectSound']);
  const body = oscs(nodes)[0];
  const lps = nodes.filter((n) => n.kind === 'filter' && n.type === 'lowpass').map((n) => n.frequency.peak());
  return { f: startFreq(body), lp: Math.max(...lps), peak: Math.max(...sources(nodes).map(pathGain)) };
}

test('sound: light and dark are one felt family; dark is the same notes, softer and quieter', () => {
  const env = setup({ theme: 'light' });
  env.sm.setMasterEnabled(true);
  const light = pressBody(env);
  env.document.documentElement.setAttribute('data-theme', 'dark');
  const dark = pressBody(env);
  assert.ok(Math.abs(cents(light.f, E4)) < 0.5 && Math.abs(cents(dark.f, E4)) < 0.5, 'both themes press from E4');
  assert.ok(dark.lp < light.lp, `dark lowpass ${dark.lp} Hz is not under light ${light.lp} Hz`);
  assert.ok(dark.peak < light.peak, 'dark is not quieter than light');
  assert.ok(light.lp <= 800, `the light press is filtered at ${light.lp} Hz, over the 800 Hz felt ceiling`);

  const sys = setup({ theme: null, system: 'dark' });
  sys.sm.setMasterEnabled(true);
  assert.equal(pressBody(sys).lp, dark.lp, 'no data-theme follows the system scheme');

  // The theme toggle asks for the theme sound in the same frame it picks
  // the theme; the attribute lands a frame later inside the view transition.
  const flip = setup({ theme: 'light' });
  flip.sm.setMasterEnabled(true);
  flip.window.themeManager = { userPreference: 'dark' };
  assert.equal(pressBody(flip).lp, dark.lp, 'the chosen theme wins over a lagging attribute');
});

test('sound: a theme flip keeps the bed playing, moved to the night felt', async () => {
  const env = setup({ theme: 'light', prefs: { master: true, bed: true, motifs: false, level: 'low' } });
  env.sm.setMasterEnabled(true);
  await settle();
  assert.equal(env.sm.bedPlaying, true);
  assert.equal(env.sm.bedNodes && env.sm.bedNodes.palette, 'felt');
  env.document.documentElement.setAttribute('data-theme', 'dark');
  env.window.dispatchEvent(new env.window.CustomEvent('themechange', { detail: { theme: 'dark' } }));
  await settle();
  assert.equal(env.sm.bedPlaying, true);
  assert.equal(env.sm.bedNodes && env.sm.bedNodes.palette, 'feltNight');
});

test('sound fix: hover, scroll, sections, the stepper and page changes make no sound (D-146)', async () => {
  const problems = [];
  ['light', 'dark'].forEach((theme) => {
    const env = setup({ theme });
    env.sm.setMasterEnabled(true);
    SILENT.forEach((name) => {
      if (sources(playOne(env, name)).length) problems.push(`${theme} ${name}`);
    });
    LEGACY_SILENT.forEach((call) => {
      if (sources(playOne(env, call)).length) problems.push(`${theme} ${call[0]}`);
    });
    if (sources(playOne(env, ['playTickSound'])).length) problems.push(`${theme} playTickSound`);
  });
  assert.deepEqual(problems, [], 'these played a sound');
});

test('score fix: sections coming into view and hovering make no sound', async () => {
  const seen = [];
  const env = setup({ score: false });
  // The score names IntersectionObserver as a bare global.
  const IO = class {
    constructor(cb) { this.cb = cb; seen.push(this); }
    observe(el) { this.el = el; }
    disconnect() {}
  };
  env.window.IntersectionObserver = IO;
  const hadIO = 'IntersectionObserver' in globalThis;
  const prevIO = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = IO;
  env.document.body.innerHTML = '<section id="intro"></section><section id="selected-work"></section>'
    + '<footer class="site-footer"></footer><a class="nav-link" href="#x">x</a>';
  env.sm.setMasterEnabled(true);
  run(env.window, AS, Math);
  const c = env.ctx();
  c.currentTime = 4;
  const m = mark(env);
  seen.forEach((o) => ['#intro', '#selected-work', '.site-footer'].forEach((sel) => {
    const el = env.document.querySelector(sel);
    o.cb([{ isIntersecting: true, target: el }]);
    o.cb([{ isIntersecting: false, target: el }]);
  }));
  pointer(env, env.document.querySelector('.nav-link'), 'pointerover');
  await settle();
  if (hadIO) globalThis.IntersectionObserver = prevIO; else delete globalThis.IntersectionObserver;
  assert.ok(seen.length > 0, 'the score observed no sections');
  assert.equal(sources(since(env, m)).length, 0, 'a section or a hover made a sound');
});

/* ---- Kept behaviour --------------------------------------------------- */

test('sound kept: with the master switch off nothing plays and no context is made', () => {
  const env = setup({ prefs: { master: false, bed: true, motifs: true, level: 'med' } });
  LEGACY.forEach((call) => env.sm[call[0]](call[1]));
  VOICED.concat(SILENT).forEach((name) => env.sm.play(name));
  env.sm.startBed();
  env.document.body.innerHTML = '<button class="btn">Go</button>';
  pointer(env, env.document.querySelector('button'), 'pointerdown');
  pointer(env, env.document.querySelector('button'), 'pointerup');
  assert.equal(env.audio.contexts.length, 0);
});

test('sound kept: turning the master off mutes every voice and stops the bed', async () => {
  const env = setup({ prefs: { master: true, bed: true, motifs: true, level: 'low' } });
  env.sm.setMasterEnabled(true);
  await settle();
  assert.equal(env.sm.bedPlaying, true);
  env.sm.toggleMute();
  assert.equal(env.sm.bedPlaying, false);
  const m = mark(env);
  LEGACY.forEach((call) => env.sm[call[0]](call[1]));
  await settle();
  assert.equal(sources(since(env, m)).length, 0);
});

test('sound fix: reduced motion keeps the bed silent but presses still answer (D-138)', async () => {
  const env = setup({ reduced: true, prefs: { master: true, bed: true, motifs: true, level: 'low' } });
  env.sm.setMasterEnabled(true);
  env.document.body.innerHTML = '<button class="btn">Go</button>';
  let m = mark(env);
  env.sm.playRiser();
  env.sm.playMotif('intro');
  env.sm.startBed();
  await settle();
  assert.equal(sources(since(env, m)).length, 0, 'the riser, a motif or the bed played');
  assert.equal(env.sm.bedPlaying, false);
  env.ctx().currentTime = 2;
  m = mark(env);
  pointer(env, env.document.querySelector('button'), 'pointerdown');
  await settle();
  assert.ok(sources(since(env, m)).length > 0, 'a press under reduced motion was silent');
});

/* ---- Record once, replay (D-128) --------------------------------------- */

test('sound fix: switching sound on makes no noise up front, and noise is half a second', async () => {
  const env = setup();
  env.sm.setMasterEnabled(true);
  const c = env.ctx();
  assert.equal((c.buffers || []).length, 0, 'switch-on built noise buffers before any sound needed them');
  playOne(env, ['playSelectSound']);
  const made = c.buffers || [];
  assert.ok(made.length > 0, 'a played press made no noise');
  made.forEach((b) => assert.ok(b.length <= c.sampleRate * 0.5, `a noise buffer is ${b.length / c.sampleRate} s long`));
});

test('sound fix: each voiced event is recorded once per theme after switch-on, then replayed as one buffer', async () => {
  const env = setup({ record: true });
  env.sm.setMasterEnabled(true);
  for (let i = 0; i < 100 && (env.sm.bakeQueue.length || Object.keys(env.sm.baking).length || env.sm.bakeTimer); i++) await settle(10);
  const renders = env.audio.offline.reduce((n, o) => n + o.renders, 0);
  assert.equal(renders, VOICED.length * 2, `${renders} recordings for ${VOICED.length} events in 2 themes`);

  const c = env.ctx();
  c.currentTime = 3;
  let m = mark(env);
  env.sm.playPressSound();
  await settle();
  const played = since(env, m);
  assert.equal(sources(played).length, 1, 'a recorded press built more than one source');
  assert.equal(oscs(played).length, 0, 'a recorded press still built oscillators');
  assert.ok(sources(played)[0].buffer && sources(played)[0].buffer.recording, 'the press did not play its recording');

  c.currentTime = 4;
  m = mark(env);
  env.sm.playPressSound();
  await settle();
  const again = env.audio.offline.reduce((n, o) => n + o.renders, 0);
  assert.equal(again, renders, 'a second press recorded again');
  assert.equal(sources(since(env, m))[0].buffer, sources(played)[0].buffer, 'the second press used a different recording');
});

test('sound: a press leans gently toward where it was tapped (D-141)', async () => {
  const env = setup({ record: true });
  env.sm.setMasterEnabled(true);
  for (let i = 0; i < 100 && (env.sm.bakeQueue.length || Object.keys(env.sm.baking).length || env.sm.bakeTimer); i++) await settle(10);
  Object.defineProperty(env.window, 'innerWidth', { value: 1000, configurable: true });
  env.document.body.innerHTML = '<button class="btn" type="button">Go</button>';
  const c = env.ctx();
  c.currentTime = 5;
  const m = mark(env);
  pointer(env, env.document.querySelector('button'), 'pointerdown', { clientX: 1000 });
  await settle();
  const pan = since(env, m).find((n) => n.kind === 'panner');
  assert.ok(pan, 'the press was not placed');
  assert.ok(pan.pan.value > 0.25 && pan.pan.value <= 0.3, `a tap at the right edge panned ${pan.pan.value}`);
});

test('sound kept: the public voices older callers use are all still there', () => {
  const env = setup();
  [
    'getPrefs', 'setMasterEnabled', 'setBedEnabled', 'setMotifsEnabled', 'setVolumeLevel',
    'playSelectSound', 'playHoverSound', 'playLightsaberIgnite', 'playLightsaberRetract',
    'playStepUp', 'playStepDown', 'playStepperEnter', 'playStepperExit', 'playStepperArm',
    'playRiser', 'startBed', 'stopBed', 'setBedScene', 'playMotif', 'toggleMute',
    'setVolume', 'prefersReducedMotion', 'init', 'warmup'
  ].forEach((name) => assert.equal(typeof env.sm[name], 'function', name));
});

test('sound fix: under reduced motion a tap on a pill or sticker still answers (D-138)', async () => {
  const env = setup({ reduced: true, score: true });
  env.sm.setMasterEnabled(true);
  env.document.body.innerHTML = '<button class="sticker" type="button">s</button>';
  env.ctx().currentTime = 3;
  const m = mark(env);
  env.document.querySelector('button').dispatchEvent(new env.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await settle();
  assert.ok(sources(since(env, m)).length > 0, 'a sticker tap under reduced motion was silent');
});

test('sound fix: a returning visitor with sound already on gets the recordings on first gesture', async () => {
  const env = setup({ record: true, prefs: { master: true, bed: false, motifs: false, level: 'low' } });
  env.document.dispatchEvent(new env.window.MouseEvent('mousemove', { bubbles: true }));
  for (let i = 0; i < 100 && (env.sm.bakeQueue.length || Object.keys(env.sm.baking).length || env.sm.bakeTimer); i++) await settle(10);
  const renders = env.audio.offline.reduce((n, o) => n + o.renders, 0);
  assert.equal(renders, VOICED.length * 2, `a returning visitor got ${renders} recordings`);
});

test('sound fix: a press leans toward the tap before its recording is ready too', async () => {
  const env = setup();
  env.sm.setMasterEnabled(true);
  Object.defineProperty(env.window, 'innerWidth', { value: 1000, configurable: true });
  env.document.body.innerHTML = '<button class="btn" type="button">Go</button>';
  env.ctx().currentTime = 5;
  const m = mark(env);
  pointer(env, env.document.querySelector('button'), 'pointerdown', { clientX: 0 });
  await settle();
  const pan = since(env, m).find((n) => n.kind === 'panner');
  assert.ok(pan && pan.pan.value < -0.25, 'a live press at the left edge was not placed left');
});

test('sound: a failed recording is not retried on every tap', async () => {
  const env = setup({ record: true });
  env.window.OfflineAudioContext = class { constructor() { throw new Error('unsupported rate'); } };
  env.sm.setMasterEnabled(true);
  await settle(50);
  let tries = 0;
  env.window.OfflineAudioContext = class { constructor() { tries++; throw new Error('unsupported rate'); } };
  for (let i = 0; i < 5; i++) { env.ctx().currentTime += 1; env.sm.playPressSound(); }
  await settle(50);
  assert.equal(tries, 0, `a broken recorder was tried ${tries} more times`);
});

test('sound fix: dragging a sticker plays pick and drop, not a select on top', async () => {
  const env = setup({ score: true });
  env.sm.setMasterEnabled(true);
  env.document.body.innerHTML = '<button class="sticker" type="button">s</button>';
  let selects = 0;
  const orig = env.sm.playSelectSound;
  env.sm.playSelectSound = function () { const r = orig.apply(this, arguments); if (r !== false) selects++; return r; };
  env.ctx().currentTime = 2;
  env.sm.playPickSound();
  env.ctx().currentTime = 2.3;
  env.sm.playDropSound();
  env.document.querySelector('button').dispatchEvent(new env.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await settle();
  assert.equal(selects, 0, 'the click that ends a drag voiced a select too');
});

test('sound fix: switching sound off stops the recording queue', async () => {
  const env = setup({ record: true });
  env.window.requestIdleCallback = (fn) => setTimeout(fn, 40);
  env.sm.setMasterEnabled(true);
  env.sm.setMasterEnabled(false);
  await settle(120);
  const renders = env.audio.offline.reduce((n, o) => n + o.renders, 0);
  assert.equal(env.sm.bakeQueue.length, 0, 'the queue survived switch-off');
  assert.equal(renders, 0, `${renders} recordings were made after sound was switched off`);
});

test('sound: in dark mode a recorded press plays the night recording, not the light one', async () => {
  const env = setup({ record: true, theme: 'dark' });
  env.sm.setMasterEnabled(true);
  for (let i = 0; i < 100 && (env.sm.bakeQueue.length || Object.keys(env.sm.baking).length || env.sm.bakeTimer); i++) await settle(10);
  env.ctx().currentTime = 3;
  const m = mark(env);
  env.sm.playPressSound();
  await settle();
  const src = sources(since(env, m))[0];
  assert.equal(src.buffer, env.sm.baked['feltNight|press'], 'dark played a recording other than the night press');
  assert.notEqual(env.sm.baked['feltNight|press'], env.sm.baked['felt|press']);
});
