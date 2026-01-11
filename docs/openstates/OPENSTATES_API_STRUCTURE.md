# OpenStates v3 API - Data Structure & Field Mapping

## API Endpoint
```
GET https://v3.openstates.org/bills
```

**Query Parameters:**
- `jurisdiction=Wyoming` - State/jurisdiction filter
- `session=2025` - Legislative session
- `per_page=20` - Results per request (max)
- `sort=updated_desc` - Sort by most recently updated

**Headers:**
- `X-API-KEY: {OPENSTATES_API_KEY}` - Authentication

---

## OpenStates v3 Bill Response Structure

### Complete Bill Object Example
```json
{
  "id": "ocd-bill/3bf03922-22fb-406e-a83b-54f93849e03f",
  "identifier": "HB 22",
  "title": "Water and wastewater operator-emergency response.",
  "from_organization": {
    "id": "ocd-organization/...",
    "name": "Wyoming House of Representatives"
  },
  "legislative_session": "2025",
  "abstracts": [
    {
      "abstract": "Establishes plans and training for water/wastewater operators to handle emergencies...",
      "note": "summary"
    }
  ],
  "subjects": [
    "Water Rights",
    "Emergency Response",
    "Infrastructure"
  ],
  "actions": [
    {
      "date": "2025-01-15",
      "description": "Introduced in House",
      "classification": ["introduction"],
      "organization": "Wyoming House of Representatives",
      "from_organization": "Wyoming House of Representatives"
    },
    {
      "date": "2025-02-01",
      "description": "Referred to Committee on Natural Resources",
      "classification": ["committee"],
      "organization": "Wyoming House of Representatives",
      "from_organization": "Wyoming House of Resources Committee"
    }
  ],
  "versions": [
    {
      "note": "introduced",
      "links": [
        {
          "url": "https://legislature.wyoming.gov/...",
          "media_type": "text/html"
        }
      ]
    }
  ],
  "sources": [
    {
      "url": "https://legislature.wyoming.gov/...",
      "note": "original"
    }
  ],
  "openstates_url": "https://openstates.org/...",
  "created_at": "2025-01-15T00:00:00Z",
  "updated_at": "2025-02-15T12:30:45Z"
}
```

---

## Field Mapping: OpenStates → civic_items Table

### Fields We Extract & How

| OpenStates Field | Database Column | Extract Logic | Notes |
|---|---|---|---|
| `id` | `id` | Direct | OCD Bill ID (unique identifier) |
| `identifier` | `bill_number` | Direct | e.g., "HB 22", "SF 164" |
| `title` | `title` | Direct | Bill title |
| `abstracts[0].abstract` | `summary` | First abstract | Bill summary/description |
| `from_organization` | `chamber` | `normalizeChamber()` | Extract "house" or "senate" from org name |
| `legislative_session` | `legislative_session` | Direct | Session year (e.g., "2025") |
| `actions` | `status` | `statusFromActions()` | Infer from action classifications |
| `actions` | `introduced_at` | `earliestActionDate()` | Date of first action |
| `actions` | `last_action` | `latestAction()` | Description of most recent action |
| `actions` | `last_action_date` | `latestAction()` | Date of most recent action |
| `subjects` | `subject_tags` | `JSON.stringify()` | Array as JSON string |
| `subjects[0]` | `category` | First subject | First topic tag |
| `sources[0].url` or `openstates_url` | `external_url` | Fallback chain | Primary source link |
| `versions[0].links[0].url` | `text_url` | Fallback chain | Bill text/document URL |
| — | `kind` | Static | Set to "bill" |
| — | `source` | Static | Set to "open_states" |
| — | `level` | Static | Set to "statewide" |
| — | `jurisdiction_key` | Static | Set to "WY" |
| — | `ballot_type` | Null | Not applicable for legislation |
| — | `measure_code` | Null | Not applicable for legislation |
| — | `election_date` | Null | Not applicable for legislation |
| — | `external_ref_id` | `id` | Uses bill ID as ref |
| — | `location_label` | Static | Set to "Wyoming" |
| `id` | `up_votes`, `down_votes` | Preserved | Kept from existing record or 0 |

---

## Status Determination Logic

**Function:** `statusFromActions(actions)`

```javascript
const statusFromActions = (actions = []) => {
  if (!actions.length) return "introduced";
  const has = (cls) => actions.some((a) => 
    (a.classification || []).includes(cls)
  );
  
  if (has("withdrawal") || has("failure")) 
    return "failed";
  
  // Check for final passage (both chambers)
  const chamberPassages = actions.filter((a) => 
    (a.classification || []).includes("passage")
  );
  const chambers = new Set(chamberPassages.map((a) => 
    a.organization || a.from_organization
  ));
  if (chambers.size >= 2) 
    return "passed";
  
  if (has("passage")) 
    return "pending_vote";
  if (has("committee")) 
    return "in_committee";
  
  return "introduced";
};
```

**Possible Status Values:**
- `introduced` - Bill introduced but no further action
- `in_committee` - Currently in committee
- `pending_vote` - Has passed one chamber, pending vote
- `passed` - Passed both chambers (final passage)
- `failed` - Bill withdrawn or failed
- `enacted` - Signed into law (if available)

---

## Chamber Normalization Logic

**Function:** `normalizeChamber(org)`

```javascript
const normalizeChamber = (org) => {
  let orgStr = "";
  if (typeof org === "string") {
    orgStr = org;
  } else if (org && typeof org === "object" && org.name) {
    orgStr = org.name;
  } else if (org && typeof org === "object") {
    orgStr = String(org);
  }
  
  const o = (orgStr || "").toLowerCase();
  if (o.includes("upper")) return "senate";
  if (o.includes("lower")) return "house";
  if (o.includes("senate")) return "senate";
  if (o.includes("house")) return "house";
  return null;
};
```

**Expected Input Examples:**
- `"Wyoming Senate"` → `"senate"`
- `"Wyoming House of Representatives"` → `"house"`
- `"Upper Chamber"` → `"senate"`
- `"Lower Chamber"` → `"house"`
- `{ "name": "Wyoming House of Representatives" }` → `"house"`

---

## Potential Issues with Current Implementation

### 1. **HB 164 Confusion (Your Issue)**
**Problem:** You're seeing "HB 164" which might be from Utah, not Wyoming.

**Possible Causes:**
- API returning cross-state results
- Identifier collision (multiple states can use same bill numbers)
- Session parameter mismatch

**Solution:** Verify the bill's jurisdiction before inserting:
```javascript
// Add validation check
if (bill.jurisdiction?.name?.toLowerCase() !== "wyoming") {
  console.warn(`Skipping non-Wyoming bill: ${bill.identifier}`);
  continue;
}
```

### 2. **Chamber Not Being Identified**
**Problem:** `normalizeChamber()` returns `null` if org name doesn't match patterns.

**Possible Fixes:**
```javascript
const normalizeChamber = (org) => {
  let orgStr = "";
  if (typeof org === "string") {
    orgStr = org;
  } else if (org?.name) {
    orgStr = org.name;
  } else {
    return null; // Can't determine
  }
  
  const o = orgStr.toLowerCase();
  
  // Add more patterns
  if (o.includes("senate") || o.includes("upper")) return "senate";
  if (o.includes("house") || o.includes("representative") || o.includes("lower")) return "house";
  
  // Fallback for "House of Representatives" pattern
  if (o.includes("house")) return "house";
  if (o.includes("senate")) return "senate";
  
  return null;
};
```

### 3. **Missing Bill Data**
**Problem:** Some bills might have incomplete data.

**Check These Fields:**
```javascript
// Defensive extraction
const bill_number = bill.identifier || "(no identifier)";
const chamber = normalizeChamber(bill.from_organization); // Could be null
const session = bill.legislative_session || "(no session)";
const title = bill.title || "(untitled)";
const jurisdiction = bill.jurisdiction?.name || "(no jurisdiction)";
```

---

## Recommended Debug Changes

### 1. Add Logging to Sync Function
```javascript
export async function syncWyomingBills(env, db, { session, limit = 20 } = {}) {
  // ... existing code ...
  
  for (const bill of bills) {
    console.log(`[SYNC] Processing: ${bill.identifier} from ${bill.jurisdiction?.name}`);
    
    // Verify it's actually Wyoming
    if (bill.jurisdiction?.name?.toLowerCase() !== "wyoming") {
      console.warn(`⚠️  SKIPPED: ${bill.identifier} - NOT Wyoming (found: ${bill.jurisdiction?.name})`);
      continue;
    }
    
    const chamber = normalizeChamber(bill.from_organization);
    if (!chamber) {
      console.warn(`⚠️  WARNING: ${bill.identifier} - Chamber not determined from: ${JSON.stringify(bill.from_organization)}`);
    }
    
    // ... rest of insert logic ...
    console.log(`✅ SYNCED: ${bill.identifier} (${chamber})`);
  }
}
```

### 2. Add Validation Query
```sql
-- After sync, verify what was inserted
SELECT 
  bill_number, 
  title, 
  chamber,
  legislative_session,
  COUNT(*) as count
FROM civic_items
WHERE source = 'open_states'
GROUP BY bill_number, chamber
ORDER BY bill_number;

-- Check for issues
SELECT * FROM civic_items 
WHERE source = 'open_states' AND chamber IS NULL
LIMIT 10;
```

---

## Testing/Debugging Approach

### Step 1: Check OpenStates API Response
Use the endpoint directly (need ./scripts/wr running):
```bash
curl "http://127.0.0.1:8787/api/dev/openstates/sync?session=2025&limit=5" 
```

Should return:
```json
{
  "synced": 5,
  "count": 5,
  "session": "2025",
  "sample": [
    {
      "id": "ocd-bill/...",
      "bill_number": "HB 22",
      "title": "Water...",
      "status": "in_committee",
      "last_action_date": "2025-02-01"
    }
  ]
}
```

### Step 2: Verify Database Records
```bash
./scripts/wr d1 execute WY_DB --command "
SELECT 
  id, 
  bill_number, 
  title, 
  chamber, 
  legislative_session, 
  source 
FROM civic_items 
WHERE source='open_states' 
LIMIT 5;" --local
```

### Step 3: Identify Non-Wyoming Bills
```bash
./scripts/wr d1 execute WY_DB --command "
SELECT DISTINCT bill_number, title 
FROM civic_items 
WHERE source='open_states'
ORDER BY bill_number;" --local
```

If you see bills from other states, the API filtering needs improvement.

---

## Next Steps

1. **Add jurisdiction validation** to `syncWyomingBills()`
2. **Add logging** to identify which bills are being synced
3. **Test with small limit** (5-10 bills) to debug before full import
4. **Verify chamber detection** is working correctly
5. **Check for duplicate identifiers** across different states

Would you like me to implement these validation improvements in the sync function?
