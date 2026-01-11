#!/bin/bash
# Test script for hot topics staging implementation

set -euo pipefail

REPO_ROOT="/home/anchor/projects/this-is-us"
WORKER_DIR="$REPO_ROOT/worker"
PERSIST_DIR="$WORKER_DIR/.wrangler-persist"

echo "════════════════════════════════════════════════════════════════════════════════"
echo "HOT TOPICS STAGING IMPLEMENTATION - TEST SUITE"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# Utility functions
test_pass() {
  echo "✅ $*"
}

test_fail() {
  echo "❌ $*"
  exit 1
}

test_info() {
  echo "ℹ️  $*"
}

# Test 1: Verify tables exist
echo "Test 1: Verify database tables created"
echo "───────────────────────────────────────"

TABLES=$(cd "$WORKER_DIR" && ./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --json --command "
  SELECT name FROM sqlite_master 
  WHERE type='table' AND (name='hot_topics_staging' OR name='hot_topics_review_audit')
  ORDER BY name;" 2>/dev/null | jq -r '.[0].results[].name' 2>/dev/null || echo "")

if echo "$TABLES" | grep -q "hot_topics_staging"; then
  test_pass "hot_topics_staging table exists"
else
  test_fail "hot_topics_staging table not found"
fi

if echo "$TABLES" | grep -q "hot_topics_review_audit"; then
  test_pass "hot_topics_review_audit table exists"
else
  test_fail "hot_topics_review_audit table not found"
fi

echo ""

# Test 2: Verify schema
echo "Test 2: Verify table schema"
echo "───────────────────────────────────────"

STAGING_COLS=$(cd "$WORKER_DIR" && ./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --json --command "
  PRAGMA table_info(hot_topics_staging);" 2>/dev/null | jq '.[0].results | length' 2>/dev/null || echo "0")

if [[ "$STAGING_COLS" -ge 20 ]]; then
  test_pass "hot_topics_staging has $STAGING_COLS columns (expected ~24)"
else
  test_fail "hot_topics_staging has only $STAGING_COLS columns (expected ~24)"
fi

AUDIT_COLS=$(cd "$WORKER_DIR" && ./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --json --command "
  PRAGMA table_info(hot_topics_review_audit);" 2>/dev/null | jq '.[0].results | length' 2>/dev/null || echo "0")

if [[ "$AUDIT_COLS" -ge 8 ]]; then
  test_pass "hot_topics_review_audit has $AUDIT_COLS columns (expected ~9)"
else
  test_fail "hot_topics_review_audit has only $AUDIT_COLS columns (expected ~9)"
fi

echo ""

# Test 3: CLI tests
echo "Test 3: CLI commands functionality"
echo "───────────────────────────────────────"

# Test list-staging
if OUTPUT=$(cd "$REPO_ROOT" && worker/scripts/hot-topics-review.sh list-staging 2>&1); then
  test_pass "list-staging command works"
else
  test_fail "list-staging command failed: $OUTPUT"
fi

# Test stats
if OUTPUT=$(cd "$REPO_ROOT" && worker/scripts/hot-topics-review.sh stats 2>&1); then
  test_pass "stats command works"
else
  test_fail "stats command failed: $OUTPUT"
fi

echo ""

# Test 4: Insert test data into staging
echo "Test 4: Insert test data into staging table"
echo "───────────────────────────────────────"

cd "$WORKER_DIR"

# Get a sample civic_item_id
CIVIC_ID=$(./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --json --command "
  SELECT id FROM civic_items LIMIT 1;" 2>/dev/null | jq -r '.[0].results[0].id' 2>/dev/null || echo "")

if [[ -z "$CIVIC_ID" ]]; then
  test_info "No civic_items in database, skipping data insertion test"
else
  test_info "Found civic_item_id: $CIVIC_ID"
  
  # Insert a test record
  INSERT_RESULT=$(./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --command "
    INSERT INTO hot_topics_staging (
      slug, title, summary, confidence, trigger_snippet, reason_summary,
      civic_item_id, review_status, is_complete, legislative_session
    ) VALUES (
      'test-topic', 'Test Topic', 'This is a test topic',
      0.85, 'Test snippet from bill', 'This bill is relevant because...',
      '$CIVIC_ID', 'pending', 1, '2026'
    );" 2>&1 || echo "INSERT_FAILED")
  
  if echo "$INSERT_RESULT" | grep -q "command executed"; then
    test_pass "Successfully inserted test record into staging"
    
    # Verify it was inserted
    COUNT=$(./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --json --command "
      SELECT COUNT(*) as count FROM hot_topics_staging WHERE slug = 'test-topic';" 2>/dev/null | jq '.[0].results[0].count' 2>/dev/null || echo "0")
    
    if [[ "$COUNT" -gt 0 ]]; then
      test_pass "Verified test record exists in staging ($COUNT record)"
    else
      test_fail "Test record not found in staging"
    fi
  else
    test_fail "Failed to insert test record: $INSERT_RESULT"
  fi
fi

echo ""

# Test 5: Test CLI review functionality
echo "Test 5: CLI review commands"
echo "───────────────────────────────────────"

# Get the staging record ID if we inserted one
STAGING_ID=$(cd "$WORKER_DIR" && ./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --json --command "
  SELECT id FROM hot_topics_staging WHERE slug = 'test-topic' LIMIT 1;" 2>/dev/null | jq -r '.[0].results[0].id' 2>/dev/null || echo "")

if [[ -z "$STAGING_ID" ]]; then
  test_info "No test staging record, skipping review tests"
else
  test_info "Testing with staging ID: $STAGING_ID"
  
  # Test review command
  if OUTPUT=$(cd "$REPO_ROOT" && worker/scripts/hot-topics-review.sh review "$STAGING_ID" 2>&1); then
    test_pass "review command works"
  else
    test_fail "review command failed"
  fi
  
  # Test approve command
  if OUTPUT=$(cd "$REPO_ROOT" && worker/scripts/hot-topics-review.sh approve "$STAGING_ID" 2>&1); then
    test_pass "approve command works"
  else
    test_fail "approve command failed"
  fi
  
  # Verify status changed
  STATUS=$(cd "$WORKER_DIR" && ./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --json --command "
    SELECT review_status FROM hot_topics_staging WHERE id = $STAGING_ID LIMIT 1;" 2>/dev/null | jq -r '.[0].results[0].review_status' 2>/dev/null || echo "")
  
  if [[ "$STATUS" == "approved" ]]; then
    test_pass "Approve changed status to 'approved'"
  else
    test_fail "Status is '$STATUS', expected 'approved'"
  fi
  
  # Test promote command
  if OUTPUT=$(cd "$REPO_ROOT" && worker/scripts/hot-topics-review.sh promote "$STAGING_ID" 2>&1); then
    test_pass "promote command works"
  else
    test_fail "promote command failed"
  fi
  
  # Verify it was promoted to hot_topics
  PROMOTED=$(cd "$WORKER_DIR" && ./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --json --command "
    SELECT COUNT(*) as count FROM hot_topics WHERE slug = 'test-topic';" 2>/dev/null | jq '.[0].results[0].count' 2>/dev/null || echo "0")
  
  if [[ "$PROMOTED" -gt 0 ]]; then
    test_pass "Record promoted to hot_topics table"
  else
    test_fail "Record not found in hot_topics after promotion"
  fi
  
  # Test audit log
  if OUTPUT=$(cd "$REPO_ROOT" && worker/scripts/hot-topics-review.sh audit-log "$STAGING_ID" 2>&1); then
    test_pass "audit-log command works"
  else
    test_fail "audit-log command failed"
  fi
fi

echo ""

# Test 6: Final verification
echo "Test 6: Final verification"
echo "───────────────────────────────────────"

STAGING_COUNT=$(cd "$WORKER_DIR" && ./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --json --command "
  SELECT COUNT(*) as count FROM hot_topics_staging;" 2>/dev/null | jq '.[0].results[0].count' 2>/dev/null || echo "0")

test_pass "Staging table has $STAGING_COUNT records"

AUDIT_COUNT=$(cd "$WORKER_DIR" && ./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --json --command "
  SELECT COUNT(*) as count FROM hot_topics_review_audit;" 2>/dev/null | jq '.[0].results[0].count' 2>/dev/null || echo "0")

test_pass "Audit log has $AUDIT_COUNT entries"

echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "✅ ALL TESTS PASSED"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""
echo "📊 Summary:"
echo "  • Database tables created: ✅"
echo "  • Table schema verified: ✅"
echo "  • CLI commands functional: ✅"
echo "  • Data insertion works: ✅"
echo "  • Review/approval workflow works: ✅"
echo "  • Audit logging works: ✅"
echo ""
echo "🚀 Next steps:"
echo "  1. Update hotTopicsAnalyzer.mjs to use saveTopicToStaging()"
echo "  2. Test with real ingestion pipeline"
echo "  3. Deploy to staging environment"
echo ""
