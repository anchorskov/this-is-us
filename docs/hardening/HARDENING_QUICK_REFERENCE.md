# HARDENING QUICK REFERENCE & TROUBLESHOOTING

---

## 🚀 QUICK START

### Run Full Hardening Audit
```bash
cd /home/anchor/projects/this-is-us/worker
./scripts/wr dev &  # Start ./scripts/wr dev in background
./scripts/test-wyoleg-completeness-hardened.sh
```

**Expected Output:**
```
╔════════════════════════════════════════════════════════════════════════════╗
║        HARDENED Wyoming LSO Completeness Verification & Audit             ║
╚════════════════════════════════════════════════════════════════════════════╝

✅ Connected to ./scripts/wr dev
✅ No demo/test bills detected (real data only)
✅ ingestion_metadata table exists
✅ Metadata write/read verified
✅ wyoleg.gov count obtained: 432 bills
✅ OpenStates fallback correctly blocked
✅ Session filtering verified
✅ Metadata stored for session 2025
✅ All bills synced for session 2025

═══════════════════════════════════════════════════════════════════════════
✅ Audit Complete
```

**Exit Code:** `0` (success)

---

## 🔑 KEY HARDENING ENFORCEMENTS

### 1. Real Data Only
```bash
# ✅ GOOD: Database contains only real bills
SELECT COUNT(*) FROM civic_items WHERE bill_number NOT LIKE 'test-%' AND bill_id NOT LIKE 'demo-%';

# ❌ BAD: Database contains demo bills
SELECT COUNT(*) FROM civic_items WHERE bill_number LIKE 'test-%' OR bill_id LIKE 'demo-%';
```

### 2. wyoleg.gov is Authoritative
```bash
# ✅ GOOD: wyoleg_count_method is "wyoleg"
{
  "wyoleg_total_bills": 432,
  "wyoleg_count_method": "wyoleg",
  "complete": true
}

# ❌ BAD: wyoleg_total_bills is authoritative but method is openstates_fallback
{
  "wyoleg_total_bills": 432,          // ❌ Should be null if fallback
  "wyoleg_count_method": "openstates_fallback"
}

# ❌ BAD: method is just "openstates"
{
  "wyoleg_count_method": "openstates"  // ❌ Never just "openstates"
}
```

### 3. OpenStates is Fallback Only
```bash
# ✅ GOOD: Fallback returned null count
{
  "wyoleg_total_bills": null,
  "wyoleg_count_method": "openstates_fallback",
  "wyoleg_count_error": "wyoleg.gov network timeout"
}

# ❌ BAD: Fallback returned a count (becomes authoritative)
{
  "wyoleg_total_bills": 425,           // ❌ BAD: OpenStates count presented as truth
  "wyoleg_count_method": "openstates_fallback"
}
```

### 4. Session Scope Isolation
```bash
# ✅ GOOD: Query includes session filter
WHERE legislative_session = :session AND ...

# ❌ BAD: Query mixes sessions
SELECT * FROM civic_items WHERE ...  // No session filter

# ✅ GOOD: Metadata includes session
key = 'wyoleg_2025_total_bills'

# ❌ BAD: Metadata doesn't include session
key = 'wyoleg_total_bills'  // No session identifier
```

### 5. Idempotency
```bash
# ✅ GOOD: Duplicate prevention via primary key
INSERT OR IGNORE INTO civic_items (bill_id, ...) VALUES (?, ...)

# ✅ GOOD: Metadata check prevents re-run
SELECT value_int FROM ingestion_metadata WHERE key = 'wyoleg_2025_total_bills'
if exists: don't recount

# ❌ BAD: No duplicate prevention
INSERT INTO civic_items (bill_id, ...) VALUES (?, ...)  // Allows duplicates
```

---

## 📋 DEPLOYMENT VERIFICATION CHECKLIST

Before going to production, verify all items:

### Pre-Deployment (Local Testing)
- [ ] Run `./scripts/test-wyoleg-completeness-hardened.sh`
- [ ] All 6 audit steps pass
- [ ] Exit code is 0
- [ ] wyoleg_total_bills is a number (not null)
- [ ] wyoleg_count_method is "wyoleg" (not "openstates_fallback")
- [ ] Demo data check passes (no test bills)
- [ ] No errors in metadata operations

### Pre-Deployment (Code Review)
- [ ] All files have path comment at top
- [ ] orchestrator.ts includes `wyoleg_count_method` in response
- [ ] wyoleg-counter.ts returns `{total: null, method: "openstates_fallback"}` on failure
- [ ] All queries filter by `legislative_session = :session`
- [ ] bill-tracker.ts uses `INSERT OR IGNORE`
- [ ] Migration includes ingestion_metadata table

### Production (After Deployment)
- [ ] Test one orchestrator run: 
  ```bash
  curl https://your-domain/api/internal/admin/wyoleg/run \
    -d '{"session":"2025","limit":25}' | jq '.wyoleg_count_method'
  # Should show: "wyoleg" (not "openstates" or "openstates_fallback")
  ```
- [ ] Verify session isolation with multiple sessions
- [ ] Check metadata stored in ingestion_metadata table
- [ ] Run completeness test to full completion
- [ ] Monitor logs for any "OpenStates" in wyoleg_count_error

---

## 🔧 TROUBLESHOOTING

### Issue: "Cannot connect to ./scripts/wr dev"

**Symptom:** Test script fails at Step 0
```
❌ FAIL: Cannot connect to ./scripts/wr dev at http://127.0.0.1:8787
```

**Solution:**
```bash
# Start ./scripts/wr dev in a separate terminal
cd /home/anchor/projects/this-is-us/worker
./scripts/wr dev

# In another terminal, run the test script
./scripts/test-wyoleg-completeness-hardened.sh
```

---

### Issue: "Demo/test bills found in database"

**Symptom:** Test script fails at Step 1
```
❌ FAIL: Demo/test bills found in database!
Count: 5
```

**Solution:**
```bash
# Delete database and restart
rm ../scripts/wr-persist/d1-database-WY_DB.sqlite

# Restart ./scripts/wr dev
./scripts/wr dev

# Re-run test script
./scripts/test-wyoleg-completeness-hardened.sh
```

---

### Issue: "ingestion_metadata table does not exist"

**Symptom:** Test script fails at Step 2
```
❌ FAIL: ingestion_metadata table does not exist
```

**Solution:**
```bash
# Apply migrations
./scripts/wr d1 migrations apply WY_DB --local

# Restart ./scripts/wr dev
./scripts/wr dev

# Re-run test script
./scripts/test-wyoleg-completeness-hardened.sh
```

---

### Issue: "OpenStates became authoritative source"

**Symptom:** Test script fails at Step 3
```
❌ CRITICAL FAILURE: OpenStates became authoritative source!
wyoleg_total_bills should be null if method is openstates_fallback
```

**Solution:**
Check [worker/src/wyoleg-counter.ts](worker/src/wyoleg-counter.ts):
```typescript
// ❌ WRONG
if (fallback) {
  return { total: fallbackCount, method: "openstates_fallback" };
}

// ✅ CORRECT
if (fallback) {
  return { total: null, method: "openstates_fallback", error: "..." };
}
```

---

### Issue: "Session filtering may not be correct"

**Symptom:** Test script shows warning at Step 4
```
⚠️  WARNING: db_total_bills may not be filtered by session correctly
Response shows: 150
Query shows: 120 for session 2025
```

**Solution:**
Check [worker/src/orchestrator.ts](worker/src/orchestrator.ts):
```typescript
// ❌ WRONG
const count = await db.prepare(`SELECT COUNT(*) FROM civic_items`).first();

// ✅ CORRECT
const count = await db.prepare(
  `SELECT COUNT(*) FROM civic_items WHERE legislative_session = ?`
).bind(session).first();
```

---

### Issue: "Metadata not found but count was obtained"

**Symptom:** Test script shows warning at Step 5
```
⚠️  Metadata not found but count was obtained
This may indicate storage failed
```

**Solution:**
1. Verify ingestion_metadata table is writable:
   ```bash
   ./scripts/wr d1 execute WY_DB --local --command \
     "INSERT INTO ingestion_metadata (key, value_int) VALUES ('test_key', 123);"
   ```

2. Check orchestrator stores metadata:
   ```typescript
   // Verify this code exists
   await db.prepare(`
     INSERT INTO ingestion_metadata (key, value_int, value_text)
     VALUES (?, ?, ?)
   `).bind(`wyoleg_${session}_total`, count, method).run();
   ```

---

### Issue: "Incomplete after maxRuns"

**Symptom:** Test script shows at Step 6
```
⚠️  Incomplete after 3 runs
Remaining: 45
```

**Solution:**
This is expected behavior. The test script defaults to 3 runs maximum.

Options:
```bash
# Run again to continue syncing
./scripts/test-wyoleg-completeness-hardened.sh

# Or increase maxRuns
MAX_RUNS=10 ./scripts/test-wyoleg-completeness-hardened.sh

# Or use the orchestrator endpoint directly
curl -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run-until-complete \
  -d '{"session":"2025","maxRuns":50,"limit":25}'
```

---

## 📊 HARDENING LEVELS

### Level 1: Basic (Current Implementation)
- [x] File path comments
- [x] Migration includes all tables
- [x] wyoleg.gov is primary source
- [x] Session filtering enforced
- [x] Metadata persistence

### Level 2: Hardened (This Audit)
- [x] Real data integrity checks
- [x] Test script with 6-step audit
- [x] Source-of-truth enforcement validation
- [x] Session scope verification
- [x] Metadata persistence checks
- [x] Completeness detection testing
- [x] CI/CD ready exit codes

### Level 3: Maximum Security (Optional)
- [ ] GPG signing of deployment artifacts
- [ ] Production data signing & verification
- [ ] Audit log encryption
- [ ] Role-based access control
- [ ] Rate limiting on orchestrator endpoints

---

## 📞 QUICK COMMANDS

### View All Bills (Current Session)
```bash
sqlite3 ../scripts/wr-persist/d1-database-WY_DB.sqlite \
  "SELECT bill_id, bill_number, title FROM civic_items WHERE legislative_session='2025' LIMIT 10;"
```

### Check Metadata
```bash
sqlite3 ../scripts/wr-persist/d1-database-WY_DB.sqlite \
  "SELECT key, value_int, value_text FROM ingestion_metadata WHERE key LIKE 'wyoleg_2025_%';"
```

### Test Single Orchestrator Run
```bash
curl -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run \
  -H "Content-Type: application/json" \
  -d '{"session":"2025","limit":25}' | jq '.'
```

### Test Completeness (Run Until Complete)
```bash
curl -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run-until-complete \
  -H "Content-Type: application/json" \
  -d '{"session":"2025","maxRuns":10,"limit":25}' | jq '.'
```

### Clear All Data (Reset)
```bash
# Stop ./scripts/wr dev first
rm ../scripts/wr-persist/d1-database-WY_DB.sqlite

# Apply migrations
./scripts/wr d1 migrations apply WY_DB --local

# Restart ./scripts/wr dev
./scripts/wr dev
```

---

## 📚 REFERENCE DOCUMENTS

- [HARDENING_AUDIT_COMPLETE.md](HARDENING_AUDIT_COMPLETE.md) - Full audit report
- [CHANGES_DELIVERED_HARDENING.md](CHANGES_DELIVERED_HARDENING.md) - Detailed change log
- [worker/scripts/test-wyoleg-completeness-hardened.sh](worker/scripts/test-wyoleg-completeness-hardened.sh) - Test script source
- [ARCHITECTURE_IMPLEMENTATION_INDEX.md](ARCHITECTURE_IMPLEMENTATION_INDEX.md) - Architecture overview

---

## ✅ STATUS

**Hardening Level:** ✅ Level 2 (Hardened)  
**Audit Result:** ✅ PASSED  
**Deployment Status:** ✅ Ready  
**Last Updated:** 2025-01-15

All hardening requirements verified and ready for production deployment.
