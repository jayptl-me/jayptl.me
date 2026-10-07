/**
 * Commit Field, a year of public GitHub contributions as a grid.
 *
 * Data comes from assets/data/commits.json, a snapshot saved by
 * scripts/fetch-commits.js, so the browser never calls GitHub. The host
 * keeps a plain-text summary for no-JS readers.
 *
 *   <figure class="commit-field" data-component="commit-field">
 *     <figcaption>...</figcaption>
 *   </figure>
 *
 * Brief (docs/motion-zen.md section 6a, picked "Last 12 months"): static
 * grid, no motion of its own; totals use Tally Roll. Hover a cell, or
 * focus the grid and use the arrow keys, to read a day. Weeks run left to
 * right, Sunday on top.
 *
 * @file js/components/commit-field.js
 */
(function () {
    'use strict';

    var SRC = '/assets/data/commits.json';
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var cache = null;

    function load() {
        if (!cache) {
            cache = fetch(SRC, { credentials: 'same-origin' })
                .then(function (r) { return r.ok ? r.json() : null; })
                .catch(function () { return null; });
        }
        return cache;
    }

    function dayDate(from, i) {
        var d = new Date(from + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() + i);
        return d;
    }

    function label(d, count) {
        var when = MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear();
        if (!count) return 'No contributions on ' + when;
        return count.toLocaleString('en-US') + (count === 1 ? ' contribution on ' : ' contributions on ') + when;
    }

    function render(host, data) {
        var first = dayDate(data.from, 0);
        var offset = first.getUTCDay();
        var weeks = Math.ceil((offset + data.days.length) / 7);

        var wrap = document.createElement('div');
        wrap.className = 'cf-wrap';

        var months = document.createElement('div');
        months.className = 'cf-months';
        months.setAttribute('aria-hidden', 'true');
        months.style.setProperty('--weeks', String(weeks));

        var grid = document.createElement('div');
        grid.className = 'cf-grid';
        grid.setAttribute('role', 'group');
        grid.setAttribute('tabindex', '0');
        grid.setAttribute('aria-label', 'Contribution grid, use the arrow keys to read each day');
        grid.style.setProperty('--weeks', String(weeks));

        var readout = document.createElement('p');
        readout.className = 'cf-readout hud-readout';
        readout.setAttribute('aria-live', 'polite');

        var cells = [];
        var lastMonth = -1;
        for (var i = 0; i < data.days.length; i++) {
            var d = dayDate(data.from, i);
            var slot = offset + i;
            var col = Math.floor(slot / 7);
            var row = slot % 7;
            var cell = document.createElement('span');
            cell.className = 'cf-cell';
            cell.setAttribute('aria-hidden', 'true');
            cell.setAttribute('data-level', String(data.days[i][1]));
            cell.style.gridColumn = String(col + 1);
            cell.style.gridRow = String(row + 1);
            cell._label = label(d, data.days[i][0]);
            grid.appendChild(cell);
            cells.push(cell);
            if (d.getUTCDate() <= 7 && d.getUTCMonth() !== lastMonth && row === 0) {
                lastMonth = d.getUTCMonth();
                var m = document.createElement('span');
                m.textContent = MONTHS[lastMonth];
                m.style.gridColumn = String(col + 1);
                months.appendChild(m);
            }
        }

        var active = cells.length - 1;
        function show(i) {
            active = Math.max(0, Math.min(cells.length - 1, i));
            cells.forEach(function (c, j) { c.classList.toggle('is-active', j === active); });
            readout.textContent = cells[active]._label;
        }
        function rest() {
            readout.textContent = data.total.toLocaleString('en-US') + ' contributions in the last 12 months';
            cells.forEach(function (c) { c.classList.remove('is-active'); });
        }

        grid.addEventListener('pointerover', function (e) {
            var i = cells.indexOf(e.target);
            if (i !== -1) show(i);
        });
        grid.addEventListener('pointerleave', function () {
            if (document.activeElement !== grid) rest();
        });
        grid.addEventListener('focus', function () { show(active); });
        grid.addEventListener('blur', rest);
        grid.addEventListener('keydown', function (e) {
            var step = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1, Home: -Infinity, End: Infinity }[e.key];
            if (step === undefined) return;
            e.preventDefault();
            if (step === -Infinity) show(0);
            else if (step === Infinity) show(cells.length - 1);
            else show(active + step);
        });

        var stats = document.createElement('dl');
        stats.className = 'cf-stats';
        stats.innerHTML =
            '<div><dt>Contributions</dt><dd><span data-tally="' + data.total + '">' + data.total.toLocaleString('en-US') + '</span></dd></div>' +
            '<div><dt>Longest streak</dt><dd><span data-tally="' + data.longestStreak + '">' + data.longestStreak + '</span> days</dd></div>' +
            '<div><dt>Current streak</dt><dd><span data-tally="' + data.currentStreak + '">' + data.currentStreak + '</span> days</dd></div>';

        var legend = document.createElement('p');
        legend.className = 'cf-legend';
        legend.setAttribute('aria-hidden', 'true');
        legend.innerHTML = 'Less <span class="cf-cell" data-level="0"></span><span class="cf-cell" data-level="1"></span><span class="cf-cell" data-level="2"></span><span class="cf-cell" data-level="3"></span><span class="cf-cell" data-level="4"></span> More';

        wrap.appendChild(months);
        wrap.appendChild(grid);
        host.insertBefore(stats, host.firstChild);
        host.insertBefore(wrap, stats.nextSibling);
        host.insertBefore(readout, wrap.nextSibling);
        host.insertBefore(legend, readout.nextSibling);
        host.classList.add('is-ready');
        rest();
        if (window.Mount) window.Mount.scan(host);
        return [stats, wrap, readout, legend];
    }

    function mount(host) {
        var state = { nodes: [] };
        load().then(function (data) {
            if (!data || !host.isConnected || !Array.isArray(data.days)) return;
            state.nodes = render(host, data);
        });
        return state;
    }

    function unmount(host, state) {
        (state && state.nodes || []).forEach(function (n) {
            if (n.parentNode) n.parentNode.removeChild(n);
        });
    }

    if (window.Mount) {
        window.Mount.register('commit-field', { mount: mount, unmount: unmount });
    }
})();
