# Agroscope Open Source Dashboard — plan

## Scope & audience

- **Data slice:** Agroscope (Swiss federal agricultural research institute). GitHub org `agroscope-ch`; ROR `https://ror.org/04d8ztx87`.
- **Primary viewer:** researchers/developers whose work is shown — technical detail is welcome, vocabulary can assume familiarity with git/OSS terms.
- **Posture:** hybrid — narrative landing page with annotated highlights, denser stats one click down into each theme.
- **Design system:** default active design skill, `openpulse-dark-theme` over `sdsc-ui-kit` (no custom brand skill).

## Themes

1. **Landing — "Agroscope open source at a glance"** (required). 5–6 headline numbers (repos, contributors, disciplines, activity span) + one signature visual (repo/discipline treemap — the collaboration graph is too sparse to lead with, see below). Every element links into its theme.
2. **The Landscape — "What open source exists at Agroscope?"** Catalogue of all 20 repos, filterable by type/discipline/license/activity. All repository types shown (Educational Resource, Data, Other included), **Software emphasized** in headline counts and default sort — a deliberate framing choice, not a filter.
3. **People & Community — "Who's behind it?"** *Adapted from the skeleton*: skip the full force-directed collaboration graph (only ~23 unique contributors org-wide, 17/20 repos are single-contributor — a force graph would read as noise, not signal). Instead: a simple contributors list/table per repo, org-wide contributor count, and an honest note that no institutional affiliation graph exists yet for Agroscope contributors (surfaced in the coverage panel, not hidden).
4. **Community Health & Activity — "How alive and healthy is it?"** The CHAOSS home. Popularity / Community / FAIR buckets with official CHAOSS metric names. Time series from OpenSearch commit history (2021-06 → 2026-08, still active). Distinguish ecosystem growth (repos over time) from per-repo growth explicitly.
5. **Research Impact — "What does it produce?"** *Adapted from the skeleton*: kept as a theme (per its required prominence), but led with an honest "no publication links currently resolve to Agroscope's ROR" state rather than a populated funnel — framed as the dashboard's top coverage gap, with a call-to-action tone rather than an empty-looking failure.
6. **What's missing? (coverage panel, required, fixed).** Repos with no license / no discipline / unclassified type, plus the two structural gaps above (no contributor affiliations, no publication links) as top-line items.

## Data reconnaissance

| Theme | Data present? | Caveat |
|---|---|---|
| Landscape | Yes — Neo4j: 20 repos, all originals (zero forks), all `op:ownedBy` the Agroscope ROR via SPARQL | Repo-type breakdown (Software vs Data vs Educational Resource vs Other) not yet pulled — confirm in snapshot script |
| People & Community | Partial — Neo4j `CONTRIBUTES_TO`: 23 unique contributors, 17/20 repos have exactly 1, only `srppp`/`digiRhythm` have 3 | No `AFFILIATED_WITH` edges resolve to an Agroscope `RorOrg` (no `RorOrg` node exists for Agroscope in Neo4j at all) — cross-institution/person↔group view not buildable as specified |
| Community Health & Activity | Yes — OpenSearch `git_demo_enriched`: all 20 repos indexed, commits 2021-06-29 → 2026-08-24; CHAOSS spot-check (`srppp`, `digiRhythm`) returned real `contributors` and `activity_dates` data | None significant |
| Research Impact | No — zero `schema:sourceOrganization` publication links to the Agroscope ROR; zero hits in `zenodo_records` / `infoscience_articles` / OpenAlex full-text search for "agroscope" | Theme will render as a coverage gap, not a funnel, until publication data is linked upstream |

**Stage 0 connectivity:** all 5 stores reachable via `.env` — Neo4j (3.85M nodes), SPARQL, OpenSearch (2.56M commit docs), CHAOSS API, hub API.

## Stack & publishing

- **Framework:** plain HTML/CSS/JS in `src/your-web/`. D3 for the treemap and any interactive charts.
- **Publishing:** static, GitHub Pages. Build-time snapshot script `scripts/fetch-data.mjs` queries Neo4j/SPARQL/OpenSearch/CHAOSS with the same transports as the `query-*` skills and bakes typed JSON into `src/data/` (repos, contributors, activity time series, coverage gaps). Credentials stay at build time; browser never talks to the stores.

## Open framing calls

- Repo-type breakdown resolved during scaffolding: 19 Software, 1 Data, 0 Educational Resource/Other — confirms Software-emphasis was the right default; the Landscape catalogue's type filter still exposes the one Data repo.
- If an Agroscope `RorOrg`/affiliation graph gets populated later, People & Community should be revisited to add the full collaboration graph per the original skeleton.

## Built (v1)

Plain HTML/CSS/JS on Vite (multi-page, no UI framework), `--op-*` tokens from `openpulse-dark-theme`, fonts self-hosted via npm (`@fontsource-variable/space-grotesk`, `@carrot-kpi/switzer-font`, `@fontsource/jetbrains-mono`), D3 for the discipline treemap and the two activity charts. Data: `scripts/fetch-data.mjs` → `src/data/{summary,repos,health,impact,coverage}.json`, committed to the repo (the Pages workflow doesn't have store credentials, so snapshots are refreshed by re-running the script locally, not on every deploy). `.github/workflows/pages.yml` added for GitHub Pages publishing.

Not built yet (follow-ups, in rough priority order):
- Org avatar / repo thumbnail images (`frontend-dev` §6 / `examples/fetch-images.mjs`) — skipped for v1 to keep scope tight.
- Re-running `npm run fetch-data` periodically (e.g. a scheduled workflow) to keep the committed snapshots fresh.
- Deeper per-repo detail pages (currently the catalogue links out to GitHub directly rather than an in-app detail view).
