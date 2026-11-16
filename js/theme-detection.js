// Theme detection script extracted from index.html to allow CSP without 'unsafe-inline'
(function () {
    function getStoredTheme() {
        // Try localStorage first (primary method)
        try {
            const stored = localStorage.getItem('user-theme-preference');
            if (stored && (stored === 'light' || stored === 'dark')) {
                return stored;
            }
        } catch {
            // Silent fail for localStorage
        }

        // Fallback to cookie
        try {
            const cookies = document.cookie.split('; ');
            const themeCookie = cookies.find(row => row.startsWith('preferred-theme='));
            if (themeCookie) {
                const theme = themeCookie.split('=')[1];
                if (theme === 'light' || theme === 'dark') {
                    // Migrate cookie value to localStorage for future use
                    try {
                        localStorage.setItem('user-theme-preference', theme);
                    } catch {
                        // Silent fail for migration
                    }
                    return theme;
                }
            }
        } catch {
            // Silent fail for cookie access
        }

        return null;
    }

    const savedTheme = getStoredTheme();
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');

    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    // Mark JS-enabled
    document.documentElement.classList.remove('no-js');
    document.documentElement.classList.add('js');

    // Reduce motion switch (D-49): the visitor's stored choice beats the device.
    // CSS reads data-motion (the build copies every reduced-motion rule under
    // it); scripts ask matchMedia, which answers to the switch while it is on.
    // index.html carries the same rule in its inline script (parity test).
    try {
        if (localStorage.getItem('jayptl.motion') === 'reduce') {
            document.documentElement.setAttribute('data-motion', 'reduce');
        }
    } catch {
        // Storage blocked: follow the device setting
    }
    const nativeMatch = window.matchMedia;
    if (nativeMatch && !nativeMatch.jayptlMotion) {
        const root = document.documentElement;
        // A live list: .matches is read fresh every time, and 'change' listeners
        // hear both the device setting and the switch (the navbar fires
        // motion:change), so components that hold the list update mid-visit.
        const patched = function (query) {
            const real = nativeMatch.call(window, query);
            if (!/prefers-reduced-motion/i.test(query)) return real;
            const want = /:\s*reduce/i.test(query);
            const relays = new Map();
            const live = {
                media: real.media,
                onchange: null,
                get matches() { return root.getAttribute('data-motion') === 'reduce' ? want : real.matches; },
                addEventListener: function (type, fn) {
                    if (type !== 'change' || typeof fn !== 'function' || relays.has(fn)) return;
                    const relay = function () { fn.call(live, { matches: live.matches, media: live.media }); };
                    relays.set(fn, relay);
                    if (real.addEventListener) real.addEventListener('change', relay);
                    else if (real.addListener) real.addListener(relay);
                    window.addEventListener('motion:change', relay);
                },
                removeEventListener: function (type, fn) {
                    const relay = relays.get(fn);
                    if (type !== 'change' || !relay) return;
                    relays.delete(fn);
                    if (real.removeEventListener) real.removeEventListener('change', relay);
                    else if (real.removeListener) real.removeListener(relay);
                    window.removeEventListener('motion:change', relay);
                },
                addListener: function (fn) { live.addEventListener('change', fn); },
                removeListener: function (fn) { live.removeEventListener('change', fn); },
                dispatchEvent: function () { return false; }
            };
            return live;
        };
        patched.jayptlMotion = true;
        patched.native = nativeMatch;
        window.matchMedia = patched;
    }
})();
