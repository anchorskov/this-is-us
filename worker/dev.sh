#!/bin/bash
# dev.sh - Start wrangler dev with automatic migration application
set -e

cd "$(dirname "$0")"

echo "🚀 Starting wrangler dev with auto-migration setup..."

# Start wrangler dev in the background
wrangler dev --config wrangler.toml --local --persist-to .wrangler/state/v3/d1 &
WRANGLER_PID=$!

# Wait for wrangler to be ready
echo "⏳ Waiting for wrangler dev to start..."
sleep 5

# Apply migrations
echo "📝 Applying migrations..."
echo "yes" | npx wrangler d1 migrations apply WY_DB --local || true
echo "yes" | npx wrangler d1 migrations apply EVENTS_DB --local || true

echo "✅ Migrations applied"
echo "📡 Dev server ready on http://localhost:8788"

# Keep the script running (wrangler will be in background)
wait $WRANGLER_PID
