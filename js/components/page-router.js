/**
 * Page Router — bespoke seamless navigation for the static site.
 *
 * Intercepts same-origin document navigations, fetches the next document,
 * swaps the content region in place, and updates history — so the browser
 * tab spinner never appears and the shell (navigation, theme, audio,
 * cursor) persists across pages.
 *
 * Design constraints honoured:
 * - Hand-written vanilla JS, zero dependencies, zero network calls beyond
 *   the destination document plus its own declared assets.
 * - Pure static hosting safe: consumes the same dist/*.html files that
 *   full navigations use. No server API.
 * - Progressive enhancement: links stay real, no-JS and fetch failures
 *   fall back to standard navigation. Homepage entry always uses a full
 *   load so its opening cinema runs from a clean state.
 *
 * @file js/components/page-router.js
 */
(function () {
    'use strict';

    var CACHE_LIMIT = 8;
    var CACHE_TTL = 60000;
    var FETCH_TIMEOUT = 8000;
    var ASSET_TIMEOUT = 3000;
    var COVER_DURATION = 380;
    var UNCOVER_DURATION = 600;

    var cache = new Map(); // url -> { text, at }
    var navigating = false;
    var currentUrl = null;

    try {
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    } catch (e) { /* advisory */ }

    function reduceMotion() {
        try {
            return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) {
            return false;
        }
    }

    function isHomeDocument(doc) {
        try {
            return Boolean(doc.getElementById('preloader') || doc.querySelector('.text-reveal-container'));
        } catch (e) {
            return false;
        }
    }

    function sameOrigin(url) {
        try {
            return new URL(url, window.location.href).origin === window.location.origin;
        } catch (e) {
            return false;
        }
    }

    function normalize(url) {
        try {
            var u = new URL(url, window.location.href);
            u.hash = '';
            return u.href;
        } catch (e) {
            return null;
        }
    }

    /**
     * Whether the router owns navigation for this anchor. Pages owning the
     * opening cinema (homepage in either direction) stay on full loads.
     */
    function handles(anchor) {
        if (!anchor || !anchor.href) return false;
        if (navigating) return false;
        if (anchor.target === '_blank') return false;
        if (anchor.hasAttribute('download')) return false;
        try {
            if (anchor.origin !== window.location.origin) return false;
        } catch (e) {
            if (!sameOrigin(anchor.href)) return false;
        }
        var href = anchor.getAttribute('href') || '';
        if (href.charAt(0) === '#') return false;
        if (/^(mailto|tel|sms):/i.test(href)) return false;
        var dest;
        try {
            dest = new URL(anchor.href, window.location.href);
        } catch (e) {
            return false;
        }
        var current;
        try {
            current = new URL(window.location.href);
        } catch (e) {
            return false;
        }
        // Same-document hash moves stay native.
        if (dest.pathname === current.pathname && dest.search === current.search) return false;
        // Homepage entry always boots clean so its cinema runs once, fully.
        var path = dest.pathname.replace(/\/+$/, '') || '/';
        if (path === '/') return false;
        if (isHomeDocument(document)) {
            // Homepage exit is owned: the stepper is torn down in teardownHome().
        }
        return true;
    }

    function fetchDocument(url) {
        var cached = cache.get(url);
        if (cached && (Date.now() - cached.at) < CACHE_TTL) return Promise.resolve(cached.text);
        var controller = null;
        try {
            controller = new AbortController();
        } catch (e) { controller = null; }
        var timer = null;
        if (controller) {
            timer = setTimeout(function () {
                try { controller.abort(); } catch (e) { /* noop */ }
            }, FETCH_TIMEOUT);
        }
        var options = { credentials: 'same-origin', headers: { Accept: 'text/html' } };
        if (controller) options.signal = controller.signal;
        return fetch(url, options).then(function (res) {
            if (timer) clearTimeout(timer);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            var type = res.headers ? (res.headers.get('content-type') || '') : '';
            if (type && type.indexOf('text/html') === -1) throw new Error('non-html');
            return res.text();
        }).then(function (text) {
            if (cache.size >= CACHE_LIMIT) {
                var oldest = cache.keys().next();
                if (!oldest.done) cache.delete(oldest.value);
            }
            cache.set(url, { text: text, at: Date.now() });
            return text;
        }).catch(function (err) {
            if (timer) clearTimeout(timer);
            cache.delete(url);
            throw err;
        });
    }

    function prefetch(url) {
        var key = normalize(url);
        if (!key) return;
        if (cache.has(key)) return;
        try {
            fetchDocument(key).catch(function () { /* fire and forget */ });
        } catch (e) { /* noop */ }
    }

    function parseDocument(text) {
        try {
            var parser = new DOMParser();
            var doc = parser.parseFromString(text, 'text/html');
            if (!doc || !doc.querySelector('main')) return null;
            return doc;
        } catch (e) {
            return null;
        }
    }

    function ensureVeil() {
        var veil = document.getElementById('ptVeil');
        if (!veil) {
            veil = document.createElement('div');
            veil.className = 'pt-veil';
            veil.id = 'ptVeil';
            veil.setAttribute('aria-hidden', 'true');
            document.body.insertBefore(veil, document.body.firstChild);
        } else {
            veil.style.display = '';
        }
        return veil;
    }

    function teardownHome() {
        try {
            if (window.scrollRevealComponent && typeof window.scrollRevealComponent.destroy === 'function') {
                window.scrollRevealComponent.destroy();
            }
        } catch (e) { /* noop */ }
        try {
            window.scrollRevealComponent = null;
        } catch (e) { /* noop */ }
        try {
            if (window.scrollStack && typeof window.scrollStack.destroy === 'function') {
                window.scrollStack.destroy();
            }
        } catch (e) { /* noop */ }
        try {
            window.scrollStack = null;
        } catch (e) { /* noop */ }
        try {
            var preloader = document.getElementById('preloader');
            if (preloader && preloader.parentNode) preloader.parentNode.removeChild(preloader);
        } catch (e) { /* noop */ }
        try {
            document.body.classList.remove('preloading', 'no-scroll', 'nav-open');
        } catch (e) { /* noop */ }
    }

    function syncHead(doc) {
        try { document.title = doc.title || document.title; } catch (e) { /* noop */ }
        function setMeta(selector, attr, value) {
            if (value == null) return;
            try {
                var el = document.head.querySelector(selector);
                if (el) el.setAttribute(attr, value);
            } catch (e) { /* noop */ }
        }
        try {
            var canon = doc.querySelector('link[rel="canonical"]');
            setMeta('link[rel="canonical"]', 'href', canon && canon.getAttribute('href'));
        } catch (e) { /* noop */ }
        try {
            var desc = doc.querySelector('meta[name="description"]');
            setMeta('meta[name="description"]', 'content', desc && desc.getAttribute('content'));
        } catch (e) { /* noop */ }
        try {
            var ogUrl = doc.querySelector('meta[property="og:url"]');
            setMeta('meta[property="og:url"]', 'content', ogUrl && ogUrl.getAttribute('content'));
            var ogTitle = doc.querySelector('meta[property="og:title"]');
            setMeta('meta[property="og:title"]', 'content', ogTitle && ogTitle.getAttribute('content'));
            var ogDesc = doc.querySelector('meta[property="og:description"]');
            setMeta('meta[property="og:description"]', 'content', ogDesc && ogDesc.getAttribute('content'));
        } catch (e) { /* noop */ }
        try {
            var md = doc.querySelector('link[rel="alternate"][type="text/markdown"]');
            var curMd = document.head.querySelector('link[rel="alternate"][type="text/markdown"]');
            if (md && curMd) curMd.setAttribute('href', md.getAttribute('href'));
            else if (md && !curMd) document.head.appendChild(md.cloneNode(false));
            else if (!md && curMd && curMd.parentNode) curMd.parentNode.removeChild(curMd);
        } catch (e) { /* noop */ }
        try {
            var fresh = doc.querySelectorAll('script[type="application/ld+json"]');
            var stale = document.head.querySelectorAll('script[type="application/ld+json"]');
            for (var i = 0; i < stale.length; i++) {
                if (stale[i].parentNode) stale[i].parentNode.removeChild(stale[i]);
            }
            for (var j = 0; j < fresh.length; j++) {
                var clone = document.createElement('script');
                clone.type = 'application/ld+json';
                clone.textContent = fresh[j].textContent;
                document.head.appendChild(clone);
            }
        } catch (e) { /* noop */ }
    }

    function currentPageStyles() {
        try {
            return Array.from(document.querySelectorAll('link[rel="stylesheet"][href^="/css/pages/"]'));
        } catch (e) {
            return [];
        }
    }

    function syncPageStyles(doc) {
        var wanted = [];
        try {
            wanted = Array.from(doc.querySelectorAll('link[rel="stylesheet"][href^="/css/pages/"]'))
                .map(function (l) { return l.getAttribute('href'); })
                .filter(Boolean);
        } catch (e) { wanted = []; }
        var existing = currentPageStyles();
        var keep = {};
        wanted.forEach(function (h) { keep[h] = true; });
        existing.forEach(function (link) {
            var href = link.getAttribute('href');
            if (!keep[href] && link.parentNode) link.parentNode.removeChild(link);
        });
        var pending = [];
        wanted.forEach(function (href) {
            if (document.querySelector('link[rel="stylesheet"][href="' + href + '"]')) return;
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            var done = new Promise(function (resolve) {
                var settled = false;
                function settle() { if (!settled) { settled = true; resolve(); } }
                link.onload = settle;
                link.onerror = settle;
                setTimeout(settle, ASSET_TIMEOUT);
            });
            try {
                (document.head || document.documentElement).appendChild(link);
            } catch (e) { /* noop */ }
            pending.push(done);
        });
        return Promise.all(pending);
    }

    function currentScriptSrcs() {
        var set = {};
        try {
            Array.from(document.querySelectorAll('script[src]')).forEach(function (s) {
                var src = s.getAttribute('src');
                if (src) set[src] = true;
            });
        } catch (e) { /* noop */ }
        return set;
    }

    function loadMissingScripts(doc) {
        var have = currentScriptSrcs();
        var missing = [];
        try {
            Array.from(doc.querySelectorAll('script[defer][src^="/js/"]')).forEach(function (s) {
                var src = s.getAttribute('src');
                if (src && !have[src] && missing.indexOf(src) === -1) missing.push(src);
            });
        } catch (e) { missing = []; }
        var chain = Promise.resolve();
        missing.forEach(function (src) {
            chain = chain.then(function () {
                return new Promise(function (resolve) {
                    var script = document.createElement('script');
                    script.src = src;
                    script.async = false;
                    var settled = false;
                    function settle() { if (!settled) { settled = true; resolve(); } }
                    script.onload = settle;
                    script.onerror = settle;
                    setTimeout(settle, ASSET_TIMEOUT);
                    try {
                        document.body.appendChild(script);
                    } catch (e) {
                        settle();
                    }
                });
            });
        });
        return chain;
    }

    function swapBody(doc) {
        var freshMain = doc.querySelector('main');
        var liveMain = document.querySelector('main');
        if (!freshMain || !liveMain) return false;
        var imported = document.importNode(freshMain, true);
        try {
            // Fresh content starts hidden for the staged entry.
            imported.classList.add('pt-swapped');
        } catch (e) { /* noop */ }
        liveMain.parentNode.replaceChild(imported, liveMain);
        try {
            var liveFooters = Array.from(document.querySelectorAll('body > footer'));
            liveFooters.forEach(function (f) {
                if (f.parentNode) f.parentNode.removeChild(f);
            });
            var freshFooters = Array.from(doc.querySelectorAll('body > footer'));
            var anchor = document.querySelector('main');
            freshFooters.forEach(function (f) {
                var node = document.importNode(f, true);
                if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(node, anchor.nextSibling);
                else document.body.appendChild(node);
                anchor = node;
            });
        } catch (e) { /* noop */ }
        try {
            var freshBody = doc.body;
            if (freshBody) {
                var cls = freshBody.getAttribute('class');
                if (cls != null) document.body.setAttribute('class', cls);
                var dt = freshBody.getAttribute('data-transition');
                if (dt != null) document.body.setAttribute('data-transition', dt);
                document.body.classList.remove('preloading', 'no-scroll', 'nav-open');
            }
        } catch (e) { /* noop */ }
        return true;
    }

    function reinitComponents() {
        try {
            if (window.SplitText && typeof window.SplitText.init === 'function') window.SplitText.init();
        } catch (e) { /* noop */ }
        try {
            if (window.ParticleText && typeof window.ParticleText.init === 'function') window.ParticleText.init();
        } catch (e) { /* noop */ }
        try {
            if (window.Doodle && typeof window.Doodle.init === 'function') window.Doodle.init();
        } catch (e) { /* noop */ }
        try {
            if (window.ProjectsFilter && typeof window.ProjectsFilter.init === 'function') window.ProjectsFilter.init();
        } catch (e) { /* noop */ }
        try {
            if (window.FeaturedWorkRefresh && typeof window.FeaturedWorkRefresh === 'function') window.FeaturedWorkRefresh();
        } catch (e) { /* noop */ }
        try {
            if (window.ScrollStackRefresh && typeof window.ScrollStackRefresh === 'function') window.ScrollStackRefresh();
        } catch (e) { /* noop */ }
        try {
            var nav = document.getElementById('glassNav');
            if (nav && window.setNavbarAccessibility) {
                var overlay = document.querySelector('.text-reveal-container');
                window.setNavbarAccessibility(nav, !overlay || overlay.classList.contains('released'));
            }
        } catch (e) { /* noop */ }
    }

    function stageEntry() {
        try {
            var html = document.documentElement;
            html.classList.remove('pt-exiting', 'pt-covering');
            if (reduceMotion()) {
                html.classList.add('pt-entered');
                var swapped = document.querySelector('main.pt-swapped');
                if (swapped) swapped.classList.remove('pt-swapped');
                var v = document.getElementById('ptVeil');
                if (v && v.parentNode) v.parentNode.removeChild(v);
                return;
            }
            var main = document.querySelector('main');
            var items = [];
            if (main) {
                var kids = main.children;
                for (var i = 0; i < kids.length && items.length < 24; i++) items.push(kids[i]);
            }
            var footer = document.querySelector('body > footer');
            if (footer) items.push(footer);
            items.forEach(function (el, idx) {
                try {
                    if (!el.classList.contains('pt-item')) el.classList.add('pt-item');
                    el.style.setProperty('--pt-index', String(idx));
                } catch (e) { /* noop */ }
            });
            html.classList.add('pt-entering', 'pt-uncovering');
            var veil = document.getElementById('ptVeil');
            var settled = false;
            function settle() {
                if (settled) return;
                settled = true;
                html.classList.remove('pt-uncovering', 'pt-entering');
                html.classList.add('pt-entered');
                var vv = document.getElementById('ptVeil');
                if (vv && vv.parentNode) vv.parentNode.removeChild(vv);
                var sw = document.querySelector('main.pt-swapped');
                if (sw) sw.classList.remove('pt-swapped');
            }
            setTimeout(function () {
                items.forEach(function (el) {
                    try { el.classList.add('pt-in'); } catch (e) { /* noop */ }
                });
            }, 120);
            if (veil && window.PixelSwap && typeof window.PixelSwap.dissolve === 'function') {
                try {
                    window.PixelSwap.dissolve(veil, {
                        pattern: 'center',
                        pixelSize: 50,
                        duration: UNCOVER_DURATION,
                        pixelDuration: 440,
                        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                        onComplete: settle
                    });
                } catch (e) {
                    settle();
                }
            } else {
                settle();
            }
            setTimeout(settle, UNCOVER_DURATION + 500);
        } catch (e) { /* never trap the page veiled */ }
    }

    function focusContent(url) {
        try {
            var main = document.querySelector('main');
            if (!main) return;
            var heading = main.querySelector('h1, h2');
            var target = heading || main;
            if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
            target.focus({ preventScroll: true });
        } catch (e) { /* noop */ }
        try {
            var region = document.getElementById('routerLive');
            if (!region) {
                region = document.createElement('div');
                region.id = 'routerLive';
                region.className = 'sr-only';
                region.setAttribute('aria-live', 'polite');
                region.setAttribute('role', 'status');
                document.body.appendChild(region);
            }
            region.textContent = 'Loaded: ' + (document.title || url);
        } catch (e) { /* noop */ }
    }

    function trackPageView(url) {
        try {
            if (window.analyticsManager && typeof window.analyticsManager.trackPageView === 'function') {
                window.analyticsManager.trackPageView(url);
            } else if (typeof window.trackEvent === 'function') {
                window.trackEvent('page_view', { page_path: url });
            }
        } catch (e) { /* analytics never breaks navigation */ }
    }

    function cover() {
        if (reduceMotion()) return Promise.resolve();
        try {
            var html = document.documentElement;
            html.classList.remove('pt-entered');
            html.classList.add('pt-exiting', 'pt-covering');
            var veil = ensureVeil();
            if (veil && window.PixelSwap && typeof window.PixelSwap.reveal === 'function') {
                return new Promise(function (resolve) {
                    var done = false;
                    function settle() { if (!done) { done = true; resolve(); } }
                    try {
                        window.PixelSwap.reveal(veil, {
                            pattern: 'edges',
                            pixelSize: 50,
                            duration: COVER_DURATION,
                            pixelDuration: 320,
                            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                            onComplete: settle
                        });
                    } catch (e) {
                        settle();
                    }
                    setTimeout(settle, COVER_DURATION + 200);
                });
            }
        } catch (e) { /* noop */ }
        return Promise.resolve();
    }

    function navigate(url, opts) {
        opts = opts || {};
        var push = opts.push !== false;
        var key = normalize(url);
        if (!key) {
            window.location.assign(url);
            return Promise.resolve(false);
        }
        if (navigating) return Promise.resolve(false);
        navigating = true;
        currentUrl = key;

        var coverPromise = push ? cover() : Promise.resolve();
        // Fetch starts immediately, in parallel with the cover, so hover-
        // prefetched (cached) destinations swap the moment the veil lands.
        var fetchPromise = fetchDocument(key);
        return Promise.all([coverPromise, fetchPromise]).then(function (results) {
            var text = results[1];
            var doc = parseDocument(text);
            if (!doc) throw new Error('unparseable');
            if (isHomeDocument(doc)) throw new Error('home-entry');
            if (isHomeDocument(document)) teardownHome();
            if (!swapBody(doc)) throw new Error('no-main');
            syncHead(doc);
            return syncPageStyles(doc).then(function () {
                return loadMissingScripts(doc);
            }).then(function () {
                return doc;
            });
        }).then(function (doc) {
            if (push) {
                try {
                    history.pushState({ router: true, y: 0 }, '', key);
                } catch (e) { /* noop */ }
            } else if (typeof opts.y === 'number') {
                // popstate restores after paint
            }
            try {
                reinitComponents();
            } catch (e) { /* noop */ }
            try {
                window.scrollTo(0, push ? 0 : (typeof opts.y === 'number' ? opts.y : 0));
            } catch (e) { /* noop */ }
            stageEntry();
            focusContent(key);
            trackPageView(key);
            try {
                window.dispatchEvent(new CustomEvent('page:ready', { detail: { url: key } }));
            } catch (e) { /* noop */ }
            navigating = false;
            return true;
        }).catch(function () {
            navigating = false;
            try {
                var v = document.getElementById('ptVeil');
                if (v && v.parentNode && push) v.parentNode.removeChild(v);
                document.documentElement.classList.remove('pt-exiting', 'pt-covering');
            } catch (e) { /* noop */ }
            window.location.assign(key);
            return false;
        });
    }

    function bindClicks() {
        document.addEventListener('click', function (e) {
            if (navigating) return;
            if (e.defaultPrevented) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            if (typeof e.button === 'number' && e.button !== 0) return;
            var anchor = e.target && e.target.closest ? e.target.closest('a[href]') : null;
            if (!anchor) return;
            if (!handles(anchor)) return;
            e.preventDefault();
            try {
                var state = history.state || {};
                state.y = window.scrollY || 0;
                history.replaceState(state, '');
            } catch (err) { /* noop */ }
            navigate(anchor.href, { push: true });
        }, true);
    }

    function bindPopstate() {
        window.addEventListener('popstate', function (e) {
            var url = window.location.href;
            var key = normalize(url);
            if (!key) return;
            // Homepage entries always boot clean.
            if (/^\/$/.test(new URL(url, window.location.href).pathname.replace(/\/+$/, '') || '/')) {
                window.location.reload();
                return;
            }
            var y = e.state && typeof e.state.y === 'number' ? e.state.y : 0;
            navigate(url, { push: false, y: y });
        });
    }

    function bindPrefetch() {
        var timer = null;
        document.addEventListener('pointerover', function (e) {
            if (navigating) return;
            var anchor = e.target && e.target.closest ? e.target.closest('a[href]') : null;
            if (!anchor) return;
            if (!handles(anchor)) return;
            if (timer) clearTimeout(timer);
            timer = setTimeout(function () { prefetch(anchor.href); }, 80);
        }, { passive: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            bindClicks();
            bindPopstate();
            bindPrefetch();
        });
    } else {
        bindClicks();
        bindPopstate();
        bindPrefetch();
    }

    window.PageRouter = {
        handles: handles,
        navigate: navigate,
        prefetch: prefetch
    };
})();
