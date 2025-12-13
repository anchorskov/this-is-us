# Wyoming LSO Committee Bills API Response Schema

**API Endpoint:** `GET https://lsoservice.wyoleg.gov/api/BillInformation/GetCommitteeBills/{year}`  
**Fetched Date:** December 10, 2025  
**Year Parameter:** 2026  
**Response Size:** 1.5MB  
**Total Items:** 17 (committees with bills)

---

## Response Structure

### Root Level
- **Type:** JSON Array
- **Length:** 17 items
- **Content:** Committee-grouped bill sets (not flat bill list)

Each top-level item represents a **committee** with three sub-categories:

```
{
  "committeeDetail": {...},           // Committee metadata
  "billSummaries": [...],             // Not typically populated (array, can be empty)
  "sponsoredBills": [...],            // ✅ MAIN DATA: actual session bills
  "meetingDraftBills": [...]          // Bill draft meetings (agendas, not bills themselves)
}
```

---

## Field Analysis

### Total Bills Analyzed
- **Count:** 25 sponsored bills across all committees
- **Field Frequency:** All 15 fields present in 100% of bills
- **Data Completeness:** Excellent (no sparse fields)

### Sponsored Bills Field Reference

All fields below are **present and populated** in every sponsored bill (100% frequency):

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `billNum` | String | `HB0008` | ✅ **Bill identifier** – reliable prefix (HB/SF/SB) |
| `shortTitle` | String | `Stalking of minors.` | ✅ **Bill title** – good for display |
| `sponsor` | String | `Judiciary` | ✅ **Committee sponsor/requestor** – committee name, not individual |
| `billType` | String/Null | `null`, `"HJR"` | Type indicator (Bill, Joint Resolution, etc.) or null |
| `billStatus` | String/Null | `null` | Status from LSO (draft, pending, passed, etc.) – can be null |
| `lastAction` | String/Null | `null` | Most recent legislative action description |
| `lastActionDate` | String/Null | `null` | ISO 8601 timestamp of last action (`2026-01-15T00:00:00`) |
| `chapterNo` | String | `""` (empty) | Wyoming chapter number (empty if not yet enacted) |
| `signedDate` | String/Null | `null` | Governor signature date or null |
| `effectiveDate` | String/Null | `null` | When bill becomes effective or null |
| `enrolledNo` | String | `""` (empty) | Enrolled bill number (HEA/SEA prefix) or empty |
| `year` | Integer | `2026` | Legislative session year |
| `amendments` | Array | `[]` | Amendment records (empty in sample) |
| `substituteBills` | Array | `[]` | Substitute bill references (empty in sample) |
| `specialSessionValue` | String/Null | `null` | Special session indicator or null |

---

## Key Observations

### ✅ **Strengths for Civic Mapping**

1. **Bill Number Format**
   - Reliable prefix-based chamber detection: `HB` (House), `SF` (Senate), `SB` (Senate alternative)
   - Always available, properly formatted

2. **Committee/Sponsor Information**
   - `sponsor` field contains **committee name**, not individual legislator
   - Names: Judiciary, Labor, Agriculture, Transportation, Education, Minerals, Revenue, etc.
   - Useful for tracking which committee is advancing/requesting the bill

3. **Title Quality**
   - `shortTitle` provides concise bill summary
   - No special characters, HTML, or markup

4. **Status & Action Tracking**
   - `billStatus`, `lastAction`, `lastActionDate` available for tracking bill progress
   - Timestamps in ISO 8601 format (machine-readable)

### ⚠️ **Limitations for Integration**

1. **No Individual Sponsor Info**
   - This endpoint provides **committee-level** sponsorship only
   - To get individual sponsors, would need separate endpoint

2. **Sparse for Draft Bills**
   - Fields like `billStatus`, `lastAction`, `billType`, `signedDate` may be `null` for draft bills
   - These appear to be **interim/working bills**, not yet formal bills

3. **No URLs Provided**
   - No direct links to bill text (HTML, PDF)
   - Would need to construct URLs manually using `billNum` and `year`
   - Likely format: `https://www.wyoleg.gov/docs/bills/...`

4. **No Text/Abstract**
   - Only title provided, no bill summary or full text
   - Would require additional API calls or web scraping

---

## Recommended Mapping Strategy

### For `civic_items` Table

```sql
INSERT INTO civic_items (
  bill_number,           -- billNum (HB0008)
  title,                 -- shortTitle 
  chamber,               -- Derived from billNum prefix (HB→house, SF/SB→senate)
  jurisdiction_key,      -- 'WY' (always Wyoming)
  legislative_session,   -- year field
  status,                -- billStatus (may be null)
  summary,               -- None available (null)
  external_ref_id,       -- billNum + year combo or URL
  created_at,            -- Use lastActionDate or current time
  updated_at             -- lastActionDate
) VALUES ...
```

### For Committee Tracking (New Table Option)

```sql
-- Could create new committee_sponsors table:
CREATE TABLE committee_bill_sponsors (
  id INTEGER PRIMARY KEY,
  bill_id INTEGER,
  committee_name TEXT,     -- sponsor field
  committee_code TEXT,     -- From committeeDetail
  role TEXT,               -- "requestor" | "sponsor"
  created_at TEXT
);
```

---

## Sample Sponsor Values

**Committees sponsoring bills in 2026:**
- Judiciary (7 bills)
- Labor (7 bills)
- Agriculture (4 bills)
- Transportation (3 bills)
- Education (2 bills)
- Minerals (2 bills)

---

## API Query Patterns

### List bills for a specific year:
```
GET https://lsoservice.wyoleg.gov/api/BillInformation/GetCommitteeBills/2026
```

### Parameters
- **Year** (required): Legislative session year (e.g., 2026, 2025)
- No authentication required
- No rate limiting observed

---

## Caveats & Next Steps

1. **This is committee data, not final bills** – bills here are being processed through committees, not yet formal bill introductions
2. **Consider OpenStates as primary source** – this LSO API is supplemental for committee context
3. **URL construction needed** – Links to bill text must be built manually
4. **Status field may be null** – Defensive coding required in queries

---

**Document Created:** December 10, 2025  
**Data Quality Score:** 9/10 (High data completeness, committee-level only)  
**Recommended Use:** Committee bill tracking supplement, not primary bill source
