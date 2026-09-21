/**
 * Audio Toggle Component
 * Bespoke HUD control for the full site score. Mounts inside the
 * floating nav next to the theme toggle, falls back to a fixed
 * corner button when the nav is absent.
 *
 * Default off. Every switch persists to SoundManager prefs and
 * announces through the soundchange event. Zero audio files.
 *
 * @file js/components/audio-toggle.js
 * @author Jay Patel
 */
(function () {
    'use strict';

    function prefs() {
        try {
            if (window.SoundManager && typeof window.SoundManager.getPrefs === 'function') {
                return window.SoundManager.getPrefs();
            }
        } catch (e) { /* noop */ }
        return { master: false, bed: false, motifs: false, level: 'low' };
    }

    function setMaster(on) {
        try {
            if (window.SoundManager) return window.SoundManager.setMasterEnabled(on);
        } catch (e) { /* noop */ }
        return on;
    }

    function setBed(on) {
        try {
            if (window.SoundManager) return window.SoundManager.setBedEnabled(on);
        } catch (e) { /* noop */ }
        return on;
    }

    function setMotifs(on) {
        try {
            if (window.SoundManager) return window.SoundManager.setMotifsEnabled(on);
        } catch (e) { /* noop */ }
        return on;
    }

    function setLevel(level) {
        try {
            if (window.SoundManager) return window.SoundManager.setVolumeLevel(level);
        } catch (e) { /* noop */ }
        return level;
    }

    function speakerSVG() {
        return '' +
            '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">' +
            '<path d="M4 9v6h4l5 4V5L8 9H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
            '<g class="audio-waves">' +
            '<path d="M16 9c1.2 1.5 1.2 4.5 0 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
            '<path d="M18.2 7c2 2.4 2 7.6 0 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>' +
            '</g>' +
            '<line class="audio-slash" x1="3" y1="3" x2="21" y2="21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
            '</svg>';
    }

    function buildPanel() {
        var panel = document.createElement('div');
        panel.className = 'audio-panel';
        panel.id = 'audioPanel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Sound options');
        panel.hidden = true;
        panel.innerHTML = '' +
            '<p class="audio-panel-title hud-label">Sound</p>' +
            '<div class="audio-row">' +
            '<span id="audioMasterLabel">Master</span>' +
            '<button type="button" class="audio-switch" id="audioMasterSwitch" role="switch" aria-checked="false" aria-labelledby="audioMasterLabel">Off</button>' +
            '</div>' +
            '<div class="audio-row">' +
            '<span id="audioBedLabel">Serene bed</span>' +
            '<button type="button" class="audio-switch" id="audioBedSwitch" role="switch" aria-checked="false" aria-labelledby="audioBedLabel">Off</button>' +
            '</div>' +
            '<div class="audio-row">' +
            '<span id="audioMotifLabel">Motifs</span>' +
            '<button type="button" class="audio-switch" id="audioMotifSwitch" role="switch" aria-checked="false" aria-labelledby="audioMotifLabel">Off</button>' +
            '</div>' +
            '<div class="audio-row">' +
            '<span id="audioLevelLabel">Volume</span>' +
            '<div class="audio-seg" role="group" aria-labelledby="audioLevelLabel">' +
            '<button type="button" class="audio-seg-btn" id="audioLevelLow">Low</button>' +
            '<button type="button" class="audio-seg-btn" id="audioLevelMed">Med</button>' +
            '</div>' +
            '</div>' +
            '<p class="audio-hint">Serene pad, synthesized live. No files, no tracking.</p>';
        return panel;
    }

    function sync(btn, panel) {
        var p = prefs();
        try {
            btn.setAttribute('aria-pressed', p.master ? 'true' : 'false');
            btn.setAttribute('aria-label', p.master ? 'Turn sound off' : 'Turn sound on');
            btn.classList.toggle('is-on', p.master);
        } catch (e) { /* noop */ }
        if (!panel) return;
        try {
            var master = panel.querySelector('#audioMasterSwitch');
            var bed = panel.querySelector('#audioBedSwitch');
            var motif = panel.querySelector('#audioMotifSwitch');
            var low = panel.querySelector('#audioLevelLow');
            var med = panel.querySelector('#audioLevelMed');
            if (master) {
                master.setAttribute('aria-checked', p.master ? 'true' : 'false');
                master.textContent = p.master ? 'On' : 'Off';
                master.classList.toggle('is-on', p.master);
            }
            if (bed) {
                bed.setAttribute('aria-checked', p.bed ? 'true' : 'false');
                bed.textContent = p.bed ? 'On' : 'Off';
                bed.classList.toggle('is-on', p.bed);
                bed.disabled = !p.master;
            }
            if (motif) {
                motif.setAttribute('aria-checked', p.motifs ? 'true' : 'false');
                motif.textContent = p.motifs ? 'On' : 'Off';
                motif.classList.toggle('is-on', p.motifs);
                motif.disabled = !p.master;
            }
            if (low && med) {
                low.classList.toggle('is-on', p.level !== 'med');
                med.classList.toggle('is-on', p.level === 'med');
            }
        } catch (e) { /* noop */ }
    }

    function mount() {
        if (document.getElementById('audioToggle')) return true;

        var host = null;
        try {
            var nav = document.getElementById('glassNav');
            host = nav ? nav.querySelector('.nav-controls') : null;
        } catch (e) { host = null; }

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'audio-toggle';
        btn.id = 'audioToggle';
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('aria-label', 'Turn sound on');
        btn.setAttribute('aria-haspopup', 'dialog');
        btn.innerHTML = speakerSVG();

        var panel = buildPanel();

        function closePanel() {
            panel.hidden = true;
            btn.setAttribute('aria-expanded', 'false');
        }

        function togglePanel() {
            panel.hidden = !panel.hidden;
            btn.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
            if (!panel.hidden) {
                sync(btn, panel);
                var first = panel.querySelector('.audio-switch');
                if (first) {
                    try { first.focus({ preventScroll: true }); } catch (e) { /* noop */ }
                }
            }
        }

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            // Plain click toggles master for speed. Long panel stays
            // available through the options below, not hidden here.
            // Single click on the icon toggles the panel so bed and
            // motifs stay discoverable. Master flips inside the panel.
            togglePanel();
        });

        panel.addEventListener('click', function (e) {
            var t = e.target && e.target.closest ? e.target.closest('button') : null;
            if (!t) return;
            if (t.id === 'audioMasterSwitch') {
                var next = !prefs().master;
                setMaster(next);
                if (next && window.SoundManager) {
                    try { window.SoundManager.playSelectSound(); } catch (err) { /* silent */ }
                }
            } else if (t.id === 'audioBedSwitch') {
                setBed(!prefs().bed);
            } else if (t.id === 'audioMotifSwitch') {
                setMotifs(!prefs().motifs);
            } else if (t.id === 'audioLevelLow') {
                setLevel('low');
            } else if (t.id === 'audioLevelMed') {
                setLevel('med');
            }
            sync(btn, panel);
        });

        document.addEventListener('click', function (e) {
            if (panel.hidden) return;
            if (panel.contains(e.target) || btn.contains(e.target)) return;
            closePanel();
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !panel.hidden) {
                closePanel();
                try { btn.focus({ preventScroll: true }); } catch (err) { /* noop */ }
            }
        });

        window.addEventListener('soundchange', function () {
            sync(btn, panel);
        });

        if (host) {
            try {
                var themeBtn = host.querySelector('.theme-toggle');
                if (themeBtn && themeBtn.parentNode) {
                    themeBtn.parentNode.insertBefore(btn, themeBtn.nextSibling);
                } else {
                    host.appendChild(btn);
                }
                // Panel lives next to the button for easy positioning.
                btn.parentNode.insertBefore(panel, btn.nextSibling);
                sync(btn, panel);
                return true;
            } catch (e) { /* fall through to floating */ }
        }

        // Fallback floating control when the island nav is absent.
        try {
            btn.classList.add('audio-toggle--floating');
            panel.classList.add('audio-panel--floating');
            document.body.appendChild(btn);
            document.body.appendChild(panel);
            sync(btn, panel);
            return true;
        } catch (e) {
            return false;
        }
    }

    function init() {
        if (mount()) return;
        // Navbar injects async, so retry briefly until it lands.
        var tries = 0;
        var timer = setInterval(function () {
            tries += 1;
            if (mount() || tries > 20) {
                clearInterval(timer);
            }
        }, 250);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    window.addEventListener('page:ready', function () {
        // Router swaps main but keeps the shell. Re mount is cheap
        // and keeps the toggle alive across soft navigations.
        try { mount(); } catch (e) { /* noop */ }
    });
})();
