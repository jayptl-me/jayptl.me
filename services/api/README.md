# jayptl.me API

A small Node service for the static site: page views, uptime, the `/book`
page, and the "now playing" note. **Zero dependencies**: Node built-ins
only (`node:http`, `node:net`, `node:tls`, `node:crypto`, `fetch`). Redis is
spoken through a hand-written client (TLS when the URL is `rediss://`),
Google Calendar and Steam through plain `fetch`.

The site works without it. Until `API_BASE` is set in
`js/components/site-api.js`, the site shows no counter, no status and an
email fallback on `/book`.

## Layout

One folder per feature; shared plumbing in `core/`, outside systems in
`clients/`. Tests mirror the tree.

```
src/
  core/       server.js (entry), app.js (joins the features), router.js
              (CORS, 404/405, logging, plain errors), config.js, errors.js,
              http.js (JSON in and out, 8 KB body cap), auth.js, client-ip.js,
              rate-limit.js, fetch.js (deadlines), store.js, redis-shapes.js
  clients/    redis.js, google.js, steam.js
  features/   health/, views/ (routes, store, sitemap), uptime/ (routes,
              store), booking/ (routes, slots, store), playing/ (routes,
              store), admin/ (routes, page), tick/ (routes)
test/
  core/, clients/, features/   one file per module or feature
  fakes/                       in-memory store, calendar, game platform
  helpers/boot.mjs             the real app on a free port against fakes
scripts/      google-auth.mjs, demo.mjs
```

Each feature's `store.js` lists the keys it owns. `core/store.js` joins
them into one object.

## Endpoints

| Method | Path | Access | What it does |
| --- | --- | --- | --- |
| GET | `/v1/health` | public | Instant liveness, no Redis. Point uptime monitors here. |
| GET | `/v1/status` | public | Redis reachable, last tick, uptime 24h and 30d, one bar per day. |
| POST | `/v1/hit` | public | `{ path }` in, `{ path, views, total }` out. Sitemap paths only. |
| GET | `/v1/views?path=` | public | Read a count without adding one. |
| GET | `/v1/slots?from=&to=` | public | Open 15 minute slots from Google free/busy. Times only. |
| POST | `/v1/book` | public | `{ name, email, note, slot, company, elapsed }`, creates the event. |
| POST | `/v1/cancel` | signed token | Cancels a booking from its confirmation link. |
| GET | `/v1/playing` | public | Newest of Steam and the manual entry. |
| POST | `/v1/tick` | `TICK_SECRET` | Heartbeat, Meet links 15 min ahead, calendar sync every 10 min, 30 day cleanup. |
| GET | `/v1/export` | `ADMIN_SECRET` | JSON backup of counts and bookings. The free Redis has no backups. |
| POST, DELETE | `/v1/admin/playing` | `ADMIN_SECRET` | Set or clear the manual "now playing". |
| GET | `/v1/admin/ip-check` | `ADMIN_SECRET` | Your own request as the API sees it: which address the limits use. |
| GET | `/admin` | page | A tiny page to do the above from a browser. |

Uptime is the share of minutes that received a tick, counted from the
first tick ever.

## Booking safety

- **One winner per slot.** A short lock in Redis means two people pressing
  "Book it" on the same time at once get one invite and one "that time is
  no longer free".
- **Cancel from the invite.** The cancel link is written into the Google
  invite, so a guest who closes the confirmation screen can still cancel.
- **Declines free the slot.** Every 10 minutes the tick checks upcoming
  calls. If the guest declined, or you deleted the event from your
  calendar, the slot opens again and the guest's details are deleted.
- **No orphans.** If saving a booking fails after the invite was created,
  the invite is deleted again and the visitor sees a plain error.

## How the Meet link lands

1. At booking, the event is created **without** Meet, with the guest
   invited (`sendUpdates=all`). Google emails the invite.
2. Each tick looks for calls starting within 15 minutes that have no link,
   adds a Meet conference, and Google emails the guest the updated invite.
3. With a tick every minute the link arrives 14 to 15 minutes ahead. If
   ticks stop, it is added on the next one, even after the call started:
   late, never lost (unless the call has already ended).

## Privacy and abuse

- Views store a path and a number. No IP, cookie, device or referrer.
- IPs are used only in memory for rate limits (120 hits a minute, 5
  bookings a day per address) and never written or logged. Which header
  the address comes from is a setting; see "Visitor address" below.
- Ten wrong secret keys from one address lock that address out of the
  secret endpoints for 15 minutes.
- The scheduler's key (`TICK_SECRET`) can only run the tick. Reading guest
  data needs `ADMIN_SECRET`, which only you hold.
- Each request logs one line: method, path, status, time and a request
  id (also sent back as `X-Request-Id`). Never the query, body, IP or any
  guest detail. Errors reach visitors as a plain message, never an
  upstream code or stack.
- Guest name, email and note are deleted 30 days after the call: by the
  tick, and by the key's own expiry if no tick runs.
- Names lose control and text-direction characters, notes keep only their
  line breaks, and an email longer than 120 characters is refused, never
  cut. Slot ranges are clamped to the booking horizon before the calendar
  is asked.
- A hidden `company` field and a 3 second minimum fill time slow simple
  bots (both are sent by the browser, so a script can fake them); one
  email can hold two upcoming calls; and at most `BOOKING_MAX_NEW_PER_DAY`
  (default 12) new bookings are accepted in any 24 hours from everyone
  together, so the calendar can never be made to email more than that.
  Cancelling does not give the allowance back.
- The email index key is a keyed hash (HMAC with `TOKEN_SECRET`), so a
  list of addresses cannot be tested against it, and it expires with the
  last booking it lists.
- CORS allows only `ALLOWED_ORIGIN`.
- Secret keys are compared in constant time, on hashes, so the time taken
  says nothing about the key or its length.

## Visitor address

The rate limits need an address a visitor cannot write.

- Default (`TRUST_EDGE_IP=false`): the last `X-Forwarded-For` entry, the
  one the host's own proxy adds. An IPv6 address counts as its /64, so
  rotating inside one network does not help. `FORWARDED_HOPS` (default 1) counts
  proxies from the right. Too small a number gives a proxy's address, so
  limits get stricter for everyone behind it; it never lets anyone around
  them. Visitor-written headers (the front of the forwarded list, the
  edge connecting-IP header, `true-client-ip`) are ignored.
- `TRUST_EDGE_IP=true`: the edge network's connecting-IP header. Set it
  only when every request comes through the proxied `api.jayptl.me` and
  the host's own default address is switched off.

To choose, call `GET /v1/admin/ip-check` once with your admin key, then
again adding a made-up `CF-Connecting-IP` header, and compare the answers
with your real address. The answer goes to you only; nothing is logged.

## Storage

The free database plan (30 MB, 30 connections, 100 commands a second) has
**no TLS and no persistence**. Without TLS the password and every value,
guest names and emails included, cross the internet in plain text between
the host and the database. Weigh that before switching booking on; TLS
comes with a paid plan (`rediss://` URL, no code change). The export is
the only backup.

What the API keeps, at most: views about 2 KB (one hash field per sitemap
page), uptime about 10 KB (one 180 byte bitmap per day, kept 40 days),
bookings about 1 KB each (at most 4 a day, kept 30 days after the call,
so about 150 KB), now playing under 1 KB. One connection, reused; every
multi-key read is at most two round trips (ids, then all details in one
pipeline). The uptime math uses `BITCOUNT ... BIT` and the email index uses
`PEXPIREAT ... GT`, so the database must run Redis 7.0 or later.

## Your setup

1. **Redis Cloud**: create a free database, copy its `redis://` URL (see
   "Storage": the free plan has no TLS).
2. **Google**: in a Google Cloud project, enable the Google Calendar API.
   Configure the OAuth consent screen (External, scopes `calendar.events`
   and `calendar.freebusy`) and **publish it "In production"**: in
   Testing, refresh tokens expire after 7 days. Create an OAuth client of
   type **Desktop app**. Then get the refresh token once. On a build box,
   with a tunnel from your own machine so the browser's redirect reaches it:
   ```sh
   ssh -L 53682:127.0.0.1:53682 <box>          # on your machine
   cd services/api                              # on the box, in that session
   read -rs GOOGLE_CLIENT_SECRET && export GOOGLE_CLIENT_SECRET
   export GOOGLE_CLIENT_ID=...
   GOOGLE_AUTH_PORT=53682 node scripts/google-auth.mjs
   ```
   Open the printed URL in your browser, approve (you will see an
   "unverified app" screen once, since only you sign in) and copy the
   printed `GOOGLE_REFRESH_TOKEN`. Run it in your own terminal, never as a
   background job with a log file.
3. **Steam** (optional): get a key at steamcommunity.com/dev/apikey, find
   your SteamID64, and set your profile's game details to Public.
4. **Render**: create a **Web Service** (free), root directory
   `services/api`, runtime Node, build command `true`, start command
   `node src/core/server.js`, health check path `/v1/health`. Add every
   variable from `.env.example`. Keep it your only free web service in
   the workspace: always on, it uses at most 744 of the 750 free hours.
5. **DNS**: point `api.jayptl.me` at the service (CNAME in Cloudflare) and
   add the custom domain in Render. Once it is proxied and the host's own
   address is switched off, check `GET /v1/admin/ip-check` and set
   `TRUST_EDGE_IP=true` (see "Visitor address").
6. **Scheduler**: call `POST https://api.jayptl.me/v1/tick` every minute
   with header `Authorization: Bearer <TICK_SECRET>` (for example a
   per-minute job on cron-job.org). Point any uptime monitor at
   `/v1/health`, never `/robots.txt` (Render answers that while asleep).
7. **Turn it on in the site**: set `API_BASE` in
   `js/components/site-api.js` to `https://api.jayptl.me`, and add the
   same origin to `connect-src` in `scripts/security-headers.js` (a test
   fails if they disagree). Rebuild and deploy the site.

## Develop and test

```sh
cd services/api
node --test 'test/**/*.test.mjs'   # all endpoints against fakes
cp .env.example .env               # then fill it in
node --env-file=.env src/core/server.js
```

The site's own `bun run test` runs these too, through the recursive glob
`services/api/test/**/*.test.mjs`.

Tests run on the build box, never on the Mac. Render runs the service on
Node; the code uses only built-ins that both Node and Bun provide.

For local runs against the site preview on port 8000, add
`http://localhost:8000` to `ALLOWED_ORIGIN`.
