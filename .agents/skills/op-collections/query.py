#!/usr/bin/env python3
"""Read the Open Pulse hub's indexed collections ("indices") and store stats.

The hub indexes its source data into ~50 DuckDB-backed collections
(github_repos, huggingface_models, zenodo_records, orcid_*, ror_*, …).
This skill browses, searches, and exports them, plus the cross-store
counts at /api/stats/. All read-only — the reader password is enough.

Reads OPENPULSE_ENDPOINT (base URL) and OPENPULSE_AUTH (user/password)
from .env at the repo root, or from the environment. HTTP Basic,
password-only (username ignored).

Subcommands:
    stats                         cross-store counts + named graphs + duckdb sizes
    cstats <name>                 one collection: headline stats + searchable columns
    rows <name>                   page through a collection's rows
    export <name>                 export a collection (raw body: csv or json)
    get <path>                    arbitrary GET fall-through (path under the host)

Flags:
    --q TEXT        full-text filter (rows/export)
    --sort COL      sort column (rows/export)
    --page N        page number (rows; default 1)
    --size N        page size (rows; default 50)
    --fmt FMT       export format: csv | json (export; default csv)
    --param k=v     extra raw query param (repeatable)
    --raw           print body verbatim (forced for export)

Usage:
    python query.py stats
    python query.py cstats github_repos
    python query.py rows github_repos --q "deep learning" --size 20
    python query.py export huggingface_models --fmt json --q epfl > models.json
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import socket
import sys
import urllib.error
import urllib.parse
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


def http_get(path: str, params: dict[str, str] | None, raw: bool) -> int:
    endpoint = os.environ.get("OPENPULSE_ENDPOINT")
    auth = os.environ.get("OPENPULSE_AUTH")
    if not endpoint or not auth or "/" not in auth:
        print("error: OPENPULSE_ENDPOINT and OPENPULSE_AUTH (user/password) must be set", file=sys.stderr)
        return 2
    user, _, password = auth.partition("/")
    url = f"{endpoint.rstrip('/')}{path}"
    if params:
        clean = {k: v for k, v in params.items() if v is not None}
        if clean:
            url = f"{url}?{urllib.parse.urlencode(clean)}"
    token = base64.b64encode(f"{user}:{password}".encode()).decode()
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Basic {token}", "Accept": "application/json"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            body = resp.read()
    except urllib.error.HTTPError as e:
        print(f"http {e.code}: {e.read().decode(errors='replace')}", file=sys.stderr)
        return 1
    except urllib.error.URLError as e:
        print(f"network error: {e.reason}", file=sys.stderr)
        return 1
    except (TimeoutError, socket.timeout):
        print("network error: request timed out", file=sys.stderr)
        return 1
    if raw:
        sys.stdout.buffer.write(body)
        if not body.endswith(b"\n"):
            sys.stdout.write("\n")
        return 0
    try:
        json.dump(json.loads(body), sys.stdout, indent=2, default=str)
        sys.stdout.write("\n")
    except json.JSONDecodeError:
        sys.stdout.buffer.write(body)
        sys.stdout.write("\n")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("command", help="stats|cstats|rows|export|get")
    p.add_argument("a", nargs="?", help="collection name or path")
    p.add_argument("--q", help="full-text filter")
    p.add_argument("--sort", help="sort column")
    p.add_argument("--page", type=int, help="page number (rows)")
    p.add_argument("--size", type=int, help="page size (rows)")
    p.add_argument("--fmt", default="csv", help="export format: csv|json")
    p.add_argument("--param", action="append", help="extra raw query param key=value (repeatable)")
    p.add_argument("--raw", action="store_true", help="print body verbatim")
    args = p.parse_args()

    load_dotenv()
    extra = {}
    for pair in args.param or []:
        k, _, v = pair.partition("=")
        extra[k.strip()] = v.strip()

    cmd = args.command
    if cmd == "stats":
        return http_get("/api/stats/", extra, args.raw)
    if cmd == "cstats":
        return http_get(f"/api/hub/c/{args.a}/stats", extra, args.raw)
    if cmd == "rows":
        params = {"q": args.q, "sort": args.sort, "page": args.page, "size": args.size, **extra}
        return http_get(f"/api/hub/c/{args.a}/rows", params, args.raw)
    if cmd == "export":
        params = {"q": args.q, "sort": args.sort, "fmt": args.fmt, **extra}
        return http_get(f"/api/hub/c/{args.a}/export", params, True)
    if cmd == "get":
        path = args.a if args.a.startswith("/") else f"/{args.a}"
        return http_get(path, extra, args.raw)
    print(f"error: unknown command '{cmd}'", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
