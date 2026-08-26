#!/usr/bin/env python3
"""Run a Cypher query against the Open Pulse hub gateway (HTTPS).

Reads OPENPULSE_ENDPOINT and OPENPULSE_AUTH (format: user/password;
username ignored, the token is what matters) from .env at the repo root,
or from the environment, and posts to
{OPENPULSE_ENDPOINT}/api/databases/cypher/query. Prints the rows as
JSON to stdout.

Reader tokens get a read-only Neo4j transaction — any write clause
(CREATE/MERGE/DELETE/SET) returns 403.

Usage:
    python query.py 'MATCH (n) RETURN labels(n)[0] AS label, count(*) AS n'
    python query.py -                          # read query from stdin
    python query.py -f path/to/query.cypher    # read query from file
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
    """Walk up from the CWD, then from this file, to find a .env and merge it into os.environ."""
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


# Identifier properties hold FULL GitHub URLs, not bare slugs. Matching
# `full_name:'owner/repo'` is the single most common way to get a silent
# empty result, so warn before the query is sent.
_URL_PROPS = re.compile(
    r"\b(full_name|login)\b\s*:\s*(['\"])(?P<value>[^'\"]*)\2"
)


def warn_bare_identifiers(cypher: str) -> None:
    for m in _URL_PROPS.finditer(cypher):
        value = m.group("value")
        if value and not value.startswith(("http://", "https://")):
            print(
                f"warning: {m.group(1)} matched against {value!r}, which is not a full URL — "
                f"identifiers in this graph are full GitHub URLs "
                f"(try 'https://github.com/{value.lstrip('/')}'). "
                "This query will likely return zero rows.",
                file=sys.stderr,
            )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("query", nargs="?", help="Cypher query, or '-' for stdin")
    parser.add_argument("-f", "--file", help="read query from file")
    args = parser.parse_args()

    load_dotenv()
    endpoint = os.environ.get("OPENPULSE_ENDPOINT")
    auth = os.environ.get("OPENPULSE_AUTH")
    if not endpoint or not auth or "/" not in auth:
        print("error: OPENPULSE_ENDPOINT and OPENPULSE_AUTH (user/password) must be set", file=sys.stderr)
        return 2

    user, _, password = auth.partition("/")
    cypher = read_query(args).strip()
    if not cypher:
        print("error: empty query", file=sys.stderr)
        return 2
    warn_bare_identifiers(cypher)

    body = json.dumps({"query": cypher}).encode()
    token = base64.b64encode(f"{user}:{password}".encode()).decode()
    url = f"{endpoint.rstrip('/')}/api/databases/cypher/query"
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Basic {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            payload = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"http {e.code}: {e.read().decode(errors='replace')}", file=sys.stderr)
        return 1
    except urllib.error.URLError as e:
        print(f"network error: {e.reason}", file=sys.stderr)
        return 1
    except (TimeoutError, socket.timeout):
        print("network error: request timed out", file=sys.stderr)
        return 1

    rows = [dict(zip(payload["columns"], r)) for r in payload["rows"]]
    json.dump(rows, sys.stdout, indent=2, default=str)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
