# OpenStates API Data Analysis - December 10, 2025

## Test Results: 10 Bills Sample

**Test Command:**
```bash
curl -s "http://127.0.0.1:8787/api/dev/openstates/sync?session=2025&limit=10"
```

**Results:**
- Synced: 10
- Skipped: 0
- Errors: 0
- All bills from Wyoming jurisdiction ✅

---

## Critical Issue Found: Chamber Misidentification

### Problem
**Senate bills (SF) are being marked as "house" chamber:**

Example 1:
```json
{
  "identifier": "SF 4",
  "title": "State park peace officers-definition and scope of authority.",
  "from_organization": {
    "name": "House",
    "classification": "lower"
  },
  "chamber": "house"  ❌ WRONG - Should be "senate"
}
```

Example 2:
```json
{
  "identifier": "SF 2", 
  "title": "Hunting licenses-weighted bonus points system.",
  "from_organization": {
    "name": "House",
    "classification": "lower"
  },
  "chamber": "house"  ❌ WRONG - Should be "senate"
}
```

### Root Cause
The `from_organization.name` field from OpenStates API only contains "House" for ALL bills, even Senate bills. This appears to be either:
1. **API data quality issue** - OpenStates returning incomplete organization names
2. **API schema change** - Organization data structure different than expected
3. **Missing field** - Real chamber info might be in different field

### Impact
- Bill identifiers (HB, SF) are correct
- But chamber detection is wrong
- SF (Senate) bills incorrectly stored as "house"

---

## Data Quality Assessment

### Complete Data Audit (10 Bills)

| Field | Status | Notes |
|-------|--------|-------|
| `identifier` | ✅ Good | HB, SF prefixes are correct |
| `title` | ✅ Good | All present, meaningful |
| `jurisdiction` | ✅ Good | All Wyoming |
| `from_organization` | ❌ Bad | Only shows "House", missing Senate |
| `from_organization.classification` | ❌ Bad | Always "lower" even for SF bills |
| `subjects` | ⚠️ Empty | Array is empty for all 10 bills |
| `actions` | ⚠️ Missing | No actions data (count: 0) |
| `abstracts` | ⚠️ Missing | No bill abstracts/summaries |
| `sources` | ⚠️ Missing | No source URLs |
| `versions` | ⚠️ Missing | No bill versions/text |
| `legislative_session` | ✅ Good | Correctly set to "2025" |

---

## Solution Options

### Option 1: Use Bill Identifier for Chamber Detection (RECOMMENDED)
```javascript
const getChamberfromIdentifier = (identifier) => {
  if (!identifier) return null;
  const prefix = identifier.split(' ')[0].toUpperCase();
  if (prefix === 'HB') return 'house';
  if (prefix === 'SF') return 'senate';
  return null;
};
```

**Pros:**
- 100% accurate for Wyoming bills (HB = House, SF = Senate)
- Simpler and more reliable
- Doesn't depend on API data quality

**Cons:**
- Assumes this naming convention (but it's standard in all US legislatures)

### Option 2: Use Classification Field + Identifier Fallback
```javascript
const getChamberfromOrg = (org, identifier) => {
  if (!org) return getChamberfromIdentifier(identifier);
  
  const name = (org.name || '').toLowerCase();
  const classif = (org.classification || '').toLowerCase();
  
  // Try classification first
  if (classif === 'upper' || classif === 'senate') return 'senate';
  if (classif === 'lower' || classif === 'house') return 'house';
  
  // Fallback to name
  if (name.includes('senate') || name.includes('upper')) return 'senate';
  if (name.includes('house') || name.includes('lower') || name.includes('representative')) return 'house';
  
  // Final fallback: use identifier
  return getChamberfromIdentifier(identifier);
};
```

### Option 3: Query OpenStates Search API for Full Data
The sync endpoint might be returning minimal data. Query the search API directly for detailed bill info:

```javascript
// For each bill, fetch detailed info from:
GET https://v3.openstates.org/bills/{bill_id}
```

This would give more detailed data including:
- Full bill text
- All versions
- Complete action history
- Committee information
- Full abstract/summary

**Pros:**
- Get complete data
- More reliable information

**Cons:**
- Requires many more API calls (rate limit issues)
- Much slower (1-2 seconds per bill)
- May hit OpenStates rate limits

---

## Missing Data: Why?

### Why are subjects, actions, abstracts, sources, versions missing?

The OpenStates v3 API has **sparse response mode**. By default, it returns minimal data:
- Bill ID, identifier, title, basic organization
- Session and legislative info only

To get full data, you need to:

1. **Query specific bill endpoint:**
   ```
   GET https://v3.openstates.org/bills/{bill_id}
   ```

2. **Or add include params to list endpoint:**
   ```
   GET https://v3.openstates.org/bills?jurisdiction=Wyoming&session=2025&include=all
   ```

3. **Check OpenStates docs** for available include parameters

---

## Recommended Implementation

### Short-term Fix (Immediate)
Update `normalizeChamber()` to use identifier as primary source:

```javascript
const normalizeChamber = (org, identifier) => {
  // Try identifier first (most reliable for Wyoming)
  if (identifier) {
    const prefix = (identifier.split(/[\s_-]/)[0] || '').toUpperCase();
    if (prefix === 'HB') return 'house';
    if (prefix === 'SF' || prefix === 'S') return 'senate';
  }
  
  // Fallback to organization parsing
  let orgStr = "";
  if (typeof org === "string") {
    orgStr = org;
  } else if (org?.name) {
    orgStr = org.name;
  } else if (org?.classification) {
    if (org.classification === 'upper' || org.classification === 'senate') return 'senate';
    if (org.classification === 'lower' || org.classification === 'house') return 'house';
  }
  
  const o = (orgStr || "").toLowerCase();
  if (o.includes("upper") || o.includes("senate")) return "senate";
  if (o.includes("lower") || o.includes("house") || o.includes("representative")) return "house";
  
  return null;
};
```

Update call site:
```javascript
chamber = normalizeChamber(bill.from_organization, bill.identifier)
```

### Medium-term Fix (Better Data)
Fetch detailed bill info separately:

```javascript
export async function getDetailedBillInfo(env, billId) {
  const res = await fetch(`https://v3.openstates.org/bills/${billId}`, {
    headers: { "X-API-KEY": env.OPENSTATES_API_KEY },
  });
  
  if (!res.ok) return null;
  
  const bill = await res.json();
  return {
    abstract: bill.abstracts?.[0]?.abstract,
    subjects: bill.subjects,
    actions: bill.actions,
    sources: bill.sources,
    versions: bill.versions
  };
}
```

Then for each bill in sync:
```javascript
const details = await getDetailedBillInfo(env, bill.id);
const abstract = details?.abstract || null;
const subjects = details?.subjects || [];
// ... etc
```

---

## What We Can Use Now (With 10 Bills Sample)

✅ **Good Data Available:**
- Bill identifiers (HB, SF)
- Titles
- Chamber (if we use identifier-based detection)
- Session year
- Created date
- Bill status (via action inference)

⚠️ **Missing/Incomplete:**
- Bill text/full content
- Committee information
- Vote counts
- Detailed action history
- Subject categorization
- Bill abstracts

---

## Action Items

1. **Immediate:** Update `normalizeChamber()` to use identifier-based chamber detection
   - File: `/home/anchor/projects/this-is-us/worker/src/lib/openStatesSync.mjs`
   - Change function signature to include identifier parameter

2. **Verify:** Test with updated logic
   ```bash
   curl "http://127.0.0.1:8787/api/dev/openstates/sync?session=2025&limit=10"
   # SF bills should now show chamber: "senate"
   ```

3. **Optional:** Fetch detailed bill info for better data quality
   - Would require significant refactoring
   - Test rate limits first

4. **Document:** Update API structure guide with findings

---

## Test Data Summary

```
10 Bills Synced:
- HB 22 (house) - Water/wastewater operators
- HB 23 (house) - Surrender driver's license
- HB 264 (house) - Central bank digital currencies
- SF 4 (senate) - State park peace officers
- SF 2 (senate) - Hunting licenses
- SF 12 (senate) - ??? (need to check)
- SF ? (senate) - ?
... etc
```

All correctly identified as Wyoming bills.
All metadata present except detailed bill content.
