---
name: new-dashboard
description: Guided wizard that interviews the user and scaffolds an Open Pulse dashboard in src/your-web/ — first sets up the project structure and walks the user through creating .env (works in plugin mode on an empty project); asks about scope, design intent, drill-down themes, stack, and publishing; checks the stores are reachable and cover the scope before promising sections; when the user wants a non-SDSC look, generates a custom design skill from a short interview; writes a short plan the user approves; then scaffolds, wires real data, and verifies in the browser. TRIGGER when the user wants to start a new dashboard or site on Open Pulse, asks "where do I start?", or wants help deciding what to build. SKIP when they ask a specific data question (query-* / op-* skills) or a specific UI task on an already-scaffolded app (frontend-dev).
---

# New Dashboard wizard

Walk the user from "I want a dashboard" to a running, verified scaffold — one decision at a time. You drive the interview: make concrete suggestions, ask one stage's questions at a time, and always offer options rather than open-ended prompts.

## Ground rules

- Ask with the **AskUserQuestion tool** when your runtime has it — one call per stage, at most 4 options per question, `multiSelect` where noted; the tool adds an "Other" free-text escape automatically. On runtimes without a structured question tool, ask the same questions in plain text and wait.
- After each stage, restate the outcome in one sentence before moving on, so the user can correct course cheaply.
- **Secrets never enter the chat.** Never ask the user to paste a credential into the conversation, never read `.env` values aloud, and never echo one in output, a commit, or a log. When you must inspect `.env` (e.g. to find unfilled placeholders), report **key names only**, never values. The user fills `.env` themselves in their own editor; if they do paste a secret into the chat, tell them to treat it as exposed and rotate it.
- **Data before promises.** Never commit to a dashboard section until Stage 3 has confirmed the stores actually cover the user's scope. An empty section kills trust in the whole dashboard.
- Follow the repo defaults from `AGENTS.md`: static-first (GitHub Pages, no server runtime), build-time data snapshots, D3 for bespoke interactive charts, the required attribution bar, and `--op-*` design tokens only.
- Before writing any UI, read the `frontend-dev` skill and the active design skill declared in `AGENTS.md` (if those design skills are installed).

## Stage 0 — Project setup, `.env`, & connectivity check (no questions yet)

First establish which mode you're in: a **template checkout** of pulseWebKit (repo root has `AGENTS.md`, `.env.example`, `tools/check-connectivity.mjs`), or **plugin mode** — the skill installed via the `open-pulse` plugin into some other project, possibly an empty one.

**1. Create the project structure first.** Before checking anything, make sure the project has the pieces the wizard depends on. In plugin mode (or any project missing them), create:

- `src/your-web/` — the app directory the scaffold will fill (leave it empty for now).
- `.env.example` at the project root — copy it **verbatim** from this skill's own `assets/env.example` (next to this SKILL.md). Never invent the keys from memory.
- A `.gitignore` entry for `.env` — append `.env` if the file exists, create it if not. Do this *before* the user creates `.env`, so credentials can't be committed by accident.

In a template checkout all of this already exists — skip creation. If an app already exists in `src/your-web/`, ask whether to **extend it** or **start fresh** before anything else.

**2. Then check for `.env` — and tell the user exactly what to do.** Look for `.env` at the project root:

- **Missing:** stop and give precise, copy-pasteable instructions — not just "set up your env". Tell them to run `cp .env.example .env`, open `.env` **in their own editor**, and fill in `OPENPULSE_ENDPOINT` (the hub gateway URL) and `OPENPULSE_AUTH` (a reader token — this one pair covers Neo4j, SPARQL, OpenSearch, and the CHAOSS metrics API, since all of them are reached through the same gateway) — plus `OPENPULSE_ADMIN_AUTH` only if they'll run crawls/extractions. Credentials come from whoever operates their Open Pulse deployment ([openpulse.science](https://openpulse.science) for the SDSC instance). Be explicit about the safe way to fill it: they edit the file directly and **never paste a credential into this chat** — you don't need to see the values, only that the file exists; the Stage-0 probes will confirm the credentials work without you ever reading them back. Remind them `.env` must never be committed. Then **wait for them to say it's done** before probing.
- **Present but with placeholders:** name the exact keys still unfilled and what each unlocks, so they can decide whether to fill them now — a store with a placeholder key is *skipped*, not broken, and Stage 2–3 simply won't promise sections that need it. Report key names only — never echo a filled-in value back into the chat.

**3. Verify the stores actually respond** — don't wait until Stage 3 to discover a store is down.

- **Clone / template checkout (preferred):** run `npm run check-connectivity` (`node tools/check-connectivity.mjs`). It live-checks all five stores against the repo-root `.env` — Neo4j, SPARQL (Oxigraph), OpenSearch, the CHAOSS metrics API, and the Open Pulse hub — and prints one line each: **✔** reachable (with a node count / version), **✖** configured but unreachable (wrong credential, or the store is down), and **• skipped** — the key is still an `.env.example` placeholder, i.e. *not configured*. If it reports no `.env`, go back to step 2 above.
- **Plugin mode, or if the script isn't there:** the script reads the *webkit* repo-root `.env`, not the host project's, so it can't help a plugin-in-a-foreign-project. Fall back to one cheap probe per store with the query skills you already have — `query-neo4j` `MATCH (n) RETURN count(n)`, `query-sparql` `ASK { ?s ?p ?o }`, `query-opensearch` `SELECT count(*) FROM git_demo_enriched`, one `query-chaoss` metric, one `op-collections` `/api/stats/` — and report the same three states per store.

Either way, distinguish **not configured** (a placeholder key — fixable by filling in `.env`) from **configured but unreachable** (bad credential, or the store is down), and carry the per-store verdict into Stages 2–3: a store that can't answer now cannot back a theme later, so don't promise a section it can't fill.

## Stage 1 — Scope, audience & story

One AskUserQuestion call, four questions:

1. **"What slice of the Open Pulse data should this dashboard tell the story of?"**
   Options: a school/institute/lab cluster · a single organisation or product · a topic or discipline · the whole platform. (These map to the theme structures in `AGENTS.md` §*Reference outcome*.)
2. **"Who is the primary viewer?"**
   Options: research leadership & funders · the researchers/developers whose work it shows · the broader public & community · a mixed audience. This drives vocabulary and metric choice: leadership/funders care about impact, outcomes, and coverage; developers care about health, activity, and dependencies; a public audience needs plain language and zero unexplained jargon.
3. **"Should it lean storytelling or stats?"**
   Options: "Hybrid — a narrative landing, dense drill-downs (Recommended)" · "Storytelling — a guided narrative with annotated highlights" · "Stats reference — dense numbers, tables, filters". Consequences: *storytelling* means fewer, larger numbers, one signature visual per theme, written takeaways next to every chart, and a deliberate reading order; *stats reference* means tile grids, filterable tables, exact values, and no prose padding; *hybrid* puts the story on the landing page and the density one click down.
4. **"Do you have a specific design in mind?"**
   Options: "Yes — I'll describe it (or paste a link/screenshot)" · "Show me the reference archetypes first" · "No — follow the SDSC design system and propose something".

If they picked "describe it", collect the description now (colours, fonts, mood, any link/screenshot) — this becomes the design brief that Stage 1b turns into a real design skill. If they picked "show me", present the three layout archetypes (full-page graph canvas · list/detail · card grid) as options with short ASCII `preview` mockups so they can compare side by side. If they picked "follow SDSC", note that the default active design skill (`openpulse-dark-theme` over `sdsc-ui-kit`) is used as-is and **skip Stage 1b**.

Then get the concrete scope: ask for the GitHub org(s)/repos, ROR institution, or topic keywords that define their slice.

## Stage 1b — Custom design → brand skill (optional; only if not SDSC)

Run this **only** when Stage 1's design answer was non-SDSC ("describe it", or "you pick, just not SDSC"). Skip it entirely on the SDSC default — the active design skill is already installed.

A custom look is first-class in this template only when it exists as a **design skill** implementing the `--op-*` token contract — a loose brief isn't something the scaffold can build against reliably, and it can't be swapped or re-used. So turn the brief into one now: follow `references/design-skill.md` (read it) to run a short design interview (brand name, source of truth, dark/light, accent, surfaces, fonts, corner style), **derive every contract token** (`frontend-dev` §2) with WCAG-AA contrast, and write `.agents/skills/<slug>/` (`SKILL.md` + `assets/tokens.css`). Then activate it: update the *Active design skill* line in `AGENTS.md` and run `node tools/sync-agents.mjs`. Confirm the derived palette with the user (show the accent + surfaces) before moving on. Stage 6 then scaffolds against this skill exactly as it would the SDSC one. The manual version of the same recipe lives in `.agents/SKILLS.md` §11.

## Stage 2 — Themes

First offer the reference skeleton. One question: **"Structure the dashboard on the proven skeleton?"** Options: "Yes — landing page + the 4 standard themes (Recommended)" · "Start from the skeleton but adapt the themes" · "No — design a custom theme set with me". The skeleton lives in `references/dashboard-skeleton.md` next to this file — read it before continuing when either of the first two is chosen. Its four themes: **The Landscape** (*what exists?*) · **People & Community** (*who's behind it?*) · **Health & Activity** (*how alive and healthy is it?* — the CHAOSS home) · **Research Impact** (*what does it produce?*).

- **Skeleton (or adapted):** confirm with one `multiSelect: true` question which of the four themes go in v1, and ask the skeleton's flagged framing decision — show all repository types, or lead with Software only? Never decide that silently.
- **Custom:** propose 3–5 drill-down themes matched to their scope type, phrased as questions **the Stage 1 viewer would actually ask** (see `AGENTS.md` §*Reference outcome* for the per-scope structures), then confirm with `multiSelect: true`.

Either way, let the story/stats answer shape the framing — for storytelling, order the themes as chapters with a one-line takeaway each; for stats, present them as metric groups — and always include the two fixed elements regardless of the answer: the **at-a-glance landing page** and the **"What's missing?" coverage panel**.

## Stage 3 — Data reconnaissance (do the work, then report)

Before promising anything, verify coverage with the query skills against the user's scope:

- `query-neo4j` — does the org/repo set exist in the graph? How many repos, contributors, edges? Remember: identifier properties hold **full GitHub URLs**, not slugs.
- `query-opensearch` — commit history depth for the scope (time series live here, not in Neo4j).
- `query-sparql` / `op-collections` — publications, ORCID/ROR links, other metadata for the scope.
- `query-chaoss` — spot-check 2–3 metrics on the scope's flagship repos.

Watch for the classic traps: **forks inflating repo counts** (check `FORK_OF` / fork flags and say which number you report), **sparse publication links** (a software→papers theme may need to be reframed as a coverage panel), and hub API result caps. Report what you found in a short table — *theme → data present? → caveat* — and ask one question: proceed with these themes, or adjust?

## Stage 4 — Stack & publishing

One AskUserQuestion call:

1. **Framework** — suggest what fits their design brief; options like "Plain HTML/CSS/JS (lightest)" · "Svelte" · "React" · "Astro". Any choice is fine; the design system is framework-neutral.
2. **Publishing** — "Static, GitHub Pages (recommended)" · "Live queries via a server-side proxy". If static: plan a build-time snapshot script (`scripts/fetch-data.mjs`, recipe in `.agents/SKILLS.md` §10) that queries the stores with the same transports as the `query-*` skills and writes typed JSON into `src/data/` — credentials stay at build time. If live: credentials must sit behind a server endpoint the browser calls; never in client code.

## Stage 5 — Write the plan, get sign-off

Before building, write a short plan to the project (default `src/your-web/DASHBOARD.md`) and get explicit approval. This is the one artifact that outlives the interview — the contract the scaffold is built against, and where the Stage 3 findings are *recorded* rather than remembered. Keep it to about a page:

- **Scope & audience** — the data slice, the primary viewer, and the storytelling-vs-stats posture (Stage 1).
- **Themes** — the landing page plus each chosen theme, one line each on the question it answers and its headline metric (Stage 2).
- **Data reconnaissance** — the Stage 3 table (*theme → data present? → caveat*) and the Stage 0 connectivity result, so every coverage decision is traceable.
- **Stack & publishing** — framework, static-vs-proxy, and the snapshot outputs the build will bake (Stage 4).
- **Design system** — the active design skill the scaffold builds against: the SDSC default (`openpulse-dark-theme`), or the `<slug>` skill generated in Stage 1b (with its mode + accent), so the design decision is as traceable as the data ones.
- **Open framing calls** — anything surfaced but deliberately not decided (repository-type filter, fork handling), so it isn't silently resolved during scaffolding.

Show it, ask **"build this?"**, and adjust before writing any code. Skip only if the user explicitly waves it off.

## Stage 6 — Scaffold, wire, verify

Now build, without further questions unless something contradicts the approved plan. Follow the concrete recipe in `references/scaffold-checklist.md` (read it now) — it layers the dashboard specifics on top of `frontend-dev` §8 (token/font/shell mechanics) and `.agents/SKILLS.md` §9–§10 (dashboard shape + the build-time snapshot). In outline:

1. **Snapshot first.** Write `scripts/fetch-data.mjs` (SKILLS.md §10) resolving the Stage 1 scope to real data and baking typed JSON into `src/data/`. Every headline number the landing shows comes from here — never a hardcoded figure, never lorem-ipsum. Run it and check the row counts against Stage 3.
2. **Shell & tokens** per `frontend-dev` §8: the chosen framework in `src/your-web/`, `--op-*` tokens copied from the active design skill's `assets/tokens.css` — the SDSC default or the Stage 1b `<slug>` skill — and the required **attribution bar** (build-time ISO-8601 UTC timestamp, `frontend-dev` §6) on every route.
3. **Landing page**, fed by the snapshot and shaped to the Stage 1 posture: a narrative lede with annotated highlights (storytelling/hybrid) or a headline stat-tile row (stats reference), written in the primary viewer's vocabulary. Each headline links down into its theme.
4. **Theme pages** — stub each chosen theme with its headline metric wired to real data and a clearly-marked TODO body; attach the shared **provenance disclosure** (`frontend-dev` §7) to every data card, and include the fixed **"What's missing?" coverage panel** fed by `coverage.json`.
5. **Verify in the browser** (Playwright MCP when available — navigate, screenshot, check the console). A passing build is not verification.
6. **Close** by reporting what was built, what data feeds it, and the 2–3 highest-leverage next steps (usually: flesh out theme #1, deepen the coverage panel, set up the Pages deploy workflow).

## Tone

Suggest, don't interrogate: every question should carry a recommended default ("(Recommended)" as the first option). Keep each stage's message short — the user is choosing, not reading a report.
