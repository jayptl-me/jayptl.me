// Theme detection script extracted from index.html to allow CSP without 'unsafe-inline'
(function () {
    /**
     * Retrieve the user's saved color theme preference, if any.
     *
     * Attempts to read 'user-theme-preference' from localStorage (accepting 'light' or 'dark').
     * If unavailable or inaccessible, falls back to a cookie named 'preferred-theme' (accepting 'light' or 'dark').
     * When a valid value is read from the cookie, the function attempts to migrate it into localStorage (errors ignored).
     * All storage and cookie access errors are silently ignored.
     *
     * @return {'light'|'dark'|null} The stored theme value, or null if none is found or accessible.
     */
    function getStoredTheme() {
        // Try localStorage first (primary method)
        try {
            const stored = localStorage.getItem('user-theme-preference');
            if (stored && (stored === 'light' || stored === 'dark')) {
                return stored;
            }
        } catch (e) {
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
                    } catch (e) {
                        // Silent fail for migration
                    }
                    return theme;
                }
            }
        } catch (e) {
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
})();
