---
name: query-neo4j
description: Run a Cypher query against the Open Pulse Neo4j instance and get JSON rows back. TRIGGER when the user asks anything that requires reading from the graph database — exploring labels, counting nodes/relationships, listing repositories/contributors/commits, sampling properties, or running a Cypher query they paste in. SKIP for SPARQL/RDF questions (use query-sparql) or log/index questions (use query-opensearch).
---

# Query Neo4j

This skill ships two equivalent scripts that POST Cypher to the hub gateway at `{OPENPULSE_ENDPOINT}/api/databases/cypher/query` over HTTPS. Both read `OPENPULSE_ENDPOINT` and `OPENPULSE_AUTH` (format `user/password`; the username is ignored — the token is what matters) from `.env` at the repo root. The gateway returns `{columns, rows, row_count}`; the scripts flatten that to a JSON array of objects. Reader tokens get a **read-only** transaction — any write clause (`CREATE`/`MERGE`/`DELETE`/`SET`) returns 403.

```
.agents/skills/query-neo4j/
├── query.py       # Python 3, stdlib only
└── query.mjs      # Node 18+, built-in fetch
```

## Identifiers — how this store keys things

Identifier properties hold **full GitHub URLs**, not bare slugs. `query.py` / `query.mjs` warn when a `full_name` or `login` match looks like a slug, because that returns zero rows silently.

| Property | Value form | Example |
|---|---|---|
| `Repo.full_name` | `https://github.com/{owner}/{repo}` | `https://github.com/Biohub/esm` |
| `Repo.owner` | bare slug (**exception**) | `Biohub` |
| `Repo.name` | bare slug | `esm` |
| `Org.login` | `https://github.com/{owner}` | `https://github.com/Biohub` |
| `User.login` | `https://github.com/{login}` | `https://github.com/santiag0m` |
| `RorOrg` | ROR URI | `https://ror.org/014nxkk19` |

No `.git` suffix. Cross-store: SPARQL uses the same repo URL as its subject IRI; CHAOSS and collections take `owner` + `repo` separately; OpenSearch's `repo_name` is a clone URL whose `.git` suffix varies. See `.agents/SKILLS.md` §12.

## Run

> **Plugin install?** If this skill runs from the `open-pulse` plugin instead of a repo checkout, the scripts live under the plugin root — replace the `.agents/skills/` prefix in the commands below with `${CLAUDE_PLUGIN_ROOT}/.agents/skills/`. Credentials are unchanged: a `.env` at your project root (keys as in the template's `.env.example`).

```bash
# Inline Cypher
python .agents/skills/query-neo4j/query.py 'MATCH (n) RETURN labels(n)[0] AS label, count(*) AS n ORDER BY n DESC'

# From stdin
echo 'MATCH (n) RETURN count(n)' | python .agents/skills/query-neo4j/query.py -

# From a file
python .agents/skills/query-neo4j/query.py -f path/to/query.cypher

# Node equivalent (same flags)
node .agents/skills/query-neo4j/query.mjs 'MATCH (n) RETURN count(n)'
```

Output is a JSON array of objects, one per row. Errors print to stderr and exit non-zero — surface the message verbatim to the user, don't pretend success.

## Live schema (verified 2026-07-21)

Four labels (counts as of 2026-07-21):

| Label | Count | What it is |
|---|---|---|
| `Repo`   | ~3.24M | GitHub repositories |
| `User`   | ~596k  | GitHub user accounts |
| `Org`    | ~4,540 | GitHub organisations |
| `RorOrg` | ~2,360 | Research institutions, identified by a ROR URI |

There are *no* `Repository`, `Person`, `Commit`, or `PullRequest` nodes —
**commits live only in OpenSearch** (`git_demo_enriched`), and PRs/issues/
reviews/comments are encoded as **edges**, not nodes.

**Identifier properties hold full GitHub URLs** (not bare slugs):

| Property | Value form |
|---|---|
| `Org.login`      | `https://github.com/<owner>` |
| `User.login`     | `https://github.com/<user>`  |
| `Repo.full_name` | `https://github.com/<owner>/<repo>` |
| `Repo.owner`     | `<owner>` *(still a plain slug, no URL)* |

When matching by login or full_name, **use the full URL literal** — passing
just the slug returns zero rows.

### Relationship types (verified 2026-07-21)

| Type | Direction | Count | Meaning |
|---|---|---|---|
| `STARRED`         | `(User)→(Repo)` | ~4.08M | Stargazer |
| `OWNS`            | `(Org)→(Repo)`  | ~1.89M | Org owns repo |
| `WATCHES`         | `(User)→(Repo)` | ~1.72M | Watcher/subscriber |
| `CONTRIBUTES_TO`  | `(User)→(Repo)` | ~1.32M | Authored commits to repo |
| `FOLLOWS`         | `(User)→(User)` | ~770k  | Social follow |
| `DEPENDS_ON`      | `(Repo)→(Repo)` | ~287k  | Dependency edge between repos |
| `FORK_OF`         | `(Repo)→(Repo)` | ~169k  | Fork lineage |
| `MEMBER_OF`       | `(User)→(Org)`  | ~44k   | GitHub org membership |
| `COMMENTED_ON`    | `(User)→(Repo)` | ~18k   | Issue/PR comment |
| `OPENED_ISSUE`    | `(User)→(Repo)` | ~16k   | Opened an issue |
| `OPENED_PR`       | `(User)→(Repo)` | ~9.9k  | Opened a pull request |
| `REVIEWED_PR`     | `(User)→(Repo)` | ~3.7k  | Reviewed a PR |
| `AFFILIATED_WITH` | `(User)→(RorOrg)` | ~3.4k | Institutional affiliation (ROR) |

Edges carry **no temporal properties** (no per-event timestamps) — they are
plain counts of activity. For commit-level time series use OpenSearch.

PR/issue/review/comment data lives primarily in these edges (OpenSearch's
`github_demo_enriched` has some GitHub-backend docs, but coverage is thin),
so social-engagement metrics should come from Neo4j.

## Useful starter queries

| Goal | Cypher |
|---|---|
| Labels and counts | `MATCH (n) RETURN labels(n)[0] AS label, count(*) AS n ORDER BY n DESC` |
| Relationship types and counts | `MATCH ()-[r]->() RETURN type(r) AS type, count(*) AS n ORDER BY n DESC` |
| Property keys on a label | `MATCH (n:Repo) UNWIND keys(n) AS k RETURN DISTINCT k LIMIT 100` |
| Sample 5 nodes of a label | `MATCH (n:Repo) RETURN n LIMIT 5` |
| Look up an org by URL | `MATCH (o:Org {login: 'https://github.com/sdsc-ordes'}) RETURN o` |
| Look up a repo by URL | `MATCH (r:Repo {full_name: 'https://github.com/sdsc-ordes/open-pulse'}) RETURN r` |
| Repos owned by an org | `MATCH (:Org {login: 'https://github.com/sdsc-ordes'})-[:OWNS]->(r:Repo) RETURN r.full_name LIMIT 20` |
| Everything connected to a repo | `MATCH (r:Repo {full_name:'https://github.com/biopython/biopython'})-[rel]-(n) RETURN type(rel) AS rel, labels(n)[0] AS kind, count(*) AS n ORDER BY n DESC` |
| Social-engagement counts for a repo | `MATCH (u:User)-[rel]->(r:Repo {full_name:$url}) WHERE type(rel) IN ['OPENED_PR','OPENED_ISSUE','REVIEWED_PR','COMMENTED_ON'] RETURN type(rel) AS rel, count(DISTINCT u) AS users, count(*) AS edges` |
| Contributors of a repo | `MATCH (u:User)-[:CONTRIBUTES_TO]->(r:Repo {full_name:$url}) RETURN u.login LIMIT 100` |
| A user's institution(s) | `MATCH (u:User {login:$url})-[:AFFILIATED_WITH]->(o:RorOrg) RETURN o` |

## Recipes learned in practice

- **Owner→repos for several orgs at once**: `MATCH (o:Org)-[:OWNS]->(r:Repo) WHERE o.login IN $logins RETURN o.login, r.full_name` — the basis for org-scoped catalogs.
- **PR/issue/review/comment metrics**: always come from the edge types above. Count `DISTINCT u` for "people" and `count(*)` for "events"; there is no event date to bucket by.
- **`DEPENDS_ON` is large** (~287k). Always scope it to a seed set (`WHERE r.full_name IN $urls`) and add `LIMIT`, or it returns the whole ecosystem.
- **`CONTRIBUTES_TO` coverage is partial — absence is not evidence of absence.** A repo can exist with rich issue/PR/star edges and still have **zero** `CONTRIBUTES_TO`: `Biohub/esm` had 99 `OPENED_ISSUE` and 55 `STARRED` edges but no contributor edges at all, while OpenSearch counted 25 commit authors and SPARQL 17 contributions for the same repo. Never report "no contributors" from Neo4j alone — cross-check OpenSearch (`cardinality(author_uuid)`) or SPARQL (`op:Contribution`). This is why the CHAOSS `contributors` metric skips zeros when laddering across stores.
- **`Repo` nodes carry almost no metadata.** Expect `full_name`, `owner`, `name`, `id`, `platform`, `is_explored` — and typically an *empty* `programming_languages`. There are no stars, forks, description, or license properties. Get repo metadata from SPARQL or `op-collections`, and use Neo4j for the topology.
- **Affiliations**: `(:User)-[:AFFILIATED_WITH]->(:RorOrg)` mirrors the SPARQL `org:hasMembership` data (default graph or `GRAPH <…/graph/{YYYY-MM}/hybrid>`); institutions are ROR-identified in both stores. See `query-sparql` for default vs named-graph modes.
- **Fork detection for honest metrics**: `MATCH (o:Org)-[:OWNS]->(r:Repo)-[:FORK_OF]->(p:Repo) WHERE o.login IN $orgs RETURN r.full_name, p.full_name` gives the vendored-fork set (union it with SPARQL `op:isForkOf`). Exclude those repos from commit/contributor series — a forked `assimp`/`imgui` carries the whole upstream history and can inflate the org's own commit counts several-fold.
- **Repo nodes are thin stubs** (name/owner/id only — no description, stars, or language). Catalogue metadata must come from SPARQL; expect only a subset of crawled repos to be in the metadata graph, and surface the rest as a coverage gap rather than empty columns.

## Conventions

- Always include `LIMIT` on exploratory queries — the graph has millions of nodes.
- Prefer Python `query.py` for one-off shell work; use `query.mjs` when integrating with the web app codebase.
- Do not use the raw Neo4j ports (`:7503` HTTP, `:7504` Bolt) — they are plain HTTP/unencrypted and need separate Neo4j credentials. The gateway is the only supported transport.
