// Tests for the sound manager and the audio score (D-73): Clay in the
// light theme, Glass in the dark theme, and the engine fixes. The audio
// engine is a recording stub: every node, connection, start, stop and
// automation event is kept so the graph can be checked without sound.
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

const EVENTS = [
  'press', 'release', 'select', 'hover', 'tick', 'pick', 'drop', 'success',
  'themeDark', 'themeLight', 'stepDown', 'stepUp', 'stepperEnter', 'stepperExit',
  'riser', 'motif'
];

// Every public voice the site called before D-73, with its argument.
const LEGACY = [
  ['playSelectSound'], ['playHoverSound'], ['playLightsaberIgnite'],
  ['playLightsaberRetract'], ['playStepUp'], ['playStepDown'],
  ['playStepperEnter'], ['playStepperExit'], ['playRiser'], ['playMotif', 'intro']
];

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
      start(t = 0) { this.startAt = t; },
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
      return { length, sampleRate, numberOfChannels: channels, getChannelData: () => data };
    }
    resume() {
      this.resumeCalls++;
      return Promise.resolve().then(() => { this.state = 'running'; });
    }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
  }
  return { Ctor: FakeAudioContext, contexts };
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
  random = 0.5, score = false, router = null
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
    LEGACY.forEach((call) => problems.push(...tailProblems(playOne(env, call), `${theme} ${call[0]}`)));
    if (typeof env.sm.play === 'function') {
      EVENTS.forEach((name) => {
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

test('sound fix: copying the email plays its select once', async () => {
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
  env.sm.playSelectSound();
  await settle();
  assert.ok(heard > 0, 'the press gesture is heard');
  assert.equal(sources(since(env, m2)).length, 0, 'the copy success repeated the select the press already played');
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
  env.sm.playHoverSound();
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
  assert.ok(oscs(down).some((o) => Math.abs(cents(startFreq(o), 320)) < 0.5), 'pointer down plays the Clay press');

  c.currentTime = 3.1;
  m = mark(env);
  pointer(env, btn, 'pointerup');
  await settle();
  const up = since(env, m);
  assert.ok(oscs(up).some((o) => Math.abs(cents(startFreq(o), 410)) < 0.5), 'let go plays the Clay release');
  assert.ok(!oscs(up).some((o) => Math.abs(cents(startFreq(o), 320)) < 0.5), 'let go does not repeat the press');
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
    const pitched = [['playStepperEnter'], ['playStepperExit'], ['playMotif', 'about'], ['playStepDown'], ['playStepUp']];
    const calls = typeof env.sm.play === 'function'
      ? pitched.concat(['success', 'tick', 'hover', 'motif', 'stepDown', 'stepUp'])
      : pitched;
    calls.forEach((call) => {
      const label = `${theme} ${typeof call === 'string' ? call : call[0]}`;
      oscs(playOne(env, call)).forEach((o) => {
        const steady = !o.frequency.events.some((e) => e.kind === 'exp' || e.kind === 'curve');
        if (steady && !on432(startFreq(o))) offTable.push(`${label}: ${startFreq(o).toFixed(2)} Hz`);
      });
    });
    LEGACY.map((c) => c).concat(typeof env.sm.play === 'function' ? EVENTS : []).forEach((call) => {
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

test('sound: repeats vary by a few cents, never sample-identical', async () => {
  const env = setup({ random: null });
  env.sm.setMasterEnabled(true);
  const firsts = [];
  for (let i = 0; i < 3; i++) {
    const nodes = playOne(env, ['playSelectSound']);
    await settle();
    firsts.push(startFreq(oscs(nodes)[0]));
  }
  assert.equal(new Set(firsts).size, 3, `three plays gave ${firsts.join(', ')} Hz`);
  const spread = Math.max(...firsts.map((f) => Math.abs(cents(f, firsts[0]))));
  assert.ok(spread <= 14, `repeats spread ${spread.toFixed(1)} cents, more than a few`);
});

/* ---- Palettes follow the theme --------------------------------------- */

function pressFreq(env) {
  const nodes = playOne(env, ['playSelectSound']);
  return startFreq(oscs(nodes)[0]);
}

test('sound: light plays Clay, dark plays Glass, and a theme flip switches the set', () => {
  const env = setup({ theme: 'light' });
  env.sm.setMasterEnabled(true);
  assert.ok(Math.abs(cents(pressFreq(env), 320)) < 0.5, 'light theme press is the Clay body');
  env.document.documentElement.setAttribute('data-theme', 'dark');
  assert.ok(Math.abs(cents(pressFreq(env), 1150)) < 0.5, 'dark theme press is the Glass drop');

  const sys = setup({ theme: null, system: 'dark' });
  sys.sm.setMasterEnabled(true);
  assert.ok(Math.abs(cents(pressFreq(sys), 1150)) < 0.5, 'no data-theme follows the system scheme');

  // The theme toggle asks for the theme sound in the same frame it picks
  // the theme; the attribute lands a frame later inside the view transition.
  const flip = setup({ theme: 'light' });
  flip.sm.setMasterEnabled(true);
  flip.window.themeManager = { userPreference: 'dark' };
  assert.ok(Math.abs(cents(pressFreq(flip), 1150)) < 0.5, 'the chosen theme wins over a lagging attribute');
});

test('sound: a theme flip moves the bed to the other palette', async () => {
  const env = setup({ theme: 'light', prefs: { master: true, bed: true, motifs: false, level: 'low' } });
  env.sm.setMasterEnabled(true);
  await settle();
  assert.equal(env.sm.bedPlaying, true);
  assert.equal(env.sm.bedNodes && env.sm.bedNodes.palette, 'clay');
  env.document.documentElement.setAttribute('data-theme', 'dark');
  env.window.dispatchEvent(new env.window.CustomEvent('themechange', { detail: { theme: 'dark' } }));
  await settle();
  assert.equal(env.sm.bedPlaying, true);
  assert.equal(env.sm.bedNodes && env.sm.bedNodes.palette, 'glass');
});

test('sound: the hero stepper climbs one note per line and walks back down', () => {
  const env = setup({ theme: 'light' });
  env.sm.setMasterEnabled(true);
  const note = (call) => startFreq(oscs(playOne(env, call))[0]);
  playOne(env, ['playStepperEnter']);
  assert.ok(Math.abs(cents(note(['playStepDown']), 384.87)) < 0.5, 'first step forward is G4');
  assert.ok(Math.abs(cents(note(['playStepDown']), 432)) < 0.5, 'second step forward is A4');
  assert.ok(Math.abs(cents(note(['playStepUp']), 384.87)) < 0.5, 'a step back is G4 again');
  assert.ok(Math.abs(cents(note(['playStepDown', 4]), 576.65)) < 0.5, 'a passed line index wins: line 4 is D5');
});

/* ---- Kept behaviour --------------------------------------------------- */

test('sound kept: with the master switch off nothing plays and no context is made', () => {
  const env = setup({ prefs: { master: false, bed: true, motifs: true, level: 'med' } });
  LEGACY.forEach((call) => env.sm[call[0]](call[1]));
  if (typeof env.sm.play === 'function') EVENTS.forEach((name) => env.sm.play(name));
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

test('sound kept: reduced motion silences the riser, motifs, bed and press sounds', async () => {
  const env = setup({ reduced: true, prefs: { master: true, bed: true, motifs: true, level: 'low' } });
  env.sm.setMasterEnabled(true);
  env.document.body.innerHTML = '<button class="btn">Go</button>';
  const m = mark(env);
  env.sm.playRiser();
  env.sm.playMotif('intro');
  env.sm.startBed();
  pointer(env, env.document.querySelector('button'), 'pointerdown');
  pointer(env, env.document.querySelector('button'), 'pointerup');
  await settle();
  assert.equal(sources(since(env, m)).length, 0);
  assert.equal(env.sm.bedPlaying, false);
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
