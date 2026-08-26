#!/usr/bin/env python3
"""Query the Open Pulse OpenSearch cluster through the hub gateway (HTTPS).

Reads OPENPULSE_ENDPOINT and OPENPULSE_AUTH (format: user/password;
username ignored, the token is what matters) from .env at the repo root,
or from the environment, and posts to
{OPENPULSE_ENDPOINT}/api/databases/opensearch/query.

Two modes:

  SQL (default) — OpenSearch SQL plugin dialect; queries must start with
  SELECT, SHOW or DESCRIBE. Index names are the FROM targets.

  DSL (--dsl <index>) — the query argument is a JSON search body sent to
  that index. Use this for aggregations, filters, and anything the SQL
  dialect can't express.

The gateway returns {columns, rows, row_count, raw}; rows are flattened
to a JSON array of objects. For DSL aggregations the full response
envelope is in `raw` — print it with --raw.

Usage:
    python query.py 'SELECT hash, author_date FROM git ORDER BY author_date DESC LIMIT 5'
    python query.py -                        # query from stdin
    python query.py -f path/to/query.sql     # query from file

    python query.py --dsl git_demo_enriched '{"size":0,"aggs":{"repos":{"terms":{"field":"repo_name","size":10}}}}'
    python query.py --dsl git_demo_enriched -f body.json
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
import urllib.request
from pathlib import Path


def load_dotenv() -> None:
    for start in (Path.cwd(), Path(__file__).resolve().parent):
        for parent in [start, *start.parents]:
            env = parent / ".env"
            if env.is_file():
                for raw in env.read_text().splitlines():
                    line = raw.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, _, value = line.partition("=")
                    os.environ.setdefault(key.strip(), value.strip())
                return


def read_query(args: argparse.Namespace) -> str:
    if args.file:
        return Path(args.file).read_text()
    if args.query == "-" or args.query is None:
        return sys.stdin.read()
    return args.query


def _repo_name_values(node) -> list:
    """Collect every value matched against repo_name anywhere in a DSL body."""
    found = []
    if isinstance(node, dict):
        for key, val in node.items():
            if key == "repo_name":
                if isinstance(val, str):
                    found.append(val)
                elif isinstance(val, list):
                    found += [v for v in val if isinstance(v, str)]
                elif isinstance(val, dict) and isinstance(val.get("value"), str):
                    found.append(val["value"])
            else:
                found += _repo_name_values(val)
    elif isinstance(node, list):
        for item in node:
            found += _repo_name_values(item)
    return found


def warn_repo_name(values) -> None:
    """`repo_name` is a clone URL and the .git suffix is NOT guaranteed.

    An exact term match on the wrong form returns 0 hits with no error, so
    flag values that cannot match before the request goes out.
    """
    for v in values:
        if "*" in v or "?" in v:
            continue  # wildcard/regex — matching a family of forms is the point
        if not v.startswith(("http://", "https://")):
            print(
                f"warning: repo_name matched against {v!r}, which is not a clone URL — "
                f"values look like 'https://github.com/owner/repo' (the '.git' suffix varies). "
                "Discover the real key with a wildcard + terms agg first.",
                file=sys.stderr,
            )


def warn_sql_repo_name(sql: str) -> None:
    for m in re.finditer(r"repo_name\s*(?:=|LIKE)\s*'([^']*)'", sql, re.IGNORECASE):
        warn_repo_name([m.group(1)])


# Reader tokens get 403 on SHOW TABLES (needs indices:admin/get), so indices
# cannot be listed — only probed by name. These are the stems GrimoireLab
# naming produces, crossed with the hub's suffix conventions.
DISCOVER_STEMS = [
    "git", "git-aoc", "git-onion",
    "github", "github2", "githubql",
    # GrimoireLab backends use hyphens: github-issue / github-pull / github-repo
    "github-issue", "github-pull", "github-repo",
    "github_issue", "github_pull", "github_repo",
]
DISCOVER_SUFFIXES = ["", "_enriched", "_raw", "_demo_enriched", "_demo_raw"]
# Aliases the hub exposes on top of the physical indices — probing the stems
# above would miss these entirely.
DISCOVER_ALIASES = [
    "github_issues", "github_pull_requests", "github_repositories",
    "git-onion_demo_enriched_all",
]


def discover(post, names) -> int:
    """Probe candidate index names and report the ones that exist."""
    if not names:
        names = []
        for stem in DISCOVER_STEMS:
            for suffix in DISCOVER_SUFFIXES:
                names.append(stem + suffix)
        names += DISCOVER_ALIASES
    seen, ordered = set(), []
    for n in names:
        if n not in seen:
            seen.add(n)
            ordered.append(n)

    print(f"probing {len(ordered)} candidate index names "
          f"(SHOW TABLES is admin-only, so this is the only way to enumerate)…\n")
    found, errors = [], []
    for name in ordered:
        result, err = post({"mode": "sql", "query": f"SELECT count(*) FROM `{name}`"}, quiet=True)
        if err:
            # Missing index is the expected negative; anything else is notable.
            if "IndexNotFound" in err or "no such index" in err.lower() or "can't be found" in err.lower():
                continue
            errors.append((name, err.strip().replace("\n", " ")[:110]))
            continue
        count = result["rows"][0][0] if result.get("rows") else 0
        found.append((name, count))
        print(f"  ✓ {name:34s} {count:>12,} docs")

    if errors:
        print("\n  unexpected errors (not simply 'index missing'):")
        for name, err in errors:
            print(f"    ? {name:32s} {err}")
    print(f"\n{len(found)} indices found")
    return 0 if found else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("query", nargs="?", help="SQL query or DSL JSON body, or '-' for stdin")
    parser.add_argument("-f", "--file", help="read query from file")
    parser.add_argument("--dsl", metavar="INDEX", help="DSL mode: query is a JSON search body for this index")
    parser.add_argument("--discover", nargs="*", metavar="INDEX",
                        help="probe index names and report which exist (no args = built-in candidate list)")
    parser.add_argument("--raw", action="store_true", help="print the gateway response verbatim (incl. `raw` envelope)")
    args = parser.parse_args()

    load_dotenv()
    endpoint = os.environ.get("OPENPULSE_ENDPOINT")
    auth = os.environ.get("OPENPULSE_AUTH")
    if not endpoint or not auth or "/" not in auth:
        print("error: OPENPULSE_ENDPOINT and OPENPULSE_AUTH (user/password) must be set", file=sys.stderr)
        return 2

    user, _, password = auth.partition("/")
    token = base64.b64encode(f"{user}:{password}".encode()).decode()
    url = f"{endpoint.rstrip('/')}/api/databases/opensearch/query"

    def post(payload, quiet=False):
        """Returns (result, error_string). Never raises."""
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode(),
            headers={
                "Authorization": f"Basic {token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read()), None
        except urllib.error.HTTPError as e:
            msg = f"http {e.code}: {e.read().decode(errors='replace')}"
        except urllib.error.URLError as e:
            msg = f"network error: {e.reason}"
        except (TimeoutError, socket.timeout):
            msg = "network error: request timed out"
        if not quiet:
            print(msg, file=sys.stderr)
        return None, msg

    if args.discover is not None:
        return discover(post, args.discover)

    query = read_query(args).strip()
    if not query:
        print("error: empty query", file=sys.stderr)
        return 2

    if args.dsl:
        try:
            dsl_body = json.loads(query)
        except json.JSONDecodeError as e:
            print(f"error: DSL body is not valid JSON: {e}", file=sys.stderr)
            return 2
        if not isinstance(dsl_body, dict):
            print(f"error: DSL body must be a JSON object, got {type(dsl_body).__name__}", file=sys.stderr)
            return 2
        if "index" in dsl_body:
            print(f"warning: DSL body already sets \"index\": {dsl_body['index']!r} — "
                  f"overriding it with --dsl {args.dsl!r}", file=sys.stderr)
        warn_repo_name(_repo_name_values(dsl_body))
        payload = {"mode": "dsl", "query": {**dsl_body, "index": args.dsl}}
    else:
        if not re.match(r"^\s*(SELECT|SHOW|DESCRIBE)\b", query, re.IGNORECASE):
            verb = query.split(None, 1)[0] if query.split() else query
            print(f"error: SQL mode accepts SELECT / SHOW / DESCRIBE, got {verb!r}. "
                  f"For aggregations or filters use DSL mode: --dsl <index> '<json body>'",
                  file=sys.stderr)
            return 2
        warn_sql_repo_name(query)
        payload = {"mode": "sql", "query": query}

    result, err = post(payload)
    if err:
        return 1

    if args.raw:
        json.dump(result, sys.stdout, indent=2, default=str)
    else:
        rows = [dict(zip(result["columns"], r)) for r in result["rows"]]
        json.dump(rows, sys.stdout, indent=2, default=str)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
