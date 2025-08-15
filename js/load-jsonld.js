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
            try { JSON.parse(jsonText); } catch (e) { console.error('Invalid JSON-LD:', e); }
            var s = document.createElement('script');
            s.type = 'application/ld+json';
            s.textContent = jsonText;
            document.head.appendChild(s);
        })
        .catch(function (err) {
            console.error('Error loading JSON-LD:', err);
        });
})();
