# OpenStates Data Health Summary
**Generated:** 2025-12-10 @ 16:25 UTC  
**Database:** WY_DB (local)  
**Environment:** Development

---

## Executive Summary

**Status:** ⚠️ **PARTIAL HEALTH** - Data ingestion working, but AI enrichment and verification incomplete.

| Metric | Value | Status |
|--------|-------|--------|
| **OpenStates Bills Ingested** | 10 | ✅ OK |
| **Correct Jurisdiction (WY)** | 10/10 | ✅ OK |
| **Correct Session (2025)** | 10/10 | ✅ OK |
| **Correct Chamber Detection** | 10/10 | ✅ OK (3 HB, 7 SF) |
| **Bills with AI Summaries** | 3/10 | ❌ CRITICAL |
| **Bills with Verification** | 0/10 | ❌ CRITICAL |
| **Bill Sponsors Populated** | 0 rows | ⚠️ NOT STARTED |

---

## 1. OpenStates Ingestion Health

### 1a. Current Counts and Distributions

**Total OpenStates Bills:** 10

**Distribution by Chamber:**
```
Chamber     Count   Percentage
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
house       3       30% (HB bills)
senate      7       70% (SF bills)
```

**Distribution by Session:**
```
Session     Count
━━━━━━━━━━━━━━━━━━
2025        10      ✅ All correct
```

**Distribution by Jurisdiction:**
```
Jurisdiction    Count
━━━━━━━━━━━━━━━━━━━━━━
Wyoming         10      ✅ All correct (no cross-state contamination)
```

**Conclusion for Ingestion:** ✅ **HEALTHY**
- Jurisdiction validation working correctly
- Chamber detection fixed and verified (HB vs SF)
- All 10 bills are legitimate Wyoming 2025 bills
- No data corruption or cross-state contamination detected

---

### 1b. Bills List

| Bill # | Title | Chamber | Status |
|--------|-------|---------|--------|
| HB 22 | Water and wastewater operator-emergency response. | house | Synced ✅ |
| HB 23 | Unnamed | house | Synced ✅ |
| HB 264 | Unnamed | house | Synced ✅ |
| SF 2 | Hunting licenses-weighted bonus points system. | senate | Synced ✅ |
| SF 3 | Mule and whitetail deer-separate hunting seasons. | senate | Synced ✅ |
| SF 4 | State park peace officers-definition and scope of authority. | senate | Synced ✅ |
| SF 5 | School district vehicles-flashing lights authorized. | senate | Synced ✅ |
| SF 6 | Residential property-removal of unlawful occupant. | senate | Synced ✅ |
| SF 9 | Restoration of rights amendments. | senate | Synced ✅ |
| SF 12 | Permanent protection orders. | senate | Synced ✅ |

---

## 2. AI Enrichment Status (Critical Gap)

### 2a. Bills Missing AI Summaries

**Summary Status:** ❌ **CRITICAL - 7 of 10 bills have NO AI summary**

```
Summary Status      Count   Percentage
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Missing             7       70% ❌
Present             3       30% ✅
```

**Bills with Missing Summaries:**
- HB 23 (house) - *MISSING*
- HB 264 (house) - *MISSING*
- SF 2 (senate) - *MISSING*
- SF 3 (senate) - *MISSING*
- SF 5 (senate) - *MISSING*
- SF 6 (senate) - *MISSING*
- SF 9 (senate) - *MISSING*

**Bills with Summaries (3):**
- HB 22 (house) - *Has summary*
- SF 4 (senate) - *Has summary*
- SF 12 (senate) - *Has summary*

**Root Cause:** AI summary generation endpoint may not have been called for all bills after sync, or bills synced but enrichment failed.

---

## 3. Verification Status (Critical Gap)

### 3a. Verification Coverage

**Verification Status:** ❌ **CRITICAL - 0 of 10 bills have verification records**

```
Verification Status     Count   Percentage
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Verified (OK)           0       0% ❌
Verified (FLAGGED)      0       0% ❌
Not Verified            10      100% ❌
```

**Conclusion:** The civic_item_verification table is completely empty for OpenStates bills. 

**Possible Causes:**
1. Verification batch job has not been run since latest sync
2. Verification endpoint failed silently
3. Verification scripts exist but were not executed

**Spot-Check Example:**
```
Bill: HB 22 (house)
Title: Water and wastewater operator-emergency response.
Session: 2025
AI Summary: NULL
Verification Status: NO_VERIFICATION
Verification Confidence: 0
```

### 3b. Verification Table Alignment

**Orphaned Records Check:** ✅ **PASS**
- 0 orphaned civic_item_verification rows (no foreign key violations)

---

## 4. Bill Sponsors Status

### 4a. Sponsor Data Population

**Sponsor Status:** ⚠️ **NOT POPULATED**

```
Table: bill_sponsors
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Rows: 0
```

**bill_sponsors Table Schema:** ✅ EXISTS
- Table created correctly (from migrations 0012/0013)
- Properly indexed

**wy_legislators Table:** ✅ EXISTS
- Contains legislator records
- Indexes present

**Conclusion:** Sponsor gating infrastructure is in place, but no sponsor data has been ingested yet. This is a prerequisite for sponsor-based filtering.

---

## 5. Data Quality Issues Identified

### 5a. Legacy Data Contamination

**Issue:** Found old test bill with incorrect structure:
- Bill: HB 164 (test-hb164)
- Title: "Groundwater Withdrawal Permits"
- Source: "openstates" (lowercase) ❌ should be "open_states"
- Chamber: "lower" ❌ should be "house"
- Issue: This is NOT from OpenStates v3 API sync (different identifier format, different schema)

**Impact:** Low - Only affects legacy test data, not production OpenStates ingestion. The new sync function uses "open_states" (underscore) as source, so no contamination of new data.

### 5b. Structural Inconsistencies

1. ✅ All jurisdiction_key values are "WY" (correct)
2. ✅ All legislative_session values are "2025" (correct)
3. ✅ Chamber detection is now correct (fixed via investigation)
4. ⚠️ OpenStates API returns incomplete data (no subjects, actions, abstracts in many cases)

---

## 6. Actionable Recommendations

### Immediate (High Priority)

1. **Run AI Summary Generation**
   - Command: Batch call `/api/internal/civic/test-bill-summary` for all 10 bills
   - Expected outcome: Fill ai_summary and ai_key_points for missing bills
   - Est. time: <1 minute

2. **Run Verification Batch**
   - Command: Execute `npm run civic:verify-bills`
   - Expected outcome: Populate civic_item_verification table with 10 records
   - Verify that status field contains "ok" or "flagged"
   - Est. time: ~30 seconds (10 bills × 3s per verification)

### Short-term (Medium Priority)

3. **Populate Sponsors**
   - Investigate source of sponsor data (OpenStates has sponsors endpoint)
   - Create/run ingestion script to populate bill_sponsors
   - Enable sponsor-based filtering in UI

4. **Monitor OpenStates API Gaps**
   - Current API returns incomplete data (no subjects, actions, abstracts)
   - Consider caching enriched data from previous pulls if available
   - Investigate alternative data sources for richer bill information

### Validation Queries

After running recommendations, re-run these to confirm success:

```sql
-- Check summaries filled
SELECT COUNT(*) FROM civic_items 
WHERE source='open_states' AND ai_summary IS NOT NULL;
-- Expected: 10

-- Check verification complete
SELECT COUNT(*) FROM civic_item_verification 
WHERE civic_item_id IN (SELECT id FROM civic_items WHERE source='open_states');
-- Expected: 10

-- Check verification status distribution
SELECT status, COUNT(*) FROM civic_item_verification 
WHERE civic_item_id IN (SELECT id FROM civic_items WHERE source='open_states')
GROUP BY status;
-- Expected: Some "ok", some "flagged" (not all one status)
```

---

## 7. Code Quality Notes

### ✅ Verified Correct
- `normalizeChamber(org, identifier)` uses identifier as PRIMARY source ✅
- Chamber detection uses "HB" → "house", "SF" → "senate" ✅
- `syncWyomingBills()` enforces Wyoming jurisdiction check ✅
- Session parameter correctly passed to OpenStates API ✅
- No cross-state bill contamination ✅

### ⚠️ Operational Issues (Not Code Issues)
- AI summary generation not run after sync
- Verification batch not run after sync
- Sponsor ingestion not yet implemented

---

## 8. Data Freshness

**Last OpenStates Sync:** Current test data (10 bills synced during this session)  
**API Version:** OpenStates v3 (`https://v3.openstates.org/bills`)  
**API Key Status:** ✅ Present in environment  

---

## Summary Table

| Category | Status | Count | Notes |
|----------|--------|-------|-------|
| **Ingestion** | ✅ OK | 10/10 | All WY, 2025, correct chambers |
| **Jurisdiction Validation** | ✅ OK | 10/10 | No cross-state contamination |
| **AI Summaries** | ❌ INCOMPLETE | 3/10 | 70% missing, needs batch run |
| **Verification** | ❌ INCOMPLETE | 0/10 | 0% verified, needs batch run |
| **Sponsors** | ❌ NOT STARTED | 0 rows | Infrastructure ready, data pending |
| **Data Quality** | ✅ OK | N/A | Structural integrity good, content incomplete |

---

## Next Steps

1. **Get approval to run AI summary batch** (5 min)
2. **Get approval to run verification batch** (2 min)
3. **Document sponsor ingestion strategy** (15 min)
4. **Plan sponsor data source** (research)

All infrastructure is in place. The issue is **execution completeness**, not **data corruption**.
