#!/bin/bash

# Validate Ingestion Reset System Health
# Run this to verify the reset system is working correctly

BASE_URL="http://127.0.0.1:8787"
PASS=0
FAIL=0

echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║              INGESTION RESET SYSTEM HEALTH CHECK                          ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo ""

# Test 1: Admin endpoint reachable
echo "TEST 1: Admin Reset Endpoint Reachable"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/admin/ingest/reset?mode=derived-only")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  SUCCESS=$(echo "$BODY" | jq -r '.success' 2>/dev/null)
  if [ "$SUCCESS" = "true" ]; then
    echo "✅ PASS: Endpoint returns 200 with success=true"
    ((PASS++))
  else
    echo "❌ FAIL: HTTP 200 but success=$SUCCESS"
    ((FAIL++))
  fi
else
  echo "❌ FAIL: HTTP $HTTP_CODE (expected 200)"
  ((FAIL++))
fi

# Test 2: Reset response structure
echo ""
echo "TEST 2: Reset Response Structure"
RESET=$(curl -s -X POST "$BASE_URL/api/admin/ingest/reset?mode=derived-only")
HAS_MODE=$(echo "$RESET" | jq 'has("mode")' 2>/dev/null)
HAS_TIMESTAMP=$(echo "$RESET" | jq 'has("timestamp")' 2>/dev/null)
HAS_CLEARED=$(echo "$RESET" | jq 'has("cleared")' 2>/dev/null)

if [ "$HAS_MODE" = "true" ] && [ "$HAS_TIMESTAMP" = "true" ] && [ "$HAS_CLEARED" = "true" ]; then
  echo "✅ PASS: Response has mode, timestamp, cleared fields"
  ((PASS++))
else
  echo "❌ FAIL: Missing required response fields"
  echo "   mode=$HAS_MODE, timestamp=$HAS_TIMESTAMP, cleared=$HAS_CLEARED"
  ((FAIL++))
fi

# Test 3: Cleared tables present
echo ""
echo "TEST 3: Required Tables in Cleared List"
CLEARED_TABLES=$(echo "$RESET" | jq '.cleared | keys' 2>/dev/null)
HAS_HOT_TOPICS=$(echo "$CLEARED_TABLES" | grep -q "hot_topics" && echo "true" || echo "false")
HAS_AI_TAGS=$(echo "$CLEARED_TABLES" | grep -q "civic_item_ai_tags" && echo "true" || echo "false")
HAS_CIVIC_ITEMS=$(echo "$CLEARED_TABLES" | grep -q "hot_topic_civic_items" && echo "true" || echo "false")

if [ "$HAS_HOT_TOPICS" = "true" ] && [ "$HAS_AI_TAGS" = "true" ] && [ "$HAS_CIVIC_ITEMS" = "true" ]; then
  echo "✅ PASS: All required tables in cleared list"
  echo "   Tables: $(echo "$CLEARED_TABLES" | jq -r '.[]' | tr '\n' ', ' | sed 's/,$//')"
  ((PASS++))
else
  echo "❌ FAIL: Missing required tables"
  echo "   hot_topics=$HAS_HOT_TOPICS, civic_item_ai_tags=$HAS_AI_TAGS, hot_topic_civic_items=$HAS_CIVIC_ITEMS"
  ((FAIL++))
fi

# Test 4: Full-rebuild mode
echo ""
echo "TEST 4: Full-Rebuild Mode Works"
RESET_FULL=$(curl -s -X POST "$BASE_URL/api/admin/ingest/reset?mode=full-rebuild")
MODE=$(echo "$RESET_FULL" | jq -r '.mode' 2>/dev/null)
HAS_SOURCES=$(echo "$RESET_FULL" | jq '.cleared | keys | map(select(. == "civic_item_sources")) | length' 2>/dev/null)

if [ "$MODE" = "full-rebuild" ] && [ "$HAS_SOURCES" -gt 0 ]; then
  echo "✅ PASS: Full-rebuild mode returns civic_item_sources"
  ((PASS++))
else
  echo "❌ FAIL: Full-rebuild mode missing civic_item_sources"
  ((FAIL++))
fi

# Test 5: Enumeration with auto-reset
echo ""
echo "TEST 5: Enumeration with Auto-Reset (force=true)"
ENUM=$(curl -s -X POST "$BASE_URL/api/internal/admin/wyoleg/run" \
  -H "Content-Type: application/json" \
  -d '{"session":"2026","phase":"enumerate","limit":2,"force":true}')
HAS_RESET_RESULTS=$(echo "$ENUM" | jq 'has("reset_results")' 2>/dev/null)
RESET_SUCCESS=$(echo "$ENUM" | jq '.reset_results.success' 2>/dev/null)

if [ "$HAS_RESET_RESULTS" = "true" ] && [ "$RESET_SUCCESS" = "true" ]; then
  echo "✅ PASS: Enumeration returns reset_results with success=true"
  ((PASS++))
else
  echo "❌ FAIL: Missing or failed reset_results in enumeration"
  echo "   has_reset_results=$HAS_RESET_RESULTS, reset_success=$RESET_SUCCESS"
  ((FAIL++))
fi

# Test 6: Reset in pipeline response
echo ""
echo "TEST 6: Reset Data Available in Pipeline Response"
RESET_MODE=$(echo "$ENUM" | jq -r '.reset_results.mode' 2>/dev/null)
RESET_TS=$(echo "$ENUM" | jq -r '.reset_results.timestamp' 2>/dev/null)

if [ "$RESET_MODE" = "derived-only" ] && [ ! -z "$RESET_TS" ] && [ "$RESET_TS" != "null" ]; then
  echo "✅ PASS: Pipeline response includes reset mode and timestamp"
  echo "   mode=$RESET_MODE, timestamp=${RESET_TS:0:20}..."
  ((PASS++))
else
  echo "❌ FAIL: Reset data incomplete in pipeline response"
  ((FAIL++))
fi

# Test 7: Enumeration without force (no reset)
echo ""
echo "TEST 7: Enumeration without force (no auto-reset)"
ENUM_NO_FORCE=$(curl -s -X POST "$BASE_URL/api/internal/admin/wyoleg/run" \
  -H "Content-Type: application/json" \
  -d '{"session":"2026","phase":"enumerate","limit":2,"force":false}')
HAS_RESET=$(echo "$ENUM_NO_FORCE" | jq '.reset_results' 2>/dev/null)

if [ "$HAS_RESET" = "null" ]; then
  echo "✅ PASS: Reset not triggered when force=false"
  ((PASS++))
else
  echo "❌ FAIL: Reset triggered unexpectedly without force=true"
  ((FAIL++))
fi

# Test 8: Dry-run mode (no reset)
echo ""
echo "TEST 8: Dry-Run Mode (no reset)"
DRY_RUN=$(curl -s -X POST "$BASE_URL/api/internal/admin/wyoleg/run" \
  -H "Content-Type: application/json" \
  -d '{"session":"2026","phase":"enumerate","limit":2,"dryRun":true,"force":true}')
HAS_RESET_DRY=$(echo "$DRY_RUN" | jq '.reset_results' 2>/dev/null)

if [ "$HAS_RESET_DRY" = "null" ]; then
  echo "✅ PASS: Reset not triggered in dry-run mode"
  ((PASS++))
else
  echo "❌ FAIL: Reset triggered unexpectedly in dry-run"
  ((FAIL++))
fi

# Summary
echo ""
echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║                         TEST SUMMARY                                      ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "✅ Passed: $PASS"
echo "❌ Failed: $FAIL"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "🎉 All tests passed! Ingestion reset system is healthy."
  exit 0
else
  echo "⚠️  Some tests failed. Please review the output above."
  exit 1
fi
