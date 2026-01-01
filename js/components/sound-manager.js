/**
 * Sound Manager Component
 * Handles sleek UI sound effects for project showcase interactions
 * Uses Web Audio API for copyright-free programmatic sound generation
 * 
 * @file components/sound-manager.js
 * @author Jay Patel
 */

(function () {
    'use strict';

    class SoundManager {
        constructor() {
            this.audioContext = null;
            this.isEnabled = true;
            this.isMuted = false;
            this.masterVolume = 0.15; // Low volume for subtle effect
            this.initialized = false;
            this.warmupDone = false;

            // Bind methods
            this.init = this.init.bind(this);
            this.warmup = this.warmup.bind(this);
            this.playSelectSound = this.playSelectSound.bind(this);
            this.playHoverSound = this.playHoverSound.bind(this);
            this.playLightsaberIgnite = this.playLightsaberIgnite.bind(this);
            this.playLightsaberRetract = this.playLightsaberRetract.bind(this);
        }

        /**
         * Initialize audio context on user interaction (required by browsers)
         */
        init() {
            if (this.initialized) return;

            try {
                // Create audio context
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) {
                    console.warn('Web Audio API not supported');
                    this.isEnabled = false;
                    return;
                }

                this.audioContext = new AudioContext();
                this.initialized = true;

                // Resume context if suspended
                if (this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }

            } catch (error) {
                console.warn('Failed to initialize audio context:', error);
                this.isEnabled = false;
            }
        }

        /**
         * Warmup the audio context with a silent sound
         * This ensures the first real sound plays immediately
         */
        warmup() {
            if (this.warmupDone || !this.ensureContext()) return;

            const ctx = this.audioContext;
            const now = ctx.currentTime;

            // Play a silent oscillator to prime the audio system
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.value = 1;
            gain.gain.value = 0; // Completely silent

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.001);

            this.warmupDone = true;
        }

        /**
         * Ensure audio context is ready
         */
        ensureContext() {
            if (!this.isEnabled || this.isMuted) return false;

            if (!this.initialized) {
                this.init();
            }

            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }

            return this.audioContext && this.audioContext.state === 'running';
        }

        /**
         * Play a sleek selection/click sound
         * Used when selecting a project in the carousel
         * Clean, minimal digital tone - no goofy pitch sweeps
         */
        playSelectSound() {
            if (!this.ensureContext()) return;

            const ctx = this.audioContext;
            const now = ctx.currentTime;

            // Clean, short digital tick - single frequency, no sweep
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            // Pure sine wave at a pleasant frequency
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1800, now);

            // Gentle high-pass filter for clarity
            filter.type = 'highpass';
            filter.frequency.value = 800;
            filter.Q.value = 0.5;

            // Very short, crisp envelope - quick attack, quick decay
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(this.masterVolume * 0.4, now + 0.008);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

            // Connect and play
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.08);
        }

        /**
         * Play a subtle hover sound
         * Used when hovering over carousel slides or mini cards
         */
        playHoverSound() {
            if (!this.ensureContext()) return;

            const ctx = this.audioContext;
            const now = ctx.currentTime;

            // Very subtle high-frequency tick
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(2000, now);
            osc.frequency.exponentialRampToValueAtTime(2800, now + 0.02);

            // Very quiet and short
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(this.masterVolume * 0.2, now + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.06);
        }

        /**
         * Play lightsaber ignite sound (dark mode on)
         * Ultra-sleek, minimal sci-fi activation tone
         * Pure sine waves, smooth curves, premium UI feel
         */
        playLightsaberIgnite() {
            if (!this.ensureContext()) return;

            const ctx = this.audioContext;
            const now = ctx.currentTime;
            const volume = this.masterVolume * 0.6;

            // Single clean swoosh - rising pitch
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            // Pure sine wave - smooth rising sweep
            osc.type = 'sine';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
            osc.frequency.exponentialRampToValueAtTime(660, now + 0.18);

            // Smooth low-pass to remove any harshness
            filter.type = 'lowpass';
            filter.frequency.value = 2000;
            filter.Q.value = 0.7;

            // Smooth bell-curve envelope
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.exponentialRampToValueAtTime(volume, now + 0.025);
            gain.gain.exponentialRampToValueAtTime(volume * 0.6, now + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.25);
        }

        /**
         * Play lightsaber retract sound (light mode on)
         * Ultra-sleek, minimal sci-fi deactivation tone
         * Pure sine waves, smooth curves, premium UI feel
         */
        playLightsaberRetract() {
            if (!this.ensureContext()) return;

            const ctx = this.audioContext;
            const now = ctx.currentTime;
            const volume = this.masterVolume * 0.5;

            // Single clean swoosh - falling pitch
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            // Pure sine wave - smooth falling sweep
            osc.type = 'sine';
            osc.frequency.setValueAtTime(660, now);
            osc.frequency.exponentialRampToValueAtTime(220, now + 0.12);
            osc.frequency.exponentialRampToValueAtTime(110, now + 0.2);

            // Smooth low-pass
            filter.type = 'lowpass';
            filter.frequency.value = 1500;
            filter.Q.value = 0.7;

            // Quick fade out envelope
            gain.gain.setValueAtTime(volume, now);
            gain.gain.exponentialRampToValueAtTime(volume * 0.5, now + 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.22);
        }

        /**
         * Play step up sound - soft ascending breeze
         * Gentle filtered noise with rising character
         */
        playStepUp() {
            if (!this.ensureContext()) return;

            const ctx = this.audioContext;
            const now = ctx.currentTime;
            const volume = this.masterVolume * 0.18;

            // Create soft tone with gentle rise
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            // Very low, soft tone
            osc.type = 'sine';
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.exponentialRampToValueAtTime(260, now + 0.12);

            // Soft low-pass for warmth
            filter.type = 'lowpass';
            filter.frequency.value = 400;
            filter.Q.value = 0.3;

            // Gentle fade in/out envelope
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(volume, now + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.16);
        }

        /**
         * Play step down sound - soft descending breeze
         * Gentle filtered tone with falling character
         */
        playStepDown() {
            if (!this.ensureContext()) return;

            const ctx = this.audioContext;
            const now = ctx.currentTime;
            const volume = this.masterVolume * 0.18;

            // Create soft tone with gentle fall
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            // Very low, soft tone falling
            osc.type = 'sine';
            osc.frequency.setValueAtTime(240, now);
            osc.frequency.exponentialRampToValueAtTime(160, now + 0.12);

            // Soft low-pass for warmth
            filter.type = 'lowpass';
            filter.frequency.value = 380;
            filter.Q.value = 0.3;

            // Gentle fade in/out envelope
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(volume, now + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.16);
        }
        /**
         * Play stepper enter sound - simple soft chime
         * Clean, minimal single tone
         */
        playStepperEnter() {
            if (!this.ensureContext()) return;

            const ctx = this.audioContext;
            const now = ctx.currentTime;
            const volume = this.masterVolume * 0.1;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            // Simple soft tone
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);

            // Soft fade in/out
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(volume, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.18);
        }

        /**
         * Play stepper exit sound - reuses enter sound for consistency
         */
        playStepperExit() {
            this.playStepperEnter();
        }

        /**
         * Play stepper arm sound - reuses enter sound for consistency
         */
        playStepperArm() {
            this.playStepperEnter();
        }

        /**
         * Toggle mute state
         */
        toggleMute() {
            this.isMuted = !this.isMuted;
            return this.isMuted;
        }

        /**
         * Set master volume (0-1)
         */
        setVolume(volume) {
            this.masterVolume = Math.max(0, Math.min(1, volume));
        }

        /**
         * Check if reduced motion is preferred
         */
        prefersReducedMotion() {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        }
    }

    // Create global instance
    window.SoundManager = new SoundManager();

    // Eager initialization - warmup on first user activity for instant sound
    const eagerInit = () => {
        window.SoundManager.init();
        window.SoundManager.warmup();
        document.removeEventListener('mousemove', eagerInit);
        document.removeEventListener('touchstart', eagerInit);
        document.removeEventListener('scroll', eagerInit);
        document.removeEventListener('wheel', eagerInit);
        document.removeEventListener('keydown', eagerInit);
    };

    // Listen for early user activity to prime audio
    document.addEventListener('mousemove', eagerInit, { once: true, passive: true });
    document.addEventListener('touchstart', eagerInit, { once: true, passive: true });
    document.addEventListener('scroll', eagerInit, { once: true, passive: true });
    document.addEventListener('wheel', eagerInit, { once: true, passive: true });
    document.addEventListener('keydown', eagerInit, { once: true, passive: true });

    // Fallback: also init on first click if not already done
    document.addEventListener('click', () => {
        if (!window.SoundManager.initialized) {
            window.SoundManager.init();
            window.SoundManager.warmup();
        }
    }, { once: true });

})();
