# Quick Reference: Local Bill Ingest Commands

## All-In-One Terminal Sequence

```bash
# Terminal 1: Start the worker
cd /home/anchor/projects/this-is-us
./start_wrangler.sh

# ============================================================

# Terminal 2: Main workflow
cd /home/anchor/projects/this-is-us/worker

# 1. Apply migrations
npx wrangler d1 migrations apply WY_DB --local

# 2. Verify tables exist
npx wrangler d1 execute WY_DB --local --command "SELECT COUNT(*) as tables FROM sqlite_master WHERE type='table';"

# 3. Ingest bills from LSO
curl -X POST "http://127.0.0.1:8787/api/dev/lso/hydrate-bills?year=2025&limit=25"

# 4. Check counts
npx wrangler d1 execute WY_DB --local --command "SELECT COUNT(*) FROM civic_items WHERE source='lso';"
npx wrangler d1 execute WY_DB --local --command "SELECT COUNT(*) FROM bill_sponsors;"
npx wrangler d1 execute WY_DB --local --command "SELECT COUNT(*) FROM wy_legislators;"

# 5. Test pending bills endpoint
curl http://127.0.0.1:8787/api/civic/pending-bills-with-topics | jq '.results | length'

# 6. (Optional) Scan for topics
curl -X POST "http://127.0.0.1:8787/api/internal/civic/scan-pending-bills?limit=5"

# 7. (Optional) Generate summary for first bill
BILL_ID=$(curl http://127.0.0.1:8787/api/civic/pending-bills-with-topics 2>/dev/null | jq -r '.results[0].id')
curl -X POST "http://127.0.0.1:8787/api/internal/civic/test-bill-summary" \
  -H "Content-Type: application/json" \
  -d "{\"civic_item_id\": \"$BILL_ID\"}"
```

---

## Expected Success Signals

| Command | Expected Output |
|---------|-----------------|
| Migrations apply | `✅ 0023_add_lso_hydration_fields.sql` |
| Hydrate bills | `"ok": true, "inserted": N, "errors": 0` |
| civic_items count | `> 0` (e.g., `25`) |
| bill_sponsors count | `> 0` |
| wy_legislators count | `> 0` (e.g., `91`) |
| Pending bills length | `> 0` (e.g., `25`) |
| Scan pending bills | `"ok": true, "scanned": N` |

---

## Endpoints Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/dev/lso/hydrate-bills?year=2025&limit=25` | Ingest bills from Wyoming LSO |
| GET | `/api/civic/pending-bills-with-topics` | Fetch pending bills with sponsors & topics |
| POST | `/api/internal/civic/scan-pending-bills?limit=5` | Tag bills with AI topics |
| POST | `/api/internal/civic/test-bill-summary` | Generate AI summary for a bill |

---

## Database Verification

```bash
# Check all tables
npx wrangler d1 execute WY_DB --local --command ".schema" | grep "CREATE TABLE"

# Check specific table structure
npx wrangler d1 execute WY_DB --local --command "PRAGMA table_info(bill_sponsors);"

# Count records per table
npx wrangler d1 execute WY_DB --local --command "
  SELECT 'civic_items' as table_name, COUNT(*) as count FROM civic_items
  UNION ALL
  SELECT 'bill_sponsors', COUNT(*) FROM bill_sponsors
  UNION ALL
  SELECT 'wy_legislators', COUNT(*) FROM wy_legislators;"
```

---

## Debugging Commands

```bash
# Health check
curl http://127.0.0.1:8787/api/_health

# View bills in detail
curl http://127.0.0.1:8787/api/civic/pending-bills-with-topics | jq '.results[0]'

# Check bill_sponsors for a specific bill
BILL_ID="wy_2025_hb001"
curl http://127.0.0.1:8787/api/civic/pending-bills-with-topics | jq ".results[] | select(.id==\"$BILL_ID\") | .bill_sponsors"

# View worker logs
tail -f /tmp/wrangler.log  # if started in background
```
