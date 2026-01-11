# Bill Summaries Fix - Testing Guide

## Quick Start (Copy-Paste Ready)

After restarting the worker, run these commands in sequence:

### Step 1: Clear Old Empty Summaries
```bash
cd /home/anchor/projects/this-is-us/worker && \
./scripts/wr d1 execute WY_DB --local --command \
  "UPDATE civic_items SET ai_summary=NULL, ai_key_points=NULL WHERE source='lso';" && \
echo "✅ Cleared old summaries"
```

### Step 2: Run Scan-Pending-Bills to Generate Summaries
```bash
curl -s -X POST "http://127.0.0.1:8787/api/internal/civic/scan-pending-bills" | jq '.results[] | {bill_number, summary_generated}'
```
**Expected Output:**
```
{
  "bill_number": "HB0008",
  "summary_generated": true
}
{
  "bill_number": "HB0009",
  "summary_generated": true
}
... (5 bills total)
```

### Step 3: Verify Summaries in Database
```bash
cd /home/anchor/projects/this-is-us/worker && \
./scripts/wr d1 execute WY_DB --local --command \
  "SELECT bill_number, substr(ai_summary, 1, 100) as preview FROM civic_items WHERE source='lso' LIMIT 5;"
```
**Expected Output:**
```
┌─────────────┬──────────────────────────────────────────────────┐
│ bill_number │ preview                                          │
├─────────────┼──────────────────────────────────────────────────┤
│ HB0008      │ Creates law to strengthen protections for minors │
│ HB0009      │ Establishes offense for grooming of minors...    │
│ HB0010      │ Requires restrictions on sexually explicit...    │
│ SF0007      │ Modifies theft offenses and penalties...        │
│ SF0008      │ Makes absconding for criminal purposes an...    │
└─────────────┴──────────────────────────────────────────────────┘
```

### Step 4: Test API Endpoint
```bash
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics" | \
jq '.results[0] | {bill_number, title, ai_plain_summary}'
```
**Expected Output:**
```json
{
  "bill_number": "HB0008",
  "title": "Stalking of minors.",
  "ai_plain_summary": "Creates law to strengthen protections for minors against stalking behaviors. Establishes penalties for those who engage in patterns of unwanted contact targeting minors."
}
```

### Step 5: Manual UI Test
1. Open browser to: `http://localhost:8787/civic/pending-bills` (or your local dev URL)
2. Should see bill cards with:
   - ✅ Bill number (HB0008, etc.)
   - ✅ Title
   - ✅ **Plain summary text** (NOT "Summary unavailable")
   - ✅ Sponsor info
   - ✅ Verification badge

---

## Detailed Verification Steps

### Verify Count of Summaries
```bash
cd /home/anchor/projects/this-is-us/worker && \
./scripts/wr d1 execute WY_DB --local --command \
  "SELECT 
    COUNT(*) as total_lso_bills,
    COUNT(CASE WHEN ai_summary IS NOT NULL AND ai_summary != '' THEN 1 END) as with_content
  FROM civic_items WHERE source='lso';"
```
**Expected:** total_lso_bills=25, with_content≥20 (at least 4 of 5 batches)

### Check Key Points Saved
```bash
cd /home/anchor/projects/this-is-us/worker && \
./scripts/wr d1 execute WY_DB --local --command \
  "SELECT bill_number, ai_key_points FROM civic_items WHERE source='lso' AND ai_key_points IS NOT NULL LIMIT 2;"
```
**Expected:** ai_key_points contains JSON array like: `["Change 1", "Change 2"]`

### Check Summary Generation Timestamp
```bash
cd /home/anchor/projects/this-is-us/worker && \
./scripts/wr d1 execute WY_DB --local --command \
  "SELECT bill_number, ai_summary_generated_at FROM civic_items WHERE source='lso' LIMIT 3;"
```
**Expected:** Recent timestamps (within last 5 minutes)

---

## Troubleshooting

### Problem: summary_generated shows false
**Cause:** OpenAI returned empty summary
**Solution:** Check worker logs for "⚠️ Title-only analyzer returned no summary"
**Fix:** Most titles are clear - if title is genuinely ambiguous, it's working as designed

### Problem: API returns empty ai_plain_summary
**Cause:** Database has NULL or empty string
**Solution:** Re-run Step 1 to clear, then Step 2 to regenerate

### Problem: curl returns 401 error (invalid API key)
**Cause:** OPENAI_API_KEY not in .dev.vars or wrong value
**Solution:** 
1. Check: `cat /home/anchor/projects/this-is-us/worker/.dev.vars | grep OPENAI`
2. Should show: `OPENAI_API_KEY=sk-proj-...`
3. If missing/wrong, add correct key and restart worker

### Problem: UI shows "Summary unavailable" 
**Cause:** Query returned empty ai_plain_summary
**Solution:** 
1. Run Step 3 to verify database has content
2. If database empty, run Step 2
3. If database has content but UI doesn't, may be caching - hard refresh browser

### Problem: Worker crashes during scan-pending-bills
**Cause:** Possible unhandled exception
**Solution:** 
1. Check worker logs for stack trace
2. Verify OPENAI_API_KEY is set correctly
3. Try single bill: `curl -s -X POST "http://127.0.0.1:8787/api/internal/civic/test-bill-summary?bill_id=HB0008&save=true"`

---

## Partial Execution (5 Bills at a Time)

The scan-pending-bills endpoint processes 5 bills per call (by design for safety).

To process all 25 LSO bills:

```bash
for batch in 1 2 3 4 5; do
  echo "━━━━━━━━━━━━━━━━━ Batch $batch ━━━━━━━━━━━━━━━━━"
  curl -s -X POST "http://127.0.0.1:8787/api/internal/civic/scan-pending-bills" | \
    jq '.results[] | {bill_number, summary_generated}'
  sleep 2
done
```

After 5 batches, all bills should have summaries.

---

## Success Criteria

✅ **Test 1 Pass:** summary_generated: true appears in response  
✅ **Test 2 Pass:** Database queries show actual summary text  
✅ **Test 3 Pass:** API returns non-empty ai_plain_summary  
✅ **Test 4 Pass:** Browser shows summaries on bill cards  

**All 4 tests passing = FIX VALIDATED** ✨

---

## Rollback (If Needed)

If you need to revert to the old behavior:

```bash
cd /home/anchor/projects/this-is-us/worker

# 1. Revert code changes
git checkout HEAD -- src/routes/civicScan.mjs src/lib/billSummaryAnalyzer.mjs

# 2. Restart worker
# (Kill and restart ./scripts/wr dev --local)

# 3. Clear summaries (optional)
./scripts/wr d1 execute WY_DB --local --command \
  "UPDATE civic_items SET ai_summary=NULL WHERE source='lso';"
```

---

## Performance Notes

- **Batch Processing:** 5 bills per scan-pending-bills call
- **Speed:** ~3-5 seconds per batch (including OpenAI latency)
- **Cost:** ~$0.0015 per 25 bills (negligible)
- **Caching:** Summaries cached after generation (no re-computation)

---

## Files Involved

- `worker/src/routes/civicScan.mjs` - Phase 3 of scan pipeline
- `worker/src/lib/billSummaryAnalyzer.mjs` - AI summary generation
- `worker/.dev.vars` - API key configuration
- No database schema changes needed
- No UI changes needed

---

Good luck! Let me know if you hit any issues during testing.
