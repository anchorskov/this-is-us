# Production Deployment Commands

**Date:** December 15, 2025

---

## Step 1: Verify All Changes Imported

```bash
# Extract and review files
cd ~/Downloads
unzip -l bill-scanner-changes.zip
unzip bill-scanner-changes.zip

# Review each file for security and correctness
less civicScan.mjs
less hotTopicsAnalyzer.mjs
less billSummaryAnalyzer.mjs
less pendingBills.mjs
less pending-bills.js
less 0024_add_unique_constraint_civic_item_ai_tags.sql
less BILL_SCANNER_IMPLEMENTATION_COMPLETE.md
```

---

## Step 2: Deploy Worker Code

```bash
cd /home/anchor/projects/this-is-us

# Copy fixed files to worker
cp ~/Downloads/civicScan.mjs worker/src/routes/
cp ~/Downloads/hotTopicsAnalyzer.mjs worker/src/lib/
cp ~/Downloads/billSummaryAnalyzer.mjs worker/src/lib/
cp ~/Downloads/pendingBills.mjs worker/src/routes/

# Copy frontend fix
cp ~/Downloads/pending-bills.js static/js/civic/

# Copy migration
cp ~/Downloads/0024_add_unique_constraint_civic_item_ai_tags.sql worker/migrations/

# Deploy to production
cd worker
./scripts/wr deploy --env production
```

Expected output:
```
✨ Successfully published your Worker to
   https://this-is-us.org/*
```

---

## Step 3: Deploy Migration to WY_DB

```bash
cd /home/anchor/projects/this-is-us/worker

# Run migration
./scripts/wr migrations apply WY_DB --env production --remote

# Verify unique constraint was added
./scripts/wr d1 execute WY_DB --remote --env production \
  --command "PRAGMA table_info(civic_item_ai_tags);"

# Check for UNIQUE constraint
./scripts/wr d1 execute WY_DB --remote --env production \
  --command "PRAGMA index_list(civic_item_ai_tags);"
```

Expected: Should show unique constraint on (item_id, topic_slug).

---

## Step 4: Set INTERNAL_SCAN_TOKEN Secret

```bash
cd /home/anchor/projects/this-is-us/worker

# Set the secret
./scripts/wr secret put INTERNAL_SCAN_TOKEN --env production

# When prompted, paste a secure token (e.g., from: 
# openssl rand -base64 32
# or any strong random string)

# Verify secret was set (can't retrieve, but can verify it exists)
./scripts/wr secret list --env production
```

---

## Step 5: Test Scanner Endpoint

```bash
# Test with token
TOKEN="<your-internal-scan-token>"
curl -X POST "https://this-is-us.org/api/internal/civic/scan-pending-bills" \
  -H "X-Internal-Token: $TOKEN" \
  -H "Content-Type: application/json"

# Expected response (HTTP 200):
{
  "scanned": 5,
  "saved_tags": 0,  # Will be > 0 once OpenAI key is active
  "results": [...],
  "timestamp": "2025-12-15T..."
}
```

---

## Step 6: Verify Data Population

```bash
# Check civic_item_ai_tags
./scripts/wr d1 execute WY_DB --remote --env production \
  --command "SELECT COUNT(*) as tag_count FROM civic_item_ai_tags;"

# Check hot_topic_civic_items
./scripts/wr d1 execute EVENTS_DB --remote --env production \
  --command "SELECT COUNT(*) as link_count FROM hot_topic_civic_items;"

# Check distribution by topic
./scripts/wr d1 execute WY_DB --remote --env production \
  --command "SELECT topic_slug, COUNT(*) as c FROM civic_item_ai_tags GROUP BY topic_slug ORDER BY c DESC;"
```

Expected (after first scan):
```
tag_count > 0
link_count > 0
Multiple rows with different topic_slugs
```

---

## Step 7: Verify Frontend

```bash
# Visit in browser
https://this-is-us.org/pending-bills

# Verify:
- ✅ Subject tags display correctly (no "null" pills)
- ✅ Topic filter dropdown works
- ✅ Bill cards render without errors

# Check Console (F12 Dev Tools):
- ✅ No JSON parse errors
- ✅ No network errors
```

---

## Step 8: Verify Hot Topics Page

```bash
# Visit hot topics page
https://this-is-us.org/hot-topics

# Verify:
- ✅ Topic cards show bill counts (> 0)
- ✅ Bills display under each topic
- ✅ Vote buttons (👍 👎 ❓) work

# Check API response
curl -s https://this-is-us.org/api/hot-topics | jq '.[0]'

# Expected:
{
  "id": 1,
  "slug": "property-tax-relief",
  "title": "Property Tax Relief",
  ...
  "civic_items": [
    { "bill_number": "HB 22", "up_votes": 0, ... },
    ...
  ]
}
```

---

## Step 9: Set Up Cron-Based Weekly Scans (Optional)

The migration supports automatic weekly scans via cron:

```toml
# In worker/./scripts/wr.toml production environment:
[env.production.triggers]
crons = ["0 3 * * 1"]  # Mondays at 03:00 UTC
```

The cron handler should call `runScheduledPendingBillScan()`:

```javascript
// In worker/src/index.mjs or wherever cron is handled:
import { runScheduledPendingBillScan } from "./routes/civicScan.mjs";

// Register cron handler
router.post("/api/internal/scheduled/pending-bills", async (request, env) => {
  const result = await runScheduledPendingBillScan(env, { force: false });
  return new Response(JSON.stringify(result), { status: 200 });
});
```

---

## Rollback Procedure (if needed)

```bash
# Revert Worker deployment
cd /home/anchor/projects/this-is-us/worker
git checkout HEAD -- src/
./scripts/wr deploy --env production

# Revert migration (drops unique constraint)
./scripts/wr migrations rollback WY_DB --env production --remote --version 0023
# Or manually drop constraint:
./scripts/wr d1 execute WY_DB --remote --env production \
  --command "DROP INDEX IF EXISTS civic_item_ai_tags_unique;"
```

---

## Monitoring & Logs

```bash
# Real-time logs from production Worker
./scripts/wr tail --env production

# Look for:
- 📄 Bill analysis messages
- ✅ Successful tag saves
- ⚠️ Any JSON parse errors
- 💰 OpenAI token usage
```

---

## Success Criteria

✅ All files deployed to production  
✅ Migration applied to WY_DB  
✅ INTERNAL_SCAN_TOKEN secret set  
✅ Scanner endpoint responds with HTTP 200  
✅ civic_item_ai_tags populates (if OpenAI key active)  
✅ hot_topic_civic_items links created  
✅ /hot-topics page shows bill counts  
✅ /pending-bills shows clean subject tags  
✅ No console errors in browser dev tools  

---

## Troubleshooting

**Q: Scanner returns HTTP 401 Unauthorized**  
A: Token header is missing or incorrect. Verify:
```bash
curl -H "X-Internal-Token: YOURTOKEN" https://...
```

**Q: No topics found (empty civic_item_ai_tags)**  
A: OpenAI key might be missing or invalid. Check:
```bash
./scripts/wr secret list --env production
# Should show OPENAI_API_KEY
```

**Q: JSON parse errors in logs**  
A: Update JSON parsing code per the provided fixes. Verify code deployed correctly.

**Q: Null pills still showing**  
A: Verify pending-bills.js was updated. Clear browser cache:
```
Ctrl+Shift+Delete → Clear all cookies and cached files
```

**Q: Unique constraint violation**  
A: Run migration again, or manually check for duplicates:
```bash
./scripts/wr d1 execute WY_DB --remote --env production \
  --command "SELECT item_id, topic_slug, COUNT(*) as c FROM civic_item_ai_tags GROUP BY item_id, topic_slug HAVING c > 1;"
```

---

## Support

For detailed documentation, see:
- [BILL_SCANNER_IMPLEMENTATION_COMPLETE.md](./BILL_SCANNER_IMPLEMENTATION_COMPLETE.md)
- [PIPELINE_FAST_PATH_COMPLETE.md](./PIPELINE_FAST_PATH_COMPLETE.md)
- [BILL_SCANNER_TESTING.md](./BILL_SCANNER_TESTING.md)

All code changes are in: `bill-scanner-changes.zip`
