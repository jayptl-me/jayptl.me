/**
 * Slot Picker, the /book page: pick a day, pick a 15 minute slot, leave
 * a name and email, get a confirmation with a cancel link.
 *
 * Talks to the API through window.SiteApi:
 *   GET  /v1/slots?from=YYYY-MM-DD&to=YYYY-MM-DD -> { slots: [ISO start, ...], slotMinutes }
 *   POST /v1/book   { name, email, note, slot, company, elapsed } -> { start, end, cancelToken }
 *   POST /v1/cancel { token } -> { ok }
 * While the API is off, the host's email fallback stays visible and the
 * picker never appears.
 *
 * Days and times are native radio groups (arrow keys, screen readers).
 * Times show in the visitor's zone with IST alongside. The cancel link
 * carries its token in the URL fragment (#cancel=...), so it is never
 * sent to any server log.
 *
 * Brief (docs/motion-zen.md section 6a): no motion of its own beyond the
 * shared 180ms snap state changes; native scroll.
 *
 * @file js/components/slot-picker.js
 */
(function () {
    'use strict';

    var DAYS = 14;
    var IST = 'Asia/Kolkata';

    function localZone() {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        } catch (e) {
            return 'UTC';
        }
    }

    function fmt(date, opts, zone) {
        try {
            return new Intl.DateTimeFormat('en-US', Object.assign({ timeZone: zone }, opts)).format(date);
        } catch (e) {
            return date.toISOString();
        }
    }

    function dayKey(date, zone) {
        return fmt(date, { year: 'numeric', month: '2-digit', day: '2-digit' }, zone);
    }

    function isoDate(d) {
        return d.toISOString().slice(0, 10);
    }

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }

    function mount(host) {
        if (!window.SiteApi || !window.SiteApi.enabled()) return null;
        var zone = localZone();
        var sameZone = zone === IST;
        var off = host.querySelector('.book-off');
        var on = host.querySelector('.book-on');
        var daysEl = host.querySelector('.slot-days');
        var timesEl = host.querySelector('.slot-times');
        var tzEl = host.querySelector('.slot-tz');
        var form = host.querySelector('.book-form');
        var picked = host.querySelector('.book-picked');
        var status = host.querySelector('.book-status');
        var done = host.querySelector('.book-done');
        var cancelView = host.querySelector('.book-cancel');
        var renderedAt = Date.now();
        var byDay = {};
        var chosen = null;

        var statusInk = null;

        /** Status line: words always, plus the Ink Status mark when a state is given. */
        function say(text, state) {
            if (!status) return;
            status.textContent = '';
            if (state && window.InkStatus) {
                statusInk = statusInk || window.InkStatus.make();
                window.InkStatus.set(statusInk, state);
                status.appendChild(statusInk);
            }
            if (text) status.appendChild(document.createTextNode(text));
        }

        function showTimes(key) {
            timesEl.textContent = '';
            chosen = null;
            form.hidden = true;
            var list = byDay[key] || [];
            if (!list.length) {
                timesEl.appendChild(el('p', 'slot-empty', 'No open slots that day.'));
                return;
            }
            list.forEach(function (iso, i) {
                var d = new Date(iso);
                var id = 'slotTime' + i;
                var input = el('input');
                input.type = 'radio';
                input.name = 'slotTime';
                input.id = id;
                input.value = iso;
                var label = el('label', 'slot-pill');
                label.htmlFor = id;
                label.appendChild(el('span', 'slot-local', fmt(d, { hour: 'numeric', minute: '2-digit' }, zone)));
                if (!sameZone) label.appendChild(el('span', 'slot-ist', fmt(d, { hour: 'numeric', minute: '2-digit' }, IST) + ' IST'));
                input.addEventListener('change', function () {
                    chosen = iso;
                    picked.textContent = fmt(d, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }, zone) +
                        (sameZone ? ' IST' : ' your time (' + fmt(d, { hour: 'numeric', minute: '2-digit' }, IST) + ' IST)');
                    form.hidden = false;
                });
                timesEl.appendChild(input);
                timesEl.appendChild(label);
            });
        }

        function showDays(slots) {
            byDay = {};
            slots.forEach(function (iso) {
                var key = dayKey(new Date(iso), zone);
                (byDay[key] = byDay[key] || []).push(iso);
            });
            daysEl.textContent = '';
            var first = null;
            var start = new Date();
            for (var i = 0; i < DAYS; i++) {
                var d = new Date(start.getTime() + i * 86400000);
                var key = dayKey(d, zone);
                var count = (byDay[key] || []).length;
                var id = 'slotDay' + i;
                var input = el('input');
                input.type = 'radio';
                input.name = 'slotDay';
                input.id = id;
                input.value = key;
                input.disabled = count === 0;
                var label = el('label', 'day-pill');
                label.htmlFor = id;
                label.appendChild(el('span', 'day-name', fmt(d, { weekday: 'short' }, zone)));
                label.appendChild(el('span', 'day-date', fmt(d, { day: 'numeric' }, zone)));
                label.appendChild(el('span', 'day-count', count ? count + ' open' : 'full'));
                (function (k) {
                    input.addEventListener('change', function () { showTimes(k); });
                })(key);
                daysEl.appendChild(input);
                daysEl.appendChild(label);
                if (count && !first) first = input;
            }
            if (first) {
                first.checked = true;
                showTimes(first.value);
            } else {
                timesEl.textContent = '';
                timesEl.appendChild(el('p', 'slot-empty', 'Nothing open in the next two weeks. Email hello@jayptl.me and I will make time.'));
            }
        }

        function load() {
            var from = new Date();
            var to = new Date(from.getTime() + DAYS * 86400000);
            say('Loading open times', 'loading');
            window.SiteApi.get('/v1/slots?from=' + isoDate(from) + '&to=' + isoDate(to)).then(function (data) {
                if (!data || !Array.isArray(data.slots)) {
                    say('');
                    return;
                }
                off.hidden = true;
                on.hidden = false;
                say('');
                showDays(data.slots);
            });
        }

        function onSubmit(e) {
            e.preventDefault();
            if (!chosen) return;
            var payload = {
                name: form.elements.name.value.trim(),
                email: form.elements.email.value.trim(),
                note: form.elements.note.value.trim(),
                company: form.elements.company.value,
                slot: chosen,
                elapsed: Date.now() - renderedAt
            };
            var emailInput = form.elements.email;
            if (!payload.name || !payload.email) {
                say('Add your name and email so the invite can reach you.');
                (payload.name ? emailInput : form.elements.name).focus();
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(payload.email)) {
                emailInput.setAttribute('aria-invalid', 'true');
                say('That email does not look right. Check it and book again.');
                emailInput.focus();
                return;
            }
            emailInput.removeAttribute('aria-invalid');
            if (submitting) return;
            submitting = true;
            var btn = form.querySelector('button[type="submit"]');
            say('');
            var request = window.SiteApi.post('/v1/book', payload);
            // The pill runs the ink loop, then the check or the cross.
            if (window.PillPress) window.PillPress.busy(btn, request, { loading: 'Booking your call' }).catch(function () {});
            request.then(function (res) {
                return new Promise(function (resolve) { setTimeout(function () { resolve(res); }, 700); });
            }).then(function (res) {
                submitting = false;
                form.hidden = true;
                on.hidden = true;
                done.hidden = false;
                var start = new Date(res.start);
                done.querySelector('.book-when').textContent =
                    fmt(start, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }, zone) +
                    (sameZone ? ' IST' : ' your time');
                var link = done.querySelector('.book-cancel-link');
                link.href = '/book#cancel=' + encodeURIComponent(res.cancelToken);
                say('');
                done.focus();
                try {
                    if (window.SoundManager && window.SoundManager.playSelectSound) window.SoundManager.playSelectSound();
                } catch (err) { /* noop */ }
            }, function (err) {
                submitting = false;
                // The API's own messages for input problems are written for
                // visitors; anything else falls back to a plain line.
                var status = err && err.status;
                var code = err && err.data && err.data.error;
                var serverMsg = err && err.data && typeof err.data.message === 'string' ? err.data.message : '';
                var msg = status === 409 ? 'Someone just took that slot. Pick another one.'
                    : code === 'too_many_upcoming' ? 'You already have two upcoming calls. Cancel one from its invite, or email hello@jayptl.me.'
                    : status === 429 ? 'Too many bookings from here today. Email hello@jayptl.me instead.'
                    : status === 400 && serverMsg ? serverMsg + '.'
                    : 'That did not go through. Try again, or email hello@jayptl.me.';
                if (code === 'email_invalid') emailInput.setAttribute('aria-invalid', 'true');
                say(msg);
                if (err && err.status === 409) load();
            });
        }

        function cancelFlow(token) {
            off.hidden = true;
            on.hidden = true;
            cancelView.hidden = false;
            // Destructive: the button is hold-to-confirm (press-state.js), so
            // this click only arrives after a completed 600ms hold.
            var btn = cancelView.querySelector('button');
            btn.addEventListener('click', function () {
                var request = window.SiteApi.post('/v1/cancel', { token: token });
                if (window.PillPress) window.PillPress.busy(btn, request, { loading: 'Cancelling your call' }).catch(function () {});
                request.then(function () {
                    cancelView.querySelector('.book-cancel-msg').textContent = 'Cancelled. The invite is gone from both calendars.';
                    btn.hidden = true;
                    try { history.replaceState(history.state, '', '/book'); } catch (e) { /* noop */ }
                }, function () {
                    cancelView.querySelector('.book-cancel-msg').textContent = 'That link did not work. It may already be cancelled, or email hello@jayptl.me.';
                });
            });
        }

        if (tzEl) {
            tzEl.textContent = sameZone ? 'Times in IST (UTC+5:30)' : 'Times in your zone, ' + zone.replace(/_/g, ' ') + ', with IST alongside';
        }
        var submitting = false;
        form.addEventListener('submit', onSubmit);
        form.elements.email.addEventListener('input', function () {
            form.elements.email.removeAttribute('aria-invalid');
        });

        var match = /(?:^|&)cancel=([^&]+)/.exec((window.location.hash || '').slice(1));
        if (match) cancelFlow(decodeURIComponent(match[1]));
        else load();
        return null;
    }

    if (window.Mount) {
        window.Mount.register('slot-picker', { mount: mount });
    }
})();
