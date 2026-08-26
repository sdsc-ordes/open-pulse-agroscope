---
name: op-crawler
description: Run, monitor, and control the Open Pulse GitHub crawler via the hub's crawler-jobs API — list jobs, inspect a job's progress, pause/resume/cancel/delete a job, preview the next crawl frontier, and resolve a job to its pipeline run. A crawl is launched as the `crawler` step of a pipeline quest. TRIGGER when the user wants to start/run a crawl, check whether a crawl is running or how far it's got, pause/resume/cancel a crawl, or see what the crawler would fetch next. SKIP when they want the extractor / overall pipeline (op-extractor) or to read already-crawled data (query-neo4j / op-collections).
---

# Open Pulse Crawler

The crawler walks GitHub — repos, users, orgs, dependency edges, issues/PRs — into a graph JSON that downstream pipeline steps load into Neo4j. This skill is the **crawler control plane**: list jobs, watch progress, and pause/resume/cancel/delete them.

**Launching a crawl** is done by running a pipeline **quest** with the `crawler` step enabled (see the op-extractor skill) — there's no standalone "create job" endpoint; the quest run registers the job here. Once it's running, monitor and steer it with this skill.

**Auth:** listing/inspecting jobs uses `OPENPULSE_AUTH` (reader password — enough). **Pause/resume/cancel/delete require `OPENPULSE_ADMIN_AUTH` (the admin password)**; the script sends admin creds for those and the hub returns `403 "Reader sessions can't trigger mutating endpoints…"` if it's unset. Both come from `.env`; HTTP Basic, password-only.

```
.agents/skills/op-crawler/
├── query.py       # Python 3, stdlib only
└── query.mjs      # Node 18+, built-in fetch
```

### Open Pulse skill family

| Skill | Reach for it when you need… |
|---|---|
| **op-crawler** *(this one)* | to launch (via a quest) & control GitHub crawl jobs |
| `op-extractor` | to run / monitor the pipeline & git metadata extractor (quests) |
| `op-search` | semantic / vector search (RAG) over the extractor's indices |
| `op-collections` | exact keyword/structured rows from the indexed sources (DuckDB) |
| `query-neo4j` · `query-sparql` · `query-opensearch` | a raw query against one live store |
| `query-chaoss` | a pre-computed CHAOSS metric for a repo/project |

The three `op-*` skills share the same host and `OPENPULSE_*` credentials. Listing/inspecting jobs works with the reader password; **controlling** a job needs the admin password (see below).

## Run

> **Plugin install?** If this skill runs from the `open-pulse` plugin instead of a repo checkout, the scripts live under the plugin root — replace the `.agents/skills/` prefix in the commands below with `${CLAUDE_PLUGIN_ROOT}/.agents/skills/`. Credentials are unchanged: a `.env` at your project root (keys as in the template's `.env.example`).

```bash
# ── Read / monitor (reader password) ──
python .agents/skills/op-crawler/query.py jobs                 # all crawler jobs (id, state, progress)
python .agents/skills/op-crawler/query.py job <job_id>         # one job's detail
python .agents/skills/op-crawler/query.py run <job_id>         # the pipeline run that owns this job (+ log tail with --tail)
python .agents/skills/op-crawler/query.py frontier-preview --sample 25   # what the next round would fetch

# ── Control (admin password) ──
python .agents/skills/op-crawler/query.py pause <job_id>
python .agents/skills/op-crawler/query.py resume <job_id>
python .agents/skills/op-crawler/query.py cancel <job_id>
python .agents/skills/op-crawler/query.py delete <job_id>

# Node equivalent (same subcommands + flags)
node .agents/skills/op-crawler/query.mjs jobs
```

Output is JSON (pretty-printed). Errors print `http <code>: <body>` to stderr and exit non-zero.

## Launching a crawl (via op-extractor)

A `crawler`-step quest looks like this (read a real one with `op-extractor quest <path>`, then clone + `run`):

```yaml
quest:
  name: my-crawl
  steps:
    crawler:
      enabled: true
      use_graphql: true            # GitHub GraphQL API
      seeds:                       # owner/repo seeds the crawl starts from
        - google-deepmind/alphafold
        - biopython/biopython
      max_rounds: 2                # BFS rounds out from the seeds
      crawl_dependencies: true     # follow forward deps (libs each repo uses)
      crawl_dependents: false      # following dependents explodes the blast radius
      crawl_issues: true           # populate issue edges
      crawl_prs: true              # populate PR edges
      min_stars: 0                 # capture small repos
      max_contributors: 100        # cap contributor fan-out per repo
      output_dir: .quest-artifacts/crawler-json-my-crawl
      output_filename: crawler-graph.json
      poll_interval_seconds: 5.0
      timeout_seconds: 10800.0
    metadata_extractor: { enabled: false }   # enable to chain extraction after the crawl
    neo4j_upload:        { enabled: false }   # enable to load the graph into Neo4j
```

Then: `op-extractor run --body '{"path":"<that-quest.yml>"}'` → capture `run_id` → `op-crawler jobs` shows the registered job, and `op-extractor status <run_id>` exposes `crawler_job_id`. Use `run <job_id>` here to jump from a job back to its run log.

## Notes

- **Control actions need the admin password.** Reader-only sessions get a 403 on pause/resume/cancel/delete pointing you to `OPENPULSE_ADMIN_AUTH`.
- `crawl_dependents: true` is expensive — it pulls in everything that depends on a seed; keep it off unless you specifically want the reverse-dependency blast radius.
- `frontier-preview` shows the candidate set for the next round without committing to a crawl — useful to sanity-check `max_rounds`/dep settings before launching.
- `jobs` is empty when nothing is queued or running (`{"jobs":[],"total":0}`); a job appears only while/after a `crawler`-step quest run is active.
- Crawls are long-running (`timeout_seconds` defaults to ~3h); launch, then poll `job <id>` rather than blocking.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `http 403: Reader sessions can't trigger mutating endpoints…` | pause/resume/cancel/delete need admin — set `OPENPULSE_ADMIN_AUTH=admin/<password>` in `.env`. |
| `jobs` returns `{"jobs":[],"total":0}` | Nothing running — a job only appears once a `crawler`-step quest is launched (via op-extractor). |
| Can't find a "create job" command | There isn't one — crawls start as the `crawler` step of a quest; launch with `op-extractor run`, then monitor here. |
| `frontier-preview` errors on `input_dir` | Point `--input-dir`/`--input-filename` at an existing crawl artifact under `.quest-artifacts/`. |
| Crawl seems stuck | Check the owning run's log: `run <job_id> --tail 50` (resolves the job to its pipeline run). |
