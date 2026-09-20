/**
 * ParticleText — vanilla canvas particle text (Gate P, P1 full port).
 * Custom hand-written canvas particle text engine (zero dependencies):
 * glyph sampled offscreen, particles scatter then gather with stagger,
 * pointer repel, idle drift and glow. Triggers: mount / hover / click.
 *
 * Colors resolve live from theme tokens so the theme law holds
 * (blue ramp light-only, turquoise dark-only):
 *   color     <- --theme-icon
 *   highlight <- --theme-icon-hover
 *   glow      <- --theme-icon-glow-rgb (r,g,b triplet)
 * Re-tints on window `themechange` without resampling geometry.
 *
 * Reduced motion: particles snap to fully-formed text, one static frame,
 * no loop, no replay. No-JS: the .particle-text__fallback text stays
 * visible (CSS only hides it once [data-pt-mounted] is set).
 *
 * Host markup:
 *   <div class="particle-text" data-particle-text="LOOKING FOR JAY?"
 *        data-pt-trigger="hover" data-pt-manual role="img" aria-label="Looking for Jay?">
 *     <canvas class="particle-text__canvas" aria-hidden="true"></canvas>
 *     <span class="particle-text__fallback" aria-hidden="true">LOOKING FOR JAY?</span>
 *     <span class="particle-text__sr">Looking for Jay?</span>
 *   </div>
 *
 * data-pt-manual: mount samples geometry but never auto-gathers — the owner
 * drives every playback via replay(). With it, the field NEVER re-scatters
 * on its own: rebuilds (resize / late fonts) snap back to the formed state,
 * replays are owner- or pointer-initiated with a 400ms storm guard, and an
 * empty glyph set releases the host back to fallback text.
 *
 * Responsive behaviour (small screens, coarse pointers):
 * - Sampling refines on narrow hosts (2px grid, smaller particles, richer
 *   budget) so ~30px glyphs stay legible instead of holey.
 * - Scatter / repel / radius scale with viewport (never below 45%), so the
 *   gather storm reads the same on a 390px phone as on desktop.
 * - Per-frame glow stays on everywhere (it fuses dots into strokes);
 *   small screens use a tighter blur, and offscreen sleep bounds cost.
 * - The loop sleeps while the host is offscreen (IntersectionObserver).
 * - Touch taps burst nearby particles outward; they spring back via the
 *   existing gather lerp. Mouse clicks stay inert by owner law.
 *
 * @file components/particle-text.js
 */
(function () {
    'use strict';

    var DEFAULTS = {
        particleSize: 2,
        density: 4,
        scatter: 280,
        gatherDuration: 1600,
        stagger: 420,
        pointerRepel: 30, // fluid hover repel: particles displace under cursor and spring back
        repelRadius: 110,
        idleDrift: 0.7,
        trigger: 'mount', // mount | hover | click — hero uses mount: mouse must NEVER restart or reset the text
        fontSize: 'clamp(3.5rem, 12vw, 9rem)',
        fontWeight: '400', // hero voice is Audiowide 400
        fontFamily: 'inherit', // resolves from .particle-text CSS (Audiowide)
        glow: true
    };

    var FALLBACK_COLOR = '#2196f3';
    var FALLBACK_HIGHLIGHT = '#00b8cc';
    var MIN_PARTICLES = 900;
    var MAX_PARTICLES = 5200;

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    /* Parse #rgb, #rrggbb, rgb() and rgba() (computed styles yield rgb()). */
    function parseCssColor(str, fallback) {
        var s = String(str || '').trim();
        var m;
        if (!s) return parseCssColor(fallback, '#000000');
        if (s.charAt(0) === '#') {
            var hex = s.slice(1);
            if (/^[0-9a-fA-F]{3}$/.test(hex)) {
                hex = hex.split('').map(function (c) { return c + c; }).join('');
            }
            if (/^[0-9a-fA-F]{6}$/.test(hex)) {
                return {
                    r: parseInt(hex.slice(0, 2), 16),
                    g: parseInt(hex.slice(2, 4), 16),
                    b: parseInt(hex.slice(4, 6), 16)
                };
            }
            return parseCssColor(fallback, '#000000');
        }
        m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
        if (m) {
            return { r: +m[1], g: +m[2], b: +m[3] };
        }
        return parseCssColor(fallback, '#000000');
    }

    function mixRgb(from, to, amount) {
        return {
            r: Math.round(from.r + (to.r - from.r) * amount),
            g: Math.round(from.g + (to.g - from.g) * amount),
            b: Math.round(from.b + (to.b - from.b) * amount)
        };
    }

    function rgbToCss(rgb) {
        return 'rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')';
    }

    /* Resolve a clamp()/vw font-size string to px via a hidden probe. */
    function resolveFontSize(value, host, weight, family) {
        if (typeof value === 'number') return value;
        var probe = document.createElement('span');
        probe.textContent = 'M';
        probe.style.position = 'absolute';
        probe.style.visibility = 'hidden';
        probe.style.pointerEvents = 'none';
        probe.style.fontSize = value;
        probe.style.fontWeight = String(weight);
        probe.style.fontFamily = family;
        host.appendChild(probe);
        var size = parseFloat(window.getComputedStyle(probe).fontSize) || 96;
        probe.remove();
        return size;
    }

    function waitForFonts(font) {
        if (!('fonts' in document)) return Promise.resolve();
        try {
            return Promise.resolve(document.fonts.load(font)).then(function () {
                return document.fonts.ready;
            }).catch(function () { /* system fallback fonts render anyway */ });
        } catch (e) {
            return Promise.resolve();
        }
    }

    function readOpts(host) {
        var d = host.dataset;
        function num(key, fallback) {
            var v = parseFloat(d[key]);
            return isNaN(v) ? fallback : v;
        }
        return {
            text: d.particleText || DEFAULTS.text,
            particleSize: num('ptSize', DEFAULTS.particleSize),
            density: num('ptDensity', DEFAULTS.density),
            scatter: num('ptScatter', DEFAULTS.scatter),
            gatherDuration: num('ptGather', DEFAULTS.gatherDuration),
            stagger: num('ptStagger', DEFAULTS.stagger),
            pointerRepel: num('ptRepel', DEFAULTS.pointerRepel),
            repelRadius: num('ptRadius', DEFAULTS.repelRadius),
            idleDrift: num('ptDrift', DEFAULTS.idleDrift),
            trigger: d.ptTrigger || DEFAULTS.trigger,
            manual: host.hasAttribute('data-pt-manual'), // owner drives playback via replay(); mount never auto-gathers
            fontSize: d.ptFontSize || DEFAULTS.fontSize,
            fontWeight: d.ptFontWeight || DEFAULTS.fontWeight,
            fontFamily: d.ptFontFamily || DEFAULTS.fontFamily,
            glow: d.ptGlow === undefined ? DEFAULTS.glow : d.ptGlow !== 'false'
        };
    }

    function readThemeColors(host) {
        var cs = window.getComputedStyle(host);
        var color = parseCssColor(cs.getPropertyValue('--theme-icon'), FALLBACK_COLOR);
        var highlight = parseCssColor(cs.getPropertyValue('--theme-icon-hover'), FALLBACK_HIGHLIGHT);
        var glowRaw = (cs.getPropertyValue('--theme-icon-glow-rgb') || '').trim();
        var glow = parseCssColor(glowRaw ? 'rgb(' + glowRaw + ')' : '', FALLBACK_HIGHLIGHT);
        return { color: color, highlight: highlight, glow: glow };
    }

    function createInstance(host) {
        var canvas = host.querySelector('canvas.particle-text__canvas');
        if (!canvas) return null;
        var ctx = canvas.getContext('2d');
        if (!ctx) return null;

        var inst = {
            host: host,
            canvas: canvas,
            ctx: ctx,
            opts: readOpts(host),
            theme: readThemeColors(host),
            particles: [],
            raf: null,
            resizeRaf: null,
            resizeObs: null,
            buildId: 0,
            gathering: false,
            formed: false, // true once particles sit on targets — rebuilds must preserve it, never re-scatter
            wantPlay: false, // replay() arrived before particles existed (slow fonts)
            wantOpts: null, // one-shot gather overrides carried for wantPlay
            lastReplay: 0, // replay storm guard (rapid hover in/out)
            gatherStart: 0,
            reducedMotion: false,
            width: 0,
            height: 0,
            dpr: 1,
            paused: false, // owner pause (hidden item) — loop stays off
            destroyed: false,
            pointer: { active: false, x: 0, y: 0, smoothX: 0, smoothY: 0 },
            mq: null,
            // Viewport-relative motion tuning, recomputed per build so
            // desktop fields stay exactly as authored (scale 1) while
            // small screens get a calmer, denser storm.
            vscale: 1, // scatter/repel/radius multiplier, clamped 0.45..1
            fxScatter: 280,
            fxRepel: 30,
            fxRadius: 110,
            fxGlow: true,
            viewObs: null
        };

        /* ----- gather ---------------------------------------------------- */
        inst.startGather = function (fromScatter) {
            if (!inst.particles.length || inst.destroyed) return;
            inst.formed = false;
            inst.gatherMs = inst.opts.gatherDuration; // snapshot: one-shot overrides must not leak into later frames
            var spread = inst.reducedMotion ? 0 : inst.fxScatter;
            inst.particles.forEach(function (p) {
                if (fromScatter) {
                    var angle = p.seed * Math.PI * 2;
                    var distance = spread * (0.35 + p.depth * 0.75);
                    p.x = p.targetX + Math.cos(angle) * distance + (p.depth - 0.5) * spread * 0.55;
                    p.y = p.targetY + Math.sin(angle) * distance + (p.seed - 0.5) * spread * 0.55;
                }
                p.startX = p.x;
                p.startY = p.y;
                p.delay = inst.reducedMotion ? 0 : p.seed * inst.opts.stagger;
            });
            inst.gatherStart = performance.now();
            inst.gathering = true;
            inst.resume();
        };

        inst.replay = function (over) {
            if (inst.reducedMotion || inst.destroyed) return;
            var now = performance.now();
            if (now - inst.lastReplay < 400) return; // hover in/out storm guard
            inst.lastReplay = now;
            if (!inst.particles.length) {
                inst.wantPlay = true; // in-flight build gathers on completion
                if (over) inst.wantOpts = over;
                return;
            }
            // One-shot gather overrides (e.g. fast entry gather). Timings are
            // consumed synchronously so instance defaults stay untouched.
            var o = inst.opts;
            var keepMs = o.gatherDuration, keepStagger = o.stagger;
            if (over) {
                if (over.duration) o.gatherDuration = over.duration;
                if (over.stagger !== undefined) o.stagger = over.stagger;
            }
            inst.startGather(true);
            o.gatherDuration = keepMs;
            o.stagger = keepStagger;
        };

        /* ----- frame ----------------------------------------------------- */
        inst.drawParticle = function (p) {
            var size = p.size;
            inst.ctx.fillStyle = p.color;
            if (size <= 2.1) {
                inst.ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
                return;
            }
            inst.ctx.beginPath();
            inst.ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
            inst.ctx.fill();
        };

        inst.frame = function (now) {
            if (inst.destroyed || inst.paused) {
                inst.raf = null;
                return;
            }
            var o = inst.opts;
            var ctx = inst.ctx;
            ctx.clearRect(0, 0, inst.width, inst.height);

            if (o.glow && inst.fxGlow && !inst.reducedMotion) {
                ctx.shadowBlur = o.particleSize * (inst.smallScreen ? 2 : 3);
                ctx.shadowColor = rgbToCss(inst.theme.glow);
            } else {
                ctx.shadowBlur = 0;
            }

            var ptr = inst.pointer;
            ptr.smoothX += (ptr.x - ptr.smoothX) * 0.18;
            ptr.smoothY += (ptr.y - ptr.smoothY) * 0.18;

            var complete = true;
            inst.particles.forEach(function (p) {
                var baseX = p.targetX;
                var baseY = p.targetY;
                var progress = 1;

                if (inst.gathering) {
                    var local = (now - inst.gatherStart - p.delay) / Math.max(1, inst.gatherMs || o.gatherDuration);
                    progress = clamp(local, 0, 1);
                    var eased = easeOutCubic(progress);
                    baseX = p.startX + (p.targetX - p.startX) * eased;
                    baseY = p.startY + (p.targetY - p.startY) * eased;
                    if (progress < 1) complete = false;
                } else if (o.idleDrift > 0) {
                    var t = now * 0.001;
                    baseX += Math.sin(t * 0.9 + p.seed * 10) * o.idleDrift * p.depth;
                    baseY += Math.cos(t * 0.75 + p.depth * 10) * o.idleDrift * p.depth;
                }

                if (ptr.active && inst.fxRepel > 0 && inst.fxRadius > 0) {
                    var dx = baseX - ptr.smoothX;
                    var dy = baseY - ptr.smoothY;
                    var dist = Math.hypot(dx, dy);
                    if (dist > 0 && dist < inst.fxRadius) {
                        var force = Math.pow(1 - dist / inst.fxRadius, 2) * inst.fxRepel;
                        baseX += (dx / dist) * force;
                        baseY += (dy / dist) * force;
                    }
                }

                p.x += (baseX - p.x) * 0.22;
                p.y += (baseY - p.y) * 0.22;

                ctx.globalAlpha = clamp(0.35 + progress * 0.65, 0, 1);
                inst.drawParticle(p);
            });

            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;

            if (inst.gathering && complete) {
                inst.gathering = false;
                inst.formed = true;
            }
            inst.raf = window.requestAnimationFrame(inst.frame);
        };

        inst.resume = function () {
            if (inst.destroyed || inst.paused || inst.reducedMotion) return;
            if (inst.raf === null && inst.particles.length) {
                inst.raf = window.requestAnimationFrame(inst.frame);
            }
        };

        inst.pause = function () {
            inst.paused = true;
            if (inst.raf !== null) {
                window.cancelAnimationFrame(inst.raf);
                inst.raf = null;
            }
        };

        inst.unpause = function () {
            inst.paused = false;
            inst.resume();
        };

        /* ----- sampling -------------------------------------------------- */
        inst.build = function () {
            var myBuild = ++inst.buildId;
            var rect = inst.host.getBoundingClientRect();
            var W = Math.floor(rect.width);
            var H = Math.floor(rect.height);
            if (W <= 0 || H <= 0 || inst.destroyed) return Promise.resolve();

            inst.width = W;
            inst.height = H;
            inst.dpr = Math.min(window.devicePixelRatio || 1, 2);
            inst.canvas.width = Math.max(1, Math.floor(W * inst.dpr));
            inst.canvas.height = Math.max(1, Math.floor(H * inst.dpr));
            inst.ctx.setTransform(inst.dpr, 0, 0, inst.dpr, 0, 0);

            var o = inst.opts;
            // Viewport-relative tuning: desktop (large viewport) keeps
            // authored values exactly; small screens calm the storm.
            inst.vscale = clamp(Math.min(W, H) / 800, 0.45, 1);
            inst.fxScatter = o.scatter * inst.vscale;
            inst.fxRepel = o.pointerRepel * inst.vscale;
            inst.fxRadius = o.repelRadius * inst.vscale;
            // Glow is the voice of this field: it fuses sparse dots into
            // continuous strokes. Gated only by author opt-out — small
            // screens use a tighter blur, and the offscreen sleep plus
            // visibility handling bound the real GPU cost.
            inst.fxGlow = o.glow;
            inst.smallScreen = W < 600;
            var computed = window.getComputedStyle(inst.host);
            var family = o.fontFamily === 'inherit'
                ? (computed.fontFamily || 'sans-serif')
                : o.fontFamily;
            var size = resolveFontSize(o.fontSize, inst.host, o.fontWeight, family);
            var font = o.fontWeight + ' ' + size + 'px ' + family;

            return waitForFonts(font).then(function () {
                if (myBuild !== inst.buildId || inst.destroyed) return;

                var off = document.createElement('canvas');
                var offCtx = off.getContext('2d', { willReadFrequently: true });
                if (!offCtx) return;

                var content = String(o.text || ' ');
                var maxTextWidth = W * 0.96;
                offCtx.font = font;
                var metrics = offCtx.measureText(content);
                var measured = Math.max(1, metrics.width);
                if (measured > maxTextWidth) {
                    size = Math.max(18, size * (maxTextWidth / measured));
                    font = o.fontWeight + ' ' + size + 'px ' + family;
                    offCtx.font = font;
                    metrics = offCtx.measureText(content);
                }

                var left = Math.ceil(metrics.actualBoundingBoxLeft || 0);
                var right = Math.ceil(metrics.actualBoundingBoxRight || metrics.width);
                var ascent = Math.ceil(metrics.actualBoundingBoxAscent || size * 0.78);
                var descent = Math.ceil(metrics.actualBoundingBoxDescent || size * 0.22);
                var pad = Math.max(12, Math.ceil(size * 0.08));
                var tw = Math.max(1, left + right);
                var th = Math.max(1, ascent + descent);

                off.width = tw + pad * 2;
                off.height = th + pad * 2;
                offCtx.clearRect(0, 0, off.width, off.height);
                offCtx.font = font;
                offCtx.textAlign = 'left';
                offCtx.textBaseline = 'alphabetic';
                offCtx.fillStyle = '#ffffff';
                offCtx.fillText(content, pad - left, pad + ascent);

                var data;
                try {
                    data = offCtx.getImageData(0, 0, off.width, off.height).data;
                } catch (e) {
                    return; // tainted/unreadable canvas — leave fallback text
                }

                var step = inst.smallScreen ? 2 : Math.max(2, Math.floor(o.density));
                var targets = [];
                var ox = W / 2 - off.width / 2;
                var oy = H / 2 - off.height / 2;
                for (var y = 0; y < off.height; y += step) {
                    for (var x = 0; x < off.width; x += step) {
                        var a = data[(y * off.width + x) * 4 + 3];
                        if (a > 40) {
                            targets.push({ x: ox + x, y: oy + y, alpha: a / 255 });
                        }
                    }
                }

                var maxP = Math.max(MIN_PARTICLES, Math.min(MAX_PARTICLES, Math.floor((W * H) / (inst.smallScreen ? 80 : 90))));
                var stride = Math.max(1, Math.ceil(targets.length / maxP));
                var spread0 = inst.reducedMotion ? 0 : inst.fxScatter;

                inst.particles = targets.filter(function (_, i) { return i % stride === 0; })
                    .map(function (t, i) {
                        var seed = (((i * 9301 + 49297) % 233280) / 233280);
                        var depth = 0.45 + ((((i * 233 + 97) % 1000) / 1000) * 0.9);
                        var blend = clamp(t.x / Math.max(1, W) + (seed - 0.5) * 0.35, 0, 1);
                        var ang = seed * Math.PI * 2;
                        var dist0 = spread0 * (0.35 + depth * 0.75);
                        var sx = t.x + Math.cos(ang) * dist0 + (seed - 0.5) * spread0 * 0.45;
                        var sy = t.y + Math.sin(ang) * dist0 + (depth - 0.9) * spread0 * 0.45;
                        return {
                            x: inst.reducedMotion ? t.x : sx,
                            y: inst.reducedMotion ? t.y : sy,
                            startX: sx,
                            startY: sy,
                            targetX: t.x,
                            targetY: t.y,
                            size: Math.max(0.6, o.particleSize * (inst.smallScreen ? 0.75 : 1) * (0.75 + t.alpha * 0.45)),
                            blend: blend,
                            color: '',
                            seed: seed,
                            depth: depth,
                            delay: seed * o.stagger
                        };
                    });

                inst.tint();

                if (!inst.particles.length) {
                    // Empty text (or unreadable glyphs): release the host
                    // back to fallback text instead of stranding blank canvas.
                    inst.host.removeAttribute('data-pt-mounted');
                    return;
                }

                inst.pointer.x = W / 2;
                inst.pointer.y = H / 2;
                inst.pointer.smoothX = inst.pointer.x;
                inst.pointer.smoothY = inst.pointer.y;

                if (inst.reducedMotion) {
                    inst.gathering = false;
                    inst.formed = true;
                    inst.drawOnce();
                } else if (inst.wantPlay) {
                    // A replay arrived mid-build: gather now (bypasses the
                    // storm cooldown — this IS the awaited playback).
                    inst.wantPlay = false;
                    var wo = inst.wantOpts;
                    inst.wantOpts = null;
                    var bo = inst.opts;
                    var keepMs = bo.gatherDuration, keepStagger = bo.stagger;
                    if (wo) {
                        if (wo.duration) bo.gatherDuration = wo.duration;
                        if (wo.stagger !== undefined) bo.stagger = wo.stagger;
                    }
                    inst.lastReplay = performance.now();
                    inst.startGather(false);
                    bo.gatherDuration = keepMs;
                    bo.stagger = keepStagger;
                } else if (inst.formed) {
                    // Rebuild (resize / late fonts): keep the formed state —
                    // never re-scatter on its own.
                    inst.snapToTargets();
                    if (inst.paused) inst.drawOnce();
                    else inst.resume();
                } else if (inst.opts.manual) {
                    // Owner (stepper) drives first playback via replay().
                    // Item is hidden until revealed, so nothing draws yet.
                } else {
                    inst.startGather(false);
                }
            });
        };

        /* Snap every particle onto its target (rebuilds preserve formed state). */
        inst.snapToTargets = function () {
            inst.particles.forEach(function (p) {
                p.x = p.targetX;
                p.y = p.targetY;
                p.startX = p.targetX;
                p.startY = p.targetY;
                p.delay = 0;
            });
            inst.gathering = false;
            inst.formed = true;
        };

        /* Recompute particle colors from current theme tokens (no resample). */
        inst.tint = function () {
            inst.theme = readThemeColors(inst.host);
            inst.particles.forEach(function (p) {
                p.color = rgbToCss(mixRgb(inst.theme.color, inst.theme.highlight, p.blend));
            });
        };

        inst.retint = function () {
            if (!inst.particles.length || inst.destroyed) return;
            inst.tint();
            if (inst.reducedMotion) inst.drawOnce();
        };

        /* Single static frame (reduced motion). */
        inst.drawOnce = function () {
            var ctx = inst.ctx;
            ctx.clearRect(0, 0, inst.width, inst.height);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
            inst.particles.forEach(function (p) {
                p.x = p.targetX;
                p.y = p.targetY;
                inst.drawParticle(p);
            });
            inst.formed = true;
        };

        /* ----- events ---------------------------------------------------- */
        inst.onPointerMove = function (e) {
            var rect = inst.canvas.getBoundingClientRect();
            inst.pointer.x = e.clientX - rect.left;
            inst.pointer.y = e.clientY - rect.top;
            inst.pointer.active = true;
        };
        inst.onPointerLeave = function () {
            inst.pointer.active = false;
        };
        inst.onPointerEnter = function (e) {
            inst.onPointerMove(e);
            // Mouse MUST NOT restart or reset formed particle text:
            // hover interaction only displaces particles via spring physics
        };
        inst.onClick = function () {
            // Clicks MUST NOT restart or reset formed particle text
        };
        /* Touch tap burst: kick nearby particles outward; the frame lerp
           springs them home. Touch/pen only — mouse clicks stay inert. */
        inst.burst = function (x, y) {
            if (inst.reducedMotion || inst.destroyed || inst.paused || !inst.particles.length) return;
            var R = Math.max(60, inst.fxRadius * 1.6);
            var power = 40 + 90 * inst.vscale;
            for (var i = 0; i < inst.particles.length; i++) {
                var p = inst.particles[i];
                var bdx = p.x - x;
                var bdy = p.y - y;
                var bd = Math.hypot(bdx, bdy);
                if (bd > 0.01 && bd < R) {
                    var bf = Math.pow(1 - bd / R, 2) * power;
                    p.x += (bdx / bd) * bf;
                    p.y += (bdy / bd) * bf;
                }
            }
            inst.resume();
        };
        inst.onPointerDown = function (e) {
            if (!e || inst.reducedMotion || inst.destroyed) return;
            var pt = ('pointerType' in e) ? e.pointerType : '';
            if (pt && pt !== 'touch' && pt !== 'pen') return;
            try {
                var rect = inst.canvas.getBoundingClientRect();
                inst.onPointerMove(e);
                inst.burst(e.clientX - rect.left, e.clientY - rect.top);
            } catch (err) { /* taps never break */ }
        };
        inst.onResize = function () {
            if (inst.resizeRaf !== null) window.cancelAnimationFrame(inst.resizeRaf);
            inst.resizeRaf = window.requestAnimationFrame(function () {
                inst.resizeRaf = null;
                inst.build();
            });
        };
        inst.onReduceMotion = function (e) {
            inst.reducedMotion = e.matches;
            if (e.matches && inst.raf !== null) {
                window.cancelAnimationFrame(inst.raf);
                inst.raf = null;
            }
            inst.build();
        };
        inst.onVisibility = function () {
            if (document.hidden) {
                if (inst.raf !== null) {
                    window.cancelAnimationFrame(inst.raf);
                    inst.raf = null;
                }
            } else if (!inst.paused && !inst.reducedMotion && inst.particles.length && inst.raf === null) {
                inst.raf = window.requestAnimationFrame(inst.frame);
            }
        };

        inst.destroy = function () {
            inst.destroyed = true;
            inst.buildId += 1;
            if (inst.raf !== null) window.cancelAnimationFrame(inst.raf);
            if (inst.resizeRaf !== null) window.cancelAnimationFrame(inst.resizeRaf);
            if (inst.resizeObs) inst.resizeObs.disconnect();
            if (inst.viewObs) inst.viewObs.disconnect();
            if (inst.mq && inst.mq.removeEventListener) {
                inst.mq.removeEventListener('change', inst.onReduceMotion);
            }
            document.removeEventListener('visibilitychange', inst.onVisibility);
            inst.canvas.removeEventListener('pointerenter', inst.onPointerEnter);
            inst.canvas.removeEventListener('pointermove', inst.onPointerMove);
            inst.canvas.removeEventListener('pointerleave', inst.onPointerLeave);
            inst.canvas.removeEventListener('click', inst.onClick);
            inst.canvas.removeEventListener('pointerdown', inst.onPointerDown);
            delete inst.host._particleText;
        };

        /* ----- mount ----------------------------------------------------- */
        inst.reducedMotion = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        inst.mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
        if (inst.mq && inst.mq.addEventListener) {
            inst.mq.addEventListener('change', inst.onReduceMotion);
        }
        inst.canvas.addEventListener('pointerenter', inst.onPointerEnter);
        inst.canvas.addEventListener('pointermove', inst.onPointerMove);
        inst.canvas.addEventListener('pointerleave', inst.onPointerLeave);
        inst.canvas.addEventListener('click', inst.onClick);
        inst.canvas.addEventListener('pointerdown', inst.onPointerDown);
        document.addEventListener('visibilitychange', inst.onVisibility);

        if ('ResizeObserver' in window) {
            inst.resizeObs = new ResizeObserver(inst.onResize);
            inst.resizeObs.observe(inst.host);
        } else {
            window.addEventListener('resize', inst.onResize);
        }

        /* Sleep the loop while the host is offscreen (battery, mobile). */
        if ('IntersectionObserver' in window) {
            try {
                inst.viewObs = new IntersectionObserver(function (entries) {
                    var vis = entries.some(function (en) { return en.isIntersecting; });
                    if (vis) {
                        if (!inst.reducedMotion) inst.unpause();
                    } else {
                        inst.pause();
                    }
                }, { threshold: 0 });
                inst.viewObs.observe(inst.host);
            } catch (e) { inst.viewObs = null; }
        }

        inst.host._particleText = inst;
        inst.host.setAttribute('data-pt-mounted', 'true');
        inst.build();
        return inst;
    }

    function mount(host) {
        if (!host || host._particleText) {
            return (host && host._particleText) || null;
        }
        return createInstance(host);
    }

    function init() {
        var hosts = document.querySelectorAll('[data-particle-text]:not([data-pt-mounted])');
        hosts.forEach(function (host) { mount(host); });
    }

    function retintAll() {
        var hosts = document.querySelectorAll('[data-particle-text][data-pt-mounted]');
        hosts.forEach(function (host) {
            if (host._particleText) host._particleText.retint();
        });
    }

    window.ParticleText = {
        init: init,
        mount: mount,
        retintAll: retintAll,
        of: function (host) { return (host && host._particleText) || null; }
    };

    window.addEventListener('themechange', retintAll);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
