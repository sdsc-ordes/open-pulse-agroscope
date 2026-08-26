#!/usr/bin/env bash
# Select Playwright MCP config for host vs devcontainer.
#   bash tools/image/docker/setup-mcp.sh host    # stdio + local npx (needs: npx playwright install chromium)
#   bash tools/image/docker/setup-mcp.sh docker  # HTTP → playwright-mcp sidecar on :8931
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MODE="${1:-}"

if [ -z "${MODE}" ]; then
  if [ -f /.dockerenv ]; then
    MODE=docker
  else
    MODE=host
  fi
fi

case "${MODE}" in
  host)
    cp "${REPO_ROOT}/.mcp.host.json" "${REPO_ROOT}/.mcp.json"
    echo "MCP: host mode (.mcp.host.json → .mcp.json)"
    echo "  First-time host setup: npx playwright install chromium"
    ;;
  docker)
    cp "${REPO_ROOT}/.mcp.docker.json" "${REPO_ROOT}/.mcp.json"
    echo "MCP: docker mode (.mcp.docker.json → .mcp.json)"
    echo "  Playwright MCP sidecar expected on http://localhost:8931/mcp"
    ;;
  *)
    echo "usage: $0 [host|docker]" >&2
    exit 1
    ;;
esac
