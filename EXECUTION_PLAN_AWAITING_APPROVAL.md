# LSO Pipeline Execution Plan – Awaiting Your Approval

**Date:** December 11, 2025  
**Environment:** Local development (WY_DB)  
**Scope:** 4 phases of reset, reseed, enrichment, and verification  
**Duration:** ~15-20 minutes  
**Cost:** ~$0.15 (OpenAI API calls only)  

---

## Current Pipeline Status

### What I've Documented
✅ Created `/home/anchor/projects/this-is-us/worker/LSO_RESET_AND_INGEST_PIPELINE.md` (600+ line comprehensive guide)  
✅ Updated `/home/anchor/projects/this-is-us/worker/COMPLETE_EXECUTION_SUMMARY.md` (4 sections revised)  
✅ Replaced blanket SQL inserts with real verification endpoint (`/api/internal/civic/verify-bill`)  
✅ Added bash loop pattern for batch verification  
✅ Softened expectations (targets, not guarantees)  
✅ Clarified endpoint purposes (scan-pending-bills, test-bill-summary, verify-bill)  

### What Needs Your Approval
I can now execute Phases 1-4 in sequence, with full output captured and error handling.

---

## Execution Sequence Summary

### Phase 1: RESET (< 1 minute)
**Purpose:** Clear out old bills and dependent records  
**Commands:**
```bash
cd /home/anchor/projects/this-is-us/worker

# Delete in dependency order (child tables first)
npx wrangler d1 execute WY_DB --local --command "DELETE FROM votes;"
npx wrangler d1 execute WY_DB --local --command "DELETE FROM civic_item_ai_tags;"
npx wrangler d1 execute WY_DB --local --command "DELETE FROM civic_item_verification;"
npx wrangler d1 execute WY_DB --local --command "DELETE FROM bill_sponsors;"
npx wrangler d1 execute WY_DB --local --command "DELETE FROM user_ideas;"
npx wrangler d1 execute WY_DB --local --command "DELETE FROM civic_items;"
```

**Verification:**
```bash
npx wrangler d1 execute WY_DB --local --command \
  "SELECT 
     (SELECT COUNT(*) FROM civic_items) as civic_items,
     (SELECT COUNT(*) FROM bill_sponsors) as bill_sponsors,
     (SELECT COUNT(*) FROM civic_item_verification) as civic_item_verification,
     (SELECT COUNT(*) FROM civic_item_ai_tags) as civic_item_ai_tags,
     (SELECT COUNT(*) FROM votes) as votes,
     (SELECT COUNT(*) FROM user_ideas) as user_ideas;"
```

**Expected:** All counts = 0

---

### Phase 2: RESEED (2-5 minutes)
**Purpose:** Sync fresh bills from Wyoming Legislature Service (LSO)  
**Commands:**
```bash
cd /home/anchor/projects/this-is-us/worker

# Start Worker in background
npx wrangler dev --local &
sleep 3

# Call LSO sync endpoint
curl -s -X POST "http://127.0.0.1:8787/api/dev/lso/sync-committee-bills?year=2026" | jq '.'
```

**Verification:**
```bash
npx wrangler d1 execute WY_DB --local --command \
  "SELECT 
     source,
     COUNT(*) as total,
     COUNT(DISTINCT chamber) as chambers
   FROM civic_items
   GROUP BY source
   ORDER BY source;"
```

**Expected:** source=lso, total=25, chambers=2

Also verify sponsors:
```bash
npx wrangler d1 execute WY_DB --local --command \
  "SELECT 
     COUNT(DISTINCT civic_item_id) as bills_with_sponsors,
     COUNT(*) as total_sponsor_records
   FROM bill_sponsors
   WHERE civic_item_id IN (SELECT id FROM civic_items WHERE source='lso');"
```

**Expected:** bills_with_sponsors=25, total_sponsor_records=25

---

### Phase 3: ENRICH (5-10 minutes)
**Purpose:** Run AI analysis (topic matching)  
**Commands:**
```bash
# Run scan-pending-bills up to 5 times (25 bills / 5 per batch)
for i in {1..5}; do
  echo "Batch $i:"
  curl -s -X POST "http://127.0.0.1:8787/api/internal/civic/scan-pending-bills" | jq '.scanned'
  sleep 2
done
```

**Verification:**
```bash
npx wrangler d1 execute WY_DB --local --command \
  "SELECT 
     COUNT(DISTINCT ci.id) as total_bills,
     COUNT(DISTINCT ciat.item_id) as bills_with_topics,
     ROUND(AVG(ciat.confidence), 2) as avg_topic_confidence
   FROM civic_items ci
   LEFT JOIN civic_item_ai_tags ciat ON ci.id = ciat.item_id
   WHERE ci.source='lso';"
```

**Expected:** total_bills=25, bills_with_topics=18-25, avg_confidence=0.65-0.85

---

### Phase 4: VERIFY (5-10 minutes)
**Purpose:** Run structural and content verification using endpoint (NOT blind SQL)  
**Commands:**
```bash
# Extract bill IDs and loop through with verification endpoint
npx wrangler d1 execute WY_DB --local --command \
  "SELECT id FROM civic_items WHERE source='lso' ORDER BY id;" | \
  tail -n +2 | \
  while read bill_id; do
    echo "🔍 Verifying: $bill_id"
    curl -s "http://127.0.0.1:8787/api/internal/civic/verify-bill?id=$bill_id" | \
      jq -r '.verification | "\(.status) - \(.structural_reason // "ok")"'
    sleep 0.5
  done
```

**Verification (if any bills flagged):**
```bash
npx wrangler d1 execute WY_DB --local --command \
  "SELECT 
     ci.bill_number,
     civ.structural_ok,
     civ.structural_reason,
     civ.status
   FROM civic_items ci
   LEFT JOIN civic_item_verification civ ON ci.id = civ.civic_item_id
   WHERE ci.source='lso' AND civ.structural_ok = 0;"
```

**Expected:**  
- structural_ok=1 for 24-25 bills
- 0-1 bills with structural_ok=0 (if any, inspect structural_reason)

---

## Expected Final State

```
civic_items (LSO): 25 bills
bill_sponsors: 25 records (1 per bill)
civic_item_ai_tags: 18-25 records (topic matches)
civic_item_verification: 25 records (verification results)

Structural OK: 24-25 bills (96-100%)
Structural FAILED: 0-1 bill (0-4%, requires investigation)
```

---

## Execution Plan – By Phase

### Approved?

**Before I execute anything**, I need your explicit approval for each phase:

1. **Approve Phase 1 (Reset)?** – Will delete all bills and dependent records from WY_DB
2. **Approve Phase 2 (Reseed)?** – Will sync ~25 bills from LSO, create sponsors
3. **Approve Phase 3 (Enrich)?** – Will run OpenAI for topic matching (~$0.10)
4. **Approve Phase 4 (Verify)?** – Will run endpoint-based verification (~$0.05)

Each phase can be run independently after initial approval.

---

## Format for Your Approval

Reply with any of:
- **"Yes, run all phases"** – Execute 1-4 in sequence
- **"Phase 1 only"** – Just reset, wait for next instruction
- **"Phase 1-2"** – Reset and reseed, wait for enrichment approval
- **"Custom"** – Specify which phases you want

After you approve, I will:
1. Run the phase commands in the terminal
2. Capture full output (command + result)
3. Validate expected state with verification queries
4. Pause between phases for your review
5. Report any errors and suggest fixes
6. Only proceed with next phase after previous one succeeds

---

## Risk Assessment

✅ **LOW RISK** – All operations are:
- **Local-only** – Uses `--local` flag, never touches remote
- **WY_DB only** – Doesn't touch EVENTS_DB or BALLOT_DB
- **Non-destructive to code** – Only modifies documentation; Worker code unchanged
- **Non-destructive to schema** – No migrations run; tables preserved
- **Reversible** – Can re-run Phase 1 anytime to clear and start over

⚠️ **COST CONSIDERATION** – ~$0.15 for OpenAI API calls (minimal)

⚠️ **DATA CONSIDERATION** – Phase 1 DELETE is final; no undo without backup. Phase 2 recreates identical bills from LSO.

---

## What Happens If Something Fails?

If any command fails, I will:
1. Capture the full error output
2. Identify the root cause (e.g., missing endpoint, schema issue)
3. Suggest a fix (e.g., missing migration, wrong route name)
4. Apply the fix (if safe) or ask for permission
5. Re-run the failing command

---

## Documentation Reference

After updating docs, here's where to find details:
- **Full pipeline guide:** `/home/anchor/projects/this-is-us/worker/LSO_RESET_AND_INGEST_PIPELINE.md`
- **Summary updates:** `/home/anchor/projects/this-is-us/worker/COMPLETE_EXECUTION_SUMMARY.md`
- **Changes summary:** `/home/anchor/projects/this-is-us/DOCUMENTATION_UPDATES_SUMMARY.md`

---

## Ready?

**Please reply with your approval:**
- Approve Phase 1 (Reset)?
- Approve Phase 2 (Reseed)?
- Approve Phase 3 (Enrich)?
- Approve Phase 4 (Verify)?

Example: **"Yes, run all phases"** or **"Phase 1-2 first, then we review"**
