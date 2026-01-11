# Hot Topics Staging Implementation - Quick Start

**Status**: Ready for Implementation  
**Created**: 2025-12-21  

---

## Overview

This implementation introduces a **staging table and admin CLI workflow** to ensure all hot topics are complete and validated before being published to users.

### Key Insight from Repo Goal
The project mission is to empower civic unity through **transparent, accessible technology** with emphasis on **integrity, accountability, and transparency**. The staging workflow ensures:

- ✅ **Transparency**: Every hot topic decision is audited
- ✅ **Accountability**: Admin reviews and approvals are logged
- ✅ **Integrity**: Only complete, validated records are published
- ✅ **Accessibility**: Users see accurate, curated topics (not raw AI output)

---

## Files Created / Modified

### New Files (3)

1. **[HOT_TOPICS_STAGING_IMPLEMENTATION.md](HOT_TOPICS_STAGING_IMPLEMENTATION.md)**
   - Complete design document
   - Workflow examples
   - Risk mitigation strategies

2. **[worker/migrations/0036_create_hot_topics_staging.sql](worker/migrations/0036_create_hot_topics_staging.sql)**
   - Creates `hot_topics_staging` table
   - Creates `hot_topics_review_audit` table
   - Includes validation rules and verification queries

3. **[worker/src/lib/hotTopicsValidator.mjs](worker/src/lib/hotTopicsValidator.mjs)**
   - Validation functions
   - Staging/production promotion logic
   - Audit logging

4. **[worker/scripts/hot-topics-review.sh](worker/scripts/hot-topics-review.sh)**
   - Admin CLI tool
   - Commands: list, review, approve, reject, promote, batch operations

### Modified Files (0)

- No existing files require modification yet
- When ingestion code is updated, will modify `hotTopicsAnalyzer.mjs` to use staging table

---

## Current Hot Topics Population Flow

```
Bills (civic_items)
       ↓
  AI Analysis (analyzeBillForHotTopics)
       ↓
  civic_item_ai_tags (direct insert - NO REVIEW)
       ↓
  hot_topic_civic_items (links to civic_items)
       ↓
  User-Visible hot_topics
```

### Issue with Current Flow
- No validation that record is "complete" (all required fields present)
- No admin review before topics become visible
- AI confidence scores not checked for minimum threshold
- Low-quality matches directly published to users

---

## Proposed Hot Topics Population Flow

```
Bills (civic_items)
       ↓
  AI Analysis (analyzeBillForHotTopics)
       ↓
  validateTopicRecord() ← NEW: Validation gate
       ↓
  hot_topics_staging ← NEW: Holding table
       ↓
  Admin Review CLI ← NEW: Manual approval
       ↓
  hot_topics (promote only approved + complete records)
       ↓
  User-Visible hot_topics
```

---

## Implementation Steps

### Step 1: Apply Migration (1 minute)

```bash
cd /home/anchor/projects/this-is-us/worker
bash scripts/apply-migrations-local.sh
```

Verify:
```bash
./scripts/wr d1 execute WY_DB --local --persist-to .wrangler-persist --json --command "
  SELECT name FROM sqlite_master 
  WHERE type='table' AND (name='hot_topics_staging' OR name='hot_topics_review_audit');"
```

### Step 2: Test Admin CLI (5 minutes)

Make the script executable:
```bash
chmod +x worker/scripts/hot-topics-review.sh
```

Test commands:
```bash
# List pending (should be empty initially)
worker/scripts/hot-topics-review.sh list-staging

# Show stats
worker/scripts/hot-topics-review.sh stats

# Try help
worker/scripts/hot-topics-review.sh --help
```

### Step 3: Update Ingestion Code (15 minutes)

Modify `worker/src/lib/hotTopicsAnalyzer.mjs`:

**Change**: Update `saveHotTopicAnalysis()` to use staging table

```javascript
// OLD (before)
export async function saveHotTopicAnalysis(env, billId, analysis) {
  const { topics = [] } = analysis || {};
  if (topics.length > 0) {
    // Writes directly to civic_item_ai_tags
    ...
  }
}

// NEW (after)
import { saveTopicToStaging, validateTopicRecord } from "./hotTopicsValidator.mjs";

export async function saveHotTopicAnalysis(env, billId, analysis) {
  const { topics = [] } = analysis || {};
  if (topics.length > 0) {
    for (const topic of topics) {
      // Write to staging table for review
      const result = await saveTopicToStaging(
        env,
        billId,
        topic,
        "openai",
        analysis.legislative_session
      );
      
      if (!result.success) {
        console.warn(`⚠️ Failed to stage topic: ${result.error}`);
      } else if (!result.validation.isComplete) {
        console.warn(`⚠️ Topic incomplete: ${result.validation.errors.join(", ")}`);
      }
    }
  }
}
```

### Step 4: Test with Real Data (10 minutes)

**Scenario**: Run ingestion pipeline and review staged records

```bash
# 1. Run enumeration and scanning (existing pipeline)
curl -sS -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run \
  -H "Content-Type: application/json" \
  -d '{"session":"2026","phase":"scan","limit":5}' | jq .

# 2. Check staging table
worker/scripts/hot-topics-review.sh list-staging 2026

# 3. Review a record
worker/scripts/hot-topics-review.sh review 1

# 4. Approve
worker/scripts/hot-topics-review.sh approve 1

# 5. Promote
worker/scripts/hot-topics-review.sh promote 1

# 6. Verify in production
./scripts/wr d1 execute WY_DB --local --persist-to .wrangler-persist --json --command \
  "SELECT COUNT(*) as count FROM hot_topics;"
```

---

## Completeness Validation Rules

A record is "complete" and ready for promotion if ALL required fields are present:

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `slug` | string | ✅ YES | Must match canonical topic (property-tax-relief, water-rights, etc.) |
| `title` | string | ✅ YES | Human-readable title (e.g., "Property Tax Relief") |
| `confidence` | number | ✅ YES | Between 0.0 and 1.0; flags < 0.5 as warning |
| `trigger_snippet` | string | ✅ YES | Direct quote/paraphrase from bill text |
| `reason_summary` | string | ✅ YES | 1–3 sentences explaining the match |
| `summary` | string | ⚠️ RECOMMENDED | Short description |
| `badge` | string | ⚠️ RECOMMENDED | Category label (e.g., "Taxes") |
| `image_url` | string | ❌ OPTIONAL | Can be added by design team later |
| `priority` | number | ❌ OPTIONAL | Defaults to 100 |

---

## Admin CLI Commands Reference

```bash
# List all pending topics (for session 2026)
worker/scripts/hot-topics-review.sh list-staging 2026

# View details of a specific record
worker/scripts/hot-topics-review.sh review 42

# Approve a record (move from pending → approved)
worker/scripts/hot-topics-review.sh approve 42

# Reject a record with reason
worker/scripts/hot-topics-review.sh reject 42 "Confidence too low (0.35)"

# Promote approved record to production
worker/scripts/hot-topics-review.sh promote 42

# Batch promote all approved records for a session
worker/scripts/hot-topics-review.sh promote-batch 2026

# Show staging statistics
worker/scripts/hot-topics-review.sh stats 2026

# View review history for a record
worker/scripts/hot-topics-review.sh audit-log 42
```

---

## Example Workflow: One Hot Topic

### Step 1: Record created in staging

AI analyzer finds that bill HB 42 matches "property-tax-relief" topic with 0.85 confidence.

```json
{
  "id": 1,
  "slug": "property-tax-relief",
  "title": "Property Tax Relief",
  "summary": "Rising assessments squeezed homeowners; bill proposes cap on annual increases",
  "confidence": 0.85,
  "trigger_snippet": "...no property assessment shall increase more than 3% annually...",
  "reason_summary": "This bill directly addresses homeowner concerns about rising property taxes by capping annual assessment increases to 3%. This is a core issue for Wyoming property owners.",
  "badge": "Taxes",
  "review_status": "pending",
  "is_complete": 1,
  "created_at": "2025-12-21T10:00:00Z"
}
```

### Step 2: Admin reviews

```bash
$ worker/scripts/hot-topics-review.sh review 1
# (displays full record above)
```

**Admin decision**: Record looks good. All required fields present. Confidence > 0.8 (high). Approve it.

### Step 3: Admin approves

```bash
$ worker/scripts/hot-topics-review.sh approve 1
✅ Approved staging record #1: Property Tax Relief
```

Internally:
- Updates `review_status` from "pending" → "approved"
- Sets `reviewed_at` to current timestamp
- Logs action to `hot_topics_review_audit`

### Step 4: Admin promotes

```bash
$ worker/scripts/hot-topics-review.sh promote 1
✅ Promoted 'Property Tax Relief' (property-tax-relief) to hot_topics
```

Internally:
- Inserts record to `hot_topics` table
- Sets `is_active = 1` (now visible to users)
- Updates staging `review_status` → "promoted"
- Logs promotion action to audit

### Step 5: Topic is now live

Users visiting `/hot-topics/` see "Property Tax Relief" with:
- Title: "Property Tax Relief"
- Summary: "Rising assessments squeezed homeowners..."
- Link to related bills with confidence > 0.85

### Step 6: Audit trail preserved

```bash
$ worker/scripts/hot-topics-review.sh audit-log 1
[2025-12-21T10:05:00Z] PROMOTED by jimmy (approved → promoted)
[2025-12-21T10:02:00Z] APPROVED by jimmy (pending → approved)
```

---

## Batch Operations Example

### Scenario: Approve and promote 5 complete topics at once

```bash
# List all pending (shows 5 complete, 3 incomplete)
$ worker/scripts/hot-topics-review.sh list-staging 2026
ID: 1 | property-tax-relief | Property Tax Relief | Confidence: 0.85 | Complete: 1
ID: 2 | water-rights | Water Rights | Confidence: 0.78 | Complete: 1
ID: 3 | education-funding | Education Funding | Confidence: 0.82 | Complete: 1
ID: 4 | energy-permitting | Energy Permitting | Confidence: 0.45 | Complete: 0
ID: 5 | public-safety | Public Safety | Confidence: 0.91 | Complete: 1
ID: 6 | housing-land-use | Housing & Land Use | Confidence: 0.72 | Complete: 1
ID: 7 | empty-title |  | Confidence: 0.60 | Complete: 0

# Approve the 5 complete records individually OR script batch approval
for id in 1 2 3 5 6; do
  worker/scripts/hot-topics-review.sh approve $id
done

# Batch promote all approved records
$ worker/scripts/hot-topics-review.sh promote-batch 2026
ℹ️ Fetching approved records...
ℹ️ Promoting 5 approved records...
✅ Promoted 5 records to hot_topics

# Check stats
$ worker/scripts/hot-topics-review.sh stats 2026
Status       | Total | Complete | Incomplete
pending      |     2 |        0 |          2
approved     |     0 |        0 |          0
promoted     |     5 |        5 |          0
```

---

## Integration with Existing Pipeline

### Current Endpoints (No changes needed)

- ✅ `POST /api/internal/admin/wyoleg/run` (enumeration + scanning)
  - Still writes to `civic_item_ai_tags` for backward compatibility
  - NEW: Also writes to `hot_topics_staging` for review

- ✅ `GET /api/hot-topics` (list topics)
  - Reads from production `hot_topics` (unchanged)

- ✅ `GET /api/hot-topics/:slug` (get topic detail)
  - Reads from production `hot_topics` (unchanged)

### New Admin Tools

- 🆕 `worker/scripts/hot-topics-review.sh` (review CLI)
- 🆕 Admin dashboard (future - would query staging table)

---

## Data Model Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│ Staging Workflow (NEW)                                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  hot_topics_staging (AI output + validation)                    │
│  ├── id, slug, title, summary, confidence, ...                  │
│  ├── civic_item_id (FK to civic_items)                          │
│  ├── review_status: pending → approved → promoted               │
│  └── is_complete: 1 (valid) or 0 (needs review)                 │
│                                                                  │
│  hot_topics_review_audit (immutable log)                        │
│  ├── staging_id, action, timestamp                              │
│  ├── Actions: approved, rejected, promoted, edited              │
│  └── Reviewer: username, email                                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ Production Tables (EXISTING - unchanged schema)                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  hot_topics (curated, user-visible)                             │
│  ├── id, slug, title, summary, badge, image_url, ...           │
│  ├── priority (for display order)                               │
│  └── is_active: 1 (visible) or 0 (hidden)                       │
│                                                                  │
│  hot_topic_civic_items (junction)                              │
│  ├── topic_id, civic_item_id, confidence                        │
│  └── Source bills linked to each topic                          │
│                                                                  │
│  civic_item_ai_tags (bill metadata)                             │
│  ├── item_id, topic_slug, confidence                            │
│  └── Historical topic matches for analytics                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## FAQ

**Q: Will this slow down the ingestion pipeline?**  
A: No. The staging write is fast (one INSERT per topic). Admin reviews happen asynchronously via CLI.

**Q: What if an admin forgets to promote records?**  
A: Future: Add a dashboard showing pending count. For now, use `list-staging` to see what's waiting.

**Q: Can I revert a promotion?**  
A: Manually: DELETE from hot_topics (marked as "unpromoted" in staging). Audit log preserved.

**Q: What happens to rejected records?**  
A: Kept in staging table with status="rejected" + reviewer_notes. Can edit and re-approve later.

**Q: Who can approve topics?**  
A: Anyone with local CLI access. Future: Add RBAC (role-based access control).

**Q: Can I edit a topic before promoting?**  
A: Currently: No (would need edit command). Workaround: Reject + create new record with corrected data.

---

## Next Steps

1. ✅ Review this design (you are here)
2. ⏳ Apply migration: `bash apply-migrations-local.sh`
3. ⏳ Test CLI locally: `worker/scripts/hot-topics-review.sh list-staging`
4. ⏳ Update `hotTopicsAnalyzer.mjs` to write to staging
5. ⏳ Test with real ingestion pipeline
6. ⏳ Deploy with monitoring
7. ⏳ Document for admin users

---

**Questions?** See [HOT_TOPICS_STAGING_IMPLEMENTATION.md](HOT_TOPICS_STAGING_IMPLEMENTATION.md) for full design details.
