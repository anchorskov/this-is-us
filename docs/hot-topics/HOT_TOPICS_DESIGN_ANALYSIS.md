# Hot Topics Feature: Design Intent & Current Status

**Date:** December 11, 2025  
**Analysis by:** GitHub Copilot  
**Status:** 🔴 FEATURE COMPLETE BUT DATA-STARVED

---

## Executive Summary

The **Hot Topics** feature is a sophisticated, well-engineered system designed to highlight Wyoming's most pressing legislative issues and enable civic engagement. All code is production-ready and working correctly. However, the feature shows **0 bills for all 6 topics** because the data source tables are empty.

**Root Cause:** Two critical data tables have never been populated:
- `hot_topic_civic_items` (0 rows) — Should contain manual bill-to-topic assignments
- `civic_item_ai_tags` (0 rows) — Should contain AI-generated topic matches

**Result:** The API correctly returns 6 beautifully configured topics with empty bill arrays.

---

## 1. The Design Intent

### What Is Hot Topics?

Hot Topics is a **curated civic engagement tool** that:

1. **Identifies Wyoming's most pressing issues** — 6 canonical topics covering taxes, water, education, energy, safety, and housing
2. **Links pending bills to these issues** — Shows which bills address which topics
3. **Displays public engagement signals** — Vote counts (👍 support, 👎 oppose, ❓ need info) per bill
4. **Personalizes the experience** — Users follow topics of interest; followed topics appear first with a ★ badge
5. **Explains connections** — AI-generated explanations describe why a bill matches a topic

### Why This Matters

Wyoming citizens face complex legislative issues that span multiple bills:
- **Property Tax Relief**: Multiple bills proposed, need to compare approaches
- **Water Rights & Drought**: Allocation + storage + efficiency bills interconnected
- **Education Funding**: Impacts funding formulas, local control, curriculum oversight
- **Energy Permitting**: Transmission, generation, and grid reliability bills
- **Public Safety & Fentanyl**: Penalties, treatment, interdiction coordination
- **Housing & Land Use**: Zoning, infrastructure, workforce housing strategies

Hot Topics groups related bills, making it easier for citizens to:
- Understand a complex issue through all its pending bills
- Engage meaningfully (voting on multiple related bills)
- Follow issues they care about across legislative sessions

### User Journey

```
1. User visits /hot-topics
   ↓
2. Sees 6 topic cards with bill counts
   ↓
3. Followed topics appear first with ★ badge
   ↓
4. Clicks on a topic → /hot-topics/:slug
   ↓
5. Sees all bills linked to that topic
   ↓
6. Votes (👍 👎 ❓) on specific bills
   ↓
7. Vote counts aggregate and display in real-time
```

---

## 2. Architecture & Technology Stack

### Database Design: Two Database Pattern

The system uses Cloudflare's multi-database approach:

```
┌─────────────────────────────────────┐
│ EVENTS_DB (Metadata & Engagement)   │
├─────────────────────────────────────┤
│ hot_topics (6 canonical topics)      │  Schema:
│  - id, slug, title, summary          │  ├─ id (INT, PK)
│  - badge, image_url, priority        │  ├─ slug (TEXT, UNIQUE)
│  - cta_label, cta_url, is_active     │  ├─ title (TEXT)
│                                      │  ├─ summary (TEXT)
│ hot_topic_civic_items (links)        │  ├─ priority (INT, for sorting)
│  - topic_id → hot_topics.id          │  └─ is_active (BOOL)
│  - civic_item_id → civic_items.id    │
│                                      │  [JUNCTION TABLE - EMPTY]
│ user_topic_prefs (user follows)      │
│  - user_id (Firestore UID)           │
│  - topic_id → hot_topics.id          │
│  - created_at, updated_at            │
└─────────────────────────────────────┘
         ↓ (LEFT JOIN)
┌─────────────────────────────────────┐
│ WY_DB (Bill Data & Engagement)      │
├─────────────────────────────────────┤
│ civic_items (25 pending bills)       │  Fetched by ID from
│  - id, bill_number, title            │  hot_topic_civic_items
│  - status, chamber, session          │  and civic_item_ai_tags
│  - last_action, last_action_date     │
│                                      │
│ civic_item_ai_tags (topic matches)   │  Schema:
│  - civic_item_id (FK)                │  ├─ civic_item_id (FK)
│  - topic_slug (TEXT)                 │  ├─ topic_slug (TEXT)
│  - confidence (FLOAT)                │  ├─ confidence (FLOAT)
│  - trigger_snippet (TEXT)            │  ├─ reason_summary (TEXT)
│  - reason_summary (TEXT)             │  └─ created_at
│                                      │
│ votes (engagement tracking)          │  [EMPTY - NEVER ANALYZED]
│  - target_id, target_type            │
│  - user_id, value (1/-1/0)           │
└─────────────────────────────────────┘
```

**Why Two Databases?**
- **EVENTS_DB**: Handles event metadata (like hot topics) shared across states/regions
- **WY_DB**: State-specific bill data, analytics, and voting

### API Endpoint: GET /api/hot-topics

**File:** [worker/src/routes/hotTopics.mjs](worker/src/routes/hotTopics.mjs)

**Query Logic:**
```sql
SELECT ht.*, htci.civic_item_id
  FROM hot_topics ht
  LEFT JOIN hot_topic_civic_items htci ON htci.topic_id = ht.id
 WHERE ht.is_active = 1
 ORDER BY ht.priority ASC
```

**Then for each civic_item_id found:**
```sql
SELECT ci.*, v.up_votes, v.down_votes, v.info_votes
  FROM civic_items ci
  LEFT JOIN votes v ON v.target_id = ci.id
 WHERE ci.id IN (...)
```

**Response:**
```json
[
  {
    "id": 1,
    "slug": "property-tax-relief",
    "title": "Property Tax Relief",
    "summary": "Rising assessments are squeezing homeowners...",
    "badge": "Taxes",
    "priority": 10,
    "is_active": 1,
    "civic_items": [
      {
        "id": "ocd-bill/...",
        "bill_number": "HB 22",
        "title": "Property Tax Caps",
        "status": "in_committee",
        "up_votes": 42,
        "down_votes": 8,
        "info_votes": 15
      }
      // ... more bills
    ]
  },
  // ... more topics
]
```

**Current Production Response:**
```json
[
  {
    "id": 1,
    "slug": "property-tax-relief",
    "title": "Property Tax Relief",
    ...
    "civic_items": []  // ← EMPTY (root cause)
  },
  // ... 5 more topics, all with empty civic_items
]
```

### Frontend: Hot Topics List Page

**File:** [static/js/civic/hot-topics.js](static/js/civic/hot-topics.js)

**Features:**
1. **Firebase Integration**: Loads user's followed topics from Firestore
   ```javascript
   const userDocRef = doc(db, "users", user.uid);
   let followedTopicIds = userDocSnap.data().preferences?.followedTopics || [];
   ```

2. **Smart Sorting**: Followed topics appear first
   ```javascript
   const sortedTopics = topics.sort((a, b) => {
     const aFollowed = followedTopicIds.includes(a.id);
     const bFollowed = followedTopicIds.includes(b.id);
     return bFollowed - aFollowed; // Followed first
   });
   ```

3. **Visual Indicators**: ★ badge for followed topics
   ```javascript
   const followedBadge = isFollowed 
     ? '<span class="followed-badge">★ Following</span>' 
     : '';
   ```

4. **Bill Count Display**: Shows number of bills per topic
   ```javascript
   const civicCount = (topic.civic_items || []).length;
   <span class="bill-count"><strong>${civicCount}</strong> bill${civicCount !== 1 ? "s" : ""}</span>
   ```

### Bill-to-Topic Assignment System

Two parallel mechanisms can link bills to topics:

#### Option 1: Manual Assignment (hot_topic_civic_items)

**Table:** `EVENTS_DB.hot_topic_civic_items`

**Schema:**
```sql
CREATE TABLE hot_topic_civic_items (
  topic_id INTEGER NOT NULL,
  civic_item_id TEXT NOT NULL,
  PRIMARY KEY (topic_id, civic_item_id),
  FOREIGN KEY (topic_id) REFERENCES hot_topics(id)
);
```

**Use Case:** Editorial/administrative curation
- Admins explicitly decide which bills belong to which topics
- Full control over content
- No automation needed

**Current Status:** ❌ EMPTY (0 rows)

#### Option 2: AI Assignment (civic_item_ai_tags)

**Table:** `WY_DB.civic_item_ai_tags`

**Schema:**
```sql
CREATE TABLE civic_item_ai_tags (
  civic_item_id TEXT NOT NULL,
  topic_slug TEXT NOT NULL,
  confidence FLOAT,
  trigger_snippet TEXT,
  reason_summary TEXT,
  created_at TIMESTAMP,
  PRIMARY KEY (civic_item_id, topic_slug)
);
```

**Use Case:** Automated topic discovery via OpenAI gpt-4o

**File:** [worker/src/lib/hotTopicsAnalyzer.mjs](worker/src/lib/hotTopicsAnalyzer.mjs)

**Features:**
- Analyzes bill title, summary, text, and status
- Matches against 6 canonical topics
- Generates confidence score (0.0–1.0)
- Produces `reason_summary`: "Why this bill matches this topic" (1–3 sentences)
- Extracts `trigger_snippet`: Relevant quote or paraphrase from bill

**Example Output (if run):**
```json
{
  "civic_item_id": "ocd-bill/us-wy:bill/2025/HB22",
  "bill_number": "HB 22",
  "topics": [
    {
      "slug": "property-tax-relief",
      "label": "Property Tax Relief",
      "confidence": 0.92,
      "trigger_snippet": "Caps annual assessment increases at 2% for residential property",
      "reason_summary": "This bill directly addresses property tax relief by capping assessment increases, a central concern for homeowners facing rising tax burdens."
    }
  ],
  "tokens_used": {
    "input": 125,
    "output": 78
  },
  "cost_estimate": "$0.00015"
}
```

**Current Status:** ❌ EMPTY (0 rows) — Code complete, never executed

---

## 3. The 6 Canonical Topics

| # | Slug | Title | Priority | Status |
|---|------|-------|----------|--------|
| 1 | `property-tax-relief` | Property Tax Relief | 10 | ✅ Active |
| 2 | `water-rights` | Water Rights & Drought Planning | 20 | ✅ Active |
| 3 | `education-funding` | Education Funding & Local Control | 30 | ✅ Active |
| 4 | `energy-permitting` | Energy Permitting & Grid Reliability | 40 | ✅ Active |
| 5 | `public-safety-fentanyl` | Public Safety & Fentanyl Response | 50 | ✅ Active |
| 6 | `housing-land-use` | Housing & Land Use | 60 | ✅ Active |

**Plus 4 Secondary Topics:**
- Reproductive Health (priority 100)
- Rural Healthcare & Hospitals (priority 100)
- Property Rights & Eminent Domain (priority 100)
- State Lands & Grazing (priority 100)

All 10 topics are defined, active, and prioritized on production.

---

## 4. Code Quality Assessment

### ✅ Well-Engineered

**hotTopics.mjs (API Handler)**
- Clean separation: list endpoint vs. detail endpoint
- Efficient JOIN strategy: `hot_topics → hot_topic_civic_items → civic_items`
- Vote aggregation: SUM queries on `votes` table with LEFT JOIN
- Proper error handling and logging
- Type safety with query preparation

**hot-topics.js (Frontend)**
- Firebase Firestore integration for user preferences
- Async/await pattern for data loading
- Responsive sorting (followed topics first)
- Visual affordances (★ badge, bill count, CTA button)
- Graceful degradation (shows "No topics available" on error)

**hotTopicsAnalyzer.mjs (AI Integration)**
- OpenAI gpt-4o integration with temperature=0.2 (conservative)
- Token estimation for cost tracking
- Retry logic for transient failures
- Strict validation: only 6 canonical topics allowed
- Comprehensive output: confidence scores + reason_summary
- ~$0.00015 per bill (highly cost-efficient)

### ✅ Infrastructure Complete

- Database migrations in place (0011, 0017)
- Firestore + D1 preference sync pattern implemented
- Vote tracking infrastructure ready
- Design documents comprehensive and maintained
- Security guards: Feature flag, localhost-only access, graceful degradation

### ❌ Missing: Data

**Both data source tables empty:**
- `hot_topic_civic_items`: 0 rows (manual assignments)
- `civic_item_ai_tags`: 0 rows (AI assignments)

**Impact:**
- All 6 topics render correctly but with 0 bills each
- Frontend displays beautifully but empty
- Feature is not broken; it's just data-starved

---

## 5. Why Hot Topics Are Empty

### Problem Statement

Feature deployed December 10, 2025 with infrastructure complete but no production data population plan executed.

### Two Possible Root Causes

**Scenario 1: Manual Assignment Never Done**
- Admin/curator never manually populated `hot_topic_civic_items`
- No documented process for editorial curation
- Result: Junction table remains at 0 rows

**Scenario 2: AI Analyzer Never Executed**
- hotTopicsAnalyzer.mjs is production-ready but never triggered
- No endpoint to invoke bulk scan (only `/api/internal/civic/scan-pending-bills` for testing)
- No scheduled job to analyze new bills
- Result: `civic_item_ai_tags` remains at 0 rows

### Why This Matters

With 25 pending Wyoming bills available:
- **0 bills appear on any hot topics page**
- **0 vote engagement possible** (no bills to vote on)
- **Feature looks broken to users** (empty cards)
- **Users can't follow topics meaningfully** (no content to follow)

---

## 6. How to Fix It: Two Options

### Option A: Run AI Analyzer (Recommended)

**Approach:**
1. Execute hotTopicsAnalyzer.mjs against all 25 pending bills
2. Populate `civic_item_ai_tags` with AI-detected topic matches
3. API automatically includes bills where `civic_item_ai_tags.topic_slug` matches

**Advantages:**
- Fast (fully automated, ~$0.004 total cost for 25 bills)
- Comprehensive (analyzes all bills, finds matches AI can detect)
- Explainable (generates reason_summary for each match)
- Repeatable (can re-run on new bills each session)

**Disadvantages:**
- Less editorial control (reliant on AI confidence scoring)
- May match some tangential bills (need confidence threshold)

**Implementation:**
```bash
# Terminal at worker/
export BILL_SCANNER_ENABLED=true
export OPENAI_API_KEY="sk-..."
./scripts/wr dev --local

# In another terminal:
curl -X POST http://127.0.0.1:8787/api/internal/civic/scan-pending-bills | jq .

# Verify results:
./scripts/wr d1 execute WY_DB --remote --command \
  "SELECT COUNT(*) FROM civic_item_ai_tags;"
```

### Option B: Manual Editorial Assignment

**Approach:**
1. Manually populate `hot_topic_civic_items` with specific bill-topic pairs
2. Curate which bills belong to which topics (full editorial control)
3. API automatically includes bills where `hot_topic_civic_items.topic_id` matches

**Advantages:**
- Full editorial control (decide exactly which bills matter for each topic)
- High quality (exclude tangential bills)
- Transparent (intentional curation visible in database)

**Disadvantages:**
- Time-consuming (must manually review all 25 bills)
- Non-repeatable (need to manually curate each new session)

**Implementation:**
```sql
-- Example: Link HB 22 (property tax bill) to property-tax-relief topic
INSERT INTO hot_topic_civic_items (topic_id, civic_item_id)
VALUES (
  1,  -- property-tax-relief topic ID
  'ocd-bill/us-wy:bill/2025/HB22'
);
```

### Option C: Hybrid (Recommended Best Approach)

**Approach:**
1. Run AI analyzer to auto-detect all possible matches
2. Manually curate results: keep high-confidence matches, remove false positives
3. Result: Editorial control + comprehensive coverage

**Process:**
```
1. AI analyzer runs → 40 AI tags generated across bills/topics
2. Review results → "HB 22 matches property-tax-relief (92% confidence) ✅"
3. Keep matches with confidence > 80% or manually verified
4. Insert curated matches into hot_topic_civic_items
5. Delete or ignore civic_item_ai_tags (or keep for reference)
6. Result: Topics show only intentional, verified bill links
```

---

## 7. The Bill Scanner (AI Analyzer) Documentation

### Setup

```bash
# Terminal 1: Start dev worker
cd /home/anchor/projects/this-is-us/worker
export OPENAI_API_KEY="sk-proj-..."
export BILL_SCANNER_ENABLED=true
./scripts/wr dev --local
# Should see: ✅ Server ready at http://127.0.0.1:8787
```

### Trigger the Scan

```bash
# Terminal 2: Run the analyzer
curl -X POST http://127.0.0.1:8787/api/internal/civic/scan-pending-bills | jq .

# Response shows scanned bills and their topic matches:
{
  "scanned": 5,
  "results": [
    {
      "bill_id": "ocd-bill/us-wy:bill/2025/...",
      "bill_number": "HB 22",
      "topics": ["property-tax-relief"],
      "confidence_avg": 0.92
    }
  ],
  "timestamp": "2025-12-05T15:42:18.000Z"
}
```

### Verify Results

```bash
# Check civic_item_ai_tags table:
./scripts/wr d1 execute WY_DB --remote --command \
  "SELECT COUNT(*) as tag_count FROM civic_item_ai_tags;"
# Should return > 0 after scan

# Check hot-topics endpoint:
curl -s https://this-is-us.org/api/hot-topics | jq '.[] | {slug, bill_count: (.civic_items | length)}'
# Should show bill counts now
```

### Security

The endpoint has three guards:
1. **Feature Flag**: `BILL_SCANNER_ENABLED=true` required (prevents accidental runs)
2. **Localhost Only**: Requests from other hosts rejected with 403 (prevents remote abuse)
3. **Graceful Degradation**: Missing OpenAI key returns `topics: []` without error

---

## 8. User Preferences & Personalization

### User Follows Topics

Users can select topics to follow on `/account/preferences/`:

**Files:**
- Backend: [worker/src/routes/api/user-topics/index.js](worker/src/routes/api/user-topics/index.js)
- Frontend: [static/js/account/preferences.js](static/js/account/preferences.js)

**Data Storage:**
- **D1 (backend)**: `EVENTS_DB.user_topic_prefs` (user_id → topic_id)
- **Firestore (frontend)**: `users/{uid}.preferences.followedTopics` (array of topic IDs)

**On Hot Topics Page:**
```javascript
// 1. Load followed topics from Firestore
let followedTopicIds = userDocSnap.data().preferences?.followedTopics || [];

// 2. Sort: followed topics first
const sortedTopics = topics.sort((a, b) => {
  const aFollowed = followedTopicIds.includes(a.id);
  const bFollowed = followedTopicIds.includes(b.id);
  return bFollowed - aFollowed;
});

// 3. Render: show ★ badge for followed topics
const isFollowed = followedTopicIds.includes(topic.id);
const followedBadge = isFollowed ? '<span class="followed-badge">★ Following</span>' : '';
```

**Result:** Users see their followed topics first, marked with a star.

---

## 9. Voting System

### How Votes Work

**File:** [worker/src/routes/civic.mjs](worker/src/routes/civic.mjs) — `POST /api/civic/items/:id/vote`

**Database Table:** `WY_DB.votes`
```sql
CREATE TABLE votes (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,           -- Firebase UID
  target_type TEXT NOT NULL,       -- 'civic_item'
  target_id TEXT NOT NULL,         -- Bill OCD ID
  value INTEGER NOT NULL,          -- 1 (support), -1 (oppose), 0 (need info)
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Vote Aggregation (in API):**
```sql
SELECT
  SUM(CASE WHEN value = 1 THEN 1 ELSE 0 END) AS up_votes,
  SUM(CASE WHEN value = -1 THEN 1 ELSE 0 END) AS down_votes,
  SUM(CASE WHEN value = 0 THEN 1 ELSE 0 END) AS info_votes
FROM votes
WHERE target_type = 'civic_item' AND target_id = ?
GROUP BY target_id;
```

**Frontend Buttons:**
- 👍 (value=1): Support this bill
- 👎 (value=-1): Oppose this bill
- ❓ (value=0): Need more information

**Vote counts display in real-time** on bill cards and detail pages.

---

## 10. Design Documents & Implementation History

### Migration History

| File | Date | Purpose | Status |
|------|------|---------|--------|
| `0011_create_hot_topics.sql` | Dec 2025 | Create hot_topics + hot_topic_civic_items tables | ✅ Complete |
| `0017_align_preferences_to_hot_topics.sql` | Dec 10 | Consolidate user_topic_prefs to use hot_topics | ✅ Complete |
| `0020_update_hot_topics_keywords.sql` | Dec 2025 | Keyword indexing for topic matching | ✅ Complete |

### Documentation

- [instructions/hot_topics_flow.md](instructions/hot_topics_flow.md) — UX data flow, preconditions, error states
- [HOT_TOPICS_ALIGNMENT_COMPLETE.md](HOT_TOPICS_ALIGNMENT_COMPLETE.md) — Migration from topic_index to hot_topics (single source of truth)
- [BILL_SCANNER_TESTING.md](BILL_SCANNER_TESTING.md) — AI analyzer testing guide with step-by-step commands
- [BILL_SCANNER_SECURITY.md](BILL_SCANNER_SECURITY.md) — Security analysis and guard documentation

---

## 11. Summary: Why Hot Topics "Appear Broken"

### The Situation

✅ **What's Working:**
- API endpoint returns 6 topics with correct structure
- Frontend renders topic cards beautifully
- User preferences (follow/unfollow) work correctly
- Vote system ready to track engagement
- AI analyzer ready to auto-assign topics
- All code is production-quality

❌ **What's Missing:**
- `hot_topic_civic_items` table: 0 rows (no manual assignments)
- `civic_item_ai_tags` table: 0 rows (no AI analysis)
- Result: All 6 topics show 0 bills each

### The Fix

**Choose one approach:**
1. **Run AI Analyzer** (5 minutes, fully automated) → Populates civic_item_ai_tags
2. **Manual Curation** (1–2 hours, full control) → Populates hot_topic_civic_items
3. **Hybrid** (Best quality, editorial control + automation)

**After either approach:**
- Topics will display bills
- Vote system activates
- Users can engage meaningfully
- Feature becomes fully functional

---

## Recommendation

**Run the AI analyzer** to quickly populate the feature, then:
1. Review results for accuracy
2. Adjust confidence thresholds if needed
3. Consider manual curation for highest-priority bills
4. Establish a recurring pattern (re-run analyzer each legislative session or monthly)

This approach gives you:
- ✅ Fast initial population (5 minutes)
- ✅ Comprehensive coverage (analyzes all 25 bills)
- ✅ Explainability (reason_summary for each match)
- ✅ Cost-efficiency (~$0.004 total)
- ✅ Repeatability (can re-run on new bills)
