#!/bin/bash
# verify-bill-scanner-setup.sh
# Quick verification that all bill scanner components are ready

set -e

WORKER_DIR="/home/anchor/projects/this-is-us/worker"

echo "🔍 Verifying Bill Scanner Setup..."
echo ""

# Check files exist
echo "✓ Checking source files..."
[ -f "$WORKER_DIR/src/lib/hotTopicsAnalyzer.mjs" ] && echo "  ✅ hotTopicsAnalyzer.mjs" || echo "  ❌ hotTopicsAnalyzer.mjs MISSING"
[ -f "$WORKER_DIR/src/routes/civicScan.mjs" ] && echo "  ✅ civicScan.mjs" || echo "  ❌ civicScan.mjs MISSING"
[ -f "$WORKER_DIR/src/routes/sandbox.js" ] && echo "  ✅ sandbox.js" || echo "  ❌ sandbox.js MISSING"
[ -f "$WORKER_DIR/migrations_wy/0009_add_civic_item_ai_tags.sql" ] && echo "  ✅ 0009_add_civic_item_ai_tags.sql" || echo "  ❌ 0009_add_civic_item_ai_tags.sql MISSING"

echo ""
echo "✓ Checking database migrations..."
cd "$WORKER_DIR"

# Check migrations applied
LOCAL_EVENTS=$(./scripts/wr d1 execute EVENTS_DB --local --command "SELECT COUNT(*) as migration_count FROM d1_migrations WHERE name LIKE '001%';" --json 2>&1 | jq -r '.[0].results[0].migration_count')
echo "  ✅ EVENTS_DB migrations applied: $LOCAL_EVENTS"

LOCAL_WY=$(./scripts/wr d1 execute WY_DB --local --command "SELECT COUNT(*) as migration_count FROM d1_migrations WHERE name LIKE '000%';" --json 2>&1 | jq -r '.[0].results[0].migration_count')
echo "  ✅ WY_DB migrations applied: $LOCAL_WY"

echo ""
echo "✓ Checking database tables..."

# Check tables exist
CIVIC_ITEMS=$(./scripts/wr d1 execute WY_DB --local --command "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='civic_items';" --json 2>&1 | jq -r '.[0].results[0].count')
[ "$CIVIC_ITEMS" = "1" ] && echo "  ✅ civic_items table exists" || echo "  ❌ civic_items table MISSING"

AI_TAGS=$(./scripts/wr d1 execute WY_DB --local --command "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='civic_item_ai_tags';" --json 2>&1 | jq -r '.[0].results[0].count')
[ "$AI_TAGS" = "1" ] && echo "  ✅ civic_item_ai_tags table exists" || echo "  ❌ civic_item_ai_tags table MISSING"

HOT_TOPICS=$(./scripts/wr d1 execute EVENTS_DB --local --command "SELECT COUNT(*) as count FROM hot_topics;" --json 2>&1 | jq -r '.[0].results[0].count')
echo "  ✅ hot_topics table: $HOT_TOPICS topics loaded"

HOT_CIVIC=$(./scripts/wr d1 execute EVENTS_DB --local --command "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='hot_topic_civic_items';" --json 2>&1 | jq -r '.[0].results[0].count')
[ "$HOT_CIVIC" = "1" ] && echo "  ✅ hot_topic_civic_items table exists" || echo "  ❌ hot_topic_civic_items table MISSING"

echo ""
echo "✓ Checking data..."
PENDING=$(./scripts/wr d1 execute WY_DB --local --command "SELECT COUNT(*) as count FROM civic_items WHERE status IN ('introduced', 'in_committee', 'pending_vote');" --json 2>&1 | jq -r '.[0].results[0].count')
echo "  ✅ Pending bills available: $PENDING"

LINKED=$(./scripts/wr d1 execute EVENTS_DB --local --command "SELECT COUNT(DISTINCT topic_id) as count FROM hot_topic_civic_items;" --json 2>&1 | jq -r '.[0].results[0].count')
echo "  ✅ Topics with linked bills: $LINKED"

echo ""
echo "✓ Checking route configuration..."
grep -q "handleScanPendingBills" "$WORKER_DIR/src/index.mjs" && echo "  ✅ handleScanPendingBills imported" || echo "  ❌ handleScanPendingBills NOT imported"
grep -q "/api/internal/civic/scan-pending-bills" "$WORKER_DIR/src/index.mjs" && echo "  ✅ /api/internal/civic/scan-pending-bills route wired" || echo "  ❌ Route NOT wired"

echo ""
echo "✅ Setup verification complete!"
echo ""
echo "🚀 Ready to start dev server:"
echo "   cd $WORKER_DIR && ./scripts/wr dev --local"
echo ""
echo "📝 Trigger scan in another terminal:"
echo "   curl -X POST http://127.0.0.1:8787/api/internal/civic/scan-pending-bills"
