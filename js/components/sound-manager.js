/**
 * Sound Manager Component
 * Handmade Web Audio kit for the full site. All tones are synthesized
 * at runtime with oscillators and filters, so there are zero audio
 * files, zero downloads, and zero copyright risk.
 *
 * Full score model, default off:
 * - Master switch gates every sound. Default off until the visitor
 *   taps sound on. Persisted in localStorage.
 * - Interaction kit: select, hover, lightsaber ignite and retract,
 *   stepper enter and exit, button press.
 * - Serene bed: soft procedural pad tuned around A4 432 Hz with
 *   pentatonic intervals only. Starts only after explicit opt in.
 * - Motifs: short two note chimes per section, very quiet, throttled.
 *
 * Safety: no autoplay. Context is created only on user gesture or on
 * explicit enable. Pauses when the tab hides. Honors reduced motion
 * by silencing motifs and softening the bed.
 *
 * @file components/sound-manager.js
 * @author Jay Patel
 */

(function () {
    'use strict';

    var PREFS_KEY = 'jayptl.sound.prefs.v1';

    // Serene tuning, A4 ref 432 Hz. Pentatonic only, all pure sines.
    var TUNE = {
        A3: 216.00,
        C4: 256.87,
        D4: 288.33,
        E4: 323.63,
        G4: 384.87,
        A4: 432.00,
        C5: 513.74
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

    var SCENES = {
        intro: 420,
        now: 380,
        work: 480,
        sticker: 520,
        about: 360,
        footer: 340,
        generic: 400
    };

    var LEVELS = { low: 0.12, med: 0.20 };

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

    class SoundManager {
        constructor() {
            this.audioContext = null;
            this.masterGain = null;
            this.motifGain = null;
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

            // Ambient bed nodes
            this.bedNodes = null;
            this.bedPlaying = false;
            this.bedScene = 'generic';
            this.wasBedPlaying = false;

            // Motif throttling
            this.lastMotifAt = 0;
            this.lastMotifPerSection = {};
            this.motifCooldownMs = 8000;
            this.motifGlobalMs = 1200;

            // Bind methods
            this.init = this.init.bind(this);
            this.warmup = this.warmup.bind(this);
            this.playSelectSound = this.playSelectSound.bind(this);
            this.playHoverSound = this.playHoverSound.bind(this);
            this.playLightsaberIgnite = this.playLightsaberIgnite.bind(this);
            this.playLightsaberRetract = this.playLightsaberRetract.bind(this);
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
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    try { this.audioContext.resume(); } catch (e) { /* noop */ }
                }
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
            try {
                if (this.masterGain && this.audioContext) {
                    this.masterGain.gain.setTargetAtTime(
                        this.masterVolume,
                        this.audioContext.currentTime,
                        0.05
                    );
                }
            } catch (e) { /* noop */ }
            this.emitChange();
            return this.prefs.level;
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

                this.audioContext = new AudioContext();
                this.masterGain = this.audioContext.createGain();
                this.masterGain.gain.value = this.masterVolume;
                this.masterGain.connect(this.audioContext.destination);

                this.motifGain = this.audioContext.createGain();
                this.motifGain.gain.value = 1.0;
                this.motifGain.connect(this.masterGain);

                this.initialized = true;

                if (this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }
            } catch (error) {
                console.warn('Failed to initialize audio context:', error);
                this.isEnabled = false;
            }
        }

        /**
         * Warmup with a silent tick so the first real tone starts fast.
         */
        warmup() {
            if (this.warmupDone || !this.ensureContext(true)) return;

            const ctx = this.audioContext;
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

        /**
         * Gate every voice. Master off means silence. When allowWarmup
         * is true, init is allowed without audible output.
         */
        ensureContext(allowWarmup) {
            if (!this.isEnabled) return false;
            if (this.prefs.master === false && allowWarmup !== true) return false;
            if (this.isMuted && allowWarmup !== true) return false;

            if (!this.initialized) {
                this.init();
            }

            if (this.audioContext && this.audioContext.state === 'suspended') {
                if (allowWarmup === true || this.prefs.master) {
                    try { this.audioContext.resume(); } catch (e) { /* noop */ }
                } else {
                    return false;
                }
            }

            return Boolean(this.audioContext && this.audioContext.state === 'running');
        }

        audible() {
            if (!this.isEnabled) return false;
            if (this.prefs.master === false) return false;
            if (this.isMuted) return false;
            return this.ensureContext(false);
        }

        /**
         * Small helper for single soft tones. Keeps every interaction
         * voice consistent: sine, lowpass, short envelope.
         */
        tone(freq, dur, volScale, filterFreq) {
            const ctx = this.audioContext;
            const now = ctx.currentTime;
            const out = this.bus();
            if (!out) return;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);

            filter.type = 'lowpass';
            filter.frequency.value = filterFreq || 1800;
            filter.Q.value = 0.5;

            const vol = this.masterVolume * volScale;
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(vol, now + 0.008);
            gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(out);

            osc.start(now);
            osc.stop(now + dur + 0.05);
        }

        /**
         * Play a sleek selection click.
         */
        playSelectSound() {
            if (!this.audible()) return;
            this.tone(1800, 0.06, 0.4, 2400);
        }

        /**
         * Play a subtle hover tick.
         */
        playHoverSound() {
            if (!this.audible()) return;

            const ctx = this.audioContext;
            const now = ctx.currentTime;
            const out = this.bus();
            if (!out) return;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(2000, now);
            osc.frequency.exponentialRampToValueAtTime(2800, now + 0.02);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(this.masterVolume * 0.2, now + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

            osc.connect(gain);
            gain.connect(out);

            osc.start(now);
            osc.stop(now + 0.06);
        }

        /**
         * Lightsaber ignite, dark mode on. Smooth rising sweep.
         */
        playLightsaberIgnite() {
            if (!this.audible()) return;

            const ctx = this.audioContext;
            const now = ctx.currentTime;
            const out = this.bus();
            if (!out) return;
            const volume = this.masterVolume * 0.6;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
            osc.frequency.exponentialRampToValueAtTime(660, now + 0.18);

            filter.type = 'lowpass';
            filter.frequency.value = 2000;
            filter.Q.value = 0.7;

            gain.gain.setValueAtTime(0.001, now);
            gain.gain.exponentialRampToValueAtTime(volume, now + 0.025);
            gain.gain.exponentialRampToValueAtTime(volume * 0.6, now + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(out);

            osc.start(now);
            osc.stop(now + 0.25);
        }

        /**
         * Lightsaber retract, light mode on. Smooth falling sweep.
         */
        playLightsaberRetract() {
            if (!this.audible()) return;

            const ctx = this.audioContext;
            const now = ctx.currentTime;
            const out = this.bus();
            if (!out) return;
            const volume = this.masterVolume * 0.5;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(660, now);
            osc.frequency.exponentialRampToValueAtTime(220, now + 0.12);
            osc.frequency.exponentialRampToValueAtTime(110, now + 0.2);

            filter.type = 'lowpass';
            filter.frequency.value = 1500;
            filter.Q.value = 0.7;

            gain.gain.setValueAtTime(volume, now);
            gain.gain.exponentialRampToValueAtTime(volume * 0.5, now + 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(out);

            osc.start(now);
            osc.stop(now + 0.22);
        }

        /**
         * Soft ascending breeze for stepper up.
         */
        playStepUp() {
            if (!this.audible()) return;

            const ctx = this.audioContext;
            const now = ctx.currentTime;
            const out = this.bus();
            if (!out) return;
            const volume = this.masterVolume * 0.18;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.exponentialRampToValueAtTime(260, now + 0.12);

            filter.type = 'lowpass';
            filter.frequency.value = 400;
            filter.Q.value = 0.3;

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(volume, now + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(out);

            osc.start(now);
            osc.stop(now + 0.16);
        }

        /**
         * Soft descending breeze for stepper down.
         */
        playStepDown() {
            if (!this.audible()) return;

            const ctx = this.audioContext;
            const now = ctx.currentTime;
            const out = this.bus();
            if (!out) return;
            const volume = this.masterVolume * 0.18;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(240, now);
            osc.frequency.exponentialRampToValueAtTime(160, now + 0.12);

            filter.type = 'lowpass';
            filter.frequency.value = 380;
            filter.Q.value = 0.3;

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(volume, now + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(out);

            osc.start(now);
            osc.stop(now + 0.16);
        }

        /**
         * Simple soft chime for stepper enter.
         */
        playStepperEnter() {
            if (!this.audible()) return;

            const ctx = this.audioContext;
            const now = ctx.currentTime;
            const out = this.bus();
            if (!out) return;
            const volume = this.masterVolume * 0.1;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(volume, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            osc.connect(gain);
            gain.connect(out);

            osc.start(now);
            osc.stop(now + 0.18);
        }

        playStepperExit() {
            this.playStepperEnter();
        }

        playStepperArm() {
            this.playStepperEnter();
        }

        /**
         * Soft riser for page transitions. Master gated, skipped
         * under reduced motion.
         */
        playRiser() {
            if (!this.audible()) return;
            if (this.prefersReducedMotion()) return;

            const ctx = this.audioContext;
            const now = ctx.currentTime;
            const out = this.bus();
            if (!out) return;
            const volume = this.masterVolume * 0.25;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(900, now + 0.32);

            filter.type = 'lowpass';
            filter.frequency.value = 2000;
            filter.Q.value = 0.6;

            gain.gain.setValueAtTime(0.001, now);
            gain.gain.exponentialRampToValueAtTime(volume, now + 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(out);

            osc.start(now);
            osc.stop(now + 0.4);
        }

        /**
         * Serene ambient bed. Two detuned sines on A3 plus E4 with soft
         * filtered noise, slow swell LFO. Very low gain by design.
         * Starts only when master and bed prefs are both on.
         */
        startBed() {
            if (this.prefs.master === false || this.prefs.bed === false) return;
            if (this.prefersReducedMotion()) {
                // Reduced motion visitors get interaction sounds only
                // when they opt in, never the continuous bed.
                return;
            }
            if (!this.ensureContext(false)) {
                // Context needs a gesture. The toggle tap that enabled
                // the bed counts, so retry once on next tick.
                var self = this;
                setTimeout(function () {
                    if (self.prefs.master && self.prefs.bed && !self.bedPlaying) {
                        self.startBed();
                    }
                }, 400);
                return;
            }
            if (this.bedPlaying) {
                this.setBedScene(this.bedScene);
                return;
            }

            const ctx = this.audioContext;
            const now = ctx.currentTime;

            const bedGain = ctx.createGain();
            bedGain.gain.value = 0;
            bedGain.connect(this.bus());

            const bedFilter = ctx.createBiquadFilter();
            bedFilter.type = 'lowpass';
            bedFilter.frequency.value = SCENES[this.bedScene] || SCENES.generic;
            bedFilter.Q.value = 0.4;
            bedFilter.connect(bedGain);

            const oscA = ctx.createOscillator();
            oscA.type = 'sine';
            oscA.frequency.value = TUNE.A3;
            const gainA = ctx.createGain();
            gainA.gain.value = 0.5;
            oscA.connect(gainA);
            gainA.connect(bedFilter);

            const oscB = ctx.createOscillator();
            oscB.type = 'sine';
            oscB.frequency.value = TUNE.E4;
            oscB.detune.value = 4;
            const gainB = ctx.createGain();
            gainB.gain.value = 0.32;
            oscB.connect(gainB);
            gainB.connect(bedFilter);

            // Soft air: looped noise buffer through low gain into the bed.
            const noiseGain = ctx.createGain();
            noiseGain.gain.value = 0.10;
            var noiseSrc = null;
            try {
                const len = Math.floor(ctx.sampleRate * 2);
                const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (var i = 0; i < len; i++) {
                    data[i] = (Math.random() * 2 - 1) * 0.5;
                }
                noiseSrc = ctx.createBufferSource();
                noiseSrc.buffer = buffer;
                noiseSrc.loop = true;
                noiseSrc.connect(noiseGain);
                noiseGain.connect(bedFilter);
            } catch (e) {
                noiseSrc = null;
            }

            // Slow swell so the bed breathes instead of droning.
            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.07;
            const lfoGain = ctx.createGain();
            lfoGain.gain.value = 0.008;
            lfo.connect(lfoGain);
            try {
                lfoGain.connect(bedGain.gain);
            } catch (e) { /* older engines ignore audio param fan in */ }

            oscA.start(now);
            oscB.start(now);
            if (noiseSrc) {
                try { noiseSrc.start(now); } catch (e) { /* noop */ }
            }
            lfo.start(now);

            var target = this.prefs.level === 'med' ? 0.035 : 0.026;
            bedGain.gain.setTargetAtTime(target, now, 1.2);

            this.bedNodes = {
                oscA: oscA,
                oscB: oscB,
                noiseSrc: noiseSrc,
                bedFilter: bedFilter,
                bedGain: bedGain,
                lfo: lfo
            };
            this.bedPlaying = true;
        }

        stopBed(immediate) {
            if (!this.bedPlaying || !this.bedNodes) {
                this.bedPlaying = false;
                this.bedNodes = null;
                return;
            }
            try {
                const ctx = this.audioContext;
                const now = ctx ? ctx.currentTime : 0;
                var nodes = this.bedNodes;
                this.bedNodes = null;
                this.bedPlaying = false;
                if (ctx && immediate !== true) {
                    nodes.bedGain.gain.setTargetAtTime(0, now, 0.25);
                    setTimeout(function () {
                        try { nodes.oscA.stop(); } catch (e) { /* noop */ }
                        try { nodes.oscB.stop(); } catch (e) { /* noop */ }
                        try { if (nodes.noiseSrc) nodes.noiseSrc.stop(); } catch (e) { /* noop */ }
                        try { nodes.lfo.stop(); } catch (e) { /* noop */ }
                        try { nodes.bedGain.disconnect(); } catch (e) { /* noop */ }
                    }, 900);
                } else {
                    try { nodes.oscA.stop(); } catch (e) { /* noop */ }
                    try { nodes.oscB.stop(); } catch (e) { /* noop */ }
                    try { if (nodes.noiseSrc) nodes.noiseSrc.stop(); } catch (e) { /* noop */ }
                    try { nodes.lfo.stop(); } catch (e) { /* noop */ }
                    try { nodes.bedGain.disconnect(); } catch (e) { /* noop */ }
                }
            } catch (e) {
                this.bedPlaying = false;
                this.bedNodes = null;
            }
        }

        /**
         * Shift the bed filter per section so rooms feel slightly
         * different without changing the notes.
         */
        setBedScene(name) {
            this.bedScene = SCENES[name] ? name : 'generic';
            if (!this.bedPlaying || !this.bedNodes || !this.audioContext) return;
            try {
                var freq = SCENES[this.bedScene] || SCENES.generic;
                this.bedNodes.bedFilter.frequency.setTargetAtTime(
                    freq,
                    this.audioContext.currentTime,
                    0.6
                );
            } catch (e) { /* noop */ }
        }

        /**
         * Two note motif per section. Pentatonic only, very quiet,
         * throttled per section and globally. Master plus motifs
         * prefs must both be on. Silent under reduced motion.
         */
        playMotif(name) {
            if (!this.audible()) return;
            if (this.prefs.motifs === false) return;
            if (this.prefersReducedMotion()) return;

            var key = MOTIFS[name] ? name : 'generic';
            var nowMs = Date.now();
            if (nowMs - this.lastMotifAt < this.motifGlobalMs) return;
            var lastForSection = this.lastMotifPerSection[key] || 0;
            if (nowMs - lastForSection < this.motifCooldownMs) return;

            var pair = MOTIFS[key];
            var first = TUNE[pair[0]] || TUNE.C4;
            var second = TUNE[pair[1]] || TUNE.G4;

            const ctx = this.audioContext;
            const now = ctx.currentTime;
            const out = this.motifBus() || this.bus();
            if (!out) return;

            this.lastMotifAt = nowMs;
            this.lastMotifPerSection[key] = nowMs;

            var self = this;
            function chime(freq, at, dur) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const filter = ctx.createBiquadFilter();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, at);

                filter.type = 'lowpass';
                filter.frequency.value = 1400;
                filter.Q.value = 0.4;

                const vol = self.masterVolume * 0.32;
                gain.gain.setValueAtTime(0, at);
                gain.gain.linearRampToValueAtTime(vol, at + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, at + dur);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(out);

                osc.start(at);
                osc.stop(at + dur + 0.05);
            }

            chime(first, now, 0.34);
            chime(second, now + 0.17, 0.4);
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
                    try { sm.audioContext.suspend(); } catch (e) { /* noop */ }
                }
            } else if (sm.wasBedPlaying && sm.prefs.master && sm.prefs.bed) {
                try { sm.audioContext.resume(); } catch (e) { /* noop */ }
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

    // Press feedback: subtle click on .btn pointerup.
    // Delegated, throttled, gated on master, skipped under reduced
    // motion. Progressive enhancement only, never blocks the tap.
    (function wireBtnPressSound() {
        var lastPressSound = 0;
        document.addEventListener('pointerup', function (event) {
            try {
                if (!window.SoundManager || !window.SoundManager.prefs.master) return;
                var target = event.target && event.target.closest
                    ? event.target.closest('.btn')
                    : null;
                if (!target || target.disabled) return;
                if (window.SoundManager.prefersReducedMotion()) return;
                var now = Date.now();
                if (now - lastPressSound < 120) return;
                lastPressSound = now;
                window.SoundManager.playSelectSound();
            } catch (ignore) { /* press stays silent */ }
        }, { passive: true });
    })();

})();
