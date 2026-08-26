#!/usr/bin/env bash
# Ensure the named volume mount is writable by node (Docker creates it as root).
set -euo pipefail

CLAUDE_DIR="/home/node/.claude"
mkdir -p "${CLAUDE_DIR}"
chown -R node:node "${CLAUDE_DIR}" 2>/dev/null || true
