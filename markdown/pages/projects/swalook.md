# Swalook CRM — Case Study

> How Jay Patel rebuilt Swalook CRM from the ground up — a Next.js 16 Turborepo frontend, a Bun + Hono backend with 35+ documented endpoints, and a Flutter consumer app with ML Kit AR previews.

*Enterprise SaaS · In production.*

Some CRMs are built. Swalook was rebuilt — a ground-up architectural overhaul of a salon-management platform serving real merchants with real concurrent workloads, where "the dashboard is slow" is a business problem, not a vibe.

## The problem — and who felt it

Salons run on tight margins and tighter schedules. Merchants need the day's bookings, walk-ins, and revenue at a glance on mediocre hardware at 9 AM; end customers expect modern UX (including seeing a hairstyle on their own face before committing); platform admins run multi-tenant onboarding and oversight; the business needed a foundation that could ship features weekly, not quarterly.

## My role

Jay executed the complete architectural overhaul — five repositories orchestrated into one coherent platform: `swalook-frontend-new`, `swalook-backend`, `swalook-prototype` (Flutter), `swalook-landing-page`, and `crm-super-admin`.

## Designing the overhaul

- **Turborepo monorepo over repo sprawl** — five products sharing types, components, and release discipline.
- **Shadcn UI + Recharts for the merchant experience** — dense information design that stays legible on a 13-inch screen at a busy front desk.
- **A consumer app that earns its install** — Flutter with Provider, Dio, video playback, and ML Kit face-mesh detection overlaying hairstyle previews in AR.

## Engineering it

- **Frontend** — Next.js 16 App Router in TypeScript with TanStack patterns, Shadcn UI, Recharts analytics.
- **Backend** — Bun + Hono + TypeScript, migrated from MySQL to PostgreSQL on Aiven with Drizzle ORM, Redis caching (ioredis) on hot reads, and BullMQ job queues. 35+ REST endpoints documented end-to-end with OpenAPI/Scalar.
- **Multi-tenancy** — super-admin console with role-based access control across tenants.
- **Deployments** — managed across Vercel and Render, tuned for high-throughput concurrent merchant traffic.

## Shipping it

A living production system, not a portfolio demo: versioned releases (v1.90 tagged across frontend and backend), merchants transacting daily, SEO-optimized landing pages plus a Framer-Motion-animated blog. Deploys go out while businesses are open.

## What it proves

- Enterprise rewrites can ship incrementally without pausing revenue — the platform kept running merchants' days while being replaced underneath them.
- Bun + Hono + Drizzle is a production-grade stack: documented APIs, queues, caching layers and all.
- ML Kit face-mesh AR isn't a gimmick when it moves booking conversion.

## What I learned

Data migrations are about trust, not schema. OpenAPI documentation written early pays rent forever — the Scalar docs became the team's source of truth.

## More

- All projects: [projects page](/projects.md)
- About Jay: [about page](/about.md)
