# Genuinest — Case Study

> How Jay Patel served as Founding Engineer at Genuinest — building the Flutter product and migrating the company from costly cloud services to a fully self-hosted Docker, Coolify, and Traefik stack with 20TB of MinIO storage.

*Founding Engineer · Self-hosted infrastructure.*

The brief was "build our app." The real job became "build our app, then unhook the company from its cloud bill."

## The problem — and who felt it

Two problems, one wearing a trench coat. First: an early-stage company needed its core cross-platform product actually built — properly, not prototype-grade. Second — the quieter killer: every month, the cloud invoice grew faster than the user base. Founders watched burn rate get eaten by infrastructure line items that scaled with success and punished them for existing.

## My role

Founding Engineer means you build the thing, then you build the thing that builds the thing. Jay architected the core Flutter application, built the backend API, and spearheaded the entire DevOps transition from high-cost cloud providers to automated, containerized self-hosted deployment. Private client work — the engineering is the story.

## Designing the product

- **Riverpod for state** — compile-safe dependency injection and testable state containers.
- **GoRouter for navigation** — declarative, deep-linkable routes.
- **Hive/SQLite offline-first storage** — the app keeps working when the network doesn't.
- **Firebase Cloud Messaging** — push wired into one notification surface across platforms.

## Engineering it

- **API layer** — Bun + Hono + TypeScript with Zod validation at the edge, JWT access/refresh token rotation, rate limiting, OpenAPI/Scalar docs.
- **Data plane** — on-premise MongoDB, Redis, MeiliSearch (instant search), RabbitMQ.
- **Storage** — a 20TB MinIO S3-compatible object-storage cluster, the single biggest line item on the old cloud bill, brought in-house.
- **KYC** — Surepass PAN/Digilocker verification flows.
- **Observability** — OpenTelemetry collector feeding SigNoz, PostHog product analytics, Slack webhooks, Resend email.

## Shipping it — the migration story

Docker multi-stage builds slimmed every service to deployable artifacts. Coolify turned deployments into a button instead of a ceremony. Traefik v3 fronted everything with automatic HTTPS via Let's Encrypt, and Tailscale stitched the private network together. The cutover happened while the business kept running — data migrated, DNS flipped, and the recurring storage bill dropped to bare utility costs. Same reliability, fraction of the burn.

## What it proves

- "Founding Engineer" is a scope, not a title: product, API, infrastructure, observability, compliance — owned end to end.
- Self-hosting is a legitimate cost strategy at startup scale when executed with containerization discipline.
- Modern tooling (Docker, Coolify, Traefik, Tailscale) collapses the ops-team-sized gap a solo engineer used to face.

## What I learned

Cloud convenience has a price tag; sometimes paying it in one-time hardware and a weekend of discipline is the better deal. Never migrate storage on a Friday. Always keep the old provider warm until DNS propagates globally. Write the rollback runbook before you need the rollback runbook.

## More

- All projects: [projects page](/projects.md)
- About Jay: [about page](/about.md)
