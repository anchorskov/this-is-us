# Debugging: Empty Pending Bills Endpoint

## Critical WHERE Clause Filters in Handler

The endpoint `/api/civic/pending-bills-with-topics` requires **ALL** of these:
```sql
WHERE ci.kind = 'bill'
  AND ci.level = 'statewide'
  AND ci.jurisdiction_key = 'WY'
  AND ci.source = 'lso'                           ← KEY FILTER
  AND ci.status IN ('introduced','in_committee','pending_vote')
  AND civ.structural_ok = 1 AND civ.status = 'ok' ← UNLESS ?include_flagged=true
  AND civh.review_status = 'ready'                ← UNLESS ?include_incomplete=true
```

---

## Debug Commands (Run Sequentially)

### Step 1: Check total civic_items count
```bash
cd /home/anchor/projects/this-is-us/worker
npx wrangler d1 execute WY_DB --local --command "SELECT COUNT(*) as count FROM civic_items;"
```
**Expected:** > 0. If 0 → no data ingested yet (skip to Step 5).

---

### Step 2: Check data by kind/level/jurisdiction
```bash
npx wrangler d1 execute WY_DB --local --command "
  SELECT kind, level, jurisdiction_key, COUNT(*) as count
    FROM civic_items
   GROUP BY kind, level, jurisdiction_key
   ORDER BY count DESC;"
```
**Expected:** Row with `kind='bill'`, `level='statewide'`, `jurisdiction_key='WY'`. If missing → data not properly ingested.

---

### Step 3: Check by source
```bash
npx wrangler d1 execute WY_DB --local --command "
  SELECT source, COUNT(*) as count FROM civic_items GROUP BY source ORDER BY count DESC;"
```
**Expected:** Row with `source='lso'` and count > 0. If **0** → bills not from LSO source.

---

### Step 4: Check status distribution
```bash
npx wrangler d1 execute WY_DB --local --command "
  SELECT status, COUNT(*) as count FROM civic_items WHERE source='lso' GROUP BY status;"
```
**Expected:** Rows with `status` IN `['introduced','in_committee','pending_vote']`. If all have other statuses (e.g., 'dead', 'passed') → no bills in pending state.

---

### Step 5: Check LSO bills count
```bash
npx wrangler d1 execute WY_DB --local --command "
  SELECT COUNT(*) as lso_bills FROM civic_items
   WHERE source = 'lso'
     AND kind = 'bill'
     AND level = 'statewide'
     AND jurisdiction_key = 'WY'
     AND status IN ('introduced','in_committee','pending_vote');"
```
**Expected:** > 0. If 0 → filtered out by status. If > 0 → issue is verification tables.

---

### Step 6: Check verification records
```bash
npx wrangler d1 execute WY_DB --local --command "
  SELECT check_type, COUNT(*) as count FROM civic_item_verification GROUP BY check_type;"
```
**Expected:** Rows for `check_type` IN `['review_pipeline', 'lso_hydration']`. If missing/count=0 → verification not created.

---

### Step 7: Check verification filter status
```bash
npx wrangler d1 execute WY_DB --local --command "
  SELECT check_type, status, COUNT(*) as count 
    FROM civic_item_verification 
   GROUP BY check_type, status;"
```
**Expected:** For `lso_hydration`: `review_status='ready'`. For `review_pipeline`: `status='ok'`. If `review_status != 'ready'` or `status != 'ok'` → filtered out.

---

### Step 8: Minimal query without verification filters
```bash
npx wrangler d1 execute WY_DB --local --command "
  SELECT COUNT(*) as count FROM civic_items ci
   WHERE ci.kind = 'bill'
     AND ci.level = 'statewide'
     AND ci.jurisdiction_key = 'WY'
     AND ci.source = 'lso'
     AND ci.status IN ('introduced','in_committee','pending_vote');"
```
**Expected:** > 0. If > 0 but endpoint returns empty → verification table filters are blocking.

---

### Step 9: Test endpoint with filters disabled
```bash
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics?include_flagged=true&include_incomplete=true" | jq '.results | length'
```
**Expected:** > 0 if Step 8 was > 0. This disables verification filters.

---

### Step 10: Sample single bill details
```bash
npx wrangler d1 execute WY_DB --local --command "
  SELECT id, bill_number, title, status, source, kind, level, jurisdiction_key
    FROM civic_items
   WHERE source = 'lso'
   LIMIT 1;"
```
**Expected:** One row with `source='lso'` and valid fields.

---

## Triage Decision Tree

```
├─ Step 1: count = 0?
│  └─ YES → RUN INGEST (see below)
│  └─ NO → Go to Step 2
│
├─ Step 2: bill/statewide/WY row exists?
│  └─ NO → Data structure mismatch → Check ingestion code
│  └─ YES → Go to Step 3
│
├─ Step 3: source='lso' count > 0?
│  └─ NO → Wrong source (e.g., 'openstates') → Reingest with correct source
│  └─ YES → Go to Step 4
│
├─ Step 4: Pending statuses exist?
│  └─ NO → All bills 'passed'/'dead' → Ingest newer session
│  └─ YES → Go to Step 5
│
├─ Step 5: Meets WHERE clause?
│  └─ NO → Logic error → Debug specific filter
│  └─ YES → Go to Step 6
│
├─ Step 6: Verification records exist?
│  └─ NO → Run scan-pending-bills to generate
│  └─ YES → Go to Step 7
│
├─ Step 7: Verification status='ok' & review_status='ready'?
│  └─ NO → Run with ?include_flagged=true&include_incomplete=true (Step 9)
│  └─ YES → Endpoint should return results
│
└─ Step 9: Results appear with filters disabled?
   └─ YES → Verification records need updating → Run scan again
   └─ NO → Join logic broken → Check handler code
```

---

## If Data is Empty: Run Ingestion

**Scenario:** Steps 1-5 show 0 bills.

```bash
# Terminal 1: Start worker
cd /home/anchor/projects/this-is-us
./start_wrangler.sh

# Terminal 2: Ingest bills
curl -X POST "http://127.0.0.1:8787/api/dev/lso/hydrate-bills?year=2025&limit=25"
```

**Expected:**
```json
{"ok": true, "inserted": 15, "updated": 5, "hydrated": 20, "errors": 0}
```

Then re-run Step 5.

---

## If Verification Filters Block Results: Regenerate

**Scenario:** Step 8 > 0 but Step 9 still empty.

Run scan:
```bash
curl -X POST "http://127.0.0.1:8787/api/internal/civic/scan-pending-bills?limit=10"
```

**Expected:**
```json
{"ok": true, "scanned": 10, "tagged": 8}
```

Then retry endpoint:
```bash
curl http://127.0.0.1:8787/api/civic/pending-bills-with-topics | jq '.results | length'
```

---

## Full Diagnostic Script

Save as `debug_pending_bills.sh`:

```bash
#!/bin/bash
set -e

cd /home/anchor/projects/this-is-us/worker

echo "🔍 PENDING BILLS DIAGNOSTICS"
echo "=============================="

echo "1️⃣  Total civic_items:"
npx wrangler d1 execute WY_DB --local --command "SELECT COUNT(*) FROM civic_items;" 2>/dev/null | tail -1

echo "2️⃣  By kind/level/jurisdiction:"
npx wrangler d1 execute WY_DB --local --command "
  SELECT kind, level, jurisdiction_key, COUNT(*) FROM civic_items 
  GROUP BY kind, level, jurisdiction_key ORDER BY COUNT(*) DESC;" 2>/dev/null | head -5

echo "3️⃣  By source:"
npx wrangler d1 execute WY_DB --local --command "
  SELECT source, COUNT(*) FROM civic_items GROUP BY source;" 2>/dev/null | grep "lso"

echo "4️⃣  LSO bills by status:"
npx wrangler d1 execute WY_DB --local --command "
  SELECT status, COUNT(*) FROM civic_items WHERE source='lso' GROUP BY status;" 2>/dev/null

echo "5️⃣  Pending (introduced/in_committee/pending_vote):"
npx wrangler d1 execute WY_DB --local --command "
  SELECT COUNT(*) FROM civic_items 
  WHERE source='lso' AND status IN ('introduced','in_committee','pending_vote');" 2>/dev/null | tail -1

echo "6️⃣  Verification check_type counts:"
npx wrangler d1 execute WY_DB --local --command "
  SELECT check_type, COUNT(*) FROM civic_item_verification GROUP BY check_type;" 2>/dev/null

echo "7️⃣  Verification status:'ok' & review_status:'ready':"
npx wrangler d1 execute WY_DB --local --command "
  SELECT COUNT(*) FROM civic_item_verification 
  WHERE (check_type='review_pipeline' AND status='ok') 
     OR (check_type='lso_hydration' AND review_status='ready');" 2>/dev/null | tail -1

echo ""
echo "8️⃣  Endpoint test (without filters):"
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics?include_flagged=true&include_incomplete=true" | jq '.results | length'

echo "9️⃣  Endpoint test (with filters):"
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics" | jq '.results | length'

echo ""
echo "✅ Diagnostics complete"
```

Run:
```bash
chmod +x debug_pending_bills.sh
./debug_pending_bills.sh
```
