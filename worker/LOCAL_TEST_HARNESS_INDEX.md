# Local Test Harness - Complete Implementation

## ✅ Deliverables

All files are in `/home/anchor/projects/this-is-us/worker/`

### Scripts (executable)
- **scripts/verify-hot-topics-state.sh** — Read-only pipeline health check
- **scripts/reset-civic-local.sh** — Safe reset with timestamped backups  
- **scripts/run-civic-pipeline-local.sh** — Full pipeline orchestration
- **scripts/test-pipeline-integration.sh** — Integration demo (bonus)

### Documentation
- **LOCAL_TEST_HARNESS_GUIDE.md** — Complete technical reference
- **LOCAL_TEST_QUICK_REFERENCE.md** — Quick commands and examples
- **LOCAL_TEST_HARNESS_INDEX.md** — This file

---

## 🎯 The Core Finding: Proper Logical Order

**Initial Attempt (WRONG):**
```
Seed bills → Verify 
❌ Fails because schema doesn't exist yet
```

**Correct Order (VALIDATED):**
```
1. Apply Migrations (create schema)
   ./scripts/wr d1 migrations apply WY_DB --local
   ./scripts/wr d1 migrations apply EVENTS_DB --local

2. Seed Test Data (populate tables)
   bash seed-test-bills.sh

3. Run Pipeline (resolve → scan)
   bash run-civic-pipeline-local.sh --seed --scan

4. Verify Results (check metrics)
   bash verify-hot-topics-state.sh

5. Reset (with backups)
   bash reset-civic-local.sh --yes

6. Test Idempotency (run again, compare)
   bash run-civic-pipeline-local.sh --scan
   bash verify-hot-topics-state.sh
```

This sequence is now built into the scripts. ✅

---

## 📋 Script Reference

### verify-hot-topics-state.sh

**Purpose:** Non-destructive health check

**What it checks:**
- Bill count in `civic_items`
- Resolved sources in `civic_item_sources`
- Bills with summaries (>40 chars)
- Topic tag count
- Topic distribution (top 8)
- SF0013 spot check

**Usage:**
```bash
./scripts/verify-hot-topics-state.sh
```

**Safety:** ✅ Read-only, always safe

---

### reset-civic-local.sh

**Purpose:** Clean reset with recovery capability

**Default behavior (--yes):**
- Exports both databases to `backups/local_civic/<timestamp>/`
- Clears `civic_item_ai_tags` (topic tags)
- Clears `civic_item_sources` (document sources)
- Resets AI fields in `civic_items`

**Options:**
- `--yes` (REQUIRED)
- `--full` (also delete all bills)
- `--clear-manual-links` (clear manual topic-bill links)

**Usage:**
```bash
# Default reset
./scripts/reset-civic-local.sh --yes

# Full reset (delete everything)
./scripts/reset-civic-local.sh --yes --full

# Restore from backup
./scripts/wr d1 execute WY_DB --local \
  --file=backups/local_civic/<timestamp>/WY_DB_<timestamp>.sql
```

**Safety:** ✅ Requires --yes, creates backups, fully recoverable

---

### run-civic-pipeline-local.sh

**Purpose:** Orchestrated pipeline execution

**Flags:**
- `--seed` — Load test bills (from seed-test-bills.sh)
- `--resolve-only` — Only resolve documents (don't scan)
- `--extract` — Run PDF extractor (if available)
- `--scan` — Generate topic tags
- `--force` — Add ?force=1 to scan (bypass caching)
- `--stability-test` — Run 3x to prove idempotency

**Workflow:**
1. Check prerequisites
2. Seed bills (if --seed)
3. Resolve documents (if seeding or other ops)
4. Extract PDFs (if --extract)
5. Scan for topics (if --scan)
6. Always run verify at the end
7. If --stability-test, run 3x and compare

**Usage:**
```bash
# Full pipeline
./scripts/run-civic-pipeline-local.sh --seed --scan

# Just scan
./scripts/run-civic-pipeline-local.sh --scan

# Stability test (3 runs)
./scripts/run-civic-pipeline-local.sh --seed --scan --stability-test

# With extraction
./scripts/run-civic-pipeline-local.sh --seed --extract --scan

# Force refresh
./scripts/run-civic-pipeline-local.sh --scan --force
```

**Idempotency:** ✅ Safe to run multiple times (use --stability-test to prove it)

---

## 🚀 Quick Start

**Terminal 1: Start worker**
```bash
cd /home/anchor/projects/this-is-us/worker
./scripts/wr dev
# Watch for: Ready on http://localhost:8787
```

**Terminal 2: Run pipeline**
```bash
cd /home/anchor/projects/this-is-us/worker

# Check current state
./scripts/verify-hot-topics-state.sh

# Run full test
./scripts/reset-civic-local.sh --yes
./scripts/run-civic-pipeline-local.sh --seed --scan
./scripts/verify-hot-topics-state.sh

# Test idempotency
./scripts/run-civic-pipeline-local.sh --scan --stability-test
```

---

## 📊 Database Schema

### WY_DB (Local)
```
Binding:     WY_DB
Database:    wy
ID:          4b4227f1-bf30-4fcf-8a08-6967b536a5ab
Migrations:  migrations_wy/

Tables:
  • civic_items
  • civic_item_sources
  • civic_item_ai_tags
  • civic_item_verification
  (+ voter/legislator tables)
```

### EVENTS_DB (Local)
```
Binding:     EVENTS_DB
Database:    ballot_sources
ID:          9c4b0c27-eb33-46e6-a477-fb49d4c81474
Migrations:  migrations/

Tables:
  • hot_topics
  • hot_topic_civic_items
  (+ event/preference/townhall tables)
```

---

## 🔒 Safety Features

1. **Reset requires --yes**
   - Prevents accidental data loss
   - User must explicitly confirm

2. **Timestamped backups**
   - Before any destructive operation
   - Full SQL export of both databases
   - Location: `backups/local_civic/<YYYYMMDD_HHMMSS>/`

3. **Read-only verify**
   - Safe to run anytime
   - Never modifies data
   - Gracefully handles missing tables

4. **All --local flags**
   - All ./scripts/wr commands use `--local`
   - Zero risk to production/remote data
   - Only affects local D1

5. **Graceful error handling**
   - Missing tables don't crash
   - Color-coded output for clarity
   - Clear error messages

---

## 🧪 Testing Scenarios

### Scenario 1: Basic Health Check
```bash
./scripts/verify-hot-topics-state.sh
```
Output: Current state of pipeline (bills, summaries, tags, topics)

### Scenario 2: Clean Test
```bash
./scripts/reset-civic-local.sh --yes
./scripts/run-civic-pipeline-local.sh --seed --scan
./scripts/verify-hot-topics-state.sh
```
Output: Full pipeline run from clean state

### Scenario 3: Prove Idempotency
```bash
./scripts/reset-civic-local.sh --yes
./scripts/run-civic-pipeline-local.sh --seed --scan --stability-test
```
Output: 3 runs of pipeline with verify output after each
Compare outputs to confirm they're identical

### Scenario 4: Resolve Only
```bash
./scripts/run-civic-pipeline-local.sh --seed --resolve-only
./scripts/verify-hot-topics-state.sh
```
Output: Bills seeded, documents resolved, but not scanned for topics

### Scenario 5: Full Reset + Restore
```bash
# Backup current state
./scripts/reset-civic-local.sh --yes
# This creates a backup

# Later, restore from backup
./scripts/wr d1 execute WY_DB --local \
  --file=backups/local_civic/<timestamp>/WY_DB_<timestamp>.sql
```

---

## 📚 Documentation

### For Quick Usage
- Read: **LOCAL_TEST_QUICK_REFERENCE.md**
- Contains: Commands, examples, expected output, troubleshooting

### For Complete Details
- Read: **LOCAL_TEST_HARNESS_GUIDE.md**
- Contains: Feature guide, table schemas, design decisions, recovery procedures

### For Understanding Order
- Reference: **This file (LOCAL_TEST_HARNESS_INDEX.md)**
- Shows: Proper sequence, core finding, script matrix

---

## ✨ Key Features Summary

| Feature | Status | Details |
|---------|--------|---------|
| **Migrations First** | ✅ | Schema created before data |
| **Seed Script** | ✅ | 5 test Wyoming bills |
| **Document Resolution** | ✅ | Populate civic_item_sources |
| **Topic Scanning** | ✅ | Generate civic_item_ai_tags |
| **Health Metrics** | ✅ | Bills, summaries, tags, topics |
| **Spot Check** | ✅ | SF0013 detailed inspection |
| **Backups** | ✅ | Timestamped SQL exports |
| **Recovery** | ✅ | Full restore from backup |
| **Idempotency Test** | ✅ | Built-in 3-run stability |
| **WSL Compatible** | ✅ | set -euo pipefail |
| **No Dependencies** | ✅ | Uses existing tools only |
| **Color Output** | ✅ | Green/yellow/red/cyan |
| **Table Detection** | ✅ | Graceful handling of missing tables |
| **Safety Flags** | ✅ | --yes required for reset |
| **Local Only** | ✅ | All --local flags, no remote |

---

## 🎓 What This Teaches

1. **Proper database operations sequence**
   - Migrations before data
   - Data before transformation
   - Verification before deployment

2. **Safe testing practices**
   - Backups before destructive ops
   - Dry-run / read-only checks first
   - Idempotency testing

3. **Self-documenting code**
   - Clear script purposes
   - Explicit flags and options
   - Comprehensive help text

4. **Local development workflow**
   - Repeatable test execution
   - Confidence in changes
   - Zero risk to production

---

## 📞 Support

### Worker Not Running
```bash
./scripts/wr dev  # Terminal 1
# Watch for: Ready on http://localhost:8787
```

### Tables Missing
```bash
# Clean start
rm -rf ../scripts/wr/state/v3/d1
./scripts/wr d1 migrations apply WY_DB --local
./scripts/wr d1 migrations apply EVENTS_DB --local
```

### Data Lost
```bash
# Restore from backup
ls backups/local_civic/  # Find timestamp
BACKUP_TIME="<timestamp>"
./scripts/wr d1 execute WY_DB --local \
  --file=backups/local_civic/$BACKUP_TIME/WY_DB_$BACKUP_TIME.sql
```

### Script Won't Run
```bash
# Make executable
chmod +x scripts/verify-hot-topics-state.sh
chmod +x scripts/reset-civic-local.sh
chmod +x scripts/run-civic-pipeline-local.sh
```

---

## ✅ Checklist

- [x] Three main scripts created
- [x] All scripts executable
- [x] Proper logical order identified
- [x] Comprehensive documentation
- [x] Quick reference guide
- [x] Integration test demo
- [x] Safety features implemented
- [x] WSL compatibility confirmed
- [x] No external dependencies
- [x] Color-coded output
- [x] Graceful error handling
- [x] Backup/recovery capability
- [x] Idempotency testing
- [x] Table detection
- [x] Local-only database access

---

## 📝 Files Created

```
/home/anchor/projects/this-is-us/worker/
├── scripts/
│   ├── verify-hot-topics-state.sh         (210 lines, 7.8 KB) ✅
│   ├── reset-civic-local.sh               (147 lines, 4.9 KB) ✅
│   ├── run-civic-pipeline-local.sh        (289 lines, 9.4 KB) ✅
│   └── test-pipeline-integration.sh       (245 lines, 9.4 KB) ✅ [demo]
├── LOCAL_TEST_HARNESS_GUIDE.md            (280 lines) ✅
├── LOCAL_TEST_QUICK_REFERENCE.md          (320 lines) ✅
└── LOCAL_TEST_HARNESS_INDEX.md            (this file) ✅

Total: 1500+ lines of code + documentation
```

---

## 🎉 Ready to Use

All scripts are:
- ✅ Created
- ✅ Executable
- ✅ Tested
- ✅ Documented
- ✅ Production-ready

Start with:
```bash
./scripts/reset-civic-local.sh --yes
./scripts/run-civic-pipeline-local.sh --seed --scan
./scripts/verify-hot-topics-state.sh
```

Or for confidence:
```bash
./scripts/reset-civic-local.sh --yes
./scripts/run-civic-pipeline-local.sh --seed --scan --stability-test
```
