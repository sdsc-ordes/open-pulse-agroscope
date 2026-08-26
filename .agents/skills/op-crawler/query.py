#!/usr/bin/env python3
"""Monitor and control the Open Pulse crawler.

The crawler walks GitHub (repos, users, orgs, deps, issues/PRs) into a
graph JSON that later pipeline steps load into Neo4j. A crawl is *launched*
as the `crawler` step of a pipeline quest (see the op-extractor skill); each
launch registers a job here, which this skill lists, inspects, and controls
(pause / resume / cancel / delete).

Reads OPENPULSE_ENDPOINT, OPENPULSE_AUTH (reader, for GET) and
OPENPULSE_ADMIN_AUTH (admin, REQUIRED for pause/resume/cancel/delete) from
.env. Control subcommands use admin creds; without them the server returns
403 telling you to use the admin password.

Read subcommands (reader password):
    jobs                          list all crawler jobs
    job <job_id>                  one job's detail / progress
    frontier-preview              preview the next crawl frontier
    run <job_id>                  pipeline run that owns this crawler job
                                  (alias for op-extractor run-by-job)

Control subcommands (admin password):
    pause <job_id>
    resume <job_id>
    cancel <job_id>
    delete <job_id>

Generic fall-through:
    get <path> [--param k=v ...]

Flags:
    --input-dir DIR        frontier-preview: artifact dir
    --input-filename NAME  frontier-preview: graph json filename
    --sample N             frontier-preview: sample size
    --tail N               run: log tail lines
    --param k=v            extra query param (repeatable)
    --raw                  print body verbatim

Usage:
    python query.py jobs
    python query.py job 8f1c2a9b
    python query.py pause 8f1c2a9b
    python query.py frontier-preview --sample 25
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


def request(method: str, path: str, params=None, admin=False, raw=False) -> int:
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
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Basic {token}", "Accept": "application/json"},
        method=method,
    )
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


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("command")
    p.add_argument("a", nargs="?", help="job_id or path")
    p.add_argument("--input-dir", dest="input_dir")
    p.add_argument("--input-filename", dest="input_filename")
    p.add_argument("--sample", type=int)
    p.add_argument("--tail", type=int)
    p.add_argument("--param", action="append", help="extra query param key=value (repeatable)")
    p.add_argument("--raw", action="store_true")
    args = p.parse_args()

    load_dotenv()
    extra = {}
    for pair in args.param or []:
        k, _, v = pair.partition("=")
        extra[k.strip()] = v.strip()

    c = args.command
    if c == "jobs":
        return request("GET", "/api/crawler/jobs", extra, raw=args.raw)
    if c == "job":
        return request("GET", f"/api/crawler/jobs/{args.a}", extra, raw=args.raw)
    if c == "frontier-preview":
        params = {"input_dir": args.input_dir, "input_filename": args.input_filename, "sample": args.sample, **extra}
        return request("GET", "/api/pipeline/frontier-preview", params, raw=args.raw)
    if c == "run":
        return request("GET", "/api/pipeline/run-by-job", {"job_id": args.a, "tail": args.tail, **extra}, raw=args.raw)
    if c in ("pause", "resume", "cancel"):
        return request("POST", f"/api/crawler/jobs/{args.a}/{c}", extra, admin=True, raw=args.raw)
    if c == "delete":
        return request("DELETE", f"/api/crawler/jobs/{args.a}", extra, admin=True, raw=args.raw)
    if c == "get":
        return request("GET", args.a if args.a.startswith("/") else f"/{args.a}", extra, raw=args.raw)
    print(f"error: unknown command '{c}'", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
