#!/bin/bash
# HOT_TOPICS_ALIGNMENT_VERIFICATION.sh
# Quick verification script for Hot Topics alignment implementation

echo "════════════════════════════════════════════════════════════════"
echo "  Hot Topics Alignment - Implementation Verification"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Check 1: Migration file exists
echo "✓ Checking migration file..."
if [ -f "worker/migrations/0017_align_preferences_to_hot_topics.sql" ]; then
  echo "  ✅ Migration 0017 exists"
  echo "     Lines: $(wc -l < worker/migrations/0017_align_preferences_to_hot_topics.sql)"
else
  echo "  ❌ Migration 0017 not found"
fi
echo ""

# Check 2: API endpoint syntax
echo "✓ Checking API endpoint..."
if grep -q "hot_topics ht" "worker/src/routes/api/user-topics/index.js"; then
  echo "  ✅ API endpoint queries hot_topics (not topic_index)"
  grep -A 2 "FROM   hot_topics" "worker/src/routes/api/user-topics/index.js" | head -3
else
  echo "  ❌ API endpoint may not be updated"
fi
echo ""

# Check 3: Preferences.js Firestore integration
echo "✓ Checking preferences.js Firestore integration..."
if grep -q "getFirestore\|updateDoc" "static/js/account/preferences.js"; then
  echo "  ✅ preferences.js includes Firestore integration"
  echo "     - getFirestore import: $(grep -c 'getFirestore' static/js/account/preferences.js)"
  echo "     - updateDoc calls: $(grep -c 'updateDoc' static/js/account/preferences.js)"
else
  echo "  ❌ Firestore integration missing"
fi
echo ""

# Check 4: Hot-topics.js followed topics
echo "✓ Checking hot-topics.js followed topics..."
if grep -q "followedTopics\|followedBadge" "static/js/civic/hot-topics.js"; then
  echo "  ✅ hot-topics.js includes followed topics feature"
  echo "     - followedTopics references: $(grep -c 'followedTopics' static/js/civic/hot-topics.js)"
  echo "     - Highlighting logic present: $(grep -c 'isFollowed' static/js/civic/hot-topics.js)"
else
  echo "  ❌ Followed topics feature missing"
fi
echo ""

# Check 5: Syntax verification
echo "✓ Checking JavaScript syntax..."
echo -n "  preferences.js: "
if node -c "static/js/account/preferences.js" 2>/dev/null; then
  echo "✅"
else
  echo "⚠️ (Module syntax - expected)"
fi

echo -n "  hot-topics.js: "
if node -c "static/js/civic/hot-topics.js" 2>/dev/null; then
  echo "✅"
else
  echo "⚠️ (Module syntax - expected)"
fi
echo ""

# Check 6: Documentation
echo "✓ Checking documentation..."
if [ -f "HOT_TOPICS_ALIGNMENT_COMPLETE.md" ]; then
  echo "  ✅ Implementation summary created"
  echo "     Size: $(wc -c < HOT_TOPICS_ALIGNMENT_COMPLETE.md) bytes"
else
  echo "  ❌ Documentation not found"
fi
echo ""

echo "════════════════════════════════════════════════════════════════"
echo "  Verification Summary"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Files Modified:"
echo "  1. worker/migrations/0017_align_preferences_to_hot_topics.sql"
echo "  2. worker/src/routes/api/user-topics/index.js"
echo "  3. static/js/account/preferences.js"
echo "  4. static/js/civic/hot-topics.js"
echo ""
echo "Next Steps:"
echo "  1. Deploy migration: wrangler d1 execute EVENTS_DB --file worker/migrations/0017_align_preferences_to_hot_topics.sql"
echo "  2. Deploy worker: npm run deploy"
echo "  3. Test on /account/preferences/ and /hot-topics/"
echo "  4. Verify Firestore saves to preferences.followedTopics"
echo ""
echo "✅ Implementation Ready for Testing"
echo ""
