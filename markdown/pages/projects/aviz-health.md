# Aviz Health — Case Study

> How Jay Patel designed, engineered, and shipped Aviz Health — a digital healthcare ecosystem with three Flutter apps, a Next.js 16 command center, and a Bun + Hono backend. Live on Google Play as v2.0.

*Hero Project · Live on Google Play.*

Aviz Health is a digital healthcare ecosystem where patients, doctors, labs, pharmacies, nurses, drivers — and the occasional ambulance — all talk to each other in real time.

## The problem — and everyone it had to work for

Healthcare fails in the gaps: booking takes phone calls, lab results live on paper, pharmacies guess at prescriptions, and ambulance dispatch runs on hope and shouted phone calls. Closing those gaps meant serving four stakeholder groups whose needs actively fight each other:

- **Patients** — want care in three taps; they're already having a bad day.
- **Verified partners** (doctors, hospitals, labs, pharmacies) — want schedule control, clean incoming requests, zero ambiguity.
- **Ground operations** — the "Heros" (nurses, drivers, delivery agents) — need task-first, glanceable interfaces that work one-handed.
- **Admins** — need god-view: live dashboards, partner verification, intervention levers.

## My role

Jay owned the entire technical surface: architecture, UI/UX systems, three native mobile apps, the web command center, the API layer, data modeling, third-party integrations, and release engineering.

## Designing for four kinds of users

One design language, four dialects:

- **Patient app (aviz_user)** — comfort-first: large touch targets, plain language, bookings that feel like ordering a ride; video consults; live map tracking of your nurse or ambulance.
- **Partner app (aviz_partner)** — efficiency-first: queues of incoming requests, today's schedule, patient context before consultation starts.
- **Hero app (aviz_heros)** — field-mode: high contrast, oversized controls, task-by-task flows that work while driving.
- **Admin dashboard (aviz_admin)** — mission control: Next.js 16 console with HeroUI components, Zustand state, Recharts analytics, partner verification workflows, live operations oversight.

## Engineering the ecosystem

One monorepo (`aviz_health`): three Flutter apps, the admin dashboard, a shared types package, and the backend under one roof so a protocol change propagates atomically.

- **Backend** — Bun + Hono + TypeScript over MongoDB/Mongoose, Redis caching in front of hot paths. Real-time user-partner matching, appointment state machines, and an ambulance SOS dispatch pipeline built for zero lag.
- **Integrations** — Agora RTC (video consultations), Cashfree (payments), Google Maps (location and routing), Firebase Auth (identity across all four apps).

## Shipping it

Four surfaces, one release cadence; shared-type changes land everywhere together. Aviz is live on Google Play as version 2.0, with the admin console and partner tooling running in production alongside it.

## What it proves

- Took a healthcare platform from empty repo to consumer-grade Play Store release (v2.0) across four applications.
- Designed one UX system flexible enough for patients, clinicians, and field crews without fragmenting into four products.
- Built the real-time backbone — matching, booking, SOS dispatch — the whole value proposition hangs on.
- Integrated the hard third-party surface area (RTC video, payments, maps, auth) that turns demos into products.

## What I learned

In healthcare, the ground-staff app deserves as much design love as the glossy patient app — the nurse using it 200 times a day is your power user. Redis in front of MongoDB is cheap insurance against the traffic spike you didn't model. Monorepos with four synchronized apps are the difference between shipping and archaeology.

## More

- All projects: [projects page](/projects.md)
- About Jay: [about page](/about.md)
