/**
 * Control Dock, a small floating cluster at the bottom right on desktop:
 * Command Deck button, sound toggle, and back to top with a scroll
 * progress ring. Theme stays on the navbar lightsaber, never duplicated.
 *
 * Brief (docs/motion-zen.md section 6a, picked "After the first screen"):
 * fine pointers from 861px only. Fades in 240ms (snap) once the page has
 * scrolled one screen, fades out 140ms above that. The ring is a readout
 * that follows scroll directly, with no easing of its own. Back to top
 * uses the Glide Wheel's ease when it is available. Reduced motion: shows
 * and hides at once, back to top jumps.
 *
 * @file js/components/control-dock.js
 */
(function () {
    'use strict';

    if (!window.Mount) return;

    var RING = 2 * Math.PI * 15; // circumference for r=15

    var dock = null;
    var ring = null;
    var soundBtn = null;
    var ticking = false;

    function reduced() {
        try {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) {
            return false;
        }
    }

    function stepperHolds() {
        var overlay = document.querySelector('.text-reveal-container');
        return Boolean(overlay && !overlay.classList.contains('released'));
    }

    function soundOn() {
        try {
            return Boolean(window.SoundManager && window.SoundManager.getPrefs().master);
        } catch (e) {
            return false;
        }
    }

    function syncSound() {
        if (!soundBtn) return;
        var on = soundOn();
        soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        soundBtn.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');
        soundBtn.classList.toggle('is-on', on);
    }

    function update() {
        ticking = false;
        if (!dock) return;
        var doc = document.documentElement;
        var max = Math.max(1, doc.scrollHeight - window.innerHeight);
        var y = window.scrollY;
        var progress = Math.min(1, Math.max(0, y / max));
        ring.style.strokeDashoffset = String(RING * (1 - progress));
        var show = y >= window.innerHeight && !stepperHolds();
        if (dock.classList.contains('is-shown') !== show) {
            dock.classList.toggle('is-shown', show);
            dock.toggleAttribute('inert', !show);
        }
    }

    function queue() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(update);
    }

    function toTop() {
        if (window.ScrollGlide && !reduced()) {
            window.ScrollGlide.to(0);
        } else {
            window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
        }
        try {
            var skip = document.querySelector('.skip-link') || document.getElementById('glassNavBrand');
            if (skip) skip.focus({ preventScroll: true });
        } catch (e) { /* noop */ }
    }

    function mount() {
        dock = document.createElement('div');
        dock.className = 'control-dock';
        dock.setAttribute('role', 'toolbar');
        dock.setAttribute('aria-label', 'Page controls');
        dock.setAttribute('inert', '');
        dock.innerHTML =
            '<button class="dock-btn" type="button" data-deck-open aria-haspopup="dialog" aria-label="Open command deck">' +
            '  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
            '</button>' +
            '<button class="dock-btn dock-sound" type="button" aria-pressed="false" aria-label="Turn sound on">' +
            '  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path class="dock-wave" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path class="dock-mute" d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' +
            '</button>' +
            '<button class="dock-btn dock-top" type="button" aria-label="Back to top">' +
            '  <svg class="dock-ring" viewBox="0 0 36 36" aria-hidden="true" focusable="false">' +
            '    <circle class="dock-ring-track" cx="18" cy="18" r="15"/>' +
            '    <circle class="dock-ring-fill" cx="18" cy="18" r="15"/>' +
            '  </svg>' +
            '  <svg class="dock-arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 18V6M7 11l5-5 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '</button>';
        document.body.appendChild(dock);
        ring = dock.querySelector('.dock-ring-fill');
        ring.style.strokeDasharray = String(RING);
        soundBtn = dock.querySelector('.dock-sound');

        soundBtn.addEventListener('click', function () {
            try {
                if (window.SoundManager) window.SoundManager.setMasterEnabled(!soundOn());
            } catch (e) { /* noop */ }
            syncSound();
        });
        dock.querySelector('.dock-top').addEventListener('click', toTop);
        dock.querySelectorAll('.dock-btn').forEach(function (b) {
            b.addEventListener('pointerenter', function () {
                try {
                    if (window.SoundManager && typeof window.SoundManager.playHoverSound === 'function') {
                        window.SoundManager.playHoverSound();
                    }
                } catch (e) { /* noop */ }
            });
        });

        window.addEventListener('scroll', queue, { passive: true });
        window.addEventListener('resize', queue, { passive: true });
        window.addEventListener('soundchange', syncSound);
        syncSound();
        update();
    }

    function refresh() {
        if (dock && !dock.isConnected) document.body.appendChild(dock);
        syncSound();
        queue();
    }

    window.Mount.register('control-dock', { global: true, mount: mount, refresh: refresh });
})();
