# Documentation Index

**Last Updated:** December 21, 2025

## Core Documentation

### 1. LSO Ingestion Process
**File:** `LSO_INGESTION_PROCESS.md`  
**Size:** 33 KB (1,218 lines)  
**Purpose:** Comprehensive guide to the Wyoming bill ingestion pipeline

**Sections:**
- Phase 1: Bill Enumeration (LSO API discovery)
- Phase 2: Summary Generation (OpenAI-powered plain-language summaries)
- Phase 3: Hot Topics Detection (AI + heuristic topic categorization)
- Phase 4: Admin Review (Manual approval workflow)
- Phase 5: Publishing (Move to production)
- Complete timeline example
- Configuration & tuning
- Error handling & recovery
- Testing & validation
- Future enhancements

**Key Topics:**
- LSO API integration
- OpenAI summary generation with fallback sources
- Heuristic topic extraction (TF-IDF bigrams)
- Topic confidence scoring (0-1 scale)
- Admin review dashboard
- Draft → Production publishing workflow
- Database schema and SQL examples
- Error recovery procedures

**When to Read:** Understand how bills are discovered, processed, and presented to admins

---

### 2. Database Snapshot
**File:** `instructions/database_snapshot_12-21-25.md`  
**Size:** 17 KB (539 lines)  
**Purpose:** Current state of all D1 databases with verified schemas

**Databases:**
- **EVENTS_DB:** Primary application database (21 tables, 28 migrations)
- **WY_DB:** Wyoming civic data (31 core tables, 38 migrations)
- **BALLOT_DB:** Unused (0 tables)

**Key Tables:**
- `civic_items` - Wyoming bills with AI summaries
- `hot_topics_draft` - Draft topics pending admin review
- `hot_topics` - Production topics (published)
- `hot_topic_civic_items_draft` - Draft bill-topic links
- `hot_topic_civic_items` - Production bill-topic links
- `ingestion_runs` - Batch processing metadata

**Status:** ✅ All 38 migrations applied to WY_DB, ✅ All 28 migrations applied to EVENTS_DB

**When to Read:** Verify database structure, confirm schema matches expectations, track migration status

---

### 3. Snapshot Update Summary
**File:** `SNAPSHOT_UPDATE_SUMMARY.md`  
**Size:** 5.3 KB  
**Purpose:** Changelog highlighting what changed since Dec 14

**Key Changes:**
- Migration status corrected (5→38 for WY_DB, 6→28 for EVENTS_DB)
- New hot topics draft workflow documented
- Ingestion pipeline test results included
- Admin UI implementation documented
- Known issues and next steps listed

**When to Read:** See what's been updated since last snapshot

---

## Implementation Details

### Bill Enumeration
**Source:** `worker/src/routes/adminWyoleg.mjs` → `runAdminScan()`

**Process:**
```
POST /api/internal/admin/wyoleg/run
  → phase: "enumerate"
  → Query Wyoming Legislature LSO API
  → Create civic_items records
  → Track in ingestion_runs
```

**Test Result:** 49 bills enumerated for 2026 session ✅

---

### Summary Generation
**Source:** `worker/src/lib/billSummaryAnalyzer.mjs` → `ensureBillSummary()` → `analyzeBillSummary()`

**Process:**
```
1. Try LSO HTML (most authoritative)
2. Try bill text_url (non-PDF)
3. Try PDF extraction (Workers AI)
4. Try OpenStates API (fallback)
5. Try title-only analysis (last resort)
6. Call OpenAI for summary
7. Parse and validate response
8. Save to civic_items
```

**Test Result:** 5 summaries generated, 100% success ✅

---

### Topic Detection
**Source:** `worker/src/lib/billSummaryAnalyzer.mjs` → `ensureHotTopicForBill()`

**Process:**
```
1. Generate heuristic candidates (TF-IDF bigrams)
2. Call OpenAI with candidates + summary
3. Normalize and validate topics
4. Check for existing links
5. Insert to hot_topics_draft (status: 'draft')
6. Create links in hot_topic_civic_items_draft
```

**Test Result:** 5 bills → 3-6 topics each, 95% average confidence ✅

---

### Admin Review
**Source:** `static/js/admin/hot-topics.js` + `worker/src/routes/adminHotTopics.mjs`

**Endpoints:**
- `GET /api/admin/hot-topics/drafts` - List draft topics
- `POST /api/admin/hot-topics/drafts/:id` - Edit topic
- `POST /api/admin/hot-topics/drafts/:id/approve` - Approve
- `POST /api/admin/hot-topics/drafts/:id/reject` - Reject
- `POST /api/admin/hot-topics/publish` - Publish to production

**Admin Actions:**
- Edit title and description
- Add official_url (PDF/document links)
- Review linked bills
- Approve or reject topics

---

### Publishing
**Source:** `worker/src/routes/adminHotTopics.mjs` → `handlePublishTopics()`

**Process:**
```
1. Validate topics are approved
2. Copy to hot_topics (production)
3. Copy links to hot_topic_civic_items
4. Update draft status to 'published'
5. Log to hot_topics_review_audit
6. Make topics public via /api/hot-topics
```

---

## Quick Reference

### API Endpoints

#### Ingestion Control
```bash
# Full cycle
POST /api/internal/admin/wyoleg/run
  {"session":"2026","phase":"all","limit":5,"force":true}

# Individual phases
POST /api/internal/admin/wyoleg/run
  {"session":"2026","phase":"enumerate"}

POST /api/internal/admin/wyoleg/run
  {"session":"2026","phase":"scan","limit":5}

POST /api/internal/admin/wyoleg/run
  {"session":"2026","phase":"topics","limit":5}
```

#### Admin Dashboard
```bash
# List draft topics
GET /api/admin/hot-topics/drafts
  [Headers: Authorization: Bearer <token>]

# Edit topic
POST /api/admin/hot-topics/drafts/{id}
  {"title":"...","official_url":"..."}

# Approve topic
POST /api/admin/hot-topics/drafts/{id}/approve

# Reject topic
POST /api/admin/hot-topics/drafts/{id}/reject
  {"reason":"Too similar to existing topic"}

# Publish topics
POST /api/admin/hot-topics/publish
  {"topicIds":["550e8400-..."],"session":"2026"}
```

#### Public API
```bash
# List published topics
GET /api/hot-topics?session=2026
  → Returns only topics with is_active=1
  → Excludes draft, rejected, invalidated topics
```

---

## Database Tables (Quick Reference)

### civic_items
- Holds Wyoming bills from enumeration
- 49 bills in 2026 session (test DB)
- Fields: id, bill_number, title, ai_summary, ai_key_points, summary_error, summary_source
- PK: id (e.g., "2026_HB0024")

### hot_topics_draft
- Draft topics from AI ingestion + manual creation
- Status: draft/approved/rejected/published
- Fields: id, title, label_short, status, ai_source, source_run_id, official_url
- PK: id (UUID)

### hot_topic_civic_items_draft
- Links between draft topics and bills
- Fields: id, topic_id, civic_item_id, confidence, ai_source, legislative_session
- UNIQUE: (topic_id, civic_item_id)

### hot_topics
- Production topics (published)
- Fields: id, title, is_active, created_at
- PK: id (UUID)

### hot_topic_civic_items
- Production bill-topic links
- Fields: id, topic_id, civic_item_id, confidence, source
- PK: id (UUID)

### ingestion_runs
- Tracks batch processing metadata
- Fields: id, session, phase, started_at, finished_at, bill_count, summary_count, topic_count
- PK: id (UUID)

---

## Testing Checklist

### Manual Testing (Dec 21, 2025) ✅
- [x] Bill enumeration (49 bills)
- [x] Summary generation (5 summaries)
- [x] Topic detection (3-6 per bill)
- [x] Persistence to draft table
- [x] Draft bill links created
- [x] All data verified in database

### Automated Tests (Framework Ready)
- [ ] Schema validation tests
- [ ] Data integrity tests
- [ ] API endpoint tests
- [ ] E2E workflow tests
- [ ] Performance benchmarks

### Outstanding Issues
- ⚠️ Public `/api/hot-topics` endpoint has SQL parameter binding error (needs fix)
- ⚠️ Old `hot_topics_staging` table still exists (pending removal)
- ⚠️ EVENTS_DB test database is empty (needs seed data)

---

## File Structure

```
/home/anchor/projects/this-is-us/
├── LSO_INGESTION_PROCESS.md          ← Comprehensive ingestion guide
├── SNAPSHOT_UPDATE_SUMMARY.md         ← What changed since Dec 14
├── instructions/
│   ├── database_snapshot_12-21-25.md  ← Current DB state (12/21)
│   ├── database_snapshot_12-14-25.md  ← Previous snapshot (archived)
│   └── database_snapshot_12-3-25.md   ← Earlier snapshot (archived)
│
├── worker/
│   ├── src/lib/
│   │   ├── billSummaryAnalyzer.mjs    ← Summary + topic generation
│   │   ├── hotTopicsAnalyzer.mjs      ← Topic detection logic
│   │   └── docResolver/
│   │       └── index.mjs              ← PDF/HTML text extraction
│   │
│   ├── src/routes/
│   │   ├── adminWyoleg.mjs            ← Ingestion orchestration
│   │   ├── civicScan.mjs              ← Scan phase implementation
│   │   ├── adminHotTopics.mjs         ← Admin review endpoints
│   │   └── hotTopics.mjs              ← Public API
│   │
│   ├── migrations_wy/                 ← 38 migrations for WY_DB
│   ├── migrations/                    ← 28 migrations for EVENTS_DB
│   └── static/js/admin/
│       └── hot-topics.js              ← Admin UI
│
└── [Other docs]
    ├── BILL_SCANNER_IMPLEMENTATION_COMPLETE.md
    ├── HOT_TOPICS_*.md
    └── [Archive of implementation docs]
```

---

## Getting Started

### For Developers
1. Read `LSO_INGESTION_PROCESS.md` for architecture overview
2. Review `instructions/database_snapshot_12-21-25.md` for schema
3. Check test results in "Testing & Validation" sections
4. Reference specific phase docs as needed

### For Admins
1. Learn the draft review process in Phase 4 of `LSO_INGESTION_PROCESS.md`
2. Use admin dashboard at `/admin/hot-topics/`
3. Approve/reject draft topics from ingestion
4. Publish approved topics to make them public

### For DevOps
1. Review migration status in `database_snapshot_12-21-25.md`
2. Verify all 38 WY_DB migrations are applied
3. Monitor `ingestion_runs` table for batch health
4. Set up periodic ingestion (nightly recommended)

---

## Support & Issues

### Known Issues (Dec 21, 2025)
1. **SQL Error in Public API**
   - Endpoint: `GET /api/hot-topics?session=2026`
   - Issue: Parameter binding error
   - Status: 🔴 NEEDS FIX
   - Impact: Medium (affects public topic discovery)

2. **Deprecated Table**
   - Table: `hot_topics_staging`
   - Issue: Unused, conflicts with draft workflow
   - Status: 🟡 PENDING REMOVAL
   - Impact: Low (admin only, no production data)

3. **Empty Test Database**
   - Database: EVENTS_DB (local)
   - Issue: No seed data for testing
   - Status: 🟡 PENDING SEED DATA
   - Impact: Low (test environment only)

### Contact
- **Primary:** Jimmy (anchor.dev)
- **Repo:** /home/anchor/projects/this-is-us
- **Last Verified:** December 21, 2025, 2:51 UTC

---

**This index was created December 21, 2025**  
**All documents verified against live databases**
