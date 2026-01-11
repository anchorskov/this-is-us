# Wyoming LSO Orchestrator: Documentation Index

**Status:** ✅ Complete | **Date:** December 16, 2025 | **Endpoint:** `POST /api/internal/admin/wyoleg/run`

---

## 📍 Start Here: Choose Your Path

### 🏃 "I just want to run it" (5 minutes)
→ Read: [ORCHESTRATOR_QUICK_REFERENCE.md](./ORCHESTRATOR_QUICK_REFERENCE.md)
- 2 KB cheat sheet
- Copy-paste curl commands
- Quick troubleshooting

### 🚀 "I want to test it locally" (15 minutes)
→ Read: [ORCHESTRATOR_LOCAL_RUN.md](./ORCHESTRATOR_LOCAL_RUN.md)
- 60-second setup
- Manual testing commands
- All parameters explained
- Database queries

### 📚 "I need comprehensive testing guide" (30 minutes)
→ Read: [ORCHESTRATOR_TESTING.md](./ORCHESTRATOR_TESTING.md)
- Quick start (3 steps)
- Complete endpoint documentation
- All 4 pipeline phases explained
- 3 testing scenarios with examples
- 6+ troubleshooting topics with SQL
- Full example test run output
- UI verification steps

### 🔧 "I need architecture details" (20 minutes)
→ Read: [ORCHESTRATOR_IMPLEMENTATION_SUMMARY.md](./ORCHESTRATOR_IMPLEMENTATION_SUMMARY.md)
- What's already implemented
- What's new in this delivery
- File manifest with locations
- Complete API reference
- Configuration reference
- Summary table of all components

### 🤖 "I want Copilot to generate more tests" (10 minutes)
→ Read: [ORCHESTRATOR_COPILOT_PROMPT.md](./ORCHESTRATOR_COPILOT_PROMPT.md)
- Ready-to-paste prompt
- Test plan breakdown (5 phases)
- Paste-ready curl commands
- Paste-ready SQL diagnostic queries
- Expected success criteria

### 📋 "I need the complete picture" (45 minutes)
→ Read: [ORCHESTRATOR_DELIVERY.md](./ORCHESTRATOR_DELIVERY.md)
- Executive summary
- Full implementation details
- All new files documented
- Quick start guide
- Testing scenarios
- Troubleshooting reference
- File manifest
- Next steps

---

## 🎯 What You Get: Summary

### Existing Infrastructure (Already in Repo)

```
POST /api/internal/admin/wyoleg/run
    ↓
Orchestrator Handler (worker/src/routes/adminWyoleg.mjs)
    ├─ Bill Sync: syncWyomingBills()
    ├─ Scan: runAdminScan()
    │   ├─ Document Resolution
    │   ├─ Summary Generation
    │   └─ Hot Topic Tagging
    └─ Logging: ingestion_runs + ingestion_run_items
```

### New Testing Infrastructure

```
Test Script (worker/scripts/test-wyoleg-orchestrator-local.sh)
    ├─ Pre-check: Table existence
    ├─ Orchestrator call
    ├─ Post-check: Data changes
    ├─ Sanity checks: Tags, docs, summaries
    ├─ API verification: /api/hot-topics, /api/civic/pending-bills-with-topics
    └─ Diagnostics: SQL if anything fails

Documentation (6 markdown files)
    ├─ Quick Reference (2 KB)
    ├─ Local Run Guide (8 KB)
    ├─ Testing Guide (16 KB)
    ├─ Implementation Summary (12 KB)
    ├─ Copilot Prompt (12 KB)
    └─ Delivery Report (17 KB)
```

---

## 📁 File Structure

```
/home/anchor/projects/this-is-us/
├── ORCHESTRATOR_QUICK_REFERENCE.md       ← START: Quick cheat sheet
├── ORCHESTRATOR_LOCAL_RUN.md             ← For: Local developers
├── ORCHESTRATOR_TESTING.md               ← For: Comprehensive testing
├── ORCHESTRATOR_IMPLEMENTATION_SUMMARY.md ← For: Architecture reference
├── ORCHESTRATOR_COPILOT_PROMPT.md        ← For: Copilot-assisted testing
├── ORCHESTRATOR_DELIVERY.md              ← For: Complete details
├── ORCHESTRATOR_INDEX.md                 ← This file
│
└── worker/
    ├── scripts/
    │   └── test-wyoleg-orchestrator-local.sh (15 KB, NEW)
    │
    └── src/
        ├── routes/
        │   ├── adminWyoleg.mjs           (Orchestrator handler)
        │   └── civicScan.mjs             (Scan/summary/tagging)
        ├── lib/
        │   └── openStatesSync.mjs        (Bill sync)
        └── index.mjs                     (Route registration)
```

---

## 🚀 Quick Start Commands

### 1. Start Dev (Terminal 1)
```bash
cd /home/anchor/projects/this-is-us
./start_local.sh
```

### 2. Run Test Suite (Terminal 2)
```bash
cd /home/anchor/projects/this-is-us/worker
./scripts/test-wyoleg-orchestrator-local.sh
```

### 3. Manual API Call
```bash
curl -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run \
  -H "X-Internal-Token: local-dev" \
  -H "Content-Type: application/json" \
  --data '{"limit": 25, "force": true, "dryRun": false}' | jq .
```

---

## 📊 Pipeline: What It Does

### Phase 1: Bill Sync
- Fetches pending Wyoming bills from OpenStates API
- Inserts/updates `civic_items`, `bill_sponsors`, `civic_item_verification`
- Result: `synced_count` bills

### Phase 2: Document Resolution
- For each bill, finds PDF URL from wyoleg.gov
- Tries: Introduced, Enroll, Digest, Fiscal, Amendment
- Caches in `civic_item_sources`
- Result: `resolved_docs_count` URLs

### Phase 3: Summary Generation
- Reads bill text from resolved PDF
- Calls OpenAI to generate summary
- Stores in `civic_items.ai_summary` and `ai_key_points`
- Result: `summaries_written` summaries

### Phase 4: Hot Topic Tagging
- Analyzes summary against all hot topics
- Calculates confidence (0.0-1.0)
- Stores tags in `civic_item_ai_tags`
- Result: `tags_written` tags

### Phase 5: Logging
- Records run in `ingestion_runs`
- Records per-bill details in `ingestion_run_items`
- Returns metrics in response

---

## 📍 API Endpoint Reference

### POST /api/internal/admin/wyoleg/run

**Headers:**
```
X-Internal-Token: local-dev  (localhost)
Content-Type: application/json
```

**Body Parameters:**
| Name | Type | Default | Purpose |
|------|------|---------|---------|
| `limit` | number | 25 | Max bills per phase |
| `force` | boolean | false | Re-scan all (bypass cache) |
| `dryRun` | boolean | false | Show without writing |
| `billId` | string | null | Single bill ID |
| `session` | string | current year | Legislative year |

**Success Response (200):**
```json
{
  "run_id": "run-1702771200000-abc123",
  "started_at": "2025-12-16T15:20:00.000Z",
  "finished_at": "2025-12-16T15:21:30.000Z",
  "synced_count": 12,
  "scanned_count": 12,
  "resolved_docs_count": 10,
  "summaries_written": 12,
  "tags_written": 18,
  "errors": []
}
```

**Error Response (401, 403, 500, etc):**
```json
{
  "error": "Unauthorized",
  "message": "Invalid token"
}
```

---

## 🧪 Test Script Options

```bash
# Full test (default)
./scripts/test-wyoleg-orchestrator-local.sh

# Dry-run mode (no database writes)
./scripts/test-wyoleg-orchestrator-local.sh --dry-run

# API-only (skip D1 database checks)
./scripts/test-wyoleg-orchestrator-local.sh --api-only
```

**What Test Script Does:**
1. ✅ Checks D1 tables exist
2. ✅ Shows initial row counts
3. ✅ Calls orchestrator endpoint
4. ✅ Shows updated row counts
5. ✅ Verifies hot topics API
6. ✅ Verifies pending bills API
7. ✅ If fails, prints diagnostic SQL

---

## 🛠️ Database Tables (Logging)

### ingestion_runs
Logs each orchestrator execution:
```sql
SELECT run_id, started_at, synced_count, scanned_count, tags_written 
FROM ingestion_runs 
ORDER BY started_at DESC LIMIT 5;
```

### ingestion_run_items
Logs each bill processed in a run:
```sql
SELECT bill_number, phase, status, message 
FROM ingestion_run_items 
WHERE run_id = 'run-...' 
LIMIT 10;
```

---

## ❌ Common Issues & Quick Fixes

| Issue | Fix |
|-------|-----|
| 401 Unauthorized | Add: `-H "X-Internal-Token: local-dev"` |
| 403 Scanner disabled | Export: `BILL_SCANNER_ENABLED=true` |
| No bills synced | Run: `./scripts/test-wyoleg-pipeline-local.sh --reset` |
| Hot topics empty | See troubleshooting in ORCHESTRATOR_TESTING.md |
| Slow/timeout | Reduce: `"limit": 5` (instead of 25) |

---

## 📖 Documentation by Purpose

| Goal | File | Size | Time |
|------|------|------|------|
| Quick start | ORCHESTRATOR_QUICK_REFERENCE.md | 2 KB | 2 min |
| Local testing | ORCHESTRATOR_LOCAL_RUN.md | 8 KB | 5 min |
| Detailed guide | ORCHESTRATOR_TESTING.md | 16 KB | 20 min |
| Architecture | ORCHESTRATOR_IMPLEMENTATION_SUMMARY.md | 12 KB | 10 min |
| Copilot prompt | ORCHESTRATOR_COPILOT_PROMPT.md | 12 KB | 5 min |
| Everything | ORCHESTRATOR_DELIVERY.md | 17 KB | 30 min |

---

## ✅ Success Criteria

After running test script, you should see:

✅ D1 tables exist (hot_topics, civic_items, civic_item_ai_tags)  
✅ Orchestrator endpoint returns 200  
✅ Row counts increased after run  
✅ /api/hot-topics returns topics with bills  
✅ /api/civic/pending-bills-with-topics returns bills with topics  
✅ No errors (or diagnostic SQL provided)

---

## 🔄 Next Steps

1. **Test Locally:**
   ```bash
   ./scripts/test-wyoleg-orchestrator-local.sh
   ```

2. **Review Output:**
   - Look for ✅ marks
   - If ⚠️ or ❌, follow diagnostic SQL

3. **Commit to Git:**
   ```bash
   git add ORCHESTRATOR*.md ORCHESTRATOR_LOCAL_RUN.md \
           worker/scripts/test-wyoleg-orchestrator-local.sh
   git commit -m "docs: Add Wyoming LSO orchestrator testing suite"
   ```

4. **Deploy:**
   - After code review
   - Monitor ingestion_runs table

---

## 📞 Need Help?

- **Quick answer:** Check ORCHESTRATOR_QUICK_REFERENCE.md
- **How to run:** Check ORCHESTRATOR_LOCAL_RUN.md
- **Problem solving:** Check ORCHESTRATOR_TESTING.md → Troubleshooting
- **Details:** Check ORCHESTRATOR_DELIVERY.md

---

## 🎯 Key Files at a Glance

### New Files (This Delivery)

| File | Purpose | Size |
|------|---------|------|
| `ORCHESTRATOR_QUICK_REFERENCE.md` | Cheat sheet | 2 KB |
| `ORCHESTRATOR_LOCAL_RUN.md` | How to run locally | 8 KB |
| `ORCHESTRATOR_TESTING.md` | Comprehensive testing | 16 KB |
| `ORCHESTRATOR_IMPLEMENTATION_SUMMARY.md` | Architecture | 12 KB |
| `ORCHESTRATOR_COPILOT_PROMPT.md` | For Copilot | 12 KB |
| `ORCHESTRATOR_DELIVERY.md` | Complete report | 17 KB |
| `worker/scripts/test-wyoleg-orchestrator-local.sh` | Test script | 15 KB |

### Existing Files (Core Infrastructure)

| File | Purpose |
|------|---------|
| `worker/src/routes/adminWyoleg.mjs` | Orchestrator handler |
| `worker/src/routes/civicScan.mjs` | Scan/summary/tagging |
| `worker/src/lib/openStatesSync.mjs` | Bill sync |
| `worker/src/index.mjs` | Route registration |
| `worker/migrations_wy/0026_create_ingestion_runs.sql` | D1 tables |

---

## 🎉 You're All Set!

**Status:** ✅ Complete & Production Ready

Start with: `./scripts/test-wyoleg-orchestrator-local.sh`

---

**For detailed information, choose your path at the top of this file.**

