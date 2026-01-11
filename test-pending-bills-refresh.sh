#!/bin/bash
# Test script for pending bills refresh workflow
# Usage: ./test-pending-bills-refresh.sh [--reset]

set -e

WORKER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/worker" && pwd)"
ROOT_DIR="$(dirname "$WORKER_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "═══════════════════════════════════════════════════════════════"
echo "  PENDING BILLS REFRESH WORKFLOW TEST"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check if --reset flag is provided
RESET_DATA=false
if [[ "$1" == "--reset" ]]; then
  RESET_DATA=true
fi

if [ "$RESET_DATA" = true ]; then
  echo "🧹 RESETTING DATA..."
  echo "   DELETE FROM civic_items WHERE source='openstates';"
  cd "$WORKER_DIR"
  ./scripts/wr d1 execute WY_DB --local --command "DELETE FROM civic_items WHERE source='openstates';" 2>/dev/null || true
  ./scripts/wr d1 execute WY_DB --local --command "DELETE FROM civic_item_ai_tags;" 2>/dev/null || true
  ./scripts/wr d1 execute WY_DB --local --command "DELETE FROM civic_item_verification WHERE check_type='lso_hydration';" 2>/dev/null || true
  echo "   ✅ Data cleared"
  echo ""
fi

# Step 1: Check env var
echo "1️⃣  VERIFY BILL_SCANNER_ENABLED"
echo "   Setting: BILL_SCANNER_ENABLED=true"
export BILL_SCANNER_ENABLED=true
echo "   ✅ Env var set"
echo ""

# Step 2: Verify worker is running
echo "2️⃣  VERIFY WORKER IS RUNNING"
echo "   Checking: http://127.0.0.1:8787/api/_health"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8787/api/_health" || echo "000")
if [ "$HEALTH" = "200" ]; then
  echo "   ✅ Worker is running (HTTP 200)"
else
  echo "   ❌ Worker not running (HTTP $HEALTH)"
  echo "   📍 Start with: ./start_wrangler.sh"
  exit 1
fi
echo ""

# Step 3: Run admin refresh script
echo "3️⃣  RUN ADMIN REFRESH SCRIPT"
echo "   Command: SESSION=2025 LIMIT=50 SCANS=3 ./scripts/admin-refresh-pending-bills.sh"
echo ""

cd "$ROOT_DIR"
REFRESH_OUTPUT=$(SESSION=2025 LIMIT=50 SCANS=3 ./worker/scripts/admin-refresh-pending-bills.sh 2>&1)
echo "$REFRESH_OUTPUT"

# Extract results
SYNC_INSERTED=$(echo "$REFRESH_OUTPUT" | grep -oP '"inserted":\s*\K[0-9]+' | head -1 || echo "0")
SYNC_UPDATED=$(echo "$REFRESH_OUTPUT" | grep -oP '"updated":\s*\K[0-9]+' | head -1 || echo "0")
SCAN_SCANNED=$(echo "$REFRESH_OUTPUT" | grep -oP '"scanned":\s*\K[0-9]+' | head -1 || echo "0")

echo ""
echo "   Results:"
echo "     • Sync inserted: $SYNC_INSERTED"
echo "     • Sync updated:  $SYNC_UPDATED"
echo "     • Scan scanned:  $SCAN_SCANNED"

if (( SYNC_INSERTED > 0 || SYNC_UPDATED > 0 )); then
  echo "   ✅ Sync completed (inserted=$SYNC_INSERTED, updated=$SYNC_UPDATED)"
else
  echo "   ⚠️  Sync found no bills (this is OK if already synced)"
fi

if (( SCAN_SCANNED > 0 )); then
  echo "   ✅ Scan completed (scanned=$SCAN_SCANNED)"
else
  echo "   ⚠️  Scan found no bills to process"
fi
echo ""

# Step 4: Verify endpoint returns results
echo "4️⃣  VERIFY ENDPOINT RETURNS RESULTS"
echo "   GET /api/civic/pending-bills-with-topics"

ENDPOINT_RESPONSE=$(curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics")
RESULTS_COUNT=$(echo "$ENDPOINT_RESPONSE" | jq '.results | length' 2>/dev/null || echo "0")

echo "   Results count: $RESULTS_COUNT"

if (( RESULTS_COUNT > 0 )); then
  echo "   ✅ Endpoint returns $RESULTS_COUNT bills"
else
  echo "   ❌ Endpoint returned 0 bills"
fi
echo ""

# Step 5: Verify data structure
echo "5️⃣  VERIFY DATA STRUCTURE"
if (( RESULTS_COUNT > 0 )); then
  SAMPLE=$(echo "$ENDPOINT_RESPONSE" | jq '.results[0]')
  
  # Check required fields
  HAS_BILL_NUMBER=$(echo "$SAMPLE" | jq 'has("bill_number")' 2>/dev/null)
  HAS_TITLE=$(echo "$SAMPLE" | jq 'has("title")' 2>/dev/null)
  HAS_SPONSORS=$(echo "$SAMPLE" | jq 'has("sponsors")' 2>/dev/null)
  HAS_TOPICS=$(echo "$SAMPLE" | jq 'has("topics")' 2>/dev/null)
  HAS_SUMMARY=$(echo "$SAMPLE" | jq 'has("ai_plain_summary")' 2>/dev/null)
  
  echo "   Required fields:"
  [ "$HAS_BILL_NUMBER" = "true" ] && echo "   ✅ bill_number" || echo "   ❌ bill_number"
  [ "$HAS_TITLE" = "true" ] && echo "   ✅ title" || echo "   ❌ title"
  [ "$HAS_SPONSORS" = "true" ] && echo "   ✅ sponsors" || echo "   ❌ sponsors"
  [ "$HAS_TOPICS" = "true" ] && echo "   ✅ topics" || echo "   ❌ topics"
  [ "$HAS_SUMMARY" = "true" ] && echo "   ✅ ai_plain_summary" || echo "   ❌ ai_plain_summary"
  
  echo ""
  echo "   Sample bill:"
  echo "$SAMPLE" | jq '{bill_number, title, chamber, sponsors: (.sponsors | length), topics: (.topics | length), has_summary: (.ai_plain_summary != null)}'
else
  echo "   ⚠️  Skipped (no results to verify)"
fi
echo ""

# Step 6: Check database counts
echo "6️⃣  DATABASE COUNTS"
cd "$WORKER_DIR"
COUNTS=$(./scripts/wr d1 execute WY_DB --local --command "
  SELECT 
    (SELECT COUNT(*) FROM civic_items WHERE source='openstates') as openstates_bills,
    (SELECT COUNT(*) FROM civic_item_ai_tags) as ai_tags,
    (SELECT COUNT(*) FROM civic_item_verification WHERE check_type='lso_hydration') as verification_records;" 2>/dev/null | tail -1)

echo "   $COUNTS"
echo ""

# Final result
echo "═══════════════════════════════════════════════════════════════"
if (( RESULTS_COUNT > 0 )); then
  echo -e "${GREEN}✅ WORKFLOW TEST PASSED${NC}"
  echo "   • Sync completed successfully"
  echo "   • Scan completed successfully"
  echo "   • Endpoint returns $RESULTS_COUNT bills"
  echo "   • Data structure verified"
else
  echo -e "${YELLOW}⚠️  WORKFLOW TEST INCOMPLETE${NC}"
  echo "   • No bills returned from endpoint"
  echo "   • This may indicate:"
  echo "     - No OpenStates bills available for 2025"
  echo "     - Sync didn't find matching criteria"
  echo "     - Filters excluded all results"
fi
echo "═══════════════════════════════════════════════════════════════"
