#!/usr/bin/env bash
set -euo pipefail

# Start wrangler dev on 127.0.0.1:8787 from the worker folder (foreground).
# Run this in its own terminal. If you want to proxy Hugo through wrangler,
# set LOCAL_UPSTREAM (e.g., LOCAL_UPSTREAM=http://127.0.0.1:1313).

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_DIR="${ROOT_DIR}/worker"
WRANGLER_PORT=8787

cd "$WORKER_DIR"

echo "🔧 Stopping any existing wrangler/workerd..."
pkill -f "wrangler dev" >/dev/null 2>&1 || true
pkill -f "workerd serve --binary" >/dev/null 2>&1 || true

CMD=(wrangler dev --local --port "${WRANGLER_PORT}")
if [[ -n "${LOCAL_UPSTREAM:-}" ]]; then
  CMD+=(--local-upstream "${LOCAL_UPSTREAM}")
  echo "🌐 Using upstream: ${LOCAL_UPSTREAM}"
fi

echo "🚀 Starting wrangler on http://127.0.0.1:${WRANGLER_PORT} (cwd: ${WORKER_DIR})"
echo "👉 Command: ${CMD[*]}"
exec "${CMD[@]}"
