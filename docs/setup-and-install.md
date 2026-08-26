# Setup & install

## Claude Code plugin packaging (`#7`, 2026-07-14)

The webkit can now be installed as a Claude Code plugin, not just used by
forking/templating the repo. `.claude-plugin/` added; plugin version tracked
independently (bumped to 0.2.0 alongside the Stage 0 rework below).

## Interactive setup → read-only connectivity check

- **2026-07-14 — `feat: interactive setup wizard (npm run setup)`** — first cut: wrote `.env` with masked prompts, live-checked all five Open Pulse endpoints, scaffolded pages from four layout archetypes, applied project identity.
- **2026-07-14 — `refactor: rescope setup wizard to a read-only connectivity check`** — narrowed to the deterministic part that belongs in a plain script. Renamed to `tools/check-connectivity.mjs` (`npm run check-connectivity`): read-only, live-checks all five endpoints (Neo4j, SPARQL, OpenSearch, CHAOSS, hub), never writes `.env` or app files. `.env` generation and page scaffolding moved to the `/new-dashboard` skill instead (framework-aware judgement work, not a fixed script).
- **2026-07-22 — folded into the gateway unification fix** — rewritten again to probe every store through the unified hub gateway instead of raw per-store ports/vars.

## README rewrite (six commits, 2026-07-15 → 2026-07-16)

Restructured around two install paths — **fork/template** vs. **install the
Claude Code plugin** — each with its own complete, self-contained numbered
path instead of shared steps with "plugin users skip this" asides:

1. Split into an Installation section with per-path first steps.
2. Restructured again into a zero-knowledge **Part 1 (Get started)** —
   prerequisites → get the kit → `.env` + connectivity check → run the
   wizard → `npm run dev` — and a condensed **Part 2** reference (platform
   URLs, wizard stages, design skills, CHAOSS, layout, devcontainer, Pages
   publishing).
3. Dropped "fork" as an alternative to "use this template" — a fork isn't
   the same as a clean independent repo.
4. Noted that plugin installs need `/reload-plugins` to load skills
   in-session.
5. Promoted "bring your own framework" from a blockquote aside to a headed
   Part 1 section.
