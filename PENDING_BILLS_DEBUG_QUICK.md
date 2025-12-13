# Quick Debug: Empty Pending Bills

## Essential WHERE Clause Filters

```
kind='bill'
level='statewide'
jurisdiction_key='WY'
source='lso'                      ← CRITICAL
status IN ['introduced','in_committee','pending_vote']
civ.structural_ok=1 & status='ok' (unless ?include_flagged=true)
civh.review_status='ready'        (unless ?include_incomplete=true)
```

---

## Fast Diagnostics (5-Minute Debug)

```bash
cd /home/anchor/projects/this-is-us/worker

# 1. Any LSO bills pending?
npx wrangler d1 execute WY_DB --local --command "
  SELECT COUNT(*) FROM civic_items 
  WHERE source='lso' AND status IN ('introduced','in_committee','pending_vote');"

# 2. Do verification records exist?
npx wrangler d1 execute WY_DB --local --command "
  SELECT COUNT(*) FROM civic_item_verification 
  WHERE check_type IN ('review_pipeline','lso_hydration');"

# 3. Test without verification filters
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics?include_flagged=true&include_incomplete=true" | jq '.results | length'

# 4. Test normal endpoint
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics" | jq '.results | length'
```

---

## Expected Outputs

| Command | Expected | Problem If |
|---------|----------|-----------|
| Step 1 | > 0 | = 0 → Run ingest (see below) |
| Step 2 | > 0 | = 0 → Run scan-pending-bills |
| Step 3 | > 0 | = 0 → Verification filters blocking; disable them |
| Step 4 | > 0 | = 0 but Step 3 is > 0 → Verification table needs update |

---

## If 0 Results: Ingest Bills

```bash
# Terminal 1: Start worker
cd /home/anchor/projects/this-is-us && ./start_wrangler.sh

# Terminal 2: Ingest
curl -X POST "http://127.0.0.1:8787/api/dev/lso/hydrate-bills?year=2025&limit=25"
```

**Expected:** `{"ok": true, "inserted": > 0}`

Then verify:
```bash
npx wrangler d1 execute WY_DB --local --command "SELECT COUNT(*) FROM civic_items WHERE source='lso';"
```

---

## If Still 0: Generate Verification Records

```bash
curl -X POST "http://127.0.0.1:8787/api/internal/civic/scan-pending-bills?limit=10"
```

**Expected:** `{"ok": true, "scanned": > 0}`

---

## Full Diagnostic Guide

See [PENDING_BILLS_DEBUG.md](PENDING_BILLS_DEBUG.md) for 10-step troubleshooting tree.

---

## Handler Filters (from pendingBills.mjs:176-206)

```javascript
WHERE ci.kind = 'bill'
  AND ci.level = 'statewide'
  AND ci.jurisdiction_key = 'WY'
  AND ci.source = 'lso'
  AND ci.status IN ('introduced','in_committee','pending_vote')
  AND (
    !includeFlagged ? civ.structural_ok = 1 AND civ.status = 'ok' : TRUE
  )
  AND (
    !includeIncomplete ? civh.review_status = 'ready' : TRUE
  )
```

**Query Params:**
- `?include_flagged=true` → Skip structural verification
- `?include_incomplete=true` → Skip LSO hydration status check
- `?chamber=house|senate` → Filter by chamber
- `?session=2025` → Filter by session
- `?status=introduced|in_committee|pending_vote` → Filter by status
- `?topic_slug=<slug>` → Filter by topic tag

---

## Database Tables Involved

| Table | Key Column | Purpose |
|-------|-----------|---------|
| `civic_items` | `id`, `source='lso'` | Bills |
| `civic_item_verification` | `civic_item_id`, `check_type` | Structural & hydration checks |
| `civic_item_ai_tags` | `item_id` | Topics assigned to bills |
| `bill_sponsors` | `civic_item_id` | Sponsors per bill |
| `votes` | `target_id` | User votes on bills |

---

## Most Common Issues

1. **No LSO bills imported** → Run `/api/dev/lso/hydrate-bills`
2. **Bills exist but filtered out** → Try `?include_flagged=true&include_incomplete=true`
3. **Verification records missing** → Run `/api/internal/civic/scan-pending-bills`
4. **Verification status != 'ok'** → Re-run scan or disable filters
