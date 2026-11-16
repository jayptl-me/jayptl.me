/**
 * Sound Manager Component
 * Handmade Web Audio kit for the full site. Every voice is synthesized
 * at runtime from oscillators and noise generated in the page, so there
 * are zero audio files, zero downloads, and zero copyright risk.
 *
 * Two palettes, one per theme (D-73):
 * - Clay, the light theme: soft, damp, matte taps with a small body,
 *   clay mallet notes for states.
 * - Glass, the dark theme: a drop on press, a bubble on release, small
 *   glass bells for states.
 * The palette is chosen when a sound plays, from the theme the page is
 * showing, so a theme flip switches the whole set (the bed included).
 *
 * Score model, default off:
 * - Master switch gates every sound. Default off until the visitor
 *   taps sound on. Persisted in localStorage.
 * - Events: press (pointer down), release (let go), select, hover,
 *   tick, pick, drop, success, theme to dark, theme to light, stepper
 *   steps, stepper enter and exit, page riser, section motifs.
 * - Bed: a slow pad tuned to A4 = 432 Hz. Starts only after explicit
 *   opt in.
 *
 * Signal path: voice, voice bus, master gain (the volume, applied once
 * and only here), a limiter at -6 dBFS, speakers. Every envelope starts
 * at 0, falls to 60 dB under its own peak and reaches 0 before its
 * source stops, so no voice starts or ends on a step. Each play is
 * detuned within 7 cents, moved within 1 dB and has its filters moved
 * within 5 percent, so repeats never sound identical. One tuning
 * everywhere: A4 = 432 Hz, pentatonic.
 *
 * Safety: no autoplay. Context is created only on user gesture or on
 * explicit enable. A suspended context is resumed before a voice plays,
 * so the first sound after a pause is not dropped. Pauses the bed when
 * the tab hides. Under reduced motion the motifs, riser, press sounds
 * and bed stay silent.
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
        A5: 864.00, C6: 1027.47
    };

    var MOTIFS = {
        intro: ['E4', 'A4'],
        now: ['D4', 'G4'],
        work: ['C4', 'E4'],
        sticker: ['G4', 'C5'],
        about: ['A3', 'E4'],
        footer: ['E4', 'D4'],
        generic: ['C4', 'G4']
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
    // the loudest events peak near -18 dBFS; Low is the level they were
    // auditioned at, about 2 dB under that.
    var LEVELS = { low: 0.8, med: 1.0 };

    var THEME_PALETTE = { light: 'clay', dark: 'glass' };

    var VAR_CENTS = 7;
    var VAR_DB = 1.0;
    var VAR_FILTER = 0.05;

    // A sound asked for while the context resumes plays only if the
    // resume lands within this window, so nothing queues up and bursts.
    var STALE_MS = 300;

    // A select asked for this soon after a press gesture voiced its
    // release is the same gesture, already heard.
    var SELECT_ECHO_MS = 400;

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
        } catch (e) {
            return fallback;
        }
    }

    function savePrefs(prefs) {
        try {
            localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
        } catch (e) { /* storage is a bonus, never breaks sound */ }
    }

    function noop() { /* intentionally empty */ }

    /* ---- Synthesis kit ------------------------------------------------ */

    function db(x) { return Math.pow(10, x / 20); }
    function rnd(a, b) { return a + Math.random() * (b - a); }

    // White, pink and brown noise, two seconds each, made once per context.
    var noiseCache = { ctx: null, bufs: null };

    function noiseFor(ctx) {
        if (noiseCache.ctx === ctx && noiseCache.bufs) return noiseCache.bufs;
        var len = Math.floor(ctx.sampleRate * 2);
        var out = {};
        ['white', 'pink', 'brown'].forEach(function (kind) {
            var buf = ctx.createBuffer(1, len, ctx.sampleRate);
            var d = buf.getChannelData(0);
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
            out[kind] = buf;
        });
        noiseCache.ctx = ctx;
        noiseCache.bufs = out;
        return out;
    }

    // The toolkit every recipe receives as S.
    function kit(ctx, out, variation) {
        var v = variation === false ? 0 : 1;
        var noise = noiseFor(ctx);
        var S = { ctx: ctx, out: out, TUNE: TUNE, MOTIFS: MOTIFS, SCALE: SCALE, db: db };

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
            src.buffer = noise[o.color || 'white'];
            var g = ctx.createGain();
            g.connect(S.out);
            var into = filters(o, t, g);
            src.connect(into);
            var e = S.env(g.gain, t, a, S.lvl(o.db), o.d, o.hold);
            src.start(t, rnd(0, 1.5));
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
                n.buffer = noise[o.noise.color || 'pink'];
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
                        try { x.stop(when + tc * 8.5); } catch (e) { /* noop */ }
                    });
                }
            };
        };

        return S;
    }

    /* ---- Palette A, Clay: the light theme ----------------------------- */
    // Soft, damp, matte. A fingertip on fired clay: a dull tap with a
    // small wooden body, never a beep. Mallet notes only for states.

    function clayMallet(S, t, f, lvl, d) {
        // Soft clay marimba: a triangle body plus a short knock four times up.
        S.tone({ t: t, f: f, type: 'triangle', a: 0.003, d: d || 0.32, db: lvl, lp: 1800,
            partials: [[1, 1, 1], [3.98, 0.18, 0.12]] });
        S.noise({ t: t, color: 'pink', bp: 900, q: 0.8, d: 0.012, db: lvl - 12 });
    }

    var CLAY = {};
    CLAY.press = function (S, t) {
        S.noise({ t: t, bp: 1150, q: 1.1, d: 0.016, db: -14 });
        S.tone({ t: t, f: 320, to: 200, glide: 0.028, a: 0.0025, d: 0.05, db: -21, lp: 1000 });
    };
    CLAY.release = function (S, t) {
        S.noise({ t: t, bp: 2300, q: 1.4, d: 0.008, db: -21 });
        S.tone({ t: t, f: 410, to: 370, glide: 0.02, a: 0.002, d: 0.03, db: -29, lp: 1600 });
    };
    CLAY.select = function (S, t) { CLAY.press(S, t); CLAY.release(S, t + 0.095); };
    CLAY.hover = function (S, t) {
        S.noise({ t: t, hp: 2500, bp: 4200, q: 0.9, d: 0.006, db: -24 });
    };
    CLAY.tick = function (S, t) {
        S.noise({ t: t, bp: 2600, q: 2.5, d: 0.009, db: -18 });
        // A5 of the 432 table, so the faint pitch stays in tune with the motifs.
        S.tone({ t: t, f: S.note('A5'), a: 0.0015, d: 0.014, db: -36, lp: 2000 });
    };
    CLAY.pick = function (S, t) {
        S.noise({ t: t, bp: 1400, q: 1, d: 0.014, db: -18 });
        S.tone({ t: t, f: 260, to: 390, glide: 0.045, a: 0.004, d: 0.07, db: -22, lp: 1200 });
    };
    CLAY.drop = function (S, t) {
        S.tone({ t: t, f: 340, to: 190, glide: 0.05, a: 0.003, d: 0.11, db: -21, lp: 900 });
        S.noise({ t: t, color: 'pink', lp: 700, d: 0.045, db: -20 });
    };
    CLAY.success = function (S, t) {
        clayMallet(S, t, S.note('G4'), -21, 0.36);
        clayMallet(S, t + 0.075, S.note('D5'), -22, 0.42);
    };
    CLAY.themeDark = function (S, t) {
        S.noise({ t: t, color: 'pink', lp: 1900, sweep: { on: 'lp', to: 260, dur: 0.38 }, a: 0.05, d: 0.36, db: -17 });
        // Sinks to A2 of the 432 table, not the 110 Hz A of the other tuning.
        S.tone({ t: t, f: 180, to: S.note('A2'), glide: 0.3, a: 0.02, d: 0.32, db: -30, lp: 700 });
        clayMallet(S, t + 0.03, S.note('E4'), -27, 0.3);
    };
    CLAY.themeLight = function (S, t) {
        S.noise({ t: t, color: 'pink', lp: 350, sweep: { on: 'lp', to: 2600, dur: 0.3 }, a: 0.12, d: 0.24, db: -17 });
        S.tone({ t: t + 0.06, f: 288, to: 432, glide: 0.25, a: 0.04, d: 0.25, db: -27, lp: 1400 });
    };
    CLAY.stepDown = function (S, t, o) { clayMallet(S, t, S.note(S.SCALE[o.i || 0]), -22, 0.26); };
    CLAY.stepUp = function (S, t, o) { clayMallet(S, t, S.note(S.SCALE[o.i || 0]), -24, 0.2); };
    CLAY.stepperEnter = function (S, t) {
        clayMallet(S, t, S.note('A3'), -23, 0.3);
        clayMallet(S, t + 0.09, S.note('E4'), -24, 0.34);
        S.noise({ t: t, color: 'pink', lp: 1200, a: 0.06, d: 0.2, db: -28 });
    };
    CLAY.stepperExit = function (S, t) {
        clayMallet(S, t, S.note('E4'), -24, 0.28);
        clayMallet(S, t + 0.09, S.note('A3'), -24, 0.32);
        S.noise({ t: t, color: 'pink', lp: 1200, sweep: { on: 'lp', to: 300, dur: 0.3 }, a: 0.03, d: 0.3, db: -26 });
    };
    CLAY.riser = function (S, t) {
        S.noise({ t: t, color: 'pink', bp: 500, q: 0.9, sweep: { on: 'bp', to: 2000, dur: 0.36 }, a: 0.22, d: 0.2, db: -12 });
    };
    CLAY.motif = function (S, t, o) {
        var pair = S.MOTIFS[o.name] || S.MOTIFS.generic;
        clayMallet(S, t, S.note(pair[0]), -25, 0.5);
        clayMallet(S, t + 0.17, S.note(pair[1]), -25, 0.55);
    };

    function clayBed(S, t) {
        return S.pad({ t: t, db: -30, type: 'triangle', lp: 900,
            voices: [['A3', 0.5, 0.051], ['E4', 0.35, 0.067], ['A4', 0.22, 0.083]],
            noise: { color: 'pink', lp: 650, level: 0.25 } });
    }

    /* ---- Palette B, Glass: the dark theme ----------------------------- */
    // Clear and wet. A drop pressing in on press, a bubble letting go on
    // release, small glass bells for states.

    function glassBell(S, t, f, lvl, d) {
        // Small glass bar: inharmonic partials 1, 2.76, 5.40, the upper ones die first.
        return S.tone({ t: t, f: f, a: 0.0015, d: d, db: lvl, lp: 6000,
            partials: [[1, 1, 1], [2.76, 0.35, 0.35], [5.40, 0.12, 0.15]] });
    }

    var GLASS = {};
    GLASS.press = function (S, t) {
        // A drop pressing in: pitch falls fast.
        S.tone({ t: t, f: 1150, to: 620, glide: 0.02, a: 0.0015, d: 0.045, db: -20, lp: 5000 });
        S.noise({ t: t, hp: 5000, d: 0.003, db: -30 });
    };
    GLASS.release = function (S, t) {
        // A bubble letting go: pitch rises, like a real bubble.
        S.tone({ t: t, f: 680, to: 1250, glide: 0.025, a: 0.0015, d: 0.04, db: -26, lp: 5000 });
    };
    GLASS.select = function (S, t) { GLASS.press(S, t); GLASS.release(S, t + 0.09); };
    GLASS.hover = function (S, t) { glassBell(S, t, S.note('C6'), -36, 0.04); };
    GLASS.tick = function (S, t) { glassBell(S, t, S.note('G5'), -30, 0.06); };
    GLASS.pick = function (S, t) {
        S.tone({ t: t, f: 480, to: 1100, glide: 0.035, a: 0.002, d: 0.07, db: -22, lp: 5000 });
    };
    GLASS.drop = function (S, t) {
        S.tone({ t: t, f: 1000, to: 330, glide: 0.04, a: 0.0015, d: 0.09, db: -21, lp: 4000 });
        S.noise({ t: t + 0.01, lp: 1500, d: 0.02, db: -26 });
    };
    GLASS.success = function (S, t) {
        glassBell(S, t, S.note('C5'), -21, 0.55);
        glassBell(S, t + 0.08, S.note('G5'), -23, 0.7);
    };
    GLASS.themeDark = function (S, t) {
        // Pouring down into the glass: three bells falling, a swish under them.
        glassBell(S, t, S.note('G5'), -24, 0.5);
        glassBell(S, t + 0.07, S.note('E5'), -24, 0.5);
        glassBell(S, t + 0.14, S.note('C5'), -23, 0.55);
        S.noise({ t: t, bp: 3500, q: 1.2, sweep: { on: 'bp', to: 900, dur: 0.3 }, a: 0.03, d: 0.3, db: -24 });
    };
    GLASS.themeLight = function (S, t) {
        glassBell(S, t, S.note('C5'), -24, 0.45);
        glassBell(S, t + 0.07, S.note('E5'), -24, 0.45);
        glassBell(S, t + 0.14, S.note('G5'), -24, 0.55);
        S.noise({ t: t, bp: 900, q: 1.2, sweep: { on: 'bp', to: 3500, dur: 0.3 }, a: 0.05, d: 0.28, db: -24 });
    };
    GLASS.stepDown = function (S, t, o) { glassBell(S, t, S.note(S.SCALE[o.i || 0]) * 2, -24, 0.28); };
    GLASS.stepUp = function (S, t, o) { glassBell(S, t, S.note(S.SCALE[o.i || 0]) * 2, -26, 0.22); };
    GLASS.stepperEnter = function (S, t) {
        S.tone({ t: t, f: 400, to: 900, glide: 0.05, a: 0.002, d: 0.09, db: -24, lp: 5000 });
        glassBell(S, t + 0.06, S.note('A5'), -26, 0.4);
    };
    GLASS.stepperExit = function (S, t) {
        glassBell(S, t, S.note('A5'), -26, 0.3);
        S.tone({ t: t + 0.05, f: 900, to: 300, glide: 0.05, a: 0.002, d: 0.1, db: -24, lp: 4000 });
    };
    GLASS.riser = function (S, t) {
        S.noise({ t: t, bp: 800, q: 2.2, sweep: { on: 'bp', to: 4000, dur: 0.38 }, a: 0.24, d: 0.18, db: -15 });
    };
    GLASS.motif = function (S, t, o) {
        var pair = S.MOTIFS[o.name] || S.MOTIFS.generic;
        glassBell(S, t, S.note(pair[0]) * 2, -26, 0.6);
        glassBell(S, t + 0.17, S.note(pair[1]) * 2, -26, 0.7);
    };

    function glassBed(S, t) {
        return S.pad({ t: t, db: -34, type: 'sine', lp: 3000,
            voices: [['A4', 0.5, 0.06], ['E5', 0.3, 0.083], ['A5', 0.15, 0.1]],
            noise: { color: 'white', hp: 2500, lp: 6000, level: 0.04 } });
    }

    var PALETTES = {
        clay: { events: CLAY, bed: clayBed },
        glass: { events: GLASS, bed: glassBed }
    };

    /* ---- Manager ------------------------------------------------------ */

    class SoundManager {
        constructor() {
            this.audioContext = null;
            this.masterGain = null;
            this.motifGain = null;
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

            // Motif throttling
            this.lastMotifAt = 0;
            this.lastMotifPerSection = {};
            this.motifCooldownMs = 8000;
            this.motifGlobalMs = 1200;

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
            } catch (e) { /* noop */ }
        }

        setMasterEnabled(on) {
            this.prefs.master = on === true;
            this.isMuted = !this.prefs.master;
            if (this.prefs.master === false) {
                this.stopBed(true);
            }
            savePrefs(this.prefs);
            this.emitChange();
            if (this.prefs.master) {
                this.init();
                this.warmup();
                this.resumeContext();
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
            } catch (e) { /* noop */ }
        }

        /**
         * Master bus. All voices route here so one mute silences all.
         */
        bus() {
            if (this.masterGain && this.audioContext) return this.masterGain;
            return this.audioContext ? this.audioContext.destination : null;
        }

        motifBus() {
            if (this.motifGain && this.audioContext) return this.motifGain;
            return this.bus();
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
            } catch (e) { /* fall through */ }
            try {
                var attr = document.documentElement.getAttribute('data-theme');
                if (attr === 'light' || attr === 'dark') return attr;
            } catch (e) { /* fall through */ }
            try {
                return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            } catch (e) {
                return 'light';
            }
        }

        /**
         * Palette for the current theme: clay in light, glass in dark.
         */
        getPalette() {
            return THEME_PALETTE[this.currentTheme()] || 'clay';
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
                } catch (e) {
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
                } catch (e) { /* plays without the limiter */ }
                this.masterGain.connect(out);

                this.motifGain = ctx.createGain();
                this.motifGain.gain.value = 1.0;
                this.motifGain.connect(this.masterGain);

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
            } catch (e) { /* noop */ }
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
            try { noiseFor(ctx); } catch (e) { /* made on first play instead */ }
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
                try { fn(ctx); } catch (e) { /* a voice never breaks the page */ }
                return true;
            }
            if (ctx.state === 'closed') return false;
            const asked = Date.now();
            const go = function () {
                if (fresh && Date.now() - asked > STALE_MS) return;
                if (ctx.state !== 'running') return;
                try { fn(ctx); } catch (e) { /* noop */ }
            };
            try {
                const p = ctx.resume();
                if (p && typeof p.then === 'function') p.then(go, noop);
                else go();
            } catch (e) {
                return false;
            }
            return true;
        }

        /**
         * Play one event from the current theme's palette.
         * Returns false when it cannot play (muted, unknown, no audio).
         */
        play(name, opts, busName) {
            if (!this.canPlay()) return false;
            const palette = PALETTES[this.getPalette()];
            const recipe = palette && palette.events[name];
            if (typeof recipe !== 'function') return false;
            const options = opts || {};
            const self = this;
            return this.whenRunning(function (ctx) {
                if (!self.canPlay()) return;
                const voiceBus = ctx.createGain();
                voiceBus.connect(busName === 'motif' ? self.motifBus() : self.bus());
                recipe(kit(ctx, voiceBus, true), ctx.currentTime + 0.003, options);
            }, true);
        }

        /** Pointer down on a pressable control. */
        playPressSound() { return this.play('press'); }

        /** Let go of a pressable control, as it springs back. */
        playReleaseSound() { return this.play('release'); }

        /**
         * A choice with no press of its own: press then release. Skipped
         * when a press gesture already voiced it a moment ago.
         */
        playSelectSound() {
            if (Date.now() - this.lastGestureAt < SELECT_ECHO_MS) return false;
            return this.play('select');
        }

        /** Pointer enters. */
        playHoverSound() { return this.play('hover'); }

        /** A card, sheet or row changes. */
        playTickSound() { return this.play('tick'); }

        /** Something picked up. */
        playPickSound() { return this.play('pick'); }

        /** Something dropped or reset. */
        playDropSound() { return this.play('drop'); }

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
            } catch (e) { /* noop */ }
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
            } catch (e) { /* noop */ }
        }

        /**
         * Two note motif per section, from the current palette. Throttled
         * per section and globally. Master plus motifs prefs must both be
         * on. Silent under reduced motion.
         */
        playMotif(name) {
            if (!this.canPlay()) return false;
            if (this.prefs.motifs === false) return false;
            if (this.prefersReducedMotion()) return false;

            var key = MOTIFS[name] ? name : 'generic';
            var nowMs = Date.now();
            if (nowMs - this.lastMotifAt < this.motifGlobalMs) return false;
            var lastForSection = this.lastMotifPerSection[key] || 0;
            if (nowMs - lastForSection < this.motifCooldownMs) return false;

            if (!this.play('motif', { name: key }, 'motif')) return false;
            this.lastMotifAt = nowMs;
            this.lastMotifPerSection[key] = nowMs;
            return true;
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
            } catch (e) {
                return false;
            }
        }
    }

    // Create global instance
    window.SoundManager = new SoundManager();

    // A theme flip moves the bed to the other palette. Voices pick their
    // palette when they play, so they follow on their own.
    window.addEventListener('themechange', function () {
        try { window.SoundManager.onThemeChange(); } catch (e) { /* noop */ }
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
                    } catch (e) { /* noop */ }
                }
            } else if (sm.wasBedPlaying && sm.prefs.master && sm.prefs.bed) {
                sm.resumeContext();
                sm.wasBedPlaying = false;
            }
        } catch (e) { /* noop */ }
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
            }
        } catch (e) { /* noop */ }
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
            }
        } catch (e) { /* noop */ }
    }, { once: true });

    // Press feedback on .btn and .pill-btn: the press sound lands on
    // pointer down with the squash, the release sound on let go as the
    // control springs back. Delegated, throttled, gated on master,
    // skipped under reduced motion. Never blocks the tap.
    (function wirePressSounds() {
        var lastPress = 0;
        var held = null;

        function ready() {
            var sm = window.SoundManager;
            if (!sm || !sm.prefs.master) return null;
            if (sm.prefersReducedMotion()) return null;
            return sm;
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
                if (sm.playPressSound() === false) return;
                lastPress = now;
                held = { id: event.pointerId };
            } catch (ignore) { /* press stays silent */ }
        }, { passive: true });

        document.addEventListener('pointerup', function (event) {
            try {
                if (!held || held.id !== event.pointerId) return;
                held = null;
                var sm = ready();
                if (!sm) return;
                if (sm.playReleaseSound() !== false) sm.lastGestureAt = Date.now();
            } catch (ignore) { /* release stays silent */ }
        }, { passive: true });

        document.addEventListener('pointercancel', function (event) {
            if (held && held.id === event.pointerId) held = null;
        }, { passive: true });
    })();

})();
