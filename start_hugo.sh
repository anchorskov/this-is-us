#!/usr/bin/env bash
set -euo pipefail

# Start Hugo dev server on 127.0.0.1:1313 (foreground).
# Run this in its own terminal.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "🔧 Stopping any existing Hugo servers..."
pkill -f "hugo server" >/dev/null 2>&1 || true

echo "🚀 Starting Hugo on http://127.0.0.1:1313"
exec npm run hugo:dev -- --port 1313 --bind 127.0.0.1
