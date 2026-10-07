# jayptl.me API

A small Node service for the static site: page views, uptime, the `/book`
page, and the "now playing" note. **Zero dependencies**: Node 22 built-ins
only (`node:http`, `node:tls`, `node:crypto`, `fetch`). Redis is spoken
through a hand-written client over TLS, Google Calendar and Steam through
plain `fetch`.

The site works without it. Until `API_BASE` is set in
`js/components/site-api.js`, the site shows no counter, no status and an
email fallback on `/book`.

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
3. With a tick every minute the link arrives 15 to 16 minutes ahead. If
   ticks stop, it is added on the next one: late, never lost.

## Privacy and abuse

- Views store a path and a number. No IP, cookie, device or referrer.
- IPs are used only in memory for rate limits (120 hits a minute, 5
  bookings a day per address) and never written or logged. The IP comes
  from the edge network's connecting-IP header, which visitors cannot
  fake, not from the forwarded list (see `TRUSTED_IP_HEADERS`).
- Ten wrong secret keys from one address lock that address out of the
  secret endpoints for 15 minutes.
- The scheduler's key (`TICK_SECRET`) can only run the tick. Reading guest
  data needs `ADMIN_SECRET`, which only you hold.
- Each request logs one line: method, path, status, time and a request
  id (also sent back as `X-Request-Id`). Never the query, body, IP or any
  guest detail. Errors reach visitors as a plain message, never an
  upstream code or stack.
- Guest name, email and note are deleted 30 days after the call.
- A hidden `company` field and a 3 second minimum fill time stop bots; one
  email can hold two upcoming calls.
- CORS allows only `ALLOWED_ORIGIN`.

## Your setup

1. **Redis Cloud**: create a free database, copy its `rediss://` URL.
2. **Google**: in a Google Cloud project, enable the Google Calendar API.
   Configure the OAuth consent screen (External, add yourself) and
   **publish it "In production"**: in Testing, refresh tokens expire after
   7 days. Create an OAuth client of type **Desktop app**. Then, on your
   own machine:
   ```sh
   cd services/api
   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... bun run google-auth
   ```
   Approve in the browser (you will see an "unverified app" screen once,
   since only you sign in) and copy the printed `GOOGLE_REFRESH_TOKEN`.
3. **Steam** (optional): get a key at steamcommunity.com/dev/apikey, find
   your SteamID64, and set your profile's game details to Public.
4. **Render**: create a **Web Service** (free), root directory
   `services/api`, runtime Node, build command `true`, start command
   `node src/server.js`, health check path `/v1/health`. Add every
   variable from `.env.example`. Keep it your only free web service in
   the workspace: always on, it uses at most 744 of the 750 free hours.
5. **DNS**: point `api.jayptl.me` at the service (CNAME in Cloudflare) and
   add the custom domain in Render.
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
bun test test/                 # all endpoints against fake Redis and Google
cp .env.example .env           # then fill it in
node --env-file=.env src/server.js
```

Tests run on the build box, never on the Mac. Render runs the service on
Node; the code uses only built-ins that both Node and Bun provide.

For local runs against the site preview on port 8000, add
`http://localhost:8000` to `ALLOWED_ORIGIN`.
