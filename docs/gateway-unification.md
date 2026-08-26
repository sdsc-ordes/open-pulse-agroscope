# Open Pulse gateway unification

Branch `fix/http-endpoints-correction` (2026-07-21 → 2026-07-22): collapses
all Open Pulse store access onto **one HTTPS gateway** instead of separate
per-store hosts, ports, and credentials.

## `refactor: Unify skills endpoint access to https://openpulse.epfl.ch` (`f91711c4cb`)

- **Before:** `NEO4J_HTTP_ENDPOINT`/`NEO4J_AUTH` (`:7503`),
  `SPARQL_ENDPOINT`/`SPARQL_AUTH` (`:7502`),
  `OPENSEARCH_ENDPOINT`/`OPENSEARCH_USERNAME`/`OPENSEARCH_PASSWORD`
  (`:7508` via a Dashboards console proxy, or `:9200` direct) — three
  plain-HTTP/self-signed transports, three credential shapes.
- **After:** every skill derives its URL and token from just
  `OPENPULSE_ENDPOINT` + `OPENPULSE_AUTH`. `.env.example` collapsed from
  ~85 lines of per-store config to one gateway block plus optional
  per-store overrides. Raw store ports are now explicitly unsupported.

| Skill | New transport |
|---|---|
| `query-neo4j` | `POST {OPENPULSE_ENDPOINT}/api/databases/cypher/query` — `{columns, rows, row_count}`. Reader tokens are read-only (write clauses → 403). |
| `query-sparql` | `POST {OPENPULSE_ENDPOINT}/sparql/query`. Default graph is cumulative (~3.3M triples) across monthly `rule-based`/`hybrid` snapshots. |
| `query-opensearch` | `POST {OPENPULSE_ENDPOINT}/api/databases/opensearch/query`, SQL or `--dsl <index>`. Old Dashboards-proxy and direct `:9200` transports removed. |
| `query-chaoss` | Same gateway/token pattern as the others. |

Also: `.claude/settings.json` curl allowlist narrowed to the gateway host
only; `CLAUDE.md`/`.claude/PROJECT.md`/`.claude/SKILLS.md` rewritten to
describe the single-gateway architecture; Neo4j schema doc refreshed with
current cardinalities and the "identifiers are full GitHub URLs, not bare
slugs" convention.

## Follow-up fixes (2026-07-22)

- **`fix: correct .git suffix stripping and pre-3.10 timeout handling`**
  (`9fca7e0ea8`) — `repo-probe.py` used `str.rstrip(".git")`, which strips
  trailing *characters in that set* rather than the literal suffix (e.g.
  `"digit.git"` → `"d"`); switched to an `endswith`+slice check. Also
  widened `except TimeoutError` to `except (TimeoutError, socket.timeout)`
  across the query-*/op-* scripts, since `socket.timeout` only became an
  alias of `TimeoutError` in Python 3.10.
- **`fix: address Copilot review findings on the gateway unification`**
  (`ec0f8b4367`) — corrected a stale comment about `--window` snapping
  behavior; made `query-opensearch` reject non-object DSL bodies instead
  of crashing; closed an injection path in `repo-probe.py`'s
  `normalize_repo_arg` by validating owner/name against a slug charset
  before interpolating into SPARQL/Cypher; aligned the `.env.example`
  placeholder username; rewrote `tools/check-connectivity.mjs` to probe
  through the gateway (verified live, 5/5 checks pass); synced the
  `new-dashboard` skill's env template and Stage 0 instructions to the
  unified credential pair.
- **`feat: enhance query-opensearch and query-chaoss skills with GitHub
  metrics and index discovery`** (`8ba48d2ad0`) — `SKILL.md` for both
  refreshed to the live state as of 2026-07-22 (new GitHub PR/issue
  metrics); `query.py` can now probe and discover existing index names
  instead of requiring them to be known in advance.
