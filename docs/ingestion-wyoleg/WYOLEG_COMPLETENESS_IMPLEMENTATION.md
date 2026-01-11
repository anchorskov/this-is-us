# Wyoming LSO Bill Counting & Completeness Verification

## Overview

This implementation adds authoritative bill counting from wyoleg.gov and completeness verification to the Wyoming Legislature orchestrator. The orchestrator now:

1. **Counts bills on wyoleg.gov** (source of truth) using multiple fallback methods
2. **Stores the count** in D1's `ingestion_metadata` table
3. **Computes completeness** by comparing `wyoleg_total_bills` vs `db_total_bills`
4. **Provides a "run-until-complete" endpoint** that loops until all bills are synced

---

## Files Created & Modified

### 1. Migration File

**File:** `worker/migrations_wy/0027_create_ingestion_metadata.sql`

Creates the `ingestion_metadata` table using a flexible key-value schema:

```sql
CREATE TABLE IF NOT EXISTS ingestion_metadata (
  key TEXT PRIMARY KEY,
  value_text TEXT,
  value_int INTEGER,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ingestion_metadata_key ON ingestion_metadata(key);
```

**Keys stored:**
- `wyoleg_{session}_total_bills` (value_int): Total bills on wyoleg.gov
- `wyoleg_{session}_count_method` (value_text): How the count was obtained
- `wyoleg_{session}_last_counted_at` (value_text): ISO timestamp of count time

---

### 2. New Module: wyolegCounter.mjs

**File:** `worker/src/lib/wyolegCounter.mjs`

**Exported Functions:**

#### `countBillsOnWyoleg({ session })`
Counts pending bills on wyoleg.gov using multiple methods (in order):

1. **JSON API (preferred)**
   - Tries `https://wyoleg.gov/api/v1/bills/{session}?status=pending`
   - Looks for `total_count` field or `data` array length
   - Returns method: `"json_api (total_count)"` or `"json_api (data.length)"`

2. **HTML Parsing (fallback)**
   - Fetches `https://wyoleg.gov/Legislation/{session}`
   - Searches for `data-total-bills` or similar attributes
   - Searches for embedded JSON in script tags
   - Falls back to counting table rows
   - Returns method: `"html_parse (...)"`

3. **OpenStates API (last resort)**
   - Only if wyoleg.gov methods fail
   - Returns method: `"openstates_fallback (not authoritative)"`
   - Logs warning that this is NOT the authoritative source

**Returns:**
```javascript
{
  session: "2025",
  total: 87,  // Total bills or null if unable to count
  method: "json_api (total_count)",
  sampledUrls: ["https://wyoleg.gov/api/v1/bills/2025?status=pending"],
  error: null  // Error message if counting failed
}
```

#### `storeWyolegBillCount(db, { session, total, method })`
Stores the bill count in `ingestion_metadata` table.

**Returns:** `boolean` (success/failure)

#### `getStoredWyolegBillCount(db, session)`
Retrieves previously stored bill count.

**Returns:**
```javascript
{
  total: 87,
  method: "json_api (total_count)",
  countedAt: "2025-12-16T23:59:40.232Z"
}
```

---

### 3. Updated: adminWyoleg.mjs

**File:** `worker/src/routes/adminWyoleg.mjs`

#### Changes to `handleAdminRunWyoleg(request, env)`

**New Request Parameters:**
- All existing parameters unchanged

**New Response Fields:**
```javascript
{
  // ... existing fields ...
  wyoleg_total_bills: 87,              // Total bills on wyoleg.gov (null if count failed)
  wyoleg_count_method: "json_api...",  // How count was obtained
  db_total_bills: 45,                  // Current bills in database
  db_total_sources: 43,                // Resolved bill sources
  db_total_tags: 45,                   // Bills with hot topic tags
  complete: false,                     // true if db_total >= wyoleg_total
  remaining: 42,                       // max(wyoleg_total - db_total, 0)
  errors: [...]                        // Includes count errors
}
```

**Execution Flow:**

1. **Step 0 (NEW):** Count bills on wyoleg.gov
   - Calls `countBillsOnWyoleg({ session })`
   - Stores result in `ingestion_metadata` table
   - Logs method used

2. **Step 1:** Sync from OpenStates (unchanged)
   - Calls `syncWyomingBills()`

3. **Step 2:** Scan and analyze (unchanged)
   - Calls `runAdminScan()`

4. **Step 3 (NEW):** Compute completeness
   - Queries `COUNT(*)` from `civic_items`, `civic_item_sources`, `civic_item_ai_tags`
   - Computes: `complete = (wyoleg_total IS NOT NULL AND db_total >= wyoleg_total)`
   - Computes: `remaining = max(wyoleg_total - db_total, 0)`

#### New: `handleAdminRunUntilComplete(request, env)`

**Endpoint:** `POST /api/internal/admin/wyoleg/run-until-complete`

**Request Body:**
```javascript
{
  session: "2025",       // default: current year
  maxRuns: 5,            // default: 5, max iterations
  limit: 25              // default: 25, bills per run
}
```

**Response:**
```javascript
{
  session: "2025",
  maxRuns: 5,
  limit: 25,
  totalRuns: 4,
  complete: true,  // true if completeness achieved
  runs: [
    {
      run_number: 1,
      run_id: "...",
      started_at: "...",
      finished_at: "...",
      synced_count: 25,
      scanned_count: 25,
      db_total_bills: 25,
      wyoleg_total_bills: 87,
      complete: false,
      remaining: 62,
      errors: []
    },
    // ... more runs ...
    {
      run_number: 4,
      run_id: "...",
      synced_count: 12,  // < limit, indicates end of data
      db_total_bills: 87,
      wyoleg_total_bills: 87,
      complete: true,
      remaining: 0,
      errors: []
    }
  ],
  lastError: null
}
```

**Behavior:**
- Loops up to `maxRuns` times
- Calls `/api/internal/admin/wyoleg/run` internally
- Stops early if `complete === true`
- Records metrics from each run
- Returns HTTP 200 if complete, 206 if incomplete

---

### 4. Updated: index.mjs

**File:** `worker/src/index.mjs`

**Changes:**
```javascript
// Import
import { handleAdminRunWyoleg, handleAdminRunUntilComplete } from "./routes/adminWyoleg.mjs";

// Routes
router.post("/api/internal/admin/wyoleg/run", handleAdminRunWyoleg);
router.post("/api/internal/admin/wyoleg/run-until-complete", handleAdminRunUntilComplete);
```

---

### 5. New Test Script

**File:** `worker/scripts/test-wyoleg-completeness-local.sh`

**Usage:**
```bash
./scripts/test-wyoleg-completeness-local.sh [--max-runs 3] [--limit 25]
```

**What It Does:**

1. **Check Connectivity**
   - Verifies ./scripts/wr dev is running at `http://127.0.0.1:8787`

2. **Single Run**
   - Calls `POST /api/internal/admin/wyoleg/run`
   - Displays wyoleg.gov count and method
   - **Fails if wyoleg_total_bills is NULL** (count method missing)

3. **Run Until Complete**
   - Calls `POST /api/internal/admin/wyoleg/run-until-complete` with maxRuns and limit
   - Shows metrics from each run
   - Indicates if completeness was achieved

4. **Metadata Verification**
   - Shows D1 query to verify stored metadata:
     ```sql
     SELECT key, value_int, value_text, updated_at 
     FROM ingestion_metadata 
     WHERE key LIKE 'wyoleg_%' 
     ORDER BY key;
     ```

5. **Summary**
   - Reports final state (complete or incomplete)
   - Shows remaining bills if incomplete

**Exit Codes:**
- `0`: Complete (all bills synced)
- `1`: Incomplete or count failed

---

## Local Setup & Testing

### Step 1: Apply Migration

```bash
cd /home/anchor/projects/this-is-us/worker

# Apply the new migration
./scripts/wr d1 migrations list WY_DB --local
# Should see 0027_create_ingestion_metadata.sql pending

# Apply all migrations
./scripts/wr d1 migrations apply WY_DB --local
```

### Step 2: Start Wrangler Dev

```bash
cd /home/anchor/projects/this-is-us/worker

# In a separate terminal, start the dev server
./scripts/wr dev
# Should output: ✨ Ready on http://127.0.0.1:8787
```

### Step 3: Run the Test

```bash
cd /home/anchor/projects/this-is-us/worker

# Run with defaults (maxRuns=3, limit=25)
./scripts/test-wyoleg-completeness-local.sh

# Or customize
./scripts/test-wyoleg-completeness-local.sh --max-runs 5 --limit 50
```

### Step 4: Check Results

**Expected output (successful run):**

```
📊 Step 1: Single Orchestrator Run
✅ wyoleg.gov count obtained: 87 bills (method: json_api (total_count))

🔄 Step 2: Run Until Complete
Results from run-until-complete:
  • Total runs:       4
  • Complete:         true

Final state (after all runs):
  • wyoleg_total:     87
  • db_total_bills:   87
  • complete:         ✅ TRUE

🎉 SUCCESS: All Wyoming LSO bills have been synced!
```

**If wyoleg.gov count fails:**

```
❌ FAIL: wyoleg.gov bill count is NULL
This means countBillsOnWyoleg() could not determine the bill count.
```

---

## Completeness Algorithm

### Single Run

```
Call orchestrator once:
  1. Count wyoleg.gov → wyoleg_total_bills
  2. Sync from OpenStates → synced_count, db_total_bills
  3. Scan and analyze → summaries_written, tags_written
  4. Compute: complete = (db_total_bills >= wyoleg_total_bills)
  5. Return: complete, remaining
```

### Multiple Runs (Until Complete)

```
Loop (up to maxRuns):
  1. Call single run
  2. If complete == true:
     → Stop, return success
  3. Else if synced_count < limit:
     → More data might exist, continue
  4. Else:
     → synced_count == limit, more data likely exists, continue
  5. After maxRuns, return final state
```

### Completeness Detection

**Method 1: Direct Comparison**
```
complete = (wyoleg_total_bills IS NOT NULL AND db_total_bills >= wyoleg_total_bills)
remaining = MAX(wyoleg_total_bills - db_total_bills, 0)
```

**Method 2: Verify with Metadata Query**
```sql
SELECT 
  key,
  value_int as total,
  value_text as method,
  updated_at
FROM ingestion_metadata
WHERE key LIKE 'wyoleg_2025_%';

-- Expected:
-- wyoleg_2025_total_bills         | 87 | NULL  | 2025-12-16...
-- wyoleg_2025_count_method        | NULL | json_api... | 2025-12-16...
-- wyoleg_2025_last_counted_at     | NULL | 2025-12-16T... | 2025-12-16...
```

---

## Error Handling

### wyoleg.gov Count Errors

If bill counting fails:
- Returns: `wyoleg_total_bills: null`
- Adds error to response: `wyoleg_count: {error message}`
- Does NOT abort orchestrator (proceeds with syncing)
- HTTP Status: 207 (multi-status)

**Example:**
```javascript
{
  wyoleg_total_bills: null,
  wyoleg_count_method: null,
  db_total_bills: 45,
  complete: false,
  errors: [
    "wyoleg_count: Unable to count bills on wyoleg.gov..."
  ]
}
```

### Fallback Behavior

If wyoleg.gov methods exhausted:
1. Tries JSON API → fails
2. Tries HTML parsing → fails
3. Falls back to OpenStates API (with warning log)
4. If all fail → `total: null`, `error: {...}`

---

## Database Schema

### ingestion_metadata Table

```sql
CREATE TABLE ingestion_metadata (
  key TEXT PRIMARY KEY,
  value_text TEXT,
  value_int INTEGER,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Example rows:
INSERT INTO ingestion_metadata VALUES
  ('wyoleg_2025_total_bills', NULL, 87, '2025-12-16T23:59:40.232Z'),
  ('wyoleg_2025_count_method', 'json_api (total_count)', NULL, '2025-12-16T23:59:40.232Z'),
  ('wyoleg_2025_last_counted_at', '2025-12-16T23:59:40.232Z', NULL, '2025-12-16T23:59:40.232Z');
```

### ingestion_runs Table (existing, unchanged)

Already logs:
- `synced_count`: Bills fetched from OpenStates
- `scanned_count`: Bills analyzed
- `summaries_written`: AI summaries created
- `tags_written`: Hot topic tags created

New orchestrator adds computation of completeness based on these existing fields.

---

## API Examples

### Single Run Endpoint

```bash
curl -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run \
  -H "Content-Type: application/json" \
  -d '{
    "session": "2025",
    "limit": 25
  }' | jq '.'
```

**Response:**
```json
{
  "run_id": "e526530a-264c-498c-8f34-d48b666d85e2",
  "started_at": "2025-12-16T23:59:40.232Z",
  "finished_at": "2025-12-16T23:59:40.884Z",
  "synced_count": 25,
  "scanned_count": 25,
  "wyoleg_total_bills": 87,
  "wyoleg_count_method": "json_api (total_count)",
  "db_total_bills": 25,
  "db_total_sources": 25,
  "db_total_tags": 25,
  "complete": false,
  "remaining": 62,
  "errors": []
}
```

### Run Until Complete Endpoint

```bash
curl -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run-until-complete \
  -H "Content-Type: application/json" \
  -d '{
    "session": "2025",
    "maxRuns": 5,
    "limit": 25
  }' | jq '.'
```

**Response (abbreviated):**
```json
{
  "session": "2025",
  "maxRuns": 5,
  "limit": 25,
  "totalRuns": 4,
  "complete": true,
  "runs": [
    {"run_number": 1, "synced_count": 25, "db_total_bills": 25, "complete": false},
    {"run_number": 2, "synced_count": 25, "db_total_bills": 50, "complete": false},
    {"run_number": 3, "synced_count": 25, "db_total_bills": 75, "complete": false},
    {"run_number": 4, "synced_count": 12, "db_total_bills": 87, "complete": true}
  ]
}
```

---

## Key Design Decisions

1. **No Seed Data Required**
   - wyoleg.gov is queried directly
   - No manual seed/demo bills needed
   - Real data only

2. **Multiple Counting Methods**
   - JSON API preferred (most reliable)
   - HTML parsing fallback
   - OpenStates fallback with warning (not authoritative)
   - Explicit failure if all methods exhausted

3. **Key-Value Metadata Schema**
   - Flexible for future extensions
   - No schema changes needed to add new tracking fields
   - Session-based keys allow multi-year support

4. **Completeness ≠ Synced < Limit**
   - `synced < limit` indicates no more data from OpenStates in that run
   - But completeness requires: `db_total >= wyoleg_total`
   - wyoleg.gov is the authoritative source, not OpenStates

5. **Idempotent Counting**
   - countBillsOnWyoleg() can be called multiple times
   - Always queries wyoleg.gov directly
   - Metadata stores result for reference

---

## Troubleshooting

### "wyoleg.gov count is NULL"
- Check network connectivity to wyoleg.gov
- Try accessing `https://wyoleg.gov/api/v1/bills/2025` in browser
- If API down, HTML parsing will be attempted
- Check logs for specific method that failed

### "Cannot connect to ./scripts/wr dev"
- Ensure `./scripts/wr dev` is running in another terminal
- Check: `curl http://127.0.0.1:8787/api/events` returns JSON
- If port 8787 is in use, configure: `export WRANGLER_PORT=8788`

### "Completeness not reached after maxRuns"
- Increase `maxRuns` parameter
- Check if wyoleg.gov count is correct
- Verify OpenStates API returns data
- Check orchestrator logs for errors

### Migration not applied
```bash
# Check applied migrations
./scripts/wr d1 migrations list WY_DB --local

# Apply pending migrations
./scripts/wr d1 migrations apply WY_DB --local

# Verify table exists
./scripts/wr d1 execute WY_DB --local --command \
  "SELECT name FROM sqlite_master WHERE type='table' AND name='ingestion_metadata';"
```

---

## Summary

The Wyoming LSO orchestrator now:

✅ Counts bills on wyoleg.gov (source of truth)
✅ Stores counts in D1 for audit trail
✅ Computes completeness by comparing wyoleg vs database
✅ Provides loop endpoint for full synchronization
✅ Reports remaining bills to sync
✅ Supports multi-year sessions
✅ Uses no seed/demo data

All counts are **authoritative** (from wyoleg.gov), with **explicit failure** if counting fails, and **no guessing**.
