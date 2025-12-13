# Data Reset Proposal - Bill & Idea Content Clearing

**Date:** December 11, 2025  
**Scope:** Clear test/development civic bill data for LSO-first ingestion strategy  
**Safety Level:** ✅ Safe - preserves voters, legislators, hot_topics, and configurations

---

## Overview

This proposal will clear **bill and idea content** while preserving:
- ✅ `hot_topics` (canonical topic definitions)
- ✅ `voters_addr_norm`, `verified_users`, `wy_city_county` (voter data)
- ✅ `wy_legislators` (legislator roster)
- ✅ User preferences and topic selections

**Tables to Clear:**

| Database | Table | Reason | Action |
|----------|-------|--------|--------|
| **WY_DB** | civic_items | Bill content test data | DELETE |
| | civic_item_ai_tags | AI tags from test bills | DELETE |
| | bill_sponsors | Sponsors from test bills | DELETE (cascades to civic_items) |
| | civic_item_verification | AI verification of test bills | DELETE |
| | votes | Only civic_item votes | DELETE WHERE target_type='civic_item' |
| **EVENTS_DB** | hot_topic_civic_items | Links between topics and test bills | DELETE |
| | townhall_posts | Test town hall threads | DELETE |

---

## Proposed Wrangler Commands

### Order of Execution (Important!)
1. **Delete dependent tables first** (foreign keys reference civic_items)
2. **Then delete civic_items** (will cascade)
3. **Then clean votes** (civic_item votes only)
4. **Finally clear EVENTS_DB** connections

### Commands for WY_DB

```bash
# ==========================================
# WY_DB - Delete Bill & Idea Content
# ==========================================

# 1. Delete civic_item_verification (references civic_items)
npx wrangler d1 execute wy_db --command "DELETE FROM civic_item_verification;" --local

# 2. Delete civic_item_ai_tags (references civic_items via item_id)
npx wrangler d1 execute wy_db --command "DELETE FROM civic_item_ai_tags;" --local

# 3. Delete bill_sponsors (has FK to civic_items with ON DELETE CASCADE)
# But delete explicitly first for clarity
npx wrangler d1 execute wy_db --command "DELETE FROM bill_sponsors;" --local

# 4. Delete civic_items (main table with cascading deletes)
npx wrangler d1 execute wy_db --command "DELETE FROM civic_items;" --local

# 5. Delete votes where target_type='civic_item' (but keep townhall_post votes if any)
npx wrangler d1 execute wy_db --command "DELETE FROM votes WHERE target_type = 'civic_item';" --local
```

### Commands for EVENTS_DB

```bash
# ==========================================
# EVENTS_DB - Delete Bill & Idea Connections
# ==========================================

# 6. Delete hot_topic_civic_items (links topics to test bills)
#    DO NOT DELETE hot_topics itself!
npx wrangler d1 execute events_db --command "DELETE FROM hot_topic_civic_items;" --local

# 7. Delete townhall_posts (test discussion threads)
#    Keep this for now OR delete - depends on your preference
#    Assuming you want to clear test data:
npx wrangler d1 execute events_db --command "DELETE FROM townhall_posts;" --local

# Note: townhall_replies will cascade delete if townhall_posts has foreign key
# Verify your schema - if townhall_replies exists and references townhall_posts:
# npx wrangler d1 execute events_db --command "DELETE FROM townhall_replies;" --local
```

---

## Summary Script (All Commands)

```bash
#!/bin/bash
# Data reset for LSO-first ingestion strategy
# Local dev only - uses --local flag

echo "🔄 Clearing civic bill and idea content..."

# WY_DB Tables
echo "  [1/7] Deleting civic_item_verification..."
npx wrangler d1 execute wy_db --command "DELETE FROM civic_item_verification;" --local

echo "  [2/7] Deleting civic_item_ai_tags..."
npx wrangler d1 execute wy_db --command "DELETE FROM civic_item_ai_tags;" --local

echo "  [3/7] Deleting bill_sponsors..."
npx wrangler d1 execute wy_db --command "DELETE FROM bill_sponsors;" --local

echo "  [4/7] Deleting civic_items..."
npx wrangler d1 execute wy_db --command "DELETE FROM civic_items;" --local

echo "  [5/7] Deleting civic_item votes..."
npx wrangler d1 execute wy_db --command "DELETE FROM votes WHERE target_type = 'civic_item';" --local

# EVENTS_DB Tables
echo "  [6/7] Deleting hot_topic_civic_items..."
npx wrangler d1 execute events_db --command "DELETE FROM hot_topic_civic_items;" --local

echo "  [7/7] Deleting townhall_posts..."
npx wrangler d1 execute events_db --command "DELETE FROM townhall_posts;" --local

echo "✅ Reset complete! Preparing verification..."
```

---

## Verification Commands (After Reset)

After running the reset commands, verify with these inspection commands:

```bash
# ==========================================
# VERIFICATION - Count remaining rows
# ==========================================

echo "=== WY_DB Content Verification ==="
echo "civic_items count:"
npx wrangler d1 execute wy_db --command "SELECT COUNT(*) as count FROM civic_items;" --local

echo "civic_item_ai_tags count:"
npx wrangler d1 execute wy_db --command "SELECT COUNT(*) as count FROM civic_item_ai_tags;" --local

echo "bill_sponsors count:"
npx wrangler d1 execute wy_db --command "SELECT COUNT(*) as count FROM bill_sponsors;" --local

echo "civic_item_verification count:"
npx wrangler d1 execute wy_db --command "SELECT COUNT(*) as count FROM civic_item_verification;" --local

echo "votes (civic_item only) count:"
npx wrangler d1 execute wy_db --command "SELECT COUNT(*) as count FROM votes WHERE target_type = 'civic_item';" --local

echo ""
echo "=== EVENTS_DB Content Verification ==="
echo "hot_topic_civic_items count:"
npx wrangler d1 execute events_db --command "SELECT COUNT(*) as count FROM hot_topic_civic_items;" --local

echo "townhall_posts count:"
npx wrangler d1 execute events_db --command "SELECT COUNT(*) as count FROM townhall_posts;" --local

echo ""
echo "=== Confirming Preserved Data ==="
echo "hot_topics count (should be 6):"
npx wrangler d1 execute events_db --command "SELECT COUNT(*) as count FROM hot_topics;" --local

echo "wy_legislators count (should be 93):"
npx wrangler d1 execute wy_db --command "SELECT COUNT(*) as count FROM wy_legislators;" --local

echo "voters_addr_norm count:"
npx wrangler d1 execute wy_db --command "SELECT COUNT(*) as count FROM voters_addr_norm;" --local
```

---

## Expected Results After Reset

| Table | Before | After | Status |
|-------|--------|-------|--------|
| civic_items | ~10-50+ | **0** | ✅ Cleared |
| civic_item_ai_tags | ~10-50+ | **0** | ✅ Cleared |
| bill_sponsors | ~20-100+ | **0** | ✅ Cleared |
| civic_item_verification | ~5-20+ | **0** | ✅ Cleared |
| votes (civic_item) | ~10-30+ | **0** | ✅ Cleared |
| hot_topic_civic_items | ~10-30+ | **0** | ✅ Cleared |
| townhall_posts | ~5-15+ | **0** | ✅ Cleared |
| **hot_topics** | **6** | **6** | ✅ **PRESERVED** |
| **wy_legislators** | **93** | **93** | ✅ **PRESERVED** |
| **voters_addr_norm** | ~5,000+ | ~5,000+ | ✅ **PRESERVED** |

---

## Repopulation Entry Points (Post-Reset)

Once cleared and reset is confirmed, use these to repopulate:

### OpenStates Bills Sync
```
GET /api/dev/openstates/sync?limit=100
POST /api/dev/openstates/sync (with payload)
```
**Location:** `worker/src/routes/openstates/sync.mjs`  
**What it does:** Fetches bills from OpenStates API, parses, creates civic_items, runs AI tagging

### LSO Committee Bills Inspection (Ready to Implement)
```
[To be created]
GET /api/dev/lso/inspect?year=2026
GET /api/dev/lso/sync?year=2026
```
**What it will do:** Fetch Wyoming LSO committee bills, parse, create civic_items with committee sponsors

### Verification Endpoint
```
GET /api/internal/civic/verify-bill?id=<civic_item_id>
```
**What it does:** Runs AI verification on individual bills (optional but recommended)

---

## Safety Checklist

✅ **Preserved (Do NOT Delete):**
- hot_topics table (canonical topic definitions)
- wy_legislators table (legislator roster - 93 records)
- voters_addr_norm (voter addresses and districts)
- verified_users (voter-user bridge)
- wy_city_county (county lookup)
- user_topic_prefs (user topic selections)

❌ **Deleting (Safe to Clear):**
- civic_items (test bill data)
- civic_item_ai_tags (AI tags from test bills)
- bill_sponsors (sponsor data from test bills)
- civic_item_verification (verification results from test bills)
- votes → WHERE target_type='civic_item' (test bill votes only)
- hot_topic_civic_items (test bill-to-topic mappings)
- townhall_posts (test discussion threads)

---

## Next Steps

1. **Review and Approve** these commands
2. **Execute** the reset script in integrated terminal
3. **Run Verification** commands to confirm row counts
4. **Paste Results** back here for confirmation
5. **Document Sync Entry Points** for repopulation

Ready to proceed? Please confirm and I'll execute.

---

**Document Created:** December 11, 2025  
**Environment:** Local Development (--local flag used throughout)  
**Reversibility:** All data is development test data and can be easily repopulated from OpenStates/LSO APIs
