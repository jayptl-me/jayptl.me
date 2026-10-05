/**
 * Site API client, the one place the static site talks to the API
 * service (services/api). Page views, uptime, bookings and "now playing"
 * all go through here.
 *
 * API_BASE stays empty until the service is deployed. While it is empty
 * every call resolves to null, so the site shows no counter, no status
 * and a plain email fallback, never fake numbers. When you deploy:
 *   1. set API_BASE below (e.g. 'https://api.jayptl.me'),
 *   2. add the same origin to connect-src in scripts/security-headers.js
 *      (tests/security-headers.test.mjs checks they match).
 *
 * @file js/components/site-api.js
 */
(function () {
    'use strict';

    if (window.SiteApi) return;

    var API_BASE = '';
    var TIMEOUT_MS = 8000;

    function request(method, path, body) {
        if (!API_BASE) return Promise.resolve(null);
        var controller = null;
        try { controller = new AbortController(); } catch (e) { controller = null; }
        var timer = controller ? setTimeout(function () { controller.abort(); }, TIMEOUT_MS) : null;
        var opts = {
            method: method,
            mode: 'cors',
            credentials: 'omit',
            headers: { Accept: 'application/json' }
        };
        if (body !== undefined) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
        if (controller) opts.signal = controller.signal;
        return fetch(API_BASE + path, opts).then(function (res) {
            if (timer) clearTimeout(timer);
            return res.json().catch(function () { return {}; }).then(function (data) {
                if (!res.ok) {
                    var err = new Error((data && data.error) || ('HTTP ' + res.status));
                    err.status = res.status;
                    err.data = data;
                    throw err;
                }
                return data;
            });
        }, function (err) {
            if (timer) clearTimeout(timer);
            throw err;
        });
    }

    window.SiteApi = {
        base: API_BASE,
        enabled: function () { return Boolean(API_BASE); },
        get: function (path) { return request('GET', path).catch(function () { return null; }); },
        post: function (path, body) { return request('POST', path, body); }
    };
})();
