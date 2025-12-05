#!/usr/bin/env bash
set -euo pipefail

# Local dev helper: runs Hugo on 1313 and wrangler dev on 8787 with upstream to Hugo.
# Usage: ./start_local.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HUGO_DIR="${ROOT_DIR}"
WORKER_DIR="${ROOT_DIR}/worker"
UPSTREAM_HOST="127.0.0.1"
UPSTREAM_PORT="1313"
UPSTREAM="http://${UPSTREAM_HOST}:${UPSTREAM_PORT}"
WRANGLER_PORT=8787

# Control whether wrangler forwards to Hugo.
# Default: NO upstream (API on 8787, Hugo on 1313). Set USE_UPSTREAM=1 to proxy through wrangler.
USE_UPSTREAM="${USE_UPSTREAM:-0}"

# Best effort: stop any existing Hugo/wrangler instances to avoid port collisions.
echo "🔎 Checking for existing Hugo/wrangler dev processes..."
pkill -f "hugo server" >/dev/null 2>&1 || true
pkill -f "wrangler dev" >/dev/null 2>&1 || true
pkill -f "workerd serve --binary" >/dev/null 2>&1 || true

echo "🔧 Starting Hugo (npm run hugo:dev -- --port ${UPSTREAM_PORT} --bind ${UPSTREAM_HOST}) (cwd: ${HUGO_DIR})..."
(cd "$HUGO_DIR" && npm run hugo:dev -- --port "${UPSTREAM_PORT}" --bind "${UPSTREAM_HOST}" > /tmp/hugo-dev.log 2>&1) &
HUGO_PID=$!

cleanup() {
  echo "🛑 Stopping Hugo (PID ${HUGO_PID})..."
  kill "${HUGO_PID}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "🌐 Starting wrangler dev on ${WRANGLER_PORT} (cwd: ${WORKER_DIR})..."
(cd "$WORKER_DIR" && \
  if [[ "${USE_UPSTREAM}" == "1" ]]; then
    echo "🌐 Using upstream ${UPSTREAM} (API + assets via wrangler)";
    wrangler dev --local --port "${WRANGLER_PORT}" --local-upstream "${UPSTREAM}";
  else
    echo "🌐 No upstream (API on ${WRANGLER_PORT}, Hugo on ${UPSTREAM_PORT} directly)";
    wrangler dev --local --port "${WRANGLER_PORT}";
  fi)
