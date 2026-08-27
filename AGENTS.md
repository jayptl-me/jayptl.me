# jayptl.me — Project Rules (AGENTS.md)

Project-level brain. Global laws live in Hermes memory; only jayptl.me facts belong here.

## Hard rules

- STRICTLY hand-written HTML/CSS/JS. No frameworks, no build-step rewrites.
- Light theme = skeuomorphic BLUE ramp (#2196f3).
- Dark theme = glassmorphism TURQUOISE ramp (#00b8cc). NEVER blue in dark.
- Zero emojis in deliverables.

## Ops

- Dev server habitually runs on port 8000 (other projects must not take it;
  swalook backend uses 8001 for this reason).
- Static deploy: Netlify-style `_headers` / `_redirects` + `render.yaml` in root.
- `dist/` is build output; edit sources in `pages/`, `css/`, `js/`.

## Decision Gates — Two-Gate Law (adopted 2026-08-26, global across ~/Development)

1. GATE R — Research that feeds planning finalizes ONLY when Jay picks from named,
   distinct, production-grade options (official docs, live sites, shipped OSS, cited
   sources). Rejection means research MORE distinct/deeper sources; never re-serve
   the same options reworded.
2. GATE P — Implementation starts ONLY after a written plan citing finalized research
   AND Jay's explicit approval. No code edits, DB writes, deploys, builds, or messages
   sent on Jay's behalf before Gate P passes.

Read-only research and diagnostics are unrestricted. Full protocol: Hermes global
skill `option-rack-protocol`. Per-project decision registers log their own entries
(pm/DECISIONS.md where present); numbering is independent per project.
