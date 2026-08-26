# PROJECT.md — pulseWebKit (Open Pulse web app template)

Longer-form project context for agents. Companion to root `AGENTS.md` (which covers conventions & dev workflow) and `.agents/SKILLS.md` (which covers concrete how-tos).

---

## Mission

**pulseWebKit** (working name: *pulseNext*) is a starter, intended to be published as a **GitHub template repository**, so that researchers and developers can build their own dashboards or interactive websites that pull variables from the **Open Pulse** platform.

Two audiences read this codebase:

1. **The SDSC team at EPFL/ETH Zürich**, who use views like the Graph Explorer to operate and showcase the live Open Pulse deployment on the first node at `openpulse.epfl.ch` (public home: `openpulse.science`).
2. **Downstream users** — anyone who clicks "Use this template" on GitHub to spin up a new project. They will build their own views and expect this codebase to demonstrate idiomatic, reusable patterns.

When deciding between "this is a one-off feature" vs. "this is a pattern others will follow", err toward the second. Naming, file layout, abstractions, and design tokens should generalise.

**Framework-neutral by design.** The template deliberately does not commit to a UI framework. The web app lives in `src/your-web/` and the downstream user picks their own stack. What the template *does* provide and standardise is framework-independent: the **Open Pulse query skills** and the **design-skill system** (the `frontend-dev` token contract + a swappable design skill; default `openpulse-dark-theme` over the `sdsc-ui-kit` brand). Keep those stable; treat the app shell as replaceable.

---

## The Open Pulse platform (data layer)

Open Pulse is a research-software-observability stack maintained by SDSC. The app does not own data — it surfaces it from live stores on the hub deployment. All stores live behind plain HTTP/HTTPS on internal ports; the `.env.example` documents the exact endpoints and the auth conventions (`replace-me` upstream placeholders).

### Public site vs deployment node

Two URLs appear throughout this kit — they are **not** interchangeable:

| URL | Role |
|---|---|
| **[openpulse.science](https://openpulse.science)** | The project's **main public page** — marketing, documentation, ontology namespaces (`https://openpulse.science/git-metadata-extractor#`, …). Downstream apps link here in the required attribution bar (`Built using openpulse.science at …`). |
| **[openpulse.epfl.ch](https://openpulse.epfl.ch)** | The **first live deployment node** — the SDSC hub where Neo4j, SPARQL, OpenSearch, the CHAOSS metrics API, collections, extractor, and crawler all run. Skills, `.env`, and server-side proxies point at this host over **HTTPS only** (`OPENPULSE_ENDPOINT`) — the raw store ports are plain HTTP and must not be used. |

When wiring data or running query skills, use `openpulse.epfl.ch`. When citing the platform or linking for end users, use `openpulse.science`.

### Neo4j — the property graph

- **Endpoint:** `POST {OPENPULSE_ENDPOINT}/api/databases/cypher/query` (hub gateway, HTTPS, reader token; read-only — write clauses return 403)
- **Contents:** Repositories, Users, Organisations, ROR institutions, and the relationships between them (contributions, stars, ownership, dependencies, …)
- **Use it for:** "Who contributed to what?" questions; graph traversal; visualisations of collaboration
- **Skill:** `query-neo4j` (Cypher → JSON rows). Always include `LIMIT` on exploratory queries — the graph has millions of nodes.

### Oxigraph (SPARQL) — RDF metadata

- **Endpoint:** `POST {OPENPULSE_ENDPOINT}/sparql/query` (hub gateway, HTTPS, reader token; `/sparql/update` needs an admin token)
- **Contents:** ~3.3M triples in the promoted production default graph, plus named graphs — monthly snapshots (`…/graph/{YYYY-MM}/hybrid`, `…/rule-based`) and utility graphs (`_backup/…`, `_links/identity`). **Default graph mode** — plain `{ ?s ?p ?o }` without a `GRAPH` clause — resolves to the promoted production data. Use explicit `GRAPH <…>` to pin a snapshot or reach non-default graphs. See `query-sparql` skill.
- **Named-graph convention:** monthly snapshots live at `https://open-pulse.epfl.ch/graph/{YYYY-MM}/{variant}`, where the variant records **how the triples were derived** — `rule-based` (deterministic extraction, no agentic inference) or `hybrid` (rule-based plus agent-applied corrections and enrichment). The **default graph is cumulative** across months, not a copy of the latest snapshot. Use `hybrid` for best-quality metadata, `rule-based` when you need reproducible provenance, and diff the two to measure what the agents contributed. Not every month has both variants. Inventory: `op-collections stats` → `sparql.named_graphs`.
- **Use it for:** Structured metadata, vocabulary/ontology queries, repo stars/licenses/languages, contributions, ORCID↔GitHub bridges, scholarly articles
- **Skill:** `query-sparql` (SELECT/ASK/CONSTRUCT/DESCRIBE). Updates are intentionally not supported by the skill — use `curl` explicitly if you need to mutate.

### OpenSearch — search & enriched indices

- **Endpoint:** `POST {OPENPULSE_ENDPOINT}/api/databases/opensearch/query` (hub gateway, HTTPS, reader token; two modes — OpenSearch **SQL** (`SELECT`/`SHOW`/`DESCRIBE`) or full search **DSL** with an `index` key)
- **Contents:** GrimoireLab-enriched indices — `git_demo_enriched` and friends (commit-level docs)
- **Use it for:** Commit-level search, full-text queries, and DSL aggregations over enriched fields
- **Skill:** `query-opensearch` (SQL or `--dsl <index>` → JSON rows). Reader tokens can query; index listing (`SHOW TABLES`) is admin-only — take index names from the skill's SKILL.md.

### Higher-level hub skills

Beyond the three raw stores, the Open Pulse hub at `openpulse.epfl.ch` exposes computed/aggregated APIs with their own skills: `op-collections` (indexed datasets), `op-search` (semantic/vector search), `query-chaoss` (CHAOSS health metrics), `op-crawler` and `op-extractor` (pipeline control). See each skill's `SKILL.md`.

### CHAOSS health metrics (featured dashboard)

The hub computes **35 CHAOSS metrics** live per GitHub repository (or aggregated per GrimoireLab project) by unifying Neo4j + SPARQL + OpenSearch. Browse them at `https://openpulse.epfl.ch/chaoss` or query via the `query-chaoss` skill. Full slug catalogue and API flags live in `.agents/skills/query-chaoss/SKILL.md`; the list below is the **featured dashboard set** this template is designed around.

Three topic buckets (matching the CHAOSS framing):

#### Community — *is the project alive & kicking?*

| Card | API slug | Typical window |
|---|---|---|
| Activity Dates and Times | `activity_dates` | 365 d — monthly commit histogram (`series[]`); day/hour peaks not yet available |
| Contributors | `contributors` | 365 d |
| Change Request Closure Ratio | `closure_ratio` | 30 d |
| Issue Response Time | `issue_response_time` | 365 d |
| Change Request Reviews | `cr_reviews` | 30 d — pair with `cr_accepted` for avg reviews per PR |
| New Contributors | `new_contributors` | 30 d |
| Change Requests (merged) | `cr_accepted` (+ `cr_declined`) | 90 d — **open** PR count is not a catalogue metric |
| Organizational Diversity | `org_diversity` | snapshot |
| Committers | `committers` | 90 d |
| Time to First Response | `first_response` | 365 d — PRs + issues; use `issue_response_time` for issues only |
| Contributor Absence Factor (bus factor) | `absence_factor` | 365 d |
| Types of Contributions (code / docs / reviews %) | — | **not in API** — approximate with `code_lines` + `cr_reviews` or custom queries |

#### Popularity — *who sees, uses & reuses it?*

| Card | API slug | Notes |
|---|---|---|
| Academic Open Source Project Impact | `academic_impact` | Papers whose authors also contribute |
| Project Popularity | `project_popularity` | Stars + forks + dependents composite |
| Technical Fork | `technical_fork` | Total fork count |
| Clones | — | **not in API** |
| Number of Downloads | — | **not in API** (no PyPI/npm registry index) |
| Organizational Project Skill Demand | — | **not in API** |
| Project Recommendability | — | **not in API** |

#### Quality — *can others understand & reuse it?*

| Card | API slug | Notes |
|---|---|---|
| Documentation Discoverability | `docs_discoverability` | README · homepage/docs · wiki · GitHub Pages signals |
| License Coverage | `license_coverage` | Per-repo yes/no; project mean = share licensed |
| Licenses Declared | `licenses_declared` | SPDX ids from metadata |
| Programming Language Distribution | `programming_languages` | Presence set today — byte shares not yet in ontology |
| Release Frequency | `release_frequency` | Releases per year from GME metadata |
| Test Coverage | `test_coverage` | Static % parsed from README badges, not CI |
| Upstream Code Dependencies | `upstream_dependencies` | `DEPENDS_ON` graph in Neo4j |

**Response conventions:** `value` is always a **display string** (`"72%"`, `"4.2 h"`, `"—"`). `"—"` means *no data*, never zero. Several slugs ship a `visual` block (`rank_bars`, `donut`, `pill_cloud`) for UI cards. Issue/PR-based metrics and the newest quality signals (`test_coverage`, `release_frequency`) are sparse in the current snapshot until GitHub enrichment is refreshed — expect `"—"` on many repos.

**Quick fetch:** `python .agents/skills/query-chaoss/query.py repo <owner> <repo>` returns all 35; re-fetch individual slugs with `--window 30|90|365` when the dashboard needs mixed periods.

### Pulling them together

The interesting thing this kit is meant to demonstrate is **pulling variables from across all stores into a single coherent view** — e.g. a per-repository panel combining Neo4j contributors, SPARQL metadata, and OpenSearch commit-frequency aggregates.

---

## Reference views (patterns the template demonstrates)

These views are intended both as working tools and as **pattern examples**. They are described by behaviour, not framework:

| View | Pattern it demonstrates |
|---|---|
| **Graph Explorer** | Reactive force-directed visualisation; temporal replay via a timeline strip (scrub + playback, `openpulse-dark-theme` §8.1, reference code in `frontend-dev/examples/pulse-graph.ts`); full-page canvas layout |
| **List / detail** (e.g. pipeline runs) | List + detail; status badges; tables; shared shell |
| **Card grid** (e.g. service health) | Card grid; mixed-status surfaces (containers, endpoints, smoke tests); entity cards with build-time media thumbnails and avatars (`openpulse-dark-theme` §6.7) |

Together they cover the three layout archetypes a downstream user is most likely to need (full-page canvas, list/detail, card grid). Their anatomy lives in the `sdsc-ui-kit` skill (`references/layouts.md`); the dark dashboard mappings live in the `openpulse-dark-theme` skill (§7–§8).

---

## How a downstream user is expected to extend this

When suggesting changes, keep these likely user journeys in mind:

1. **Scaffold the app** — choose a framework and scaffold it in `src/your-web/`, then apply the design system (`frontend-dev` skill §8 checklist + the active design skill).
2. **Wire to real data** — add a **server-side** layer (serverless function, small API, or framework server route) that holds Open Pulse credentials and proxies queries, so secrets never reach the browser. Point the client at that endpoint.
3. **Add a new domain-specific view** — follow `.agents/SKILLS.md §2` (Add a new page) and the API/data patterns in §1.
4. **Re-skin the design** — edit the `--op-*` CSS custom properties. The token convention exists so the rename to their own brand is a one-file change.
5. **Add a new data store** — e.g. PostgreSQL, a vector DB. Follow the skill pattern (`.agents/skills/query-*`) and the `.env.example` pattern.
6. **Publish** — build a static bundle and deploy to GitHub Pages (see the README's *Publishing to GitHub Pages* section).

If a change makes one of these journeys harder (e.g. couples the design system to a specific backend, hardcodes `--op-*` colour names into business logic, or assumes a server runtime that GitHub Pages doesn't provide), flag it.

---

## Non-goals

- This template is **not** an Open Pulse SDK or query-builder library — it demonstrates how to consume the platform, not how to abstract it.
- It does **not** prescribe a UI framework, CSS framework, or backend. Those are the downstream user's choice.
- No test runner is wired up; do not add one without explicit ask.

---

## Pointers

- **Conventions, stack-neutral dev workflow, what-not-to-do:** `AGENTS.md` (repo root)
- **Concrete how-tos** (add page, add endpoint, add token): `.agents/SKILLS.md`
- **Visual rules**: the active design skill (`openpulse-dark-theme`, over the `sdsc-ui-kit` brand ground truth); engineering mechanics in `frontend-dev`
- **Backend endpoints & credentials**: `.env.example`
- **Data store query skills**: `.agents/skills/query-{neo4j,sparql,opensearch}/SKILL.md`
- **CHAOSS health metrics**: `.agents/skills/query-chaoss/SKILL.md` (featured dashboard slugs above)
- **Publishing**: README → *Publishing to GitHub Pages*
- **Devcontainer**: `.devcontainer/` (compose + images in `tools/image/docker/`)
