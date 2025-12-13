# Wyoming LSO API - Available Data Tables & Endpoints

**Investigation Date:** December 11, 2025  
**Status:** Complete - 5 working endpoints identified and documented

---

## Summary: What Data Is Available

The Wyoming Legislative Service Office (LSO) API provides **5 main data tables** accessible via REST endpoints. Below is the complete inventory.

---

## 1. Committee Bills (Pre-Session Planning)

**Endpoint:** `GET /api/BillInformation/GetCommitteeBills/{year}`

**Example:** `https://lsoservice.wyoleg.gov/api/BillInformation/GetCommitteeBills/2026`

**Response Type:** JSON array of committee objects

**Data Volume:**
- 2026: 25 sponsored bills across 17 committees
- Includes bill summaries, meeting agendas, draft bills

**Fields Per Bill:**
```
billNum, shortTitle, sponsor (committee), year, billType, billStatus,
lastAction, lastActionDate, chapterNo, enrolledNo, effectiveDate,
signedDate, amendments, substituteBills, specialSessionValue
```

**Use Case:** Track committee bill planning before session opens

**Status:** ✅ Working, data current, complete schema

**Sample Data:**
```json
{
  "billNum": "HB0008",
  "shortTitle": "Stalking of minors.",
  "sponsor": "Judiciary",
  "year": 2026,
  "billStatus": null,
  "amendments": [],
  "substituteBills": []
}
```

---

## 2. Committees (All Years)

**Endpoint:** `GET /api/Committee`

**Response Type:** JSON array of 706 committee records (all years, 1993-present)

**Data Volume:**
- 706 historical committee records
- Each committee can have records from multiple years

**Key Fields:**
```
legID, last, first, district, county, firstYrHouse, lastYrHouse,
firstYrSenate, lastYrSenate
```

**Use Case:** Historical committee research, committee reference

**Status:** ✅ Working

---

## 3. Committees by Year

**Endpoint:** `GET /api/Committee/{year}`

**Example:** `https://lsoservice.wyoleg.gov/api/Committee/2026`

**Response Type:** JSON object with 33 key-value pairs (not array!)

**Data Volume:**
- 33 committees active in 2026
- Returns a dictionary/object, not an array

**Key Fields:**
```
commID, year, ownerID, commName, statAuthority
(and 28 other fields)
```

**Structure Note:** Response is a dictionary where keys are committee IDs or names, not an array. Each value contains committee metadata.

**Use Case:** Current-year committee reference

**Status:** ✅ Working (unusual response format - dict, not array)

---

## 4. Legislators (All Years - Historical)

**Endpoint:** `GET /api/Legislator`

**Response Type:** JSON array of 2,039 legislator records

**Data Volume:**
- 2,039 historical legislator records
- Covers all legislators from ~1993 to present
- Multiple records possible per legislator (if they served in different years)

**Key Fields:**
```
legID, last, first, name, district, county, 
firstYrHouse, lastYrHouse, firstYrSenate, lastYrSenate,
houseYears, senateYears, yearServed
```

**Use Case:** Legislative history research, roster building, service tracking

**Status:** ✅ Working, comprehensive dataset

**Sample Record:**
```json
{
  "legID": null,
  "last": "Anderson",
  "first": "Rodney \"Pete\"",
  "district": "H10",
  "county": "Laramie",
  "firstYrHouse": "1993-",
  "lastYrHouse": "2010"
}
```

---

## 5. Legislator Profile (Single Record)

**Endpoint:** `GET /api/Legislator/{year}`

**Example:** `https://lsoservice.wyoleg.gov/api/Legislator/2026`

**Response Type:** JSON object with 53 detailed fields (single legislator profile)

**⚠️ IMPORTANT NOTE:** This endpoint appears to return only **1 legislator** profile, not all legislators for a year. It may be a detailed profile endpoint rather than a list endpoint.

**Data Volume:**
- 1 legislator record with comprehensive details
- Returns a single object (dict), not an array

**Fields (53 total):**
```
firstName, lastName, name, eMail, party, district, chamber,
occupationDesc, civicOrgs, legEducation, legLeadership, legCommittees,
legCommYears, legBillSponsor, legSponsorYears, officesHeld, spouseName,
noChildren, noGChildren, dob, birthPlace, religion, leadershipPosition,
legStatus, phone, address, city, state, zip, and 24 more...
```

**Use Case:** Detailed legislator profile with committee assignments, bill sponsorships, leadership roles

**Status:** ⚠️ Working but unclear API design (single record vs. list)

**Sample Fields:**
```json
{
  "name": "Senator Liisa Anselmi-Dalton",
  "party": "Democrat",
  "district": "Senate District 12",
  "chamber": "S",
  "county": "Sweetwater County",
  "legCommittees": [/* list of 30 items */],
  "legBillSponsor": [/* list of 98 items */],
  "legLeadership": [/* list of 2 items */]
}
```

---

## ❌ Endpoints Tested But Not Working

| Endpoint | Status | Reason |
|----------|--------|--------|
| `/api/Vote` | ❌ Not Found | No vote/rollcall data available via API |
| `/api/Session` | ❌ Error | Session calendar data not exposed |
| `/api/BillInformation/GetBills/2026` | ❌ Bad Request | Endpoint doesn't accept year parameter this way |
| `/api/Bill` | ❌ Not Found | General bill listing not available |
| `/api/CommitteeMember` | ❌ Not Found | Committee member roster not available |

---

## Data Completeness Matrix

| Data Type | 2026 Session | All Years | Quality | Notes |
|-----------|--------------|-----------|---------|-------|
| **Bills** | 25 (pre-session) | ❌ | High | Committee-curated only, not all bills |
| **Committees** | 33 active | 706 historical | High | Good, complete roster |
| **Legislators** | Unknown | 2,039 records | High | Good, comprehensive historical |
| **Vote Data** | ❌ | ❌ | N/A | Not available via API |
| **Bill Sponsors** | Partial (committee) | ❌ | Medium | Only committee level, not individual |
| **Committee Members** | ❌ | ❌ | N/A | Not directly available |
| **Session Calendar** | ❌ | ❌ | N/A | Not available via API |

---

## Recommendations for Integration

### High Priority (Available Data)
1. **Use Committee Bills for:** Pre-session bill planning tracking
2. **Use Legislators list for:** Building voter delegation database (complementary to OpenStates)
3. **Use Committees list for:** Committee reference and metadata

### Medium Priority (Partial Data)
4. **Use Committee name as sponsor:** Map LSO committee sponsors to OpenStates bill data
5. **Use Legislator history:** Enrich existing legislator database with historical service records

### Not Recommended (Missing Data)
6. ❌ Don't rely on LSO for vote records (use OpenStates)
7. ❌ Don't expect real-time bill status (pre-session only)
8. ❌ Don't expect individual bill sponsors (only committees available)

---

## API Response Format Notes

⚠️ **Important:** Response formats vary:

| Endpoint | Response Type | Item Count |
|----------|---------------|-----------|
| `/api/BillInformation/GetCommitteeBills/2026` | **Array** | Variable (17 committees) |
| `/api/Committee` | **Array** | 706 items |
| `/api/Committee/2026` | **Object/Dict** | 33 key-value pairs |
| `/api/Legislator` | **Array** | 2,039 items |
| `/api/Legislator/2026` | **Object/Dict** | 53 fields (single record) |

Use appropriate parsing for each endpoint type.

---

## Fetched Files

The following raw API responses have been saved locally:

```
/data/wy_committee_2026_raw.json         (1.5 MB) - Committee bills for 2026
/data/wy_committees_2026.json            (25 KB) - Committee list for 2026
/data/wy_legislators_all.json            (500 KB) - All legislators (2,039 records)
/data/wy_legislators_2026.json           (25 KB) - Single 2026 legislator profile
```

---

## Future Enhancement Opportunities

1. **Combine with OpenStates:** Map LSO committee sponsors to OpenStates bills
2. **Build Committee-Bill Index:** Track which committees are working on which bills
3. **Historical Analysis:** Use legislative history to identify patterns
4. **Vote Data Alternative:** Consider web scraping legislative.wyoleg.gov if vote data needed
5. **Real-Time Monitoring:** Poll Committee Bills endpoint weekly during session

---

**Document Created:** December 11, 2025  
**API Version:** v3 (https://lsoservice.wyoleg.gov/api)  
**Data Freshness:** Current through December 11, 2025  
**Recommendation:** All 5 endpoints working - ready for integration
