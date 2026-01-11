# Hot Topics Bill Scanner – Implementation Reference

**Date:** December 5, 2025  
**Status:** ✅ Ready for Testing  
**Scope:** Wyoming bill analysis with OpenAI gpt-4o, linking to six canonical hot topics

---

## Overview

The bill scanner autonomously analyzes Wyoming bills against six specific "hot button" topics that drive public engagement:

1. **Property Tax Relief** – Rising assessments; exemptions
2. **Water Rights & Drought Planning** – Allocation and efficiency
3. **Education Funding & Local Control** – School funding and curriculum
4. **Energy Permitting & Grid Reliability** – Transmission and generation permits
5. **Public Safety & Fentanyl Response** – Opioid trafficking and treatment
6. **Housing & Land Use** – Zoning and workforce housing

All matches are stored in D1 with:
- **WY_DB.civic_item_ai_tags** – AI analysis results (confidence, snippet)
- **EVENTS_DB.hot_topic_civic_items** – Links bills to active hot topics

---

## Files Modified/Confirmed

### 1. **worker/src/lib/hotTopicsAnalyzer.mjs** ✅ REFACTORED
**Purpose:** Core analyzer using OpenAI gpt-4o

**Key Exports:**
```javascript
export async function analyzeBillForHotTopics(env, bill)
export async function saveHotTopicAnalysis(env, billId, analysis)
```

**Configuration:**
- Model: `gpt-4o`
- Temperature: `0.2` (conservative, factual)
- Max tokens: `500` per bill (cost-efficient)
- API key: `env.OPENAI_API_KEY` (reuses sandbox pattern)

**Input (bill):**
- `id`, `bill_number`, `title`, `summary`, `subject_tags`
- `status`, `legislative_session`, `chamber`
- `last_action`, `last_action_date`, `text_url`

**Output:**
```javascript
{
  topics: [
    {
      slug: "property-tax-relief",
      label: "Property Tax Relief",
      confidence: 0.92,
      trigger_snippet: "...quoted text from bill..."
    }
  ],
  other_flags: [
    {
      label: "Other concern",
      confidence: 0.65,
      trigger_snippet: "..."
    }
  ],
  meta: { model: "gpt-4o", raw: "...JSON from OpenAI..." }
}
```

**Confidence Guidelines:**
- **≥ 0.85** – Very clear, direct matches only
- **0.70–0.84** – Strong relevance with minor ambiguity
- **< 0.70** – Placed in `other_flags`, not topics

**Error Handling:**
- Missing `OPENAI_API_KEY`: Returns `{ topics: [], other_flags: [] }`
- JSON parse failure: Returns `{ topics: [], other_flags: [] }` with warning
- OpenAI request error: Retried once, then logged and returns empty

**Two-Phase Save:**
1. Insert into `WY_DB.civic_item_ai_tags` (item_id, topic_slug, confidence, snippet)
2. Link to `EVENTS_DB.hot_topic_civic_items` (cross-database, using two-phase pattern)

---

### 2. **worker/src/routes/civicScan.mjs** ✅ REFACTORED
**Purpose:** Dev-only HTTP route for batch scanning

**Route:** `POST /api/internal/civic/scan-pending-bills`  
**Security:** Host-restricted to `localhost` / `127.0.0.1`  
**Batch Size:** 5 bills per request  
**Status Filters:** `introduced`, `in_committee`, `pending_vote`

**Response Format:**
```javascript
{
  scanned: 3,
  results: [
    {
      bill_id: "ocd-bill/...",
      bill_number: "HB 22",
      topics: ["property-tax-relief"],
      confidence_avg: "0.92"
    },
    {
      bill_id: "ocd-bill/...",
      bill_number: "HB 23",
      topics: ["education-funding", "housing-land-use"],
      confidence_avg: "0.78"
    },
    {
      bill_id: "ocd-bill/...",
      bill_number: "SF 2",
      topics: [],
      confidence_avg: null
    }
  ],
  timestamp: "2025-12-05T15:30:00.000Z"
}
```

**Error Response:**
```javascript
{
  error: "scan_failed",
  message: "Error details..."
}
```

**Logging:**
- 🚀 `Starting pending bill scan...`
- 📋 `Found N pending bills to scan`
- 📄 `Analyzing HB 22: Bill Title`
- ✅ `Scan complete: N bills processed`
- ❌ `Error processing bill HB 22: Details...`

**Per-Bill Error Handling:**
- If a single bill fails, it's included in results with `error` field
- Scan continues with remaining bills

---

### 3. **worker/src/routes/sandbox.js** ✅ CONFIRMED
**Status:** No changes needed

- Existing implementation reused by analyzer
- Bearer token pattern: `Authorization: Bearer ${env.OPENAI_API_KEY}`
- Model: `gpt-4o`, temperature varies per use case

---

### 4. **worker/src/lib/civicSummaries.mjs** ✅ CONFIRMED
**Status:** No changes needed

- Reuses same OpenAI pattern
- For future summarization of bill text
- Currently not integrated with hot topics analyzer

---

### 5. **worker/src/index.mjs** ✅ CONFIRMED
**Status:** Already wired

```javascript
import { handleScanPendingBills } from "./routes/civicScan.mjs";
...
router.post("/api/internal/civic/scan-pending-bills", handleScanPendingBills);
```

---

### 6. **worker/migrations_wy/0009_add_civic_item_ai_tags.sql** ✅ APPLIED
**Status:** Migration applied locally, ready for remote

**Table Schema:**
```sql
CREATE TABLE civic_item_ai_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL,          -- references civic_items.id
  topic_slug TEXT NOT NULL,        -- matches hot_topics.slug
  confidence REAL NOT NULL,        -- 0.0 to 1.0
  trigger_snippet TEXT,            -- quoted bill text
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX civic_item_ai_tags_item_topic
  ON civic_item_ai_tags (item_id, topic_slug);
```

---

## Usage Example

### Step 1: Analyze a Single Bill (in handler/test)
```javascript
import { analyzeBillForHotTopics, saveHotTopicAnalysis } from "../lib/hotTopicsAnalyzer.mjs";

const bill = {
  id: "ocd-bill/12345",
  bill_number: "HB 22",
  title: "Homestead Exemption Expansion Act",
  summary: "Expands property tax exemptions for homeowners.",
  subject_tags: "taxes, property",
  status: "introduced",
  legislative_session: 2025,
  chamber: "lower",
  last_action: "Introduced in House",
  last_action_date: "2025-01-15",
  text_url: "https://example.com/HB22.pdf"
};

// Analyze
const analysis = await analyzeBillForHotTopics(env, bill);
console.log("Topics found:", analysis.topics.map(t => t.slug));
// Output: Topics found: ["property-tax-relief"]

// Save to databases
await saveHotTopicAnalysis(env, bill.id, analysis);
```

### Step 2: Trigger Full Scan via HTTP

**Terminal 1:** Start the Worker
```bash
cd /home/anchor/projects/this-is-us/worker
./scripts/wr d1 migrations apply WY_DB --local  # Apply pending migrations
./scripts/wr dev --local                         # Start dev server
```

**Terminal 2:** Scan pending bills
```bash
curl -X POST http://127.0.0.1:8787/api/internal/civic/scan-pending-bills
```

**Expected Response:**
```json
{
  "scanned": 5,
  "results": [
    {
      "bill_id": "ocd-bill/...",
      "bill_number": "HB 22",
      "topics": ["property-tax-relief"],
      "confidence_avg": "0.92"
    },
    {
      "bill_id": "ocd-bill/...",
      "bill_number": "HB 23",
      "topics": [],
      "confidence_avg": null
    }
  ],
  "timestamp": "2025-12-05T15:42:18.000Z"
}
```

### Step 3: Verify Results in Database

**Check AI tags in WY_DB:**
```bash
cd /home/anchor/projects/this-is-us/worker

./scripts/wr d1 execute WY_DB --local --command \
  "SELECT item_id, topic_slug, confidence, trigger_snippet FROM civic_item_ai_tags LIMIT 5;" \
  --json | jq '.[0].results'
```

**Check links in EVENTS_DB:**
```bash
./scripts/wr d1 execute EVENTS_DB --local --command \
  "SELECT ht.slug, COUNT(htci.civic_item_id) as linked_bills 
   FROM hot_topics ht 
   LEFT JOIN hot_topic_civic_items htci ON ht.id = htci.topic_id 
   GROUP BY ht.slug;" \
  --json | jq '.[0].results'
```

**Expected Output:**
```json
[
  { "slug": "property-tax-relief", "linked_bills": 1 },
  { "slug": "water-rights", "linked_bills": 0 },
  { "slug": "education-funding", "linked_bills": 0 },
  ...
]
```

---

## WSL/Linux Commands Cheatsheet

### Preparation
```bash
# Apply pending WY_DB migrations (includes civic_item_ai_tags)
cd /home/anchor/projects/this-is-us/worker
./scripts/wr d1 migrations apply WY_DB --local
./scripts/wr d1 migrations apply EVENTS_DB --local

# Verify tables exist
./scripts/wr d1 execute WY_DB --local \
  --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" --json | jq '.[0].results[] | .name'
```

### Start Developer Environment
```bash
# In first terminal: start ./scripts/wr dev
cd /home/anchor/projects/this-is-us/worker
./scripts/wr dev --local

# Should show:
# ⚙️  Binding ...
# ▲ [./scripts/wr:core] Ready on http://127.0.0.1:8787
```

### Test the Scan Endpoint
```bash
# In second terminal: trigger scan
curl -X POST http://127.0.0.1:8787/api/internal/civic/scan-pending-bills \
  -H "Content-Type: application/json" | jq .

# Test with real URLs (./scripts/wr dev running)
curl -s http://127.0.0.1:8787/api/civic/pending-bills | jq '.results | length'  # Count bills
curl -s http://127.0.0.1:8787/api/hot-topics | jq '.hot_topics | length'        # Count topics
```

### Monitor Results
```bash
# Check civic_item_ai_tags
sqlite3 /home/anchor/projects/this-is-us/worker/../scripts/wr/state/v3/d1/miniflare-D1DatabaseObject/4b4227f1-bf30-4fcf-8a08-6967b536a5ab.sqlite \
  "SELECT bill_number, topic_slug, confidence FROM (
     SELECT ci.bill_number, cit.topic_slug, cit.confidence 
     FROM civic_item_ai_tags cit 
     JOIN civic_items ci ON ci.id = cit.item_id
   ) ORDER BY confidence DESC LIMIT 10;"

# Count bills linked per topic
sqlite3 /home/anchor/projects/this-is-us/worker/../scripts/wr/state/v3/d1/miniflare-D1DatabaseObject/6c3fffd4-e6dc-47b8-b541-3857c2882e0c.sqlite \
  "SELECT ht.slug, ht.title, COUNT(htci.civic_item_id) as linked_bills 
   FROM hot_topics ht 
   LEFT JOIN hot_topic_civic_items htci ON ht.id = htci.topic_id 
   GROUP BY ht.id ORDER BY linked_bills DESC;"
```

### Cleanup (if needed)
```bash
# Clear AI tags (dev reset)
./scripts/wr d1 execute WY_DB --local --command "DELETE FROM civic_item_ai_tags;" --json

# Clear hot topic links (dev reset)
./scripts/wr d1 execute EVENTS_DB --local --command "DELETE FROM hot_topic_civic_items;" --json

# Re-apply migrations (full reset)
rm /home/anchor/projects/this-is-us/worker/../scripts/wr/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite
./scripts/wr d1 migrations apply EVENTS_DB --local
./scripts/wr d1 migrations apply WY_DB --local
```

---

## Key Design Patterns

### 1. Reused OpenAI Integration
- Same `env.OPENAI_API_KEY` and fetch pattern as sandbox
- Model: `gpt-4o`, Temperature: `0.2`
- No new secrets or clients introduced

### 2. Canonical Topics Validation
- Only six slugs allowed in `topics` array
- Invalid slugs automatically filtered out
- Prevents data corruption from malformed AI responses

### 3. Two-Phase Cross-Database Save
```
analyzeBillForHotTopics(env, bill)  ← OpenAI
        ↓
saveHotTopicAnalysis(env, billId, analysis)
        ├─ Phase 1: Insert into WY_DB.civic_item_ai_tags
        └─ Phase 2: Link to EVENTS_DB.hot_topic_civic_items (lookup hot_topics.id first)
```

### 4. Conservative Confidence Thresholds
- **0.85+**: High confidence → add to topics
- **0.70–0.84**: Medium confidence → add to topics
- **<0.70**: Low confidence → moved to other_flags only

### 5. Batch Processing Safety
- 5 bills per request (manageable cost)
- Per-bill error handling (one failure doesn't stop scan)
- Logs with emoji prefixes for easy tailing

---

## Next Steps (Future)

1. **Deploy to Production**
   ```bash
   ./scripts/wr d1 migrations apply WY_DB --remote --env production
   ./scripts/wr d1 migrations apply EVENTS_DB --remote --env production
   ./scripts/wr deploy --env production
   ```

2. **Remove Host Restriction (Optional)**
   - Add admin auth check via Firebase token
   - Or remove localhost-only restriction for scheduled jobs

3. **Automated Scheduling**
   - Add `scheduled()` handler in worker to scan daily
   - Or wire POST `/api/civic/sync` as a cron target

4. **Populate Match Metadata**
   - Once links exist, use `match_score` / `matched_terms_json` / `excerpt` fields
   - Display confidence badges on hot topics UI

5. **UI Integration**
   - Display matched topics on bill detail pages
   - Show confidence score and trigger snippet in hot topics list

---

## Testing Checklist

- [ ] WY_DB migration 0009 applied locally
- [ ] `civic_item_ai_tags` table exists with correct schema
- [ ] `./scripts/wr dev --local` starts without errors
- [ ] `POST /api/internal/civic/scan-pending-bills` returns 200 (localhost only)
- [ ] Results include `bill_number`, `topics`, `confidence_avg`, `timestamp`
- [ ] WY_DB receives AI tags (check `civic_item_ai_tags`)
- [ ] EVENTS_DB receives links (check `hot_topic_civic_items`)
- [ ] Non-localhost requests return 403 Forbidden
- [ ] Error handling: per-bill failures don't crash scan

---

## File Locations Summary

```
worker/
├── src/
│   ├── lib/
│   │   ├── hotTopicsAnalyzer.mjs      ← REFACTORED: analyze + save functions
│   │   ├── civicSummaries.mjs         ← CONFIRMED: no changes
│   │   └── openStatesSync.mjs         ← CONFIRMED: no changes
│   ├── routes/
│   │   ├── civicScan.mjs              ← REFACTORED: scan endpoint
│   │   ├── sandbox.js                 ← CONFIRMED: OpenAI client
│   │   └── hotTopics.mjs              ← CONFIRMED: hot topics API
│   └── index.mjs                      ← CONFIRMED: routing
└── migrations_wy/
    └── 0009_add_civic_item_ai_tags.sql ← CONFIRMED: applied locally
```

---

**Status:** ✅ **Ready for Testing**  
**Last Updated:** December 5, 2025  
**Next Review:** After first scan run on production
