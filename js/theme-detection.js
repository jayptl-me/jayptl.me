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
        const noop = function () {};
        const patched = function (query) {
            const real = nativeMatch.call(window, query);
            if (document.documentElement.getAttribute('data-motion') !== 'reduce' || !/prefers-reduced-motion/i.test(query)) return real;
            const want = /:\s*reduce/i.test(query);
            if (real.matches === want) return real;
            return { matches: want, media: real.media, onchange: null, addListener: noop, removeListener: noop, addEventListener: noop, removeEventListener: noop, dispatchEvent: function () { return false; } };
        };
        patched.jayptlMotion = true;
        window.matchMedia = patched;
    }
})();
