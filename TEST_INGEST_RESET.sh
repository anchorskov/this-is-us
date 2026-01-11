#!/bin/bash

# Test Ingestion Reset System
# This script demonstrates the hot topics ingestion pipeline with automatic reset

BASE_URL="http://127.0.0.1:8787"
SESSION="2026"

echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║           INGESTION RESET SYSTEM VERIFICATION                             ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"

echo ""
echo "1️⃣  MANUAL RESET TEST: Derived-Only Mode"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESET=$(curl -sS -X POST "$BASE_URL/api/admin/ingest/reset?mode=derived-only")
echo "$RESET" | jq '{
  mode: .mode,
  success: .success,
  tables_cleared: (.cleared | keys),
  row_counts: (.cleared | map_values(.deletedCount))
}'

echo ""
echo "2️⃣  MANUAL RESET TEST: Full-Rebuild Mode"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESET=$(curl -sS -X POST "$BASE_URL/api/admin/ingest/reset?mode=full-rebuild")
echo "$RESET" | jq '{
  mode: .mode,
  success: .success,
  tables_cleared: (.cleared | keys),
  row_counts: (.cleared | map_values(.deletedCount))
}'

echo ""
echo "3️⃣  ENUMERATION WITH AUTOMATIC RESET (force=true)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -sS -X POST "$BASE_URL/api/internal/admin/wyoleg/run" \
  -H "Content-Type: application/json" \
  -d "{\"session\":\"$SESSION\",\"phase\":\"enumerate\",\"limit\":10,\"force\":true}" | jq '{
  reset: {
    executed: (.reset_results != null),
    success: .reset_results.success,
    hot_topics_deleted: .reset_results.cleared.hot_topics.deletedCount,
    ai_tags_deleted: .reset_results.cleared.civic_item_ai_tags.deletedCount
  },
  enumeration: {
    bills_added: .lso_new_bills_added_this_run,
    bills_marked_inactive: .lso_bills_marked_inactive_this_run,
    total_in_lso: .lso_total_items_year
  },
  status: .success
}'

echo ""
echo "4️⃣  FULL INGESTION PIPELINE WITH RESET (phase=all, force=true)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -sS -X POST "$BASE_URL/api/internal/admin/wyoleg/run" \
  -H "Content-Type: application/json" \
  -d "{\"session\":\"$SESSION\",\"phase\":\"all\",\"limit\":3,\"force\":true}" | jq '{
  reset: {
    executed: (.reset_results != null),
    mode: .reset_results.mode,
    timestamp: .reset_results.timestamp,
    cleared_tables: (.reset_results.cleared | keys)
  },
  pipeline: {
    enumerated_new_bills: .lso_new_bills_added_this_run,
    scanned_items: (.items | length),
    topics_created: (.items | map(select(.hot_topic_status == "created")) | length)
  },
  success: .success,
  errors: (.errors | if length > 0 then . else "none" end)
}'

echo ""
echo "5️⃣  VERIFY HOT TOPICS AFTER RESET"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -sS "$BASE_URL/api/hot-topics?session=$SESSION&limit=3" | jq '[.[] | {
  title: .title,
  slug: .slug,
  civic_items: (.civic_items | length),
  avg_confidence: (.civic_items | map(.confidence // 0) | add / length | round | . / 100)
}]'

echo ""
echo "6️⃣  RESPONSE STRUCTURE REFERENCE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Enumeration with automatic reset returns:"
echo ""
echo "  reset_results: {                    # NEW: Auto-reset results (only with force=true)"
echo "    success: true,                    # Reset succeeded"
echo "    mode: 'derived-only',             # Mode used"
echo "    timestamp: '2025-12-21T...',      # When reset occurred"
echo "    cleared: {                        # Rows deleted per table"
echo "      hot_topics: {deletedCount: N},  # Parent table (hot topics)"
echo "      hot_topic_civic_items: {...},   # Child table (relationships)"
echo "      civic_item_ai_tags: {...},      # AI-generated tags"
echo "      civic_item_verification: {...}  # Verification state"
echo "    }"
echo "  },                                  "
echo "  lso_new_bills_added_this_run: N,    # Bills enumerated"
echo "  items: [...],                       # Items scanned/processed"
echo "  errors: []                          # Any errors"
echo ""
echo ""
echo "✅ Ingestion Reset System Test Complete!"
echo ""
