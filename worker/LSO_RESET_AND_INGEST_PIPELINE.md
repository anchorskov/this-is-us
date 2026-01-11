# LSO Reset and Ingest Pipeline

**Date:** December 11, 2025  
**Environment:** Local development (WY_DB)  
**Goal:** Complete reset of civic_items table, fresh reseed from Wyoming Legislature Service (LSO), and full AI enrichment pipeline

---

## Overview

This document describes the full 4-phase pipeline for managing the Wyoming civic bills database:

1. **Phase 1: Reset** – Delete existing bills and dependent records
2. **Phase 2: Reseed** – Sync fresh bills from Wyoming Legislature Service (LSO)
3. **Phase 3: Enrich** – Run AI analysis (summaries and topic matching)
4. **Phase 4: Verify** – Run structural and content verification checks

---

## Phase 1: Reset

### Purpose
Clear out old test data and dependent records while maintaining schema integrity.

### Deletion Sequence

Execute the following deletions in order (child tables before parent):

```bash
cd /home/anchor/projects/this-is-us/worker

# 1. Delete votes (no FK, but references civic_items.id)
./scripts/wr d1 execute WY_DB --local --command \
  "DELETE FROM votes;"

# 2. Delete AI topic tags (FK → civic_items)
./scripts/wr d1 execute WY_DB --local --command \
  "DELETE FROM civic_item_ai_tags;"

# 3. Delete verification records (FK → civic_items)
./scripts/wr d1 execute WY_DB --local --command \
  "DELETE FROM civic_item_verification;"

# 4. Delete bill sponsors (FK → civic_items)
./scripts/wr d1 execute WY_DB --local --command \
  "DELETE FROM bill_sponsors;"

# 5. Delete user ideas (optional FK → civic_items)
./scripts/wr d1 execute WY_DB --local --command \
  "DELETE FROM user_ideas;"

# 6. Finally, delete civic_items (parent table)
./scripts/wr d1 execute WY_DB --local --command \
  "DELETE FROM civic_items;"
```

### Verification (after reset)

```bash
./scripts/wr d1 execute WY_DB --local --command \
  "SELECT 
     (SELECT COUNT(*) FROM civic_items) as civic_items,
     (SELECT COUNT(*) FROM bill_sponsors) as bill_sponsors,
     (SELECT COUNT(*) FROM civic_item_verification) as civic_item_verification,
     (SELECT COUNT(*) FROM civic_item_ai_tags) as civic_item_ai_tags,
     (SELECT COUNT(*) FROM votes) as votes,
     (SELECT COUNT(*) FROM user_ideas) as user_ideas;"
```

**Expected Result:**
```
civic_items: 0
bill_sponsors: 0
civic_item_verification: 0
civic_item_ai_tags: 0
votes: 0
user_ideas: 0
```

---

## Phase 2: Reseed

### Purpose
Import fresh bills from Wyoming Legislature Service (LSO) Committee Bills API.

### Reseed Command

```bash
# Start the Worker in the background (if not already running)
./scripts/wr dev --local &

# Wait 3 seconds for Worker to be ready
sleep 3

# Call the LSO sync endpoint
curl -s -X POST "http://127.0.0.1:8787/api/dev/lso/sync-committee-bills?year=2026" | jq '.'
```

### What This Does

The LSO sync endpoint (`/api/dev/lso/sync-committee-bills`):
- Fetches committee bills from Wyoming Legislature Service
- Extracts bill metadata (bill_number, title, chamber, status, etc.)
- Normalizes chamber detection (HB/HJ → house, SF/SJ → senate)
- Inserts into `civic_items` table with `source='lso'`
- Creates bill_sponsors records linking each bill to its committee sponsor

### Expected Result

```json
{
  "synced": 25,
  "bills": [...],
  "errors": []
}
```

### Verification (after reseed)

```bash
./scripts/wr d1 execute WY_DB --local --command \
  "SELECT 
     source,
     COUNT(*) as total,
     COUNT(DISTINCT chamber) as chambers
   FROM civic_items
   GROUP BY source
   ORDER BY source;"
```

**Expected Result:**
```
source: lso
total: 25
chambers: 2
```

Also verify sponsors were created:

```bash
./scripts/wr d1 execute WY_DB --local --command \
  "SELECT 
     COUNT(DISTINCT civic_item_id) as bills_with_sponsors,
     COUNT(*) as total_sponsor_records
   FROM bill_sponsors
   WHERE civic_item_id IN (SELECT id FROM civic_items WHERE source='lso');"
```

**Expected Result:**
```
bills_with_sponsors: 25
total_sponsor_records: 25
```

---

## Phase 3: Enrich

### Purpose
Generate AI summaries and match bills to hot topics.

### Step 3a: Generate AI Summaries

This step generates summaries for bills that don't have them:

```bash
curl -s -X POST "http://127.0.0.1:8787/api/internal/civic/scan-pending-bills" | jq '.'
```

**What scan-pending-bills does:**
- Fetches up to 5 pending bills (status='introduced' or 'in_committee')
- For each bill, calls OpenAI to match it against hot topics (water-rights, energy-permitting, etc.)
- Saves topic matches to `civic_item_ai_tags` table with confidence scores
- Returns list of matched topics per bill

If you have more than 5 pending bills, call this endpoint multiple times:

```bash
# Run it up to 5 times (25 bills / 5 per batch)
for i in {1..5}; do
  echo "Batch $i:"
  curl -s -X POST "http://127.0.0.1:8787/api/internal/civic/scan-pending-bills" | jq '.scanned'
  sleep 2
done
```

### Step 3b: Generate Summaries for Specific Bills (Optional)

If you need to generate summaries for specific bills or regenerate them:

```bash
# Example: Generate summary for HB0008
curl -s -X POST "http://127.0.0.1:8787/api/internal/civic/test-bill-summary?bill_id=HB0008&save=true" | jq '.'
```

### Verification (after enrichment)

```bash
./scripts/wr d1 execute WY_DB --local --command \
  "SELECT 
     COUNT(DISTINCT ci.id) as total_bills,
     COUNT(DISTINCT ciat.item_id) as bills_with_topics,
     AVG(ciat.confidence) as avg_topic_confidence
   FROM civic_items ci
   LEFT JOIN civic_item_ai_tags ciat ON ci.id = ciat.item_id
   WHERE ci.source='lso';"
```

**Expected Result:**
```
total_bills: 25
bills_with_topics: 20-25  (depends on content matching)
avg_topic_confidence: 0.65-0.85
```

---

## Phase 4: Verify

### Purpose
Run structural and content verification checks, populate the `civic_item_verification` table.

### Step 4a: Batch Verification (Recommended)

The verification endpoint checks each bill for:
- **Structural completeness:** bill_number, chamber, legislative_session, jurisdiction_key='WY', sponsor linkage
- **Content quality:** summary or text_url available
- **AI enrichment:** optional AI summary generation and topic matching if structurally sound

To verify all LSO bills:

```bash
# Get list of bill IDs from database
./scripts/wr d1 execute WY_DB --local --command \
  "SELECT id FROM civic_items WHERE source='lso' ORDER BY id;" > /tmp/lso_bill_ids.txt

# Loop through each bill and call verify endpoint
cat /tmp/lso_bill_ids.txt | tail -n +2 | while read bill_id; do
  echo "Verifying: $bill_id"
  curl -s "http://127.0.0.1:8787/api/internal/civic/verify-bill?id=$bill_id" | jq '.verification.status'
  sleep 0.5  # Rate limiting (adjust as needed)
done
```

Or use this more concise bash approach:

```bash
#!/bin/bash
# Bash loop to verify all LSO bills

./scripts/wr d1 execute WY_DB --local --command \
  "SELECT id FROM civic_items WHERE source='lso' ORDER BY id;" | \
  tail -n +2 | \
  while read bill_id; do
    echo "🔍 Verifying: $bill_id"
    curl -s "http://127.0.0.1:8787/api/internal/civic/verify-bill?id=$bill_id" | \
      jq -r '.verification | "\(.status) - \(.structural_reason // "ok")"'
    sleep 0.5
  done
```

**What verify-bill does:**
- Loads the bill from civic_items
- Runs structural checks (presence of bill_number, chamber, session, sponsor, Wyoming jurisdiction)
- If structural checks pass: generates AI summary (if missing) and runs topic matching
- Upserts a record into `civic_item_verification` with:
  - `structural_ok`: 1 if all structural checks passed, 0 otherwise
  - `status`: 'ok' if structurally sound, 'flagged' if issues found
  - `structural_reason`: First failure reason (e.g., 'missing_chamber', 'no_wyoming_sponsor')
  - `is_wyoming`, `has_summary`, `has_wyoming_sponsor`: Boolean fields for filtering/reporting

### Step 4b: Review Flagged Bills

After verification, check for any bills with structural issues:

```bash
./scripts/wr d1 execute WY_DB --local --command \
  "SELECT 
     ci.id,
     ci.bill_number,
     ci.title,
     civ.structural_ok,
     civ.structural_reason,
     civ.status
   FROM civic_items ci
   LEFT JOIN civic_item_verification civ ON ci.id = civ.civic_item_id
   WHERE ci.source='lso' AND (civ.structural_ok = 0 OR civ.status = 'flagged')
   ORDER BY ci.bill_number;"
```

**If any rows appear with structural_ok=0 or status='flagged':**
- Review the `structural_reason` field to understand the issue
- Fix the issue in the source (LSO bill metadata, sponsor linkage, etc.) or in the bill record
- Re-run the verify endpoint for that bill to update verification status

### Verification (after verification phase)

```bash
./scripts/wr d1 execute WY_DB --local --command \
  "SELECT 
     ci.source,
     COUNT(DISTINCT ci.id) as total_bills,
     COUNT(DISTINCT CASE WHEN civ.structural_ok = 1 THEN ci.id END) as structurally_ok,
     COUNT(DISTINCT CASE WHEN civ.structural_ok = 0 THEN ci.id END) as structurally_failed,
     AVG(CASE WHEN civ.structural_ok = 1 THEN 1.0 ELSE 0.0 END) as pass_rate
   FROM civic_items ci
   LEFT JOIN civic_item_verification civ ON ci.id = civ.civic_item_id
   WHERE ci.source='lso'
   GROUP BY ci.source;"
```

**Expected Result (targets, not guarantees):**
```
source: lso
total_bills: 25
structurally_ok: 24-25  (depends on data completeness)
structurally_failed: 0-1
pass_rate: 0.96-1.0
```

---

## Complete Command Sequence (All Phases)

Here's the full sequence for executing the entire pipeline:

```bash
#!/bin/bash

set -e  # Exit on error

cd /home/anchor/projects/this-is-us/worker

echo "📋 Starting LSO Reset and Ingest Pipeline..."
echo ""

# ============================================================================
# PHASE 1: RESET
# ============================================================================
echo "🧹 PHASE 1: Resetting existing bills and dependent records..."

./scripts/wr d1 execute WY_DB --local --command "DELETE FROM votes;"
echo "  ✓ Deleted votes"

./scripts/wr d1 execute WY_DB --local --command "DELETE FROM civic_item_ai_tags;"
echo "  ✓ Deleted civic_item_ai_tags"

./scripts/wr d1 execute WY_DB --local --command "DELETE FROM civic_item_verification;"
echo "  ✓ Deleted civic_item_verification"

./scripts/wr d1 execute WY_DB --local --command "DELETE FROM bill_sponsors;"
echo "  ✓ Deleted bill_sponsors"

./scripts/wr d1 execute WY_DB --local --command "DELETE FROM user_ideas;"
echo "  ✓ Deleted user_ideas"

./scripts/wr d1 execute WY_DB --local --command "DELETE FROM civic_items;"
echo "  ✓ Deleted civic_items"

# Verify reset
RESET_CHECK=$(./scripts/wr d1 execute WY_DB --local --command \
  "SELECT COUNT(*) as total FROM civic_items;" | jq -r '.results[0].total')
if [ "$RESET_CHECK" == "0" ]; then
  echo "✅ PHASE 1 COMPLETE: All tables cleared"
else
  echo "❌ PHASE 1 FAILED: civic_items still has $RESET_CHECK rows"
  exit 1
fi

echo ""

# ============================================================================
# PHASE 2: RESEED
# ============================================================================
echo "🌱 PHASE 2: Reseeding bills from Wyoming Legislature Service..."

# Start Worker in background if not running
./scripts/wr dev --local &
WORKER_PID=$!
sleep 3

RESEED_RESULT=$(curl -s -X POST "http://127.0.0.1:8787/api/dev/lso/sync-committee-bills?year=2026" | jq '.')
SYNCED_COUNT=$(echo "$RESEED_RESULT" | jq '.synced // 0')

if [ "$SYNCED_COUNT" -gt 0 ]; then
  echo "✅ PHASE 2 COMPLETE: Synced $SYNCED_COUNT bills from LSO"
else
  echo "❌ PHASE 2 FAILED: No bills synced"
  kill $WORKER_PID 2>/dev/null || true
  exit 1
fi

echo ""

# ============================================================================
# PHASE 3: ENRICH
# ============================================================================
echo "🤖 PHASE 3: Enriching bills with AI analysis..."

BATCH_NUM=1
while true; do
  SCAN_RESULT=$(curl -s -X POST "http://127.0.0.1:8787/api/internal/civic/scan-pending-bills" | jq '.')
  SCANNED=$(echo "$SCAN_RESULT" | jq '.scanned // 0')
  
  if [ "$SCANNED" -eq 0 ]; then
    echo "✅ PHASE 3 COMPLETE: All pending bills scanned"
    break
  fi
  
  echo "  Batch $BATCH_NUM: Scanned $SCANNED bills"
  ((BATCH_NUM++))
  
  sleep 2
done

echo ""

# ============================================================================
# PHASE 4: VERIFY
# ============================================================================
echo "✔️  PHASE 4: Running verification checks..."

# Get bill IDs
BILL_IDS=$(./scripts/wr d1 execute WY_DB --local --command \
  "SELECT id FROM civic_items WHERE source='lso' ORDER BY id;" | jq -r '.results[] | .id')

VERIFIED_COUNT=0
for bill_id in $BILL_IDS; do
  VERIFY_RESULT=$(curl -s "http://127.0.0.1:8787/api/internal/civic/verify-bill?id=$bill_id" | jq '.')
  STATUS=$(echo "$VERIFY_RESULT" | jq -r '.verification.status // "unknown"')
  
  if [ "$STATUS" = "ok" ]; then
    ((VERIFIED_COUNT++))
  fi
  
  sleep 0.5  # Rate limiting
done

echo "✅ PHASE 4 COMPLETE: Verified $VERIFIED_COUNT bills structurally sound"

echo ""

# ============================================================================
# FINAL VERIFICATION
# ============================================================================
echo "📊 FINAL VERIFICATION..."

FINAL_STATS=$(./scripts/wr d1 execute WY_DB --local --command \
  "SELECT 
     COUNT(*) as total_bills,
     COUNT(DISTINCT CASE WHEN ai_summary IS NOT NULL THEN id END) as with_summaries,
     (SELECT COUNT(DISTINCT item_id) FROM civic_item_ai_tags) as bills_with_topics,
     (SELECT COUNT(DISTINCT civic_item_id) FROM civic_item_verification WHERE structural_ok=1) as structurally_ok
   FROM civic_items WHERE source='lso';" | jq '.results[0]')

echo "$FINAL_STATS" | jq '.'

echo ""
echo "✅ LSO RESET AND INGEST PIPELINE COMPLETE"
echo ""

# Kill Worker background process
kill $WORKER_PID 2>/dev/null || true
```

---

## Troubleshooting

### Bills didn't reseed

**Check if Worker is running:**
```bash
curl -s "http://127.0.0.1:8787/api/dev/lso/sync-committee-bills?year=2026" | jq '.error'
```

**If error "Not available outside dev":**
- Ensure you're hitting http://127.0.0.1 (not localhost or hostname)

**If error "lso_sync_failed":**
- Check Worker logs: `./scripts/wr dev --local` shows live logs
- Verify LSO endpoint is responding: Check `worker/src/lib/wyLsoClient.mjs`

### Verification endpoint not found

**Check if endpoint is registered:**
```bash
curl -s "http://127.0.0.1:8787/api/internal/civic/verify-bill?id=test" | jq '.'
```

**If 404:**
- Ensure Worker is running: `./scripts/wr dev --local`
- Check `worker/src/index.mjs` for route registration

### Scan-pending-bills returns 0 scanned

**Possible causes:**
- No bills with pending status (status != 'introduced' and status != 'in_committee')
- Bills already scanned and cached

**Check status distribution:**
```bash
./scripts/wr d1 execute WY_DB --local --command \
  "SELECT status, COUNT(*) FROM civic_items WHERE source='lso' GROUP BY status;"
```

### Structural verification failing

**Review flagged bills:**
```bash
./scripts/wr d1 execute WY_DB --local --command \
  "SELECT bill_number, structural_reason FROM civic_item_verification WHERE structural_ok=0 LIMIT 5;"
```

**Common reasons:**
- `missing_bill_number` – Bill ID not properly extracted
- `missing_chamber` – Chamber not detected (HB/SF parsing issue)
- `no_wyoming_sponsor` – Sponsor linkage failed
- `wrong_jurisdiction` – Bill not from Wyoming (jurisdiction_key != 'WY')

---

## Expected Final State

### Counts by Table

| Table | Expected Count | Notes |
|-------|---|---|
| civic_items (source='lso') | 25 | All LSO bills |
| bill_sponsors (civic_item_id in LSO) | 25 | 1 per bill (committee sponsor) |
| civic_item_ai_tags | 18-25 | Topic matches (depends on content) |
| civic_item_verification | 25 | Verification records for all bills |
| civic_items with structural_ok=1 | 24-25 | Structurally sound |
| civic_items with structural_ok=0 | 0-1 | Any structural issues (inspect & fix) |

### Sample Query for Final State

```bash
./scripts/wr d1 execute WY_DB --local --command \
  "SELECT 
     ci.bill_number,
     ci.title,
     CASE WHEN ci.ai_summary IS NOT NULL THEN 'yes' ELSE 'no' END as has_summary,
     COUNT(DISTINCT ciat.id) as topic_count,
     civ.structural_ok,
     civ.status
   FROM civic_items ci
   LEFT JOIN civic_item_ai_tags ciat ON ci.id = ciat.item_id
   LEFT JOIN civic_item_verification civ ON ci.id = civ.civic_item_id
   WHERE ci.source='lso'
   GROUP BY ci.id
   ORDER BY ci.bill_number
   LIMIT 5;"
```

**Expected Output (sample):**
```
bill_number | title | has_summary | topic_count | structural_ok | status
HB0001      | ... | no | 1 | 1 | ok
HB0008      | ... | no | 0 | 1 | ok
SF0001      | ... | no | 2 | 1 | ok
SF0002      | ... | no | 1 | 1 | ok
...
```

---

## Cost & Time Estimates

| Phase | Duration | Cost | Notes |
|-------|----------|------|-------|
| Phase 1 (Reset) | < 1 min | $0 | Local D1 only |
| Phase 2 (Reseed) | 2-5 min | $0 | LSO endpoint (free) |
| Phase 3 (Enrich) | 5-10 min | ~$0.10 | OpenAI gpt-4o-mini (topic matching) |
| Phase 4 (Verify) | 2-5 min | ~$0.05 | OpenAI gpt-4o-mini (verification checks) |
| **Total** | **10-20 min** | **~$0.15** | Local dev environment |

---

## Notes

- **All work is local-only.** Uses `--local` flag on D1 commands and http://127.0.0.1:8787 for Worker endpoints.
- **No remote databases touched.** All operations against local WY_DB.
- **Idempotent operations.** Phase 2 can be re-run; existing bills will be updated.
- **Rate limiting.** Verification loop uses 0.5s sleep between requests to avoid overwhelming the Worker.
- **Error recovery.** If a phase fails, you can re-run just that phase without re-doing earlier phases.

---

## Questions?

Refer to:
- `worker/src/routes/civicScan.mjs` – scan-pending-bills implementation
- `worker/src/routes/internalVerifyBill.mjs` – verify-bill implementation
- `worker/src/lib/civicReviewPipeline.mjs` – verification logic (structural checks, AI enrichment)
- `worker/src/lib/wyLsoClient.mjs` – LSO sync logic
- `worker/src/lib/hotTopicsAnalyzer.mjs` – topic matching logic
- `worker/src/lib/billSummaryAnalyzer.mjs` – summary generation logic
