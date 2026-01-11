# This Is Us – Comprehensive Project Snapshot (2025-12-06)

## Executive Summary

**This Is Us** is a Hugo + Cloudflare Workers civic engagement platform that makes Wyoming legislation accessible to everyday citizens. It combines **static content delivery** (Hugo) with **real-time data processing** (Workers + OpenAI) to surface bills, explain them in plain language, connect them to citizen-relevant topics, and aggregate voting feedback.

### Current State: **Functional Core with Data-Driven Enhancements**
- ✅ **Two operational citizen-facing tools**: Hot Topics (6 canonical issues) and Pending Bills (AI-enriched, filterable)
- ✅ **AI-generated content**: OpenAI creates summaries & topic matches with confidence scoring (0.85–0.95 typical)
- ✅ **Real-time voting**: Thumbs up/down/info buttons with instant aggregation
- ✅ **Topic-bill bidirectional linking**: Navigate between topics and bills seamlessly
- ⚠️ **Data dependency**: Quality depends on OpenStates sync frequency (currently manual) and AI scan coverage
- ⚠️ **Auth gaps**: Voting without strict authentication (relies on client-side `currentUser.uid`)

### Core Problem Solved
Wyoming residents struggle to understand pending legislation and its impact on their lives. The project bridges this by:
1. **Aggregating bills** from OpenStates API into searchable local database
2. **Generating citizen-friendly explanations** via OpenAI (avoiding legal jargon)
3. **Connecting bills to relatable topics** (property taxes, water rights, education) so users know *why* a bill matters
4. **Enabling feedback** through voting to identify consensus and engagement patterns

---

## Architecture Overview

```
OpenStates API (Wyoming bills)
    ↓
    [openStatesSync.mjs] (normalize, deduplicate)
    ↓
WY_DB (civic_items table)
    ↓
    [hotTopicsAnalyzer.mjs + billSummaryAnalyzer.mjs] (OpenAI gpt-4o)
    ↓
OpenAI Analysis Results
    ↓
    [saveHotTopicAnalysis, saveBillSummary] (insert into D1)
    ↓
WY_DB + EVENTS_DB (enriched data)
    ↓
Worker APIs (/api/civic/pending-bills-with-topics, /api/hot-topics, etc.)
    ↓
Hugo Pages & JavaScript Rendering
    ↓
Citizens (browser, interactive experience)
```

**Key insight**: This is not a static website—it's a **data processing + ranking + communication system** that uses AI to translate legislation and votes to identify community priorities.

---

## What's Working Well ✅

### Core Functionality
1. **End-to-end pipeline** works reliably: Data flows from OpenStates → WY_DB → OpenAI → APIs → UI with minimal latency
2. **AI content quality**: Summaries readable & citizen-friendly; topic matches accurate (confidence 0.85–0.95)
3. **Filtering** (topic, session, chamber, status) all work correctly with intuitive dropdowns
4. **Real-time voting**: Vote aggregation instant; counts update without page reload
5. **Responsive design**: Bill cards adapt to mobile (single column) and desktop (multi-column grid)
6. **Copy-to-clipboard**: Prompts copy seamlessly with visual feedback; UX polished

### Data Quality (With Test Data)
- 5 seeded Wyoming bills with full AI analysis
- API responses consistent with all required fields
- Topic metadata (badges, images, CTAs) well-designed
- Vote counts accurate and real-time

---

## Critical Issues & Required Improvements

### 🔴 High Priority: UX/UI Impact (Blocks User Adoption)

#### 1. **Empty State Ambiguity** – User Confusion on Load
**Current problem**: Landing on `/civic/pending/` shows blank page. Users can't tell if:
- Page is loading (should wait)
- No bills exist (should try filters)
- API failed (should refresh)

**Impact**: Users abandon page; assume it's broken

**Solution**:
```
Loading state: Skeleton cards (animated placeholders) + "Fetching bills..."
Empty match: "No bills matched those filters. Try clearing filters or browse [Hot Topics](/)."
Error (API 500): Red banner: "Error loading bills. Please refresh. [Details]"
```

#### 2. **Topic Filter Usability** – Hard to Discover & Use
**Current problem**: Dropdown is compact; users don't know what topics exist until opening dropdown.

**Impact**: Filter underutilized; missed discovery opportunity

**Solution**:
- Replace dropdown with **clickable topic chips** (like GitHub issue filters)
- Each chip shows: badge + title + bill count
  - Example: `[🏠 Property Taxes (23)]` `[💧 Water Rights (12)]`
- Highlight active filter with colored border
- Add "Clear all filters" button if any filter active
- Show filter counts: "23 bills match property tax concerns"

#### 3. **Vote Affordance & Persistence** – Unclear & Lost on Navigation
**Current problem**:
- Vote buttons (👍/👎/❓) small & not obviously interactive
- No feedback when vote submitted (silent network call)
- User vote lost when toggling filters or reloading
- No indication that you're logged in

**Impact**: Voting underutilized; users frustrate when vote disappears

**Solution**:
```javascript
// Show login state at top of page
"Logged in as anchor@example.com" (builds trust)

// After voting, show feedback
Button state changes: "👍 Vote recorded ✓" (stays for 1–2 seconds)
Skeleton loader while request in flight

// Persist votes locally
localStorage.setItem('vote_' + billId, 'up')
On page load, highlight your previous votes with colored border

// Show you voted
bill.yourVote = JSON.parse(localStorage.getItem('vote_' + billId))
If yourVote === 'up', render: <button style="border: 3px solid #10b981">👍 23</button>
```

#### 4. **Confidence Score Unexplained** – No Context for AI Matches
**Current problem**: Confidence badge (0.88, 0.92) present but no explanation. Users don't understand why a bill matched.

**Impact**: Users skeptical of AI results; miss opportunity to learn why bill is relevant

**Solution**:
```html
<!-- Add info icon with tooltip -->
<span class="text-xs text-gray-500">
  confidence <span title="AI matched this bill with 88% confidence">0.88 ⓘ</span>
</span>

<!-- Show trigger snippet as evidence (already in data!) -->
<div class="snippet">"...annual property tax increase must not exceed 3% or inflation..."</div>

<!-- Link to topic detail for full context -->
<a href="/hot-topics/property-tax-relief/">Learn more about this topic</a>
```

#### 5. **Summary Trust & Freshness** – No Transparency
**Current problem**: AI-generated summaries appear with no indication of freshness or source. In civic context, this feels risky.

**Impact**: Users distrust summaries; may not use them in decision-making

**Solution**:
```html
<div class="summary-block">
  <div class="summary-label">Plain summary <span class="badge">Generated by AI</span></div>
  <div class="summary-text">This bill limits how much your property taxes...</div>
  <div class="summary-meta">
    <small>🤖 Generated on Dec 5, 2025</small>
    <a href="[bill_text_url]" target="_blank">View full bill text →</a>
  </div>
</div>
```

#### 6. **Navigation & Discoverability** – Civic Tools Hidden
**Current problem**: Tools tucked at `/hot-topics/` and `/civic/pending/`. No global nav link. Users only discover via direct URL.

**Impact**: Low discoverability; many residents never find the tools

**Solution**:
- Add **"Civic Watch" section to global nav**:
  ```
  Main Nav
    ├── Civic Watch
    │   ├── Hot Topics (trending issues)
    │   ├── Pending Bills (by status)
    │   └── Town Halls (future)
    └── ...
  ```
- On Hot Topics page, add CTA under each topic:
  `"See all 23 pending bills about [Property Taxes]"` → links to `/civic/pending/?topic_slug=property-tax-relief`
- Add **breadcrumbs** on detail pages:
  `Hot Topics > Property Taxes > HB 22`

### 🟡 Medium Priority: Data & Performance

#### 1. **OpenStates Sync Not Automated** – Stale Data
**Current problem**: Bills static until developer manually hits `/api/dev/openstates/sync`. Production data could be weeks old.

**Impact**: Residents see outdated bills; miss new legislation

**Solution**: Deploy **scheduled Worker cron job** (daily, 8 AM UTC)
```javascript
// ./scripts/wr.toml
[[triggers.crons]]
cron = "0 8 * * *"

// worker/src/index.mjs
export default {
  async scheduled(event, env) {
    console.log("Starting daily sync...");
    const bills = await openStatesSync.fetchBills(env, "2025");
    await openStatesSync.upsertCivicItems(env, bills);
    await civicScan.scanPendingBills(env); // Trigger AI analysis for new bills
    console.log("Sync complete");
  }
}
```

#### 2. **AI Analysis Not Automated** – Manual Triggering Required
**Current problem**: Topic matching & summaries require manual endpoint calls.

**Solution**: Extend cron job to:
- Call `analyzeBillForHotTopics()` for all bills where `civic_item_ai_tags` is empty
- Call `analyzeBillSummary()` for bills where `ai_summary IS NULL`
- Add logging: `"Analyzed 47 bills; 38 matched topics; 42 summaries generated"`
- Add alerting if OpenAI quota hit

#### 3. **Confidence Threshold Hard-Coded** – Inflexible
**Current problem**: 0.5 confidence threshold hard-coded in `pendingBills.mjs`; changing requires redeploy.

**Solution**: Move to environment variable
```bash
# .env
TOPIC_CONFIDENCE_THRESHOLD=0.6
```
Allows ops to adjust without code change during pilot.

#### 4. **Vote Spam Prevention Missing** – Data Integrity Risk
**Current problem**: No auth check; same user can vote multiple times by spoofing `window.currentUser.uid` in browser console.

**Impact**: Vote counts untrustworthy; could be manipulated in production

**Solution**: Implement **Firebase auth validation** on Worker
```javascript
// Before allowing vote:
const idToken = req.headers.get('authorization')?.split(' ')[1];
const decodedToken = await admin.auth().verifyIdToken(idToken);
const userId = decodedToken.uid; // Trust verified token, not request body

// Enforce one vote per user per bill:
// INSERT OR REPLACE INTO votes (user_id, target_id, value) VALUES (?, ?, ?)
// This updates if user already voted, inserts if new
```

### 🟡 Medium Priority: Security

| Issue | Severity | Fix |
|-------|----------|-----|
| Vote user_id not validated | **High** | Require Firebase auth token; validate on Worker |
| OpenStates sync endpoint unguarded | **High** | Add `?auth_token=...` param or restrict to localhost |
| Test endpoints exposed in prod | **Medium** | Move `/api/internal/*` behind auth or feature flag |
| No CORS restriction | **Low** | Add `Access-Control-Allow-Origin` whitelist |

---

## UX/UI Improvement Roadmap

### Phase 1: Trust & Clarity (Week 1 – Most Important)
- [ ] Add skeleton loader on pending bills page (5 fake bill cards, animated)
- [ ] Implement vote feedback: "✅ Vote recorded" (1–2 seconds)
- [ ] Add "Generated by AI" badge to summaries
- [ ] Add confidence tooltip: "88% match confidence. Why?" → trigger snippet
- [ ] Add "View full bill text" external link
- [ ] Show "Logged in as [email]" at top of page

### Phase 2: Navigation & Discovery (Week 2)
- [ ] Replace topic dropdown with clickable chips
- [ ] Add "Civic Watch" to global nav
- [ ] Add topic filter bill count badges
- [ ] Add breadcrumbs on detail pages
- [ ] Add CTA from Hot Topics → Pending Bills filtered view

### Phase 3: Persistence & Personalization (Week 3)
- [ ] Persist user votes in localStorage
- [ ] Highlight user's own votes visually (colored border, highlight)
- [ ] Save filter preferences (localStorage)
- [ ] Add "Your votes" section showing bills you've engaged with

### Phase 4: Polish & Accessibility (Week 4)
- [ ] WCAG 2.1 AA compliance (keyboard nav, aria labels, color contrast)
- [ ] Mobile filter panel (slide-out drawer)
- [ ] Adequate touch targets (44x44px minimum)
- [ ] Reduce CSS code duplication (vote styles, card styles)
- [ ] Add skeleton loader to hot topics pages

---

## Technical Validation Checklist

### API Layer
- [ ] `/api/civic/pending-bills-with-topics?topic_slug=property-tax-relief` returns only property tax bills (count > 0)
- [ ] Topic filter combined with session/chamber filters works correctly (AND logic)
- [ ] Vote POST increments count; persists on page refresh
- [ ] OpenStates sync creates new bills; updates existing (upsert logic works)
- [ ] AI confidence scores all in 0–1 range; no NULL values
- [ ] Empty response when no bills match filters; returns `{results: []}` not error 500

### Client-Side (Browser)
- [ ] Page loads without JavaScript errors (DevTools console clean)
- [ ] Filters update bill list in real-time (no page reload needed)
- [ ] Copy-to-clipboard works on Chrome, Firefox, Safari, Edge
- [ ] Mobile: filters don't overflow; cards stack correctly; readable font size
- [ ] Keyboard: Can tab through filters & vote buttons; all interactive elements focusable
- [ ] Accessibility: Vote buttons have aria-labels; confidence badge has title/tooltip

### Data Quality
- [ ] 5+ test bills present in WY_DB with full AI analysis
- [ ] Each bill has 1–3 topic matches with confidence >= 0.5
- [ ] AI summaries grammatically correct, no legalese
- [ ] Vote counts realistic (no negative votes, no duplicate votes per user)
- [ ] Hot topics list exactly 6 items

---

## Civic Watch Front Door

**Status**: ✅ Production ready (v1 launched December 6, 2025)

The **Civic Watch front door** is the main entry point to Wyoming civic engagement. It displays three preview cards:

### Architecture Overview

| Component | File | Purpose |
|-----------|------|---------|
| **Content** | `content/civic/watch.md` | Hugo markdown file (minimal metadata) |
| **Template** | `layouts/civic/watch.html` | Renders 3-card layout with intro copy |
| **Script** | `static/js/civic/watch.js` | Fetches API data, renders preview cards |
| **Tests** | `__tests__/civic-watch.test.js` | Jest tests for rendering functions |
| **Menu** | `config.toml` | Nav entry at weight 7 |

### Three Preview Cards

#### 1. Hot Topics Card
- **Title**: "Hot Topics"
- **Subtitle**: "Six core issues shaping Wyoming conversations."
- **Data source**: `GET /api/hot-topics`
- **Preview**: Shows up to 3 topics with title, bill count, and summary
- **CTA**: "View topics" → `/hot-topics/`

#### 2. Pending Bills Card
- **Title**: "Pending Bills"
- **Subtitle**: "Bills in Cheyenne that could affect daily life."
- **Data source**: `GET /api/civic/pending-bills-with-topics`
- **Preview**: Shows up to 3 bills with number, title, status, and session
- **CTA**: "View bills" → `/civic/pending/`

#### 3. County Town Halls Card
- **Title**: "County Town Halls"
- **Subtitle**: "County-level conversations and community input."
- **Data source**: `GET /api/townhall/posts?limit=3`
- **Preview**: Shows up to 3 recent town hall threads with title and created date
- **CTA**: "Choose your county" → `/townhall/`
- **Empty state**: "No county threads yet. Check back soon."

### Page Load Flow

1. Hugo renders `layouts/civic/watch.html` with 3 empty card containers (IDs: `cw-hot-topics-preview`, `cw-pending-preview`, `cw-townhall-preview`)
2. `static/js/civic/watch.js` triggers on `DOMContentLoaded` event
3. Calls `loadCivicWatch()` which fetches all 3 APIs in parallel via `Promise.all()`
4. Each API response is rendered into its respective card container
5. Error states show red error messages if any API fails
6. Page remains interactive; missing data doesn't block other cards

### Data Handling & Resilience

The script handles multiple response formats for forward compatibility:

```javascript
// Accepts both direct arrays and {results: [...]} wrapper:
const topics = Array.isArray(topicsData) ? topicsData : topicsData.results || [];
const bills = Array.isArray(billsData) ? billsData : billsData.results || [];
const posts = Array.isArray(postsData) ? postsData : postsData.results || postsData;
```

This allows:
- `/api/hot-topics` → `Array` or `{results: Array}`
- `/api/civic/pending-bills-with-topics` → `Array` or `{results: Array}`
- `/api/townhall/posts` → `Array` (current) or `{results: Array}` (future)

### Testing

**Jest unit tests** (`__tests__/civic-watch.test.js`):
- ✅ `renderHotTopics()` – Verifies title, civic_items count, summary display
- ✅ `renderPending()` – Verifies bill_number, title, status, session display
- ✅ `renderTownhall()` – Verifies title, created_at display, empty state fallback

Run tests:
```bash
npm test -- __tests__/civic-watch.test.js
# Expected: 3 passed
```

**Manual testing checklist**:
- [ ] Page loads without console errors
- [ ] All 3 cards render with real API data
- [ ] Cards show "Loading..." initially, then populate
- [ ] Clicking CTA buttons navigates to correct pages
- [ ] Responsive design: 3 columns on desktop, 1 on mobile
- [ ] Error messages appear if any API fails

---

## Civic Watch Data Model (Phase 1 – Current Production Schema)

This section is the **single source of truth** for Civic Watch database structure. All migrations have been applied to local and remote databases.

### WY_DB Tables (Wyoming Civic Data)

#### 1. civic_items – Bills & Ballot Measures
**Migration**: `worker/migrations_wy/0006_create_civic_items.sql`  
**Status**: ✅ Applied (Production Ready)

```sql
CREATE TABLE civic_items (
  id TEXT PRIMARY KEY,                    -- OpenStates OCD ID or composite key
  kind TEXT NOT NULL,                     -- "bill", "ballot_measure", "resolution"
  source TEXT NOT NULL,                   -- "openstates"
  level TEXT NOT NULL,                    -- "state", "statewide"
  jurisdiction_key TEXT NOT NULL,         -- "WY" (Wyoming)
  bill_number TEXT,                       -- "HB 22", "SF 101"
  title TEXT NOT NULL,                    -- Full bill title
  summary TEXT,                           -- OpenStates summary (often legal jargon)
  status TEXT NOT NULL,                   -- "introduced", "in_committee", "pending_vote", "signed", "vetoed"
  legislative_session TEXT,               -- "2025"
  chamber TEXT,                           -- "house", "senate"
  ballot_type TEXT,
  measure_code TEXT,
  election_date TEXT,
  external_ref_id TEXT,                   -- OpenStates ID
  external_url TEXT,                      -- Link to OpenStates (official source)
  text_url TEXT,                          -- Direct link to bill text PDF/HTML
  category TEXT,                          -- "taxation", "education", "water", etc.
  subject_tags TEXT,                      -- JSON array or comma-delimited topics
  location_label TEXT,
  introduced_at TEXT,                     -- ISO timestamp
  last_action TEXT,                       -- Description of last action
  last_action_date TEXT,                  -- ISO timestamp
  created_at TEXT NOT NULL,               -- When bill was added to DB
  updated_at TEXT NOT NULL,               -- When bill metadata was last synced
  up_votes INTEGER NOT NULL DEFAULT 0,    -- Aggregate of community support votes
  down_votes INTEGER NOT NULL DEFAULT 0,  -- Aggregate of community oppose votes
  -- AI Summary Fields (Migration 0011)
  ai_summary TEXT,                        -- 1–2 sentence plain-language summary
  ai_key_points TEXT,                     -- JSON array of 2–3 key impacts
  ai_summary_version TEXT,                -- Hash/version to detect when to refresh
  ai_summary_generated_at TEXT            -- ISO timestamp; NULL if not yet summarized
);

CREATE INDEX idx_civic_items_scope ON civic_items(level, jurisdiction_key);
CREATE INDEX idx_civic_items_kind_status ON civic_items(kind, status);
CREATE INDEX idx_civic_items_category ON civic_items(category);
```

**Key insights**:
- `ai_summary_generated_at` is `NULL` until first AI summary generated (cache indicator)
- Vote counts are **denormalized** here for query speed (sourced from `votes` table)
- Subject tags can be JSON or CSV; parser handles both (`parseSubjectTags()`)
- Bills are created from OpenStates API; updated when status changes

---

#### 2. civic_item_ai_tags – Topic-Bill Matches
**Migrations**: `worker/migrations_wy/0009_add_civic_item_ai_tags.sql` + `0010_add_reason_summary_to_civic_item_ai_tags.sql`  
**Status**: ✅ Applied (Production Ready)

```sql
CREATE TABLE civic_item_ai_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL,                  -- FK to civic_items.id
  topic_slug TEXT NOT NULL,               -- e.g., "property-tax-relief", "water-rights"
  confidence REAL NOT NULL,               -- 0.0–1.0 confidence score
  trigger_snippet TEXT,                   -- Quote from bill that triggered match
  reason_summary TEXT,                    -- Plain-language explanation (Migration 0010)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX civic_item_ai_tags_item_topic ON civic_item_ai_tags (item_id, topic_slug);
```

**Key insights**:
- **One record per (bill, topic) pair** – a bill can match multiple topics
- `confidence >= 0.5` is API-level filter (TOPIC_CONFIDENCE_THRESHOLD)
- `trigger_snippet` provides transparency: "Why did the AI think this was relevant?"
- `reason_summary` (Migration 0010) explains in citizen-friendly language: e.g., "Bill caps property tax increases at 3% annual"
- Data flows from `billSummaryAnalyzer.mjs` + `hotTopicsAnalyzer.mjs`

---

#### 3. votes – Community Reactions & Engagement
**Migration**: `worker/migrations_wy/0008_create_votes.sql`  
**Status**: ✅ Applied (Production Ready)

```sql
CREATE TABLE votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,                  -- Firebase UID (or window.currentUser.uid in dev)
  target_type TEXT NOT NULL,              -- "civic_item", "idea" (future), "comment" (future)
  target_id TEXT NOT NULL,                -- FK to civic_items.id (when target_type='civic_item')
  value INTEGER NOT NULL,                 -- 1 (support), -1 (oppose), 0 (info/unclear)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, target_type, target_id)  -- One vote per user per bill
);

CREATE INDEX idx_votes_target ON votes(target_type, target_id);
```

**Key insights**:
- **One vote per user per bill** enforced by UNIQUE constraint
- Voting is **unverified** in current implementation (⚠️ Security gap: needs Firebase auth)
- Queries aggregate: `SUM(CASE WHEN value=1 THEN 1 ELSE 0 END) as up_votes`
- Vote counts are cached in `civic_items` table for query speed

---

#### 4. user_ideas – Community Ideas (Future)
**Migration**: `worker/migrations_wy/0007_create_user_ideas.sql`  
**Status**: ✅ Applied (Not yet used)

```sql
CREATE TABLE user_ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT REFERENCES civic_items(id),  -- Optional: tie idea to a bill
  author_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  up_votes INTEGER NOT NULL DEFAULT 0,
  down_votes INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_user_ideas_item ON user_ideas(item_id);
CREATE INDEX idx_user_ideas_author ON user_ideas(author_user_id);
```

**Note**: Reserved for Phase 2+ (Ideas Network). Current code doesn't use this table.

---

### EVENTS_DB Tables (Civic Engagement Infrastructure)

#### 1. hot_topics – Canonical Topic Definitions
**Migration**: `worker/migrations/0013_migrate_hot_topics_schema.sql`  
**Status**: ✅ Applied (6 topics seeded)

```sql
CREATE TABLE hot_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,              -- "property-tax-relief", "water-rights", etc.
  title TEXT NOT NULL,                    -- "Property Tax Relief"
  summary TEXT,                           -- Full description
  badge TEXT,                             -- Emoji or short label: "🏠 Taxes", "💧 Water"
  image_url TEXT,                         -- Featured image for topic card
  cta_label TEXT,                         -- Button text: "See current proposals"
  cta_url TEXT,                           -- Destination: "/hot-topics/property-tax-relief"
  priority INTEGER DEFAULT 100,           -- Sort order (lower = higher priority)
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6 canonical topics (user-tested in Wyoming):
INSERT INTO hot_topics (slug, title, priority) VALUES
  ('property-tax-relief', 'Property Tax Relief', 10),
  ('water-rights', 'Water Rights & Drought Planning', 20),
  ('education-funding', 'Education Funding & Local Control', 30),
  ('energy-permitting', 'Energy Permitting & Grid Reliability', 40),
  ('public-safety-fentanyl', 'Public Safety & Fentanyl Response', 50),
  ('housing-land-use', 'Housing & Land Use', 60);
```

**Key insights**:
- Exactly **6 topics** (curated, not auto-generated)
- `slug` is the unique identifier (matches `topic_slug` in `civic_item_ai_tags`)
- Used to render Hot Topics home page and filter chips on Pending Bills
- Priority determines card order on home page

---

#### 2. hot_topic_civic_items – Cross-Database Bill-Topic Links
**Migrations**: `worker/migrations/0011_create_hot_topics.sql` + `0012_add_match_metadata_to_hot_topic_civic_items.sql` + `0014_migrate_hot_topic_civic_items_schema.sql`  
**Status**: ✅ Applied (Production Ready)

```sql
CREATE TABLE hot_topic_civic_items (
  topic_id INTEGER NOT NULL,              -- FK to hot_topics.id (EVENTS_DB)
  civic_item_id INTEGER NOT NULL,         -- FK to civic_items.id (WY_DB) – cross-DB link
  match_score REAL,                       -- Confidence score from AI analysis
  matched_terms_json TEXT,                -- JSON array of matched keywords
  excerpt TEXT,                           -- Relevant excerpt from bill text
  PRIMARY KEY (topic_id, civic_item_id)
);

CREATE INDEX idx_hot_topic_matches_topic_score ON hot_topic_civic_items(topic_id, match_score DESC);
```

**Key insights**:
- **Cross-database link**: `civic_item_id` references `WY_DB.civic_items.id`
- **Redundant with `civic_item_ai_tags`** (for performance caching)
- Fetches bills for a topic: `SELECT * FROM hot_topic_civic_items WHERE topic_id = ?`
- Then uses `civic_item_id` to fetch full bill details from WY_DB

---

#### 3. townhall_posts – Community Town Hall Submissions
**Schema**: `data/0001_create_townhall_posts.sql`  
**Status**: ✅ Applied (EVENTS_DB table for community submissions)

```sql
CREATE TABLE IF NOT EXISTS townhall_posts (
  id TEXT PRIMARY KEY,                    -- Unique identifier for submission
  user_id TEXT NOT NULL,                  -- Firebase UID or anonymous identifier
  title TEXT NOT NULL,                    -- Submission title/topic
  prompt TEXT,                            -- The actual comment or question text
  created_at TEXT NOT NULL,               -- ISO 8601 timestamp
  r2_key TEXT,                            -- Cloudflare R2 key for PDF/media attachment
  file_size INTEGER,                      -- Size in bytes
  expires_at TEXT,                        -- ISO 8601 expiration date for attachment
  city TEXT,                              -- County seat or city name (for location context)
  state TEXT                              -- State code (e.g., "WY")
);
```

**Key insights**:
- **Append-only log** of community submissions from town halls or online forms
- `title` and `prompt` are user-provided text (may need content moderation)
- `r2_key` allows attaching PDFs or media (e.g., photos, recordings)
- `expires_at` implements data retention policy (auto-delete after N months)
- No structured voting yet; future phases will add reactions or thread nesting
- Indexed by `created_at` for reverse-chronological listing (most recent first)

---

## API Endpoints & Response Formats

### Town Hall Preview API
**Endpoint**: `GET /api/townhall/posts`  
**Handler**: `worker/src/townhall/listPosts.js` → `handleListTownhallPosts()`  
**Purpose**: Fetch recent town hall submissions for the Civic Watch front door preview  
**Access**: Public (no authentication required)

**Query Parameters**:
| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | integer | 3 | 10 | Maximum number of posts to return |
| `after` | ISO 8601 | — | — | Cursor: return posts created before this timestamp (for pagination) |

**Request examples**:
```bash
# Get 3 most recent posts (for Civic Watch front door)
curl "http://localhost:8787/api/townhall/posts?limit=3"

# Get 5 posts with pagination (after a specific date)
curl "http://localhost:8787/api/townhall/posts?limit=5&after=2025-12-01T00:00:00Z"

# Get all posts (up to max 10)
curl "http://localhost:8787/api/townhall/posts?limit=10"
```

**Response shape** (HTTP 200):
Wrapped in `{results: [...]}` object:

```json
{
  "results": [
    {
      "thread_id": "test-001",
      "user_id": "user_123",
      "title": "Casper Town Hall Input",
      "county_name": "Natrona County",
      "topic_slug": "property-tax-relief",
      "prompt": "This is a sample submission.",
      "created_at": "2025-05-29T12:00:00Z",
      "file_url": null,
      "file_size": null,
      "expires_at": null
    },
    {
      "thread_id": "test-002",
      "user_id": "user_456",
      "title": "Why are our property taxes going up?",
      "county_name": "Laramie County",
      "topic_slug": "property-tax-relief",
      "prompt": "We need more transparency in local government.",
      "created_at": "2025-05-29T13:30:00Z",
      "file_url": "https://example.com/api/events/pdf/sample.pdf",
      "file_size": 128004,
      "expires_at": null
    }
  ]
}
```

**Response fields**:
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `thread_id` | string | No | Unique identifier for the submission (mapped from database `id`) |
| `user_id` | string | No | Firebase UID of user who submitted the town hall input |
| `title` | string | No | User-provided title/topic for the submission |
| `county_name` | string | Yes | County name (e.g., "Natrona County") for geographic context |
| `topic_slug` | string | Yes | Topic slug (e.g., "property-tax-relief") if matched to a hot topic |
| `prompt` | string | Yes | User-provided comment or question text |
| `created_at` | ISO 8601 | No | When submission was created |
| `file_url` | URL | Yes | Link to attached PDF/media on Cloudflare R2 (if any) |
| `file_size` | integer | Yes | Size in bytes (if file attached) |
| `expires_at` | ISO 8601 | Yes | When attachment expires and is auto-deleted |

**Error responses**:
```json
// HTTP 500 – Internal server error
{
  "error": "Internal server error"
}
```

**Expected latency**:
- Local dev: <100ms (simple query)
- Production (Cloudflare D1): <200ms (with global CDN caching)

**Civic Watch Integration**:
The Civic Watch front door (`static/js/civic/watch.js`) calls this endpoint with `limit=3` to display the 3 most recent town hall submissions:

```javascript
fetch('/api/townhall/posts?limit=3')
  .then(res => res.json())
  .then(postsData => {
    // Handle wrapped response {results: [...]}
    const posts = postsData.results || [];
    renderTownhall(container, posts);
  })
  .catch(err => console.error('Town hall load error', err));
```

The `renderTownhall()` function reads these fields:
- `title` – Display as thread heading
- `county_name` – Show county context (e.g., "Natrona County")
- `created_at` – Display creation timestamp

Empty state fallback: "No county threads yet. Check back soon."

---

## Data Flow & Query Patterns

### Loading Pending Bills (with Topics)
**Endpoint**: `GET /api/civic/pending-bills-with-topics`  
**Handler**: `worker/src/routes/pendingBills.mjs` → `handlePendingBillsWithTopics()`

```sql
SELECT 
  ci.id, ci.bill_number, ci.title, ci.chamber, ci.status, 
  ci.legislative_session, ci.ai_summary, ci.ai_key_points,
  COALESCE(v.up_votes, 0) as up_votes,
  COALESCE(v.down_votes, 0) as down_votes,
  COALESCE(v.info_votes, 0) as info_votes,
  tags.topic_slug, tags.confidence, tags.trigger_snippet, tags.reason_summary
FROM civic_items ci
LEFT JOIN (
  SELECT target_id, SUM(CASE WHEN value=1 THEN 1 ELSE 0 END) as up_votes,
         SUM(CASE WHEN value=-1 THEN 1 ELSE 0 END) as down_votes,
         SUM(CASE WHEN value=0 THEN 1 ELSE 0 END) as info_votes
  FROM votes WHERE target_type='civic_item' GROUP BY target_id
) v ON v.target_id = ci.id
LEFT JOIN civic_item_ai_tags tags ON tags.item_id = ci.id AND tags.confidence >= 0.5
WHERE ci.kind='bill' AND ci.level='statewide' AND ci.jurisdiction_key='WY'
  AND ci.status IN ('introduced','in_committee','pending_vote')
ORDER BY ci.last_action_date DESC;
```

**Response shape**:
```json
{
  "results": [
    {
      "id": "ocd-bill/w1/...",
      "bill_number": "HB 22",
      "title": "Property Tax Assessment Cap",
      "chamber": "house",
      "status": "in_committee",
      "legislative_session": "2025",
      "ai_plain_summary": "This bill limits how much...",
      "ai_key_points": ["caps increases at 3%", "expands exemptions"],
      "up_votes": 42,
      "down_votes": 8,
      "info_votes": 15,
      "topic_slug": "property-tax-relief",
      "confidence": 0.92,
      "trigger_snippet": "...property tax increase must not exceed...",
      "reason_summary": "Bill explicitly caps annual increases and expands homeowner exemptions"
    }
  ]
}
```

### Checking if Summary is Fresh (Cache Logic)
**Pattern**: Before regenerating AI summary, check timestamp

```sql
SELECT ai_summary, ai_summary_generated_at FROM civic_items WHERE id = ?;
```

**Logic** (in `billSummaryAnalyzer.mjs`):
```javascript
if (bill.ai_summary_generated_at) {
  // Summary already generated; return cached version
  return { summary: bill.ai_summary, cached: true };
}
// Summary not yet generated; call OpenAI, then save
const analysis = await analyzeBillSummary(env, bill);
await saveBillSummary(env, bill.id, analysis);
```

---

## Data Population Pipeline

### 1. OpenStates Sync
**Handler**: Manually triggered (future: cron job)  
**Flow**: OpenStates API → `openStatesSync.mjs` → Upsert into `civic_items`  
**Cost**: Free (OpenStates is free API)

```bash
# Manual trigger (dev):
curl http://127.0.0.1:8787/api/dev/openstates/sync?session=2025
```

### 2. Topic Analysis (Bill Scanning)
**Handler**: `POST /api/internal/civic/scan-pending-bills`  
**Flow**: Read pending bills → OpenAI gpt-4o → Write to `civic_item_ai_tags` + `hot_topic_civic_items`  
**Cost**: ~$0.0008 per bill (~$0.08 per 100 bills)

```bash
# Manual trigger:
curl -X POST http://127.0.0.1:8787/api/internal/civic/scan-pending-bills
```

### 3. Bill Summarization
**Handler**: `POST /api/internal/civic/test-bill-summary`  
**Flow**: Load bill → OpenAI gpt-4o → Save to `civic_items.ai_summary` + `ai_key_points`  
**Cost**: ~$0.0003 per bill

```bash
# Manual trigger (example):
curl -X POST "http://127.0.0.1:8787/api/internal/civic/test-bill-summary?bill_id=ocd-bill/w1/..&save=true"
```

---

## Applied Migrations Checklist

| Migration | File | Purpose | Status |
|-----------|------|---------|--------|
| 0006 | `0006_create_civic_items.sql` | Bills table | ✅ Applied |
| 0007 | `0007_create_user_ideas.sql` | Ideas table (future) | ✅ Applied |
| 0008 | `0008_create_votes.sql` | Voting table | ✅ Applied |
| 0009 | `0009_add_civic_item_ai_tags.sql` | Topic-bill matches | ✅ Applied |
| 0010 | `0010_add_reason_summary_to_civic_item_ai_tags.sql` | Reason explanations | ✅ Applied |
| 0011 | `0011_add_ai_summary_fields_to_civic_items.sql` | Bill summaries + caching | ✅ Applied |

---

## Phase 2: Sponsors & Delegation Data Model

**Status**: 🟢 Migrations Applied (Ready for API Implementation)  
**Scope**: Bill sponsor tracking + "Your delegation" card foundation  
**Current Work**: API handlers for bill-sponsors and delegation/preview endpoints  
**Target Timeline**: API implementation in Week 2-3 of 2025 development cycle

### Phase 2 Overview

Phase 2 extends Civic Watch with **legislative relationship data** to answer:
- **"Who introduced this bill?"** → Bill sponsors with contact links
- **"How do I reach my representatives?"** → Delegation preview based on county

This foundation enables future features like:
- Automatic "contact your rep" buttons on bills matching user topics
- Delegation tracking across sessions (multi-year)
- Legislator voting history on user's priority topics

**Key Design Principle**: Keep it simple and county-based for Phase 2. Full geocoding (address → district mapping) deferred to Phase 2b if needed.

---

### Phase 2 Tables

#### 1. bill_sponsors – Track Bill Sponsors & Cosponsors
**Migration**: `worker/migrations_wy/0012_create_bill_sponsors.sql`  
**Status**: 🟢 Applied (table created in WY_DB)

```sql
CREATE TABLE bill_sponsors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  civic_item_id TEXT NOT NULL,                -- FK to civic_items(id)
  sponsor_name TEXT NOT NULL,                 -- Full legislator name: "John Smith"
  sponsor_role TEXT NOT NULL,                 -- "primary" | "cosponsor" | "committee"
  sponsor_district TEXT,                      -- "HD-23" | "SF-10" | NULL for at-large
  chamber TEXT,                               -- "house" | "senate" (denormalized for speed)
  contact_email TEXT,                         -- legislator@wylegislature.gov (if available)
  contact_phone TEXT,                         -- Legislator's office phone (if available)
  contact_website TEXT,                       -- Link to legislator profile or website
  created_at TEXT NOT NULL,                   -- ISO 8601 timestamp
  updated_at TEXT NOT NULL,                   -- ISO 8601 timestamp for amendment tracking
  FOREIGN KEY (civic_item_id) REFERENCES civic_items(id) ON DELETE CASCADE
);

CREATE INDEX idx_bill_sponsors_civic_item ON bill_sponsors(civic_item_id);
CREATE INDEX idx_bill_sponsors_sponsor_name ON bill_sponsors(sponsor_name);
CREATE INDEX idx_bill_sponsors_district ON bill_sponsors(sponsor_district);
```

**Key insights**:
- One row per sponsor-bill pair (bills can have multiple sponsors)
- Denormalized `chamber` field for fast filtering without joining `wy_legislators`
- `sponsor_role` supports future filtering ("Show me only primary sponsors")
- `FOREIGN KEY ... ON DELETE CASCADE` ensures referential integrity (delete sponsors if bill deleted)
- Indexed on `civic_item_id` for fast bill→sponsors lookups (required for bill detail cards)

---

#### 2. wy_legislators – Legislative Directory with Contact Info
**Migration**: `worker/migrations_wy/0013_create_wy_legislators.sql`  
**Status**: 🟢 Applied (table created in WY_DB)

```sql
CREATE TABLE wy_legislators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seat_id TEXT NOT NULL UNIQUE,               -- Unique legislator identifier: "H-23" | "S-10"
  name TEXT NOT NULL,                         -- Full legislator name: "John Smith"
  chamber TEXT NOT NULL,                      -- "house" | "senate"
  district_label TEXT NOT NULL,               -- Display-friendly: "House District 23"
  district_number TEXT,                       -- "23" or "10" (numeric for internal use)
  county_assignment TEXT,                     -- JSON array of counties: ["Natrona","Johnson"] (Phase 2b)
  contact_email TEXT,                         -- legislator@wylegislature.gov
  contact_phone TEXT,                         -- Legislator's office phone
  website_url TEXT,                           -- Link to legislator profile
  bio TEXT,                                   -- Short bio / party affiliation (optional)
  created_at TEXT NOT NULL,                   -- ISO 8601 timestamp
  updated_at TEXT NOT NULL,                   -- Updated when contact info changes
  legislative_session TEXT                    -- "2025" (for future multi-year tracking)
);

CREATE INDEX idx_wy_legislators_chamber_district ON wy_legislators(chamber, district_label);
CREATE INDEX idx_wy_legislators_seat_id ON wy_legislators(seat_id);
CREATE INDEX idx_wy_legislators_name ON wy_legislators(name);
```

**Key insights**:
- One row per legislator per session (enables multi-year historical tracking)
- `seat_id` is the unique identifier (e.g., "H-23"); immutable across updates
- `county_assignment` is a JSON array for flexibility (one rep might cover multiple counties)
- `district_label` is human-friendly for UI display ("House District 23" vs "H-23")
- Indexed on `(chamber, district_label)` for fast delegation lookups by position

---

### Phase 2 API Endpoints

**Status**: 🔵 Specification Complete (Implementation Ready)

The following endpoint specifications define the contract that Codex will implement in Phase 2:
- Both endpoints are **read-only** and require **no authentication**
- Both support **CORS** for public access
- Both return **JSON responses** with consistent error handling
- Phase 2 focuses on MVP scope: bill sponsors + county-based delegation preview
- Advanced features (role filters, geocoding) are documented for Phase 2b+

---

#### Endpoint 1: `/api/civic/bill-sponsors`
**Purpose**: Retrieve sponsors and cosponsors for a bill  
**Handler**: To be implemented in `worker/src/routes/billSponsors.mjs`  
**Status**: 🔵 Spec Complete (implementation in progress)

**Request**:
```
GET /api/civic/bill-sponsors?bill_id=ocd-bill%2Fus-wy-2025-HB0022&role=primary
```

**Query Parameters**:
| Parameter | Type | Default | Example | Description |
|-----------|------|---------|---------|-------------|
| `bill_id` | string | (required) | `ocd-bill/us-wy-2025-HB0022` | The civic_item_id of the bill |
| `chamber` | string | — | `house` | Optional: filter by "house" or "senate" |
| `role` | string | — | `primary` | Optional: filter by "primary", "cosponsor", or "committee" |

**Success Response (200 OK)**:
```json
{
  "bill_id": "ocd-bill/us-wy-2025-HB0022",
  "bill_number": "HB 22",
  "title": "Act relating to property tax relief",
  "sponsors": [
    {
      "id": 1,
      "name": "John Smith",
      "role": "primary",
      "chamber": "house",
      "district_label": "House District 23",
      "contact_email": "john.smith@wylegislature.gov",
      "contact_phone": "(307) 555-1234",
      "contact_website": "https://wylegislature.gov/legislators/john-smith"
    }
  ],
  "count": 1
}
```

**Empty Response (200 OK)** – No sponsors found:
```json
{
  "bill_id": "ocd-bill/us-wy-2025-HB0022",
  "bill_number": "HB 22",
  "sponsors": [],
  "count": 0,
  "note": "This bill has no recorded sponsors yet."
}
```

**Implementation notes**:
- Query: `SELECT * FROM bill_sponsors WHERE civic_item_id = ? AND (role = ? OR ?) AND (chamber = ? OR ?)`
- Expect <10 sponsors per bill (no pagination needed)
- Add CORS header for public access
- No authentication required

---

#### Endpoint 2: `/api/civic/delegation/preview`
**Purpose**: Retrieve user's state delegation (reps) based on county  
**Handler**: To be implemented in `worker/src/routes/delegation.mjs`  
**Status**: 🔵 Spec Complete (implementation ready)

**Request**:
```
GET /api/civic/delegation/preview?county=Natrona&state=WY
```

**Query Parameters**:
| Parameter | Type | Default | Example | Description |
|-----------|------|---------|---------|-------------|
| `county` | string | — | `Natrona` | Wyoming county name (case-insensitive); omit for no delegation |
| `state` | string | `WY` | `WY` | State code; currently only "WY" supported |

**Success Response (200 OK)** – County found with delegation:
```json
{
  "county": "Natrona",
  "state": "WY",
  "delegation": {
    "state_house": [
      {
        "id": 1,
        "name": "John Smith",
        "seat_id": "H-23",
        "district_label": "House District 23",
        "chamber": "house",
        "contact_email": "john.smith@wylegislature.gov",
        "contact_phone": "(307) 555-1234",
        "contact_website": "https://wylegislature.gov/legislators/john-smith"
      }
    ],
    "state_senate": [
      {
        "id": 12,
        "name": "Jane Doe",
        "seat_id": "S-10",
        "district_label": "Senate District 10",
        "chamber": "senate",
        "contact_email": "jane.doe@wylegislature.gov",
        "contact_phone": "(307) 555-5678",
        "contact_website": "https://wylegislature.gov/legislators/jane-doe"
      }
    ]
  },
  "message": "Delegation for Natrona County (2025 legislative session)",
  "matched_districts": ["H-23", "S-10"]
}
```

**No County Provided (200 OK)**:
```json
{
  "county": null,
  "state": "WY",
  "delegation": {
    "state_house": [],
    "state_senate": []
  },
  "message": "Provide ?county=YourCounty to retrieve your delegation"
}
```

**Error Response (400 Bad Request)** – Invalid county:
```json
{
  "error": "County not found",
  "county": "InvalidCounty",
  "state": "WY",
  "status": 400
}
```

**Implementation notes**:
- Query: Parse `county_assignment` JSON array; match against provided county
- Return legislators grouped by chamber for intuitive UI
- Expect 2-4 reps per county (1-2 house, 1-2 senate)
- Add CORS header for public access
- No authentication required

---

### Phase 2 Data Relationships

```
civic_items (Phase 1)
    ↓
    └─→ bill_sponsors (Phase 2)
            └─→ wy_legislators (Phase 2) – for normalization & delegation lookups
```

---

### Phase 2 Migration Checklist

- [x] Create migration `0012_create_bill_sponsors.sql` and apply locally
- [x] Create migration `0013_create_wy_legislators.sql` and apply locally
- [ ] Seed `wy_legislators` with Wyoming legislator list (~150 reps)
- [ ] Populate `wy_legislators.county_assignment` for each rep
- [ ] Seed `bill_sponsors` from current bills + OpenStates sponsor data
- [ ] Implement `handleBillSponsors()` handler in `worker/src/routes/billSponsors.mjs`
- [ ] Implement `handleDelegationPreview()` handler in `worker/src/routes/delegation.mjs`
- [ ] Add routes to `worker/src/index.mjs`
- [ ] Write Jest tests for both handlers
- [ ] Test locally with sample data
- [ ] Deploy to Cloudflare Workers

---

### Phase 2 Known Gaps & Future Extensions

1. **Geocoding (Phase 2b)**: Map user address → county → delegation automatically
2. **Legislator Voting History (Phase 2c)**: Show how user's reps voted on bills matching user's topics
3. **Multi-Session Support (Phase 2d)**: Track representation across sessions
4. **Social Media Contacts (Phase 2e)**: Add Twitter, Facebook, Instagram handles

---

## Civic Watch & Town Hall v2 – Intent and Data Requirements

**Intent (next revision)**  
- Track bills and ideas as first-class civic items with the 5W fields plus status (who, what, where, when, why, status).  
- Use Wyoming LSO as the structural ground truth; only use OpenStates when a matching LSO bill exists and jurisdiction/sponsor checks pass.  
- Keep UX centered on hot topics (curated issues) that connect bills, ideas, and tags—avoid duplicating the full legislative site.

### What we track for bills (minimum 5W + status)
- **Who:** sponsors (individual or committee), mapped to WY legislators; committee requestor when LSO-driven.
- **What:** title/short title and subject/topic; core description/summary.
- **Where:** jurisdiction_key=WY, chamber, committee (when applicable).
- **When:** session year, introduced_at, last_action_date, status history.
- **Why:** problem/purpose from official summary/LSO short title; topic tag(s) for framing.
- **Status:** lifecycle state (introduced/in_committee/pending_vote/passed/failed) and verification state (structural + AI).
- **Sources:** primary LSO; secondary OpenStates only after LSO match + sponsor/jurisdiction validation.

### What we track for user ideas (minimum 5W + topics)
- **Who:** author (user_id), optional verified voter link (county/district).
- **What:** idea title/body; optional category/topic tags.
- **Where:** county/city (from verified_users or user-provided); state defaults to WY unless expanded.
- **When:** created_at/updated_at.
- **Why:** stated problem/purpose (“why” field or body).
- **Related topics:** hot_topics slugs; optional related bill ids.

### LSO vs OpenStates interaction
- **LSO = authoritative** for identifiers, chamber, session, committee sponsor, and status.  
- **OpenStates = supplemental** only when: (a) matching LSO bill exists; (b) jurisdiction/session match; (c) sponsor mapped to WY legislator/committee; (d) structural checks pass before any “verified/green” badge. Use OpenStates abstracts/versions when LSO lacks detail, never to override LSO status.

### Hot topics in the model
- **hot_topics (EVENTS_DB):** curated issue list, badge/priority.  
- **civic_item_ai_tags (WY_DB):** AI topic matches for bills.  
- **hot_topic_civic_items (EVENTS_DB):** curated topic↔bill links.  
- **Idea records (user_ideas/townhall_posts):** should carry topic slugs for discovery alongside bills.

### Table roles vs v2 intent
- **WY_DB.civic_items** – Canonical bill record (who/what/where/when/status); supports 5W; needs LSO source pathway/fields.  
- **WY_DB.civic_item_ai_tags** – AI topic matches (ties bills to hot topics); structure sufficient.  
- **WY_DB.bill_sponsors** – Bill sponsors (person/committee); covers “who”; add committee/LSO flags in v2.  
- **WY_DB.civic_item_verification** – Structural + AI gating (is_wyoming, has_summary, has_wyoming_sponsor, structural_ok); aligns with v2 validation.  
- **WY_DB.votes** – Engagement signals on bills (and posts); not core 5W but fits UX.  
- **WY_DB.user_ideas** – Idea records; needs richer 5W (location/topic/why/related bill).  
- **EVENTS_DB.hot_topics** – Curated issues; primary “why/what” framing.  
- **EVENTS_DB.hot_topic_civic_items** – Curated topic↔bill links; complements AI tags.  
- **EVENTS_DB.townhall_posts** – Idea/threads; partial 5W (who/when/where); needs topic slug + related bill id.

### Next Schema Steps for v2 (no code yet)
- **Bills (LSO-first):**  
  - Add LSO pathway: either `source='lso'` records in `civic_items` with LSO-specific fields (committee sponsor, LSO status codes) or a dedicated `lso_bills` table bridged to `civic_items`.  
  - Add committee sponsor role flag (`role='committee_requestor'`) in `bill_sponsors` or a small `bill_committees` table.  
  - Capture LSO status fields (lastAction, effectiveDate, chapterNo) when present.
- **Ideas (5W parity):**  
  - Extend `user_ideas` (or introduce `idea_items`) with county/city, topic_slug(s), optional related_civic_item_id, and explicit “why/problem” field.  
  - Mirror minimal 5W fields in `townhall_posts`: topic_slug, optional related_civic_item_id, explicit “why/problem” text.
- **Linkage & topics:**  
  - Standardize topic linkage across bills and ideas (topic_slug on ideas/townhall_posts) while keeping `civic_item_ai_tags` + `hot_topic_civic_items`.  
  - Keep `civic_item_verification` as the gate for OpenStates-sourced bills; require LSO confirmation before “verified/green” status.

---

## Remaining Phase 2+ Gaps (Not Addressed This Pass)

### Gap 1: Ideas Lack Topic Tagging
**Current**: `user_ideas` table exists but unused  
**Future** (Phase 3): Link ideas to topics and create idea clusters

**Proposed Migration 0014** (Phase 3):
```sql
ALTER TABLE user_ideas ADD COLUMN topic_slug TEXT;
ALTER TABLE user_ideas ADD COLUMN county_name TEXT;

CREATE TABLE idea_clusters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  created_at TEXT NOT NULL
);
```

---

### Gap 2: Town Hall Thread Data
**Design requirement**: County-by-county town halls with verified voter moderation  
**Status**: Town hall posts already implemented (Phase 1); thread nesting/moderation deferred to Phase 3+

---

## Security & Auth Gaps

### ⚠️ High Priority: Voting Auth Not Enforced
**Current**: Votes accepted based on client-supplied `user_id`  
**Risk**: Spoofed votes possible; vote counts unreliable

**Solution** (Phase 2):
```javascript
// Validate Firebase ID token before accepting vote
const authHeader = request.headers.get('authorization');
const idToken = authHeader.split(' ')[1];
const decodedToken = await admin.auth().verifyIdToken(idToken);
const userId = decodedToken.uid;  // Use server-verified UID
```

---

## Performance & Monitoring

### Query Performance (Local)
| Query | Records | Latency |
|-------|---------|---------|
| Pending bills (100 bills) | 100 | <200ms |
| Hot topics (with bills) | 6 topics × 20 bills | <150ms |
| Vote counts aggregation | 1 bill | <50ms |

### OpenAI Usage (Monitoring)
- Monitor dashboard: https://platform.openai.com/account/usage/overview
- Budget alert: Set to $50/month (gives cushion for 500+ bills/month)
- Current rate: ~$0.0011 per bill (summary + analysis)

---

## Next Steps

1. **This week**: Update this snapshot as the single source of truth (done ✅)
2. **Next week**: Propose and apply Phase 2 migrations (sponsors, town hall metadata)
3. **Later**: User testing with Wyoming residents to validate AI summarization and topic matching
4. **Future**: Automation (cron jobs for daily OpenStates sync + AI analysis)

---

## Operational Guide

### Local Development Setup
```bash
# Terminal 1: Hugo (serves on 1313)
hugo server --baseURL http://localhost:1313 --bind 0.0.0.0

# Terminal 2: Worker (serves on 8787)
cd worker
export BILL_SCANNER_ENABLED=true
./scripts/wr dev --local

# Verify both running:
curl http://127.0.0.1:1313/civic/pending/  # Hugo page
curl http://127.0.0.1:8787/api/hot-topics  # Worker API
```

### Data Population (Development)
```bash
# 1. Seed test bills from OpenStates
curl "http://127.0.0.1:8787/api/dev/openstates/sync?session=2025&limit=20"

# 2. Scan pending bills for hot topic matches (AI analysis via OpenAI)
curl "http://127.0.0.1:8787/api/internal/civic/scan-pending-bills"
# Cost: ~$0.08 for 100 bills; watch for OpenAI quota warnings

# 3. Generate bill summaries (AI)
for bill_id in test-hb22 test-hb164 test-sf174 test-hb286 test-sf89; do
  curl -X POST \
    "http://127.0.0.1:8787/api/internal/civic/test-bill-summary?bill_id=$bill_id&save=true"
done

# Verify data populated:
curl http://127.0.0.1:8787/api/civic/pending-bills-with-topics | jq '.results | length'
# Expected output: 5 (or count of seeded bills)
```

### Database Inspection
```bash
# Count bills
./scripts/wr d1 execute WY_DB --local \
  --command "SELECT COUNT(*) as count FROM civic_items;"

# Check topic matches
./scripts/wr d1 execute WY_DB --local \
  --command "SELECT topic_slug, COUNT(*) as count FROM civic_item_ai_tags GROUP BY topic_slug;"

# Check votes
./scripts/wr d1 execute WY_DB --local \
  --command "SELECT COUNT(*) as total, SUM(CASE WHEN value=1 THEN 1 ELSE 0 END) as up_count FROM votes;"

# Reset (dev only – be careful!)
./scripts/wr d1 execute WY_DB --local --command "DELETE FROM votes;"
./scripts/wr d1 execute WY_DB --local --command "DELETE FROM civic_item_ai_tags;"
./scripts/wr d1 execute WY_DB --local --command "DELETE FROM civic_items;"
```

### Monitoring & Cost
**OpenAI API usage**:
- Topic analysis: ~$0.0008 per bill (gpt-4o, 500 tokens avg)
- Bill summarization: ~$0.0003 per bill (gpt-4o, 200 tokens avg)
- 100 bills = ~$0.11 total
- Check OpenAI dashboard for monthly costs

**Performance**:
- Pending bills API: queries ~100 bills in <200ms (local)
- Remote (Cloudflare): expect <500ms with global CDN

---

## Future Enhancements

### Near-Term (Next Quarter)
1. **Legislator contact integration**: "Contact your rep about this bill" with pre-filled templates
2. **Email digests**: "Your bills were updated" notifications
3. **Bill relationship mapping**: Identify companion bills, amendments, related topics
4. **Vote distribution visualization**: Pie chart showing support/oppose/info breakdown

### Mid-Term (Next 6 Months)
1. **Multi-state expansion**: Add Colorado, Utah, Idaho legislation
2. **Topic customization**: Allow users to create custom subscriptions ("Email me about education funding")
3. **Semantic bill search**: Vector embeddings for "bills about property taxes"
4. **AI reading level detection**: Flag summaries that are still too complex

### Long-Term (2026+)
1. **Civic participation loops**: Town halls, public testimony uploads, legislator responses
2. **Community ratings**: "Was this summary helpful?" → improve AI model
3. **Legislative outcome tracking**: "How did you vote?" → "Bill passed/failed" → notify subscribers
4. **Impact simulation**: "If 10,000 people contact their rep, what happens?"

---

## Phase 3 Update: LSO Sync Fix (December 11, 2025)

### Issue Identified
The LSO sync endpoint was returning `D1_TYPE_ERROR: Type 'undefined' not supported` because it was treating committee objects from `GetCommitteeBills/{year}` as bills directly, when in reality each committee contains an array of `sponsoredBills`.

**API Structure (Corrected):**
```
GET /api/BillInformation/GetCommitteeBills/2026
├── Committee 1
│   ├── committeeDetail: {...}
│   ├── billSummaries: [...]
│   └── sponsoredBills: [← ACTUAL BILLS ARE HERE]
│       ├── { billNum: "HB0008", shortTitle: "...", sponsor: "Judiciary", ... }
│       ├── { billNum: "HB0009", shortTitle: "...", sponsor: "Judiciary", ... }
│       └── ...
├── Committee 2
│   └── sponsoredBills: [...]
└── ... (17 committees total)
```

### Root Cause
The sync loop was iterating `bills` (which was actually an array of committees) and directly accessing `bill.billNum`, which was undefined since committees don't have that field.

### Solution Implemented
✅ **File**: `worker/src/lib/wyLsoClient.mjs`

**Changes:**
1. **Fixed committee traversal**: Changed loop to iterate committees, then for each committee, iterate `committee.sponsoredBills`
2. **Added billNum guard**: Skip bills without `billNum` with warning logging
3. **Ensured year is set**: Inject year into bill object if missing
4. **Defensive D1 binding**: Guard against undefined/null values in upsertCivicItem with fallback defaults
5. **Added external_url check**: Only build URL if billNum exists

**Result:**
```bash
✅ LSO Sync Test (year=2026):
   - synced: 25
   - errors: 0
   - count: 17 (committees processed)
   - year: "2026"

✅ Database Verification:
   - civic_items WHERE source='lso': 25 rows
   - Sample: HB0008 (house), HB0009 (house), SF0007 (senate), SF0008 (senate)
   - All fields properly populated, no undefined values
```

### Regression Testing
✅ **Unit Tests**: civicItemCompleteness.test.mjs + wyLsoClient.test.mjs (6 tests) – all passing  
✅ **API Endpoints**:
- `/api/dev/lso/sync-committee-bills?year=2026` → 200 OK, 25 bills synced
- `/api/dev/civic/sample-complete-bills?limit=5` → 200 OK
- `/api/dev/openstates/sync?session=2026&limit=5` → 200 OK (synced 1, skipped 4)

### Code Example (Key Fix)
```javascript
// BEFORE: Treating committees as bills
for (const bill of bills) {
  const civicItem = buildCivicItemFromLso(bill); // bill.billNum was undefined (bill is a committee)
}

// AFTER: Traversing committee structure correctly
for (const committee of committees) {
  const sponsoredBills = committee.sponsoredBills || [];
  for (const bill of sponsoredBills) {
    if (!bill.billNum) continue; // Guard against missing billNum
    if (!bill.year) bill.year = year; // Inject year if missing
    const civicItem = buildCivicItemFromLso(bill);
    await upsertCivicItem(env.WY_DB, civicItem); // Safe: all fields guarded
  }
}
```

### Impact
- **LSO-first ingestion path now working**: Bills can be seeded directly from Wyoming Legislature Service instead of only via OpenStates
- **Data quality**: 25 bills with complete metadata (bill number, title, chamber, sponsor committee, status)
- **No data loss**: Previous OpenStates sync (10 test bills) unaffected; LSO bills have `source='lso'` for tracking
- **Ready for production**: All defensive guards in place; comprehensive error logging enabled

---

## Summary

**This Is Us** successfully bridges complex Wyoming legislation and citizen understanding. The core pipeline works; AI content is accessible; voting is real-time.

**What works**: Clean API design, accurate AI, responsive UI, filtering, real-time voting.

**Critical gaps** (prioritized for UX improvement):
1. **Empty state clarity** – Add skeleton loaders and error messaging
2. **Topic filter UX** – Replace dropdown with clickable chips
3. **Vote transparency** – Show feedback, persist votes, highlight your vote
4. **Navigation** – Add "Civic Watch" global nav, breadcrumbs, CTAs
5. **Auth hardening** – Implement Firebase validation for votes

**Operational priorities**:
1. Schedule daily OpenStates sync + AI analysis (cron)
2. Implement Firebase auth for voting
3. Add monitoring for OpenAI quota and API errors
4. Document environment variables for threshold tuning

**Next milestone**: Phase 1 UX improvements (Week 1) → **user testing with Wyoming residents** to validate:
- Do summaries feel trustworthy?
- Are filters intuitive?
- Would you use this to research bills before voting?
- Would you contact your legislator based on this information?

---

**Document**: This Is Us Project Snapshot  
**Date**: December 6, 2025  
**Status**: Functional MVP with clear UX/UI roadmap  
**Owner**: Civic Engagement Team
