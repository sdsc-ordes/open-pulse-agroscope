#!/usr/bin/env python3
"""Send a SPARQL query to the Open Pulse hub gateway (HTTPS).

Reads OPENPULSE_ENDPOINT and OPENPULSE_AUTH (format: user/password;
username ignored, the token is what matters) from .env at the repo root,
or from the environment, and posts to {OPENPULSE_ENDPOINT}/sparql/query.
Set SPARQL_ENDPOINT / SPARQL_AUTH to override the derived values.

Usage:
    python query.py 'SELECT (COUNT(*) AS ?n) WHERE { ?s ?p ?o }'
    python query.py -                          # query from stdin
    python query.py -f path/to/query.rq        # query from file

    # CONSTRUCT/DESCRIBE — switch format to turtle:
    python query.py --accept turtle 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } LIMIT 10'

The default Accept header asks for JSON bindings, which fits SELECT/ASK.
Use --accept {json,csv,xml,turtle} to override. Updates go to /update;
this script only supports /query for safety. Use curl directly if you
need to mutate.
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

ACCEPT_MAP = {
    "json": "application/sparql-results+json",
    "csv": "text/csv",
    "xml": "application/sparql-results+xml",
    "turtle": "text/turtle",
}


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


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("query", nargs="?", help="SPARQL query, or '-' for stdin")
    parser.add_argument("-f", "--file", help="read query from file")
    parser.add_argument("--accept", choices=ACCEPT_MAP, default="json", help="result format (default: json)")
    parser.add_argument("--raw", action="store_true", help="print response body verbatim (default: pretty-print JSON)")
    args = parser.parse_args()

    load_dotenv()
    base = os.environ.get("OPENPULSE_ENDPOINT")
    endpoint = os.environ.get("SPARQL_ENDPOINT") or (base and f"{base.rstrip('/')}/sparql")
    auth = os.environ.get("SPARQL_AUTH") or os.environ.get("OPENPULSE_AUTH")
    if not endpoint or not auth or "/" not in auth:
        print("error: OPENPULSE_ENDPOINT and OPENPULSE_AUTH (user/password) must be set", file=sys.stderr)
        return 2

    user, _, password = auth.partition("/")
    query = read_query(args).strip()
    if not query:
        print("error: empty query", file=sys.stderr)
        return 2

    token = base64.b64encode(f"{user}:{password}".encode()).decode()
    accept = ACCEPT_MAP[args.accept]
    url = f"{endpoint.rstrip('/')}/query"
    body = urllib.parse.urlencode({"query": query}).encode()

    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Basic {token}",
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": accept,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
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

    if args.raw or args.accept != "json":
        sys.stdout.buffer.write(raw)
        if not raw.endswith(b"\n"):
            sys.stdout.write("\n")
        return 0

    payload = json.loads(raw)
    bindings = payload.get("results", {}).get("bindings")
    if bindings is not None:
        # SELECT — flatten {var: {type, value}} to {var: value}
        rows = [{k: v["value"] for k, v in row.items()} for row in bindings]
        json.dump(rows, sys.stdout, indent=2, default=str)
    else:
        # ASK or unrecognized — print as-is
        json.dump(payload, sys.stdout, indent=2, default=str)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
