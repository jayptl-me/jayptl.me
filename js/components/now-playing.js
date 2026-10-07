/**
 * Now Playing, the Gamer card's hand note, fed by GET /v1/playing.
 *
 * The API merges Steam (in game now, or the most recent game with its
 * last-played time) with a manual entry Jay sets on the API's admin page;
 * the newest wins. This file only formats it. Hidden while the API is off
 * or has nothing to say, so the page never shows a made-up game.
 *
 *   <p class="now-playing hand" data-component="now-playing" hidden></p>
 *
 * @file js/components/now-playing.js
 */
(function () {
    'use strict';

    function ago(iso) {
        var t = new Date(iso).getTime();
        if (!isFinite(t)) return '';
        var mins = Math.max(0, Math.round((Date.now() - t) / 60000));
        if (mins < 2) return 'just now';
        if (mins < 60) return mins + ' minutes ago';
        var hours = Math.round(mins / 60);
        if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
        var days = Math.round(hours / 24);
        return days + (days === 1 ? ' day ago' : ' days ago');
    }

    function hours(minutes) {
        var h = Math.round((minutes || 0) / 6) / 10;
        return h >= 1 ? h + 'h' : Math.round(minutes || 0) + 'm';
    }

    function format(data) {
        if (!data || !data.game) return '';
        if (data.now) return 'playing ' + data.game + ' right now';
        var line = 'last played ' + data.game;
        if (data.at) line += ', ' + ago(data.at);
        if (data.recentMinutes) line += ' \u00b7 ' + hours(data.recentMinutes) + ' these two weeks';
        return line;
    }

    function mount(el) {
        if (!window.SiteApi || !window.SiteApi.enabled()) return null;
        window.SiteApi.get('/v1/playing').then(function (data) {
            var text = format(data);
            if (!text || !el.isConnected) return;
            el.textContent = text;
            el.hidden = false;
        });
        return null;
    }

    try {
        window.NowPlaying = { format: format, ago: ago };
    } catch (e) { /* noop */ }

    if (window.Mount) {
        window.Mount.register('now-playing', { mount: mount });
    }
})();
