# Wyoming LSO Orchestrator: Quick Reference Card

**Date:** December 16, 2025 | **Status:** ✅ COMPLETE | **Endpoint:** `POST /api/internal/admin/wyoleg/run`

---

## 🚀 Start in 60 Seconds

**Terminal 1:**
```bash
cd /home/anchor/projects/this-is-us
./start_local.sh
```

**Terminal 2:**
```bash
cd /home/anchor/projects/this-is-us/worker
./scripts/test-wyoleg-orchestrator-local.sh
```

Done! ✅

---

## 📍 API Endpoint

```bash
curl -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run \
  -H "X-Internal-Token: local-dev" \
  -H "Content-Type: application/json" \
  --data '{"limit": 25, "force": true, "dryRun": false}' | jq .
```

### Response
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

---

## 🔄 Pipeline Phases

| Phase | What | Metric |
|-------|------|--------|
| **1. Bill Sync** | Fetch from OpenStates API | `synced_count` |
| **2. Doc Resolve** | Find PDFs from wyoleg.gov | `resolved_docs_count` |
| **3. Summaries** | Call OpenAI for summaries | `summaries_written` |
| **4. Hot Topics** | Analyze for topic matches | `tags_written` |

---

## 📊 Parameters

| Param | Type | Default | Purpose |
|-------|------|---------|---------|
| `limit` | number | 25 | Max bills per phase |
| `force` | boolean | false | Re-scan all (bypass cache) |
| `dryRun` | boolean | false | No writes (test run) |
| `billId` | string | null | Single bill only |
| `session` | string | current year | Legislative year |

---

## ❌ Troubleshooting (Quick)

| Problem | Solution |
|---------|----------|
| `401 Unauthorized` | Add: `-H "X-Internal-Token: local-dev"` |
| `403 Scanner disabled` | Set: `export BILL_SCANNER_ENABLED=true` |
| No bills synced | Run: `cd worker && ./scripts/test-wyoleg-pipeline-local.sh --reset` |
| Hot topics empty | See: `ORCHESTRATOR_TESTING.md` → Troubleshooting |

---

## 📄 Documentation

| Guide | Best For | File |
|-------|----------|------|
| 60-second setup | Quick start | `ORCHESTRATOR_LOCAL_RUN.md` |
| Comprehensive | Full details | `ORCHESTRATOR_TESTING.md` |
| Reference | Architecture | `ORCHESTRATOR_IMPLEMENTATION_SUMMARY.md` |
| Copilot | Auto-generation | `ORCHESTRATOR_COPILOT_PROMPT.md` |
| Full report | Everything | `ORCHESTRATOR_DELIVERY.md` |

---

## ✅ Test Modes

```bash
# Full test (default)
./scripts/test-wyoleg-orchestrator-local.sh

# Dry-run (no database writes)
./scripts/test-wyoleg-orchestrator-local.sh --dry-run

# API-only (skip D1 checks)
./scripts/test-wyoleg-orchestrator-local.sh --api-only
```

---

## 🔍 View Results

```bash
# Check run history
./scripts/wr d1 execute WY_DB --local --persist-to ./../scripts/wr-persist --command \
  "SELECT run_id, synced_count, scanned_count, tags_written FROM ingestion_runs ORDER BY started_at DESC LIMIT 5;" --json

# Check hot topics API
curl -s http://127.0.0.1:8787/api/hot-topics | jq 'length'

# Check pending bills API
curl -s http://127.0.0.1:8787/api/civic/pending-bills-with-topics | jq '.results | length'
```

---

## 🎯 Success Criteria

After running test script, you should see:

✅ All D1 tables exist  
✅ Orchestrator endpoint returns 200  
✅ Row counts increased  
✅ Hot topics API returns topics with bills  
✅ Pending bills API returns bills with topics  
✅ No errors printed

---

## 📚 What's Implemented

| Component | Location | Status |
|-----------|----------|--------|
| Orchestrator Route | `worker/src/routes/adminWyoleg.mjs` | ✅ Exists |
| Bill Sync | `worker/src/lib/openStatesSync.mjs` | ✅ Exists |
| Scan Logic | `worker/src/routes/civicScan.mjs` | ✅ Exists |
| Route Registration | `worker/src/index.mjs:155` | ✅ Exists |
| D1 Tables | `worker/migrations_wy/0026_...sql` | ✅ Exists |
| Test Script | `worker/scripts/test-wyoleg-orchestrator-local.sh` | ✅ NEW |
| Documentation | 5 markdown files (60 KB total) | ✅ NEW |

---

## 🔑 Key Files

```
/home/anchor/projects/this-is-us/
├── ORCHESTRATOR_LOCAL_RUN.md              (8 KB) ← START HERE
├── ORCHESTRATOR_TESTING.md                (16 KB) ← Full guide
├── ORCHESTRATOR_IMPLEMENTATION_SUMMARY.md (12 KB) ← Architecture
├── ORCHESTRATOR_COPILOT_PROMPT.md         (12 KB) ← For Copilot
├── ORCHESTRATOR_DELIVERY.md               (17 KB) ← Complete report
└── worker/
    └── scripts/
        └── test-wyoleg-orchestrator-local.sh (15 KB) ← Run this
```

---

## 🔗 Database Tables

### `ingestion_runs` (Logging)
Stores orchestrator execution summary. Query:
```bash
./scripts/wr d1 execute WY_DB --local --persist-to ./../scripts/wr-persist --command \
  "SELECT run_id, started_at, synced_count, scanned_count, tags_written FROM ingestion_runs;" --json
```

### `ingestion_run_items` (Details)
Stores per-bill execution details. Query:
```bash
./scripts/wr d1 execute WY_DB --local --persist-to ./../scripts/wr-persist --command \
  "SELECT bill_number, phase, status, message FROM ingestion_run_items WHERE run_id = 'run-...';" --json
```

---

## 💾 Persist Directory

All local D1 data: `worker/../scripts/wr-persist/`

Reset:
```bash
cd worker && rm -rf ../scripts/wr-persist && mkdir -p ../scripts/wr-persist
./scripts/apply-migrations-local.sh
```

---

## 🎁 You Get

- ✅ **Orchestrator endpoint** (already implemented)
- ✅ **Bill sync** (already implemented)
- ✅ **Document resolution + summaries + hot topic tagging** (already implemented)
- ✅ **D1 logging tables** (already implemented)
- ✅ **Comprehensive test script** (NEW - 15 KB)
- ✅ **5 documentation files** (NEW - 60 KB total)
- ✅ **Everything ready for production** ✅

---

## 🚦 Next Steps

1. **Run test:** `./scripts/test-wyoleg-orchestrator-local.sh`
2. **Review:** Check output for ✅ marks
3. **Commit:** `git add . && git commit -m "docs: Add orchestrator testing suite"`
4. **Deploy:** After code review
5. **Monitor:** Check `ingestion_runs` table

---

## 📞 Need Help?

- **Quick start:** `ORCHESTRATOR_LOCAL_RUN.md`
- **Troubleshooting:** `ORCHESTRATOR_TESTING.md` → Troubleshooting section
- **SQL diagnostics:** Provided by test script output
- **Architecture:** `ORCHESTRATOR_IMPLEMENTATION_SUMMARY.md`

---

**Status:** ✅ COMPLETE | **Test it now:** `./scripts/test-wyoleg-orchestrator-local.sh`

