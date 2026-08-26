#!/usr/bin/env python3
"""Probe every Open Pulse read endpoint for one GitHub repository.

Runs one canonical query per store against the hub HTTPS gateway and
prints what each one knows about the repo, so you can see coverage and
disagreement at a glance. Doubles as a reference implementation for the
server-side proxy a browser app needs (credentials never leave the host).

Endpoints covered: SPARQL, Cypher (Neo4j), OpenSearch, CHAOSS metrics,
collections (DuckDB), semantic search. Crawler and extractor are pipeline
*control* APIs and are deliberately not probed.

Usage:
    python tools/repo-probe.py Biohub/esm
    python tools/repo-probe.py Biohub/esm --github    # also fetch live GitHub for comparison

Reads OPENPULSE_ENDPOINT and OPENPULSE_AUTH from .env at the repo root.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import re
import socket
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

TIMEOUT = 90
_SLUG_RE = re.compile(r"^[A-Za-z0-9_.-]+$")


def load_dotenv() -> None:
    here = Path(__file__).resolve()
    for parent in [here.parent, *here.parents]:
        env = parent / ".env"
        if env.is_file():
            for raw in env.read_text().splitlines():
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())
            return


def call(path: str, *, body=None, method="POST", accept="application/json", form=None):
    """One authenticated request to the hub. Returns parsed JSON or raises RuntimeError."""
    base = os.environ["OPENPULSE_ENDPOINT"].rstrip("/")
    user, _, password = os.environ["OPENPULSE_AUTH"].partition("/")
    token = base64.b64encode(f"{user}:{password}".encode()).decode()
    headers = {"Authorization": f"Basic {token}", "Accept": accept}

    data = None
    if form is not None:
        data = urllib.parse.urlencode(form).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    elif body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(f"{base}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"http {e.code}: {e.read()[:200].decode(errors='replace')}") from None
    except urllib.error.URLError as e:
        raise RuntimeError(f"network error: {e.reason}") from None
    except (TimeoutError, socket.timeout):
        raise RuntimeError(f"timed out after {TIMEOUT}s (hub service may be restarting)") from None


def rows(result) -> list[dict]:
    """Flatten the gateway's {columns, rows} envelope."""
    return [dict(zip(result["columns"], r)) for r in result["rows"]]


def normalize_repo_arg(raw: str) -> tuple[str, str]:
    """Accept `owner/name`, a github.com URL, or either with a .git suffix.

    Every store keys repos differently (full URL / owner+name / clone URL),
    so normalise once here and derive each store's form from the result.
    """
    s = raw.strip()
    for prefix in ("https://github.com/", "http://github.com/", "git@github.com:", "github.com/"):
        if s.lower().startswith(prefix.lower()):
            s = s[len(prefix):]
            break
    s = s.strip("/")
    if s.endswith(".git"):
        s = s[:-4]
    parts = [p for p in s.split("/") if p]
    if len(parts) != 2:
        raise ValueError(
            f"could not read an owner/name pair from {raw!r} — "
            "expected 'owner/name' or 'https://github.com/owner/name'"
        )
    for part in parts:
        if not _SLUG_RE.match(part):
            raise ValueError(
                f"invalid owner/name {part!r} in {raw!r} — "
                "expected only letters, digits, '-', '_', '.'"
            )
    return parts[0], parts[1]


# ── one probe per endpoint ────────────────────────────────────────────────

def probe_sparql(repo_url: str) -> dict:
    """Core metadata. MAX() guards against multi-valued predicates (see query-sparql SKILL.md)."""
    q = f"""
    PREFIX schema: <http://schema.org/>
    PREFIX gme:    <https://openpulse.science/git-metadata-extractor#>
    PREFIX op:     <https://open-pulse.epfl.ch/ontology#>
    SELECT (MAX(?s) AS ?stars) (MAX(?f) AS ?forks) (MAX(?i) AS ?open_issues)
           (SAMPLE(?l) AS ?language) (SAMPLE(?lic) AS ?license) (SAMPLE(?c) AS ?created)
    WHERE {{
      BIND(<{repo_url}> AS ?r)
      OPTIONAL {{ ?r op:githubRepoStars ?s }}   OPTIONAL {{ ?r op:githubRepoForks ?f }}
      OPTIONAL {{ ?r gme:open_issues_count ?i }} OPTIONAL {{ ?r schema:programmingLanguage ?l }}
      OPTIONAL {{ ?r gme:license_name ?lic }}    OPTIONAL {{ ?r schema:dateCreated ?c }}
    }}"""
    res = call("/sparql/query", form={"query": q}, accept="application/sparql-results+json")
    b = res["results"]["bindings"]
    return {k: v["value"] for k, v in b[0].items()} if b else {}


def probe_sparql_contributors(repo_url: str) -> list[dict]:
    q = f"""
    PREFIX schema: <http://schema.org/>
    PREFIX op:     <https://open-pulse.epfl.ch/ontology#>
    SELECT ?author (MIN(?first) AS ?first_contribution) WHERE {{
      ?c a op:Contribution ; schema:author ?author ;
         op:contributionTo <{repo_url}> ; op:firstContributionDate ?first .
    }} GROUP BY ?author ORDER BY ?first_contribution LIMIT 5"""
    res = call("/sparql/query", form={"query": q}, accept="application/sparql-results+json")
    return [{k: v["value"] for k, v in row.items()} for row in res["results"]["bindings"]]


def probe_cypher(repo_url: str) -> dict:
    node = rows(call("/api/databases/cypher/query",
                     body={"query": f"MATCH (r:Repo {{full_name:'{repo_url}'}}) RETURN r LIMIT 1"}))
    edges = rows(call("/api/databases/cypher/query", body={"query": f"""
        MATCH (r:Repo {{full_name:'{repo_url}'}})-[rel]-(n)
        RETURN type(rel) AS rel, labels(n)[0] AS kind, count(*) AS n ORDER BY n DESC"""}))
    owner = rows(call("/api/databases/cypher/query", body={"query": f"""
        MATCH (o:Org)-[:OWNS]->(:Repo {{full_name:'{repo_url}'}}) RETURN o.login AS owner"""}))
    return {"found": bool(node), "properties": node[0]["r"] if node else None,
            "edges": edges, "owner": owner[0]["owner"] if owner else None}


def probe_opensearch(repo_url: str, index="git_demo_enriched") -> dict:
    """Resolve repo_name aliases first — the .git suffix is NOT guaranteed."""
    slug = repo_url.rsplit("/", 1)[-1]
    found = call("/api/databases/opensearch/query", body={"mode": "dsl", "query": {
        "index": index, "size": 0,
        "query": {"wildcard": {"repo_name": f"*/{slug}*"}},
        "aggs": {"names": {"terms": {"field": "repo_name", "size": 20}}}}})
    aliases = [r["names"] for r in rows(found)]
    stripped = [a[:-4] if a.endswith(".git") else a for a in aliases]
    mine = [a for a, s in zip(aliases, stripped) if s.lower().endswith(repo_url.split("github.com/")[-1].lower())]
    if not mine:
        return {"aliases_seen": aliases, "matched": [], "stats": None}

    stats = call("/api/databases/opensearch/query", body={"mode": "dsl", "query": {
        "index": index, "size": 0,
        "query": {"terms": {"repo_name": mine}},
        "aggs": {"commits": {"value_count": {"field": "author_uuid"}},
                 "authors": {"cardinality": {"field": "author_uuid"}},
                 "first": {"min": {"field": "grimoire_creation_date"}},
                 "last": {"max": {"field": "grimoire_creation_date"}},
                 "added": {"sum": {"field": "lines_added"}},
                 "removed": {"sum": {"field": "lines_removed"}},
                 "top_authors": {"terms": {"field": "author_name", "size": 5}}}}})
    agg = stats.get("raw", {}).get("aggregations", {})
    return {"aliases_seen": aliases, "matched": mine, "stats": {
        "commits": agg.get("commits", {}).get("value"),
        "authors": agg.get("authors", {}).get("value"),
        "first_commit": agg.get("first", {}).get("value_as_string"),
        "last_commit": agg.get("last", {}).get("value_as_string"),
        "lines_added": agg.get("added", {}).get("value"),
        "lines_removed": agg.get("removed", {}).get("value"),
        "top_authors": [(b["key"], b["doc_count"]) for b in agg.get("top_authors", {}).get("buckets", [])],
    }}


def probe_chaoss(owner: str, name: str, window: int = 3650) -> dict:
    res = call(f"/api/v1/metrics/chaoss/repositories/github.com/{owner}/{name}/metrics?window={window}",
               method="GET")
    return {"computed_at": res.get("computed_at"), "metric_count": res.get("metric_count"),
            "metrics": {m["slug"]: m.get("value") for m in res.get("metrics", [])}}


def probe_collections(owner: str, name: str) -> dict | None:
    res = call(f"/api/hub/c/github_repos/rows?q={urllib.parse.quote(f'{owner}/{name}')}&size=25",
               method="GET")
    for row in res.get("rows", []):
        if row.get("owner") == owner and row.get("name") == name:
            return {k: row.get(k) for k in
                    ("owner", "name", "stargazers_count", "forks_count", "open_issues_count",
                     "primary_language", "license_spdx", "pushed_at", "ingested_at")}
    return None


def probe_search(query: str, provider="github_repos", top_k=3) -> list[dict]:
    res = call(f"/api/extractor/v2/indices/{provider}/search",
               body={"query": query, "top_k": top_k})
    out = []
    for h in res.get("hits", []):
        p = h.get("payload", {})
        out.append({"score": round(h.get("rerank_score") or h.get("vector_score") or 0, 3),
                    "id": p.get("entity_id") or h.get("id"),
                    "name": p.get("full_name") or p.get("name") or p.get("title")})
    return out


def probe_github(owner: str, name: str) -> dict | None:
    """Live ground truth. Unauthenticated — may hit rate limits."""
    try:
        req = urllib.request.Request(f"https://api.github.com/repos/{owner}/{name}",
                                     headers={"Accept": "application/vnd.github+json",
                                              "User-Agent": "open-pulse-webkit-probe"})
        with urllib.request.urlopen(req, timeout=30) as r:
            d = json.loads(r.read())
        return {k: d.get(k) for k in ("full_name", "stargazers_count", "forks_count",
                                      "open_issues_count", "language", "pushed_at")}
    except Exception as e:
        return {"error": str(e)}


# ── driver ────────────────────────────────────────────────────────────────

def section(title: str) -> None:
    print(f"\n\033[1m{title}\033[0m\n" + "─" * 64)


def run(step, fn, *a, **kw):
    try:
        return fn(*a, **kw)
    except RuntimeError as e:
        print(f"  ✗ {step}: {e}")
        return None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("repo", help="owner/name, e.g. Biohub/esm")
    ap.add_argument("--github", action="store_true", help="also fetch live GitHub for comparison")
    ap.add_argument("--index", default="git_demo_enriched", help="OpenSearch index")
    args = ap.parse_args()

    try:
        owner, name = normalize_repo_arg(args.repo)
    except ValueError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    repo_url = f"https://github.com/{owner}/{name}"

    load_dotenv()
    if not os.environ.get("OPENPULSE_ENDPOINT") or not os.environ.get("OPENPULSE_AUTH"):
        print("error: OPENPULSE_ENDPOINT and OPENPULSE_AUTH must be set in .env", file=sys.stderr)
        return 2

    print(f"\nProbing \033[1m{repo_url}\033[0m via {os.environ['OPENPULSE_ENDPOINT']}")

    section("1. SPARQL  —  POST /sparql/query")
    meta = run("metadata", probe_sparql, repo_url)
    if meta is not None:
        print("  metadata:", json.dumps(meta, indent=2)[:400] if meta else "(no triples)")
    contribs = run("contributions", probe_sparql_contributors, repo_url)
    if contribs is not None:
        print(f"  earliest contributions ({len(contribs)} shown):")
        for c in contribs:
            print(f"    {c['first_contribution'][:10]}  {c['author']}")

    section("2. Cypher / Neo4j  —  POST /api/databases/cypher/query")
    g = run("graph", probe_cypher, repo_url)
    if g:
        print(f"  node found: {g['found']}   owner org: {g['owner']}")
        if g["edges"]:
            print("  edges:")
            for e in g["edges"]:
                print(f"    {e['rel']:16s} {e['kind']:6s} {e['n']}")
        else:
            print("  edges: none")

    section("3. OpenSearch  —  POST /api/databases/opensearch/query  (DSL)")
    os_ = run("commits", probe_opensearch, repo_url, args.index)
    if os_:
        print(f"  repo_name aliases seen: {os_['aliases_seen']}")
        print(f"  matched: {os_['matched']}")
        if os_["stats"]:
            s = os_["stats"]
            print(f"  commits {s['commits']} · authors {s['authors']} · "
                  f"{str(s['first_commit'])[:10]} → {str(s['last_commit'])[:10]}")
            print(f"  churn +{s['lines_added']:.0f} / -{s['lines_removed']:.0f}")
            print(f"  top authors: {', '.join(f'{a} ({n})' for a, n in s['top_authors'])}")

    section("4. CHAOSS  —  GET /api/v1/metrics/chaoss/repositories/…")
    ch = run("metrics", probe_chaoss, owner, name)
    if ch:
        print(f"  {ch['metric_count']} metrics computed at {ch['computed_at']}")
        highlight = ["contributors", "committers", "project_popularity", "technical_fork",
                     "code_lines", "absence_factor", "upstream_dependencies", "release_frequency"]
        for k in highlight:
            if k in ch["metrics"]:
                print(f"    {k:24s} {ch['metrics'][k]}")

    section("5. Collections (DuckDB)  —  GET /api/hub/c/github_repos/rows")
    col = run("row", probe_collections, owner, name)
    print("  " + (json.dumps(col, indent=2).replace("\n", "\n  ") if col else "(no matching row)"))

    section("6. Semantic search  —  POST /api/extractor/v2/indices/github_repos/search")
    hits = run("search", probe_search, f"{name} {meta.get('language','') if meta else ''}".strip())
    if hits:
        for h in hits:
            print(f"    {h['score']:.3f}  {h['name']}  ({h['id']})")

    if args.github:
        section("Ground truth  —  api.github.com")
        gh = probe_github(owner, name)
        print("  " + json.dumps(gh, indent=2).replace("\n", "\n  "))
        if gh and "error" not in gh:
            print("\n  \033[1mstars across sources\033[0m")
            print(f"    github (live)  {gh['stargazers_count']}")
            if meta and meta.get("stars"):
                print(f"    sparql         {meta['stars']}")
            if col:
                print(f"    collections    {col['stargazers_count']}")
            if ch and "project_popularity" in ch["metrics"]:
                print(f"    chaoss         {ch['metrics']['project_popularity']}")
            print("    → stores are crawl snapshots and lag live GitHub by design; date any figure you publish.")

    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
