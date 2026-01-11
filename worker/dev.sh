#!/bin/bash
# dev.sh - Start wrangler dev with automatic migration application
set -e

WORKER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$WORKER_DIR/.config}"
mkdir -p "$XDG_CONFIG_HOME"

cd "$WORKER_DIR"

echo "🚀 Starting wrangler dev with auto-migration setup..."

# Start wrangler dev in the background
./scripts/wr dev --config wrangler.toml --local &
WRANGLER_PID=$!

# Wait for wrangler to be ready
echo "⏳ Waiting for wrangler dev to start..."
sleep 5

# Apply migrations
echo "📝 Applying migrations..."
echo "yes" | ./scripts/wr d1 migrations apply WY_DB --local || true
echo "yes" | ./scripts/wr d1 migrations apply EVENTS_DB --local || true

echo "✅ Migrations applied"
echo "📡 Dev server ready on http://localhost:8788"

# Keep the script running (wrangler will be in background)
wait $WRANGLER_PID
