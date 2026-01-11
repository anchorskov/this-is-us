# Quick Fix: Podcast Summary Source Drift

**Problem:** Local dev doesn't show podcast summaries (production does)  
**Cause:** Local EVENTS_DB is empty; production has data  
**Solution:** 4-step sync process

---

## 🚀 Quick Fix (5 minutes)

### Step 1: Clean Wrangler State (1 min)
```bash
cd /home/anchor/projects/this-is-us
./worker/scripts/cleanup-./scripts/wr-drift.sh
# Type 'yes' when prompted
```

### Step 2: Start Wrangler with Persistent DB (1 min)
```bash
# Terminal 1:
cd worker
./scripts/wr dev --local --persist-to ./worker/../scripts/wr-persist
# Wait for "Ready on http://127.0.0.1:8787"
```

### Step 3: Seed Production Data into Local (1 min)
```bash
# Terminal 2:
cd /home/anchor/projects/this-is-us
./worker/scripts/seed-podcast-local.sh
# Wait for "SEEDING COMPLETE"
```

### Step 4: Test (1 min)
```bash
# Terminal 3:
curl 'http://127.0.0.1:8787/api/podcast/summary?guest=jr-riggins&date=2025-12-14&part=1'
# Should return summary with "Part 1 is a plainspoken sit-down..."
```

---

## 🔍 What's Happening

| Environment | Status | Rows | Summary |
|-------------|--------|------|---------|
| **Local** (before fix) | ❌ Empty | 0 | Null |
| **Local** (after seed) | ✅ Synced | 3 | "Part 1 is a plainspoken..." |
| **Production** | ✅ Always had | 3 | "Part 1 is a plainspoken..." |

---

## 📊 Diagnostic Script

Check status anytime:
```bash
./worker/scripts/podcast-debug.sh
```

Shows:
- Wrangler state (drift detection)
- Local row count
- Remote row count
- API endpoint status
- Parity analysis

---

## �� Files Modified

- ✅ `worker/src/routes/podcastSummary.mjs` - Added diagnostic logging
- ✅ `worker/scripts/podcast-debug.sh` - New diagnostic tool
- ✅ `worker/scripts/seed-podcast-local.sh` - New seeding tool
- ✅ `worker/scripts/cleanup-./scripts/wr-drift.sh` - New cleanup tool

---

## ✨ Result

After the 4 steps:
- ✅ Local summaries working
- ✅ Matches production behavior
- ✅ No more "Summary not available" message
- ✅ Click "Show summary" and see full text

---

**Time:** ~5 minutes total  
**Prerequisites:** None (just need ./scripts/wr running)  
**Success indicator:** API returns full summary text instead of null
