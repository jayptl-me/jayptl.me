/**
 * View Counter: counts one read per page load through POST /v1/hit and
 * shows the numbers with the Digit Odometer.
 *
 *   <span data-component="view-count" data-scope="site" hidden>...</span>
 *   <span data-component="view-count" data-scope="page" hidden>...</span>
 *
 * Cookieless: sends only the path. One hit per page load, including
 * router swaps (page:ready). Hidden while the API is off.
 *
 * @file js/components/view-counter.js
 */
(function () {
    'use strict';

    if (window.ViewCounter) return;

    var lastPath = null;
    var pending = null;

    function path() {
        return (window.location.pathname.replace(/\/+$/, '') || '/').replace(/\.html$/, '');
    }

    function hit() {
        if (!window.SiteApi || !window.SiteApi.enabled()) return Promise.resolve(null);
        var p = path();
        if (p === lastPath && pending) return pending;
        lastPath = p;
        pending = window.SiteApi.post('/v1/hit', { path: p }).catch(function () { return null; });
        return pending;
    }

    function mount(el) {
        hit().then(function (data) {
            if (!data || !el.isConnected) return;
            var scope = el.getAttribute('data-scope') || 'site';
            var n = scope === 'page' ? data.views : data.total;
            if (typeof n !== 'number') return;
            var num = el.querySelector('[data-odometer]');
            if (num && window.DigitOdometer) window.DigitOdometer.set(num, n);
            else if (num) num.textContent = n.toLocaleString('en-US');
            el.hidden = false;
        });
        return null;
    }

    window.ViewCounter = { hit: hit };

    if (window.Mount) {
        window.Mount.register('view-count', { mount: mount });
    }
})();
