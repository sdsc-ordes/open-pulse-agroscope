---
name: op-extractor
description: Run and monitor the Open Pulse git metadata extractor (and the rest of the pipeline) via the hub's quest API — list/read quest recipes, launch a run, poll run status and step stats, stop a run, list archives. The GME is the `metadata_extractor` step of a quest. TRIGGER when the user wants to run/trigger/kick off the git metadata extractor or a pipeline quest, check whether an extraction/upload run finished, read a run's logs/step stats, or inspect/create quest recipes. SKIP when they want to control a crawl job specifically (op-crawler) or just read already-extracted data (query-sparql / query-neo4j / op-collections).
---

# Open Pulse Extractor / Pipeline (quests)

Open Pulse ingests data through a **pipeline** of independently-toggleable steps, described by a YAML **quest**:

```
crawler → frontier_extend → metadata_extractor → neo4j_upload → sparql_upload → apply_grimoire_projects → archive_outputs
```

The **git metadata extractor** (GME) is the `metadata_extractor` step — it reads the crawler's graph JSON and extracts per-repo RDF metadata (the `gme:` triples in SPARQL). A quest enables only the steps you want, runs via `/api/pipeline/run`, and emits a `run_id` you poll for status.

**Auth:** reads/monitoring use `OPENPULSE_AUTH` (reader password — enough). **Running, creating, or stopping a quest requires `OPENPULSE_ADMIN_AUTH` (the admin password)** — the script sends admin creds automatically for those, and the hub returns `403 "Reader sessions can't trigger mutating endpoints…"` if it's unset. Both come from `.env`; HTTP Basic, password-only.

```
.claude/skills/op-extractor/
├── query.py       # Python 3, stdlib only
└── query.mjs      # Node 18+, built-in fetch
```

### Open Pulse skill family

| Skill | Reach for it when you need… |
|---|---|
| **op-extractor** *(this one)* | to run / monitor the pipeline & git metadata extractor (quests) |
| `op-crawler` | to launch (via a quest) & control GitHub crawl jobs |
| `op-search` | semantic / vector search (RAG) over the extractor's indices |
| `op-collections` | exact keyword/structured rows from the indexed sources (DuckDB) |
| `query-neo4j` · `query-sparql` · `query-opensearch` | a raw query against one live store |
| `query-chaoss` | a pre-computed CHAOSS metric for a repo/project |

The three `op-*` skills share the same host and `OPENPULSE_*` credentials. Reads work with the reader password; **running** a quest needs the admin password (see below).

## Run

> **Plugin install?** If this skill runs from the `open-pulse` plugin instead of a repo checkout, the scripts live under the plugin root — replace the `.claude/skills/` prefix in the commands below with `${CLAUDE_PLUGIN_ROOT}/.claude/skills/`. Credentials are unchanged: a `.env` at your project root (keys as in the template's `.env.example`).

```bash
# ── Read / monitor (reader password) ──
python .claude/skills/op-extractor/query.py quests                 # list quest recipes on disk
python .claude/skills/op-extractor/query.py quest <path.yml>       # read one quest's YAML + summary
python .claude/skills/op-extractor/query.py runs --limit 10        # recent runs + per-step status
python .claude/skills/op-extractor/query.py status <run_id> --tail 30   # status, step_stats, log tail
python .claude/skills/op-extractor/query.py run-by-job <job_id>    # resolve a crawler job to its run
python .claude/skills/op-extractor/query.py archives               # archived run outputs

# ── Mutate (admin password) ──
python .claude/skills/op-extractor/query.py run --body '{"path":"/open-pulse/open-pulse/data/quests/gme-hybrid-all.yml"}'
python .claude/skills/op-extractor/query.py create --body @new-quest.json
python .claude/skills/op-extractor/query.py stop <run_id> --force

# Node equivalent (same subcommands + flags)
node .claude/skills/op-extractor/query.mjs status <run_id> --tail 20
```

`--body` takes an inline JSON string or `@file`. The run/create payloads are free-form on the server, so the script passes your JSON through unchanged rather than guessing fields — see the quest shape below.

## Quest YAML shape (verified 2026-06-08)

Read an existing quest with `quest <path>` and clone it. Structure:

```yaml
quest:
  name: gme-hybrid-all
  description: "..."
  retry: { max_attempts: 1, backoff_seconds: 0 }
  logging: { level: INFO }
  steps:
    crawler:            { enabled: false }      # see the op-crawler skill for crawler-step fields
    frontier_extend:    { enabled: false }
    metadata_extractor:                          # ← the git metadata extractor
      enabled: true
      input_dir: .quest-artifacts/crawler-json   # where the crawler graph lives
      input_filename: crawler-graph.json
      output_dir: .quest-artifacts/metadata-json-hybrid
      mode: v2
      v2_agent_runtime: hybrid                    # rule_based | agent | hybrid
      v2_poll_interval_seconds: 2.0
      v2_timeout_seconds: 600.0
      skip_existing: true                         # don't re-process repos already done
      max_repos: 0                                # 0 = no cap
    neo4j_upload:           { enabled: false }    # loads crawler graph → Neo4j (input_dir/input_filename)
    sparql_upload:          { enabled: false }    # uploads extracted RDF → Oxigraph named graph (…/graph/{YYYY-MM}/hybrid)
    apply_grimoire_projects: { enabled: false }
```

To run a GME-only pass: enable just `metadata_extractor` (point `input_dir` at a crawl's output), then usually `sparql_upload` to land the triples into the Oxigraph named graph for that snapshot (`https://open-pulse.epfl.ch/graph/{YYYY-MM}/hybrid`). A full ingest enables `crawler` → `metadata_extractor` → `neo4j_upload` + `sparql_upload`. After upload, confirm the graph size via `op-collections stats` → `sparql.named_graphs`.

## Run status fields

`status <run_id>` returns `overall` (`running`/`completed`/`failed`), `current_step`, `finished`, `crawler_job_id` (links to op-crawler), a `statuses` map (per step: `done`/`skipped`/`running`/`failed`), `step_stats` (e.g. `metadata_extractor: {success, failed, submitted}`, `sparql_upload: {triples}`), and a `tail` of the log. `runs` lists the same summary across recent runs.

## Notes

- **Mutating endpoints need the admin password.** With only the reader set, `run`/`create`/`stop` return a 403 that tells you exactly that — set `OPENPULSE_ADMIN_AUTH=admin/<password>` in `.env`.
- Runs are **long** (the extractor calls out per repo). Launch with `run`, capture the returned `run_id`, then poll `status` — don't expect a synchronous result.
- `metadata_extractor` `mode: v2` with `v2_agent_runtime: hybrid` is the current production setting (rule-based + agent fallback). `skip_existing: true` makes retries cheap.
- Steps share artifacts via `input_dir`/`output_dir` under `.quest-artifacts/` — a downstream step's `input_dir` must match the upstream step's `output_dir`.
- To **launch and watch a crawl** specifically, use the op-crawler skill; this skill owns extraction + the overall pipeline run.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `http 403: Reader sessions can't trigger mutating endpoints…` | `run`/`create`/`stop` need admin — set `OPENPULSE_ADMIN_AUTH=admin/<password>` in `.env`. |
| `status` shows `overall: running` forever | Long extractor run; keep polling `status <run_id> --tail N`. Check `step_stats` for `submitted` vs `success`/`failed`. |
| a step reads `skipped` | It was `enabled: false` in the quest, or `skip_existing` matched prior output. |
| `quest` returns `404` / empty | Wrong `path` — copy an exact path from `quests`. |
| run produced 0 triples | `metadata_extractor` ran but `sparql_upload` was disabled, or `input_dir` didn't match the crawler's `output_dir`. |

## RAG / semantic search, and the GME agent

The `metadata_extractor` in `v2_agent_runtime: hybrid` mode uses an LLM agent to *write* metadata. But the **same extractor service also serves the RAG retrieval layer**: it indexes every source into per-provider vector stores and exposes `POST /api/extractor/v2/indices/{provider}/search` (embedding similarity + cross-encoder rerank). **That is queryable — use the `op-search` skill.**

Separately, the hub exposes an **AI chat layer** — `/api/ai/chat` (streaming, schema-grounded chat over the stores, backed by `openai/gpt-oss-120b`) and `/api/ai/models` (lists the embedding/reranker models `bge-m3`, `gte-multilingual`, `bge-reranker`). The hub does *not* expose a direct embeddings/vector endpoint (`/api/ai/embeddings|rerank|search|rag` all `404`) — the vector search lives on the extractor service (op-search), not the hub's `/api/ai`. The chat endpoint isn't wrapped by a skill yet — ask if you want an `op-ai` chat skill.
