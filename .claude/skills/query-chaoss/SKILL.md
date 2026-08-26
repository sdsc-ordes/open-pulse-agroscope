---
name: query-chaoss
description: Query the Open Pulse CHAOSS Metrics API — 35 community/popularity/quality metrics computed live per GitHub repository or per GrimoireLab project, over the Neo4j+SPARQL+OpenSearch stores. TRIGGER when the user asks for a ready-made health/community/popularity/quality metric on a repo or project — especially the featured dashboard set (activity dates, contributors, closure ratio, issue/PR response times, change-request reviews, new contributors, org diversity, committers, absence factor, academic impact, forks, popularity, docs discoverability, license coverage, programming languages, release frequency, test coverage, upstream dependencies). SKIP when they want a raw Cypher/SPARQL/DSL query against a single store (use query-neo4j / query-sparql / query-opensearch) rather than a pre-computed CHAOSS metric.
---

# Query CHAOSS Metrics (Open Pulse hub)

This skill ships two equivalent scripts that hit the Open Pulse CHAOSS Metrics API. Every endpoint is a `GET` returning JSON, computed live by the hub on top of the three stores (Neo4j + Oxigraph/SPARQL + OpenSearch). Both scripts read `OPENPULSE_ENDPOINT` (base URL, e.g. `https://openpulse.epfl.ch`) and `OPENPULSE_AUTH` (format `user/password`) from `.env` at the repo root; set `CHAOSS_ENDPOINT` / `CHAOSS_AUTH` only to override them.

Auth is **HTTP Basic, password-only** — the username is ignored, only the token matters. A reader token is enough for every query here.

```
.claude/skills/query-chaoss/
├── query.py       # Python 3, stdlib only
└── query.mjs      # Node 18+, built-in fetch
```

> Prefer the live API over re-deriving these numbers by hand. The hub already unifies the three stores per metric (e.g. "largest non-zero of OpenSearch / SPARQL / Neo4j") and exposes the exact store queries via `include=traces` — only drop down to `query-neo4j`/`query-sparql`/`query-opensearch` when you need a value the catalogue doesn't compute.

## Identifiers — how this store keys things

CHAOSS takes **owner and repo as separate path segments** — not a URL, not a slug:

```
/api/v1/metrics/chaoss/repositories/github.com/{owner}/{repo}/metrics
```

`query.py` normalises the forms people actually type, so all of these work:

```bash
python .claude/skills/query-chaoss/query.py repo Biohub esm          # canonical
python .claude/skills/query-chaoss/query.py repo Biohub/esm          # combined slug
python .claude/skills/query-chaoss/query.py repo https://github.com/Biohub/esm      # full URL
python .claude/skills/query-chaoss/query.py repo https://github.com/Biohub/esm.git  # .git stripped
```

Projects are keyed by a **project slug** (`epfl`, `bioeng`, …) — list them with `projects`.

Cross-store: SPARQL and Cypher key on `https://github.com/{owner}/{repo}`; OpenSearch on a clone URL whose `.git` suffix varies; collections on `owner` + `name` columns. See `.claude/SKILLS.md` §12.

## Run

> **Plugin install?** If this skill runs from the `open-pulse` plugin instead of a repo checkout, the scripts live under the plugin root — replace the `.claude/skills/` prefix in the commands below with `${CLAUDE_PLUGIN_ROOT}/.claude/skills/`. Credentials are unchanged: a `.env` at your project root (keys as in the template's `.env.example`).

```bash
# Catalogue (static specs) — all 35, the 3 topic buckets, or one spec
python .claude/skills/query-chaoss/query.py catalogue
python .claude/skills/query-chaoss/query.py catalogue --category Quality
python .claude/skills/query-chaoss/query.py topics
python .claude/skills/query-chaoss/query.py spec contributors

# Per repository — all metrics, or one slug
python .claude/skills/query-chaoss/query.py repo sdsc-ordes gimie
python .claude/skills/query-chaoss/query.py repo sdsc-ordes gimie contributors --window 730
python .claude/skills/query-chaoss/query.py repo sdsc-ordes gimie contributors --include traces,recipes,series

# Per project — list, all metrics, one slug, or member repos
python .claude/skills/query-chaoss/query.py projects
python .claude/skills/query-chaoss/query.py project bioeng
python .claude/skills/query-chaoss/query.py project bioeng contributors --refresh
python .claude/skills/query-chaoss/query.py project-repos protein_ai_ecosystem

# Arbitrary path fall-through (relative to /api/v1/metrics/chaoss, or absolute with a leading /)
python .claude/skills/query-chaoss/query.py get repositories/github.com/sdsc-ordes/gimie/metrics

# Node equivalent (same subcommands + flags)
node .claude/skills/query-chaoss/query.mjs repo sdsc-ordes gimie contributors
```

Output is the API's JSON, pretty-printed. `--raw` prints the body verbatim. Errors print `http <code>: <body>` to stderr and exit non-zero — surface them verbatim.

## Query-param flags

| Flag | Maps to | Notes |
|---|---|---|
| `--window N` | `window=N` | default 365; **snaps** to 30/90/180/365/730/1825/3650 |
| `--include a,b,c` | `include=…` | add `traces` (exact store queries), `recipes` (repro scripts: `python`/`js`/`bash`), `series` (time-series) to metric payloads |
| `--refresh` | `refresh=1` | **project endpoints only** — bypass the 30-min aggregation cache |
| `--category X` | `category=…` | `Community` \| `Popularity` \| `Quality` — filter catalogue/lists |
| `--param k=v` | `k=v` | escape hatch for any param not modelled above (repeatable) |

## Featured dashboard metrics

The hub tracks **35 CHAOSS-aligned metrics**. A curated **20-metric "featured" subset** surfaces first on the CHAOSS catalogue page and on every repository / project dashboard; the other **15 render under a collapsed "Advanced" section**. This section documents the featured 20 — they are what a dashboard should lead with.

All 35 are computed from the OpenPulse data plane: the RDF/SPARQL graph (Oxigraph), the Neo4j knowledge graph, the OpenSearch/GrimoireLab activity indices, and the git-metadata-extractor (GME). Which stores back a given metric is visible per-metric via `--include traces`.

### The three topics

| Topic | Question it answers | Total | Featured |
|---|---|---|---|
| **Community** | Who contributes, how responsive is the project, how healthy is the maintainer base? | 19 | 9 |
| **Popularity** | How much reach, reuse, and academic impact does the project have? | 3 | **3 (all)** |
| **Quality** | Is it licensed, documented, tested, and well-structured? | 13 | 8 |

> **"Featured" is not discoverable from the API.** The subset is defined server-side by `_FEATURED_SLUGS` in `chaoss/routes.py`; the catalogue returns all 35 with **no featured flag** on the spec (fields are `slug`, `name`, `category`, `chaoss_topic`, `question`, `description`, `chaoss_url`, `is_time_based`). If your UI needs the featured/advanced split, **hardcode the 20 slugs below** and treat everything else as Advanced — and re-check this list when the hub version changes, since a metric graduates to featured whenever the product decides to surface it. Verified against the live catalogue on 2026-07-21: all 20 exist, categories match, exactly 15 remain.

The **Advanced 15**, for completeness — same API, same call, just not surfaced first:

| Topic | Slugs |
|---|---|
| Community (10) | `burstiness`, `cr_duration`, `inactive_contributors`, `issue_resolution`, `issues_active`, `issues_closed`, `issues_new`, `occasional_contributors`, `pr_time_to_close`, `project_demographics` |
| Quality (5) | `bot_activity`, `code_lines`, `cr_accepted`, `cr_declined`, `self_merge` |

Each row below maps the **display name** → **slug**, the **default window**, what to read from the payload, and a **narrative pattern** (replace placeholders with live `value` / `secondary` / `visual` / `examples`).

Fetch the whole set in one call (default window 365 unless you re-query individual slugs with `--window`):

```bash
python .claude/skills/query-chaoss/query.py repo <owner> <repo>
```

For richer cards (sparklines, contributor bars, doc-signal checklist), add `--include series` on metrics that support it, or fetch all metrics then re-fetch individual slugs with the right flags.

### Community — *is the project alive & kicking?*

| Display name | slug | Default window | Read from payload | Narrative pattern |
|---|---|---|---|---|
| **Activity Dates and Times** | `activity_dates` | 365 | `value` = total commits; `secondary` = busiest month; `series[]` = monthly histogram | "Peak activity: {secondary}" — render `series` as a sparkline. Day-of-week / hour-of-day peaks are **not** in the API yet (monthly only). |
| **Contributors** | `contributors` | 365 | `value` = count; `examples[]` or `visual.bars` = top names; `secondary` = per-store breakdown | "{value} contributors" — list names from `examples` or `visual.bars` when present. |
| **Change Request Closure Ratio** | `closure_ratio` | 30 | `value` = % closed; `secondary` = merged vs declined split | "{value} of change requests closed within {window_days} days" |
| **Issue Response Time** | `issue_response_time` | 365 | `value` = median hours | "Median first response to issues: {value}" |
| **Change Request Reviews** | `cr_reviews` | 30 | `value` = reviewed PR count; pair with `cr_accepted` for avg | "{value} reviews this month" — divide `cr_reviews` by `cr_accepted` for "avg. N per change request" when both have data |
| **New Contributors** | `new_contributors` | 30 | `value` = first-time contributors in window | "{value} new contributors joined in the last month" |
| **Change Requests** | `cr_accepted` + `cr_declined` | 90 | `cr_accepted` = merged PRs; `cr_declined` = closed-without-merge | "{cr_accepted} merged this quarter" — **open** PR count is **not** a catalogue metric; use `query-opensearch` on the PR index if you need it |
| **Organizational Diversity** | `org_diversity` | snapshot | `value` = distinct org count | "Contributions from {value} organizations" |
| **Committers** | `committers` | 90 | `value` = distinct committers | "{value} committers pushed code in the last 90 days" |
| **Time to First Response** | `first_response` | 365 | `value` = median hours (PRs + issues) | "Average time to first reply: {value}" — sibling of `issue_response_time` but includes PRs |
| **Contributor Absence Factor** | `absence_factor` | 365 | `value` = bus-factor N; `secondary` = share line; `visual.kind=rank_bars` | "{value} contributors account for 50% of commits" — read exact share from `secondary` (e.g. "top 1 of 3 carry 62%") |
| **Types of Contributions** | — | — | **Not in API** | Code / docs / review % breakdown is not computed. Approximate with `code_lines` (code churn) + `cr_reviews` (review activity); docs share needs a custom query |

### Popularity — *who sees, uses & reuses it?*

| Display name | slug | Default window | Read from payload | Narrative pattern |
|---|---|---|---|---|
| **Academic Open Source Project Impact** | `academic_impact` | snapshot | `value` = paper count; `secondary` / `examples` for detail | "Cited in {value} papers" — JOSS/publication subtype not split in current spec |
| **Clones** | — | — | **Not in API** | GitHub clone traffic is not in the hub snapshot |
| **Number of Downloads** | — | — | **Not in API** | Package-registry downloads (PyPI, npm, …) are not indexed |
| **Organizational Project Skill Demand** | — | — | **Not in API** | Job-posting demand is not indexed |
| **Project Popularity** | `project_popularity` | snapshot | `value` = composite score; `secondary` = stars/forks/dependents | "Top {value} visibility" — read component breakdown from `secondary`; percentile ranking ("top 5%") is **not** computed |
| **Project Recommendability** | — | — | **Not in API** | Survey / scorecard data is not indexed |
| **Technical Fork** | `technical_fork` | snapshot | `value` = total forks; `secondary` = SPARQL vs Neo4j | "{value} forks" — active forks in last year needs a custom OpenSearch/Neo4j query |

### Quality — *can others understand & reuse it?*

| Display name | slug | Default window | Read from payload | Narrative pattern |
|---|---|---|---|---|
| **Documentation Discoverability** | `docs_discoverability` | snapshot | `value` = score (e.g. `4/4`); `secondary` = signal list; `examples[]` = per-signal yes/no | "README links to docs, API reference, and tutorials" — map from `examples` signals (README · homepage · wiki · Pages) |
| **License Coverage** | `license_coverage` | snapshot | `value` = yes/no or % at project level | "{value} of files have declared licenses" — per-repo is binary; project aggregate reads as mean share |
| **Licenses Declared** | `licenses_declared` | snapshot | `value` = count; `examples[]` = SPDX ids | "{license} declared" — e.g. "MIT license declared in LICENSE file" from `examples` |
| **Programming Language Distribution** | `programming_languages` | snapshot | `visual.kind=pill_cloud` or `examples[]` | "Python 62%, C++ 28%, …" — API currently returns a **presence set** (language names), not byte shares; say so honestly when shares aren't available |
| **Release Frequency** | `release_frequency` | snapshot | `value` = releases/year or count; `secondary` = date span | "{value} releases in the past 12 months" |
| **Test Coverage** | `test_coverage` | snapshot | `value` = % from README badge | "{value} line coverage on main branch" — parsed statically from README shields, not CI |
| **Upstream Code Dependencies** | `upstream_dependencies` | snapshot | `value` = direct dep count; `secondary` = outdated count if present | "{value} direct dependencies; {outdated} outdated" |

### Recommended windows for the dashboard

| User-facing period | `--window` |
|---|---|
| last month | `30` |
| last quarter | `90` |
| last 90 days (committers) | `90` |
| last year | `365` |
| all-time / snapshot | omit or `3650` (metrics with `is_time_based: false` ignore the window) |

Re-fetch individual slugs when the dashboard needs mixed windows (e.g. `closure_ratio --window 30` alongside `contributors --window 365`).

**Which featured metrics actually respond to `--window`** (`is_time_based: true`) — passing a window to the others is harmless but changes nothing:

| | Windowed | Snapshot (window ignored) |
|---|---|---|
| **Community** | `contributors`, `committers`, `new_contributors`, `activity_dates`, `absence_factor`, `first_response`, `issue_response_time`, `closure_ratio` | `org_diversity` |
| **Popularity** | — | `project_popularity`, `technical_fork`, `academic_impact` |
| **Quality** | `cr_reviews` | `licenses_declared`, `license_coverage`, `programming_languages`, `docs_discoverability`, `release_frequency`, `test_coverage`, `upstream_dependencies` |

So Popularity is entirely snapshot-based, and Quality is snapshot-based apart from `cr_reviews` — a "last 30 days" toggle on a dashboard should visibly apply to Community cards only, or users will assume the others updated too.

**Window bounds and snapping (verified 2026-07-21).** The API accepts **7–3650** days (default 365); outside that it's a hard `422`, not a clamp. Inside the range the value snaps to the **nearest** bucket — 30, 90, 180, 365, 730, 1825, 3650 — with ties rounding **down**, and the response echoes the effective value in `window_days`:

| requested | 7 | 45 | 60 | 100 | 400 | 500 | 600 | 1000 | 3000 |
|---|---|---|---|---|---|---|---|---|---|
| **effective** | 30 | 30 | 30 | 90 | 365 | 365 | 730 | 730 | 3650 |

Note it snaps **down as readily as up** (`400 → 365`, `500 → 365`, `1000 → 730`), so a "last 500 days" label over 365 days of data would be wrong in the user's favour. **Always read `window_days` back** and label the card with that, never with the number you requested. `query.py` rejects out-of-range values locally and warns when your value will be snapped.

### Rendering hints (`visual` block)

Several featured slugs ship a `visual` object even without `--include` — use it when building UI cards:

| slug | `visual.kind` | Use for |
|---|---|---|
| `activity_dates` | (use `series[]`) | monthly sparkline |
| `absence_factor` | `rank_bars` | contributor commit-share bars + `headline_tone` |
| `docs_discoverability` | `donut` | fraction of doc signals present |
| `programming_languages` | `pill_cloud` | language tags |
| `license_coverage` | `donut` | licensed vs unlicensed |

Add `--include traces,series` when you need the exact store query behind a number or a time-series for charts.

## Full catalogue (35 metrics)

Three topic buckets. Every metric is windowed unless noted as a lifetime/snapshot value. Fetch the live, authoritative spec for any one with `spec <slug>` (or the whole set with `catalogue`) — the one-liners below are a map, not the source of truth. The **Store** column is where the headline number is computed (OS = OpenSearch/GrimoireLab, SP = SPARQL, N4 = Neo4j); several metrics reconcile more than one store via the `unification` field.

**Bold slugs** appear in the featured dashboard above.

### Community (19)

| slug | Measures | Store |
|---|---|---|
| **`contributors`** | Distinct people who contributed in the window | OS·SP·N4 |
| **`new_contributors`** | People whose **first** contribution falls inside the window (growth) | SP·OS |
| **`committers`** | Distinct people who **landed** commits (`committer_name`) — narrower than contributors | OS |
| `inactive_contributors` | Past contributors whose last commit predates the window | OS |
| `occasional_contributors` | Drive-by authors: ≤4 commits in the window (outreach vs retention) | OS |
| **`absence_factor`** | **Bus factor** — fewest contributors making ≥50% of commits; low = risk | OS |
| **`org_diversity`** | Distinct orgs in the contributor pool (single-vendor vs distributed) | SP |
| `project_demographics` | Pool breakdown: total / core (top 80%) / recent (<90d) / dormant (>180d) | OS |
| **`activity_dates`** | Monthly commit histogram (steady vs bursty) — rendered as a sparkline | OS |
| `burstiness` | Goh–Barabási B on commit inter-arrival: −1 periodic, 0 random, +1 bursty | OS |
| **`first_response`** | Median hours to first non-bot, non-author reply on a PR/issue | OS |
| **`issue_response_time`** | Median hours to first reply, **issues only** | OS |
| `issue_resolution` | Median days from issue open → close (PRs excluded) | OS |
| **`closure_ratio`** | Closed / total PRs in window (merged vs closed split in secondary) | OS |
| `issues_new` | Issues opened in the window (backlog inflow) | OS |
| `issues_active` | Issues with any update — comment/label/state change (liveness) | OS |
| `issues_closed` | Issues closed in the window (backlog outflow) | OS |
| `cr_duration` | Median days PR open → **merge** (merge-only; acceptance speed) | OS |
| `pr_time_to_close` | Median days PR open → close (**all** closed: merged + declined) | OS |

### Popularity (3)

| slug | Measures | Store |
|---|---|---|
| **`project_popularity`** | Composite: stars + forks (SPARQL) + dependents (inbound `DEPENDS_ON`) | SP·N4 |
| **`technical_fork`** | Total fork count (GitHub-reported via SPARQL; in-graph subset via Neo4j) | SP·N4 |
| **`academic_impact`** | Scholarly articles whose authors also contribute to the repo | SP |

### Quality (13)

| slug | Measures | Store |
|---|---|---|
| **`licenses_declared`** | Whether ≥1 license is declared (`schema:license` triple) | SP |
| **`license_coverage`** | Declares an SPDX license (per-repo yes/no; project mean = share licensed) | SP |
| **`programming_languages`** | Distinct declared languages (presence-set, no byte shares yet) | SP |
| `code_lines` | Lines added + removed in window; file-change count in secondary | OS |
| **`docs_discoverability`** | Scores 4 signals: README, homepage/docs, wiki, GitHub Pages | SP |
| **`test_coverage`** | Static coverage % advertised in README (shields badge / `coverage: NN%`) | SP |
| **`release_frequency`** | Lifetime release cadence (releases/year, first→latest release) | SP |
| **`upstream_dependencies`** | Distinct upstream repos depended on (`DEPENDS_ON` graph) | N4 |
| **`cr_reviews`** | PRs with ≥1 non-bot review comment (pair with `self_merge`) | OS |
| **`cr_accepted`** | Merged PRs in window (acceptance half of `closure_ratio`) | OS |
| `cr_declined` | PRs closed without merging (rejections / stale cleanup) | OS |
| `self_merge` | Fraction of merged PRs the author merged themselves — review-culture signal | OS |
| `bot_activity` | Share of commits by recognised bots (dependabot, renovate, `*[bot]`, …) | OS |

> **Phase / freshness note:** the issue/PR-based rows (`first_response`, `issue_*`, `issues_*`, `cr_*`, `pr_time_to_close`, `closure_ratio`, `self_merge`) and the newest signals (`test_coverage`, `release_frequency`) depend on GitHub-backend enrichment that is sparse in the current 2026-05 snapshot — expect `"—"` for many repos until a re-extraction lands.

## Response shape (verified 2026-06-10)

A **single repo metric** carries the spec fields (`slug`, `name`, `category`, `chaoss_topic`, `question`, `description`, `chaoss_url`, `is_time_based`) plus the computed result:

- `value` — **a display string** (`"6"`, `"72%"`, `"4.2 h"`, `"—"`). `"—"` means *no data*, **never 0** — don't read it as zero.
- `secondary` — per-store breakdown or extra context, e.g. `"Neo4j (all-time): 10 · SPARQL (windowed): 0 · OpenSearch (windowed): 6"` or `"top 1 of 3 contributors carry 62% of 13 commits"`.
- `label` — which store/window produced the headline (e.g. `"last 730 days · OpenSearch"`).
- `unification` — prose explaining how the three stores were reconciled into `value`.
- `headline_tone`, `notes`, `window_days`, `computed_at`, `canonical_url`.
- `visual` — optional render block (`rank_bars`, `donut`, `pill_cloud`, …) on several featured slugs.
- With `--include`: `traces[]` (`store`/`engine`/`query`/`result_summary`), `recipes` (`python`/`js`/`bash`), `series[]` (`date`/`value`/`series_unit`).

**All repo metrics** returns `{repo, canonical_url, window_days, computed_at, metric_count: 35, metrics: [...]}` (each entry is one metric object as above).

A **project metric** adds `repo_count`, `truncated`, `cached_at`, and an `aggregate` block: `{rule: "sum"|…, n_repos, n_with_value, sum, mean, min, max, value, …}`. **`n_with_value`** tells you how many member repos actually had data — lean on it, since distinct-people counts carry an `approx` flag.

## Live state (verified 2026-07-22)

### GitHub trackers landed — PR metrics now populate

GrimoireLab gained three GitHub backends (`github:issue`, `github:pull`, `github:repo` → the `github_issues` / `github_pull_requests` / `github_repositories` indices; see `query-opensearch`). The **PR-fed metrics came alive** as a result. Measured on `Biohub/esm`, 2026-07-21 → 2026-07-22:

| Metric | before | now |
|---|---|---|
| `closure_ratio` | `—` | **95%** |
| `cr_reviews` | `—` | **11** |
| `cr_accepted` | 0 | **83** |
| `cr_declined` | 0 | **21** |
| `self_merge` | `—` | **65%** |
| `cr_duration` / `pr_time_to_close` | `—` | **0.0 d** |

**Issue-fed metrics are still empty for that repo** (`first_response`, `issue_response_time`, `issue_resolution`, `issues_*`) — not because the metrics are broken, but because the **issue backend covers only 242 repos** and this one isn't among them, despite having 75 open issues on GitHub. PRs cover 186 repos, the repo tracker 4,554. So an empty issue metric is a **coverage gap, not a zero**; confirm against `github_issues` before reporting "no issue activity".

### Popularity metrics lag the freshest source

`project_popularity` and `technical_fork` still read stars/forks from SPARQL and are **stale by a wide margin**. For `Biohub/esm` on 2026-07-22, CHAOSS reported **2343 stars / 289 forks** while the new `github_repositories` tracker reported **2861 / 366 — exactly matching the live GitHub API**. Until the metric is rewired, prefer the tracker for current popularity figures and treat these two cards as historical.

### `0.0 d` means "under an hour", not "instantly"

`cr_duration` and `pr_time_to_close` are **medians in days, rendered to one decimal**. On `Biohub/esm` the median merge time is 0.023 days (~33 minutes), so it displays as `0.0 d` even though the mean is 8.9 days (p95 = 7.9). Don't read `0.0 d` as missing data or as instant merges — render sub-day medians in hours, or the card misleads.

### Snapshot / auth notes

- SPARQL traces in `--include traces` query `GRAPH <https://open-pulse.epfl.ch/graph/2026-05/hybrid>` (see `query-sparql` named-graph convention). `test_coverage` remains sparse.
- Repos are **GitHub-only**: `repo <owner> <repo>` → `/repositories/github.com/...`.
- Projects are discipline/topic buckets of repos. **The set and count change over time, so always read it from `projects` — never hardcode a number.** At time of writing the largest are `info-eng` (~109 repos), `bioeng` (~95), `stats` (~63), with domain-relevant ones like `protein_ai_ecosystem` (~26), `bio` (~42), `chem` (~10). Use the exact `project` slug returned by `projects` (e.g. `protein_ai_ecosystem`, not `protein-ai`). `project-repos <project>` returns the project header plus both a `metrics[]` summary and a `repositories[]` list.
- A browsable UI to explore first: `https://openpulse.epfl.ch/chaoss` (same auth).
- **`project-repos` truncates at 150 repositories** (`truncated: true`) and ignores `limit`/`offset` params. For a project's full membership, aggregate OpenSearch on `repo_name` filtered by `project` (see `query-opensearch`); keep `project-repos` for its per-repo metric values table.
- **Project-level `aggregate.value` can be null even when per-repo values exist** (e.g. `absence_factor`, `licenses_declared` at project scope) — read `aggregate.n_with_value` before trusting a project number, and mind `approx_note` (contributor sums double-count people active in several repos).

## Conventions

- **Treat `value` as a string.** For numbers, parse `value` or read the `visual` block — and remember `"—"` ≠ 0.
- **Use the featured table** when the user names a dashboard card ("closure ratio", "bus factor", "doc discoverability") — map to the slug, pick the window, format with the narrative pattern.
- **Say when data is missing or approximate** — byte-level language shares, open PR counts, clone/download stats, and contribution-type breakdowns are gaps; don't invent them.
- **An empty metric means "not crawled here", not "zero".** Coverage varies per repo: where a metric's source hasn't been ingested (no GrimoireLab enrichment, no GME extraction) the API returns a neutral/empty result rather than failing, so a card can read `—` while the underlying activity exists. Never render `—` as `0`, and don't conclude a project lacks reviews or tests from an empty value alone.
- **`chaoss_url` on each spec links the upstream CHAOSS definition** — cite it rather than paraphrasing what a metric means.
- This API is **read-only and GET-only**; there is nothing to mutate. The read password suffices.
- `--window` snaps server-side — passing 400 lands on 365; don't expect arbitrary windows.
- Project aggregates are cached 30 min; add `--refresh` only when you need a recompute, since it's slower.
