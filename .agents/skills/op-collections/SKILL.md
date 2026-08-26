---
name: op-collections
description: Browse, search, and export the Open Pulse hub's indexed collections — ~50 DuckDB-backed datasets (github_repos, huggingface_models, zenodo_records, orcid_*, ror_*, infoscience_*, snsf_*, gitlab_*, …) — plus cross-store counts at /api/stats/. TRIGGER when the user wants to look up / list / search / export rows from one of these named source collections, see how many entries a collection holds, or get a top-level inventory of what data the hub has indexed. SKIP when they want the live property graph (query-neo4j), the RDF metadata graph (query-sparql), the GrimoireLab commit indices (query-opensearch), or a computed CHAOSS metric (query-chaoss).
---

# Open Pulse Collections ("indices")

The Open Pulse hub ingests every source it crawls into a set of **DuckDB-backed collections** — one indexed table per source (GitHub, HuggingFace, Zenodo, ORCID, ROR, Infoscience, SNSF, GitLab, …). This skill reads them through the hub's HTTP API. It's **read-only** — `OPENPULSE_AUTH` (the reader password) is enough; nothing here mutates.

Both scripts read `OPENPULSE_ENDPOINT` (base URL, e.g. `https://openpulse.epfl.ch`) and `OPENPULSE_AUTH` (`user/password`) from `.env`. HTTP Basic, password-only — the username is ignored.

```
.agents/skills/op-collections/
├── query.py       # Python 3, stdlib only
└── query.mjs      # Node 18+, built-in fetch
```

### Open Pulse skill family

| Skill | Reach for it when you need… |
|---|---|
| **op-collections** *(this one)* | exact keyword/structured rows from the hub's ~50 indexed source collections (DuckDB) |
| `op-search` | semantic / vector / "by meaning" search across the same sources (RAG) |
| `op-extractor` | to run / monitor the pipeline & git metadata extractor (quests) |
| `op-crawler` | to launch (via a quest) & control GitHub crawl jobs |
| `query-neo4j` · `query-sparql` · `query-opensearch` | a raw query against one live store |
| `query-chaoss` | a pre-computed CHAOSS metric for a repo/project |

The three `op-*` skills share the same host and `OPENPULSE_*` credentials; this one only ever reads.

## Identifiers — how this store keys things

Rows are plain DuckDB records. For `github_repos` the repo is split across **two columns**, `owner` and `name` — there is no URL column, so `--q` does a full-text filter and you match the pair yourself:

```bash
python .agents/skills/op-collections/query.py rows github_repos --q "Biohub/esm" --size 5
```

`--q` is a **filter, not a lookup**: it can return near-misses (searching `esm` also matches `OpenSeesModel`), so always confirm `owner` and `name` on the row you use. The `raw` column holds the untouched GitHub API payload, and `repo_id` is `{owner}/{name}`.

Cross-store: SPARQL and Cypher key on `https://github.com/{owner}/{name}`; CHAOSS takes `owner` + `repo` as path segments; OpenSearch uses a clone URL whose `.git` suffix varies. See `.agents/SKILLS.md` §12.

## Run

> **Plugin install?** If this skill runs from the `open-pulse` plugin instead of a repo checkout, the scripts live under the plugin root — replace the `.agents/skills/` prefix in the commands below with `${CLAUDE_PLUGIN_ROOT}/.agents/skills/`. Credentials are unchanged: a `.env` at your project root (keys as in the template's `.env.example`).

```bash
# Cross-store inventory: per-store repo/user/org counts, SPARQL named graphs, duckdb collection sizes
python .agents/skills/op-collections/query.py stats

# One collection: headline numbers + which columns are searchable
python .agents/skills/op-collections/query.py cstats github_repos

# Page through rows (full-text filter + sort + paging)
python .agents/skills/op-collections/query.py rows github_repos --q "deep learning" --size 20
python .agents/skills/op-collections/query.py rows github_repos --q epfl --sort stargazers_count --page 2

# Export a whole (filtered) collection — raw body, csv (default) or json
python .agents/skills/op-collections/query.py export huggingface_models --fmt json --q epfl > models.json

# Arbitrary GET fall-through (any path under the host)
python .agents/skills/op-collections/query.py get /api/hub/c/zenodo_records/stats

# Node equivalent (same subcommands + flags)
node .agents/skills/op-collections/query.mjs rows ror_switzerland --size 10
```

Output is JSON (pretty-printed); `export` always streams the raw body so you can redirect it to a file. Errors print `http <code>: <body>` to stderr and exit non-zero.

## Flags

| Flag | Applies to | Meaning |
|---|---|---|
| `--q TEXT` | rows, export | full-text filter (matches the collection's searchable columns) |
| `--sort COL` | rows, export | sort by a column |
| `--page N` | rows | page number (1-based) |
| `--size N` | rows | page size |
| `--fmt csv\|json` | export | export format (default `csv`) |
| `--param k=v` | all | escape hatch for any param not modelled (repeatable) |
| `--raw` | all | print body verbatim instead of pretty-printing |

## The collections (verified 2026-06-08)

`stats` returns the authoritative counts; `cstats <name>` lists each collection's searchable columns and a few example queries. Known collection names:

- **GitHub** — `github_repos` (~10.2k), `github_users`, `github_organizations`
- **GitLab** — `gitlab_epfl_{groups,projects,users}`, `gitlab_ethz_*`, `gitlab_datascience_*`
- **HuggingFace** — `huggingface_models`, `huggingface_datasets`, `huggingface_spaces`, `huggingface_papers`, `huggingface_organizations`
- **Publications / open science** — `zenodo_records`, `infoscience_{articles,chunks,organizations,persons}`, `ethz_research_collection_{articles,chunks,organizations,persons}`, `oamonitor_{publications,journals,publishers,organisations}`, `swissubase_entities`
- **People / institutions** — `orcid_epfl_{persons,employments,educations}`, `orcid_switzerland_{persons,employments}`, `ror_{epfl_ethz,europe,switzerland,worldwide}`, `institutions`, `authors`, `concepts`
- **Funding** — `snsf_{epfl,ethz,switzerland}`
- **Other** — `renkulab_{projects,groups,users,data_connectors}`, `dockerhub`, `epfl_graph_disciplines`, `sources`, `topics`, `works`

Each row payload includes `db_path`, `table`, and `columns` so you can see the schema before filtering. `cstats` exposes `search.columns` (what `--q` matches) and `search.examples`.

## Oxigraph named graphs (`stats` → `sparql`)

The `sparql` block lists every named graph Oxigraph holds — authoritative sizes before writing SPARQL:

```json
"named_graphs": [
  { "uri": "https://open-pulse.epfl.ch/graph/2026-05/hybrid", "triples": 2453125 },
  { "uri": "https://open-pulse.epfl.ch/graph/2026-06/hybrid", "triples": 328691 },
  …
]
```

**Convention:** production data lives in `https://open-pulse.epfl.ch/graph/{YYYY-MM}/hybrid` and is also exposed as Oxigraph's **default graph** — plain `{ ?s ?p ?o }` queries work without a `GRAPH` clause. Use explicit `GRAPH <…>` to pin a snapshot or reach utility graphs (`_backup/…`, `_links/identity`). Full modes and gotchas: `query-sparql` skill.

## Notes

- This is a **separate store** from the three query-* skills: the collections are the hub's curated DuckDB indices, not Neo4j/SPARQL/OpenSearch. Use `stats` to see all four side by side (`sparql`, neo4j, `opensearch`, `duckdb` blocks).
- `--q` only searches the columns a collection marks searchable (see `cstats … → search.columns`); filtering on other columns needs `--sort` + paging or the `databases/duckdb/query` endpoint (not wrapped here).
- `export` with no `--q` dumps the entire collection — large for `github_repos`; prefer a filter or pipe to a file.
- **Some collections are vector-indexed, not DuckDB-backed** — the `*_chunks` ones (`infoscience_chunks`, `ethz_research_collection_chunks`) are RAG embedding chunks. `cstats`/`rows` on them return `404 "… has no DuckDB backing registered"`. To search those (and any source) semantically, use the **op-search** skill (the extractor's vector indices).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `http 404: … has no DuckDB backing registered` | The collection is vector-indexed (a `*_chunks` set), not a DuckDB table — not queryable here. |
| `http 404: Not Found` | Misspelled collection name — run `stats` and read the `duckdb` block for valid names. |
| `--q` returns nothing | The term only matches `search.columns` (see `cstats <name>`); other columns aren't full-text indexed. |
| `error: OPENPULSE_ENDPOINT and OPENPULSE_AUTH … must be set` | Missing `.env` keys — see `.env.example` (reader password is enough here). |
| `network error: …` | Host unreachable — check VPN / that `https://openpulse.epfl.ch` resolves. |
