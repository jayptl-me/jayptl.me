/**
 * Sound Manager Component
 * Handmade Web Audio kit for the full site. Every voice is synthesized
 * from oscillators and noise made in the page, so there are zero audio
 * files, zero downloads, and zero copyright risk.
 *
 * One quiet family, felt (D-140, D-144 to D-146): a felted hammer for
 * press and release, a soft latch for the theme switch, one soft note
 * when something works. Dark is the same felt, softer and a little
 * quieter. Reopened 16 Nov (D-192, D-194, D-207): page changes, section
 * arrive and leave, hover by intent and the hero nano loop make calm,
 * soft felt sounds again, each rate limited; scroll and the stepper stay
 * silent.
 *
 * Score model, default off:
 * - Master switch gates every sound. Default off until the visitor
 *   taps sound on. Persisted in localStorage.
 * - Voiced events: press (pointer down), release (let go), select,
 *   pick, drop, success, theme to dark, theme to light.
 * - Calm events: page riser, section arrive and leave (motifs), hover
 *   after the pointer settles (Balanced intent rule), nano loop stages.
 * - Silent events, kept as methods for older callers: tick, stepper
 *   steps, stepper enter and exit.
 * - Bed: a slow pad on the Om pitch, C#3 = 136.07 Hz in the same
 *   A4 = 432 Hz tuning, with its octave and harmonics so small speakers
 *   carry it. Starts only after explicit opt in.
 *
 * Record once, replay (D-128): after sound is switched on, each voiced
 * event is rendered once per palette in an OfflineAudioContext, one per
 * idle moment, and later plays are a single buffer source. Until its
 * recording is ready an event plays live from the same recipe. Repeats
 * are identical (D-142). The noise is half a second, made once.
 *
 * Signal path: voice, master gain (the volume, applied once and only
 * here), a limiter at -6 dBFS, speakers. Every envelope starts at 0,
 * falls to 60 dB under its own peak and reaches 0 before its source
 * stops. One tuning everywhere: A4 = 432 Hz, pentatonic.
 *
 * Safety: no autoplay. Context is created only on user gesture or on
 * explicit enable. A suspended context is resumed before a voice plays,
 * so the first sound after a pause is not dropped. Pauses the bed when
 * the tab hides. Under reduced motion the bed stays silent; presses and
 * releases still answer, because a silent press feels broken (D-138).
 *
 * @file components/sound-manager.js
 * @author Jay Patel
 */

(function () {
    'use strict';

    var PREFS_KEY = 'jayptl.sound.prefs.v1';

    // A4 = 432 Hz, pentatonic only. The one tuning every pitched voice uses.
    var TUNE = {
        A2: 108.00, C3: 128.43, D3: 144.16, E3: 161.82, G3: 192.43,
        A3: 216.00, C4: 256.87, D4: 288.33, E4: 323.63, G4: 384.87,
        A4: 432.00, C5: 513.74, D5: 576.65, E5: 647.27, G5: 769.74,
        A5: 864.00, C6: 1027.47,
        // The Om bed (D-192): C#3 is the "Om" 136.1 Hz (Cousto's figure)
        // in this same 432 tuning, with its octave and the G#4 and C#5 near
        // its 3rd and 4th harmonics, so laptop and phone speakers, which
        // roll off below about 150 to 200 Hz, still carry the pitch.
        Cs3: 136.07, Cs4: 272.14, Gs4: 407.75, Cs5: 544.29
    };

    // Hero stepper: one note per line, climbing as the visitor moves forward.
    var SCALE = ['E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5'];

    // Bed brightness per room. The palette's own bed filter is the
    // generic room; the others scale it by their ratio to generic.
    var SCENES = {
        intro: 420,
        now: 380,
        work: 480,
        sticker: 520,
        about: 360,
        footer: 340,
        generic: 400
    };

    // Master gain per level. The recipes are set for a master of 1, where
    // the felt press peaks near -21 dBFS. Low, the default, sits at the
    // edge of hearing (D-146), about 5 dB under Med.
    var LEVELS = { low: 0.45, med: 0.8 };

    var THEME_PALETTE = { light: 'felt', dark: 'feltNight' };

    // Repeats are identical (D-142): no per-play detune, level or filter moves.
    var VAR_CENTS = 0;
    var VAR_DB = 0;
    var VAR_FILTER = 0;

    // Recordings: mono, 32 kHz (every voice sits under 2 kHz), length per
    // event in seconds, long enough for its whole tail.
    var BAKE_RATE = 32000;
    var BAKE_LEN = { press: 0.3, release: 0.25, select: 0.4, pick: 0.3, drop: 0.35, success: 0.8, themeDark: 0.5, themeLight: 0.5,
        riser: 1.2, arrive: 1.4, leave: 1.3, hover: 0.5, nanoSearch: 2.0, nanoForm: 1.6, nanoWonder: 2.6, nanoQuestion: 1.8, nanoRelease: 2.0 };

    // A sound asked for while the context resumes plays only if the
    // resume lands within this window, so nothing queues up and bursts.
    var STALE_MS = 300;

    // A select asked for this soon after a press gesture voiced its
    // release is the same gesture, already heard.
    var SELECT_ECHO_MS = 400;

    // Hover by intent, Balanced (D-194; numbers and sources in
    // pm/research-hover-intent-sound-2026-11-16.md: hoverIntent 100 ms and
    // 6 px, NN/g 0.3 to 0.5 s rest, Baymard 300 to 500 ms).
    var HOVER = { rest: 300, window: 300, maxSpeed: 60, quietAfterScroll: 300, gap: 1200, perMinute: 6, perElement: 60000 };

    // Section arrive and leave limits (D-129, D-192).
    var MOTIF = { perSection: 1500, gap: 350, maxScreensPerSecond: 3 };

    function loadPrefs() {
        var fallback = { master: false, bed: false, motifs: false, level: 'low' };
        try {
            var raw = localStorage.getItem(PREFS_KEY);
            if (!raw) return fallback;
            var parsed = JSON.parse(raw);
            return {
                master: parsed.master === true,
                bed: parsed.bed === true,
                motifs: parsed.motifs === true,
                level: parsed.level === 'med' ? 'med' : 'low'
            };
        } catch {
            return fallback;
        }
    }

    function savePrefs(prefs) {
        try {
            localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
        } catch { /* storage is a bonus, never breaks sound */ }
    }

    function noop() { /* intentionally empty */ }

    /* ---- Synthesis kit ------------------------------------------------ */

    function db(x) { return Math.pow(10, x / 20); }
    function rnd(a, b) { return a + Math.random() * (b - a); }

    // White, pink and brown noise, half a second each, made once per
    // kind on first use and copied into each context that needs it. The
    // old two-second set of all three froze switch-on for 37 to 46 ms.
    var NOISE_SECONDS = 0.5;
    var noiseSamples = {};
    // Per context, so recordings and live plays do not evict each other.
    var noiseCache = typeof WeakMap === 'function' ? new WeakMap() : null;

    function makeNoise(kind, len) {
        var d = new Float32Array(len);
        var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0, max = 0, i, w;
        for (i = 0; i < len; i++) {
            w = Math.random() * 2 - 1;
            if (kind === 'white') {
                d[i] = w;
            } else if (kind === 'pink') {
                b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
                b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
                b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
                d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
                b6 = w * 0.115926;
            } else {
                last = (last + 0.02 * w) / 1.02;
                d[i] = last;
            }
            if (Math.abs(d[i]) > max) max = Math.abs(d[i]);
        }
        if (max > 0) {
            for (i = 0; i < len; i++) d[i] = d[i] / max;
        }
        return d;
    }

    // The bed loops its noise, so it gets its own four-second buffer,
    // made only when the bed starts; half a second would repeat at 2 Hz.
    var bedNoiseCache = typeof WeakMap === 'function' ? new WeakMap() : null;
    function bedNoiseFor(ctx, kind) {
        var key = kind || 'pink';
        var bufs = bedNoiseCache ? bedNoiseCache.get(ctx) : null;
        if (!bufs) {
            bufs = {};
            if (bedNoiseCache) bedNoiseCache.set(ctx, bufs);
        }
        if (bufs[key]) return bufs[key];
        var len = Math.floor(ctx.sampleRate * 4);
        var buf = ctx.createBuffer(1, len, ctx.sampleRate);
        var src = makeNoise(key, len);
        var dst = buf.getChannelData(0);
        for (var i = 0; i < len; i++) dst[i] = src[i];
        bufs[key] = buf;
        return buf;
    }

    function noiseFor(ctx, kind) {
        kind = kind || 'white';
        var bufs = noiseCache ? noiseCache.get(ctx) : null;
        if (!bufs) {
            bufs = {};
            if (noiseCache) noiseCache.set(ctx, bufs);
        }
        if (bufs[kind]) return bufs[kind];
        var len = Math.floor(ctx.sampleRate * NOISE_SECONDS);
        if (!noiseSamples[kind] || noiseSamples[kind].length < len) noiseSamples[kind] = makeNoise(kind, len);
        var buf = ctx.createBuffer(1, len, ctx.sampleRate);
        var src = noiseSamples[kind];
        var dst = buf.getChannelData(0);
        for (var i = 0; i < len; i++) dst[i] = src[i];
        bufs[kind] = buf;
        return buf;
    }

    // The toolkit every recipe receives as S.
    function kit(ctx, out, variation) {
        var v = variation === false ? 0 : 1;
        var S = { ctx: ctx, out: out, TUNE: TUNE, SCALE: SCALE, db: db };

        S.det = function () { return Math.pow(2, rnd(-VAR_CENTS, VAR_CENTS) * v / 1200); };
        S.lvl = function (x) { return db(x + rnd(-VAR_DB, VAR_DB) * v); };
        S.ff = function (f) { return f * (1 + rnd(-VAR_FILTER, VAR_FILTER) * v); };
        S.note = function (name) { return TUNE[name] || TUNE.A4; };

        // Click-free envelope on an AudioParam. Returns the time it is silent.
        S.env = function (param, t, a, peak, d, hold) {
            hold = hold || 0;
            var t1 = t + a, t2 = t1 + hold, t3 = t2 + d;
            param.setValueAtTime(0, t);
            param.linearRampToValueAtTime(peak, t1);
            if (hold) param.setValueAtTime(peak, t2);
            param.exponentialRampToValueAtTime(Math.max(peak * 0.001, 1e-7), t3);
            param.linearRampToValueAtTime(0, t3 + 0.004);
            return t3 + 0.006;
        };

        function filters(o, t, into) {
            var first = null, last = null, map = {};
            function add(type, f, q) {
                var b = ctx.createBiquadFilter();
                b.type = type;
                b.frequency.setValueAtTime(S.ff(f), t);
                b.Q.value = q;
                if (last) last.connect(b); else first = b;
                last = b;
                map[type] = b;
            }
            if (o.hp) add('highpass', o.hp, o.hpq || 0.7);
            if (o.bp) add('bandpass', o.bp, o.q || 1);
            if (o.lp) add('lowpass', o.lp, o.lpq || 0.7);
            var sw = o.sweep;
            if (sw) {
                var target = map[{ hp: 'highpass', bp: 'bandpass', lp: 'lowpass' }[sw.on]];
                if (target) target.frequency.exponentialRampToValueAtTime(S.ff(sw.to), t + (sw.at || 0) + sw.dur);
            }
            if (last) last.connect(into);
            return first || into;
        }

        // Tone: one or more partials sharing a pitch path.
        // o: t, f, type, a, d, hold, db, lp/hp/bp, q, to + glide (exp glide),
        //    partials [[ratio, level, decay]].
        S.tone = function (o) {
            var t = o.t, a = o.a == null ? 0.002 : o.a, det = o.fixed ? 1 : S.det();
            var f = o.f * det, peak = S.lvl(o.db), end = t;
            var g = ctx.createGain();
            g.gain.value = 1;
            g.connect(S.out);
            var into = filters(o, t, g);
            (o.partials || [[1, 1, 1]]).forEach(function (p) {
                var osc = ctx.createOscillator(), base = f * p[0];
                osc.type = o.type || 'sine';
                osc.frequency.setValueAtTime(base, t);
                if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to * det * p[0], t + (o.glide || 0.03));
                var pg = ctx.createGain();
                var e = S.env(pg.gain, t, a, peak * p[1], o.d * p[2], o.hold);
                osc.connect(pg);
                pg.connect(into);
                osc.start(t);
                osc.stop(e + 0.01);
                if (e > end) end = e;
            });
            return end;
        };

        // Noise: generated white, pink or brown noise through filters.
        // o: t, color, a, d, hold, db, lp/hp/bp, q, sweep {on, to, dur, at}.
        S.noise = function (o) {
            // Pink and brown noise drift slowly below about 50 Hz, so a short
            // burst can land 10 dB louder or quieter at random. A 150 Hz
            // highpass removes the drift; small speakers cannot play it anyway.
            if (!o.hp) o = Object.assign({}, o, { hp: 150, hpq: 0.5 });
            var t = o.t, a = o.a == null ? 0.001 : o.a;
            var src = ctx.createBufferSource();
            src.buffer = noiseFor(ctx, o.color || 'white');
            var g = ctx.createGain();
            g.connect(S.out);
            var into = filters(o, t, g);
            src.connect(into);
            var e = S.env(g.gain, t, a, S.lvl(o.db), o.d, o.hold);
            // A fixed offset, so every play of a voice is identical (D-142).
            src.start(t, 0);
            src.stop(e + 0.01);
            return e;
        };

        // Ambient bed: sustained voices, each breathing on its own slow LFO,
        // optional filtered noise. Fades in over about 3 s and out over
        // about 1 s. Returns { stop(when, fast), lp, baseLp }.
        // o: t, db, type, lp, lpq, voices [[note, level, lfoHz]],
        //    noise {color, lp, hp, level}.
        S.pad = function (o) {
            var t = o.t, outG = ctx.createGain(), nodes = [];
            outG.gain.setValueAtTime(0, t);
            outG.gain.setTargetAtTime(db(o.db), t, 1.0);
            outG.connect(S.out);
            var lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = o.lp || 1000;
            lp.Q.value = o.lpq || 0.5;
            lp.connect(outG);
            (o.voices || []).forEach(function (vc) {
                var osc = ctx.createOscillator(), g = ctx.createGain();
                var l = ctx.createOscillator(), lg = ctx.createGain();
                osc.type = o.type || 'sine';
                osc.frequency.value = S.note(vc[0]);
                g.gain.value = vc[1] * 0.6;
                l.frequency.value = vc[2];
                lg.gain.value = vc[1] * 0.4;
                l.connect(lg);
                lg.connect(g.gain);
                osc.connect(g);
                g.connect(lp);
                osc.start(t);
                l.start(t);
                nodes.push(osc, l);
            });
            if (o.noise) {
                var n = ctx.createBufferSource(), ng = ctx.createGain(), last = n;
                n.buffer = bedNoiseFor(ctx, o.noise.color || 'pink');
                n.loop = true;
                if (o.noise.hp) {
                    var h = ctx.createBiquadFilter();
                    h.type = 'highpass';
                    h.frequency.value = o.noise.hp;
                    last.connect(h);
                    last = h;
                }
                if (o.noise.lp) {
                    var nl = ctx.createBiquadFilter();
                    nl.type = 'lowpass';
                    nl.frequency.value = o.noise.lp;
                    last.connect(nl);
                    last = nl;
                }
                ng.gain.value = o.noise.level;
                last.connect(ng);
                ng.connect(lp);
                n.start(t);
                nodes.push(n);
            }
            return {
                lp: lp,
                baseLp: o.lp || 1000,
                stop: function (when, fast) {
                    var gp = outG.gain;
                    var tc = fast ? 0.02 : 0.3;
                    if (gp.cancelAndHoldAtTime) gp.cancelAndHoldAtTime(when);
                    else { gp.cancelScheduledValues(when); gp.setValueAtTime(gp.value, when); }
                    gp.setTargetAtTime(0, when, tc);
                    nodes.forEach(function (x) {
                        try { x.stop(when + tc * 8.5); } catch { /* noop */ }
                    });
                }
            };
        };

        return S;
    }

    /* ---- One family, felt ---------------------------------------------- */
    // A felted hammer on a string, damped (D-140): a short pink thump
    // under 600 Hz and a body tone under 800 Hz, glide start and end on
    // scale notes. Night is the same felt with the filters closed to 0.7
    // and 2 dB quieter (D-145, D-146). Nothing here puts real energy
    // above 2 kHz, the line every sound the owner liked stayed under
    // (D-143, pm/proof-2026-11-06/sound-depth/harsh.json).

    function feltTouch(S, t, p, o) {
        S.noise({ t: t, color: 'pink', lp: 600 * p.lp, d: 0.010, db: o.ndb + p.off + 2 });
        S.tone({ t: t, f: S.note(o.f), to: S.note(o.to), glide: o.glide, a: 0.003, d: o.d * 1.4,
            db: o.db + p.off, lp: 800 * p.lp, partials: [[1, 1, 1], [2, 0.3, 0.5]] });
    }

    function feltNote(S, t, p, name, lvl, d) {
        S.tone({ t: t, f: S.note(name), a: 0.006, d: d, db: lvl + p.off, lp: 1200 * p.lp,
            sweep: { on: 'lp', to: 600 * p.lp, dur: d }, partials: [[1, 1, 1], [2, 0.3, 0.45]] });
        S.noise({ t: t, color: 'pink', lp: 500 * p.lp, d: 0.009, db: lvl + p.off - 9 });
    }

    // The theme switch: a soft latch, a physical object (D-146). Dark
    // closes downward, light opens upward; a second, smaller catch lands
    // 45 ms later, as a latch does.
    function feltLatch(S, t, p, from, to) {
        S.noise({ t: t, color: 'pink', lp: 600 * p.lp, d: 0.012, db: -14 + p.off });
        S.tone({ t: t, f: S.note(from), to: S.note(to), glide: 0.06, a: 0.003, d: 0.12, db: -21 + p.off,
            lp: 600 * p.lp, partials: [[1, 1, 1], [2, 0.25, 0.5]] });
        S.noise({ t: t + 0.045, color: 'pink', lp: 500 * p.lp, d: 0.008, db: -22 + p.off });
    }

    function feltSet(p) {
        var E = {};
        E.press = function (S, t) {
            feltTouch(S, t, p, { ndb: -14, f: 'E4', to: 'G3', glide: 0.028, d: 0.05, db: -21 });
        };
        // The release rises as the control springs back up.
        E.release = function (S, t) {
            feltTouch(S, t, p, { ndb: -21, f: 'G4', to: 'A4', glide: 0.02, d: 0.03, db: -27 });
        };
        E.select = function (S, t) { E.press(S, t); E.release(S, t + 0.095); };
        E.pick = function (S, t) {
            feltTouch(S, t, p, { ndb: -18, f: 'C4', to: 'G4', glide: 0.045, d: 0.06, db: -23 });
        };
        E.drop = function (S, t) {
            feltTouch(S, t, p, { ndb: -16, f: 'E4', to: 'G3', glide: 0.05, d: 0.09, db: -22 });
        };
        // Something lasting worked (copied, sent, booked): one soft note.
        E.success = function (S, t) { feltNote(S, t, p, 'A4', -24, 0.3); };
        E.themeDark = function (S, t) { feltLatch(S, t, p, 'E3', 'A2'); };
        E.themeLight = function (S, t) { feltLatch(S, t, p, 'A2', 'E3'); };

        // Calm events (D-192): soft attack, low, felt, quieter than a press.
        // Page change: a soft swell as the page covers, a settle as it lands.
        E.riser = function (S, t) {
            S.noise({ t: t, color: 'pink', lp: 420 * p.lp, a: 0.1, d: 0.3, db: -31 + p.off }); // the noise buffer is 0.5 s
            S.tone({ t: t + 0.05, f: S.note('A3'), to: S.note('E4'), glide: 0.3, a: 0.12, d: 0.45,
                db: -32 + p.off, lp: 700 * p.lp, partials: [[1, 1, 1], [2, 0.2, 0.5]] });
        };
        // Section arrive: one soft low note; leave: the same, falling, quieter.
        E.arrive = function (S, t) {
            S.tone({ t: t, f: S.note('E3'), to: S.note('A3'), glide: 0.25, a: 0.3, d: 0.6,
                db: -31 + p.off, lp: 650 * p.lp, partials: [[1, 1, 1], [2, 0.18, 0.5]] });
        };
        E.leave = function (S, t) {
            S.tone({ t: t, f: S.note('A3'), to: S.note('E3'), glide: 0.3, a: 0.25, d: 0.55,
                db: -35 + p.off, lp: 600 * p.lp, partials: [[1, 1, 1], [2, 0.15, 0.5]] });
        };
        // Hover, only after the pointer settles (D-194): a felt breath.
        E.hover = function (S, t) {
            S.noise({ t: t, color: 'pink', lp: 520 * p.lp, a: 0.02, d: 0.09, db: -33 + p.off });
            S.tone({ t: t, f: S.note('A4'), a: 0.02, d: 0.14, db: -36 + p.off, lp: 900 * p.lp,
                partials: [[1, 1, 1]] });
        };
        // Hero nano loop (D-207): calm and curious.
        E.nanoSearch = function (S, t) {
            S.tone({ t: t, f: S.note('A3'), a: 0.3, d: 0.9, db: -37 + p.off, lp: 450 * p.lp, partials: [[1, 1, 1], [2, 0.1, 0.4]] });
        };
        E.nanoForm = function (S, t) {
            feltNote(S, t, p, 'E4', -33, 0.5);
            feltNote(S, t + 0.22, p, 'A4', -34, 0.6);
        };
        E.nanoWonder = function (S, t) {
            S.tone({ t: t, f: S.note('D4'), to: S.note('E4'), glide: 0.9, a: 0.45, d: 1.2,
                db: -35 + p.off, lp: 650 * p.lp, partials: [[1, 1, 1], [2, 0.15, 0.5]] });
        };
        E.nanoQuestion = function (S, t) {
            feltNote(S, t, p, 'A4', -33, 0.45);
            feltNote(S, t + 0.24, p, 'C5', -33, 0.7);
        };
        E.nanoRelease = function (S, t) {
            S.tone({ t: t, f: S.note('G4'), to: S.note('D4'), glide: 0.7, a: 0.12, d: 0.9,
                db: -36 + p.off, lp: 600 * p.lp, partials: [[1, 1, 1]] });
        };
        return E;
    }

    // The bed on the Om pitch (D-192): C#3 with its octave and two upper
    // partials, soft triangle voices and pink air under 650 Hz.
    function feltBed(S, t) {
        return S.pad({ t: t, db: -32, type: 'triangle', lp: 700,
            voices: [['Cs3', 0.5, 0.051], ['Cs4', 0.35, 0.067], ['Gs4', 0.16, 0.083], ['Cs5', 0.1, 0.059]],
            noise: { color: 'pink', lp: 650, level: 0.2 } });
    }

    var PALETTES = {
        felt: { events: feltSet({ lp: 1, off: -2 }), bed: feltBed },
        feltNight: { events: feltSet({ lp: 0.7, off: -4 }), bed: feltBed }
    };

    /* ---- Manager ------------------------------------------------------ */

    class SoundManager {
        constructor() {
            this.audioContext = null;
            this.masterGain = null;
            this.limiter = null;
            this.isEnabled = true;
            this.isMuted = false;
            this.masterVolume = LEVELS.low;
            this.initialized = false;
            this.warmupDone = false;

            this.prefs = loadPrefs();
            this.masterVolume = LEVELS[this.prefs.level] || LEVELS.low;
            if (this.prefs.master === false) {
                this.isMuted = true;
            }

            // Ambient bed
            this.bedNodes = null;
            this.bedPlaying = false;
            this.bedScene = 'generic';
            this.wasBedPlaying = false;
            this.bedToken = null;

            // Recordings, one per palette and event (D-128).
            this.baked = {};
            this.baking = {};
            this.bakeQueue = [];
            this.bakeTimer = null;
            this.bakeFailed = false;
            this.intent = null;
            this.motifs = null;

            // Hero stepper position, for callers that do not pass one.
            this.stepIndex = 0;

            // When a press gesture last voiced its release.
            this.lastGestureAt = 0;

            // Bind methods so callers can pass them around.
            var self = this;
            ['init', 'warmup', 'play', 'playPressSound', 'playReleaseSound',
                'playSelectSound', 'playHoverSound', 'playTickSound', 'playPickSound',
                'playDropSound', 'playSuccessSound', 'playThemeDark', 'playThemeLight',
                'playLightsaberIgnite', 'playLightsaberRetract', 'playStepUp', 'playStepDown',
                'playStepperEnter', 'playStepperExit', 'playStepperArm', 'playRiser',
                'playMotif'].forEach(function (name) {
                self[name] = self[name].bind(self);
            });
        }

        /**
         * Readable prefs snapshot for toggle UI.
         */
        getPrefs() {
            return {
                master: this.prefs.master,
                bed: this.prefs.bed,
                motifs: this.prefs.motifs,
                level: this.prefs.level
            };
        }

        emitChange() {
            try {
                window.dispatchEvent(new CustomEvent('soundchange', {
                    detail: this.getPrefs()
                }));
            } catch { /* noop */ }
        }

        setMasterEnabled(on) {
            this.prefs.master = on === true;
            this.isMuted = !this.prefs.master;
            if (this.prefs.master === false) {
                this.stopBed(true);
                this.stopBaking();
            }
            savePrefs(this.prefs);
            this.emitChange();
            if (this.prefs.master) {
                this.init();
                this.warmup();
                this.resumeContext();
                this.bakeAll();
                if (this.prefs.bed) {
                    this.startBed();
                }
            }
            return this.prefs.master;
        }

        setBedEnabled(on) {
            this.prefs.bed = on === true;
            savePrefs(this.prefs);
            this.emitChange();
            if (this.prefs.bed && this.prefs.master) {
                this.startBed();
            } else {
                this.stopBed();
            }
            return this.prefs.bed;
        }

        setMotifsEnabled(on) {
            this.prefs.motifs = on === true;
            savePrefs(this.prefs);
            this.emitChange();
            return this.prefs.motifs;
        }

        setVolumeLevel(level) {
            this.prefs.level = level === 'med' ? 'med' : 'low';
            this.masterVolume = LEVELS[this.prefs.level];
            savePrefs(this.prefs);
            this.applyVolume();
            this.emitChange();
            return this.prefs.level;
        }

        /**
         * The one place the volume reaches the signal: the master gain.
         */
        applyVolume() {
            try {
                if (this.masterGain && this.audioContext) {
                    this.masterGain.gain.setTargetAtTime(
                        this.masterVolume,
                        this.audioContext.currentTime,
                        0.05
                    );
                }
            } catch { /* noop */ }
        }

        /**
         * Master bus. All voices route here so one mute silences all.
         */
        bus() {
            if (this.masterGain && this.audioContext) return this.masterGain;
            return this.audioContext ? this.audioContext.destination : null;
        }

        /**
         * The theme the page shows: the theme manager's chosen theme
         * first (during the theme toggle's view transition the attribute
         * lags it by a frame), then html[data-theme], then the system.
         */
        currentTheme() {
            try {
                var tm = window.themeManager;
                var pref = tm ? tm.userPreference : null;
                if (pref === 'light' || pref === 'dark') return pref;
            } catch { /* fall through */ }
            try {
                var attr = document.documentElement.getAttribute('data-theme');
                if (attr === 'light' || attr === 'dark') return attr;
            } catch { /* fall through */ }
            try {
                return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            } catch {
                return 'light';
            }
        }

        /**
         * Palette for the current theme: felt in light, the softer felt at night.
         */
        getPalette() {
            return THEME_PALETTE[this.currentTheme()] || 'felt';
        }

        /**
         * Initialize audio context. Called only on gesture or explicit enable.
         */
        init() {
            if (this.initialized) return;

            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) {
                    console.warn('Web Audio API not supported');
                    this.isEnabled = false;
                    return;
                }

                var ctx;
                try {
                    ctx = new AudioContext({ latencyHint: 'interactive' });
                } catch {
                    ctx = new AudioContext();
                }
                this.audioContext = ctx;

                // The volume is applied here and nowhere else.
                this.masterGain = ctx.createGain();
                this.masterGain.gain.value = this.masterVolume;

                // Safety limiter: piled-up voices never clip.
                var out = ctx.destination;
                try {
                    var lim = ctx.createDynamicsCompressor();
                    lim.threshold.value = -6;
                    lim.knee.value = 0;
                    lim.ratio.value = 20;
                    lim.attack.value = 0.001;
                    lim.release.value = 0.08;
                    lim.connect(ctx.destination);
                    this.limiter = lim;
                    out = lim;
                } catch { /* plays without the limiter */ }
                this.masterGain.connect(out);

                this.initialized = true;
                this.resumeContext();
            } catch (error) {
                console.warn('Failed to initialize audio context:', error);
                this.isEnabled = false;
            }
        }

        resumeContext() {
            var ctx = this.audioContext;
            if (!ctx || ctx.state !== 'suspended') return null;
            try {
                var p = ctx.resume();
                if (p && typeof p.then === 'function') {
                    p.then(noop, noop);
                    return p;
                }
            } catch { /* noop */ }
            return null;
        }

        /**
         * Warmup: make the noise once and play a silent tick so the first
         * real voice starts fast.
         */
        warmup() {
            if (this.warmupDone) return;
            if (!this.isEnabled) return;
            if (!this.initialized) this.init();
            const ctx = this.audioContext;
            if (!ctx) return;
            if (ctx.state !== 'running') return;

            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 1;
            gain.gain.value = 0;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.001);

            this.warmupDone = true;
        }

        canPlay() {
            if (!this.isEnabled) return false;
            if (this.prefs.master === false) return false;
            if (this.isMuted) return false;
            return true;
        }

        /**
         * Gate kept for older callers: true when the context runs now.
         * A suspended context is asked to resume.
         */
        ensureContext(allowWarmup) {
            if (!this.isEnabled) return false;
            if (this.prefs.master === false && allowWarmup !== true) return false;
            if (this.isMuted && allowWarmup !== true) return false;
            if (!this.initialized) this.init();
            this.resumeContext();
            return Boolean(this.audioContext && this.audioContext.state === 'running');
        }

        audible() {
            if (!this.canPlay()) return false;
            return this.ensureContext(false);
        }

        /**
         * Run fn with a running context. A suspended context is resumed
         * first instead of dropping the call. When fresh is true the call
         * is skipped if the resume takes longer than STALE_MS.
         */
        whenRunning(fn, fresh) {
            if (!this.isEnabled) return false;
            if (!this.initialized) this.init();
            const ctx = this.audioContext;
            if (!ctx) return false;
            if (ctx.state === 'running') {
                try { fn(ctx); } catch { /* a voice never breaks the page */ }
                return true;
            }
            if (ctx.state === 'closed') return false;
            const asked = Date.now();
            const go = function () {
                if (fresh && Date.now() - asked > STALE_MS) return;
                if (ctx.state !== 'running') return;
                try { fn(ctx); } catch { /* noop */ }
            };
            try {
                const p = ctx.resume();
                if (p && typeof p.then === 'function') p.then(go, noop);
                else go();
            } catch {
                return false;
            }
            return true;
        }

        /**
         * Render one event once into a buffer, off the main thread, for
         * replay. A context-free or failed render leaves the live path.
         */
        bake(paletteName, name) {
            var key = paletteName + '|' + name;
            if (this.bakeFailed || this.baked[key] || this.baking[key]) return false;
            var Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
            var palette = PALETTES[paletteName];
            var recipe = palette && palette.events[name];
            if (!Off || typeof recipe !== 'function') return false;
            var self = this;
            try {
                var octx = new Off(1, Math.ceil(BAKE_RATE * (BAKE_LEN[name] || 0.5)), BAKE_RATE);
                var bus = octx.createGain();
                bus.connect(octx.destination);
                recipe(kit(octx, bus, false), 0, {});
                this.baking[key] = true;
                var done = function (buf) {
                    delete self.baking[key];
                    if (buf) self.baked[key] = buf;
                };
                // One failed recording stops further tries: the live path
                // keeps playing, and no tap pays for a doomed render.
                var fail = function () { delete self.baking[key]; self.bakeFailed = true; };
                var pr = octx.startRendering();
                if (pr && typeof pr.then === 'function') pr.then(done, fail);
                else octx.oncomplete = function (e) { done(e && e.renderedBuffer); };
                return true;
            } catch {
                delete this.baking[key];
                this.bakeFailed = true;
                return false;
            }
        }

        /**
         * Queue a recording of every voiced event in both palettes, one
         * per idle moment, so switching sound on never blocks a frame.
         */
        bakeAll() {
            if (this.bakeFailed || this.bakeQueue.length) return;
            var self = this;
            Object.keys(PALETTES).forEach(function (pal) {
                Object.keys(PALETTES[pal].events).forEach(function (name) {
                    if (!self.baked[pal + '|' + name]) self.bakeQueue.push([pal, name]);
                });
            });
            this.bakeNext();
        }

        /** Sound switched off: drop the queue and cancel the next job. */
        stopBaking() {
            this.bakeQueue = [];
            if (this.bakeTimer) {
                try {
                    if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(this.bakeTimer);
                    clearTimeout(this.bakeTimer);
                } catch { /* noop */ }
                this.bakeTimer = null;
            }
        }

        bakeNext() {
            if (this.bakeTimer || !this.bakeQueue.length) return;
            var self = this;
            var step = function () {
                self.bakeTimer = null;
                var job = self.bakeQueue.shift();
                if (job) self.bake(job[0], job[1]);
                self.bakeNext();
            };
            if (typeof window.requestIdleCallback === 'function') {
                this.bakeTimer = window.requestIdleCallback(step, { timeout: 500 });
            } else {
                this.bakeTimer = setTimeout(step, 30);
            }
        }

        /**
         * Play one event from the current theme's palette: its recording
         * when ready, else live from the same recipe while the recording
         * is made. Returns false when it cannot play (muted, silent
         * event, no audio). pan is -1 to 1, applied only to recordings.
         */
        play(name, opts, pan) {
            if (!this.canPlay()) return false;
            const paletteName = this.getPalette();
            const palette = PALETTES[paletteName];
            const recipe = palette && palette.events[name];
            if (typeof recipe !== 'function') return false;
            const options = opts || {};
            const self = this;
            const key = paletteName + '|' + name;
            return this.whenRunning(function (ctx) {
                if (!self.canPlay()) return;
                let into = self.bus();
                if (typeof pan === 'number' && pan && typeof ctx.createStereoPanner === 'function') {
                    const pn = ctx.createStereoPanner();
                    pn.pan.value = Math.max(-1, Math.min(1, pan));
                    pn.connect(into);
                    into = pn;
                }
                const buf = self.baked[key];
                if (buf) {
                    const src = ctx.createBufferSource();
                    src.buffer = buf;
                    src.connect(into);
                    src.start(ctx.currentTime + 0.003);
                    return;
                }
                const voiceBus = ctx.createGain();
                voiceBus.connect(into);
                recipe(kit(ctx, voiceBus, false), ctx.currentTime + 0.003, options);
                self.bakeAll();
            }, true);
        }

        /** Pointer down on a pressable control; pan leans it to the tap (D-141). */
        playPressSound(pan) { return this.play('press', null, pan); }

        /** Let go of a pressable control, as it springs back. */
        playReleaseSound(pan) { return this.play('release', null, pan); }

        /**
         * A choice with no press of its own: press then release. Skipped
         * when a press gesture already voiced it a moment ago.
         */
        playSelectSound() {
            if (Date.now() - this.lastGestureAt < SELECT_ECHO_MS) return false;
            return this.play('select');
        }

        /**
         * Pointer enters something. Plays only when the visitor settles on
         * it (Balanced rule, D-194, pm/research-hover-intent-sound-2026-11-16.md):
         * a mouse, not touch; the pointer rests over the element for 300 ms
         * at under about 60 px/s; no scroll in the last 300 ms; at least
         * 1.2 s since the last hover sound, at most 6 a minute, and once
         * per element per minute. Fast travel and flicks stay silent.
         * Returns true when a check was scheduled.
         */
        playHoverSound(el) {
            if (!this.canPlay() || this.prefersReducedMotion()) return false;
            const I = this.intent;
            if (!I || I.pointerType !== 'mouse') return false;
            const self = this;
            const target = el || null;
            clearTimeout(I.timer);
            I.timer = setTimeout(function () {
                const now = Date.now();
                if (now - I.lastScroll < HOVER.quietAfterScroll) return;
                if (I.speed() > HOVER.maxSpeed) return;
                if (target && target.matches && !target.matches(':hover')) return;
                if (now - I.lastHover < HOVER.gap) return;
                I.recent = I.recent.filter(function (t) { return now - t < 60000; });
                if (I.recent.length >= HOVER.perMinute) return;
                if (target) {
                    const last = I.byEl.get(target);
                    if (last && now - last < HOVER.perElement) return;
                    I.byEl.set(target, now);
                }
                if (self.play('hover') !== false) {
                    I.lastHover = now;
                    I.recent.push(now);
                }
            }, HOVER.rest);
            return true;
        }

        /**
         * Watch the pointer cheaply: one passive pointermove storing the
         * last positions with their event timestamps, one passive scroll
         * stamp. No layout reads.
         */
        watchIntent() {
            if (this.intent) return;
            const I = {
                pointerType: '', samples: [], lastScroll: 0, lastHover: 0,
                recent: [], byEl: new WeakMap(), timer: null,
                speed: function () {
                    // Only movement inside the window counts: a pointer that
                    // stopped sends no events, so old samples mean "resting".
                    const now = performance.now();
                    const s = I.samples.filter(function (x) { return now - x.t <= HOVER.window; });
                    if (s.length < 2) return 0;
                    const a = s[0], b = s[s.length - 1];
                    const dt = (b.t - a.t) / 1000;
                    return dt > 0 ? Math.hypot(b.x - a.x, b.y - a.y) / dt : 0;
                }
            };
            this.intent = I;
            try {
                window.addEventListener('pointermove', function (e) {
                    I.pointerType = e.pointerType;
                    const t = e.timeStamp;
                    I.samples.push({ x: e.clientX, y: e.clientY, t: t });
                    while (I.samples.length > 2 && t - I.samples[0].t > HOVER.window) I.samples.shift();
                }, { passive: true });
                window.addEventListener('scroll', function () { I.lastScroll = Date.now(); }, { passive: true });
            } catch { /* intent stays empty: hover stays silent */ }
        }

        /** A card, sheet or row changes. Silent: passing, not doing. */
        playTickSound() { return this.play('tick'); }

        /**
         * Something picked up. Marks the gesture, so the click that a drag
         * ends in does not voice a select on top of it.
         */
        playPickSound() {
            var ok = this.play('pick');
            if (ok !== false) this.lastGestureAt = Date.now();
            return ok;
        }

        /** Something dropped or reset; also marks the gesture. */
        playDropSound() {
            var ok = this.play('drop');
            if (ok !== false) this.lastGestureAt = Date.now();
            return ok;
        }

        /** Copied, booked, switched on. */
        playSuccessSound() { return this.play('success'); }

        playThemeDark() { return this.play('themeDark'); }

        playThemeLight() { return this.play('themeLight'); }

        /** Theme to dark. Name kept for existing callers. */
        playLightsaberIgnite() { return this.playThemeDark(); }

        /** Theme to light. Name kept for existing callers. */
        playLightsaberRetract() { return this.playThemeLight(); }

        stepTo(index, dir) {
            var n = typeof index === 'number' && isFinite(index)
                ? Math.round(index)
                : this.stepIndex + dir;
            n = Math.max(0, Math.min(SCALE.length - 1, n));
            this.stepIndex = n;
            return n;
        }

        /**
         * Hero stepper back. Pass the line index when known; otherwise
         * the manager walks its own position down one note.
         */
        playStepUp(index) {
            var i = this.stepTo(index, -1);
            return this.play('stepUp', { i: i });
        }

        /**
         * Hero stepper forward, one note higher per line.
         */
        playStepDown(index) {
            var i = this.stepTo(index, 1);
            return this.play('stepDown', { i: i });
        }

        playStepperEnter() {
            this.stepIndex = 0;
            return this.play('stepperEnter');
        }

        playStepperExit() {
            return this.play('stepperExit');
        }

        playStepperArm() {
            return this.play('stepperEnter');
        }

        /**
         * Page change, once per navigation. Skipped under reduced motion.
         */
        playRiser() {
            if (this.prefersReducedMotion()) return false;
            return this.play('riser');
        }

        /**
         * Ambient bed from the current theme's palette. Starts only when
         * master and bed prefs are both on, never under reduced motion.
         */
        startBed() {
            if (this.prefs.master === false || this.prefs.bed === false) return;
            if (this.prefersReducedMotion()) {
                // Reduced motion visitors get interaction sounds only
                // when they opt in, never the continuous bed.
                return;
            }
            if (!this.canPlay()) return;
            if (this.bedPlaying) {
                this.setBedScene(this.bedScene);
                return;
            }
            const self = this;
            const token = {};
            this.bedToken = token;
            this.bedPlaying = true;
            const ok = this.whenRunning(function (ctx) {
                if (self.bedToken !== token) return;
                if (!self.canPlay() || !self.prefs.bed) {
                    self.bedPlaying = false;
                    return;
                }
                self.buildBed(ctx);
            }, false);
            if (!ok) {
                this.bedPlaying = false;
                this.bedToken = null;
            }
        }

        buildBed(ctx) {
            const name = this.getPalette();
            const palette = PALETTES[name];
            const bedBus = ctx.createGain();
            bedBus.connect(this.bus());
            const handle = palette.bed(kit(ctx, bedBus, false), ctx.currentTime + 0.01);
            this.bedNodes = { handle: handle, bus: bedBus, palette: name };
            this.bedPlaying = true;
            this.setBedScene(this.bedScene);
        }

        stopBed(immediate) {
            const nodes = this.bedNodes;
            this.bedToken = null;
            this.bedNodes = null;
            this.bedPlaying = false;
            if (!nodes || !this.audioContext) return;
            try {
                nodes.handle.stop(this.audioContext.currentTime, immediate === true);
            } catch { /* noop */ }
        }

        /**
         * A theme flip switches the bed to the new theme's palette.
         */
        onThemeChange() {
            if (!this.bedPlaying || !this.bedNodes) return;
            if (this.bedNodes.palette === this.getPalette()) return;
            this.stopBed(false);
            this.startBed();
        }

        /**
         * Shift the bed filter per section so rooms feel slightly
         * different without changing the notes.
         */
        setBedScene(name) {
            this.bedScene = SCENES[name] ? name : 'generic';
            const nodes = this.bedNodes;
            if (!this.bedPlaying || !nodes || !nodes.handle || !this.audioContext) return;
            try {
                var ratio = (SCENES[this.bedScene] || SCENES.generic) / SCENES.generic;
                nodes.handle.lp.frequency.setTargetAtTime(
                    nodes.handle.baseLp * ratio,
                    this.audioContext.currentTime,
                    0.6
                );
            } catch { /* noop */ }
        }

        /**
         * A section arrives ('arrive') or leaves ('leave') (D-192, reopening
         * D-146 on the owner's words). Calm by rule (D-129): the same section
         * at most once per 1.5 s, any two section sounds at least 0.35 s
         * apart, skipped while scrolling faster than about 3 screens a
         * second, silent under reduced motion. key names the section.
         */
        playMotif(kind, key) {
            if (kind !== 'arrive' && kind !== 'leave') return false;
            if (!this.canPlay() || this.prefersReducedMotion()) return false;
            const now = Date.now();
            const M = this.motifs || (this.motifs = { last: 0, byKey: {}, scrollY: 0, scrollAt: 0 });
            const y = window.scrollY || 0;
            const screens = M.scrollAt ? Math.abs(y - M.scrollY) / Math.max(1, window.innerHeight) / Math.max(0.001, (now - M.scrollAt) / 1000) : 0;
            M.scrollY = y;
            M.scrollAt = now;
            if (screens > MOTIF.maxScreensPerSecond) return false;
            if (now - M.last < MOTIF.gap) return false;
            const k = (key || 'section') + '|' + kind;
            if (M.byKey[k] && now - M.byKey[k] < MOTIF.perSection) return false;
            M.last = now;
            M.byKey[k] = now;
            return this.play(kind);
        }

        /**
         * The hero's nano loop entered a stage (D-207): search, form, drift,
         * question (the "?" word), release. Calm and curious; silent under
         * reduced motion and while the master switch is off.
         */
        playNano(stage) {
            if (this.prefersReducedMotion()) return false;
            const name = { search: 'nanoSearch', form: 'nanoForm', drift: 'nanoWonder', question: 'nanoQuestion', release: 'nanoRelease' }[stage];
            return name ? this.play(name) : false;
        }

        /**
         * Legacy mute toggle kept for compat. Master pref owns it now.
         */
        toggleMute() {
            return this.setMasterEnabled(!this.prefs.master) ? false : true;
        }

        /**
         * Set master volume (0 to 1). Kept for compat with older callers.
         */
        setVolume(volume) {
            this.masterVolume = Math.max(0, Math.min(1, volume));
            this.applyVolume();
        }

        /**
         * Check if reduced motion is preferred.
         */
        prefersReducedMotion() {
            try {
                return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            } catch {
                return false;
            }
        }
    }

    // Create global instance
    window.SoundManager = new SoundManager();
    try { window.SoundManager.watchIntent(); } catch { /* hover stays silent */ }

    // A theme flip moves the bed to the other palette. Voices pick their
    // palette when they play, so they follow on their own.
    window.addEventListener('themechange', function () {
        try { window.SoundManager.onThemeChange(); } catch { /* noop */ }
    });

    // Pause the bed when the tab hides, resume on return only if
    // the visitor had it playing. Interaction sounds stay gated
    // behind the master pref at all times.
    document.addEventListener('visibilitychange', function () {
        try {
            var sm = window.SoundManager;
            if (!sm || !sm.audioContext) return;
            if (document.hidden) {
                sm.wasBedPlaying = sm.bedPlaying === true;
                if (sm.bedPlaying) {
                    try {
                        var s = sm.audioContext.suspend();
                        if (s && s.then) s.then(noop, noop);
                    } catch { /* noop */ }
                }
            } else if (sm.wasBedPlaying && sm.prefs.master && sm.prefs.bed) {
                sm.resumeContext();
                sm.wasBedPlaying = false;
            }
        } catch { /* noop */ }
    });

    // Explicit opt in only. No eager warmup while master is off, so
    // first visit stays silent and creates no AudioContext. Once the
    // visitor enables sound, prime on the next gesture for fast taps.
    const primeOnGesture = () => {
        try {
            var sm = window.SoundManager;
            if (sm && sm.prefs.master) {
                sm.init();
                sm.warmup();
                sm.bakeAll();
            }
        } catch { /* noop */ }
    };

    document.addEventListener('mousemove', primeOnGesture, { once: true, passive: true });
    document.addEventListener('touchstart', primeOnGesture, { once: true, passive: true });
    document.addEventListener('keydown', primeOnGesture, { once: true, passive: true });
    document.addEventListener('click', function initOnce() {
        try {
            var sm = window.SoundManager;
            if (sm && sm.prefs.master && !sm.initialized) {
                sm.init();
                sm.warmup();
                sm.bakeAll();
            }
        } catch { /* noop */ }
    }, { once: true });

    // Press feedback on .btn and .pill-btn: the press sound lands on
    // pointer down with the squash, the release sound on let go as the
    // control springs back. Delegated, throttled, gated on master.
    // Never blocks the tap.
    (function wirePressSounds() {
        var lastPress = 0;
        var held = null;

        // Presses answer under reduced motion too: a silent press feels
        // broken (D-138). Only the master switch gates them.
        function ready() {
            var sm = window.SoundManager;
            if (!sm || !sm.prefs.master) return null;
            return sm;
        }

        // Gentle left-right lean from where the tap landed (D-141).
        function panAt(event) {
            try {
                var w = window.innerWidth || 0;
                if (!w || typeof event.clientX !== 'number') return 0;
                return Math.max(-1, Math.min(1, (event.clientX / w) * 2 - 1)) * 0.3;
            } catch {
                return 0;
            }
        }

        document.addEventListener('pointerdown', function (event) {
            try {
                if (typeof event.button === 'number' && event.button !== 0) return;
                var sm = ready();
                if (!sm) return;
                var target = event.target && event.target.closest
                    ? event.target.closest('.btn, .pill-btn')
                    : null;
                if (!target || target.disabled) return;
                var now = Date.now();
                if (now - lastPress < 120) return;
                var pan = panAt(event);
                if (sm.playPressSound(pan) === false) return;
                lastPress = now;
                held = { id: event.pointerId, pan: pan };
            } catch { /* press stays silent */ }
        }, { passive: true });

        document.addEventListener('pointerup', function (event) {
            try {
                if (!held || held.id !== event.pointerId) return;
                var pan = held.pan;
                held = null;
                var sm = ready();
                if (!sm) return;
                if (sm.playReleaseSound(pan) !== false) sm.lastGestureAt = Date.now();
            } catch { /* release stays silent */ }
        }, { passive: true });

        document.addEventListener('pointercancel', function (event) {
            if (held && held.id === event.pointerId) held = null;
        }, { passive: true });
    })();

})();
