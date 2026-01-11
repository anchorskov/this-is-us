# Local D1 Bill Ingestion & Testing Guide

## Step 1: Ensure Migrations Applied Locally

```bash
cd /home/anchor/projects/this-is-us/worker
./scripts/wr d1 migrations apply WY_DB --local
```

**Expected:** Both migrations complete successfully
```
✔ 0022_populate_wy_legislators.sql ✅
✔ 0023_add_lso_hydration_fields.sql ✅
```

---

## Step 2: Verify Tables Exist

```bash
cd /home/anchor/projects/this-is-us/worker
./scripts/wr d1 execute WY_DB --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" | head -20
```

**Expected:** See `bill_sponsors`, `civic_items`, `wy_legislators` in output

---

## Step 3: Ingest Bills from Wyoming LSO API

Start the local worker in a **separate terminal**:
```bash
cd /home/anchor/projects/this-is-us
./start_wrangler.sh
```

In your main terminal, hydrate bills from LSO (fetches 25 bills from current year):
```bash
curl -X POST "http://127.0.0.1:8787/api/dev/lso/hydrate-bills?year=2025&limit=25"
```

**Expected Response:**
```json
{
  "ok": true,
  "year": 2025,
  "inserted": 15,
  "updated": 5,
  "hydrated": 20,
  "errors": 0
}
```

---

## Step 4: Verify Data Populated

### Check civic_items count:
```bash
cd /home/anchor/projects/this-is-us/worker
./scripts/wr d1 execute WY_DB --local --command "SELECT COUNT(*) as count FROM civic_items WHERE source='lso';"
```

**Expected:** `count > 0` (should show 15-25)

### Check bill_sponsors count:
```bash
cd /home/anchor/projects/this-is-us/worker
./scripts/wr d1 execute WY_DB --local --command "SELECT COUNT(*) as count FROM bill_sponsors;"
```

**Expected:** `count > 0`

### Check wy_legislators count:
```bash
cd /home/anchor/projects/this-is-us/worker
./scripts/wr d1 execute WY_DB --local --command "SELECT COUNT(*) as count FROM wy_legislators;"
```

**Expected:** `count > 0` (should be ~90 Wyoming legislators)

---

## Step 5: Test Pending Bills Endpoint

```bash
curl http://127.0.0.1:8787/api/civic/pending-bills-with-topics
```

**Expected Response:**
```json
{
  "results": [
    {
      "id": "wy_2025_hb001",
      "title": "...",
      "status": "pending",
      "bill_sponsors": [...],
      "topics": [...]
    },
    ...
  ]
}
```

**Success signal:** `jq '.results | length'` returns `> 0`

---

## Step 6: (Optional) Enrich Bills with AI Summaries

### Scan pending bills for topic tagging:
```bash
curl -X POST "http://127.0.0.1:8787/api/internal/civic/scan-pending-bills?limit=5"
```

**Expected:** Each bill gets tagged with topics (e.g., "Environment", "Education")

### Generate AI summary for a specific bill:
```bash
BILL_ID="wy_2025_hb001"
curl -X POST "http://127.0.0.1:8787/api/internal/civic/test-bill-summary" \
  -H "Content-Type: application/json" \
  -d "{\"civic_item_id\": \"$BILL_ID\"}"
```

**Expected Response:**
```json
{
  "civic_item_id": "wy_2025_hb001",
  "summary": "This bill proposes...",
  "timestamp": "2025-12-13T..."
}
```

---

## Step 7: Verify Full Pending Bills Page

Test the full endpoint with JSON output:
```bash
curl http://127.0.0.1:8787/api/civic/pending-bills-with-topics | jq '.results | length'
```

**Success:** Should return a number > 0 (e.g., `5`, `15`, `25`)

Check response includes sponsors and topics:
```bash
curl http://127.0.0.1:8787/api/civic/pending-bills-with-topics | jq '.results[0] | keys'
```

**Expected keys:** `id`, `title`, `status`, `bill_sponsors`, `topics`, etc.

---

## Troubleshooting

### "bill_sponsors" table doesn't exist
- Migrations didn't apply; re-run Step 1

### 0 results from pending bills
- Bills not yet hydrated; re-run Step 3
- Check civic_items count in Step 4

### Hydrate endpoint returns 403
- Not running on localhost; check `start_wrangler.sh` output shows `127.0.0.1:8787`

### Hydrate endpoint times out
- LSO API may be slow; try with smaller `limit=5`

---

## Summary Checklist

- [ ] Migrations applied (`./scripts/wr d1 migrations apply WY_DB --local`)
- [ ] `bill_sponsors`, `civic_items`, `wy_legislators` tables exist
- [ ] Worker started on `127.0.0.1:8787` via `./start_wrangler.sh`
- [ ] LSO hydrate endpoint returns `ok: true` with `inserted > 0`
- [ ] `/api/civic/pending-bills-with-topics` returns 200 with `results.length > 0`
- [ ] Each result includes `bill_sponsors[]` and `topics[]`

