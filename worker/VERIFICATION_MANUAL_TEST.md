<!-- MANUAL VERIFICATION CHECKLIST FOR CIVIC_ITEM_VERIFICATION -->

# Civic Item Verification - Manual Test Checklist

This document provides manual testing steps to verify the AI verification pipeline is working end-to-end.

## Prerequisites

- [ ] `wrangler dev --local` is running from `/home/anchor/projects/this-is-us/worker`
- [ ] WY_DB has the `civic_item_verification` table created (migration 0019)
- [ ] At least one bill exists in `civic_items` table with `source='open_states'` or similar

## STEP 1: Verify Table Schema

### 1.1 Check Table Exists and Schema

```bash
# From /home/anchor/projects/this-is-us/worker:

wrangler d1 execute WY_DB --command \
  "SELECT name, sql FROM sqlite_master WHERE type='table' AND name='civic_item_verification';" \
  --local
```

**Expected Result:**
- Table `civic_item_verification` exists
- Columns: id, civic_item_id, check_type, topic_match, summary_safe, issues, model, confidence, status, created_at
- Indexes created for: civic_item_id + created_at DESC, status

### 1.2 Check Indexes

```bash
wrangler d1 execute WY_DB --command \
  "SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='civic_item_verification';" \
  --local
```

**Expected Result:**
- idx_civic_item_verification_latest (civic_item_id, created_at DESC)
- idx_civic_item_verification_status (status)
- idx_civic_item_verification_unique (civic_item_id, check_type)

---

## STEP 2: Seed Test Data

### 2.1 Check If Bills Exist

```bash
# Get one bill ID
wrangler d1 execute WY_DB --command \
  "SELECT id, bill_number, title FROM civic_items LIMIT 1;" \
  --local
```

**Note down the bill ID.** If no bills exist, you can seed one with:

```bash
wrangler d1 execute WY_DB --command \
  "INSERT INTO civic_items (id, bill_number, title, summary, status, kind, level, jurisdiction_key, source, legislative_session, chamber, created_at, updated_at) 
   VALUES ('test-bill-001', 'HB 1', 'Test Bill', 'A test bill for verification', 'introduced', 'bill', 'statewide', 'WY', 'open_states', '2025', 'house', datetime('now'), datetime('now'));" \
  --local
```

### 2.2 Manually Insert a Verification Record

```bash
BILL_ID="<use-id-from-step-2.1>"

wrangler d1 execute WY_DB --command \
  "INSERT INTO civic_item_verification (civic_item_id, check_type, topic_match, summary_safe, issues, model, confidence, status, created_at) 
   VALUES ('$BILL_ID', 'topic_summary', 1, 1, '[]', 'gpt-4o-mini', 0.95, 'ok', datetime('now'));" \
  --local
```

**Expected Result:** Row inserted successfully.

### 2.3 Verify Insertion

```bash
BILL_ID="<use-id-from-step-2.1>"

wrangler d1 execute WY_DB --command \
  "SELECT id, civic_item_id, status, confidence, created_at FROM civic_item_verification WHERE civic_item_id = '$BILL_ID';" \
  --local
```

**Expected Result:** One row with status='ok', confidence=0.95.

---

## STEP 3: Test the /api/internal/civic/verify-bill Endpoint

### 3.1 Call Verify Endpoint

```bash
BILL_ID="<use-id-from-step-2.1>"

curl -s "http://127.0.0.1:8787/api/internal/civic/verify-bill?id=$BILL_ID" | jq .
```

**Expected Result:**
```json
{
  "civic_item_id": "test-bill-001",
  "verification": {
    "stored_topic": "...",
    "openai_topics": [...],
    "topic_match": true|false,
    "summary_safe": true|false,
    "issues": [...],
    "confidence": 0.0-1.0,
    "status": "ok" or "flagged",
    "model": "gpt-4o-mini",
    "created_at": "2025-12-10T14:45:30.000Z"
  }
}
```

### 3.2 Verify Data Was Updated

```bash
BILL_ID="<use-id-from-step-2.1>"

wrangler d1 execute WY_DB --command \
  "SELECT COUNT(*) as row_count FROM civic_item_verification WHERE civic_item_id = '$BILL_ID';" \
  --local
```

**Expected Result:** row_count = 1 (old row was upserted, not duplicated, thanks to ON CONFLICT).

---

## STEP 4: Test the /api/civic/pending-bills-with-topics Endpoint

### 4.1 Call Pending Bills API

```bash
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics" | jq '.results[0] | {id, bill_number, verification_status, verification_confidence}'
```

**Expected Result:**
```json
{
  "id": "test-bill-001",
  "bill_number": "HB 1",
  "verification_status": "ok",
  "verification_confidence": 0.95
}
```

### 4.2 Verify the JOIN Works

```bash
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics" | jq '.results | length'
```

**Expected Result:** Number of pending bills (should include your test bill if status='introduced'|'in_committee'|'pending_vote').

### 4.3 Filter by Session (Optional)

```bash
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics?session=2025" | jq '.results[0]'
```

**Expected Result:** Same bill data, filtered by legislative_session='2025'.

---

## STEP 5: Test Flagged Verification

### 5.1 Insert a Flagged Verification Row

```bash
BILL_ID="<use-a-different-bill-id-or-create-another>"

wrangler d1 execute WY_DB --command \
  "INSERT INTO civic_item_verification (civic_item_id, check_type, topic_match, summary_safe, issues, model, confidence, status, created_at) 
   VALUES ('$BILL_ID', 'topic_summary', 0, 1, '[\"Topic mismatch found\"]', 'gpt-4o-mini', 0.42, 'flagged', datetime('now'));" \
  --local
```

### 5.2 Verify Flagged Bill Appears in API

```bash
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics" | jq '.results | map(select(.verification_status == "flagged"))'
```

**Expected Result:** Array containing the flagged bill.

---

## STEP 6: Test Latest Row Selection

### 6.1 Insert Multiple Verification Rows for Same Bill

```bash
BILL_ID="<use-id-from-step-2.1>"

# First verification (older)
wrangler d1 execute WY_DB --command \
  "INSERT INTO civic_item_verification (civic_item_id, check_type, topic_match, summary_safe, issues, model, confidence, status, created_at) 
   VALUES ('$BILL_ID', 'topic_summary', 0, 0, '[\"Initial issues\"]', 'gpt-4o-mini', 0.30, 'flagged', '2025-12-10T10:00:00Z');" \
  --local

# Second verification (newer, should be used)
wrangler d1 execute WY_DB --command \
  "INSERT INTO civic_item_verification (civic_item_id, check_type, topic_match, summary_safe, issues, model, confidence, status, created_at) 
   VALUES ('$BILL_ID', 'topic_summary', 1, 1, '[]', 'gpt-4o-mini', 0.92, 'ok', '2025-12-10T14:00:00Z');" \
  --local
```

### 6.2 Verify Only Latest Row Is Used

```bash
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics" | jq ".results[] | select(.id == \"$BILL_ID\") | {verification_status, verification_confidence}"
```

**Expected Result:**
```json
{
  "verification_status": "ok",
  "verification_confidence": 0.92
}
```

(Should use the newer row with confidence=0.92, not the older row with confidence=0.30)

---

## STEP 7: Verify UI Badge Display

If the civic/pending-bills.html and pending-bills.js files are deployed:

### 7.1 Load the Pending Bills UI

Navigate to: `http://127.0.0.1:8787/ballot/pending-bills` (or similar path)

### 7.2 Check Badge Display

For each bill card, look for:
- **"Verified (AI)"** badge if `verification_status == 'ok'`
- **"Needs Review"** badge if `verification_status == 'flagged'`
- Hover tooltip showing verification_confidence

---

## Troubleshooting

| Issue | Check |
|-------|-------|
| Table doesn't exist | Run migration 0019 again: `wrangler d1 execute WY_DB --file=migrations_wy/0019_create_civic_item_verification.sql --local` |
| /api/internal/civic/verify-bill returns 404 | Ensure bill ID exists: `wrangler d1 execute WY_DB --command "SELECT COUNT(*) FROM civic_items;" --local` |
| verification_status is NULL in API response | Check that at least one civic_item_verification row exists for the bill |
| Latest row is not used | Verify indexes are created: Check step 1.2 above |
| Topic metadata not loading | Check EVENTS_DB for hot_topics table: `wrangler d1 execute EVENTS_DB --command "SELECT COUNT(*) FROM hot_topics WHERE is_active=1;" --local` |

---

## Summary

Once all steps pass:
- ✅ civic_item_verification table created with correct schema
- ✅ Verification rows can be inserted and retrieved
- ✅ /api/internal/civic/verify-bill endpoint works
- ✅ /api/civic/pending-bills-with-topics includes verification data
- ✅ Latest verification row is correctly selected via MAX(created_at)
- ✅ UI displays "Verified (AI)" or "Needs Review" badges

The AI verification pipeline is fully integrated and ready for production use.
