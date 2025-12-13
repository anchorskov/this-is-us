# Wyoming LSO API Field Explanation

## What Each Field Stores (With Real Examples)

### Legislative Session & Bill Identification

**`year: 2026`**
- The legislative session year
- Current data is for the 2026 Wyoming legislative session
- All 25 bills are pre-session/draft bills for the 2026 session

**`billNum: 'HB0008'`**
- Legislative identifier with chamber prefix
- `HB` = House Bill
- `0008` = Sequential number in that chamber
- These are **unique per chamber** (House bills 1-100+, Senate bills 1-50+)
- Formatted as `HB0008`, `SF0004`, `SB0001` (note SF vs SB = both Senate, different numbering systems)

---

### Bill Content & Description

**`shortTitle: 'Stalking of minors.'`**
- Official brief title/summary of the bill
- Written in plain English, not legislative language
- Single sentence ending with period
- This is the **human-readable description** (not the full bill text)
- Examples from data:
  - "Stalking of minors."
  - "Grooming of children-offenses and amendments."
  - "Sexually explicit materials in libraries-requirements."

---

### Bill Sponsorship (Committee-Level)

**`sponsor: 'Judiciary'`**
- The **committee** that is sponsoring/requesting the bill
- NOT an individual legislator's name
- Committee names in 2026 data:
  - Judiciary (7 bills)
  - Labor (7 bills)
  - Agriculture (4 bills)
  - Transportation (3 bills)
  - Education (2 bills)
  - Minerals (2 bills)
- Indicates which committee is advancing this bill through the process

---

### Bill Status & Legislative Progress

**`billStatus: None` (Currently NULL)**
- Current legislative status of the bill
- Would contain values like: "prefiled", "introduced", "in committee", "passed first reading", "enrolled", "signed", "vetoed"
- Currently `None` because these are **pre-session draft bills** (not yet officially introduced)
- Will populate once the 2026 session begins and bills move through the legislature

**`billType: None` (Currently NULL)**
- The type of legislation
- Would contain: "Bill", "Joint Resolution", "Memorial", "Concurrent Resolution"
- Currently `None` (draft status)
- Once introduced, this will show the formal bill type

**`lastAction: None` (Currently NULL)**
- Description of the most recent legislative action
- Would contain: "Introduced", "Passed House", "Referred to Senate Judiciary", "Signed by Governor"
- Currently `None` (no actions yet, still in pre-session committee work)

**`lastActionDate: None` (Currently NULL)**
- Timestamp of when the last action occurred
- Format: ISO 8601 (e.g., `"2026-02-15T14:30:00"`)
- Currently `None` (no legislative action yet)
- Will update as bill moves through committees and chambers

---

### Bill Passage & Enactment Tracking

**`chapterNo: ''` (Empty String)**
- Wyoming Statutes chapter number if the bill became law
- Empty string means: **bill hasn't passed into law yet** (or never passed)
- Example if passed: `"HB0008"` or a chapter number like `"2026-001"`
- Used to cite enacted legislation: "Wyoming Statute Chapter HB0008 (2026)"

**`enrolledNo: ''` (Empty String)**
- The "enrolled bill" number once a bill passes both chambers
- Empty string = bill hasn't passed both chambers yet
- Format examples: `"HEA0008"` (House Enrolled Act), `"SEA0004"` (Senate Enrolled Act)
- The "enrolled" version is the final passed bill before going to Governor

**`signedDate: None` (Currently NULL)**
- Date the Governor signed the bill into law
- Would be ISO 8601 timestamp: `"2026-04-15T10:00:00"`
- Currently `None` = not yet signed (or never passed to Governor)

**`effectiveDate: None` (Currently NULL)**
- Date the law becomes effective
- Would be ISO 8601 timestamp: `"2026-07-01T00:00:00"`
- Can be different from signed date (e.g., "signed in March, effective July 1")
- Currently `None` = law not enacted yet

---

### Related Legislation

**`amendments: []` (Empty Array)**
- List of amendments proposed to this bill
- Array structure: `[{amendment_id, description, sponsor, ...}, ...]`
- Currently empty: **no amendments filed yet** (pre-session)
- Once filed: will contain amendment objects with details

**`substituteBills: []` (Empty Array)**
- List of alternate versions or substitute bills
- Would contain references to alternative bill numbers if committees drafted substitutes
- Empty array: **no substitutes drafted yet** (pre-session status)
- Example use: Bill HB0008 gets a full rewrite → substitute becomes HB0008S (or new bill number)

---

### Special Circumstances

**`specialSessionValue: None` (Currently NULL)**
- Indicator if bill is from a special/extraordinary legislative session
- Regular sessions = `None`
- Special sessions (called by Governor for emergency/specific purpose) = special session identifier
- Wyoming occasionally has special sessions outside the regular 40-day session

---

## What This Data Tells Us (Legislative Lifecycle)

### Current Status: PRE-SESSION COMMITTEE WORK
These 25 bills are being prepared by committees **before the 2026 session opens**. This is why:

| Field | Current Value | Reason |
|-------|---------------|--------|
| billStatus | `None` | Bills not yet "officially" introduced |
| billType | `None` | Type not finalized |
| lastAction | `None` | No votes or actions yet |
| lastActionDate | `None` | No official actions recorded |
| chapterNo | `''` (empty) | Not yet law |
| enrolledNo | `''` (empty) | Not yet passed both chambers |
| signedDate | `None` | Not signed yet |
| effectiveDate | `None` | No enactment date |
| amendments | `[]` (empty) | No amendments proposed yet |
| substituteBills | `[]` (empty) | No substitutes drafted yet |

### What IS Available Now (Always Populated)
- ✅ `billNum` – identifies which bill
- ✅ `shortTitle` – what the bill is about
- ✅ `sponsor` – which committee is sponsoring it
- ✅ `year` – what session (2026)

---

## Timeline Example: How Fields Change Over Time

### DECEMBER 2025 (Right Now - Pre-Session)
```json
{
  "billNum": "HB0008",
  "shortTitle": "Stalking of minors.",
  "sponsor": "Judiciary",
  "year": 2026,
  "billStatus": null,
  "lastAction": null,
  "chapterNo": "",
  "signedDate": null,
  "effectiveDate": null
}
```

### JANUARY 2026 (Session Starts - Bill Introduced)
```json
{
  "billNum": "HB0008",
  "shortTitle": "Stalking of minors.",
  "sponsor": "Judiciary",
  "year": 2026,
  "billStatus": "introduced",
  "billType": "Bill",
  "lastAction": "Introduced in House",
  "lastActionDate": "2026-01-13T09:00:00",
  "chapterNo": "",
  "signedDate": null,
  "effectiveDate": null
}
```

### MARCH 2026 (Bill Passes House)
```json
{
  "billNum": "HB0008",
  "shortTitle": "Stalking of minors.",
  "sponsor": "Judiciary",
  "year": 2026,
  "billStatus": "passed_house",
  "lastAction": "Passed House 55-5",
  "lastActionDate": "2026-03-05T15:30:00",
  "enrolledNo": "",
  "chapterNo": "",
  "signedDate": null,
  "effectiveDate": null
}
```

### APRIL 2026 (Bill Signed by Governor)
```json
{
  "billNum": "HB0008",
  "shortTitle": "Stalking of minors.",
  "sponsor": "Judiciary",
  "year": 2026,
  "billStatus": "signed",
  "lastAction": "Signed by Governor",
  "lastActionDate": "2026-04-10T14:00:00",
  "enrolledNo": "HEA0008",
  "chapterNo": "HEA0008",
  "signedDate": "2026-04-10T14:00:00",
  "effectiveDate": "2026-07-01T00:00:00"
}
```

---

## Key Insight: Why Most Fields Are NULL Today

**These are DRAFT bills being prepared by committees in December 2025**, before the 2026 legislative session officially opens in January 2026.

The Wyoming Legislative Service Office API provides:
- **Committee-curated pre-session bills** (25 bills selected for committee work)
- **Proposed titles and sponsors** (what committees plan to introduce)
- **Not yet: official legislative status** (that comes when session starts)

This makes it a **forward-looking data source** – useful for tracking what committees are planning, not what has already happened. It's complementary to OpenStates, which tracks **historical/current bills** that have already been introduced.

---

**Document Created:** December 11, 2025  
**Data Quality for Field Mapping:** High (all fields present, even if null)  
**Best Use:** Track committee intentions and pre-session bill planning
