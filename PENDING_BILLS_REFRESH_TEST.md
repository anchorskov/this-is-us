# Pending Bills Weekly Refresh: Test Checklist

**Purpose:** Verify manual admin script + weekly cron trigger for pending bills sync and topic scanning.

**Cron Schedule:** Mondays 03:00 UTC  
**Manual Script:** `SESSION=2025 LIMIT=50 SCANS=3 ./scripts/admin-refresh-pending-bills.sh`  
**Env Gate:** `BILL_SCANNER_ENABLED=true`

---

## Quick Test (5 minutes)

### Prerequisites
```bash
cd /home/anchor/projects/this-is-us

# Ensure BILL_SCANNER_ENABLED is set
export BILL_SCANNER_ENABLED=true

# Start worker (in Terminal 1)
./start_wrangler.sh
```

### Step 1: Clear Data (Optional - Start Fresh)
```bash
# Terminal 2: Clear existing data if re-testing
cd /home/anchor/projects/this-is-us/worker

# Delete LSO bills
npx wrangler d1 execute WY_DB --local --command "DELETE FROM civic_items WHERE source='lso';"

# Verify cleared
npx wrangler d1 execute WY_DB --local --command "SELECT COUNT(*) FROM civic_items WHERE source='lso';"
# Expected: 0
```

### Step 2: Run Admin Refresh Script
```bash
cd /home/anchor/projects/this-is-us

# Create or run the admin script
SESSION=2025 LIMIT=50 SCANS=3 bash -c '
  echo "🔄 PENDING BILLS REFRESH TEST"
  echo "=============================="
  
  # Sync bills from Wyoming LSO
  echo ""
  echo "1️⃣  Syncing bills..."
  SYNC=$(curl -s -X POST "http://127.0.0.1:8787/api/dev/openstates/sync?session=${SESSION}&limit=${LIMIT}")
  echo "Sync response: $SYNC"
  
  # Extract counts
  INSERTED=$(echo "$SYNC" | jq -r ".inserted // 0")
  UPDATED=$(echo "$SYNC" | jq -r ".updated // 0")
  echo "✓ Inserted: $INSERTED, Updated: $UPDATED"
  [[ "$INSERTED" -gt 0 || "$UPDATED" -gt 0 ]] && echo "✅ Sync successful" || echo "❌ Sync failed"
  
  # Scan pending bills for topics
  echo ""
  echo "2️⃣  Scanning bills for topics (${SCANS} iterations)..."
  for i in $(seq 1 ${SCANS}); do
    echo "   Scan $i/$SCANS..."
    SCAN=$(curl -s -X POST "http://127.0.0.1:8787/api/internal/civic/scan-pending-bills?limit=10")
    SCANNED=$(echo "$SCAN" | jq -r ".scanned // 0")
    TAGGED=$(echo "$SCAN" | jq -r ".tagged // 0")
    echo "   ✓ Scanned: $SCANNED, Tagged: $TAGGED"
    [[ "$SCANNED" -gt 0 ]] && echo "   ✅ Scan $i successful" || echo "   ⏭️  Scan $i skipped (no bills)"
    sleep 1
  done
  
  # Verify data in endpoint
  echo ""
  echo "3️⃣  Verifying endpoint results..."
  RESULTS=$(curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics" | jq ".results | length")
  echo "✓ Pending bills returned: $RESULTS"
  [[ "$RESULTS" -gt 0 ]] && echo "✅ Endpoint test passed" || echo "❌ Endpoint test failed"
  
  echo ""
  echo "✅ REFRESH TEST COMPLETE"
'
```

### Step 3: Verify Data Quality
```bash
# Check bill counts by status
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics" | jq '{
  count: (.results | length),
  statuses: (.results | group_by(.status) | map({status: .[0].status, count: length})),
  with_topics: (.results | map(select(.topics | length > 0)) | length),
  with_sponsors: (.results | map(select(.sponsors | length > 0)) | length),
  with_summary: (.results | map(select(.has_summary == true)) | length)
}'

# Expected output:
# {
#   "count": N,
#   "statuses": [{"status": "in_committee", "count": N}],
#   "with_topics": N,
#   "with_sponsors": N,
#   "with_summary": N
# }
```

### Step 4: Verify Database Counts
```bash
cd /home/anchor/projects/this-is-us/worker

npx wrangler d1 execute WY_DB --local --command "
SELECT 
  (SELECT COUNT(*) FROM civic_items WHERE source='lso') as lso_bills,
  (SELECT COUNT(*) FROM bill_sponsors) as sponsors,
  (SELECT COUNT(*) FROM civic_item_ai_tags) as topics,
  (SELECT COUNT(DISTINCT civic_item_id) FROM civic_item_ai_tags) as bills_with_topics;"
```

---

## Full Test Script

Save as `test-pending-bills-refresh.sh`:

```bash
#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║      PENDING BILLS WEEKLY REFRESH TEST SUITE              ║"
echo "╚════════════════════════════════════════════════════════════╝"

# Configuration
WORKER_URL="${WORKER_URL:-http://127.0.0.1:8787}"
SESSION="${SESSION:-2025}"
LIMIT="${LIMIT:-50}"
SCANS="${SCANS:-3}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0

test_result() {
  if [[ $1 -eq 0 ]]; then
    echo -e "${GREEN}✅ $2${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ $2${NC}"
    ((FAILED++))
  fi
}

echo ""
echo "Configuration:"
echo "  Worker URL: $WORKER_URL"
echo "  Session: $SESSION"
echo "  Limit: $LIMIT"
echo "  Scans: $SCANS"
echo ""

# Test 1: Health Check
echo "1️⃣  Health Check"
HEALTH=$(curl -s "$WORKER_URL/api/_health")
[[ $(echo "$HEALTH" | jq -r '.ok' 2>/dev/null) == "true" ]]
test_result $? "Worker health check"
echo ""

# Test 2: Clear Data (optional)
if [[ "${CLEAR_DATA:-false}" == "true" ]]; then
  echo "2️⃣  Clearing existing data..."
  cd worker
  npx wrangler d1 execute WY_DB --local --command "DELETE FROM civic_items WHERE source='lso';" >/dev/null 2>&1
  cd ..
  echo "   ✓ Data cleared"
  echo ""
fi

# Test 3: Sync Bills
echo "2️⃣  Syncing Bills from LSO"
SYNC=$(curl -s -X POST "$WORKER_URL/api/dev/openstates/sync?session=$SESSION&limit=$LIMIT")
INSERTED=$(echo "$SYNC" | jq -r '.inserted // 0')
UPDATED=$(echo "$SYNC" | jq -r '.updated // 0')
SYNC_TOTAL=$((INSERTED + UPDATED))

echo "   Inserted: $INSERTED, Updated: $UPDATED"
[[ $SYNC_TOTAL -gt 0 ]]
test_result $? "Bills synced (total: $SYNC_TOTAL)"
echo ""

# Test 4: Scan Bills
echo "3️⃣  Scanning Bills for Topics (${SCANS} iterations)"
TOTAL_SCANNED=0
TOTAL_TAGGED=0
for i in $(seq 1 $SCANS); do
  SCAN=$(curl -s -X POST "$WORKER_URL/api/internal/civic/scan-pending-bills?limit=10")
  SCANNED=$(echo "$SCAN" | jq -r '.scanned // 0')
  TAGGED=$(echo "$SCAN" | jq -r '.tagged // 0')
  TOTAL_SCANNED=$((TOTAL_SCANNED + SCANNED))
  TOTAL_TAGGED=$((TOTAL_TAGGED + TAGGED))
  echo "   Iteration $i: Scanned=$SCANNED, Tagged=$TAGGED"
  sleep 1
done

[[ $TOTAL_SCANNED -gt 0 ]]
test_result $? "Bills scanned (total: $TOTAL_SCANNED, tagged: $TOTAL_TAGGED)"
echo ""

# Test 5: Verify Endpoint Results
echo "4️⃣  Verifying Pending Bills Endpoint"
ENDPOINT=$(curl -s "$WORKER_URL/api/civic/pending-bills-with-topics")
RESULT_COUNT=$(echo "$ENDPOINT" | jq '.results | length')
echo "   Results returned: $RESULT_COUNT"

[[ $RESULT_COUNT -gt 0 ]]
test_result $? "Endpoint returns results"
echo ""

# Test 6: Verify Data Structure
echo "5️⃣  Verifying Result Data Structure"
FIRST_RESULT=$(echo "$ENDPOINT" | jq '.results[0]')

# Check required fields
REQUIRED_FIELDS=("id" "bill_number" "title" "chamber" "status" "sponsors" "topics" "ai_plain_summary" "verification_status")
MISSING=0
for field in "${REQUIRED_FIELDS[@]}"; do
  if ! echo "$FIRST_RESULT" | jq -e ".$field" >/dev/null 2>&1; then
    echo "   ❌ Missing field: $field"
    MISSING=$((MISSING + 1))
  fi
done

if [[ $MISSING -eq 0 ]]; then
  echo "   ✓ All required fields present"
fi

[[ $MISSING -eq 0 ]]
test_result $? "Data structure validation"
echo ""

# Test 7: Database Verification
echo "6️⃣  Database Verification"
cd worker
DB_COUNTS=$(npx wrangler d1 execute WY_DB --local --command "
SELECT 
  (SELECT COUNT(*) FROM civic_items WHERE source='lso') as lso_bills,
  (SELECT COUNT(*) FROM bill_sponsors) as sponsors,
  (SELECT COUNT(*) FROM civic_item_ai_tags) as topics;" 2>/dev/null | tail -n 20)

LSO_BILLS=$(echo "$DB_COUNTS" | grep -oP '(?<=\│ )\d+(?=\s+│ \d+)' | head -1)
SPONSORS=$(echo "$DB_COUNTS" | grep -oP '(?<=\│ )\d+(?=\s+│ \d+)' | head -2 | tail -1)
TOPICS=$(echo "$DB_COUNTS" | grep -oP '(?<=\│ )\d+' | tail -1)

echo "   LSO Bills: $LSO_BILLS"
echo "   Sponsors: $SPONSORS"
echo "   Topics: $TOPICS"

cd ..

[[ ${LSO_BILLS:-0} -gt 0 ]]
test_result $? "Bills persisted in database"
echo ""

# Summary
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                      TEST SUMMARY                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo ""

if [[ $FAILED -eq 0 ]]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
  exit 0
else
  echo -e "${RED}❌ SOME TESTS FAILED${NC}"
  exit 1
fi
```

Run the test:
```bash
chmod +x test-pending-bills-refresh.sh
CLEAR_DATA=true ./test-pending-bills-refresh.sh
```

---

## Cron Test (Scheduled Handler)

### Manual Trigger (Simulates Cron)
The scheduled handler in `worker/src/index.mjs` can be triggered manually via:

```bash
# Option 1: Curl the scheduled route (if exposed for testing)
curl -X POST "http://127.0.0.1:8787/api/internal/scheduled"

# Option 2: Deploy and test on production (cron runs automatically)
# Cron: Mondays 03:00 UTC
# Check logs: Cloudflare Workers dashboard
```

### Verify Cron Configuration
```bash
cd /home/anchor/projects/this-is-us/worker
grep -A 2 "production.triggers" wrangler.toml
# Expected:
# [env.production.triggers]
# crons = ["0 3 * * 1"]  # Mondays at 03:00 UTC
```

---

## Expected Success Signals

| Step | Success Criteria |
|------|------------------|
| Health | `{"ok": true}` |
| Sync | `inserted + updated > 0` |
| Scan | `scanned > 0` or skipped (no error) |
| Endpoint | `results.length > 0` |
| DB | `civic_items WHERE source='lso' > 0` |
| Fields | All required keys present in results |

---

## Troubleshooting

### Sync Returns 0
**Cause:** No new bills on LSO for session/limit  
**Fix:** Increase `LIMIT` or check OpenStates API

### Scan Returns 0 but No Error
**Cause:** All bills already scanned, nothing to do  
**Fix:** Normal; run with fresh data using `CLEAR_DATA=true`

### Endpoint Still Returns Empty
**Cause:** Verification filters blocking results  
**Fix:** Use `?include_flagged=true&include_incomplete=true`

### Worker Not Running
**Cause:** Missing `./start_wrangler.sh`  
**Fix:** Start worker in separate terminal first

---

## Admin Script Template

If `scripts/admin-refresh-pending-bills.sh` doesn't exist, create it:

```bash
#!/bin/bash
# worker/scripts/admin-refresh-pending-bills.sh
# Manual admin script to refresh pending bills (sync + scan)

set -e

WORKER_URL="${WORKER_URL:-http://127.0.0.1:8787}"
SESSION="${SESSION:-$(date +%Y)}"
LIMIT="${LIMIT:-200}"
SCANS="${SCANS:-5}"

echo "🔄 Pending Bills Manual Refresh"
echo "Session: $SESSION, Limit: $LIMIT, Scans: $SCANS"
echo ""

# Sync
echo "1️⃣  Syncing bills..."
SYNC=$(curl -s -X POST "$WORKER_URL/api/dev/openstates/sync?session=$SESSION&limit=$LIMIT")
echo "$SYNC" | jq .
echo ""

# Scan
echo "2️⃣  Scanning pending bills..."
for i in $(seq 1 $SCANS); do
  echo "Scan $i/$SCANS..."
  SCAN=$(curl -s -X POST "$WORKER_URL/api/internal/civic/scan-pending-bills?limit=15")
  echo "$SCAN" | jq '{scanned: .scanned, tagged: .tagged, errors: .errors}'
  sleep 1
done

# Verify
echo ""
echo "3️⃣  Final verification..."
curl -s "$WORKER_URL/api/civic/pending-bills-with-topics" | jq '{count: (.results | length), sample: .results[0]}'

echo ""
echo "✅ Refresh complete"
```

---

## Deployment Checklist

- [ ] `BILL_SCANNER_ENABLED=true` set in production env vars
- [ ] Cron trigger configured in `worker/wrangler.toml` 
- [ ] `runPendingBillsRefresh` exported from `src/jobs/pendingBillsRefresh.mjs`
- [ ] Scheduled handler wired in `src/index.mjs` (line ~270)
- [ ] Admin script exists at `scripts/admin-refresh-pending-bills.sh`
- [ ] Test script runs locally without errors
- [ ] Deploy code to production
- [ ] Monitor first cron execution (Monday 03:00 UTC)
- [ ] Verify bills synced + scanned in production logs
