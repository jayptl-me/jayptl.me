/**
 * Command Deck, a keyboard-first jump menu for the whole site.
 *
 * Opens on Cmd K / Ctrl K, from the navbar chip, from the Control Dock,
 * or through window.CommandDeck.open(query). Groups: pages, sections on
 * this page (main h2[id]), case studies, every project (read once from
 * /projects, so the project list has one source), and actions (theme,
 * sound, copy email, copy link, resume PDFs).
 *
 * Brief (docs/motion-zen.md section 6a, picked "Rise in center"): scrim
 * 280ms, panel 240ms after 40ms (opacity, scale 0.98 to 1, snap), rows
 * 180ms in 30ms steps capped at 280ms; close 140ms opacity, together.
 * Page scroll is locked while open. Reduced motion: no transitions.
 *
 * Accessibility: dialog with a combobox and listbox, arrow keys move the
 * active option, Enter runs it, Esc closes, Tab stays inside, focus
 * returns to whatever opened it.
 *
 * @file js/components/command-deck.js
 */
(function () {
    'use strict';

    if (window.CommandDeck) return;

    var EMAIL = 'hello@jayptl.me';
    var CLOSE_MS = 140;

    var PAGES = [
        { label: 'Home', href: '/', hint: 'Start here', keys: 'index landing' },
        { label: 'Projects', href: '/projects', hint: 'All 31 builds', keys: 'work portfolio' },
        { label: 'About', href: '/about', hint: 'Who is Jay', keys: 'bio beyond code' },
        { label: 'Resume', href: '/resume', hint: 'Roles, skills, PDFs', keys: 'cv experience' },
        { label: 'Design System', href: '/design-system', hint: 'Tokens, doodles, motion', keys: 'components style' },
        { label: 'Privacy', href: '/privacy', hint: 'What is stored', keys: 'cookies consent' },
        { label: 'Contact', href: '/contact', hint: 'Email and availability', keys: 'hire email reach' },
        { label: 'Book a call', href: '/book', hint: '15 minutes, Google Meet', keys: 'meeting schedule calendar' },
        { label: 'Now', href: '/now', hint: 'This month', keys: 'current doing' },
        { label: 'Uses', href: '/uses', hint: 'Stack and homelab', keys: 'tools setup gear' },
        { label: 'AI', href: '/ai', hint: 'Build it, use it', keys: 'llm models assistant' },
        { label: 'Colophon', href: '/colophon', hint: 'How this site is made', keys: 'built stack uptime' },
        { label: 'Changelog', href: '/changelog', hint: 'Site updates', keys: 'news updates' }
    ];

    var CASES = [
        { label: 'Aviz Health', href: '/projects/aviz-health', hint: 'Case study', keys: 'healthcare flutter' },
        { label: 'Swalook CRM', href: '/projects/swalook', hint: 'Case study', keys: 'salon crm' },
        { label: 'Genuinest', href: '/projects/genuinest', hint: 'Case study', keys: 'marketplace' },
        { label: 'Vini and Tini', href: '/projects/vini-tini', hint: 'Case study', keys: 'ai agents' }
    ];

    var RESUMES = ['fde', 'fullstack', 'frontend', 'backend', 'mobile', 'ai', 'web3'];
    var RESUME_LABELS = {
        fde: 'Forward deployed', fullstack: 'Full stack', frontend: 'Frontend',
        backend: 'Backend', mobile: 'Mobile', ai: 'Applied AI', web3: 'Web3'
    };

    var root = null;
    var input = null;
    var list = null;
    var live = null;
    var opener = null;
    var items = [];
    var active = 0;
    var isOpen = false;
    var closeTimer = null;
    var projects = null;
    var projectsLoading = null;
    var lastTick = 0;

    function reduced() {
        try {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) {
            return false;
        }
    }

    function isMac() {
        try {
            var p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
            return /mac|iphone|ipad/i.test(p);
        } catch (e) {
            return false;
        }
    }

    function sound(kind) {
        try {
            var sm = window.SoundManager;
            if (!sm) return;
            if (kind === 'select' && typeof sm.playSelectSound === 'function') sm.playSelectSound();
            if (kind === 'tick' && typeof sm.playHoverSound === 'function') {
                var now = Date.now();
                if (now - lastTick < 160) return;
                lastTick = now;
                sm.playHoverSound();
            }
        } catch (e) { /* sound never blocks the deck */ }
    }

    function announce(text) {
        if (live) live.textContent = text;
    }

    function currentPath() {
        return (window.location.pathname.replace(/\/+$/, '') || '/').replace(/\.html$/, '');
    }

    /* ---- Data ------------------------------------------------------------ */

    function readProjects(doc) {
        var out = [];
        try {
            doc.querySelectorAll('article.case-card[id], details.arch-row[id]').forEach(function (card) {
                var h = card.querySelector('.case-card-title, .arch-title, h3');
                if (!h) return;
                // Titles carry screen-reader hints (", read the case study").
                h = h.cloneNode(true);
                h.querySelectorAll('.sr-only').forEach(function (n) { n.remove(); });
                var tags = Array.from(card.querySelectorAll('.case-card-tags > .tag:not(.tag--more)')).map(function (t) {
                    return (t.textContent || '').trim();
                }).join(' ');
                out.push({
                    group: 'Projects',
                    label: (h.textContent || '').trim(),
                    hint: tags.split(' ').slice(0, 3).join(' '),
                    keys: tags,
                    href: '/projects#' + card.id
                });
            });
        } catch (e) { /* leave empty */ }
        return out;
    }

    function loadProjects() {
        if (projects) return Promise.resolve(projects);
        if (currentPath() === '/projects') {
            projects = readProjects(document);
            return Promise.resolve(projects);
        }
        if (projectsLoading) return projectsLoading;
        projectsLoading = fetch('/projects', { credentials: 'same-origin', headers: { Accept: 'text/html' } })
            .then(function (res) { return res.ok ? res.text() : ''; })
            .then(function (text) {
                var doc = new DOMParser().parseFromString(text || '', 'text/html');
                projects = readProjects(doc);
                return projects;
            })
            .catch(function () {
                projects = [];
                return projects;
            });
        return projectsLoading;
    }

    function sectionItems() {
        var out = [];
        try {
            document.querySelectorAll('main h2[id], main section[id] > h2, main section[id] h2:first-of-type').forEach(function (h) {
                var id = h.id || (h.closest('section[id]') || {}).id;
                var text = (h.textContent || '').replace(/\s+/g, ' ').trim();
                if (!id || !text || out.some(function (o) { return o.hash === id; })) return;
                out.push({ group: 'On this page', label: text, hash: id, hint: 'Section', keys: id });
            });
        } catch (e) { /* noop */ }
        return out.slice(0, 12);
    }

    function soundOn() {
        try {
            return Boolean(window.SoundManager && window.SoundManager.getPrefs().master);
        } catch (e) {
            return false;
        }
    }

    function actionItems() {
        var out = [
            { group: 'Actions', label: 'Switch theme', hint: 'Light clay or dark glass', keys: 'dark light mode', run: function () {
                var t = document.getElementById('themeToggle');
                if (t) t.click();
            } },
            { group: 'Actions', label: soundOn() ? 'Turn sound off' : 'Turn sound on', hint: 'Site score and effects', keys: 'audio mute music', run: function () {
                try {
                    if (window.SoundManager) window.SoundManager.setMasterEnabled(!soundOn());
                } catch (e) { /* noop */ }
            } },
            { group: 'Actions', label: 'Copy email', hint: EMAIL, keys: 'contact mail hello', run: function () {
                copy(EMAIL, 'Email copied');
            } },
            { group: 'Actions', label: 'Copy link to this page', hint: currentPath(), searchHint: false, keys: 'share url', run: function () {
                copy(window.location.origin + window.location.pathname, 'Link copied');
            } }
        ];
        RESUMES.forEach(function (track) {
            out.push({
                group: 'Resume PDFs',
                label: 'Resume, ' + RESUME_LABELS[track],
                hint: '/resumes/' + track + '.pdf',
                keys: 'download cv pdf ' + track,
                download: '/resumes/' + track + '.pdf',
                filename: 'Jay-Patel-Resume-' + track + '.pdf'
            });
        });
        return out;
    }

    function allItems() {
        var here = currentPath();
        function page(p, group) {
            return { group: group, label: p.label, href: p.href, hint: p.hint, keys: p.keys, here: p.href === here };
        }
        var extra = [];
        try {
            if (Array.isArray(window.CommandDeckPages)) extra = window.CommandDeckPages;
        } catch (e) { extra = []; }
        return [].concat(
            PAGES.concat(extra).map(function (p) { return page(p, 'Pages'); }),
            sectionItems(),
            CASES.map(function (p) { return page(p, 'Case studies'); }),
            projects || [],
            actionItems()
        );
    }

    /* ---- Filtering ------------------------------------------------------- */

    /* A word matches as typed, or loosely: without its last letter, or by
       its first four letters, so "healthh" or "resum" still find a page. */
    function variants(w) {
        var out = [w];
        if (w.length > 4) out.push(w.slice(0, -1));
        if (w.length > 5) out.push(w.slice(0, 4));
        return out;
    }

    function score(item, words) {
        var label = item.label.toLowerCase();
        var hint = item.searchHint === false ? '' : (item.hint || '');
        var hay = (label + ' ' + hint + ' ' + (item.keys || '') + ' ' + item.group).toLowerCase();
        var s = 0;
        for (var i = 0; i < words.length; i++) {
            var vs = variants(words[i]);
            var best = -1;
            for (var v = 0; v < vs.length; v++) {
                var w = vs[v];
                if (hay.indexOf(w) === -1) continue;
                var pts = label.indexOf(w) === 0 ? 6 : label.indexOf(' ' + w) !== -1 ? 4 : label.indexOf(w) !== -1 ? 3 : 1;
                if (v > 0) pts -= 1;
                if (pts > best) best = pts;
            }
            if (best < 0) return -1;
            s += best;
        }
        return s;
    }

    function filter(query) {
        var q = (query || '').toLowerCase().replace(/[\/#_-]+/g, ' ').trim();
        var pool = allItems();
        if (!q) {
            return pool.filter(function (it) { return it.group !== 'Projects' && it.group !== 'Resume PDFs'; });
        }
        var words = q.split(/\s+/);
        return pool
            .map(function (it, i) { return { it: it, s: score(it, words), i: i }; })
            .filter(function (r) { return r.s >= 0; })
            .sort(function (a, b) { return b.s - a.s || a.i - b.i; })
            .slice(0, 40)
            .map(function (r) { return r.it; });
    }

    /* ---- Rendering ------------------------------------------------------- */

    function render() {
        var found = filter(input.value);
        // Keep groups together in first-seen order.
        var order = [];
        var byGroup = {};
        found.forEach(function (it) {
            if (!byGroup[it.group]) {
                byGroup[it.group] = [];
                order.push(it.group);
            }
            byGroup[it.group].push(it);
        });
        items = [];
        list.textContent = '';
        var row = 0;
        order.forEach(function (group, gi) {
            var head = document.createElement('li');
            head.className = 'deck-group';
            head.setAttribute('role', 'presentation');
            head.id = 'deckGroup' + gi;
            head.textContent = group;
            list.appendChild(head);
            byGroup[group].forEach(function (it) {
                var li = document.createElement('li');
                li.className = 'deck-row';
                li.id = 'deckOpt' + items.length;
                li.setAttribute('role', 'option');
                li.setAttribute('aria-selected', 'false');
                li.setAttribute('aria-describedby', head.id);
                li.style.setProperty('--row', String(Math.min(row, 8)));
                var label = document.createElement('span');
                label.className = 'deck-row-label';
                label.textContent = it.label;
                li.appendChild(label);
                if (it.here) {
                    var here = document.createElement('span');
                    here.className = 'deck-here hand';
                    here.textContent = 'you are here';
                    li.appendChild(here);
                }
                var hint = document.createElement('span');
                hint.className = 'deck-row-hint';
                hint.textContent = it.hint || '';
                li.appendChild(hint);
                var idx = items.length;
                li.addEventListener('pointermove', function () {
                    if (active !== idx) setActive(idx, false);
                });
                li.addEventListener('click', function () { run(idx); });
                list.appendChild(li);
                items.push({ data: it, el: li });
                row++;
            });
        });
        if (!items.length) {
            var empty = document.createElement('li');
            empty.className = 'deck-empty';
            empty.setAttribute('role', 'presentation');
            empty.textContent = 'Nothing matches "' + input.value.trim() + '". Try a page, a project, or "email".';
            list.appendChild(empty);
        }
        setActive(0, false);
        announce(items.length ? items.length + ' results' : 'No results');
    }

    function setActive(i, withSound) {
        if (!items.length) {
            input.removeAttribute('aria-activedescendant');
            return;
        }
        active = (i + items.length) % items.length;
        items.forEach(function (rec, j) {
            var on = j === active;
            rec.el.classList.toggle('is-active', on);
            rec.el.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        var el = items[active].el;
        input.setAttribute('aria-activedescendant', el.id);
        try { el.scrollIntoView({ block: 'nearest' }); } catch (e) { /* noop */ }
        if (withSound) sound('tick');
    }

    /* ---- Actions --------------------------------------------------------- */

    function copy(text, message) {
        function done() { announce(message); }
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(done, done);
                return;
            }
        } catch (e) { /* fall through */ }
        var area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        try { document.execCommand('copy'); } catch (e) { /* noop */ }
        document.body.removeChild(area);
        done();
    }

    function go(href) {
        var url = new URL(href, window.location.href);
        var samePage = url.pathname.replace(/\/+$/, '') === window.location.pathname.replace(/\/+$/, '');
        if (samePage && url.hash) {
            var el = document.getElementById(url.hash.slice(1));
            if (el) {
                if (window.ScrollGlide) window.ScrollGlide.to(el);
                else el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
                return;
            }
        }
        if (samePage && !url.hash) return;
        var a = document.createElement('a');
        a.href = url.href;
        if (window.PageRouter && window.PageRouter.handles(a)) {
            window.PageRouter.navigate(url.href, { push: true });
        } else {
            window.location.assign(url.href);
        }
    }

    function run(i) {
        var rec = items[i];
        if (!rec) return;
        var it = rec.data;
        sound('select');
        close(true);
        // Let the deck clear and the scroll lock lift before moving.
        setTimeout(function () {
            if (typeof it.run === 'function') it.run();
            else if (it.download) {
                var a = document.createElement('a');
                a.href = it.download;
                a.download = it.filename || '';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } else if (it.hash) go('#' + it.hash);
            else if (it.href) go(it.href);
        }, reduced() ? 0 : CLOSE_MS);
    }

    /* ---- Open and close -------------------------------------------------- */

    function build() {
        root = document.createElement('div');
        root.className = 'deck';
        root.id = 'commandDeck';
        root.hidden = true;
        root.innerHTML =
            '<div class="deck-scrim" data-deck-close></div>' +
            '<div class="deck-panel" role="dialog" aria-modal="true" aria-labelledby="deckTitle">' +
            '  <h2 class="sr-only" id="deckTitle">Command Deck</h2>' +
            '  <div class="deck-search">' +
            '    <svg class="deck-search-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
            '    <input class="deck-input" id="deckInput" type="text" autocomplete="off" spellcheck="false"' +
            '      role="combobox" aria-expanded="true" aria-controls="deckList" aria-autocomplete="list"' +
            '      aria-label="Search pages, projects and actions" placeholder="Jump to a page, project or action" />' +
            '    <button class="deck-esc kbd" type="button" data-deck-close aria-label="Close command deck">Esc</button>' +
            '  </div>' +
            '  <ul class="deck-list" id="deckList" role="listbox" aria-label="Results"></ul>' +
            '  <div class="deck-foot" aria-hidden="true">' +
            '    <span><span class="kbd">&uarr;</span><span class="kbd">&darr;</span> move</span>' +
            '    <span><span class="kbd">Enter</span> open</span>' +
            '    <span><span class="kbd">' + (isMac() ? '&#8984;' : 'Ctrl') + '</span><span class="kbd">K</span> toggle</span>' +
            '  </div>' +
            '  <div class="sr-only" aria-live="polite" id="deckLive"></div>' +
            '</div>';
        document.body.appendChild(root);
        input = root.querySelector('#deckInput');
        list = root.querySelector('#deckList');
        live = root.querySelector('#deckLive');

        root.addEventListener('click', function (e) {
            if (e.target.closest('[data-deck-close]')) close(false);
        });
        input.addEventListener('input', render);
        root.addEventListener('keydown', onKeydown);
    }

    function onKeydown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            close(false);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive(active + 1, true);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive(active - 1, true);
        } else if (e.key === 'Home' && e.ctrlKey) {
            e.preventDefault();
            setActive(0, true);
        } else if (e.key === 'End' && e.ctrlKey) {
            e.preventDefault();
            setActive(items.length - 1, true);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            run(active);
        } else if (e.key === 'Tab') {
            // Two stops inside: the field and the Esc cap.
            var esc = root.querySelector('.deck-esc');
            e.preventDefault();
            (document.activeElement === input ? esc : input).focus();
        }
    }

    function open(query) {
        if (!root) build();
        if (closeTimer) {
            clearTimeout(closeTimer);
            closeTimer = null;
        }
        if (isOpen) {
            if (typeof query === 'string') {
                input.value = query;
                render();
            }
            input.focus();
            return;
        }
        isOpen = true;
        opener = document.activeElement;
        try {
            if (window.ScrollGlide) window.ScrollGlide.stop();
        } catch (e) { /* noop */ }
        input.value = typeof query === 'string' ? query : '';
        render();
        root.hidden = false;
        document.documentElement.classList.add('deck-open');
        // Two frames so the closed state paints before the entry runs.
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                if (isOpen) root.classList.add('is-open');
            });
        });
        input.focus({ preventScroll: true });
        sound('tick');
        loadProjects().then(function () {
            if (isOpen && input.value.trim()) render();
        });
        document.querySelectorAll('[data-deck-open]').forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
    }

    function close(keepFocus) {
        if (!isOpen || !root) return;
        isOpen = false;
        root.classList.remove('is-open');
        root.classList.add('is-closing');
        document.documentElement.classList.remove('deck-open');
        document.querySelectorAll('[data-deck-open]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
        closeTimer = setTimeout(function () {
            root.hidden = true;
            root.classList.remove('is-closing');
            closeTimer = null;
        }, reduced() ? 0 : CLOSE_MS);
        if (!keepFocus && opener && typeof opener.focus === 'function' && opener.isConnected) {
            try { opener.focus({ preventScroll: true }); } catch (e) { /* noop */ }
        }
        opener = null;
    }

    function toggle() {
        if (isOpen) close(false);
        else open();
    }

    /* ---- Entry points ---------------------------------------------------- */

    document.addEventListener('keydown', function (e) {
        if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K')) {
            e.preventDefault();
            toggle();
        }
    });

    document.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('[data-deck-open]') : null;
        if (!btn) return;
        e.preventDefault();
        // data-deck-query-path seeds the search with the current URL (404).
        var query = btn.hasAttribute('data-deck-query-path')
            ? decodeURIComponent(window.location.pathname).replace(/[\/_.-]+/g, ' ').replace(/\bhtml\b/, '').trim()
            : btn.getAttribute('data-deck-query');
        open(query || undefined);
    });

    /* Shortcut hints elsewhere on the page ([data-deck-keys]) name the
       platform's modifier. */
    function labelKeys() {
        var label = isMac() ? '\u2318K' : 'Ctrl K';
        document.querySelectorAll('[data-deck-keys]').forEach(function (el) { el.textContent = label; });
    }

    window.addEventListener('page:ready', function () {
        if (isOpen) close(true);
        labelKeys();
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', labelKeys);
    else labelKeys();

    try {
        window.CommandDeck = { open: open, close: close, toggle: toggle, isMac: isMac };
    } catch (e) { /* noop */ }
})();
