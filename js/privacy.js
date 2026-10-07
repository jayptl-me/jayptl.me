/**
 * Privacy page actions.
 *
 * - #clearDataBtn is hold-to-confirm (press-state.js): its click only
 *   arrives after a completed 600ms hold, so there is no browser dialog.
 *   It clears stored preferences and cookies, shows the Ink Status check,
 *   says so to screen readers, then reloads.
 * - #privacySettingsBtn reopens the consent settings.
 * Delegated on document, so the buttons also work after in-place page swaps.
 *
 * @file js/privacy.js
 */
(function () {
    'use strict';

    if (window.__privacyActionsBound) return;
    window.__privacyActionsBound = true;

    function clearEverything() {
        try { localStorage.clear(); } catch (e) { /* storage may be blocked */ }
        try { sessionStorage.clear(); } catch (e) { /* storage may be blocked */ }
        document.cookie.split(';').forEach(function (c) {
            try {
                if (!c) return;
                var eq = c.indexOf('=');
                var name = (eq > -1 ? c.slice(0, eq) : c).trim();
                document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
            } catch (e) { /* best effort */ }
        });
    }

    document.addEventListener('click', function (event) {
        var target = event.target && event.target.closest ? event.target : null;
        if (!target) return;

        var clear = target.closest('#clearDataBtn');
        if (clear) {
            clearEverything();
            var done = window.PillPress
                ? window.PillPress.busy(clear, Promise.resolve(), { ok: 'All stored data cleared. Reloading the page.' })
                : Promise.resolve();
            done.then(function () {
                setTimeout(function () { window.location.reload(); }, 1100);
            });
            return;
        }

        if (target.closest('#privacySettingsBtn') && window.consentBanner) {
            window.consentBanner.showConsentSettings();
        }
    });
})();
