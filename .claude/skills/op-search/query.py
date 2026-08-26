#!/usr/bin/env python3
"""Semantic / vector search over the Open Pulse extractor indices (RAG).

The Git Metadata Extractor service (GME API v3) indexes every source into a
per-provider vector store (Qdrant for most) and serves semantic search with
reranking: each hit carries a `vector_score` (embedding similarity) and a
`rerank_score` (cross-encoder). This is the RAG retrieval layer — distinct
from op-collections, which does exact keyword/structured lookups over the
hub's DuckDB mirror.

Reads OPENPULSE_ENDPOINT (base host, e.g. https://openpulse.epfl.ch) and
OPENPULSE_AUTH (user/password) from .env. The skill appends /api/extractor.
HTTP Basic, password-only. All subcommands here are read-only.

Subcommands:
    search <provider> <query>     semantic search (POST); returns ranked hits
    stats <provider>              doc/chunk counts + last_updated for one index
    manifest                      all providers: entity_types, backend, id_shape
    freshness                     per-provider counts + age since last update
    get <path>                    arbitrary GET under /api/extractor

Flags (search):
    --top-k N         max results (default 10)
    --candidate-k N   vector candidates fetched before reranking
    --target T        entity type for multi-entity indices (e.g. orcid -> persons)
    --filter JSON     metadata filter dict (index-specific; Qdrant shape for most)
Flags (general):
    --param k=v       extra query param (repeatable)
    --raw             print body verbatim

Usage:
    python query.py search github_repos "protein structure prediction" --top-k 5
    python query.py search orcid "machine learning EPFL" --target persons
    python query.py search openalex "graph neural networks" --target works --candidate-k 50
    python query.py stats zenodo_records
    python query.py manifest
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

EXTRACTOR_BASE = "/api/extractor"


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


def request(method: str, path: str, params=None, body=None, raw=False) -> int:
    endpoint = os.environ.get("OPENPULSE_ENDPOINT")
    auth = os.environ.get("OPENPULSE_AUTH")
    if not endpoint or not auth or "/" not in auth:
        print("error: OPENPULSE_ENDPOINT and OPENPULSE_AUTH (user/password) must be set", file=sys.stderr)
        return 2
    user, _, password = auth.partition("/")
    url = f"{endpoint.rstrip('/')}{EXTRACTOR_BASE}{path}"
    if params:
        clean = {k: v for k, v in params.items() if v is not None}
        if clean:
            url = f"{url}?{urllib.parse.urlencode(clean)}"
    token = base64.b64encode(f"{user}:{password}".encode()).decode()
    headers = {"Authorization": f"Basic {token}", "Accept": "application/json"}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            out = resp.read()
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
        sys.stdout.buffer.write(out)
        if not out.endswith(b"\n"):
            sys.stdout.write("\n")
        return 0
    try:
        json.dump(json.loads(out), sys.stdout, indent=2, default=str)
        sys.stdout.write("\n")
    except json.JSONDecodeError:
        sys.stdout.buffer.write(out)
        sys.stdout.write("\n")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("command", help="search|stats|manifest|freshness|get")
    p.add_argument("a", nargs="?", help="provider or path")
    p.add_argument("query", nargs="*", help="search query (free text)")
    p.add_argument("--top-k", type=int, dest="top_k")
    p.add_argument("--candidate-k", type=int, dest="candidate_k")
    p.add_argument("--target")
    p.add_argument("--filter", help="metadata filter as JSON object")
    p.add_argument("--sources", action="store_true", help="manifest: include source detail")
    p.add_argument("--param", action="append", help="extra query param key=value (repeatable)")
    p.add_argument("--raw", action="store_true")
    args = p.parse_args()

    load_dotenv()
    extra = {}
    for pair in args.param or []:
        k, _, v = pair.partition("=")
        extra[k.strip()] = v.strip()

    c = args.command
    if c == "search":
        q = " ".join(args.query).strip()
        if not args.a or not q:
            print("error: usage: search <provider> <query>", file=sys.stderr)
            return 2
        body = {"query": q, "top_k": args.top_k, "candidate_k": args.candidate_k, "target": args.target}
        if args.filter:
            body["filter_payload"] = json.loads(args.filter)
        body = {k: v for k, v in body.items() if v is not None}
        return request("POST", f"/v2/indices/{args.a}/search", extra, body=body, raw=args.raw)
    if c == "stats":
        return request("GET", f"/v2/indices/{args.a}/stats", extra, raw=args.raw)
    if c == "manifest":
        return request("GET", "/v2/manifest", {"sources": str(args.sources).lower() if args.sources else None, **extra}, raw=args.raw)
    if c == "freshness":
        return request("GET", "/v2/indices/freshness", extra, raw=args.raw)
    if c == "get":
        path = args.a if args.a.startswith("/") else f"/{args.a}"
        return request("GET", path, extra, raw=args.raw)
    print(f"error: unknown command '{c}'", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
