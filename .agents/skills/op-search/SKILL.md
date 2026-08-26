---
name: op-search
description: Semantic / vector search (RAG retrieval) over the Open Pulse extractor indices — the Git Metadata Extractor service indexes every source (github_repos, zenodo_records, openalex, orcid, ror, infoscience, huggingface_*, gitlab_*, snsf, swissubase, …) into per-provider vector stores and serves embedding search with cross-encoder reranking. TRIGGER when the user wants to semantically search / find-by-meaning / "search the RAG" across these sources, find the most relevant repos/papers/people/orgs for a free-text query, or see index doc counts and freshness. SKIP for exact keyword/structured row lookups (op-collections), raw single-store queries (query-neo4j / query-sparql / query-opensearch), or computed CHAOSS metrics (query-chaoss).
---

# Open Pulse Semantic Search (extractor RAG indices)

The **Git Metadata Extractor service** (GME API v3, mounted at `/api/extractor`) is the same component that *produces* metadata — and it also *serves* the RAG retrieval layer. Each source is indexed into a per-provider **vector store** (Qdrant for most) and exposed as `POST /v2/indices/{provider}/search`: embedding similarity → cross-encoder rerank. Every hit carries a `vector_score` and a `rerank_score`.

This is the answer to "can we query the RAG system?" — **yes**, here. It's distinct from `op-collections` (exact keyword/structured lookups over the hub's DuckDB mirror); use this skill when relevance/meaning matters, not exact field matches.

Both scripts read `OPENPULSE_ENDPOINT` (base host, e.g. `https://openpulse.epfl.ch`) and `OPENPULSE_AUTH` (`user/password`) from `.env`, and append `/api/extractor`. HTTP Basic, password-only. **Search is read-only and works with the reader password.**

```
.agents/skills/op-search/
├── query.py       # Python 3, stdlib only
└── query.mjs      # Node 18+, built-in fetch
```

### Open Pulse skill family

| Skill | Reach for it when you need… |
|---|---|
| **op-search** *(this one)* | semantic / vector / "by meaning" search across the indexed sources (RAG) |
| `op-collections` | exact keyword/structured rows from the same sources (DuckDB mirror) |
| `op-extractor` | to run / monitor the pipeline & git metadata extractor (quests) |
| `op-crawler` | to launch (via a quest) & control GitHub crawl jobs |
| `query-neo4j` · `query-sparql` · `query-opensearch` | a raw query against one live store |
| `query-chaoss` | a pre-computed CHAOSS metric for a repo/project |

## Identifiers — how this store keys things

Search is **by meaning, not by key** — the input is free text plus a provider name, so use this skill when you *don't* already know a repo's exact identifier, and one of the other skills once you do.

| Thing | Form |
|---|---|
| Provider | bare name — `github_repos`, `zenodo_records`, `orcid`, … (`manifest` lists them) |
| Hit `id` | provider-specific; see `id_shape` in `manifest` |
| `payload.entity_id` | the store's own id, e.g. `{owner}/{name}` for `github_repos` |

Hits are ranked, not exact: a query naming one repo will return similar ones too, so verify `entity_id` before treating a hit as *the* repo. Feed that `entity_id` into `query-sparql` / `query-neo4j` (as `https://github.com/{entity_id}`) or `query-chaoss` (split on `/`).

See `.agents/SKILLS.md` §12 for the full identifier map.

## Run

> **Plugin install?** If this skill runs from the `open-pulse` plugin instead of a repo checkout, the scripts live under the plugin root — replace the `.agents/skills/` prefix in the commands below with `${CLAUDE_PLUGIN_ROOT}/.agents/skills/`. Credentials are unchanged: a `.env` at your project root (keys as in the template's `.env.example`).

```bash
# Semantic search a provider (free text). Returns ranked hits with vector_score + rerank_score.
python .agents/skills/op-search/query.py search github_repos "protein structure prediction" --top-k 5
python .agents/skills/op-search/query.py search zenodo_records "single-cell RNA atlas"

# Multi-entity indices: pick the entity type with --target
python .agents/skills/op-search/query.py search orcid "machine learning EPFL" --target persons
python .agents/skills/op-search/query.py search openalex "graph neural networks" --target works --candidate-k 50

# Metadata filter (index-specific shape; Qdrant for most)
python .agents/skills/op-search/query.py search github_repos "diffusion model" --filter '{"primary_language":"Python"}'

# Index introspection
python .agents/skills/op-search/query.py stats github_repos          # counts + last_updated, by_table
python .agents/skills/op-search/query.py manifest                    # all providers, entity_types, backend
python .agents/skills/op-search/query.py freshness                   # per-provider count + age_seconds

# Node equivalent (same subcommands + flags)
node .agents/skills/op-search/query.mjs search ror "polytechnique lausanne" --top-k 3
```

Output is JSON (pretty-printed). Errors print `http <code>: <body>` to stderr and exit non-zero.

## Search flags

| Flag | Meaning |
|---|---|
| `--top-k N` | max hits returned (default 10) |
| `--candidate-k N` | vector candidates fetched *before* reranking — raise it for higher recall on broad queries |
| `--target T` | entity type for multi-entity indices (see the manifest's `entity_types`) |
| `--filter JSON` | metadata filter dict applied to the vector store (index-specific; Qdrant shape for most) |
| `--param k=v` | extra raw query param (repeatable) |
| `--raw` | print body verbatim |

## Response shape (verified 2026-06-08)

`search` returns `{index_name, query, target, hits[], extra}`. Each hit:

- `vector_score` — embedding cosine similarity (recall stage)
- `rerank_score` — cross-encoder relevance (final ranking; sort by this)
- `payload` — the indexed chunk's metadata (`entity_type`, `entity_id`, plus source fields)
- `entity` — the full source record (e.g. a repo's description, homepage, license, dates)

## Providers (verified 2026-06-08)

`manifest` is authoritative. All are `backend: vector` except `zenodo_communities` (`duckdb`). Multi-entity providers need `--target`:

| Provider | `--target` values |
|---|---|
| `github_repos` / `github_users` / `github_organizations` | (single) |
| `gitlab_{epfl,ethz,datascience}_{groups,projects,users}` | (single) |
| `huggingface_papers` | (single — other HF entity types index separately) |
| `zenodo_records` | (single) · `zenodo_communities` (single, duckdb) |
| `orcid` | `persons`, `employments`, `educations` |
| `openalex` | `works`, `authors`, `institutions`, `sources`, `topics`, `concepts` |
| `infoscience` / `ethz_research_collection` | `chunks`, `articles`, `persons`, `organizations` |
| `swissubase` | `studies`, `datasets`, `persons`, `institutions` |
| `renkulab` | `projects`, `groups`, `users`, `data_connectors` |
| `ror` | `organizations` |
| `snsf` | `grants` *(also has structured `/v2/indices/snsf/grants` + `/grants/facets` — reach via `get`)* |
| `dockerhub` | `image` · `epfl_graph` → `disciplines` |

## Notes

- **Sort by `rerank_score`, not `vector_score`.** Vector score is the recall stage; the reranker is the final relevance signal. For broad/ambiguous queries raise `--candidate-k` (e.g. 50–100) so the reranker has more to choose from.
- `stats <provider>` exposes a `by_table` split (e.g. `github_repos` → `chunks: 35145, repos: 10246`): the chunks are the RAG embeddings, the entity rows are the originals.
- **Indexes are GME-produced.** To (re)build one, run the pipeline (`op-extractor`); the freshness `age_seconds` tells you how stale an index is.
- **Safety:** the extractor service sits behind the same Basic-auth proxy but does **not** enforce the hub's reader/admin split — its mutating endpoints (`/v2/indices/{provider}/ingest`, `…/reset`, `/v2/indices/reset-all`, `/v2/cache/clear`) are reachable with the reader password and are **destructive**. This skill deliberately wraps only search/stats/manifest/freshness. Do not call the ingest/reset endpoints by hand unless you intend to rebuild an index.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `http 404` on search | Unknown provider — run `manifest` for exact names. |
| Empty / weak `hits` | Try a broader query, raise `--candidate-k`, or drop `--filter`. Check the index isn't stale via `freshness`. |
| `http 422` | Missing/!malformed body — `query` is required; `--filter` must be valid JSON. |
| results from the wrong entity type | Pass `--target` (see the provider table). |
| `network error` | Host unreachable — check VPN / DNS for `openpulse.epfl.ch`. |
| `network error: request timed out` (scripts cap at 90s) | **Almost certainly a transient GME outage, not slowness — retry before investigating.** Healthy search latency is well under 10s for every provider: measured 2026-07-21 at 0.6–1.7s for `github_repos`, `ror`, `zenodo_records` and ~5.6s for `infoscience`. Nothing legitimately approaches 90s, so a timeout means the extractor service is wedged (it restarts periodically after memory-leak hits). The tell: `stats` / `freshness` / `manifest` keep answering while `search` hangs — those don't touch the embedding path. |
| `http 503: <provider> index module unavailable` | Usually the same transient outage — `ror` returned this and then served queries in 1.7s once GME recovered. Retry first; only treat the provider as undeployed if it fails consistently while other providers succeed. |
