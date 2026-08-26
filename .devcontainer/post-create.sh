#!/usr/bin/env bash
# Post-create: web app deps, Claude config volume, Playwright MCP config for docker.
set -euo pipefail

NODE_HOME="/home/node"
CLAUDE_DIR="${NODE_HOME}/.claude"

echo "Preparing Claude Code config volume at ${CLAUDE_DIR}..."
# The named volume is created owned by root, but this script runs as node —
# use sudo (node has NOPASSWD sudo) so the chown doesn't abort under set -e.
sudo mkdir -p "${CLAUDE_DIR}"
sudo chown -R node:node "${CLAUDE_DIR}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Playwright MCP: point .mcp.json at the sidecar (stdio npx won't find Chromium here).
bash "${REPO_ROOT}/tools/image/docker/setup-mcp.sh" docker

# The web app lives in src/your-web (scaffold it with your framework of choice).
APP_DIR="${REPO_ROOT}/src/your-web"
if [ -f "${APP_DIR}/package.json" ]; then
  echo "Installing web app dependencies..."
  cd "${APP_DIR}"
  sudo -u node npm install --no-audit --no-fund
else
  echo "No src/your-web/package.json yet — skipping deps. Scaffold your app there first."
fi

cp -n "${REPO_ROOT}/.env.example" "${REPO_ROOT}/.env" 2>/dev/null || true

echo "Post-create complete."
