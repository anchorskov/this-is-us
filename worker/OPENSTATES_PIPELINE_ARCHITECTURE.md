# OpenStates Data Pipeline Architecture
## Where to Add: Batch Summary, Batch Verification, and Sponsor Ingestion

---

## Current Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    worker/src/index.mjs                         │
│                    (Central Router)                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
        ┌───────▼────────┐    │    ┌────────▼─────────┐
        │ OpenStates     │    │    │ Civic Scan &     │
        │ Ingestion      │    │    │ Verification     │
        │                │    │    │                  │
        │ /api/dev/      │    │    │ /api/internal/   │
        │ openstates/    │    │    │ civic/           │
        │ sync           │    │    │                  │
        │                │    │    │ ├─ scan-pending- │
        └────────────────┘    │    │ │  bills (✅)    │
                              │    │ ├─ test-bill-    │
                              │    │ │  summary (✅)  │
                              │    │ ├─ verify-bill   │
                              │    │ │  (✅)          │
                              │    │ └─ batch-verify  │
                              │    │    (❌ TODO)     │
                              │    └────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   WY_DB Database  │
                    │                   │
                    │ ├─ civic_items    │
                    │ ├─ civic_item_    │
                    │ │  verification   │
                    │ ├─ bill_sponsors  │
                    │ └─ wy_legislators │
                    └───────────────────┘
```

---

## The Three Missing Pieces

### 1️⃣ RUN AI SUMMARY BATCH
**Purpose:** Fill ai_summary and ai_key_points for 7 bills missing them

**Current State:**
- ✅ Single bill endpoint exists: `/api/internal/civic/test-bill-summary?bill_id=X&save=true`
- ❌ No batch wrapper exists
- ❌ No scheduled task exists

**Where to Add:**
```
worker/src/routes/civicScan.mjs
  ├─ handleTestBillSummary()  ← Already handles single bill
  └─ NEW: handleBatchBillSummary()  ← Wrap single endpoint for batch
        └─ Call test-bill-summary for each pending bill

worker/src/index.mjs
  └─ NEW ROUTE: router.post("/api/internal/civic/batch-summaries", ...)
        └─ Calls handleBatchBillSummary()
```

**How It Works:**
```
POST /api/internal/civic/batch-summaries
├─ Query civic_items WHERE source='open_states' AND ai_summary IS NULL
├─ For each bill:
│  ├─ Call handleTestBillSummary(bill_id)
│  ├─ Wait for response (cached if already computed)
│  └─ Update civic_items.ai_summary
└─ Return { processed: 7, updated: 7, errors: 0 }
```

**Implementation Location:**
```
worker/src/lib/civicScan.mjs  (or new file)
  └─ export async function batchGenerateSummaries(db, limit = 100)
        ├─ Query all bills needing summaries
        ├─ For each bill, call existing test-bill-summary logic
        └─ Bulk update ai_summary field
```

---

### 2️⃣ RUN VERIFICATION BATCH
**Purpose:** Fill civic_item_verification table with status (ok/flagged) for all 10 bills

**Current State:**
- ✅ Single bill verification endpoint exists: `/api/internal/civic/verify-bill?id=X`
- ✅ Verification table schema exists (civic_item_verification)
- ❌ No batch wrapper exists
- ❌ No scheduled task exists

**Where to Add:**
```
worker/src/routes/internalVerifyBill.mjs
  ├─ handleInternalVerifyBill()  ← Already handles single bill
  └─ NEW: handleBatchVerifyBills()  ← Wrap single endpoint for batch
        └─ Call verify-bill for each pending bill

worker/src/index.mjs
  └─ NEW ROUTE: router.post("/api/internal/civic/batch-verify", ...)
        └─ Calls handleBatchVerifyBills()
```

**How It Works:**
```
POST /api/internal/civic/batch-verify
├─ Query civic_items WHERE source='open_states'
├─ For each bill:
│  ├─ Call handleInternalVerifyBill(bill_id)
│  ├─ Get response { status: 'ok'|'flagged', confidence: N }
│  └─ INSERT INTO civic_item_verification
│     (civic_item_id, status, confidence, ...)
└─ Return { processed: 10, ok: 5, flagged: 5, errors: 0 }
```

**Implementation Location:**
```
worker/src/lib/civicVerification.mjs  (or enhance existing)
  └─ export async function batchVerifyBills(db, limit = 100)
        ├─ Query all bills needing verification
        ├─ For each bill, call existing verification logic
        ├─ INSERT results into civic_item_verification
        └─ Track ok/flagged counts
```

---

### 3️⃣ PLAN SPONSOR INGESTION
**Purpose:** Populate bill_sponsors table with legislator sponsor data

**Current State:**
- ✅ bill_sponsors table exists (empty, 0 rows)
- ✅ wy_legislators table exists (populated with WY legislators)
- ✅ Foreign key relationship ready
- ❌ No ingestion logic exists
- ❌ No OpenStates sponsors endpoint integration

**Where to Add (Research Phase):**
```
NEW FILE: worker/src/lib/openStatesSponsors.mjs
  └─ export async function syncBillSponsors(env, db, billIds)
        ├─ Query OpenStates sponsors endpoint for each bill
        │  (OpenStates v3: /bills/{bill_id}/sponsorships)
        ├─ Map OpenStates legislator names to wy_legislators.id
        ├─ INSERT into bill_sponsors
        └─ Handle name matching / fuzzy match

NEW FILE: worker/src/routes/sponsorSync.mjs
  └─ export async function handleBatchSyncSponsors(req, env)
        ├─ Accept: bill_ids (or auto-fetch all OpenStates bills)
        ├─ Call syncBillSponsors()
        └─ Return { synced: N, matched: N, unmatched: N }

worker/src/index.mjs
  └─ NEW ROUTE: router.post("/api/dev/sponsors/sync", ...)
        └─ Calls handleBatchSyncSponsors()
```

**How It Works:**
```
POST /api/dev/sponsors/sync
├─ For each bill in civic_items (source='open_states'):
│  ├─ Query OpenStates sponsors endpoint
│  ├─ For each sponsor:
│  │  ├─ Find matching wy_legislator by name (fuzzy match)
│  │  ├─ If found: INSERT bill_sponsors
│  │  └─ If not found: Log unmatched sponsor
│  └─ Update civic_items.last_sponsor_sync
└─ Return { bills_synced: 10, sponsors_added: 25, unmatched: 3 }
```

**Data Flow:**
```
OpenStates API
  │ (GET /bills/{bill_id}/sponsorships)
  │
  ├─ Get sponsor name: "Jane Smith"
  │
  └─ Match to wy_legislators
     ├─ Try exact match on name
     ├─ If not found: Try fuzzy match (levenshtein distance)
     ├─ If matched: Get legislator.id
     │
     └─ INSERT bill_sponsors
        (bill_id, legislator_id, role='primary'|'cosponsor')
```

**Implementation Details Needed:**
- OpenStates v3 sponsor endpoint URL format
- Name matching strategy (exact vs fuzzy)
- Role classification (primary sponsor vs cosponsor)
- Error handling for name mismatches
- Rate limiting for OpenStates API

---

## Integration Points in Existing Code

### File 1: worker/src/routes/civicScan.mjs
**Current:** Handles single bill summary generation
```javascript
export async function handleTestBillSummary(req, env) {
  // ✅ Existing: GET bill_id from query params
  // ✅ Existing: Call OpenAI for summary
  // ✅ Existing: Save to ai_summary column
}
```

**Add Here:**
```javascript
export async function handleBatchBillSummary(req, env) {
  // ❌ NEW: Handle batch processing
  // ❌ NEW: Loop over bills WHERE ai_summary IS NULL
  // ❌ NEW: Call handleTestBillSummary for each
}
```

---

### File 2: worker/src/routes/internalVerifyBill.mjs
**Current:** Handles single bill verification
```javascript
export async function handleInternalVerifyBill(req, env) {
  // ✅ Existing: GET bill_id from query params
  // ✅ Existing: Call gpt-4o-mini for verification
  // ✅ Existing: Return { status, confidence, issues }
}
```

**Add Here:**
```javascript
export async function handleBatchVerifyBills(req, env) {
  // ❌ NEW: Handle batch processing
  // ❌ NEW: Loop over bills needing verification
  // ❌ NEW: Call handleInternalVerifyBill for each
  // ❌ NEW: INSERT results into civic_item_verification
}
```

---

### File 3: worker/src/lib/openStatesSync.mjs
**Current:** Handles ingestion from OpenStates v3 bills endpoint
```javascript
export async function syncWyomingBills(env, db, { session, limit = 20 }) {
  // ✅ Existing: Query OpenStates /bills endpoint
  // ✅ Existing: INSERT into civic_items
  // ✅ Existing: Jurisdiction validation
  // ✅ Existing: Chamber detection
}
```

**Add New File:**
```javascript
// NEW: worker/src/lib/openStatesSponsors.mjs
export async function syncBillSponsors(env, db, billIds) {
  // ❌ NEW: Query OpenStates /bills/{id}/sponsorships endpoint
  // ❌ NEW: Name matching to wy_legislators
  // ❌ NEW: INSERT into bill_sponsors
}
```

---

### File 4: worker/src/index.mjs
**Current Routes:**
```javascript
router.get("/api/dev/openstates/sync", ...);              // ✅ Ingestion
router.post("/api/internal/civic/test-bill-summary", ...); // ✅ Single summary
router.post("/api/internal/civic/scan-pending-bills", ...); // ✅ Topic scan
router.get("/api/internal/civic/verify-bill", ...);       // ✅ Single verify
```

**Add Routes:**
```javascript
// ❌ NEW: Batch summaries
router.post("/api/internal/civic/batch-summaries", handleBatchBillSummary);

// ❌ NEW: Batch verification
router.post("/api/internal/civic/batch-verify-bills", handleBatchVerifyBills);

// ❌ NEW: Sponsor ingestion
router.post("/api/dev/sponsors/sync", handleBatchSyncSponsors);
```

---

## Recommended Implementation Order

### Phase 1: Batch Summary (30 min)
1. **Create:** `worker/src/lib/civicScan.mjs` → `batchGenerateSummaries(db)`
2. **Route:** Add POST `/api/internal/civic/batch-summaries`
3. **Test:** Call endpoint to fill 7 missing summaries
4. **Verify:** Query and confirm ai_summary now populated

### Phase 2: Batch Verification (20 min)
1. **Create:** `worker/src/lib/civicVerification.mjs` → `batchVerifyBills(db)`
2. **Route:** Add POST `/api/internal/civic/batch-verify-bills`
3. **Test:** Call endpoint to create 10 verification records
4. **Verify:** Query civic_item_verification table (expect 10 rows)

### Phase 3: Sponsor Ingestion (Research + 1 hour)
1. **Research:** OpenStates v3 sponsorships endpoint
2. **Create:** `worker/src/lib/openStatesSponsors.mjs` → `syncBillSponsors()`
3. **Plan:** Name matching strategy (exact vs fuzzy)
4. **Route:** Add POST `/api/dev/sponsors/sync`
5. **Test:** Dry-run on 1-2 bills first
6. **Implement:** Full sync once pattern verified

---

## Query Templates for Validation

After each implementation, use these queries to verify success:

**Post-Summary:**
```sql
SELECT COUNT(*) FROM civic_items 
WHERE source='open_states' AND ai_summary IS NOT NULL;
-- Expected: 10
```

**Post-Verification:**
```sql
SELECT status, COUNT(*) FROM civic_item_verification 
WHERE civic_item_id IN (SELECT id FROM civic_items WHERE source='open_states')
GROUP BY status;
-- Expected: ok=5, flagged=5 (or similar split)
```

**Post-Sponsors:**
```sql
SELECT COUNT(DISTINCT civic_item_id) FROM bill_sponsors 
WHERE civic_item_id IN (SELECT id FROM civic_items WHERE source='open_states');
-- Expected: 10 (all bills should have sponsors)
```

---

## Summary: Where Everything Goes

| Task | New File | Route | Trigger |
|------|----------|-------|---------|
| **Summary Batch** | Enhance civicScan.mjs | POST /api/internal/civic/batch-summaries | Manual or scheduled |
| **Verify Batch** | Enhance civicVerification.mjs | POST /api/internal/civic/batch-verify-bills | Manual or scheduled |
| **Sponsor Sync** | NEW openStatesSponsors.mjs | POST /api/dev/sponsors/sync | Manual or scheduled |

All three integrate into the existing D1 database and follow the same patterns as current single-bill endpoints.
