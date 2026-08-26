# SKILLS.md — Agent task reference

Concrete how-to guides for the most common tasks agents perform on this repo. Companion to `AGENTS.md`.

These recipes are **framework-neutral** — the web app in `src/your-web/` can be built with any stack. Where a step depends on your framework (routing, components), adapt the idea to your tooling; the *structure* is what matters.

---

## 1. Add a data endpoint (server proxy → client)

Open Pulse credentials must stay server-side, so data flows: **store/skill → your server endpoint → typed client → UI**. The browser only talks to your own endpoint.

**Step 1 — server endpoint.** Add a server-side route/function (your framework's server route, a serverless function, or a small API) that reads credentials from `.env`, queries the relevant Open Pulse store (mirror what the `query-*` skill does), and returns JSON. Never expose credentials to the client.

**Step 2 — type the response.** Define the response shape in one shared types module and treat it as the source of truth:

```ts
export interface MyNewResponse {
  field: string;
  count: number;
}
```

**Step 3 — client method.** Add a typed method to your API client that fetches from the endpoint:

```ts
myFeature: {
  list: () => get<MyNewResponse>('/my-feature')
}
```

**Step 4 — use it** in a view, rendering with the design system (see §5). Handle loading/error states.

> For local development without the live backend, you can serve static JSON fixtures from the same endpoint shape, then swap to the real proxy later.

---

## 2. Add a new page

1. Create the route in `src/your-web/` using your framework's routing convention.
2. Wrap it in the shared app shell: the **required attribution bar** (§7.4, `Built using openpulse.science at <build timestamp>`) at the very top, then the header (§7.1) and footer (§7.2) from the active design skill (`openpulse-dark-theme`); list/detail pages use the content+sidebar layout (`sdsc-ui-kit` layouts, dark mapping in `openpulse-dark-theme` §7.3).
3. Use the active design skill: `〇 LABEL` section blocks (§5), cards/tables/badges (§6), `--op-*` contract tokens only.
4. Add a nav entry to the header, following the existing active-link highlight pattern.
5. Wire up data using the pattern in §1 if the page needs it.

---

## 3. Add a graph example query

Graph example queries are framework-neutral data objects. Each has:

```ts
{
  id: 'unique-id',
  title: 'Human title',
  description: 'One-line description shown in sidebar',
  cypher: 'MATCH (n) RETURN n LIMIT 25',
  result: {
    nodes: [ { id: 'n1', label: 'Person', properties: { name: 'Alice' } } ],
    edges: [ { source: 'n1', target: 'n2', type: 'KNOWS', timestamp: '2026-03-01' } ]
  }
}
```

Rules:
- `id` must be unique across all queries
- `label` must be one of: `'Repository' | 'Person' | 'Commit' | 'Organisation' | 'PullRequest'`
- Edges without a `timestamp` are always visible; edges with one appear when `currentDate ≥ timestamp`
- Node colors are determined by `label` — see the active design skill's data-viz palette (`openpulse-dark-theme` §2.6), kept in a single `NODE_COLORS` map

---

## 4. Add a new design token

When the design requires a colour or value that isn't in the token set:

1. **The active design skill first** — add the token (with its value and role) to the design skill's §2 tables and `assets/tokens.css`. If it's a brand value it must come from the base brand's scales.
2. **Global stylesheet `:root`** — add the CSS custom property:
   ```css
   --op-<name>: <hex>;
   ```
3. **Utility framework theme config** (only if you use one, e.g. Tailwind v4 `@theme`) — mirror it so utilities like `bg-op-<name>` generate:
   ```css
   --color-op-<name>: <hex>;
   ```
4. If the token is something **every** design skill must now supply, also add its name to the token contract in `frontend-dev` §2.

Keep the `:root` and theme-config definitions in sync (they are the only two places values may appear).

---

## 5. Write a card / table / badge

Component **anatomy** (padding, borders, states, transitions) lives in `sdsc-ui-kit` `references/components.md`; the dashboard's **dark values and deviations** live in the active design skill (`openpulse-dark-theme` §5–§6). Copy from there rather than inventing new markup — adapt the HTML to your framework's component syntax, but keep classes, tokens, and structure. Key patterns:

**Card:** `bg-op-surface border border-op-border rounded-none p-8`

**Status badge (succeeded):** `color:var(--op-success); background:rgba(52,211,153,0.12)`, `rounded` (4px), uppercase, `tracking-wide`

**Section label (`〇 LABEL`):** `var(--op-text-muted)`, 14px Switzer Medium, uppercase, `tracking-wide`

See `openpulse-dark-theme` §5–§6 for the full dark markup.

---

## 6. Fix a type error

- If you use TypeScript, keep all API response shapes in one shared types module — check there first.
- Regenerate any framework-generated types after adding routes (run your framework's sync/codegen step).
- For build-time env vars, declare them in your build config and provide a fallback inline.
- Give explicit generic types to reactive/state primitives when the initial value is `null`, to prevent inference failures.

---

## 7. Debug a force-directed graph

This is framework-neutral D3 guidance for the graph view:

- Re-run the simulation whenever the `nodes` or `edges` inputs change.
- Node entry animation: new nodes get a random radial offset and animate to their simulated position via a spring (`alpha` decay).
- If nodes spawn at (0, 0) — the simulation hasn't warmed up yet; ensure the graph is built inside a `requestAnimationFrame`.
- A `currentDate` value controls visibility; do the timestamp filtering **before** passing data to the graph component, not inside it.
- D3 color constants must match the `NODE_COLORS` map (single source — values from the active design skill, `openpulse-dark-theme` §2.6). Canvas/D3 can't read CSS variables, so these are hex literals there (`frontend-dev` §5).

---

## 8. Run checks locally

Run whatever type-check / lint / build your chosen stack provides, from `src/your-web/`, before pushing — CI runs the same and will fail the build on errors. A passing build is a correctness gate, not a feature-correctness gate: still verify UI in the browser via Playwright MCP (see `AGENTS.md`).

Separately, the agent-config sync is its own gate: after editing anything in `.agents/`, run `node tools/sync-agents.mjs` so `.agents/` + `AGENTS.md` stay in sync (CI `agents-sync` job enforces it).

---

## 9. Build a scoped dashboard (landing + themes + coverage)

Applies to any **scope** — a school, an institute, a lab cluster, a topic/discipline, a funding programme, or a single organisation. When asked for "a dashboard", default to the shape in `AGENTS.md` → *Reference outcome*: a landing page ("at a glance" — required), a handful of question-anchored drill-down themes adapted to the scope (see the example structures there), and a coverage panel. Rules that generalise across scopes:

- **One provenance component, everywhere.** Every data card gets the same compact `<details>` disclosure with four fixed fields — *source* (Neo4j / GraphDB / GrimoireLab / GitHub API), *method* (crawler / LLM extractor / classifier / CHAOSS API), *refresh cadence*, *caveats*. Never write bespoke per-section explanations. Visual spec: `openpulse-dark-theme` §7.5.
- **Exclude vendored forks from health metrics.** A fork of `assimp` or `imgui` carries the whole upstream commit history and can inflate a scope's commit counts several-fold. Build the fork set from Neo4j `FORK_OF` ∪ SPARQL `op:isForkOf`, exclude it from activity/community series, keep forks in the catalogue but badge them.
- **Title ecosystem growth and per-repo growth apart.** "More repos over time" and "one project's contributor/commit trajectory" are different data cuts — readers conflate them unless the widget titles say which one they are.
- **Say "not computable" instead of rendering an empty chart.** E.g. CHAOSS Organizational Diversity needs affiliations the GrimoireLab identities may not have — show a short honest note and link to where the question *is* answerable.
- **Sparse impact data is a story, not a bug.** Output links (software→publications, software→datasets, …) are thin until identifier coverage (ORCID, CITATION.cff, DOIs) grows; render the chain as a funnel (repos → with metadata → contributors → identifier-linked → outputs linked) and pair it with the coverage panel's to-do lists.
- **Flag framing calls, don't decide them silently** (e.g. whether to lead with `repositoryType = Software` only, or whether to count student repos): show all by default, add the filter, and put a visible "open decision" banner on the section.

## 10. Bake data snapshots at build time

The static-first data path (`AGENTS.md` → *Preferred approach*): a `scripts/fetch-data.mjs` in your app queries the stores directly (reusing the `.env` conventions and HTTP transports from the `query-*` skill scripts) and writes typed JSON snapshots into `src/data/`, which pages import at build time. The browser never touches the stores.

- **Define the scope first, as data.** A scope resolves to one of: a set of GitHub organisations (Neo4j `OWNS`), a GrimoireLab project tag, a SPARQL facet (`op:discipline`, `op:ownedBy`, `org:unitOf`), or an explicit repo list. To enumerate a GrimoireLab project's repos, use an OpenSearch `terms` agg on `repo_name` filtered by `project` — the CHAOSS API's `project-repos` endpoint truncates at 150 and ignores paging params.
- **Typical outputs**: `summary.json` (headline numbers), `repos.json` (catalogue rows), `graph.json` (trimmed nodes/edges for the collaboration graph, each element with a `firstSeen` ISO date so the timeline replay works), `health.json` (monthly series + per-repo table + a `chaoss` block of CHAOSS-API metrics keyed by official metric name), `impact.json` (funnel + linked articles), `coverage.json` (gap lists per org).
- **Resolve discipline labels.** `op:discipline` values are Wikidata QIDs — resolve to English labels at fetch time via `wbgetentities` (batch ≤ 45 ids), falling back to the QID.
- **Trim the graph for readability** in the script, not the component: keep all orgs, repos with ≥ 1 contributor, people connected to ≥ 2 repos plus the top individual contributors; record what was dropped in a `stats` block so the UI can say so.
- **Stamp every snapshot** with `fetchedAt` + scope metadata, and print row counts as the script runs — silent truncation reads as full coverage.
- **Images are snapshots too.** A companion `scripts/fetch-images.mjs` (run after `fetch-data`) bakes org avatars, repo social-preview thumbnails, and partner logos into `src/data/images.json` as WebP data URIs — the browser never fetches images from third parties. Engineering rules + reference script: `frontend-dev` §6 / `examples/fetch-images.mjs`; media-slot visuals: the active design skill (in `openpulse-dark-theme`: §6.7).

## 11. Integrate your own design system (as a skill)

A brand is delivered to agents as a skill directory, not as app code — swapping brands means swapping the skill and updating one line in `AGENTS.md`. (The `new-dashboard` wizard can generate one of these *interactively* from a short design interview — Stage 1b, recipe in that skill's `references/design-skill.md`; this section is the manual equivalent.) The app auto-adapts because it references only the **`--op-*` token contract** (the fixed name set in `frontend-dev` §2); a design skill supplies the values. `sdsc-ui-kit` is the reference layout for a full brand; `openpulse-dark-theme` shows the minimal delta-theme form (`SKILL.md` + `assets/tokens.css`):

```
.agents/skills/<your-brand>/
├── SKILL.md                      # entry point: when-to-use frontmatter + the design language
├── assets/tokens.css             # values for the --op-* token contract, copy-pasteable into an app
└── references/                   # (full brands) split out the detail:
    ├── design-tokens.md          #   every token with value + role
    ├── components.md             #   canonical markup/CSS per component
    └── layouts.md                #   page-level archetypes
```

1. **Implement the token contract.** `assets/tokens.css` must define every `--op-*` name listed in `frontend-dev` §2 (fonts, surfaces, accents, text, status, footer) — keep the names, change the values; aliasing is fine. It must be usable verbatim as an app's `:root` block. No framework assumptions — utility-class names are hints, not requirements.
2. **Write the `SKILL.md` frontmatter as a trigger**, not a summary: say *when* an agent should reach for the skill ("when building UI for X…") and when not to.
3. **State the ground truth.** Name the authoritative source (a Figma file, a brand PDF, a production site) and its date, so future edits know what wins a dispute. A delta theme instead names its base skill and lists its deliberate deviations (see `openpulse-dark-theme` §1.2).
4. **Point the app at it**: replace the token values in your global stylesheet's `:root` (and your utility framework's theme config, if any) with the new skill's `assets/tokens.css`. Because the app only uses contract names, this is a one-file change — never rename tokens per-brand in app code.
5. **Activate it**: update the *Active design skill* line in `AGENTS.md` → *Design system*, and run `node tools/sync-agents.mjs`.

---

## 12. Look up one repository across every store

`tools/repo-probe.py` queries all six **read** endpoints for a single GitHub repo and prints what each one knows — the fastest way to check connectivity, see coverage gaps, and spot cross-store disagreement. It's also a working reference for the server-side proxy a browser app needs (credentials stay on the host).

```bash
python tools/repo-probe.py Biohub/esm            # all six stores
python tools/repo-probe.py Biohub/esm --github   # plus live GitHub for comparison
```

Crawler and extractor are deliberately excluded — they're pipeline *control* APIs, not repo-lookup surfaces.

### The six calls, individually

Each is a single authenticated HTTPS request to `$OPENPULSE_ENDPOINT` (Basic auth, username ignored, password = reader token). Verified against `Biohub/esm` on 2026-07-21.

| # | Store | Call | Answers |
|---|---|---|---|
| 1 | SPARQL | `POST /sparql/query` | stars, forks, language, license, created date, contributions with first-contribution dates, ORCID authors |
| 2 | Neo4j | `POST /api/databases/cypher/query` | topology — owner org, issue/PR/star/watch edges, dependencies, forks |
| 3 | OpenSearch | `POST /api/databases/opensearch/query` (DSL) | commit-level truth — commit count, distinct authors, first/last commit, churn, top authors |
| 4 | CHAOSS | `GET /api/v1/metrics/chaoss/repositories/github.com/{owner}/{repo}/metrics` | 35 pre-computed health metrics unified across all three stores |
| 5 | Collections | `GET /api/hub/c/github_repos/rows?q={owner}/{repo}` | the DuckDB crawl row — raw GitHub API payload plus a contributor list with commit counts |
| 6 | Semantic search | `POST /api/extractor/v2/indices/github_repos/search` | find-by-meaning; use when you *don't* already know the repo's exact name |

Equivalent one-liners with the skills (see each skill's `SKILL.md` for flags):

```bash
python .agents/skills/query-sparql/query.py 'PREFIX op: <https://open-pulse.epfl.ch/ontology#>
  SELECT (MAX(?s) AS ?stars) WHERE { <https://github.com/Biohub/esm> op:githubRepoStars ?s }'

python .agents/skills/query-neo4j/query.py "MATCH (r:Repo {full_name:'https://github.com/Biohub/esm'})-[rel]-(n)
  RETURN type(rel) AS rel, count(*) AS n ORDER BY n DESC"

python .agents/skills/query-opensearch/query.py --dsl git_demo_enriched \
  '{"size":0,"query":{"term":{"repo_name":"https://github.com/Biohub/esm"}},
    "aggs":{"authors":{"cardinality":{"field":"author_uuid"}}}}'

python .agents/skills/query-chaoss/query.py repo Biohub esm
python .agents/skills/op-collections/query.py rows github_repos --q "Biohub/esm" --size 1
python .agents/skills/op-search/query.py search github_repos "protein language model" --top-k 3
```

### Three traps this probe exists to catch

1. **Identifier form differs per store.** SPARQL and Neo4j key on the full URL (`https://github.com/Biohub/esm`); CHAOSS and collections take `owner` + `name` separately; OpenSearch uses `repo_name`, whose `.git` suffix is **not** guaranteed — `biopython` has it, `Biohub/esm` doesn't. The probe resolves OpenSearch aliases with a wildcard before matching, and you should too: an exact match on the wrong form returns `0` with no error.
2. **A repo can be indexed twice under a pre-rename owner.** `Biohub/esm` and `evolutionaryscale/esm.git` are the same 184 commits; summing them double-counts.
3. **Missing ≠ zero.** `Biohub/esm` has no `CONTRIBUTES_TO` edges in Neo4j despite 25 commit authors in OpenSearch. Never conclude "no contributors" from one store.

### Reading the numbers

Every store is a **crawl snapshot with its own lag**, so they disagree — by design, but the spread is wide enough to matter. For `Biohub/esm` on 2026-07-21: live GitHub said **2858** stars, SPARQL 2712, collections 2617, CHAOSS 2343. Pick the store that fits the question (CHAOSS for computed health, OpenSearch for commit facts, collections for the raw crawl row), and **date any figure you publish** rather than presenting it as current.
