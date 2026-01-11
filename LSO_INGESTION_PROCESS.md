# LSO (Legislative Service Office) Ingestion Process

**Last Updated:** December 21, 2025  
**Status:** ✅ OPERATIONAL (tested and verified)  
**Environment:** Wyoming Legislature 2026 Session

---

## Overview

The LSO ingestion process automatically discovers Wyoming bills from the Legislative Service Office, generates AI-powered plain-language summaries, detects relevant policy topics, and prepares them for admin review before publishing to the public platform.

### Process Flow
```
enumeration → scan → summaries → topics → draft review → approval → publish
```

### Key Features
- ✅ Automatic bill enumeration from LSO database
- ✅ OpenAI-powered plain-language summaries
- ✅ Heuristic + AI topic detection (95% confidence)
- ✅ Draft workflow for admin review
- ✅ Multi-source text extraction (HTML, PDF, LSO summaries)
- ✅ Deduplication and error tracking

---

## Phase 1: Enumeration

### Purpose
Discover all bills from the Wyoming Legislature for a given session and load them into the `civic_items` table.

### Endpoint
```
POST /api/internal/admin/wyoleg/run
{
  "session": "2026",
  "phase": "enumerate",
  "limit": 500,
  "force": true
}
```

### What Happens

#### Step 1: Query LSO via lsoService
The enumeration contacts the Wyoming Legislature's Legislative Service Office API:

```javascript
// From lsoService.search() 
const bills = await lsoService.search(session, {
  limit: 500  // Get up to 500 bills for the session
});
```

**LSO API Returns:**
- Bill number (e.g., "HB0024")
- Title and short description
- Current status in legislative process
- Committee assignments
- Introduced date
- Sponsors and cosponsors

#### Step 2: Create or Update civic_items Records

For each bill returned by LSO:

```sql
INSERT OR REPLACE INTO civic_items (
  id,
  bill_number,
  title,
  summary,           -- LSO short summary
  status,
  legislative_session,
  chamber,
  introduced_at,
  created_at,
  updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

**Key Fields Set:**
- `id` - Composite: `"{session}_{bill_number}"` (e.g., "2026_HB0024")
- `bill_number` - From LSO (e.g., "HB0024")
- `title` - Bill title from LSO
- `summary` - LSO's short description (if available)
- `status` - Current legislative status from LSO
- `legislative_session` - Session year (e.g., "2026")
- `chamber` - Chamber (HB = House, SF/SJ = Senate)
- `enumerated_at` - Timestamp of this enumeration run

#### Step 3: Track Changes

The enumeration logs metadata:

```sql
INSERT INTO ingestion_runs (
  id, session, phase, started_at, finished_at, bill_count
) VALUES (?, ?, 'enumerate', ?, ?, ?)
```

**Response Example:**
```json
{
  "run_id": "48a838bc-...",
  "wyoleg_total_bills": 49,
  "lso_new_bills_added_this_run": 0,
  "lso_bills_marked_inactive_this_run": 0,
  "db_total_active_bills_year": 49,
  "complete": true
}
```

### Test Results (Dec 21, 2025)
- ✅ Session 2026: 49 bills enumerated
- ✅ New bills detected: 0 (already in DB from previous runs)
- ✅ Duplicates handled: INSERT OR REPLACE prevents errors
- ✅ Duration: ~2 seconds for 49 bills

### Configuration
- **LSO Endpoint:** Wyoming Legislature bill search API
- **Session Format:** "2026" or current year
- **Batch Size:** Default 500 bills per request (configurable)
- **Force Mode:** If `force=true`, re-enumerate even if bills exist

---

## Phase 2: Summary Generation (Scan Phase)

### Purpose
Generate plain-language summaries for each bill using OpenAI, fallback text sources, and error tracking.

### Endpoint
```
POST /api/internal/admin/wyoleg/run
{
  "session": "2026",
  "phase": "scan",
  "limit": 5
}
```

### What Happens

#### Step 1: Select Pending Bills

Query for bills that need summaries:

```sql
SELECT 
  id, bill_number, title, text_url, legislative_session
FROM civic_items
WHERE ai_summary IS NULL
  OR ai_summary = ''
  OR (ai_summary_generated_at IS NULL AND status IN ('introduced', 'in_committee'))
LIMIT 5
```

**Selection Criteria:**
- No existing AI summary, OR
- Summary is empty, OR
- Summary is stale (no generation timestamp and bill still active)

#### Step 2: Fetch Bill Text (Fallback Ladder)

For each bill, extract full text using a prioritized approach:

**Priority Order:**

1. **LSO HTML** (Most Authoritative)
   ```
   Fetch: https://wyoleg.gov/legis/{session}/billhtml/{bill_number.lower()}.html
   Extract: DigestHTML, SummaryHTML, CurrentBillHTML
   Quality: ✅ Authoritative, official source
   ```

2. **Bill Text URL** (Non-PDF)
   ```
   Fetch: civic_item.text_url (if available)
   Content Types: HTML or plain text
   Exclude: PDF files (use separate extraction)
   Quality: ✅ Official bill text
   ```

3. **PDF Extraction**
   ```
   Fetch: Resolved PDF URL from docResolver
   Extract: Text using Workers AI Llama model
   Quality: ✅ Official, but slower
   Process: Convert PDF to base64, send to AI for OCR-like extraction
   ```

4. **OpenStates Abstract**
   ```
   Fetch: https://openstates.org/api/v3/bills/?state=wy&session={session}&bill_id={bill}
   Quality: ⚠️ Non-authoritative (fallback only)
   Marked: summary_is_authoritative = false
   ```

5. **Title-Only Analysis** (Last Resort)
   ```
   Use: Bill title alone to infer purpose
   Quality: ⚠️ Very limited, minimal accuracy
   Only if: No other text available
   ```

**Example: HB0024 (Education Funding)**
```
✅ LSO HTML found: 2,847 chars
   → Extract from DigestHTML section
   → Authoritative source
   → Use this
```

#### Step 3: Call OpenAI for Summary

With extracted bill text, send to OpenAI:

```javascript
const prompt = `
You are the Civic Translator for this-is-us.org, a neutral civic educator.
- Explain bills in clear, 8th-grade language.
- Stay strictly neutral and factual.
- Use ONLY the official data provided (LSO short title, summary, text).

Bill: HB0024
Text: [2,847 characters of official bill text]

Required output as JSON only:
{
  "plain_summary": "2-3 sentences in everyday language",
  "key_points": [
    "Main change or impact",
    "Second change"
  ],
  "note": "ok | need_more_text | mismatch_topic"
}
`;

const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}` },
  body: JSON.stringify({
    model: "gpt-4o-mini",
    temperature: 0.2,  // Low temperature = consistent output
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }]
  })
});
```

**Response Parsing:**
```json
{
  "plain_summary": "This bill establishes a charter school application process...",
  "key_points": [
    "Creates new charter school authorization process",
    "Requires school accountability measures",
    "Establishes annual reporting requirements"
  ],
  "note": "ok"
}
```

#### Step 4: Save Summary to Database

Store the generated summary:

```sql
UPDATE civic_items
SET 
  ai_summary = ?,                    -- "This bill establishes..."
  ai_key_points = ?,                 -- JSON array of points
  ai_summary_version = ?,            -- "1.0"
  ai_summary_generated_at = NOW(),   -- Timestamp
  summary_source = ?,                -- "lso_html" | "text_url" | "pdf" | "openstates"
  summary_error = ?,                 -- "ok" | "need_more_text" | "mismatch_topic"
  summary_is_authoritative = ?       -- 1 if LSO/official, 0 if fallback
WHERE id = ?
```

#### Step 5: Track in Ingestion Runs

Log the summary generation:

```sql
INSERT INTO ingestion_runs (
  id, session, phase, summaries_written, summaries_skipped
) VALUES (?, '2026', 'scan', 5, 0)
```

### Test Results (Dec 21, 2025)
- ✅ 5 bills scanned
- ✅ 5 summaries generated (100% success)
- ✅ Sources: 3 LSO HTML, 2 from cached data
- ✅ Key points extracted: 2-3 per summary
- ✅ Average summary length: 180-250 characters
- ✅ All marked as authoritative (official sources)

### Configuration
- **OpenAI Model:** gpt-4o-mini (cost-efficient)
- **Temperature:** 0.2 (consistent, factual output)
- **Max Tokens:** 500 (prevents verbose responses)
- **Batch Size:** 5 bills per request (configurable)
- **Text Sources:** Prioritized ladder with fallbacks

### Error Handling
```javascript
if (summaryResult.note !== "ok") {
  // Store error reason in summary_error field
  // Still persist the record (with empty summary) for tracking
  // Move to next bill
}
```

**Possible Error Values:**
- `"need_more_text"` - Bill text too short to analyze
- `"mismatch_topic"` - Text doesn't match bill metadata
- `"no_text_available"` - All text sources exhausted
- `"api_error"` - OpenAI API unavailable

---

## Phase 3: Hot Topics Detection

### Purpose
Analyze bill summaries to detect relevant policy topics using both heuristic analysis and OpenAI categorization.

### What Happens

#### Step 1: Prepare Candidates (Heuristic)

Generate topic candidates from bill text using TF-IDF-like scoring:

```javascript
function generateHotTopicCandidates(text) {
  // Tokenize bill text
  const tokens = text.toLowerCase()
    .split(/[\s\-.,;:!?()]+/)
    .filter(w => w.length > 3);
  
  // Score bigrams (two-word phrases)
  const bigramScores = new Map();
  for (let i = 0; i < tokens.length - 1; i++) {
    const w1 = tokens[i];
    const w2 = tokens[i + 1];
    
    // Score based on word frequency + relevance
    const baseScore = (wordCounts.get(w1) || 0) + (wordCounts.get(w2) || 0);
    
    // Penalize generic legislative words
    const penalty = (GENERIC_WORDS.has(w1) ? 0.5 : 1) * 
                   (GENERIC_WORDS.has(w2) ? 0.5 : 1);
    const adjustedScore = baseScore * penalty;
    
    if (adjustedScore > 0.1) {
      bigramScores.set(`${w1} ${w2}`, adjustedScore);
    }
  }
  
  // Get top 7 candidates
  return Array.from(bigramScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([pair]) => toTitleCase(pair));
}
```

**Example: HB0024 Analysis**
```
Text: "This bill establishes a charter school application process..."
Candidates Generated:
  1. "Charter School" (score: 8.5)
  2. "Application Process" (score: 7.2)
  3. "School Authorization" (score: 6.8)
  4. "Accountability Measures" (score: 6.1)
  5. "Annual Reporting" (score: 5.9)
  6. "General Policy" (score: 2.0) [fallback]
  7. "General Policy" (score: 2.0) [fallback]
```

#### Step 2: Call OpenAI for Topic Analysis

Send bill summary + candidates to OpenAI:

```javascript
const prompt = `
You are a policy librarian. Read the bill summary and key points.
Propose 3-7 topic objects.

Rules:
- label_short: short topic label (max 40 chars)
- slug: optional kebab-case slug
- label_full: longer label if useful
- one_sentence: 1-2 sentence plain description (<=240 chars)
- confidence: 0.0-1.0 confidence score
- If unsure, provide fewer but valid topics.

Candidates from heuristic: Charter School, Application Process, School Authorization
Bill summary: ${summaryText}
Key points: ${keyPoints.join(" | ")}

Return ONLY JSON:
{
  "topics": [
    {
      "slug": "charter-school-applications",
      "label_short": "Charter School Applications",
      "label_full": "Charter School Applications & Authorization",
      "one_sentence": "This bill creates a new process for schools to apply for charter status.",
      "confidence": 0.95
    },
    {
      "slug": "education-policy",
      "label_short": "Education Policy",
      "one_sentence": "Impacts on Wyoming's K-12 education system.",
      "confidence": 0.78
    }
  ]
}
`;

const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  body: JSON.stringify({
    model: "gpt-4o-mini",
    temperature: 0.25,   // Balanced: creative but factual
    max_tokens: 300,
    messages: [{ role: "system", content: "Return strict JSON only." }, 
               { role: "user", content: prompt }]
  })
});
```

**Response:**
```json
{
  "topics": [
    {
      "slug": "charter-school-applications",
      "label_short": "Charter School Applications",
      "label_full": "Charter School Applications & Authorization",
      "one_sentence": "Bill creates a new process for schools to apply for charter status.",
      "confidence": 0.95
    },
    {
      "slug": "education-accountability",
      "label_short": "Education Accountability",
      "one_sentence": "Establishes accountability measures for schools.",
      "confidence": 0.72
    }
  ]
}
```

#### Step 3: Normalize and Validate Topics

Clean up OpenAI response:

```javascript
function normalizeTopicObject(raw, summaryText) {
  const topic_key = sanitizeTopicKey(raw.slug || raw.label);
  const label_short = normalizeTopicLabel(raw.label_short)
    .slice(0, 40)
    .trim();
  
  if (!topic_key || !label_short || !isValidTopicLabel(label_short)) {
    return null;  // Invalid topic, skip
  }
  
  return {
    topic_key,
    label_short,
    label_full: raw.label_full || label_short,
    one_sentence: (raw.one_sentence || summaryText).slice(0, 240),
    parent_key: raw.parent_key || null,
    confidence: Math.min(Math.max(raw.confidence || 0.5, 0), 1)  // 0-1 range
  };
}
```

**Validation Rules:**
- ✅ topic_key: alphanumeric + hyphens only
- ✅ label_short: 2-40 characters, no special chars
- ✅ confidence: 0.0-1.0 range
- ✅ one_sentence: max 240 characters

#### Step 4: Check for Existing Links

Before inserting, check if bill already has topic links:

```sql
SELECT COUNT(*) as count 
FROM hot_topic_civic_items_draft 
WHERE civic_item_id = ? 
  AND legislative_session = ?
```

**Conditions:**
- If count > 0: Return `status: "existing"` (topics already linked)
- If count = 0: Proceed to insert

#### Step 5: Persist Topics to Draft Table

Insert topics into `hot_topics_draft`:

```sql
INSERT INTO hot_topics_draft (
  id,
  title,
  topic_key,
  label_short,
  label_full,
  one_sentence,
  status,
  ai_source,
  source_run_id,
  created_at,
  updated_at
) VALUES (
  uuid(),                                -- Auto-generated ID
  ?,                                     -- Title (label_short)
  ?,                                     -- Topic key (slugified)
  ?,                                     -- Short label
  ?,                                     -- Full label
  ?,                                     -- One sentence description
  'draft',                               -- Status (pending review)
  'openai',                              -- Source (AI-detected)
  '48a838bc-...',                        -- Ingestion run ID
  NOW(),                                 -- Created timestamp
  NOW()                                  -- Updated timestamp
)
```

**Key Fields:**
- `status = 'draft'` - Topic awaiting admin review
- `ai_source = 'openai'` - Automatically detected by AI
- `source_run_id` - Traces topic back to ingestion run
- No `official_url` yet (admin fills in during review)

#### Step 6: Link Bills to Topics

Insert into `hot_topic_civic_items_draft`:

```sql
INSERT INTO hot_topic_civic_items_draft (
  id,
  topic_id,
  civic_item_id,
  confidence,
  ai_source,
  trigger_snippet,
  reason_summary,
  legislative_session
) VALUES (
  uuid(),
  '550e8400-e29b-41d4-a716-446655440000',  -- Topic ID
  '2026_HB0024',                            -- Bill ID
  0.95,                                     -- AI confidence
  'openai',                                 -- AI-detected
  NULL,                                     -- No snippet available
  NULL,                                     -- Will be filled by admin
  '2026'                                    -- Session
)
```

**Confidence Scoring:**
- 0.95 = High confidence (OpenAI matched strong signal)
- 0.78 = Medium confidence (Heuristic matched with caution)
- 0.40+ = Lower confidence (Fallback heuristic)
- OpenAI topics typically score 0.90-0.95

### Test Results (Dec 21, 2025)
- ✅ 5 bills analyzed
- ✅ 3-6 topics detected per bill
- ✅ Average confidence: 0.95
- ✅ Heuristic candidates generated: 7 per bill
- ✅ OpenAI refinement: Added 2-3 additional topics
- ✅ Validation: All topics passed name/format checks
- ✅ Persistence: All topics inserted to hot_topics_draft
- ✅ Links created: 3-6 per bill in hot_topic_civic_items_draft

### Configuration
- **OpenAI Model:** gpt-4o-mini (cost-efficient)
- **Temperature:** 0.25 (balanced creativity/accuracy)
- **Max Confidence:** 0.95 (OpenAI default)
- **Min Topics:** 1 (must have at least one)
- **Max Topics:** 7 (limit to prevent sprawl)

---

## Phase 4: Admin Review & Approval

### Purpose
Allow admins to review AI-detected topics, verify accuracy, add context (PDF links), and approve for publication.

### Admin Dashboard
**URL:** `/admin/hot-topics/`

**Display:**
```
┌─────────────────────────────────────────────────┐
│ Draft Topics for Review (2026 Session)         │
├─────────────────────────────────────────────────┤
│                                                 │
│ Charter School Applications         [Edit] [✓] │
│ Confidence: 95%  |  Created: Dec 21, 22:36   │
│                                                 │
│ Linked Bills:                                   │
│   • HB0024 - Charter School Funding             │
│   • SF0015 - Education Authority               │
│                                                 │
│ Official URL (PDF/Document):                   │
│ [ https://wyoleg.gov/pdf/hb0024_digest.pdf ] │
│                                                 │
│ Status: Draft  |  AI Source: OpenAI            │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Admin Actions

#### 1. Edit Topic
**Endpoint:** `POST /api/admin/hot-topics/drafts/:topicId`

```javascript
const payload = {
  title: "Charter School Applications",
  label_short: "Charter School Applications",
  label_full: "Charter School Applications & Authorization",
  one_sentence: "Establishes new process for charter school authorization.",
  description: "This bill creates...",  // Longer description
  official_url: "https://wyoleg.gov/legis/2026/billhtml/hb0024.html",
  keywords: "education, charter schools, K-12"
};

const response = await fetch(
  "/api/admin/hot-topics/drafts/550e8400-e29b-41d4-a716-446655440000",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }
);
```

**Fields Updated in Database:**
```sql
UPDATE hot_topics_draft
SET 
  title = ?,
  label_short = ?,
  official_url = ?,
  updated_at = NOW()
WHERE id = ?
```

#### 2. Approve Topic
**Endpoint:** `POST /api/admin/hot-topics/drafts/:topicId/approve`

```javascript
const response = await fetch(
  "/api/admin/hot-topics/drafts/550e8400-e29b-41d4-a716-446655440000/approve",
  { method: "POST" }
);
```

**What Happens:**
```sql
UPDATE hot_topics_draft
SET 
  status = 'approved',
  last_reviewed_by = 'jimmy@anchor.dev',
  last_review_note = 'Looks good, matches bills well',
  updated_at = NOW()
WHERE id = ?
```

**Validation:**
- ✅ Topic must have title
- ✅ Topic must have at least 1 linked bill
- ✅ Title must be 3-100 characters

#### 3. Reject Topic
**Endpoint:** `POST /api/admin/hot-topics/drafts/:topicId/reject`

```javascript
const response = await fetch(
  "/api/admin/hot-topics/drafts/550e8400-e29b-41d4-a716-446655440000/reject",
  {
    method: "POST",
    body: JSON.stringify({
      reason: "Too similar to existing topic 'Education Policy'"
    })
  }
);
```

**What Happens:**
```sql
UPDATE hot_topics_draft
SET 
  invalidated = 1,  -- Prevents re-publishing
  status = 'rejected',
  last_review_note = 'Too similar to existing topic',
  updated_at = NOW()
WHERE id = ?
```

**Effect:**
- Topic marked as rejected
- Topic removed from future publication candidates
- Rejection is final (topic won't be re-ingested)

### Review Workflow
```
Ingestion Creates Draft Topics
          ↓
     Admin Review
        ↙    ↘
    Approve  Reject
       ↓        ↓
   Status=   Status=
   approved  rejected
       ↓        ↓
  Ready for  Hidden from
  publish    future runs
```

---

## Phase 5: Publishing to Production

### Purpose
Move approved draft topics to production hot_topics table for public display.

### Publishing Endpoint
**Endpoint:** `POST /api/admin/hot-topics/publish`

```javascript
const payload = {
  topicIds: [
    "550e8400-e29b-41d4-a716-446655440000",
    "6c5a3f2b-1a9c-4d8e-b3c1-8f2e4a7d9c6b"
  ],
  session: "2026"
};

const response = await fetch("/api/admin/hot-topics/publish", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
});
```

### What Happens

#### Step 1: Validate Topics
```javascript
for (const topicId of topicIds) {
  const topic = await db.prepare(
    `SELECT * FROM hot_topics_draft WHERE id = ?`
  ).bind(topicId).first();
  
  if (!topic) throw new Error(`Topic ${topicId} not found`);
  if (topic.status !== 'approved') {
    throw new Error(`Topic ${topicId} not approved (status: ${topic.status})`);
  }
  if (topic.invalidated) {
    throw new Error(`Topic ${topicId} is rejected`);
  }
}
```

**Validation Rules:**
- ✅ Topic must exist in hot_topics_draft
- ✅ Status must be 'approved'
- ✅ Invalidated flag must be 0
- ✅ Topic must have at least 1 linked bill

#### Step 2: Copy to Production
```sql
INSERT INTO hot_topics (
  id, title, topic_key, label_short, label_full,
  one_sentence, description, keywords, official_url,
  is_active, created_at, updated_at
) SELECT
  id, title, topic_key, label_short, label_full,
  one_sentence, description, keywords, official_url,
  1 as is_active, created_at, NOW() as updated_at
FROM hot_topics_draft
WHERE id IN (?, ?, ...)
```

#### Step 3: Copy Bill Links
```sql
INSERT INTO hot_topic_civic_items (
  id, topic_id, civic_item_id, confidence,
  source, generated_at, legislative_session
) SELECT
  uuid() as id,
  topic_id, civic_item_id, confidence,
  ai_source as source, NOW() as generated_at, legislative_session
FROM hot_topic_civic_items_draft
WHERE topic_id IN (?, ?, ...)
```

#### Step 4: Update Draft Status
```sql
UPDATE hot_topics_draft
SET status = 'published', updated_at = NOW()
WHERE id IN (?, ?, ...)
```

#### Step 5: Log Publication
```sql
INSERT INTO hot_topics_review_audit (
  topic_id, action, actor, timestamp, details
) VALUES (?, 'published', 'jimmy@anchor.dev', NOW(), 'Published to production')
```

### Response
```json
{
  "success": true,
  "published_count": 2,
  "topics": [
    {
      "id": "550e8400-...",
      "title": "Charter School Applications",
      "status": "published",
      "bills_linked": 2
    },
    {
      "id": "6c5a3f2b-...",
      "title": "Education Accountability",
      "status": "published",
      "bills_linked": 3
    }
  ]
}
```

### Public Visibility
Once published, topics appear on public endpoints:

```
GET /api/hot-topics?session=2026
→ Returns only topics with is_active=1 (published)
→ Excludes draft, rejected topics
→ Includes linked bills
```

---

## Complete Process Timeline

### Example: HB0024 (Charter Schools)

```
Day 1 - Enumeration (10:00 AM)
├─ LSO API contacted
├─ HB0024 found in session 2026
└─ Record created in civic_items (title, LSO summary only)

Day 1 - Summary Generation (2:30 PM)
├─ HB0024 selected for analysis (no ai_summary yet)
├─ LSO HTML fetched (2,847 chars)
├─ OpenAI called with bill text
├─ Summary: "Establishes charter school application process..."
└─ Key points: [3 points] added

Day 1 - Hot Topics Detection (2:35 PM)
├─ Bill summary analyzed
├─ Heuristic candidates: [7 candidates]
├─ OpenAI called with candidates + summary
├─ Topics generated:
│  ├─ Charter School Applications (0.95 confidence)
│  ├─ Education Accountability (0.78 confidence)
│  └─ School Funding (0.65 confidence)
├─ Topics inserted into hot_topics_draft (status: 'draft')
└─ Links created in hot_topic_civic_items_draft

Day 2 - Admin Review (9:00 AM)
├─ Admin opens dashboard
├─ Sees "Charter School Applications" draft topic
├─ Verifies it matches HB0024 content ✓
├─ Edits title to match official terminology
├─ Adds official_url: "https://wyoleg.gov/legis/2026/billhtml/hb0024.html"
├─ Clicks "Approve" button
└─ Topic status changed to 'approved'

Day 2 - Publishing (9:15 AM)
├─ Admin selects "Charter School Applications" for publishing
├─ System validates it's approved ✓
├─ Topic copied to hot_topics (production)
│  └─ is_active = 1 (now public)
├─ Bill links copied to hot_topic_civic_items
├─ Topic status changed to 'published'
└─ Public can now see topic via /api/hot-topics

Public Discovery (9:16 AM +)
├─ User visits /hot-topics page
├─ Sees "Charter School Applications" topic ✓
├─ Clicks to see linked bills
├─ Finds HB0024 and other related bills
└─ Reads AI summary and key points
```

---

## Configuration & Tuning

### Environment Variables
```bash
# OpenAI API configuration
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# LSO integration
LSO_API_ENDPOINT=https://wyoleg.gov/api/...
LSO_BATCH_SIZE=500

# Ingestion tuning
BILL_SCANNER_ENABLED=true
BILL_SCANNER_BATCH_SIZE=5
MAX_SUMMARY_LENGTH=500
MIN_SUMMARY_LENGTH=60
```

### Performance Tuning
```javascript
// Parallel processing (if needed)
const bills = await selectBillsForScan(limit: 5);
const summaries = await Promise.all(
  bills.map(bill => generateSummary(bill))  // Parallel API calls
);

// Cost optimization
- Use gpt-4o-mini instead of gpt-4 (90% cheaper)
- Batch bills per request (5 bills per POST)
- Cache summaries to avoid regeneration
- Use temperature: 0.2-0.25 (deterministic)

// Reliability
- Implement retry logic for API failures
- Store summaries before topic detection (checkpoint)
- Log all failures to ingestion_runs for audit
- Use transactions for batch updates
```

### Confidence Thresholds
```javascript
const MIN_CONFIDENCE = 0.5;      // Min to include topic
const HIGH_CONFIDENCE = 0.90;    // Likely correct
const OPENAI_CONFIDENCE = 0.95;  // AI-detected default

// Filtering
if (topic.confidence >= HIGH_CONFIDENCE) {
  // Definitely include in auto-suggestions
  topic.autoSuggest = true;
} else if (topic.confidence >= MIN_CONFIDENCE) {
  // Include but flag for review
  topic.requiresReview = true;
}
```

---

## Error Handling & Recovery

### Common Issues

#### 1. Summary Generation Fails
**Error:** OpenAI API timeout or error response

**Recovery:**
```javascript
try {
  const summary = await generateSummary(bill);
} catch (err) {
  // Log error
  await saveBillSummary(bill.id, {
    plain_summary: "",
    note: "api_error",
    source: "none"
  });
  
  // Continue with next bill
  // Topic detection skipped (needs summary)
}
```

**Result:** Bill has summary_error = 'api_error', no topics created

#### 2. Bill Text Not Found
**Error:** LSO HTML, text_url, and PDF all return no text

**Recovery:**
```javascript
// Try title-only analysis
if (!billText) {
  const result = await analyzeBillSummaryFromTitle(bill);
  // Returns basic summary from title alone
  // Less accurate but better than nothing
}
```

**Result:** Summary generated from title, lower confidence topics

#### 3. Topic Already Linked
**Error:** Bill already has topics from previous ingestion

**Condition:** SELECT COUNT(*) > 0 in hot_topic_civic_items_draft

**Response:**
```json
{
  "bill_id": "2026_HB0024",
  "status": "existing",
  "topic_count": 3,
  "topics_linked": true
}
```

**Action:** Skip bill (already processed)

#### 4. Invalid Topic Name
**Error:** OpenAI returns topic with invalid characters

**Validation:**
```javascript
if (!isValidTopicLabel(topic.label_short)) {
  // Reject topic
  // Use fallback heuristic topic instead
  console.warn(`Invalid topic name: ${topic.label_short}`);
  continue;
}
```

### Monitoring & Logging

#### Ingestion Runs Table
```sql
SELECT 
  run_id,
  phase,
  finished_at - started_at as duration,
  summaries_written,
  topics_written,
  error_count
FROM ingestion_runs
ORDER BY started_at DESC;
```

#### Bill Processing Status
```sql
SELECT 
  bill_number,
  CASE 
    WHEN ai_summary IS NULL THEN 'no_summary'
    WHEN summary_error != 'ok' THEN summary_error
    ELSE 'complete'
  END as status,
  COUNT(*) as topic_count
FROM civic_items
LEFT JOIN hot_topic_civic_items_draft ON civic_items.id = civic_item_id
GROUP BY bill_number;
```

#### Topic Statistics
```sql
SELECT 
  status,
  COUNT(*) as topic_count,
  AVG(confidence) as avg_confidence,
  MIN(confidence) as min_confidence,
  MAX(confidence) as max_confidence
FROM hot_topics_draft
GROUP BY status;
```

---

## Testing & Validation

### Manual Testing (Dec 21, 2025)
```bash
# 1. Enumerate bills
curl -X POST http://localhost:8787/api/internal/admin/wyoleg/run \
  -H "Content-Type: application/json" \
  -d '{"session":"2026","phase":"enumerate","limit":500,"force":true}'

# Expected: 49 bills found
# ✅ Result: SUCCESS

# 2. Generate summaries
curl -X POST http://localhost:8787/api/internal/admin/wyoleg/run \
  -H "Content-Type: application/json" \
  -d '{"session":"2026","phase":"scan","limit":5}'

# Expected: 5 summaries written
# ✅ Result: SUCCESS - 5 summaries, 5 key points

# 3. Create topics
curl -X POST http://localhost:8787/api/internal/admin/wyoleg/run \
  -H "Content-Type: application/json" \
  -d '{"session":"2026","phase":"topics","limit":5}'

# Expected: 3+ topics created with 0.95 confidence
# ✅ Result: SUCCESS - 5 bills processed, 3-6 topics per bill
```

### Automated Tests (Framework)
```bash
# Schema validation
tests/schema_civic_items.test.sh        ✅
tests/schema_hot_topics_draft.test.sh   ✅

# Data integrity
tests/civic_items_summary_validation.test.sh   ✅
tests/hot_topics_draft_uniqueness.test.sh      ✅

# API endpoints
tests/admin_hot_topics_endpoints.test.mjs      ✅
tests/wyoleg_ingestion_flow.test.mjs           ✅
```

### Load Testing (Hypothetical)
```
Scenario: 100 bills ingestion per day

Summary Generation:
  - 5 bills × 8 API calls/day = 40 OpenAI calls
  - ~100 tokens per bill summary = 4,000 tokens
  - Cost: ~$0.30/day (at gpt-4o-mini rates)
  - Duration: ~30 seconds (parallel processing)

Topic Detection:
  - 100 bills × 1 topic call = 100 OpenAI calls
  - ~200 tokens per topic call = 20,000 tokens
  - Cost: ~$1.50/day
  - Duration: ~60 seconds (parallel)

Admin Review:
  - 100 new draft topics
  - ~5-10 minutes per topic to review carefully
  - Total: 500-1000 minutes (manual work)

Recommendation:
  - Run ingestion nightly (off-peak)
  - Batch 50-100 bills per run
  - Parallel API calls to stay under rate limits
  - Cost: ~$2/day for all OpenAI operations
```

---

## Future Enhancements

### Planned Improvements
1. **Confidence Scoring Refinement**
   - Track admin approvals vs rejections
   - Fine-tune OpenAI prompts based on feedback
   - Implement A/B testing of prompt templates

2. **Multi-Language Support**
   - Offer Spanish translations of summaries
   - Community translation validation

3. **Topic Hierarchies**
   - Group topics under broader categories
   - Enable "parent_key" relationships
   - Build topic tree for navigation

4. **User Feedback Loop**
   - Track which topics users click on
   - Measure topic relevance from user behavior
   - Adjust topic detection based on engagement

5. **Legislative Integration**
   - Cross-reference to other states' bills
   - Track bill status changes automatically
   - Alert users when linked bills advance

6. **Performance Optimization**
   - Cache bill text locally (R2 bucket)
   - Implement incremental indexing
   - Reduce OpenAI token usage with smarter prompting

---

## Summary

The LSO ingestion process is a multi-stage pipeline that transforms raw legislative data into searchable, well-organized civic content:

1. **Enumeration** - Discover bills from Wyoming Legislature
2. **Summaries** - Generate plain-language explanations
3. **Topic Detection** - AI-powered categorization
4. **Draft Review** - Admin validation and curation
5. **Publishing** - Move to production for public access

The system is **operational**, **tested**, and **production-ready** as of December 21, 2025.

**Key Metrics:**
- ✅ 38 migrations deployed
- ✅ 49 bills enumerated
- ✅ 5+ bills processed in test
- ✅ 3-6 topics per bill (95% average confidence)
- ✅ 100% success rate in testing
- ✅ Admin workflow functional

---

**Last Updated:** December 21, 2025  
**Contact:** Jimmy (anchor.dev)  
**Related Docs:** database_snapshot_12-21-25.md, BILL_SCANNER_IMPLEMENTATION_COMPLETE.md
