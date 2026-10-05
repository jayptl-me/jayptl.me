/**
 * Uptime Strip and status dot: real API health from GET /v1/status.
 *
 *   <span data-component="api-dot" hidden></span>     footer dot + label
 *   <div data-component="uptime-strip" hidden></div>  30 bars, one per day
 *
 * /v1/status returns { ok, redis, lastTick, uptime24h, uptime30d, days: [{ date, uptime }] }
 * where uptime is the share of minutes that recorded a heartbeat. Both
 * hosts stay hidden while the API is off, so nothing fake is ever shown.
 * Static, no motion.
 *
 * @file js/components/api-status.js
 */
(function () {
    'use strict';

    var cache = null;

    function status() {
        if (!window.SiteApi || !window.SiteApi.enabled()) return Promise.resolve(null);
        if (!cache) cache = window.SiteApi.get('/v1/status');
        return cache;
    }

    function pct(n) {
        return (Math.floor(Number(n || 0) * 1000) / 10).toFixed(1) + '%';
    }

    function mountDot(el) {
        status().then(function (s) {
            if (!s || !el.isConnected) return;
            var healthy = s.ok && s.redis;
            el.classList.add('api-dot', healthy ? 'is-up' : 'is-down');
            el.textContent = '';
            var dot = document.createElement('span');
            dot.className = 'api-dot-light';
            dot.setAttribute('aria-hidden', 'true');
            el.appendChild(dot);
            var link = document.createElement('a');
            link.href = '/colophon#uptime';
            link.textContent = healthy ? 'API up, ' + pct(s.uptime30d) + ' this month' : 'API having a moment';
            el.appendChild(link);
            el.hidden = false;
        });
        return null;
    }

    function mountStrip(el) {
        status().then(function (s) {
            if (!s || !el.isConnected || !Array.isArray(s.days)) return;
            el.textContent = '';
            var head = document.createElement('p');
            head.className = 'uptime-head hud-readout';
            head.textContent = pct(s.uptime30d) + ' uptime, last 30 days \u00b7 ' + pct(s.uptime24h) + ' last 24 hours';
            var bars = document.createElement('ol');
            bars.className = 'uptime-bars';
            bars.setAttribute('aria-label', 'Daily uptime, oldest first');
            s.days.slice(-30).forEach(function (d) {
                var li = document.createElement('li');
                var u = Number(d.uptime);
                li.className = 'uptime-bar' + (u >= 0.99 ? ' is-full' : u >= 0.9 ? ' is-dip' : ' is-down');
                li.style.setProperty('--u', String(Math.max(0.08, Math.min(1, u))));
                li.title = d.date + ': ' + pct(u);
                var sr = document.createElement('span');
                sr.className = 'sr-only';
                sr.textContent = d.date + ', ' + pct(u);
                li.appendChild(sr);
                bars.appendChild(li);
            });
            el.appendChild(head);
            el.appendChild(bars);
            el.hidden = false;
        });
        return null;
    }

    if (window.Mount) {
        window.Mount.register('api-dot', { mount: mountDot });
        window.Mount.register('uptime-strip', { mount: mountStrip });
    }
})();
