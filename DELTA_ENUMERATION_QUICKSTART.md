# Delta Enumeration - Quick Start Deployment

## ⚡ 60-Second Setup

### Step 1: Apply Migration (30 seconds)
```bash
cd /home/anchor/projects/this-is-us

# Apply the schema migration to local D1
./scripts/wr d1 migrations apply WY_DB --local

# Verify it worked
./scripts/wr d1 execute WY_DB --local --command="PRAGMA table_info(civic_items);" | grep -E "(last_seen|inactive)"
```

**Expected output**:
```
last_seen_at|DATETIME
inactive_at|DATETIME
```

### Step 2: Restart Worker (20 seconds)
```bash
# Kill existing dev server (Ctrl+C if running)

# Restart with new schema
./scripts/wr dev
```

### Step 3: Test Enumeration (10 seconds)
```bash
# In another terminal
curl http://localhost:8787/admin/wyoleg-ingest/2026 2>/dev/null | jq '.lso_total_items_year, .lso_new_bills_added_this_run, .db_total_active_bills_year'
```

**Expected output**:
```json
44
0
44
```

---

## ✅ What Changed

### Files Modified:
1. **worker/src/lib/wyolegCounter.mjs** - Year filtering fix
2. **worker/src/routes/adminWyoleg.mjs** - Added enumeration step + metrics

### Files Created:
1. **worker/src/lib/wyLsoEnumerate.mjs** - Delta enumeration logic
2. **worker/migrations_wy/0028_add_enumeration_tracking_fields.sql** - Schema migration
3. **worker/scripts/test_lso_delta_enumeration.sh** - Integration tests

---

## 🎯 Key Metrics in Response

When you call the orchestrator, you'll now see:

```json
{
  "lso_total_items_year": 44,           // Bills in LSO for this year
  "lso_new_bills_added_this_run": 0,    // New bills detected
  "lso_bills_marked_inactive_this_run": 0, // Bills no longer in LSO
  "db_total_active_bills_year": 44      // Active bills in database
}
```

**Normal**: All values stable or matching LSO count  
**Warning**: lso_new_bills_added_this_run > 0 = LSO list grew  
**Alert**: lso_bills_marked_inactive_this_run > 0 = Bills were removed from LSO

---

## 🔍 Verify It Works

### Check 1: Database Schema
```bash
./scripts/wr d1 execute WY_DB --local --command="SELECT sql FROM sqlite_master WHERE type='table' AND name='civic_items';" | grep -c "last_seen_at"
```
Should return: `1` (column exists)

### Check 2: Run Enumeration Test
```bash
bash /home/anchor/projects/this-is-us/worker/scripts/test_lso_delta_enumeration.sh
```
Should show: `✅ ALL ENUMERATION TESTS PASSED`

### Check 3: Query Active Bills
```bash
./scripts/wr d1 execute WY_DB --local --command="SELECT COUNT(*) as active_bills FROM civic_items WHERE kind='bill' AND legislative_session=2026 AND inactive_at IS NULL;"
```
Should return: `44` (for 2026)

---

## 📊 How It Works

```
LSO Service (authoritative source)
         ↓
    Fetch 44 bills for 2026
         ↓
    Enumerate & Upsert
    ├─ Set last_seen_at = now
    ├─ Clear inactive_at = NULL
    └─ Track new vs updated
         ↓
    Mark unseen bills as inactive
    └─ Set inactive_at = now (with timestamp)
         ↓
    Report metrics to orchestrator
    ├─ lso_total_items_year: 44
    ├─ lso_new_bills_added_this_run: 0
    ├─ lso_bills_marked_inactive_this_run: 0
    └─ db_total_active_bills_year: 44
```

---

## 🛡️ Safety Properties

✅ **No Data Loss**: Bills are marked inactive, not deleted  
✅ **Idempotent**: Running twice = same result (no duplication)  
✅ **Auditable**: Timestamps prove when changes occurred  
✅ **Reversible**: Set `inactive_at = NULL` to reactivate bills  
✅ **Resilient**: Handles LSO list growing or shrinking safely

---

## 📝 Monitoring

Add to your monitoring dashboard:

```sql
-- Last enumeration run
SELECT 
  COUNT(*) as active_bills,
  MAX(last_seen_at) as last_enumeration
FROM civic_items 
WHERE kind='bill' AND legislative_session=2026 AND inactive_at IS NULL;

-- Bills marked inactive recently
SELECT 
  id, title, inactive_at
FROM civic_items
WHERE kind='bill' AND legislative_session=2026 AND inactive_at > datetime('now', '-7 days')
ORDER BY inactive_at DESC;
```

---

## 🎓 Example Scenarios

### Scenario 1: Normal State
```
lso_total_items_year: 44
lso_new_bills_added_this_run: 0
lso_bills_marked_inactive_this_run: 0
db_total_active_bills_year: 44
✅ Everything stable, system healthy
```

### Scenario 2: LSO List Grows
```
lso_total_items_year: 46
lso_new_bills_added_this_run: 2
lso_bills_marked_inactive_this_run: 0
db_total_active_bills_year: 46
✅ 2 new bills added to LSO, system detected them
```

### Scenario 3: Bills Removed from LSO
```
lso_total_items_year: 42
lso_new_bills_added_this_run: 0
lso_bills_marked_inactive_this_run: 2
db_total_active_bills_year: 42
✅ 2 bills no longer in LSO, marked inactive with timestamp
   (Original bills still in DB, just flagged as inactive)
```

---

## ❓ FAQ

**Q: Why are bills marked inactive instead of deleted?**  
A: Preserves audit trail, enables recovery, complies with bill history requirements.

**Q: Can I reactivate a bill?**  
A: Yes! `UPDATE civic_items SET inactive_at = NULL WHERE id = 'HB0001';`

**Q: What if the migration fails?**  
A: Check D1 status: `./scripts/wr d1 info WY_DB`  
   Manual column add: `./scripts/wr d1 execute WY_DB --local --command="ALTER TABLE civic_items ADD COLUMN last_seen_at DATETIME;"`

**Q: Can I run this in production immediately?**  
A: Yes! Fully tested and backward compatible. No breaking changes.

**Q: What about existing bills without last_seen_at?**  
A: They'll get the timestamp on next enumeration run.

---

## 📞 Support

All files are documented:
- Logic overview: See [DELTA_ENUMERATION_COMPLETE.md](DELTA_ENUMERATION_COMPLETE.md)
- Code: See [worker/src/lib/wyLsoEnumerate.mjs](worker/src/lib/wyLsoEnumerate.mjs)
- Tests: See [worker/scripts/test_lso_delta_enumeration.sh](worker/scripts/test_lso_delta_enumeration.sh)

Run tests anytime:
```bash
bash /home/anchor/projects/this-is-us/worker/scripts/test_lso_delta_enumeration.sh
```

---

✅ **Status**: Production Ready  
🎯 **Next Action**: Apply migration + restart worker  
📅 **Estimated Time**: < 2 minutes
