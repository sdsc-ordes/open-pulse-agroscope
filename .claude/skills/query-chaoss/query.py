#!/usr/bin/env python3
"""Query the Open Pulse CHAOSS Metrics API.

All endpoints are GET -> JSON, computed live per repository or per
GrimoireLab project. Reads OPENPULSE_ENDPOINT (base URL, e.g.
https://openpulse.epfl.ch) and OPENPULSE_AUTH (format: user/password) from
.env at the repo root, or from the environment; CHAOSS_ENDPOINT /
CHAOSS_AUTH override them if set. Auth is HTTP Basic; the username is
ignored, only the token matters (a reader token is enough for every
query here).

Subcommands:
    catalogue                         all 35 metric specs (static)
    topics                            the 3 buckets + counts
    spec <slug>                       one metric spec
    projects                          list GrimoireLab projects
    repo <owner> <repo> [slug]        per-repository metrics (all, or one)
    project <project> [slug]          per-project metrics (all, or one)
    project-repos <project>           member repos of a project
    get <path>                        arbitrary path fall-through

Query-param flags (apply where the API accepts them):
    --window N        snaps to 30/90/180/365/730/1825/3650 (default 365)
    --include a,b,c   add traces, recipes, and/or series to metric payloads
    --refresh         (project endpoints) bypass the 30-min aggregation cache
    --category X      Community|Popularity|Quality — filter catalogue/lists
    --param k=v       extra raw query param (repeatable)

Usage:
    python query.py topics
    python query.py spec contributors
    python query.py repo sdsc-ordes gimie contributors --window 730 --include traces
    python query.py project bioeng --refresh
    python query.py get repositories/github.com/sdsc-ordes/gimie/metrics
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

CHAOSS_PATH = "/api/v1/metrics/chaoss"


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


def normalize_repo(args: argparse.Namespace) -> None:
    """CHAOSS keys repos as SEPARATE owner + repo path segments — not a URL, not a slug.

    Accept the forms people actually type and rewrite them in place, so
    `repo https://github.com/Biohub/esm` and `repo Biohub/esm` both work
    instead of 404-ing on a path containing 'None'.
    """
    if args.command != "repo" or not args.a:
        return
    owner = args.a.strip()
    for prefix in ("https://github.com/", "http://github.com/", "github.com/"):
        if owner.lower().startswith(prefix):
            owner = owner[len(prefix):]
            break
    owner = owner.rstrip("/")
    if owner.endswith(".git"):
        owner = owner[:-4]

    if "/" in owner:
        # A combined "owner/repo" was passed as one argument. Split it and
        # shift any later positionals right so `repo owner/name slug` works.
        head, _, tail = owner.partition("/")
        if args.b and args.c:
            print(f"error: ambiguous repo arguments: {args.a!r} plus {args.b!r} and {args.c!r}", file=sys.stderr)
            raise SystemExit(2)
        if args.b and not args.c:
            args.c = args.b          # the old b was really the metric slug
        args.a, args.b = head, tail
    else:
        args.a = owner

    if not args.b:
        print("error: `repo` needs an owner and a repo name — e.g. "
              "`repo Biohub esm`, `repo Biohub/esm`, or a full github.com URL", file=sys.stderr)
        raise SystemExit(2)
    if "/" in args.b:
        print(f"error: repo name must not contain '/': {args.b!r}", file=sys.stderr)
        raise SystemExit(2)


def build_path(args: argparse.Namespace) -> str:
    cmd = args.command
    if cmd == "catalogue":
        return CHAOSS_PATH
    if cmd == "topics":
        return f"{CHAOSS_PATH}/topics"
    if cmd == "spec":
        return f"{CHAOSS_PATH}/metrics/{args.a}"
    if cmd == "projects":
        return f"{CHAOSS_PATH}/projects"
    if cmd == "repo":
        base = f"{CHAOSS_PATH}/repositories/github.com/{args.a}/{args.b}/metrics"
        return f"{base}/{args.c}" if args.c else base
    if cmd == "project":
        base = f"{CHAOSS_PATH}/projects/{args.a}/metrics"
        return f"{base}/{args.b}" if args.b else base
    if cmd == "project-repos":
        return f"{CHAOSS_PATH}/projects/{args.a}/repositories"
    if cmd == "get":
        p = args.a
        if p.startswith("/"):
            return p
        return f"{CHAOSS_PATH}/{p.lstrip('/')}"
    raise SystemExit(f"unknown command: {cmd}")


WINDOW_MIN, WINDOW_MAX = 7, 3650
WINDOW_BUCKETS = (30, 90, 180, 365, 730, 1825, 3650)


def build_query(args: argparse.Namespace) -> dict[str, str]:
    q: dict[str, str] = {}
    if args.window is not None:
        # The API 422s outside 7–3650 and snaps to the nearest bucket inside
        # it (ties round down). Fail fast locally with a useful message, and
        # warn when the effective window won't be the one that was asked for.
        if not WINDOW_MIN <= args.window <= WINDOW_MAX:
            print(f"error: --window must be between {WINDOW_MIN} and {WINDOW_MAX} days, got {args.window}",
                  file=sys.stderr)
            raise SystemExit(2)
        # Server snaps to the NEAREST bucket, ties rounding down
        # (verified 2026-07-21: 400→365, 600→730, 60→30).
        effective = min(WINDOW_BUCKETS, key=lambda b: (abs(b - args.window), b))
        if effective != args.window:
            print(f"warning: --window {args.window} snaps to {effective} days "
                  f"(buckets: {', '.join(map(str, WINDOW_BUCKETS))}); "
                  f"the response reports the effective value in `window_days`", file=sys.stderr)
        q["window"] = str(args.window)
    if args.include:
        q["include"] = args.include
    if args.refresh:
        q["refresh"] = "1"
    if args.category:
        q["category"] = args.category
    for pair in args.param or []:
        k, _, v = pair.partition("=")
        q[k.strip()] = v.strip()
    return q


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("command", help="catalogue|topics|spec|projects|repo|project|project-repos|get")
    parser.add_argument("a", nargs="?", help="first positional (slug/owner/project/path)")
    parser.add_argument("b", nargs="?", help="second positional (repo / project slug)")
    parser.add_argument("c", nargs="?", help="third positional (repo slug)")
    parser.add_argument("--window", type=int, help="window in days (snaps to 30/90/180/365/730/1825/3650)")
    parser.add_argument("--include", help="comma list: traces,recipes,series")
    parser.add_argument("--refresh", action="store_true", help="bypass project aggregation cache")
    parser.add_argument("--category", choices=["Community", "Popularity", "Quality"], help="filter catalogue/lists")
    parser.add_argument("--param", action="append", help="extra raw query param key=value (repeatable)")
    parser.add_argument("--raw", action="store_true", help="print response body verbatim (no pretty-print)")
    args = parser.parse_args()

    load_dotenv()
    endpoint = os.environ.get("CHAOSS_ENDPOINT") or os.environ.get("OPENPULSE_ENDPOINT")
    auth = os.environ.get("CHAOSS_AUTH") or os.environ.get("OPENPULSE_AUTH")
    if not endpoint or not auth or "/" not in auth:
        print("error: OPENPULSE_ENDPOINT and OPENPULSE_AUTH (user/password) must be set", file=sys.stderr)
        return 2

    user, _, password = auth.partition("/")
    normalize_repo(args)
    path = build_path(args)
    query = build_query(args)
    url = f"{endpoint.rstrip('/')}{path}"
    if query:
        url = f"{url}?{urllib.parse.urlencode(query)}"

    token = base64.b64encode(f"{user}:{password}".encode()).decode()
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Basic {token}", "Accept": "application/json"},
        method="GET",
    )

    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as e:
        print(f"http {e.code}: {e.read().decode(errors='replace')}", file=sys.stderr)
        return 1
    except urllib.error.URLError as e:
        print(f"network error: {e.reason}", file=sys.stderr)
        return 1
    except (TimeoutError, socket.timeout):
        print("network error: request timed out", file=sys.stderr)
        return 1

    if args.raw:
        sys.stdout.buffer.write(raw)
        if not raw.endswith(b"\n"):
            sys.stdout.write("\n")
        return 0

    payload = json.loads(raw)
    json.dump(payload, sys.stdout, indent=2, default=str)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
