/**
 * ParticleText, vanilla canvas particle text (Gate P, P1 full port).
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
 * data-pt-manual: mount samples geometry but never auto-gathers, the owner
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
        trigger: 'mount', // mount | hover | click, hero uses mount: mouse must NEVER restart or reset the text
        fontSize: 'clamp(3.5rem, 12vw, 9rem)',
        fontWeight: '400', // hero voice is Audiowide 400
        fontFamily: 'inherit', // resolves from .particle-text CSS (Audiowide)
        glow: true
    };

    var FALLBACK_COLOR = '#2196f3';
    var FALLBACK_HIGHLIGHT = '#00b8cc';
    var MIN_PARTICLES = 900;
    var MAX_PARTICLES = 5200;
    var LOOP_MAX = 2000; // nanotech loop: fine dust needs room between grains

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    /* Parse #rgb, #rrggbb, rgb() and rgba() (computed styles yield rgb()).
       Tries str, then fallback, then black: '#000000' always parses, so the
       loop always returns inside; the trailing return only states totality. */
    function parseCssColor(str, fallback) {
        var candidates = [str, fallback, '#000000'];
        for (var i = 0; i < candidates.length; i++) {
            var s = String(candidates[i] || '').trim();
            if (!s) continue;
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
                continue;
            }
            var m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
            if (m) {
                return { r: +m[1], g: +m[2], b: +m[3] };
            }
        }
        return { r: 0, g: 0, b: 0 };
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
        } catch {
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
            glow: d.ptGlow === undefined ? DEFAULTS.glow : d.ptGlow !== 'false',
            // Nanotech loop (D-204, D-207): words the particles keep building,
            // e.g. "LOOKING FOR|JAY|?". Off when absent.
            loop: d.ptLoop ? String(d.ptLoop).split('|').map(function (s) { return s.trim(); }).filter(Boolean) : null
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
            formed: false, // true once particles sit on targets, rebuilds must preserve it, never re-scatter
            wantPlay: false, // replay() arrived before particles existed (slow fonts)
            wantOpts: null, // one-shot gather overrides carried for wantPlay
            lastReplay: 0, // replay storm guard (rapid hover in/out)
            gatherStart: 0,
            reducedMotion: false,
            width: 0,
            height: 0,
            dpr: 1,
            paused: false, // owner pause (hidden item), loop stays off
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
            if (inst.loopOn) {
                inst.loopRestart();
                return;
            }
            inst.startGather(true);
            o.gatherDuration = keepMs;
            o.stagger = keepStagger;
        };

        /* ----- nanotech loop (D-204, D-207) -------------------------------
           The particles behave like calm nanotech: they search, build a word,
           wonder (a slow orbit), build the next word, and let go, forever.
           Calm by design (owner: "finer graded and calming, not alarming"):
           fine dust, soft ink, a weak spring with heavy damping (no
           overshoot), long holds. Cheap by design: no shadowBlur, four tone
           groups with one fill each, and once a word holds still the loop
           stops drawing and sleeps until the next stage. */
        inst.loopOn = false;
        inst.loopTimer = null;

        inst.loopStages = function () {
            var w = inst.opts.loop;
            var s = [{ mode: 'search', ms: 4200 }];
            w.forEach(function (word, i) {
                s.push({ mode: 'form', word: i, ms: i === 0 ? 4600 : 4200 });
                if (i === 0 && w.length > 1) s.push({ mode: 'drift', ms: 3800 });
            });
            s.push({ mode: 'release', ms: 2600 });
            return s;
        };

        inst.loopEnter = function (index, now) {
            var L = inst.loopState;
            L.si = index % L.stages.length;
            L.start = now;
            L.settled = false;
            var st = L.stages[L.si];
            if (st.mode === 'form') {
                var t = inst.loopTargets[st.word];
                inst.particles.forEach(function (p, i) {
                    p.targetX = t[i * 2];
                    p.targetY = t[i * 2 + 1];
                });
            }
        };

        inst.loopRestart = function () {
            if (!inst.loopState) return;
            inst.loopEnter(0, performance.now());
            inst.clearLoopTimer();
            inst.resume();
        };

        inst.clearLoopTimer = function () {
            if (inst.loopTimer !== null) {
                window.clearTimeout(inst.loopTimer);
                inst.loopTimer = null;
            }
        };

        inst.loopFrame = function (now) {
            var L = inst.loopState;
            var st = L.stages[L.si];
            var t = now - L.start;
            if (t > st.ms) {
                inst.loopEnter(L.si + 1, now);
                st = L.stages[L.si];
                t = 0;
            }
            var W = inst.width, H = inst.height, cx = W / 2, cy = H / 2;
            var time = now / 1000;
            var fade = st.mode === 'release' ? 1 - 0.55 * Math.sin(Math.PI * Math.min(1, t / st.ms)) : 1;
            var ptr = inst.pointer;
            ptr.smoothX += (ptr.x - ptr.smoothX) * 0.12;
            ptr.smoothY += (ptr.y - ptr.smoothY) * 0.12;
            var R = inst.fxRadius, push = inst.fxRepel * 0.02;
            var moving = 0;
            var list = inst.particles;
            for (var i = 0; i < list.length; i++) {
                var p = list[i], ax, ay, s = p.seed * 1000;
                if (st.mode === 'form') {
                    ax = (p.targetX - p.x) * 0.01;
                    ay = (p.targetY - p.y) * 0.01;
                } else if (st.mode === 'drift') {
                    var rx = p.x - cx, ry = p.y - cy, d = Math.sqrt(rx * rx + ry * ry) + 1;
                    var pull = (H * (0.18 + 0.14 * p.seed) - d) * 0.0009;
                    ax = (-ry / d) * 0.018 + (rx / d) * pull;
                    ay = (rx / d) * 0.018 + (ry / d) * pull;
                } else {
                    ax = Math.cos(time * 0.35 + s) * 0.012 + (cx - p.x) * 0.00012;
                    ay = Math.sin(time * 0.42 + s * 1.3) * 0.012 + (cy - p.y) * 0.00018;
                    if (st.mode === 'release') { ax += (p.x - cx) * 0.00035; ay += (p.y - cy) * 0.00035; }
                }
                if (ptr.active && R > 0) {
                    var dx = p.x - ptr.smoothX, dy = p.y - ptr.smoothY, dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 0 && dist < R) {
                        var f = (1 - dist / R) * (1 - dist / R) * push;
                        ax += (dx / dist) * f;
                        ay += (dy / dist) * f;
                    }
                }
                p.vx = (p.vx + ax) * (st.mode === 'form' ? 0.85 : 0.92);
                p.vy = (p.vy + ay) * (st.mode === 'form' ? 0.85 : 0.92);
                p.x += p.vx;
                p.y += p.vy;
                if (Math.abs(p.vx) + Math.abs(p.vy) > 0.03) moving++;
            }
            var still = moving <= list.length * 0.01; // fewer than 1% still drifting
            if (!still || !L.settled) {
                var ctx = inst.ctx, c = inst.theme.color;
                ctx.clearRect(0, 0, W, H);
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1;
                for (var b = 0; b < 4; b++) {
                    ctx.fillStyle = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + ((0.55 + b * 0.1) * fade).toFixed(2) + ')';
                    ctx.beginPath();
                    for (var j = b; j < list.length; j += 4) {
                        var q = list[j], r = q.size / 2;
                        ctx.moveTo(q.x + r, q.y);
                        ctx.arc(q.x, q.y, r, 0, 6.2832);
                    }
                    ctx.fill();
                }
                L.settled = still;
            }
            // A word that holds still: stop drawing and sleep to the next stage.
            if (L.settled && st.mode === 'form' && !ptr.active) {
                inst.raf = null;
                inst.clearLoopTimer();
                inst.loopTimer = window.setTimeout(function () {
                    inst.loopTimer = null;
                    inst.resume();
                }, Math.max(16, st.ms - t));
                return;
            }
            inst.raf = window.requestAnimationFrame(inst.frame);
        };

        /* Sample one word into one target per particle, centred, fitted to the box. */
        inst.sampleWord = function (word, family, baseSize) {
            var W = inst.width, H = inst.height;
            var off = document.createElement('canvas');
            var g = off.getContext('2d', { willReadFrequently: true });
            if (!g) return null;
            // Fit the word's real ink box inside the host (94% wide, 78% tall),
            // so tall glyphs like "?" are never clipped on a short hero.
            var size = baseSize * 1.6;
            g.font = inst.opts.fontWeight + ' ' + size + 'px ' + family;
            var m = g.measureText(word);
            var wdt = Math.max(1, (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || m.width));
            var hgt = Math.max(1, (m.actualBoundingBoxAscent || size * 0.78) + (m.actualBoundingBoxDescent || size * 0.22));
            size = size * Math.min(1, (W * 0.94) / wdt, (H * 0.78) / hgt);
            off.width = Math.max(1, W);
            off.height = Math.max(1, H);
            g.font = inst.opts.fontWeight + ' ' + size + 'px ' + family;
            m = g.measureText(word);
            var asc = m.actualBoundingBoxAscent || size * 0.78, desc = m.actualBoundingBoxDescent || size * 0.22;
            g.textAlign = 'center';
            g.textBaseline = 'alphabetic';
            g.fillStyle = '#fff';
            g.fillText(word, W / 2, H / 2 + (asc - desc) / 2);
            var data;
            try { data = g.getImageData(0, 0, off.width, off.height).data; } catch { return null; }
            var pts = [];
            for (var y = 0; y < off.height; y += 2) {
                for (var x = 0; x < off.width; x += 2) {
                    if (data[(y * off.width + x) * 4 + 3] > 128) pts.push(x, y);
                }
            }
            if (!pts.length) return null;
            var n = inst.particles.length, out = new Float32Array(n * 2), count = pts.length / 2;
            for (var i = 0; i < n; i++) {
                var k = Math.floor(((i * 7919) % n) / n * count) * 2;
                out[i * 2] = pts[k] + (((i * 37) % 10) / 10 - 0.5) * 1.5;
                out[i * 2 + 1] = pts[k + 1] + (((i * 53) % 10) / 10 - 0.5) * 1.5;
            }
            return out;
        };

        /* After a build: turn the field into nanotech dust and start (or keep) the loop. */
        inst.setupLoop = function (family, baseSize) {
            var words = inst.opts.loop;
            // Fine dust needs room between grains: at most LOOP_MAX particles,
            // spread evenly over the field (halves the drawing cost too).
            if (inst.particles.length > LOOP_MAX) {
                var keepEvery = inst.particles.length / LOOP_MAX;
                inst.particles = inst.particles.filter(function (_, i) {
                    return Math.floor(i / keepEvery) !== Math.floor((i - 1) / keepEvery);
                });
            }
            var targets = words.map(function (w) { return inst.sampleWord(w, family, baseSize); });
            if (targets.some(function (t) { return !t; })) return false;
            inst.loopTargets = targets;
            inst.particles.forEach(function (p) {
                p.vx = 0;
                p.vy = 0;
                p.size = 0.8 + p.seed * 1.0; // 0.4 to 0.9 px radius: fine dust
            });
            var keep = inst.loopState;
            inst.loopState = { stages: inst.loopStages(), si: 0, start: performance.now(), settled: false };
            inst.loopOn = true;
            if (keep) inst.loopEnter(keep.si, performance.now() - Math.min(keep.stages[keep.si].ms, performance.now() - keep.start));
            return true;
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
            if (inst.loopOn) {
                inst.loopFrame(now);
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
            inst.clearLoopTimer();
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
            // continuous strokes. Gated only by author opt-out, small
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
                } catch {
                    return; // tainted/unreadable canvas, leave fallback text
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

                // Nanotech loop: reduced motion keeps the static full text below.
                inst.loopOn = false;
                inst.clearLoopTimer();
                if (o.loop && !inst.reducedMotion && inst.setupLoop(family, size)) {
                    var wasRunning = inst.formed;
                    inst.formed = true;
                    if (inst.wantPlay) {
                        inst.wantPlay = false;
                        inst.wantOpts = null;
                        inst.lastReplay = performance.now();
                        inst.loopRestart();
                    } else if (wasRunning) {
                        inst.resume();
                    } else if (!o.manual) {
                        inst.loopRestart();
                    }
                    return;
                }

                if (inst.reducedMotion) {
                    inst.gathering = false;
                    inst.formed = true;
                    inst.drawOnce();
                } else if (inst.wantPlay) {
                    // A replay arrived mid-build: gather now (bypasses the
                    // storm cooldown, this IS the awaited playback).
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
                    // Rebuild (resize / late fonts): keep the formed state,
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
           springs them home. Touch/pen only, mouse clicks stay inert. */
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
            } catch { /* taps never break */ }
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
                inst.clearLoopTimer();
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
            inst.clearLoopTimer();
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
            } catch { inst.viewObs = null; }
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
