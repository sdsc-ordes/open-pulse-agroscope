---
name: query-sparql
description: Run a SPARQL query against the Open Pulse Oxigraph triplestore via the hub HTTPS gateway. TRIGGER when the user asks anything that requires reading from the RDF metadata graph — listing named graphs, counting triples, exploring a vocabulary/predicate, or running a SPARQL SELECT/ASK/CONSTRUCT they paste in. SKIP for graph property questions (use query-neo4j) or log/index questions (use query-opensearch).
---

# Query SPARQL (Oxigraph via the hub gateway)

This skill ships two equivalent scripts that POST to `{OPENPULSE_ENDPOINT}/sparql/query` over HTTPS — the **standards-compliant W3C SPARQL endpoint** (content negotiation works, so `--accept turtle/csv/xml` behaves; also usable from YASGUI, rdflib, SPARQLWrapper, federation). Both read `OPENPULSE_ENDPOINT` and `OPENPULSE_AUTH` (format `user/password`; the username is ignored — the token is what matters) from `.env`; set `SPARQL_ENDPOINT` / `SPARQL_AUTH` only to override the derived values. They deliberately do not support `/update` — use curl directly if you need to mutate.

The hub also exposes a JSON convenience path — `POST {OPENPULSE_ENDPOINT}/api/databases/sparql/query` with body `{"query": "…"}` returning `{columns, rows, row_count}` (same shape as the Cypher/OpenSearch gateways) — handy for app code that wants one uniform response shape across stores.

```
.agents/skills/query-sparql/
├── query.py       # Python 3, stdlib only
└── query.mjs      # Node 18+, built-in fetch
```

## Identifiers — how this store keys things

Subjects are **absolute IRIs**, never bare slugs. Match the full URL literal or you get zero rows (no error).

| Entity | IRI form | Example |
|---|---|---|
| Repository | `https://github.com/{owner}/{repo}` | `<https://github.com/Biohub/esm>` |
| Person (GitHub) | `https://github.com/{login}` | `<https://github.com/santiag0m>` |
| Person (ORCID) | `https://orcid.org/{id}` | `<https://orcid.org/0000-0002-0883-1373>` |
| Institution | `https://ror.org/{id}` | `<https://ror.org/014nxkk19>` |
| Article | `https://doi.org/{doi}` | `<https://doi.org/10.1101/…>` |
| Named graph | `https://open-pulse.epfl.ch/graph/{YYYY-MM}/{rule-based\|hybrid}` | see below |

No `.git` suffix on repo subjects. Contribution authors can be **either** a GitHub URL or an ORCID (occasionally an Infoscience item URL), so don't assume one shape when grouping people.

Cross-store: Cypher uses the same repo URL in `full_name`; CHAOSS and collections take `owner` + `repo` separately; OpenSearch uses a *clone* URL whose `.git` suffix varies. See `.agents/SKILLS.md` §12.

## Run

> **Plugin install?** If this skill runs from the `open-pulse` plugin instead of a repo checkout, the scripts live under the plugin root — replace the `.agents/skills/` prefix in the commands below with `${CLAUDE_PLUGIN_ROOT}/.agents/skills/`. Credentials are unchanged: a `.env` at your project root (keys as in the template's `.env.example`).

```bash
# Inline SELECT — JSON bindings flattened to {var: value}
python .agents/skills/query-sparql/query.py 'SELECT (COUNT(*) AS ?n) WHERE { ?s ?p ?o }'

# From a file
python .agents/skills/query-sparql/query.py -f query.rq

# CONSTRUCT or DESCRIBE — switch to turtle
python .agents/skills/query-sparql/query.py --accept turtle 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } LIMIT 10'

# Raw passthrough (no JSON pretty-printing)
python .agents/skills/query-sparql/query.py --accept csv --raw 'SELECT ?s WHERE { ?s a ?t } LIMIT 5'

# Node equivalent (same flags)
node .agents/skills/query-sparql/query.mjs -f query.rq
```

For `SELECT` the script flattens the SPARQL JSON Results envelope to a plain `[{var: value}, ...]` array. For `ASK`, `CONSTRUCT`, `DESCRIBE`, or any non-`json` accept, the response is passed through.

## Default graph vs named graphs (verified 2026-07-21)

Oxigraph holds production RDF in **named graphs**, but the hub also configures a **default graph** so plain SPARQL (no `GRAPH` clause) works.

### Two query modes

| Mode | Syntax | When to use |
|---|---|---|
| **Default graph** | `{ ?s ?p ?o }` — no `GRAPH` wrapper | Most ad-hoc queries. This is the **cumulative** production graph (~3.34M triples as of 2026-07-21) — the accumulated result of the work so far, **not** a copy of any one monthly snapshot. |
| **Named graph** | `GRAPH <https://open-pulse.epfl.ch/graph/2026-05/hybrid> { … }` | Pin a specific month, choose a specific derivation method (see below), compare snapshots side by side, or reach `_backup/…` / `_links/identity`. |

```sparql
# Default graph mode — fine for everyday repo/metadata lookups
SELECT ?name WHERE {
  <https://github.com/biopython/biopython> schema:name ?name .
}

# Named graph mode — pin a snapshot or reach non-default graphs
SELECT ?name WHERE {
  GRAPH <https://open-pulse.epfl.ch/graph/2026-05/hybrid> {
    <https://github.com/biopython/biopython> schema:name ?name .
  }
}
```

Default mode does **not** union every named graph — backups and in-progress snapshots are invisible unless you name them explicitly.

### Named-graph IRI pattern

Named graphs are **monthly snapshots**, and each month can exist in two variants that differ by *how the triples were derived*:

| Variant | Pattern | How it was built |
|---|---|---|
| **rule-based** | `…/graph/{YYYY-MM}/rule-based` | Deterministic extraction only — **no agentic inference**. Everything traces back to an explicit rule, so it's the conservative, reproducible view. |
| **hybrid** | `…/graph/{YYYY-MM}/hybrid` | Rule-based output **plus agent-applied fixes** — agents correct and enrich what the rules got wrong or missed. Higher coverage and quality, at the cost of a non-deterministic step. |
| **Utility / backup** | `…/graph/_…` | Not a snapshot: `…/_backup/2026-05-hybrid-prenorm`, `…/_links/identity`. |

**Choosing a variant.** Use `hybrid` when you want the best available metadata (it's what production is built from). Use `rule-based` when you need provenance you can defend — reproducibility, auditing, or measuring what the agents actually changed. Diffing the two for the same month is the way to quantify the agents' contribution:

```sparql
# What did the agents add for this subject? (verified 2026-07-21: 1,360 triples)
SELECT ?p ?o WHERE {
  GRAPH <https://open-pulse.epfl.ch/graph/2026-06/hybrid> { <https://ror.org/05a28rw58> ?p ?o }
  FILTER NOT EXISTS {
    GRAPH <https://open-pulse.epfl.ch/graph/2026-06/rule-based> { <https://ror.org/05a28rw58> ?p ?o }
  }
}
```

Agent-added triples often carry a **confidence score** — e.g. `gme:ror_match_confidence 0.94` appears in `hybrid` but not `rule-based`. Treat such predicates as inferred, not observed, and surface the confidence if you display the value downstream.

Two traps when diffing:

- **Pick a subject that exists in both graphs**, or the diff is vacuously empty. `Biohub/esm` has 112 triples in `2026-06/rule-based` and **0** in `2026-06/hybrid`, so diffing it returns nothing — which reads like "the agents changed nothing" when it actually means "this subject hasn't been processed into hybrid yet".
- **Variants are not ordered by size.** A rule-based graph can dwarf its hybrid sibling (2026-06: 7.66M vs 440k) because they come from different pipeline stages and a month's hybrid build may still be filling. Bigger ≠ newer ≠ better.

Pipeline `sparql_upload` (op-extractor) lands triples in the named graph for that month; the default graph accumulates production data across months. CHAOSS SPARQL traces may use either form.

### Current named graphs (verified 2026-07-21)

| Named graph | Variant | Triples | Role |
|---|---|---|---|
| `…/graph/2026-06/rule-based` | rule-based | ~7.66M | 2026-06 deterministic build (no agent inference) |
| `…/graph/2026-05/hybrid` | hybrid | ~2.45M | 2026-05 snapshot, agent-corrected |
| `…/graph/_backup/2026-05-hybrid-prenorm` | backup | ~2.12M | Pre-normalisation backup of the above |
| `…/graph/2026-06/hybrid-pre-gme-v3-rc2` | hybrid (pinned) | ~472k | Pre-release GME v3 build |
| `…/graph/2026-06/hybrid` | hybrid | ~440k | 2026-06 snapshot — in progress, still filling |
| `…/graph/_links/identity` | utility | ~204 | Cross-store identity links |

(IRIs abbreviated — the prefix is `https://open-pulse.epfl.ch`.)

Two things to keep in mind when reading this table:

- **Not every month has both variants.** `2026-05/rule-based` is part of the naming convention but was **not present in the store on 2026-07-21** — only its `hybrid` sibling was. Never assume a variant exists; run the inventory query below before pinning one, or you'll get silently empty results (a `GRAPH` clause naming a non-existent graph returns zero rows, not an error).
- **The default graph is cumulative, not a copy.** At ~3.34M triples it matches none of the rows above, because it accumulates across months rather than mirroring the latest snapshot. Query it for "what do we know about X"; query a named graph for "what did month M's pipeline produce, by method V".

Refresh sizes: `python .agents/skills/op-collections/query.py stats` → `sparql.named_graphs`, or the inventory query below.

### Auditing one subject across every graph

Coverage is **uneven per subject** — a repo present in one snapshot may be entirely missing from another. Check before you attribute meaning to an empty result:

```sparql
SELECT ?g (COUNT(*) AS ?triples) (COUNT(DISTINCT ?p) AS ?predicates) WHERE {
  GRAPH ?g { <https://github.com/Biohub/esm> ?p ?o }
} GROUP BY ?g ORDER BY DESC(?triples)
```

Result for `Biohub/esm` on 2026-07-21 (as subject / as object):

| Graph | subject | predicates | object |
|---|---|---|---|
| default (cumulative) | 142 | 50 | 22 |
| `2026-05/hybrid` | 142 | 50 | 22 |
| `2026-06/hybrid-pre-gme-v3-rc2` | 130 | 49 | 4 |
| `2026-06/rule-based` | 112 | 48 | 5 |
| `_backup/2026-05-hybrid-prenorm` | 48 | 30 | 19 |
| `2026-06/hybrid` | **0** | — | 0 |
| `_links/identity` | **0** | — | 0 |

Three things this shows, all worth internalising:

- **The default graph tracks one snapshot per subject, it does not union them.** If it unioned, this repo would show 432 subject triples; it shows 142 — the `2026-05/hybrid` figure. Yet the default graph is ~3.34M triples overall versus that snapshot's ~2.45M, so the *store* is cumulative while any *given* subject resolves to one contributing snapshot. Don't reason about the default graph from a single subject, or vice versa.
- **Identical counts don't mean identical content.** Default and `2026-05/hybrid` both hold 142 triples here, yet 18 differ in each direction — every one of them a `gme:releases` value whose opaque hash was regenerated. Non-release triples: **zero** differences. Diff on values, not counts.
- **Absence is a pipeline state, not a fact about the repo.** `2026-06/hybrid` is still filling, so this repo simply hasn't landed there yet; `_links/identity` only ever holds cross-store links. Neither means "unknown repo".

## Prefixes used in this graph

```sparql
PREFIX op:     <https://open-pulse.epfl.ch/ontology#>
PREFIX gme:    <https://openpulse.science/git-metadata-extractor#>
PREFIX schema: <http://schema.org/>
PREFIX org:    <http://www.w3.org/ns/org#>
PREFIX rdf:    <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
```

**Identifiers are full URLs.** A repo subject is `<https://github.com/owner/repo>`,
a person is `<https://github.com/login>` or `<https://orcid.org/xxxx-…>`, an
institution is `<https://ror.org/…>`. Match the full URL literal.

## Predicate reference (what's actually populated)

**Repository** (subject = the GitHub URL):
`schema:name`, `gme:description`, `schema:programmingLanguage` / `gme:primary_language`,
`gme:license_name` / `schema:license`, `op:githubRepoStars`, `op:githubRepoForks`,
`gme:watchers_count`, `gme:open_issues_count`, `gme:subscribers_count`, `gme:network_count`,
`gme:size_kb`, `schema:dateCreated`, `gme:pushed_at`, `gme:updated_at`, `gme:default_branch`,
`gme:archived`, `gme:has_wiki`, `gme:has_discussions`, `gme:has_pages`, `gme:homepage`,
`gme:avatar_url`, `gme:html_url`, `gme:keywords`, `op:discipline`, `op:ownedBy`,
`gme:contributing_url`, `gme:citation_cff_url`, `schema:citation`.

**Contributions** — one `op:Contribution` node per (author, repo), carrying dates:
```sparql
?c a op:Contribution ; schema:author ?author ;
   op:contributionTo ?repo ;
   op:firstContributionDate ?first ; op:lastContributionDate ?last .
```

**People → institutions** (memberships, mostly hung off ORCIDs):
```sparql
?user org:hasMembership ?m . ?m org:organization ?org .   # ?org is usually a ROR URI
```
~3,392 memberships / 1,252 users; **3,118 point at `ror.org`**; ~1,174 users are ORCIDs, ~73 are GitHub URLs. ROR labels are local: `<ror> schema:name ?name`.

**ORCID ↔ GitHub bridge** (~993): `?orcid schema:url ?gh` (filter `?gh` to github.com). Use it to map an ORCID's memberships/publications onto a GitHub contributor.

**Owner → parent institution**: `?owner org:unitOf ?ror`.

**Publications** are `schema:ScholarlyArticle` entities — subject IRI is the `doi.org` URL, with `schema:name` (title), `schema:identifier` (bare DOI), `schema:datePublished`, `schema:author` (ORCIDs), `schema:sourceOrganization` (venue/ROR), `op:infoscienceArticleIdentifier`. Direct repo citations `?repo schema:citation ?article` are **sparse** (664 total / 368 repos; citation targets are typed ScholarlyArticle, 435). Richer: articles authored by people — but **`?x schema:author ?orcid` ALSO matches ~3,800 repositories** (repos carry `schema:author` too), so you MUST constrain `?art a schema:ScholarlyArticle` or repos leak in as fake papers (only 347 articles are genuinely orcid-authored). To find a tool's "related publications", map its contributors' ORCIDs and pull the ScholarlyArticle entities they authored.

## Useful starter queries

| Goal | SPARQL |
|---|---|
| Named graphs + sizes (**run this before pinning a graph**) | `SELECT ?g (COUNT(*) AS ?n) WHERE { GRAPH ?g { ?s ?p ?o } } GROUP BY ?g ORDER BY DESC(?n)` |
| Does a subject exist in a given variant? | `ASK { GRAPH <…/graph/2026-06/hybrid> { <subject> ?p ?o } }` |
| What did the agents add for a subject? | `SELECT ?p ?o WHERE { GRAPH <…/{M}/hybrid> { <s> ?p ?o } FILTER NOT EXISTS { GRAPH <…/{M}/rule-based> { <s> ?p ?o } } }` |
| Triple count (default graph) | `SELECT (COUNT(*) AS ?n) WHERE { ?s ?p ?o }` |
| Triple count (named graph) | `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <https://open-pulse.epfl.ch/graph/2026-05/hybrid> { ?s ?p ?o } }` |
| Predicates on a repo | `SELECT DISTINCT ?p WHERE { <https://github.com/biopython/biopython> ?p ?o }` |
| Stars/forks for repos | `{ VALUES ?r { <…/repo1> <…/repo2> } ?r op:githubRepoStars ?s ; op:githubRepoForks ?f }` |

## Gotchas learned the hard way

- **Scalar predicates are often MULTI-VALUED — this silently produces cartesian products.** Repo metadata accumulates one value per crawl rather than being overwritten, so a repo can carry several `op:githubRepoStars`, `gme:size_kb`, `gme:pushed_at`, `gme:open_issues_count` values *within a single named graph*. A naive `SELECT ?stars ?forks WHERE { ?r op:githubRepoStars ?stars ; op:githubRepoForks ?forks }` on `Biohub/esm` returns **8 rows** (2 stars × 2 forks × 2 dates), none flagged as stale. Defend with aggregation, and never assume one row per repo:
  ```sparql
  SELECT ?r (MAX(?s) AS ?stars) (MAX(?f) AS ?forks) WHERE {
    ?r op:githubRepoStars ?s ; op:githubRepoForks ?f .
  } GROUP BY ?r
  ```
  `MAX` is a heuristic for "most recent" on monotonic counters like stars — it is wrong for values that can decrease. When you need one coherent snapshot, query a single named graph instead: `2026-06/rule-based` carried clean single values where `2026-05/hybrid` did not.
- **Cross-store values disagree, and the freshest source is not obvious.** For `Biohub/esm` on 2026-07-21: SPARQL default graph gave 2343 *and* 2712 stars, `2026-06/rule-based` gave 2746, the DuckDB collection gave 2617, CHAOSS reported 2343 — while GitHub's live API said **2858**. Every store lags by a different amount. Never present a store value as the current figure without dating it.
- **VALUES over hundreds of URIs times out (504).** For memberships, ORCID bridge, and person-publications, **fetch the whole (small) table once and join in Python** instead of binding a big `VALUES` list. Per-repo `VALUES` of ~25 URIs is fine.
- **IRI-unsafe author logins.** Bot handles like `github-actions[bot]` contain `[]` that break IRI parsing inside `VALUES`. Percent-encode them before interpolating (`[`→`%5B`, `]`→`%5D`).
- **Most affiliations hang off ORCIDs, not GitHub URLs.** A GitHub-only contributor resolves an institution only if an ORCID bridges to their GitHub *and* that ORCID has a membership. Of typical external (non-EPFL) contributors, few do — expect partial coverage and consider the GitHub-profile `company` as a soft fallback.
- **Repo subjects are typed `schema:SoftwareSourceCode`**, not `op:Repository` — `?r a op:Repository` matches nothing. `op:repositoryType` (Software / Data / …) is a separate property, not the rdf:type.
- **`op:discipline` values are Wikidata QIDs** (`http://www.wikidata.org/entity/Q…`). Resolve English labels at build time via the Wikidata `wbgetentities` API (batch ≤ 45 ids), falling back to the QID.
- **Expect software→publication links to be sparse** for org scopes whose contributors aren't ORCID-linked yet — a first extraction can yield near-zero direct `schema:citation` or orcid-authored links. Render the chain as a funnel with the coverage gaps spelled out, not as an empty chart.

## Conventions

- Always include `LIMIT` on exploratory queries. **Default graph mode** (`{ … }` without `GRAPH`) is the cumulative production view and the right default; use an explicit `GRAPH <…/graph/{YYYY-MM}/{rule-based|hybrid}>` when you need a specific month, a specific derivation method, or a non-default graph.
- Updates go to `{OPENPULSE_ENDPOINT}/sparql/update`, require an admin token, and are destructive — never run them unless the user explicitly asks. Use curl, not these scripts.
- Oxigraph default response is SPARQL XML; the scripts always set `Accept` explicitly.
- A 504 from the proxy means the query timed out — reduce the result set, tighten the pattern, or switch to fetch-and-join.
