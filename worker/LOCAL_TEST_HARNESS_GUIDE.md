# Local Test Harness - Proper Operation Sequence

## TL;DR - Correct Order of Operations

The **LOGICAL order** for testing the civic ingestion + hot-topics pipeline locally is:

```
1. Apply Migrations      (schema setup)
   → ./scripts/wr d1 migrations apply WY_DB --local
   → ./scripts/wr d1 migrations apply EVENTS_DB --local

2. Seed Test Data        (populate civic_items)
   → bash seed-test-bills.sh

3. Run Pipeline          (resolve + scan + extract + tag)
   → bash run-civic-pipeline-local.sh --seed --scan

4. Verify Results        (check health metrics)
   → bash verify-hot-topics-state.sh

5. Test Reset            (with backup)
   → bash reset-civic-local.sh --yes

6. Test Idempotency      (run again, confirm same results)
   → bash run-civic-pipeline-local.sh --scan
   → bash verify-hot-topics-state.sh
```

## The Three Main Scripts

### 1. `verify-hot-topics-state.sh`
**Purpose**: Query pipeline health without modifying data

**What it does:**
- Counts bills in `civic_items`
- Counts resolved sources in `civic_item_sources`
- Counts bills with AI summaries
- Counts topic tags in `civic_item_ai_tags`
- Shows topic distribution (top 8 topics)
- Spot-checks SF0013 summary and tags
- Gracefully detects missing tables

**Usage:**
```bash
./scripts/verify-hot-topics-state.sh
```

**Safe to run**: ✅ Yes, read-only (no data changes)

---

### 2. `reset-civic-local.sh`
**Purpose**: Safe reset of local civic outputs with timestamped backups

**What it does:**
- Requires `--yes` flag (prevents accidental data loss)
- Creates `backups/local_civic/<timestamp>/` folder
- Exports both WY_DB and EVENTS_DB to SQL files
- Default reset:
  - Clears `civic_item_ai_tags` (all topic tags)
  - Clears `civic_item_sources` (all document sources)
  - Resets AI fields in `civic_items` (ai_summary → '', ai_key_points → '[]', ai_summary_generated_at → NULL)
- Optional flags:
  - `--full`: Also delete all bills from `civic_items`
  - `--clear-manual-links`: Also clear `hot_topic_civic_items`

**Usage:**
```bash
# Default reset (keep bills, clear derived data)
./scripts/reset-civic-local.sh --yes

# Full reset (delete everything)
./scripts/reset-civic-local.sh --yes --full

# Clear manual links too
./scripts/reset-civic-local.sh --yes --clear-manual-links
```

**Recovery:**
```bash
# Restore from backup
./scripts/wr d1 execute WY_DB --local --file=backups/local_civic/<timestamp>/WY_DB_<timestamp>.sql
```

---

### 3. `run-civic-pipeline-local.sh`
**Purpose**: Orchestrate the full civic pipeline with various flags for testing

**Flags:**
- `--seed`: Run seed-test-bills.sh to populate test data
- `--resolve-only`: Only populate `civic_item_sources` (document resolution)
- `--extract`: Run Python PDF extractor if available
- `--scan`: Call worker endpoint to generate topic tags
- `--force`: Add `?force=1` to scan endpoint (bypass caching)
- `--stability-test`: Run pipeline 3x to prove idempotency

**What it does:**
1. Checks prerequisites (npx, curl)
2. Optionally seeds test bills
3. Calls scan endpoint to resolve documents
4. Optionally extracts PDFs and generates AI summaries
5. Optionally scans for topics and tags
6. Always runs verify script at the end
7. If `--stability-test` is set, runs 3 times and compares verify outputs

**Usage:**
```bash
# Full pipeline (seed + resolve + scan)
./scripts/run-civic-pipeline-local.sh --seed --scan

# Just scan (assumes bills already exist)
./scripts/run-civic-pipeline-local.sh --scan

# Scan with extraction (if script exists)
./scripts/run-civic-pipeline-local.sh --scan --extract

# Test idempotency (run 3x, check stability)
./scripts/run-civic-pipeline-local.sh --scan --stability-test

# Force refresh on third run
./scripts/run-civic-pipeline-local.sh --scan --force --stability-test
```

**Output:**
- Section banners for each step
- Color-coded status (✓ success, ✗ failure, ⚠ warning)
- Verification metrics at the end
- For stability test: 3 verify outputs to compare

---

## Complete Testing Workflow

### Basic test:
```bash
# 1. Reset database
./scripts/reset-civic-local.sh --yes

# 2. Seed and run pipeline
./scripts/run-civic-pipeline-local.sh --seed --scan

# 3. Check results
./scripts/verify-hot-topics-state.sh
```

### Idempotency test:
```bash
# 1. Reset
./scripts/reset-civic-local.sh --yes

# 2. Run full pipeline
./scripts/run-civic-pipeline-local.sh --seed --scan

# 3. Save results (copy the verify output)
./scripts/verify-hot-topics-state.sh > /tmp/run1.txt

# 4. Run again (should be identical)
./scripts/run-civic-pipeline-local.sh --scan

# 5. Compare outputs
./scripts/verify-hot-topics-state.sh > /tmp/run2.txt
diff /tmp/run1.txt /tmp/run2.txt  # Should show no differences
```

### Stability test (built-in):
```bash
./scripts/reset-civic-local.sh --yes
./scripts/run-civic-pipeline-local.sh --seed --scan --stability-test
```
This runs the pipeline 3 times and shows verify output after each run. Compare the outputs to prove idempotency.

---

## Important: Database Bindings

The scripts use Wrangler's local D1 bindings defined in `./scripts/wr.toml`:

```toml
[[d1_databases]]
binding       = "WY_DB"
database_name = "wy"
database_id   = "4b4227f1-bf30-4fcf-8a08-6967b536a5ab"
migrations_dir = "migrations_wy"

[[d1_databases]]
binding = "EVENTS_DB"
database_name = "ballot_sources"
database_id   = "9c4b0c27-eb33-46e6-a477-fb49d4c81474"
```

All `./scripts/wr d1` commands use `--local` to avoid touching remote data.

---

## Tables Referenced

### WY_DB
- `civic_items`: Bills (populated by seed-test-bills.sh)
- `civic_item_sources`: Document metadata (populated by scan endpoint)
- `civic_item_ai_tags`: Topic matches (populated by scan endpoint)
- `civic_item_verification`: Verification records (optional)

### EVENTS_DB
- `hot_topics`: Topic definitions (used for matching)
- `hot_topic_civic_items`: Manual topic-bill links (optional)

---

## Troubleshooting

### "Table does not exist"
The verify script detects this gracefully and prints "SKIP: table missing". If tables should exist, check:
```bash
./scripts/wr d1 execute WY_DB --local --command "SELECT name FROM sqlite_master WHERE type='table';"
```

### Worker endpoint error
The worker must be running:
```bash
./scripts/wr dev  # Terminal 1
./scripts/run-civic-pipeline-local.sh --scan  # Terminal 2
```

### Migration failures
Some pre-existing migrations in the repo have issues. Core tables (civic_items, civic_item_ai_tags) should still be created. If you need a clean state:
```bash
rm -rf ../scripts/wr/state/v3/d1
./scripts/wr d1 migrations apply WY_DB --local
./scripts/wr d1 migrations apply EVENTS_DB --local
```

### Reset didn't work
Verify the backup was created:
```bash
ls -la backups/local_civic/
```

To restore:
```bash
./scripts/wr d1 execute WY_DB --local --file=backups/local_civic/<timestamp>/WY_DB_<timestamp>.sql
```

---

## Key Design Decisions

1. **All scripts use `--local`** - Never touches remote data
2. **Verify is read-only** - Safe to run anytime
3. **Reset requires `--yes`** - Prevents accidental data loss
4. **Backups before reset** - Full SQL export for recovery
5. **Graceful table detection** - Missing tables print "SKIP" instead of crashing
6. **Stability test built-in** - Run 3x to prove idempotency without external tools
7. **Color-coded output** - Green (✓) success, Yellow (⚠) warning, Red (✗) failure, Cyan (→) action

---

## Next Steps

1. **Start the worker:** `./scripts/wr dev`
2. **Run the integration test:** `bash scripts/test-pipeline-integration.sh`
3. **Try the quick commands:**
   ```bash
   ./scripts/reset-civic-local.sh --yes
   ./scripts/run-civic-pipeline-local.sh --seed --scan
   ./scripts/verify-hot-topics-state.sh
   ```
4. **Test stability:** 
   ```bash
   ./scripts/run-civic-pipeline-local.sh --scan --stability-test
   ```
