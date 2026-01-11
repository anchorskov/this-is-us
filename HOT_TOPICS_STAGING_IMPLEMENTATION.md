# Hot Topics Staging & Review Implementation

**Status**: Planning  
**Updated**: 2025-12-21  
**Owner**: Civic Watch team  
**Scope**: hot-topics / ingestion pipeline  

---

## Executive Summary

Currently, hot topics flow directly from AI analysis → `civic_item_ai_tags` → `hot_topics` without review. This design introduces a **staging table** (`hot_topics_staging`) and **admin CLI workflow** to ensure all hot topics records are complete and validated before promotion to production.

### Key Change
- **Before**: Bills analyzed → AI generates topics → Topics inserted directly to `hot_topics`
- **After**: Bills analyzed → AI generates topics → Topics inserted to `hot_topics_staging` → Admin reviews & approves → Approved topics promoted to `hot_topics`

---

## Current State Analysis

### Repo Goal (from README.md)
> "Empowering civic unity and engagement through transparent, accessible technology"

Core objectives:
- Build dynamic, community-driven website
- Integrate authentication and geolocation
- Ensure clear, accessible UX
- Maintain integrity, accountability, transparency, compassion

### Current Hot Topics Pipeline

1. **Enumeration Phase** (LSO/OpenStates)
   - Fetches bills for session (e.g., 2026)
   - Stores to `civic_items` table

2. **Scanning Phase** (AI Analysis)
   - Calls `analyzeBillForHotTopics()` in `hotTopicsAnalyzer.mjs`
   - Analyzes bill title/summary against 10 canonical topics
   - Generates topics with confidence scores (0.0–1.0)
   - Each topic includes: slug, label, confidence, trigger_snippet, reason_summary

3. **Storage Phase** (Direct Insert)
   - `saveHotTopicAnalysis()` writes to `civic_item_ai_tags`
   - Optionally creates entries in `hot_topic_civic_items`
   - No validation that record is "complete" before insertion
   - No manual review before topics become visible

### Completeness Definition

A "complete" hot topic record must have:
- ✅ `slug` – Canonical topic identifier (one of 10 approved)
- ✅ `title` – Human-readable title (required)
- ✅ `summary` – Short description (required)
- ✅ `confidence` – 0.0–1.0 score (required)
- ✅ `trigger_snippet` – Quoted/paraphrased text from bill (required)
- ✅ `reason_summary` – 1–3 sentences explaining match (required)
- ⚠️ `badge` – Category label (optional but recommended)
- ⚠️ `image_url` – Featured image (optional)
- ⚠️ `cta_label`, `cta_url` – Call-to-action (optional)
- ℹ️ `legislative_session` – Session identifier (metadata, optional)

**Minimum viable record**: All ✅ fields must be present and non-null/non-empty

---

## Proposed Solution: Staging + Review Workflow

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ AI Analysis Phase                                               │
│ (analyzeBillForHotTopics)                                       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
        ┌────────────────────────────────┐
        │ STAGING TABLE                  │
        │ (hot_topics_staging)           │
        │                                │
        │ - All analyzed topics          │
        │ - Includes validation metadata │
        │ - Status: pending, approved,   │
        │   rejected, requires_edit      │
        └────────────────────┬───────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                ↓                         ↓
        ┌──────────────────┐    ┌─────────────────┐
        │ Admin Review CLI │    │ UI Dashboard    │
        │                  │    │ (Future)        │
        │ Commands:        │    │                 │
        │ - list-staging   │    │ - View pending  │
        │ - review <id>    │    │ - Approve/Edit  │
        │ - approve <id>   │    │ - Reject/Note   │
        │ - edit <id>      │    │                 │
        │ - reject <id>    │    │                 │
        │ - promote <id>   │    │                 │
        └──────────────────┘    └─────────────────┘
                │                         │
                └────────────┬────────────┘
                             │
                             ↓
                ┌────────────────────────┐
                │ PRODUCTION TABLE       │
                │ (hot_topics)           │
                │                        │
                │ - Approved topics only │
                │ - User-facing         │
                │ - Complete records    │
                └────────────────────────┘
```

### New Tables

#### 1. `hot_topics_staging` (New)

```sql
CREATE TABLE hot_topics_staging (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Core topic data (from AI)
  slug TEXT NOT NULL,                    -- "property-tax-relief", etc.
  title TEXT NOT NULL,                   -- Topic title
  summary TEXT,                          -- Short description
  badge TEXT,                            -- Category label
  image_url TEXT,                        -- Featured image URL
  cta_label TEXT,                        -- Call-to-action button text
  cta_url TEXT,                          -- Call-to-action URL
  priority INTEGER DEFAULT 100,          -- Display priority
  
  -- Bill linking (source of this topic)
  civic_item_id TEXT,                    -- Link to civic_items.id
  confidence REAL,                       -- AI confidence (0.0-1.0)
  trigger_snippet TEXT,                  -- Quoted text that triggered match
  reason_summary TEXT,                   -- Explanation of match
  ai_source TEXT DEFAULT 'openai',       -- 'openai' or 'heuristic'
  
  -- Review metadata
  review_status TEXT DEFAULT 'pending',  -- pending, approved, rejected, requires_edit
  reviewer_notes TEXT,                   -- Admin's comments during review
  reviewed_by TEXT,                      -- Admin username/email
  reviewed_at DATETIME,                  -- When reviewed
  
  -- Completeness validation
  is_complete INTEGER DEFAULT 0,         -- 1 if all required fields present
  validation_errors TEXT,                -- JSON array of validation issues
  
  -- Tracking
  legislative_session TEXT,              -- Session identifier (e.g., "2026")
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (civic_item_id) REFERENCES civic_items(id),
  INDEX idx_status (review_status),
  INDEX idx_session (legislative_session),
  INDEX idx_complete (is_complete)
);
```

#### 2. `hot_topics_review_audit` (New)

```sql
CREATE TABLE hot_topics_review_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  staging_id INTEGER NOT NULL,
  action TEXT NOT NULL,                  -- 'reviewed', 'approved', 'rejected', 'promoted', 'edited'
  previous_status TEXT,
  new_status TEXT,
  
  reviewer_name TEXT,                    -- Admin who performed action
  reviewer_email TEXT,
  action_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  
  FOREIGN KEY (staging_id) REFERENCES hot_topics_staging(id),
  INDEX idx_staging (staging_id),
  INDEX idx_timestamp (action_timestamp)
);
```

#### 3. `hot_topics` (Existing - No schema change)

Remains unchanged. Only records promoted from staging are inserted here.

---

## Implementation Details

### Phase 1: Database Migrations

**Migration File**: `worker/migrations/0036_create_hot_topics_staging.sql`

```sql
-- Create staging table for hot topics review workflow
CREATE TABLE IF NOT EXISTS hot_topics_staging (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  badge TEXT,
  image_url TEXT,
  cta_label TEXT,
  cta_url TEXT,
  priority INTEGER DEFAULT 100,
  civic_item_id TEXT,
  confidence REAL,
  trigger_snippet TEXT,
  reason_summary TEXT,
  ai_source TEXT DEFAULT 'openai',
  review_status TEXT DEFAULT 'pending',
  reviewer_notes TEXT,
  reviewed_by TEXT,
  reviewed_at DATETIME,
  is_complete INTEGER DEFAULT 0,
  validation_errors TEXT,
  legislative_session TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (civic_item_id) REFERENCES civic_items(id),
  INDEX idx_status (review_status),
  INDEX idx_session (legislative_session),
  INDEX idx_complete (is_complete)
);

-- Create audit log table
CREATE TABLE IF NOT EXISTS hot_topics_review_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staging_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  reviewer_name TEXT,
  reviewer_email TEXT,
  action_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (staging_id) REFERENCES hot_topics_staging(id),
  INDEX idx_staging (staging_id),
  INDEX idx_timestamp (action_timestamp)
);
```

### Phase 2: Ingestion Code Changes

#### Update `hotTopicsAnalyzer.mjs`

Modify `saveHotTopicAnalysis()` to write to staging table instead of production:

**Before**:
```javascript
export async function saveHotTopicAnalysis(env, billId, analysis) {
  const { topics = [] } = analysis || {};
  
  if (topics.length > 0) {
    await env.WY_DB.prepare(
      `INSERT OR REPLACE INTO civic_item_ai_tags (item_id, topic_slug, confidence, trigger_snippet, reason_summary)
         VALUES (?1, ?2, ?3, ?4, ?5)`
    ).bind(billId, topic.slug, conf, snippet, reason).run();
  }
}
```

**After**:
```javascript
export async function saveHotTopicAnalysis(env, billId, analysis) {
  const { topics = [] } = analysis || {};
  
  if (topics.length > 0) {
    for (const topic of topics) {
      const validation = validateTopicRecord(topic);
      
      await env.WY_DB.prepare(
        `INSERT INTO hot_topics_staging (
           slug, title, summary, badge, image_url, cta_label, cta_url,
           priority, civic_item_id, confidence, trigger_snippet, reason_summary,
           ai_source, review_status, is_complete, validation_errors,
           legislative_session, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind(
        topic.slug, topic.title, topic.summary || null, topic.badge || null,
        topic.image_url || null, topic.cta_label || null, topic.cta_url || null,
        topic.priority || 100, billId, topic.confidence || 0,
        topic.trigger_snippet || null, topic.reason_summary || null,
        'openai', 'pending', validation.isComplete ? 1 : 0,
        validation.errors.length > 0 ? JSON.stringify(validation.errors) : null,
        analysis.legislative_session || null
      ).run();
    }
  }
}

function validateTopicRecord(topic) {
  const errors = [];
  
  // Required fields
  if (!topic.slug) errors.push("Missing slug");
  if (!topic.title) errors.push("Missing title");
  if (!topic.confidence) errors.push("Missing confidence score");
  if (!topic.trigger_snippet) errors.push("Missing trigger snippet");
  if (!topic.reason_summary) errors.push("Missing reason summary");
  
  // Validation
  if (topic.confidence < 0 || topic.confidence > 1) {
    errors.push("Confidence must be between 0.0 and 1.0");
  }
  
  const isComplete = errors.length === 0;
  return { isComplete, errors };
}
```

### Phase 3: Admin CLI Commands

New CLI tool: `worker/scripts/hot-topics-review.sh`

```bash
#!/bin/bash
# Hot topics staging review CLI

cd "$(dirname "${BASH_SOURCE[0]}")/.."

usage() {
  cat << EOF
Usage: $0 <command> [options]

Commands:
  list-staging [session]        List all pending topics (optionally filtered by session)
  review <id>                   Show details of a staging record with validation
  approve <id>                  Move record from pending to approved status
  reject <id> "reason"          Reject record with optional notes
  edit <id> --field value       Edit specific fields before approval
  promote <id>                  Move approved record to hot_topics table
  promote-batch [session]       Promote all approved records (optionally filtered by session)
  validate-pending              Validate all pending records
  audit-log <staging_id>        Show review history for a record

Examples:
  $0 list-staging 2026
  $0 review 42
  $0 approve 42
  $0 reject 42 "Confidence score too low"
  $0 edit 42 --title "Updated Title"
  $0 promote 42
  $0 promote-batch 2026
  $0 audit-log 42

EOF
  exit 1
}

# Default D1 setup
PERSIST_DIR="${PERSIST_DIR:-.wrangler-persist}"
COMMAND="${1:-}"

case "$COMMAND" in
  list-staging)
    SESSION="${2:-}"
    if [ -z "$SESSION" ]; then
      ./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --json --command "
        SELECT id, slug, title, confidence, review_status, is_complete, created_at 
        FROM hot_topics_staging 
        WHERE review_status = 'pending' 
        ORDER BY is_complete DESC, created_at ASC;" | jq '.[0].results'
    else
      ./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --json --command "
        SELECT id, slug, title, confidence, review_status, is_complete, created_at 
        FROM hot_topics_staging 
        WHERE review_status = 'pending' AND legislative_session = '$SESSION'
        ORDER BY is_complete DESC, created_at ASC;" | jq '.[0].results'
    fi
    ;;

  review)
    STAGING_ID="${2:-}"
    if [ -z "$STAGING_ID" ]; then
      echo "Error: staging ID required"
      exit 1
    fi
    ./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --json --command "
      SELECT 
        id, slug, title, summary, confidence, trigger_snippet, reason_summary,
        badge, image_url, cta_label, cta_url, priority,
        is_complete, validation_errors, review_status, reviewer_notes,
        civic_item_id, legislative_session, created_at
      FROM hot_topics_staging 
      WHERE id = $STAGING_ID;" | jq '.[0].results[0]'
    ;;

  approve)
    STAGING_ID="${2:-}"
    if [ -z "$STAGING_ID" ]; then
      echo "Error: staging ID required"
      exit 1
    fi
    ./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --command "
      UPDATE hot_topics_staging 
      SET review_status = 'approved', 
          reviewed_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = $STAGING_ID;" 2>&1
    
    # Log to audit
    ./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --command "
      INSERT INTO hot_topics_review_audit (staging_id, action, previous_status, new_status, reviewer_name, action_timestamp)
      VALUES ($STAGING_ID, 'approved', 'pending', 'approved', '$USER', datetime('now'));" 2>&1
    
    echo "✅ Approved staging record #$STAGING_ID"
    ;;

  reject)
    STAGING_ID="${2:-}"
    REASON="${3:-No reason provided}"
    if [ -z "$STAGING_ID" ]; then
      echo "Error: staging ID required"
      exit 1
    fi
    ./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --command "
      UPDATE hot_topics_staging 
      SET review_status = 'rejected', 
          reviewer_notes = '$REASON',
          reviewed_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = $STAGING_ID;" 2>&1
    
    # Log to audit
    ./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --command "
      INSERT INTO hot_topics_review_audit (staging_id, action, previous_status, new_status, reviewer_name, notes, action_timestamp)
      VALUES ($STAGING_ID, 'rejected', 'pending', 'rejected', '$USER', '$REASON', datetime('now'));" 2>&1
    
    echo "❌ Rejected staging record #$STAGING_ID"
    ;;

  promote)
    STAGING_ID="${2:-}"
    if [ -z "$STAGING_ID" ]; then
      echo "Error: staging ID required"
      exit 1
    fi
    
    # Fetch the approved record
    RECORD=$(./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --json --command "
      SELECT * FROM hot_topics_staging WHERE id = $STAGING_ID AND review_status = 'approved';" | jq -r '.[0].results[0]')
    
    if [ "$RECORD" == "null" ]; then
      echo "Error: No approved record found with ID $STAGING_ID"
      exit 1
    fi
    
    # Insert to hot_topics
    SLUG=$(echo "$RECORD" | jq -r '.slug')
    TITLE=$(echo "$RECORD" | jq -r '.title')
    SUMMARY=$(echo "$RECORD" | jq -r '.summary')
    
    ./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --command "
      INSERT OR REPLACE INTO hot_topics (slug, title, summary, badge, image_url, cta_label, cta_url, priority, is_active, created_at, updated_at)
      SELECT slug, title, summary, badge, image_url, cta_label, cta_url, priority, 1, created_at, datetime('now')
      FROM hot_topics_staging
      WHERE id = $STAGING_ID;" 2>&1
    
    # Mark staging as promoted
    ./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --command "
      UPDATE hot_topics_staging 
      SET review_status = 'promoted', updated_at = datetime('now')
      WHERE id = $STAGING_ID;" 2>&1
    
    echo "✅ Promoted '$TITLE' ($SLUG) to hot_topics"
    ;;

  promote-batch)
    SESSION="${2:-}"
    if [ -z "$SESSION" ]; then
      COUNT=$(./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --json --command "
        SELECT COUNT(*) as count FROM hot_topics_staging WHERE review_status = 'approved';" | jq -r '.[0].results[0].count')
    else
      COUNT=$(./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --json --command "
        SELECT COUNT(*) as count FROM hot_topics_staging WHERE review_status = 'approved' AND legislative_session = '$SESSION';" | jq -r '.[0].results[0].count')
    fi
    
    echo "Promoting $COUNT approved records..."
    # Insert all approved
    if [ -z "$SESSION" ]; then
      ./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --command "
        INSERT OR REPLACE INTO hot_topics (slug, title, summary, badge, image_url, cta_label, cta_url, priority, is_active, created_at, updated_at)
        SELECT slug, title, summary, badge, image_url, cta_label, cta_url, priority, 1, created_at, datetime('now')
        FROM hot_topics_staging
        WHERE review_status = 'approved';" 2>&1
      
      # Mark all as promoted
      ./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --command "
        UPDATE hot_topics_staging 
        SET review_status = 'promoted', updated_at = datetime('now')
        WHERE review_status = 'approved';" 2>&1
    else
      ./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --command "
        INSERT OR REPLACE INTO hot_topics (slug, title, summary, badge, image_url, cta_label, cta_url, priority, is_active, created_at, updated_at)
        SELECT slug, title, summary, badge, image_url, cta_label, cta_url, priority, 1, created_at, datetime('now')
        FROM hot_topics_staging
        WHERE review_status = 'approved' AND legislative_session = '$SESSION';" 2>&1
      
      # Mark all as promoted
      ./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --command "
        UPDATE hot_topics_staging 
        SET review_status = 'promoted', updated_at = datetime('now')
        WHERE review_status = 'approved' AND legislative_session = '$SESSION';" 2>&1
    fi
    
    echo "✅ Promoted $COUNT records to hot_topics"
    ;;

  audit-log)
    STAGING_ID="${2:-}"
    if [ -z "$STAGING_ID" ]; then
      echo "Error: staging ID required"
      exit 1
    fi
    ./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --json --command "
      SELECT id, action, previous_status, new_status, reviewer_name, action_timestamp, notes
      FROM hot_topics_review_audit
      WHERE staging_id = $STAGING_ID
      ORDER BY action_timestamp DESC;" | jq '.[0].results'
    ;;

  *)
    usage
    ;;
esac
```

---

## Review Workflow Example

### Scenario: Approve a hot topic before promotion

**1. List pending records**
```bash
./scripts/hot-topics-review.sh list-staging 2026
```

Output:
```json
[
  {
    "id": 1,
    "slug": "property-tax-relief",
    "title": "Property Tax Relief",
    "confidence": 0.85,
    "review_status": "pending",
    "is_complete": 1,
    "created_at": "2025-12-21T10:00:00Z"
  },
  {
    "id": 2,
    "slug": "water-rights",
    "title": "Water Rights & Drought Planning",
    "confidence": 0.55,
    "review_status": "pending",
    "is_complete": 0,
    "created_at": "2025-12-21T10:15:00Z"
  }
]
```

**2. Review a specific record**
```bash
./scripts/hot-topics-review.sh review 1
```

Output:
```json
{
  "id": 1,
  "slug": "property-tax-relief",
  "title": "Property Tax Relief",
  "summary": "Rising property assessments; proposals cap increases",
  "confidence": 0.85,
  "trigger_snippet": "... capped increases on property assessment ...",
  "reason_summary": "Bill directly addresses homeowner concerns about rising property taxes through assessment caps",
  "badge": "Taxes",
  "image_url": null,
  "cta_label": null,
  "cta_url": null,
  "priority": 100,
  "is_complete": 1,
  "validation_errors": null,
  "review_status": "pending",
  "reviewer_notes": null,
  "civic_item_id": "ocd-bill/12345",
  "legislative_session": "2026"
}
```

**3. Approve (record is complete)**
```bash
./scripts/hot-topics-review.sh approve 1
```

Output: `✅ Approved staging record #1`

**4. Promote to production**
```bash
./scripts/hot-topics-review.sh promote 1
```

Output: `✅ Promoted 'Property Tax Relief' (property-tax-relief) to hot_topics`

**5. Check audit log**
```bash
./scripts/hot-topics-review.sh audit-log 1
```

Output:
```json
[
  {
    "id": 1,
    "action": "promoted",
    "previous_status": "approved",
    "new_status": "promoted",
    "reviewer_name": "jimmy",
    "action_timestamp": "2025-12-21T10:20:00Z",
    "notes": null
  },
  {
    "id": 2,
    "action": "approved",
    "previous_status": "pending",
    "new_status": "approved",
    "reviewer_name": "jimmy",
    "action_timestamp": "2025-12-21T10:18:00Z",
    "notes": null
  }
]
```

---

## Implementation Checklist

### Phase 1: Database
- [ ] Create migration `0036_create_hot_topics_staging.sql`
- [ ] Run migration locally: `bash apply-migrations-local.sh`
- [ ] Verify tables exist and are queryable

### Phase 2: Code
- [ ] Update `hotTopicsAnalyzer.mjs` with `validateTopicRecord()` function
- [ ] Modify `saveHotTopicAnalysis()` to write to staging table
- [ ] Add validation error handling and JSON serialization
- [ ] Test locally: run analyzer against test bill

### Phase 3: CLI
- [ ] Create `worker/scripts/hot-topics-review.sh`
- [ ] Test all commands: list, review, approve, reject, promote
- [ ] Test batch promotion: `promote-batch 2026`
- [ ] Verify audit logs are created

### Phase 4: Integration
- [ ] Update ingestion pipeline docs
- [ ] Add staging review step to deployment checklist
- [ ] Document new CLI commands in README
- [ ] Train admin user(s) on review workflow

---

## Key Benefits

1. **Quality Gate**: Only complete, validated records become user-facing
2. **Audit Trail**: All review actions logged for accountability
3. **Flexibility**: Reject low-confidence matches without manual deletion
4. **Manual Review**: Admin can spot-check AI decisions before publication
5. **Transparency**: Users can understand why a topic was selected (reason_summary)
6. **Scalability**: Easy to promote batches as pipeline matures

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Staging table grows unbounded | Add retention policy: auto-delete promoted/rejected >30 days old |
| Admin forgets to promote | Add dashboard showing pending count; integrate with Slack alerts |
| Data loss during promotion | Audit log captures all actions; staging record preserved as "promoted" |
| Low confidence matches | Validation errors flag confidence <0.5; can be bulk-rejected |
| UI bypass (direct insert to hot_topics) | Code review; no direct inserts from ingestion; staging-only flow |

---

## Rollback Plan

If staging workflow causes issues:

1. **Revert migrations**: Delete `0036_*` migration, re-run `apply-migrations-local.sh`
2. **Restore old code**: Revert `hotTopicsAnalyzer.mjs` to write directly to `civic_item_ai_tags`
3. **Clear staging**: `DELETE FROM hot_topics_staging` (audit log preserved)
4. **Resume operations**: Ingestion continues with old flow

---

## Next Steps

1. Review this design with team
2. Implement database migrations
3. Update ingestion code
4. Test workflow locally
5. Document for admins
6. Deploy with gating (only use staging for new sessions; existing hot_topics unchanged)
