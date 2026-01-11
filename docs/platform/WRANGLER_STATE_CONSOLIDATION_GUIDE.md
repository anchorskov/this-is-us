# Wrangler State Consolidation - fix-./scripts/wr-state.sh Guide

## Problem Statement

The this-is-us monorepo had **multiple Wrangler state directories** under `worker/`:

```
worker/../scripts/wr                    ← Legacy location
worker/.config/../scripts/wr            ← Alternate location
worker/../scripts/wr-persist            ← New canonical location (empty)
```

This caused Miniflare (Wrangler's local emulator) to create **multiple D1 instances**, making it unclear:
- Which database state was actually being used
- Where local development data was stored
- Why data appeared to "disappear"

## Solution

Created **`fix-./scripts/wr-state.sh`** - a diagnostic and consolidation tool that:

1. **Detects** which state folder contains real data (civic tables with rows)
2. **Reports** findings in human-readable format
3. **Consolidates** data to a single canonical location (`../scripts/wr-persist`)
4. **Safeguards** against data loss (dry-run by default, manual cleanup)

## Script Features

### Scanning & Analysis

- Scans three candidate directories:
  - `./../scripts/wr` (legacy location)
  - `./.config/../scripts/wr` (alternate location)
  - `./../scripts/wr-persist` (canonical location)

- For each directory, finds all SQLite files and:
  - Checks last modified time
  - Opens database and checks for civic tables
  - Counts rows in `civic_items`, `civic_item_sources`, `civic_item_ai_tags`
  - Ranks by activity (newest + most rows)

### Safety First

- **Dry-run by default** - no deletions or copies unless `--apply` is passed
- **Verification** - checks copied files can be opened and contain expected tables
- **Manual cleanup** - prints exact `rm -rf` commands for user to verify
- **Clear output** - color-coded messages (YELLOW warnings, GREEN success)

### Compatible Tools

- Uses native `sqlite3` CLI if available (fastest)
- Falls back to Python `sqlite3` module if CLI not available
- Provides helpful warnings if neither is available

## Usage

### Step 1: Analyze Current State (Dry-Run)

```bash
cd /home/anchor/projects/this-is-us/worker
./scripts/guardrails/fix-./scripts/wr-state.sh
```

**Output example:**
```
Local D1 Wrangler State Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Scanning state roots for sqlite files...

./../scripts/wr
    532b3e0005ca3f316e...b.sqlite (268K, 2025-12-15 16:27:27)
      Tables: civic_items(5) civic_item_sources(5) civic_item_ai_tags(5)

./.config/../scripts/wr
  (no sqlite files found)

./../scripts/wr-persist
  (no sqlite files found)

Analysis Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ACTIVE_DB found in: ./../scripts/wr
Civic items count: 5

DRY RUN MODE

To apply fixes:
  ./scripts/guardrails/fix-./scripts/wr-state.sh --apply
```

### Step 2: Apply Consolidation

Once you've verified the analysis, apply the fix:

```bash
./scripts/guardrails/fix-./scripts/wr-state.sh --apply
```

**Output example:**
```
APPLYING FIXES

1. Creating canonical persistence directory...
   OK: ./../scripts/wr-persist

2. Copying WY_DB to canonical location...
   OK: Copied to ./../scripts/wr-persist/WY_DB.sqlite

3. Copying EVENTS_DB to canonical location...
   OK: Copied to ./../scripts/wr-persist/EVENTS_DB.sqlite

4. Verifying copied databases...

WY_DB.sqlite:
  civic_items: 5

EVENTS_DB.sqlite:
  hot_topics: 12

Next Steps

1. Verify the canonical directory has your data:
   ls -lh ./../scripts/wr-persist/

2. After verification, remove old state directories:
   rm -rf ./../scripts/wr
   rm -rf ./.config/../scripts/wr

3. Start local dev (guardrails will verify persistence):
   cd .. && ./start_local.sh

APPLY COMPLETE
```

### Step 3: Clean Up Old Directories (Manual)

After verifying the canonical directory has your data:

```bash
rm -rf ./../scripts/wr
rm -rf ./.config/../scripts/wr
```

### Step 4: Start Development

```bash
cd ..
./start_local.sh
```

The guardrail will verify persistence configuration and start Hugo + Wrangler.

## Script Output Explanation

### Dry-Run Report

**Section: State Root Scanning**
```
./../scripts/wr
    532b3e0005ca3f316e...b.sqlite (268K, 2025-12-15 16:27:27)
      Tables: civic_items(5) civic_item_sources(5) civic_item_ai_tags(5)
```

- **File**: SQLite filename (usually a hash)
- **Size**: 268K (bytes)
- **Modified**: 2025-12-15 16:27:27
- **Tables**: Lists found civic tables with row counts in parentheses

**Section: Analysis Results**
```
ACTIVE_DB found in: ./../scripts/wr
Civic items count: 5
```

- Identifies which state root has the most/best data
- Shows civic_items row count (best metric for activity)

### Apply Report

**Step 1: Create Canonical Directory**
```
1. Creating canonical persistence directory...
   OK: ./../scripts/wr-persist
```

Creates the target directory structure matching Wrangler's expected layout.

**Step 2-3: Copy Databases**
```
2. Copying WY_DB to canonical location...
   OK: Copied to ./../scripts/wr-persist/WY_DB.sqlite
```

Copies identified databases to canonical location. WY_DB and EVENTS_DB are identified by searching the state folder.

**Step 4: Verify**
```
4. Verifying copied databases...

WY_DB.sqlite:
  civic_items: 5

EVENTS_DB.sqlite:
  hot_topics: 12
```

Re-opens copied databases to confirm they contain expected tables and data.

## Canonical Persistence Structure

After applying, your state layout becomes:

```
worker/
├── ../scripts/wr/                          ← Old (can be deleted)
│   └── state/v3/d1/...
│
├── .config/
│   └── ../scripts/wr/                      ← Old (can be deleted)
│       └── state/v3/d1/...
│
├── ../scripts/wr-persist/                  ← NEW CANONICAL
│   └── v3/
│       ├── d1/
│       │   └── miniflare-D1DatabaseObject/
│       │       └── [UUID].sqlite       ← D1 databases
│       └── r2/
│           └── miniflare-R2BucketObject/
│               └── [UUID].sqlite       ← R2 buckets
│
└── scripts/
    ├── guardrails/
    │   ├── check-local-d1-context.sh   ← Validates context
    │   ├── show-local-d1-files.sh      ← Shows active files
    │   └── fix-./scripts/wr-state.sh        ← THIS SCRIPT
    └── ... (all other scripts already configured for canonical persistence)
```

## Integration with Other Guardrails

The fix-./scripts/wr-state script works together with:

1. **check-local-d1-context.sh** - Validates that only one `../scripts/wr` directory exists
   - If multiple found, `fix-./scripts/wr-state.sh` explains the problem

2. **show-local-d1-files.sh** - Shows which files are being used by current persistence
   - After running fix script, points to `../scripts/wr-persist`

3. **start_local.sh** - Starts Hugo + Wrangler with persistence pinned
   - Uses `--persist-to "${WORKER_DIR}/../scripts/wr-persist"`

## Technical Details

### SQLite Detection

The script opens each SQLite file and queries for our civic tables:

```sql
SELECT name FROM sqlite_master 
WHERE type='table' 
AND name IN ('civic_items', 'civic_item_sources', 'civic_item_ai_tags');
```

Then counts rows:
```sql
SELECT COUNT(*) FROM civic_items;
SELECT COUNT(*) FROM civic_item_sources;
SELECT COUNT(*) FROM civic_item_ai_tags;
```

### Database Identification

- **WY_DB**: Contains `civic_items`, `civic_item_sources`, `civic_item_ai_tags`
- **EVENTS_DB**: Contains `hot_topics`, `hot_topic_civic_items`

The script searches for these tables to identify which database is which.

### Ranking Algorithm

Files are ranked by:
1. **Primary**: Row count in `civic_items` (highest = most active)
2. **Secondary**: Last modified time (newest = most recently used)

This ensures the script picks the database with real data, not just a recently-touched empty one.

## Troubleshooting

### "No databases with civic tables found"

This is normal on first run. The script will:
1. Create the canonical `../scripts/wr-persist` directory
2. Print setup instructions
3. After first `./scripts/wr dev` run, re-run the script to copy initial databases

### "sqlite3 not available"

If `sqlite3` CLI not found, the script falls back to Python's `sqlite3` module. If neither available:
- Still creates canonical directory
- You'll need to manually verify data after apply

To install:
```bash
# macOS
brew install sqlite

# Ubuntu/Debian
sudo apt install sqlite3

# Or use Python
python3 -m sqlite3 [file]
```

### "FAIL: Must be run from worker/ directory"

The script must be run from `worker/` directory:
```bash
cd /home/anchor/projects/this-is-us/worker
./scripts/guardrails/fix-./scripts/wr-state.sh
```

## Safety Guarantees

✅ **No automatic deletions** - Script only copies, user must run `rm -rf` commands
✅ **Verification** - Copied files are re-opened to confirm they work
✅ **Reversible** - Old directories left intact until user deletes
✅ **Clear output** - Every action reported with color-coded success/warning
✅ **Dry-run default** - `--apply` must be explicitly passed

## Related Documentation

- [LOCAL_D1_GUARDRAILS_GUIDE.md](../LOCAL_D1_GUARDRAILS_GUIDE.md) - Full guardrail system overview
- [start_local.sh](../start_local.sh) - Development startup script (uses canonical persistence)
- [check-local-d1-context.sh](./check-local-d1-context.sh) - Validates D1 context

## Support

If you encounter issues:

1. Run dry-run to understand current state:
   ```bash
   ./scripts/guardrails/fix-./scripts/wr-state.sh
   ```

2. Check other guardrails:
   ```bash
   ./scripts/guardrails/check-local-d1-context.sh
   ./scripts/guardrails/show-local-d1-files.sh
   ```

3. Verify persistence directory:
   ```bash
   ls -lh ../scripts/wr-persist/
   ```

---

**Last Updated**: December 15, 2025
**Status**: Production Ready
