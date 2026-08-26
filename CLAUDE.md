# CLAUDE.md — pulseWebKit (Open Pulse web app)

Agent instructions for this repository. Read this first, then `.claude/PROJECT.md` for the broader mission, `.claude/SKILLS.md` for concrete task recipes, and — before touching any UI — the `frontend-dev` skill (engineering mechanics) plus the **active design skill** (see *Design system* below).

<!-- sync:keep -->
> **Note on dual agent dirs:** `.claude/` is the canonical source of truth for project docs and skills. `.agents/` (plus root `AGENTS.md`) is a generated, vendor-neutral mirror for non-Claude agent runtimes. **Edit `.claude/` only**, then run `node tools/sync-agents.mjs` to regenerate `.agents/`. CI fails if they drift (`node tools/sync-agents.mjs --check`).
>
> **Agent compatibility:** Claude Code reads `CLAUDE.md` + `.claude/skills/`. Tools following the open `AGENTS.md` standard (Codex, Cursor, …) read root `AGENTS.md`. The [Pi coding agent](https://pi.dev) reads both `CLAUDE.md`/`AGENTS.md` **and** auto-discovers skills directly from `.agents/skills/` — so the generated mirror is natively usable by Pi with no extra config. Whatever the tool, the skills also work as plain documented commands (`python .claude/skills/<skill>/query.py …`), so an agent never has to support a proprietary skill loader to use them.
<!-- sync:endkeep -->

---

## What this is

**pulseWebKit** (working name: *pulseNext*) — a starter that will be published as a **GitHub template repo** so researchers and developers can fork it to build their own dashboards or interactive sites on top of the **Open Pulse** platform.

The Open Pulse platform (Neo4j + Oxigraph + OpenSearch) is the data layer; this kit demonstrates how to pull, type, and visualise variables from it. See `.claude/PROJECT.md` for the full mission, data-source overview, and template-extension guidance.

**Framework-neutral.** This template does **not** prescribe a UI framework. The web app lives in `src/your-web/` — build it with whatever you like (plain HTML, React, Vue, Svelte, Astro, web components, …). The two things that *are* fixed are framework-independent: the **Open Pulse query skills** (`.claude/skills/`) and the **design-skill system** (a `--op-*` token contract defined in the `frontend-dev` skill, with values supplied by a swappable design skill — see *Design system*). Keep those; swap everything else.

---

## Preferred approach — static-first, user-focused

No framework is mandated, but the template carries a **default posture**. Lean this way unless the user asks for something else:

- **Static-first.** Build something that publishes to **GitHub Pages with no server runtime** — a static bundle of HTML/CSS/JS. Optimise for the end user: fast first paint, accessible markup, minimal blocking JS, progressive enhancement.
- **Data strategy**, in order of preference:
  1. **Inline in the HTML** — for small datasets, bake the data into the page at build time (e.g. a `<script type="application/json">` block or pre-rendered markup). Zero fetch, instant render.
     The canonical implementation is a **build-time snapshot script** (`scripts/fetch-data.mjs` in your app) that queries the stores with the same transports as the `query-*` skills and writes typed JSON into `src/data/` — credentials stay at build time and the browser never talks to the stores. See `.claude/SKILLS.md` §9–§10.
  2. **Optimised static assets** — serve **web-optimised images**: responsive sizes, modern formats (AVIF/WebP), explicit dimensions, lazy loading. Never ship original-resolution images.
  3. **DuckDB-Wasm over Parquet** — for larger or queryable datasets, ship `.parquet` files as static assets and query them **in-browser** with [DuckDB-Wasm](https://duckdb.org/docs/stable/clients/wasm/overview). Stays fully static (no backend), columnar + compressed, with fast client-side filtering/aggregation.
- **Interactive visualisation** — use **client-side JS** for plots and graphs. Default to **[D3.js](https://d3js.org)** for bespoke/interactive charts and the force-directed graph; other JS viz libraries are fine where they fit. Charts should be **interactive** (hover, zoom, filter) — not static images.
- **Attribution bar (required).** Every page renders a top bar reading **`Built using openpulse.science at <timestamp>`**, where `<timestamp>` is the **build time** (ISO 8601 UTC, injected at build — never computed in the browser). Link `openpulse.science`. Visual spec: active design skill (`openpulse-dark-theme` §7.4).

These are defaults that make the GitHub-Pages publishing path (see README) the path of least resistance. If a request genuinely needs a server runtime or live queries, say so and fall back to the server-side proxy pattern below.

---

## Reference outcome (what a finished dashboard looks like)

Most sites built from this kit are **scoped dashboards**: they tell the open-source story of *some slice* of the Open Pulse data — a school, an institute, a lab cluster, a topic/discipline, a funding programme, or a single organisation. Whatever the scope, the recommended shape is the same:

- **Landing page — "at a glance"** (required): 5–6 headline numbers + one signature visual, every element linking down into a drill-down page. A reader gets the gist without scrolling through everything.
- **A handful of drill-down themes** (not a flat widget list), each anchored to one question a reader would actually ask. Example structures:
  - *Research scope (school, institute, lab cluster)*: what exists? (inventory + filterable catalogue) · who's behind it? (the collaboration network from Neo4j) · how alive and healthy is it? (the CHAOSS home) · what does it produce? (the software→papers funnel, with publication systems as a *source*, not a section).
  - *Single organisation or product*: catalogue & releases · community health · adoption/usage · dependencies.
  - *Topic or discipline*: inventory & technology breakdown · key projects · activity over time · who works on it across institutions.
- **A "What's missing?" coverage panel**: metadata gaps as an actionable to-do list, not a footnote — every scope has them.
- **A standardized "How is this computed?" disclosure** (source / method / refresh cadence / caveats) on every data card — one shared component, never bespoke per-section text (`openpulse-dark-theme` §7.5).

Whatever theme set you pick, title growth widgets precisely — **ecosystem growth** (more repos over time) and **per-repo growth** (one project's trajectory) are different data cuts. The underlying layout archetypes — full-page graph canvas, list/detail, card grid — live in the `sdsc-ui-kit` skill (`references/layouts.md`), with their dark mappings in the `openpulse-dark-theme` skill §7–§8. Data-side recipes live in `.claude/SKILLS.md` §9–§10.

---

## The web app — `src/your-web/`

The app you build lives in `src/your-web/`. Pick a framework, scaffold it there, and wire it to Open Pulse through a **server-side** layer (see Architecture). This template ships the agent tooling and design system; the app itself is yours to scaffold.

Typical local dev (adjust to your chosen tooling):

```bash
cd src/your-web
npm install
npm run dev      # local dev server
npm run build    # production build (for GitHub Pages — see README)
```

If your stack has a type/lint check, run it before every commit; CI runs it on every push and PR.

---

## UI verification — REQUIRED for frontend work

This repo ships **Playwright MCP** (`@playwright/mcp`) for UI verification, enabled via `.claude/settings.json` (`enabledMcpjsonServers: ["playwright"]`). Config is port-locked to the local dev/preview servers (`5173`, `4173`).

| Runtime | Active config | How it runs |
|---|---|---|
| **Host** (native) | `.mcp.json` ← `.mcp.host.json` | `npx @playwright/mcp` (stdio). Run `npx playwright install chromium` once. |
| **Devcontainer** | `.mcp.json` ← `.mcp.docker.json` | HTTP to the `playwright-mcp` sidecar at `http://localhost:8931/mcp` (set automatically in `post-create`). |

Switch manually: `bash tools/image/docker/setup-mcp.sh host` or `… docker`. Canonical templates: `.mcp.host.json`, `.mcp.docker.json`.

**Rules for any change that touches UI, routes, CSS tokens, or visual behaviour:**

1. Start the dev server (from `src/your-web`).
2. Drive the affected page through the Playwright MCP browser tools — navigate, click, fill, snapshot.
3. Take a screenshot and confirm it visually matches the design intent (see the active design skill).
4. Watch the browser console for runtime errors and network failures.

A type-check is a correctness gate, **not** a feature-correctness gate. Do not claim UI work is done on a passing build alone — verify in the browser.

---

## Repository layout

```
open-pulse-webkit/
├── .claude/            # canonical agent config (EDIT HERE)
│   ├── PROJECT.md      #   mission + data-source overview
│   ├── SKILLS.md       #   concrete task recipes
│   ├── settings.json   #   permissions + enabled MCP servers
│   └── skills/         #   the 12 skills (new-dashboard + frontend-dev + design skills + query-* + op-*)
├── .claude-plugin/     # Claude Code plugin + marketplace manifests (repo is installable as the `open-pulse` plugin)
├── .agents/            # generated mirror for AGENTS.md-standard tools + Pi (DO NOT EDIT)
├── CLAUDE.md           # this file (canonical conventions)
├── AGENTS.md           # generated mirror of CLAUDE.md
├── .mcp.json           # Playwright MCP (active; host default — see .mcp.host.json / .mcp.docker.json)
├── .devcontainer/      # devcontainer entry (compose lives in tools/image/docker/)
├── .env.example        # Open Pulse endpoints + credentials
├── tools/
│   ├── image/docker/   # Ubuntu dev image + playwright-mcp sidecar compose
│   └── sync-agents.mjs # regenerates .agents/ from .claude/
└── src/
    └── your-web/       # ← your web app (scaffold it here)
```

---

## Architecture

### Data sources (Open Pulse platform)

All three stores are reached through **one HTTPS hub gateway** (`OPENPULSE_ENDPOINT`, e.g. `https://openpulse.epfl.ch`) with a single reader token (`OPENPULSE_AUTH`). The raw store ports are plain HTTP / self-signed and must not be used.

| Store | What's in it | Gateway path | How to query |
|---|---|---|---|
| **Neo4j** | Property graph: repositories, contributors, organisations, social edges | `POST /api/databases/cypher/query` | Skill `query-neo4j` |
| **Oxigraph / SPARQL** | RDF metadata; cumulative default graph (~3.3M triples) plus monthly snapshots `…/graph/{YYYY-MM}/{rule-based\|hybrid}` | `POST /sparql/query` | Skill `query-sparql` |
| **OpenSearch** | GrimoireLab-enriched commit docs | `POST /api/databases/opensearch/query` (SQL or DSL) | Skill `query-opensearch` |

There are also higher-level hub skills (`op-collections`, `op-search`, `query-chaoss`, `op-crawler`, `op-extractor`). See `.claude/SKILLS.md` and each skill's `SKILL.md`.

**Browser code must never hit these stores directly.** Credentials are server-side only. Route every request through a server-side endpoint (a serverless function, a small API, or your framework's server route) that holds the credentials and proxies to Neo4j/SPARQL/OpenSearch. The browser only ever talks to your own endpoint.

> Note for GitHub Pages: Pages serves **static files only** — there is no server runtime. If you publish to Pages and still need live data, the server-side proxy must live elsewhere (a serverless function, a separate small host, or pre-built static JSON snapshots committed at build time). See the README's *Publishing to GitHub Pages* section.

### TypeScript / types

If you use TypeScript, keep API response shapes typed in one place and treat that as the source of truth for client + server.

---

## Design system

> **Active design skill: `openpulse-dark-theme`** (base brand: `sdsc-ui-kit`). To re-brand, drop in a new design skill and change this line — see below.

The design system is split so a new brand can be dropped in **without touching app code**:

- **`frontend-dev`** — the *engineering* skill: design-skill-agnostic mechanics (the `--op-*` **token contract** the app consumes, font-loading, canvas/D3 rules, build-time injection, required shared components, Playwright verification). It contains **no design values** and never changes when the brand does.
- **The active design skill** (declared above) — supplies the *values*: `assets/tokens.css` implementing the token contract, plus component/layout looks. Default is **`openpulse-dark-theme`**, the permanent-dark Open Pulse dashboard theme — it defines the dark tokens, the dashboard visuals (attribution bar §7.4, provenance disclosure §7.5, graph explorer §8), and a named list of deliberate deviations (§1.2) from its base.
- **`sdsc-ui-kit`** — the base SDSC brand system (datascience.ch) that `openpulse-dark-theme` layers on: **ground truth for all brand values**, typography anatomy, components, layouts, icons.

**Swapping brands** = add `.claude/skills/<your-brand>/` implementing the token contract, copy its `tokens.css` into the app's `:root`, update the *Active design skill* line above, run `node tools/sync-agents.mjs`. App code stays untouched because it references only the contract token names (recipe: `.claude/SKILLS.md` §11).

Rules that hold under any design skill:

- All colors come from the `--op-*` CSS custom properties (mirror them into your utility framework's theme if you use one)
- Never hardcode hex in template markup — canvas/SVG drawing code is the only exception
- The attribution bar and the provenance disclosure are required product components regardless of brand (`frontend-dev` §7)

Under the shipped SDSC skills additionally: Space Grotesk headings / Switzer UI text / JetBrains Mono code (`.mono`); sharp corners (`rounded-none`) with buttons and badges at `rounded` (4px) only; brand blues only for interactive chrome, status colors only on badges/toasts.

---

## Dev notes

- **Editing agent config:** edit `.claude/` only, then run `node tools/sync-agents.mjs` to regenerate `.agents/` + `AGENTS.md`. CI (`agents-sync` job) fails if they drift.
- **Node on PATH:** the sync script needs Node. If `node` isn't on your PATH, invoke it with a full path to any local Node binary (CI uses its own Node, so this is a local-only concern).
- **Skills need `.env`:** the `query-*` / `op-*` skills read endpoints + credentials from `.env` at the project root (they walk up from the CWD first, then from the script's own location, so they also work when installed as the plugin). Copy `.env.example` → `.env` and fill it in. Never commit `.env`.
- **Plugin packaging:** `.claude-plugin/plugin.json` + `marketplace.json` make this repo installable via `/plugin marketplace add sdsc-ordes/open-pulse-webkit` → `/plugin install open-pulse@open-pulse`. `plugin.json` points `skills` at `.claude/skills/`, so skill edits ship in both modes automatically. Bump `version` in `plugin.json` on skill-visible changes; sanity-check with `claude plugin validate .`. The guided entry point for downstream users is the `new-dashboard` skill.
- **Publishing:** the app is intended to be published to **GitHub Pages** as a static site — see the README's *Publishing to GitHub Pages* section. (There is no public dev tunnel; that infrastructure was removed.)

---

## What not to do

- Do not hardcode hex values in template markup (canvas/SVG drawing is exempt)
- Do not claim UI work is done from a passing build alone — verify via Playwright MCP
- Do not hit Open Pulse stores directly from the browser — always go through a server-side proxy
- Do not commit `.env` (it holds credentials)
<!-- sync:keep -->
- Do not hand-edit `.agents/` or root `AGENTS.md` — edit `.claude/` and run `node tools/sync-agents.mjs`
<!-- sync:endkeep -->
