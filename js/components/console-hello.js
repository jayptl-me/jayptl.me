/**
 * A hello in the browser console for developers who open DevTools (D-194,
 * ASCII ideas): a small ASCII card, once per visit. Plain ASCII so every
 * console font lines it up; no network, no storage beyond one session flag.
 *
 * @file components/console-hello.js
 */
(function () {
    'use strict';

    var CARD = [
        '.------------------------------------.',
        '|  jayptl.me                         |',
        '|  hand-written HTML, CSS and JS.    |',
        '|  no framework, no UI kit, no CDN.  |',
        '|                                    |',
        '|  curious how it works? /colophon   |',
        '|  say hi: hello@jayptl.me           |',
        "'------------------------------------'"
    ];

    function hello() {
        try {
            if (window.sessionStorage.getItem('jayptl.hello')) return;
            window.sessionStorage.setItem('jayptl.hello', '1');
        } catch {
            // Storage blocked: say hello anyway, once per load.
        }
        try {
            var dark = document.documentElement.getAttribute('data-theme') === 'dark';
            window.console.log('%c' + CARD.join('\n'), 'font-family: monospace; line-height: 1.25; color: ' + (dark ? '#00b8cc' : '#1565c0'));
        } catch {
            // The console is optional.
        }
    }

    window.JayptlHello = { CARD: CARD };
    hello();
})();
