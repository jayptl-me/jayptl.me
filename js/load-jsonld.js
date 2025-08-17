// Loader to fetch external JSON-LD and inject it as a <script type="application/ld+json"> in the document head.
// Using an external file avoids inline-script CSP restrictions.
(function () {
    var url = 'assets/privacy-structured-data.json';
    if (!('fetch' in window)) return;
    fetch(url, { credentials: 'same-origin' })
        .then(function (res) {
            if (!res.ok) throw new Error('Failed to fetch JSON-LD: ' + res.status);
            return res.text();
        })
        .then(function (jsonText) {
            var parsed;
            try {
                parsed = JSON.parse(jsonText);
                // Basic validation: parsed should be an object or array
                if (typeof parsed !== 'object' || parsed === null) {
                    throw new Error('JSON-LD is not an object or array');
                }
            } catch (e) {
                // Fail silently in production but keep a console.error for debugging during development
                console.error('Invalid JSON-LD:', e);
                return;
            }

            var s = document.createElement('script');
            s.type = 'application/ld+json';
            s.textContent = JSON.stringify(parsed);
            document.head.appendChild(s);
        })
        .catch(function (err) {
            console.error('Error loading JSON-LD:', err);
        });
})();
