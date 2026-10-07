# Projects liveness audit, 2026-09-30

Every card on /projects was checked for a live domain: the three URLs Jay
gave (thhiya.com, swalook.in, bhawbhaw.com), the Ai-Vestor Render URL he
added, likely domains probed by name, and deployed URLs found in the local
project repos (read only). A domain counts as live only when it answered
200 and the page is the project itself. Captures: headless Chrome, light
scheme, reduced motion, consent bars and floating widgets hidden,
retina (2x) then saved at the sizes below. Capture tool:
`.agents/memory/tools/capture-set.mjs`.

## Live (card shows the real site, title links out)

| Project | URL | Gallery |
|---|---|---|
| Aviz Health | https://avizhealthcare.com/ | `assets/case-studies/aviz-health/gallery/` 7 desktop, 5 phone |
| Swalook CRM | https://swalook.in/ | `assets/case-studies/swalook-crm/gallery/` 8 desktop, 5 phone |
| Genuinest | https://genuinest.com/ | `assets/case-studies/genuinest/gallery/` 8 desktop, 5 phone |
| Thhiya | https://www.thhiya.com/ | `assets/projects/thhiya/gallery/` 2 desktop, 1 phone (900px, see note) |
| BhawBhaw / Wocofy | https://www.bhawbhaw.com/ | `assets/projects/bhawbhaw/gallery/` 7 desktop, 5 phone |
| Ambica Impex | https://ambicaimpex.in/ | `assets/projects/ambica-impex/gallery/` 7 desktop, 5 phone |
| Ai-Vestor | https://ai-vestor-frontend.onrender.com/ | `assets/projects/ai-vestor/gallery/` 4 desktop, 5 phone |
| Whyknot.live | https://www.whyknot.live/ | `assets/projects/whyknot/gallery/` 1 desktop, 1 phone (launch teaser) |

Sizes: desktop frames 1440x900 JPEG (one per screen, scrolled top to
bottom), phone frames 780x1688 JPEG (390x844 at 2x). Card covers 720x450.
The three case studies kept their existing covers; their galleries are new
and each case study gained a "Live site" fact row.

Notes:
- Thhiya answered 200 at the start of the audit, then its host suspended
  the service minutes later (HTTP 503, "Service Suspended"). The full-size
  set was lost (deleted before the retake, agent error); three 900px frames
  were recovered from the session transcript. Recaptured in full on
  2026-10-07 once the site was back (8 desktop, 5 phone); links use
  https://www.thhiya.com/#home.
- Ambica: the "connected routes" map section shows the site's own
  "API KEY REQUIRED" error, so that frame was dropped.
- Ai-Vestor runs on a free Render service, so the first visit can take a
  while to wake. Its card copy still says "deployed on Oracle Cloud".

## Not live (card keeps its drawing)

| Project | What was found |
|---|---|
| Aorta Rooms | aortarooms.com and api.aortarooms.com no longer resolve (no DNS). The card claimed "Live" and linked out; now "Private Client", "Shipped", no link. |
| Niti Health | niti.nexuserp.co.in and healthka.live from the repo do not resolve. |
| Tenet PG Management | tenetpg.com (in the repo) does not resolve. Card still links to GitHub. |
| School Of Hatha Yoga | Corrected 2026-10-07: live at https://schoolofhathayoga.org/ (Jay confirmed; the audit wrongly called it unrelated). Now a feature card with a gallery in `assets/projects/hatha-yoga/gallery/`. |
| Everything else | No domain found in the repo or by name; personal and open-source cards keep their GitHub links. |

Not taken: aivestor.com and crosscheck.app answered but are not Jay's
(the real Ai-Vestor is on Render). admin.ambicaimpex.in is a login screen.
