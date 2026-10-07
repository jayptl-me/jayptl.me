/**
 * Beyond the Code toys: Flick Ball, Tiny Snake, and the saber listen button.
 *
 *   <div class="toy" data-toy="ball">   physics sandbox, drag to flick
 *   <div class="toy" data-toy="snake">  12 x 8 snake with a best score
 *   <button data-toy="saber">           plays the synthesized theme swoosh
 *
 * Brief (docs/motion-zen.md section 6a, picked 2026-09-28): small canvases
 * that only run while visible and while played with; nothing auto-plays.
 * Strokes use the theme ink (currentColor). Keyboard playable. Sound goes
 * through the sound manager and respects its switch. Reduced motion: the
 * toys still work when you play them, but never move on their own.
 *
 * @file js/components/beyond-toys.js
 */
(function () {
    'use strict';

    var DPR_CAP = 2;

    function sm() {
        return window.SoundManager || null;
    }

    function tick(kind) {
        try {
            var s = sm();
            if (!s) return;
            if (kind === 'hover' && s.playHoverSound) s.playHoverSound();
            if (kind === 'select' && s.playSelectSound) s.playSelectSound();
        } catch (e) { /* noop */ }
    }

    function sizeCanvas(canvas) {
        var dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
        var rect = canvas.getBoundingClientRect();
        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));
        var ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { ctx: ctx, w: rect.width, h: rect.height };
    }

    function ink(canvas) {
        try {
            return getComputedStyle(canvas).color || '#2196f3';
        } catch (e) {
            return '#2196f3';
        }
    }

    function visibleWatch(el, onChange) {
        if (!('IntersectionObserver' in window)) {
            onChange(true);
            return null;
        }
        var io = new IntersectionObserver(function (entries) {
            onChange(entries[entries.length - 1].isIntersecting);
        }, { threshold: 0.2 });
        io.observe(el);
        return io;
    }

    /* ---- Flick Ball ------------------------------------------------------ */

    function ball(host) {
        var canvas = host.querySelector('canvas');
        var live = host.querySelector('.toy-live');
        if (!canvas) return null;
        var G = 1400;          // px/s^2
        var BOUNCE = 0.74;
        var AIR = 0.995;
        var FLOOR_FRICTION = 0.9;
        var R = 11;
        var view = sizeCanvas(canvas);
        var b = { x: view.w * 0.3, y: view.h - R - 6, vx: 0, vy: 0 };
        var raf = 0;
        var last = 0;
        var visible = false;
        var drag = null;
        var lastBounce = 0;

        function draw() {
            var ctx = view.ctx;
            var color = ink(canvas);
            ctx.clearRect(0, 0, view.w, view.h);
            ctx.strokeStyle = color;
            ctx.lineCap = 'round';
            ctx.lineWidth = 2;
            // Hand-drawn floor: a slightly wavy line.
            ctx.beginPath();
            ctx.moveTo(6, view.h - 4);
            for (var x = 6; x <= view.w - 6; x += 24) {
                ctx.lineTo(x, view.h - 4 + Math.sin(x * 0.09) * 1.2);
            }
            ctx.stroke();
            // The ball: a lopsided hand circle plus a tiny highlight tick.
            ctx.beginPath();
            ctx.ellipse(b.x, b.y, R, R * 0.96, 0.3, 0.2, Math.PI * 2 + 0.05);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(b.x - 3.5, b.y - 3.5, 3.2, Math.PI * 1.05, Math.PI * 1.6);
            ctx.stroke();
            if (drag) {
                ctx.globalAlpha = 0.5;
                ctx.setLineDash([3, 5]);
                ctx.beginPath();
                ctx.moveTo(b.x, b.y);
                ctx.lineTo(drag.x, drag.y);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.globalAlpha = 1;
            }
        }

        function step(dt) {
            b.vy += G * dt;
            b.vx *= AIR;
            b.vy *= AIR;
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            var hit = 0;
            if (b.x < R) { b.x = R; hit = Math.abs(b.vx); b.vx = -b.vx * BOUNCE; }
            if (b.x > view.w - R) { b.x = view.w - R; hit = Math.abs(b.vx); b.vx = -b.vx * BOUNCE; }
            if (b.y < R) { b.y = R; hit = Math.abs(b.vy); b.vy = -b.vy * BOUNCE; }
            if (b.y > view.h - R - 5) {
                b.y = view.h - R - 5;
                hit = Math.max(hit, Math.abs(b.vy));
                b.vy = -b.vy * BOUNCE;
                b.vx *= FLOOR_FRICTION;
                if (Math.abs(b.vy) < 40) b.vy = 0;
            }
            var now = performance.now();
            if (hit > 260 && now - lastBounce > 120) {
                lastBounce = now;
                tick('hover');
            }
        }

        function resting() {
            return !drag && b.vy === 0 && Math.abs(b.vx) < 4 && b.y >= view.h - R - 5.5;
        }

        function frame(now) {
            var dt = Math.min(0.033, (now - last) / 1000 || 0.016);
            last = now;
            if (!drag) step(dt);
            draw();
            if (visible && !resting()) {
                raf = requestAnimationFrame(frame);
            } else {
                raf = 0;
            }
        }

        function run() {
            if (raf || !visible) return;
            last = performance.now();
            raf = requestAnimationFrame(frame);
        }

        function point(e) {
            var r = canvas.getBoundingClientRect();
            return { x: e.clientX - r.left, y: e.clientY - r.top };
        }

        function onDown(e) {
            var p = point(e);
            canvas.setPointerCapture(e.pointerId);
            drag = { id: e.pointerId, x: p.x, y: p.y, t: performance.now(), hx: [] };
            b.vx = b.vy = 0;
            run();
        }

        function onMove(e) {
            if (!drag || e.pointerId !== drag.id) return;
            var p = point(e);
            var now = performance.now();
            drag.hx.push({ x: p.x, y: p.y, t: now });
            if (drag.hx.length > 6) drag.hx.shift();
            drag.x = p.x;
            drag.y = p.y;
            b.x = Math.max(R, Math.min(view.w - R, p.x));
            b.y = Math.max(R, Math.min(view.h - R - 5, p.y));
        }

        function onUp(e) {
            if (!drag || e.pointerId !== drag.id) return;
            var hx = drag.hx;
            if (hx.length >= 2) {
                var a = hx[0];
                var z = hx[hx.length - 1];
                var dt = Math.max(0.016, (z.t - a.t) / 1000);
                b.vx = Math.max(-1600, Math.min(1600, (z.x - a.x) / dt));
                b.vy = Math.max(-1600, Math.min(1600, (z.y - a.y) / dt));
            }
            drag = null;
            tick('select');
            if (live) live.textContent = 'Flicked';
            run();
        }

        function onKey(e) {
            var impulse = { ArrowLeft: [-420, -120], ArrowRight: [420, -120], ArrowUp: [0, -760], ' ': [0, -760] }[e.key];
            if (!impulse) return;
            e.preventDefault();
            b.vx += impulse[0];
            b.vy += impulse[1];
            run();
        }

        function onResize() {
            view = sizeCanvas(canvas);
            b.x = Math.min(b.x, view.w - R);
            b.y = Math.min(b.y, view.h - R - 5);
            draw();
        }

        canvas.addEventListener('pointerdown', onDown);
        canvas.addEventListener('pointermove', onMove);
        canvas.addEventListener('pointerup', onUp);
        canvas.addEventListener('pointercancel', onUp);
        canvas.addEventListener('keydown', onKey);
        window.addEventListener('resize', onResize, { passive: true });
        var io = visibleWatch(host, function (on) {
            visible = on;
            if (on) { draw(); } else if (raf) { cancelAnimationFrame(raf); raf = 0; }
        });
        draw();
        return {
            destroy: function () {
                if (raf) cancelAnimationFrame(raf);
                if (io) io.disconnect();
                window.removeEventListener('resize', onResize);
            }
        };
    }

    /* ---- Tiny Snake ------------------------------------------------------ */

    var BEST_KEY = 'jayptl-snake-best';

    function readBest() {
        try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) { return 0; }
    }

    function writeBest(n) {
        try { localStorage.setItem(BEST_KEY, String(n)); } catch (e) { /* private mode */ }
    }

    function snake(host) {
        var canvas = host.querySelector('canvas');
        var live = host.querySelector('.toy-live');
        var scoreEl = host.querySelector('.toy-score');
        var playBtn = host.querySelector('.toy-play');
        if (!canvas) return null;
        var COLS = 12;
        var ROWS = 8;
        var STEP_MS = 150;
        var view = sizeCanvas(canvas);
        var body = [];
        var dir = { x: 1, y: 0 };
        var queued = [];
        var food = null;
        var score = 0;
        var best = readBest();
        var running = false;
        var visible = false;
        var timer = 0;

        function cell() {
            return Math.min(view.w / COLS, view.h / ROWS);
        }

        function placeFood() {
            var free = [];
            for (var y = 0; y < ROWS; y++) {
                for (var x = 0; x < COLS; x++) {
                    if (!body.some(function (p) { return p.x === x && p.y === y; })) free.push({ x: x, y: y });
                }
            }
            food = free[Math.floor(Math.random() * free.length)] || null;
        }

        function reset() {
            body = [{ x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }];
            dir = { x: 1, y: 0 };
            queued = [];
            score = 0;
            placeFood();
            showScore();
        }

        function showScore() {
            if (scoreEl) scoreEl.textContent = 'score ' + score + ' \u00b7 best ' + best;
        }

        function draw() {
            var ctx = view.ctx;
            var c = cell();
            var ox = (view.w - c * COLS) / 2;
            var oy = (view.h - c * ROWS) / 2;
            var color = ink(canvas);
            ctx.clearRect(0, 0, view.w, view.h);
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.35;
            ctx.strokeRect(ox + 0.5, oy + 0.5, c * COLS - 1, c * ROWS - 1);
            ctx.globalAlpha = 1;
            if (food) {
                ctx.beginPath();
                ctx.arc(ox + (food.x + 0.5) * c, oy + (food.y + 0.5) * c, c * 0.26, 0, Math.PI * 2);
                ctx.stroke();
            }
            body.forEach(function (p, i) {
                ctx.globalAlpha = i === 0 ? 1 : 0.55 + 0.45 * (1 - i / body.length);
                ctx.fillRect(ox + p.x * c + 2, oy + p.y * c + 2, c - 4, c - 4);
            });
            ctx.globalAlpha = 1;
        }

        function over() {
            running = false;
            clearInterval(timer);
            timer = 0;
            if (score > best) {
                best = score;
                writeBest(best);
            }
            showScore();
            if (live) live.textContent = 'Game over, score ' + score + ', best ' + best + '. Press Enter to play again.';
            if (playBtn) playBtn.textContent = 'Play again';
            tick('hover');
        }

        function advance() {
            if (!visible) return;
            if (queued.length) dir = queued.shift();
            var head = { x: body[0].x + dir.x, y: body[0].y + dir.y };
            if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS ||
                body.some(function (p) { return p.x === head.x && p.y === head.y; })) {
                over();
                draw();
                return;
            }
            body.unshift(head);
            if (food && head.x === food.x && head.y === food.y) {
                score++;
                showScore();
                tick('select');
                placeFood();
            } else {
                body.pop();
            }
            draw();
        }

        function start() {
            reset();
            running = true;
            clearInterval(timer);
            timer = setInterval(advance, STEP_MS);
            if (playBtn) playBtn.textContent = 'Playing';
            if (live) live.textContent = 'Playing. Arrow keys or swipe to steer.';
            canvas.focus({ preventScroll: true });
            draw();
        }

        function turn(nx, ny) {
            var lastDir = queued.length ? queued[queued.length - 1] : dir;
            if (nx === -lastDir.x && ny === -lastDir.y) return;
            if (nx === lastDir.x && ny === lastDir.y) return;
            if (queued.length < 2) queued.push({ x: nx, y: ny });
        }

        function onKey(e) {
            var map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
            if ((e.key === 'Enter' || e.key === ' ') && !running) {
                e.preventDefault();
                start();
                return;
            }
            var m = map[e.key];
            if (!m || !running) return;
            e.preventDefault();
            turn(m[0], m[1]);
        }

        var swipe = null;
        function onDown(e) {
            swipe = { x: e.clientX, y: e.clientY };
            if (!running) start();
        }
        function onUp(e) {
            if (!swipe) return;
            var dx = e.clientX - swipe.x;
            var dy = e.clientY - swipe.y;
            swipe = null;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
            if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0);
            else turn(0, dy > 0 ? 1 : -1);
        }

        function onResize() {
            view = sizeCanvas(canvas);
            draw();
        }

        canvas.addEventListener('keydown', onKey);
        canvas.addEventListener('pointerdown', onDown);
        canvas.addEventListener('pointerup', onUp);
        canvas.style.touchAction = 'none';
        if (playBtn) playBtn.addEventListener('click', start);
        window.addEventListener('resize', onResize, { passive: true });
        var io = visibleWatch(host, function (on) {
            visible = on;
            if (!on && running) over();
        });
        reset();
        draw();
        return {
            destroy: function () {
                clearInterval(timer);
                if (io) io.disconnect();
                window.removeEventListener('resize', onResize);
            }
        };
    }

    /* ---- Saber listen button --------------------------------------------- */

    function saber(btn) {
        var note = btn.parentNode.querySelector('.toy-note');
        function onClick() {
            var s = sm();
            if (!s) return;
            var on = false;
            try { on = Boolean(s.getPrefs().master); } catch (e) { on = false; }
            if (!on) {
                if (note) {
                    note.hidden = false;
                    note.textContent = 'sound is off, press again to switch it on';
                }
                if (btn.getAttribute('data-armed') === 'true') {
                    s.setMasterEnabled(true);
                    btn.removeAttribute('data-armed');
                    if (note) note.textContent = 'sound on';
                    setTimeout(function () { try { s.playLightsaberIgnite(); } catch (e) { /* noop */ } }, 120);
                } else {
                    btn.setAttribute('data-armed', 'true');
                }
                return;
            }
            if (note) note.hidden = true;
            try { s.playLightsaberIgnite(); } catch (e) { /* noop */ }
        }
        btn.addEventListener('click', onClick);
        return { destroy: function () { btn.removeEventListener('click', onClick); } };
    }

    if (window.Mount) {
        window.Mount.register('beyond-toys', {
            selector: '[data-toy]',
            mount: function (el) {
                var kind = el.getAttribute('data-toy');
                if (kind === 'ball') return ball(el);
                if (kind === 'snake') return snake(el);
                if (kind === 'saber') return saber(el);
                return null;
            },
            unmount: function (el, state) { if (state) state.destroy(); }
        });
    }
})();
