/**
 * Component Mount Registry, one contract for every bespoke component.
 *
 * Components register once by name. Hosts are found by
 * [data-component~="name"] (or a custom selector) and mounted on
 * DOMContentLoaded and again after every router swap (page:ready).
 * A host is never mounted twice, and hosts the router removed are
 * unmounted so observers and listeners never leak.
 *
 * Global chrome (palette, dock, edge band) registers with global: true:
 * it mounts once per document and gets refresh() on every page:ready.
 *
 * Usage:
 *   window.Mount.register('role-ledger', {
 *     mount: function (el) { ...; return state; },
 *     unmount: function (el, state) { ... }
 *   });
 *
 * @file js/components/mount.js
 */
(function () {
    'use strict';

    if (window.Mount) return;

    var registry = {};      // name -> definition
    var live = [];          // { el, name, state }
    var mounted = new WeakMap(); // el -> { name: true }

    function isReady() {
        return document.readyState !== 'loading';
    }

    function safe(fn, a, b) {
        if (typeof fn !== 'function') return undefined;
        try {
            return fn(a, b);
        } catch (e) {
            if (window.console && typeof console.error === 'function') console.error('[mount]', e);
            return undefined;
        }
    }

    function selectorFor(name, def) {
        return def.selector || '[data-component~="' + name + '"]';
    }

    function sweep() {
        live = live.filter(function (rec) {
            if (rec.el.isConnected) return true;
            var def = registry[rec.name];
            if (def) safe(def.unmount, rec.el, rec.state);
            var flags = mounted.get(rec.el);
            if (flags) delete flags[rec.name];
            return false;
        });
    }

    function mountOne(name, root) {
        var def = registry[name];
        if (!def) return;
        if (def.global) {
            if (!def._mounted) {
                def._mounted = true;
                safe(def.mount, document);
            } else if (root === document) {
                safe(def.refresh, document);
            }
            return;
        }
        var hosts;
        try {
            hosts = (root || document).querySelectorAll(selectorFor(name, def));
        } catch (e) {
            return;
        }
        for (var i = 0; i < hosts.length; i++) {
            var el = hosts[i];
            var flags = mounted.get(el);
            if (flags && flags[name]) continue;
            if (!flags) {
                flags = {};
                mounted.set(el, flags);
            }
            flags[name] = true;
            live.push({ el: el, name: name, state: safe(def.mount, el) });
        }
    }

    function scan(root) {
        sweep();
        Object.keys(registry).forEach(function (name) {
            mountOne(name, root || document);
        });
    }

    function register(name, def) {
        if (!name || !def || registry[name]) return;
        registry[name] = def;
        if (isReady()) mountOne(name, document);
    }

    if (!isReady()) {
        document.addEventListener('DOMContentLoaded', function () { scan(document); });
    }
    window.addEventListener('page:ready', function () { scan(document); });

    window.Mount = {
        register: register,
        scan: scan
    };
})();
