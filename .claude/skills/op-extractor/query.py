#!/usr/bin/env python3
"""Drive the Open Pulse pipeline ("quests") — run & monitor the git metadata
extractor and the other pipeline steps.

A *quest* is a YAML recipe with up to ~7 steps (crawler, frontier_extend,
metadata_extractor, neo4j_upload, sparql_upload, apply_grimoire_projects,
archive_outputs), each independently enable-able. The git metadata
extractor is the `metadata_extractor` step. Quests run via /api/pipeline
and emit a run_id you poll for status.

Reads OPENPULSE_ENDPOINT, OPENPULSE_AUTH (reader, for GET/monitoring) and
OPENPULSE_ADMIN_AUTH (admin, REQUIRED for run/create/stop) from .env.
Mutating subcommands use the admin creds automatically; if
OPENPULSE_ADMIN_AUTH is unset they fall back to the reader creds and the
server returns a 403 explaining you need the admin password.

Read subcommands (reader password):
    quests                        list quest recipes on disk
    quest <path>                  read one quest's YAML + summary
    runs [--limit N]              list recent runs
    status <run_id> [--tail N]    run status + step stats + log tail
    run-by-job <job_id> [--tail N]   resolve a crawler job_id to its run
    archives                      list archived run outputs

Mutating subcommands (admin password):
    run --body <json|@file>       POST /api/pipeline/run   (e.g. {"path": "<quest.yml>"})
    create --body <json|@file>    POST /api/pipeline/create (new quest from content)
    stop <run_id> [--force]       POST /api/pipeline/run-stop

Generic fall-through:
    get <path> [--param k=v ...]
    post <path> --body <json|@file>

Usage:
    python query.py quests
    python query.py quest /open-pulse/open-pulse/data/quests/gme-hybrid-all.yml
    python query.py runs --limit 10
    python query.py status 440f5d1fd999 --tail 20
    python query.py run --body '{"path":"/open-pulse/open-pulse/data/quests/gme-hybrid-all.yml"}'
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


def request(method: str, path: str, params=None, body=None, admin=False, raw=False) -> int:
    endpoint = os.environ.get("OPENPULSE_ENDPOINT")
    auth = os.environ.get("OPENPULSE_ADMIN_AUTH") if admin else None
    auth = auth or os.environ.get("OPENPULSE_AUTH")
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
    headers = {"Authorization": f"Basic {token}", "Accept": "application/json"}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
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


def read_body(spec: str | None):
    if spec is None:
        return None
    if spec.startswith("@"):
        return json.loads(Path(spec[1:]).read_text())
    return json.loads(spec)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("command")
    p.add_argument("a", nargs="?", help="path / run_id / job_id")
    p.add_argument("--limit", type=int)
    p.add_argument("--tail", type=int)
    p.add_argument("--force", action="store_true")
    p.add_argument("--body", help="JSON string or @file for POST")
    p.add_argument("--param", action="append", help="extra query param key=value (repeatable)")
    p.add_argument("--raw", action="store_true")
    args = p.parse_args()

    load_dotenv()
    extra = {}
    for pair in args.param or []:
        k, _, v = pair.partition("=")
        extra[k.strip()] = v.strip()

    c = args.command
    if c == "quests":
        return request("GET", "/api/pipeline/quests", extra, raw=args.raw)
    if c == "quest":
        return request("GET", "/api/pipeline/quest", {"path": args.a, **extra}, raw=args.raw)
    if c == "runs":
        return request("GET", "/api/pipeline/runs", {"limit": args.limit, **extra}, raw=args.raw)
    if c == "status":
        return request("GET", "/api/pipeline/run-status", {"run_id": args.a, "tail": args.tail, **extra}, raw=args.raw)
    if c == "run-by-job":
        return request("GET", "/api/pipeline/run-by-job", {"job_id": args.a, "tail": args.tail, **extra}, raw=args.raw)
    if c == "archives":
        return request("GET", "/api/pipeline/archives", extra, raw=args.raw)
    if c == "run":
        return request("POST", "/api/pipeline/run", extra, body=read_body(args.body), admin=True, raw=args.raw)
    if c == "create":
        return request("POST", "/api/pipeline/create", extra, body=read_body(args.body), admin=True, raw=args.raw)
    if c == "stop":
        return request("POST", "/api/pipeline/run-stop", {"run_id": args.a, "force": str(args.force).lower(), **extra}, admin=True, raw=args.raw)
    if c == "get":
        return request("GET", args.a if args.a.startswith("/") else f"/{args.a}", extra, raw=args.raw)
    if c == "post":
        return request("POST", args.a if args.a.startswith("/") else f"/{args.a}", extra, body=read_body(args.body), admin=True, raw=args.raw)
    print(f"error: unknown command '{c}'", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
