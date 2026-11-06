'use strict';

/**
 * The API's own tiny admin page (GET /admin): set or clear the manual
 * "now playing" entry. The admin secret is typed into the page and kept
 * only in this browser tab's sessionStorage; the page never ships it to
 * the public site. Served with a strict CSP and no inline script.
 */

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>jayptl api admin</title>
<link rel="stylesheet" href="/admin.css" />
</head>
<body>
<main>
  <h1>Now playing</h1>
  <p class="lede">Shown on the About page's Gamer card. Steam is read automatically; whatever is newer, Steam or this entry, wins.</p>
  <section>
    <h2>Current</h2>
    <p id="current">Loading...</p>
  </section>
  <form id="playForm">
    <h2>Set a manual entry</h2>
    <label>Admin secret <input id="secret" type="password" autocomplete="off" required /></label>
    <label>Game <input id="game" type="text" maxlength="80" required /></label>
    <label>Platform <input id="platform" type="text" maxlength="40" placeholder="Epic, PlayStation, Switch..." /></label>
    <label class="row"><input id="now" type="checkbox" checked /> Playing right now</label>
    <label>Or last played at <input id="at" type="datetime-local" /></label>
    <div class="actions">
      <button type="submit">Save</button>
      <button type="button" id="clear">Clear manual entry</button>
    </div>
    <p id="msg" role="status" aria-live="polite"></p>
  </form>
</main>
<script src="/admin.js"></script>
</body>
</html>
`;

const ADMIN_JS = `(function () {
  'use strict';
  var KEY = 'jayptl-admin-secret';
  var $ = function (id) { return document.getElementById(id); };
  try { $('secret').value = sessionStorage.getItem(KEY) || ''; } catch (e) {}

  function say(text) { $('msg').textContent = text; }

  function load() {
    fetch('/v1/playing').then(function (r) { return r.json(); }).then(function (d) {
      $('current').textContent = d && d.game
        ? d.game + (d.now ? ' (now)' : ', ' + new Date(d.at).toLocaleString()) + ' \u00b7 from ' + (d.source || '?')
        : 'Nothing to show.';
    }, function () { $('current').textContent = 'Could not load.'; });
  }

  function call(method, body) {
    var secret = $('secret').value;
    try { sessionStorage.setItem(KEY, secret); } catch (e) {}
    return fetch('/v1/admin/playing', {
      method: method,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + secret },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) throw new Error(d.message || r.status);
        return d;
      });
    });
  }

  $('playForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var at = $('at').value ? new Date($('at').value).toISOString() : undefined;
    call('POST', { game: $('game').value, platform: $('platform').value, now: $('now').checked, at: $('now').checked ? undefined : at })
      .then(function () { say('Saved.'); load(); }, function (err) { say('Failed: ' + err.message); });
  });

  $('clear').addEventListener('click', function () {
    call('DELETE').then(function () { say('Cleared.'); load(); }, function (err) { say('Failed: ' + err.message); });
  });

  load();
})();
`;

const ADMIN_CSS = `:root { color-scheme: light dark; --a: #2196f3; }
@media (prefers-color-scheme: dark) { :root { --a: #00b8cc; } }
body { margin: 0; font: 16px/1.5 system-ui, sans-serif; background: Canvas; color: CanvasText; }
main { max-width: 520px; margin: 40px auto; padding: 0 16px; }
h1 { margin: 0 0 8px; }
h2 { font-size: 1rem; margin: 24px 0 8px; }
.lede { opacity: 0.75; }
form { display: grid; gap: 12px; }
label { display: grid; gap: 4px; }
label.row { display: flex; gap: 8px; align-items: center; }
input[type=text], input[type=password], input[type=datetime-local] { padding: 8px 10px; border: 1px solid color-mix(in srgb, CanvasText 25%, transparent); border-radius: 8px; font: inherit; background: Canvas; color: CanvasText; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; }
button { padding: 8px 14px; border-radius: 999px; border: 1px solid var(--a); background: var(--a); color: #fff; font: inherit; cursor: pointer; }
button[type=button] { background: transparent; color: var(--a); }
:focus-visible { outline: 2px solid var(--a); outline-offset: 2px; }
`;

module.exports = { ADMIN_HTML, ADMIN_JS, ADMIN_CSS };
