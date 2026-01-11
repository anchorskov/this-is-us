Status: Active
Updated: 2025-12-17
Owner: Eng Platform
Scope: Wyoming LSO Orchestrator

# Exact Run Commands

Copy-paste ready commands for running the orchestrator E2E test.

## Prerequisites

```bash
# Verify no demo data
sqlite3 ../scripts/wr-persist/WY_DB.db "SELECT COUNT(*) FROM civic_items WHERE id LIKE 'test-%';"
# Should return: 0

# Check curl and jq installed
which curl jq
```

## Run the test

```bash
bash worker/scripts/test_orchestrator_e2e_2026.sh
```

Exit code 0 = PASS  
Exit code 1 = FAIL (check output for reason)

## Run with output saved

```bash
bash worker/scripts/test_orchestrator_e2e_2026.sh | tee /tmp/e2e_results.txt
cat /tmp/e2e_results.txt
```

## Run in CI/CD

```bash
#!/bin/bash
set -e
cd /home/anchor/projects/this-is-us

# Start dev server
./scripts/wr dev &
SERVER_PID=$!
sleep 3

# Run test
bash worker/scripts/test_orchestrator_e2e_2026.sh
TEST_RESULT=$?

# Cleanup
kill $SERVER_PID 2>/dev/null || true

exit $TEST_RESULT
```

## Troubleshoot

```bash
# Check if ./scripts/wr dev is running
curl -s http://127.0.0.1:8787/api/_health | jq .
# Should return: {"ok": true}

# Check database
sqlite3 ../scripts/wr-persist/WY_DB.db ".tables"
# Should include: civic_items, civic_item_sources, civic_item_ai_tags

# Count bills
sqlite3 ../scripts/wr-persist/WY_DB.db "SELECT COUNT(*) FROM civic_items WHERE kind='bill' AND legislative_session='2026';"

# Check for demo data
sqlite3 ../scripts/wr-persist/WY_DB.db "SELECT id FROM civic_items WHERE id LIKE 'test-%' LIMIT 5;"

# Clean demo data
sqlite3 ../scripts/wr-persist/WY_DB.db "DELETE FROM civic_items WHERE id LIKE 'test-%';"
```

## Expected output format

```
PASS: year=2026 lso_total=44 db_active=44 sources=5 tags=12
```

If you see this line with exit code 0, the test passed.

---

For full documentation, see:
- `docs/wyoleg/orchestrator_e2e_test.md` — Complete phase-by-phase breakdown
- `docs/wyoleg/orchestrator_e2e_quickstart.md` — One-page quick reference
- `ORCHESTRATOR_E2E_TEST_DELIVERY.md` — Implementation summary
