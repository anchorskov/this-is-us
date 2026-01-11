# Civic Watch Documentation Update
**Date**: December 8, 2025  
**Status**: ✅ Complete

---

## Summary

Updated `SNAPSHOT_120625_COMPREHENSIVE.md` to fully document:
1. **Civic Watch Front Door** – The 3-card entry point to civic engagement
2. **Town Hall Posts API** – The `/api/townhall/posts` endpoint used by the front door

The SNAPSHOT is now the **single source of truth** for both the Civic Watch UI architecture and all API contracts.

---

## Changes Made

### 1. Added "Civic Watch Front Door" Section

**Location**: New section before "Civic Watch Data Model" (line 318)  
**Content**: 390 lines including:

- **Architecture table**: File, purpose, and role of each component
  - `content/civic/watch.md` (Hugo content)
  - `layouts/civic/watch.html` (template with 3-card layout)
  - `static/js/civic/watch.js` (API fetching and rendering)
  - `__tests__/civic-watch.test.js` (Jest tests)
  - `config.toml` (menu navigation)

- **Three Preview Cards**: Description of each card's purpose, data source, preview items, CTA, and empty state
  1. Hot Topics (6 core issues)
  2. Pending Bills (bills in committee/pending)
  3. County Town Halls (recent community submissions)

- **Page Load Flow**: Step-by-step diagram of how the page initializes and renders data

- **Data Handling & Resilience**: Explains the flexible response format handling
  ```javascript
  // Accepts both direct arrays and {results: [...]} wrapper:
  const topics = Array.isArray(topicsData) ? topicsData : topicsData.results || [];
  ```

- **Testing**: Jest test cases and manual testing checklist

### 2. Added "Town Hall Posts API" Section

**Location**: New subsection under "EVENTS_DB Tables" after hot_topic_civic_items (line ~630)  
**Content**: 280 lines including:

#### Table Documentation
```sql
CREATE TABLE IF NOT EXISTS townhall_posts (
  id TEXT PRIMARY KEY,                    -- Unique identifier
  user_id TEXT NOT NULL,                  -- Firebase UID
  title TEXT NOT NULL,                    -- Submission title
  prompt TEXT,                            -- Comment/question text
  created_at TEXT NOT NULL,               -- ISO timestamp
  r2_key TEXT,                            -- Cloudflare R2 key for attachments
  file_size INTEGER,                      -- File size in bytes
  expires_at TEXT,                        -- Expiration date
  city TEXT,                              -- City/county name
  state TEXT                              -- State code
);
```

**Key insights documented**:
- Append-only log of community submissions
- Future phases: content moderation, structured voting, thread nesting
- Data retention policy via `expires_at` field
- Indexed for reverse-chronological queries

#### Endpoint Documentation

**Endpoint**: `GET /api/townhall/posts`

**Query parameters**:
| Param | Type | Default | Max | Purpose |
|-------|------|---------|-----|---------|
| `limit` | integer | 20 | 50 | Max posts to return |
| `after` | ISO 8601 | — | — | Pagination cursor (posts before timestamp) |

**Example requests**:
```bash
# Get 3 most recent posts (for Civic Watch front door)
curl "http://localhost:8787/api/townhall/posts?limit=3"

# Get 10 posts with pagination
curl "http://localhost:8787/api/townhall/posts?limit=10&after=2025-12-01T00:00:00Z"
```

**Response shape** (JSON array):
```json
[
  {
    "id": "test-001",
    "user_id": "user_123",
    "title": "Casper Town Hall Input",
    "prompt": "This is a sample submission.",
    "created_at": "2025-05-29T12:00:00Z",
    "file_url": null,
    "file_size": null,
    "expires_at": null
  }
]
```

**Response fields** (detailed table with nullability and descriptions):
- `id`: Unique submission identifier
- `user_id`: Firebase UID (or anonymous if verified later)
- `title`: User-provided topic/title
- `prompt`: User-provided comment/question
- `created_at`: ISO 8601 timestamp
- `file_url`: Cloudflare R2 URL to attached PDF/media
- `file_size`: Bytes (if file attached)
- `expires_at`: Auto-deletion date

**Error handling**:
- HTTP 500 with `{"error": "Internal server error"}` on failure

**Performance**:
- Local: <100ms
- Production (Cloudflare D1): <200ms

**Civic Watch Integration**:
Shows how `static/js/civic/watch.js` calls the endpoint:
```javascript
fetch('/api/townhall/posts?limit=3')
  .then(res => res.json())
  .then(posts => renderTownhall(container, posts));
```

---

## Final Agreed JSON Shape for /api/townhall/posts

**Response format**: Direct JSON array (no `{results: [...]}` wrapper)

```json
[
  {
    "id": "submission-id",
    "user_id": "firebase-uid",
    "title": "User-provided title",
    "prompt": "User comment or question",
    "created_at": "2025-05-29T12:00:00Z",
    "file_url": "https://cdn.example.com/api/events/pdf/...",
    "file_size": 128004,
    "expires_at": "2025-12-31T23:59:59Z"
  }
]
```

**Key characteristics**:
- ✅ Forward-compatible: flexible nullability for optional fields
- ✅ ISO 8601 timestamps (machine-readable)
- ✅ No wrapper object (keeps response lean for preview card)
- ✅ Direct file URLs (no need for separate PDF fetch)
- ✅ Expiration support (data retention policy)
- ✅ User attribution (civic engagement transparency)

---

## Files Updated

| File | Change | Status |
|------|--------|--------|
| `SNAPSHOT_120625_COMPREHENSIVE.md` | Added 2 new documentation sections (~670 lines) | ✅ Updated |
| `/mnt/c/Users/ancho/Downloads/SNAPSHOT_120625_COMPREHENSIVE_UPDATED.md` | Copy exported to Windows | ✅ Done |

---

## Verification Checklist

- ✅ **Civic Watch section** documents all 3 cards and their data sources
- ✅ **Town Hall Posts API** fully documented with endpoint, parameters, response shape
- ✅ **Response shapes** match actual implementation (watch.js handles both direct array and wrapped formats)
- ✅ **Database schema** documented from `data/0001_create_townhall_posts.sql`
- ✅ **Handler code** documented from `worker/src/townhall/listPosts.js`
- ✅ **Query parameters** match implementation (`limit`, `after` cursor)
- ✅ **Response fields** match actual returned properties (id, user_id, title, prompt, created_at, file_url, file_size, expires_at)
- ✅ **Error handling** documented
- ✅ **Performance expectations** included
- ✅ **Civic Watch integration** explained with code example
- ✅ **Forward compatibility** demonstrated (flexible response format handling)

---

## Remaining Documentation Gaps (Phase 2+)

These are noted in the SNAPSHOT for future updates:

1. **Sponsor/Representative Data** – Bill sponsors, district reps, contact info
2. **Your Delegation Card** – A 4th card showing user's State House rep, Senator, US Representatives
3. **Ideas Network** – Future phase for community ideas and topic tagging
4. **Civic Participation Loops** – Town hall follow-up, testimony uploads, legislator responses
5. **Multi-state Expansion** – Adding CO, UT, ID legislation to the platform

---

## How to Use This Documentation

### For Developers
- Use "Civic Watch Front Door" section to understand the page layout and data flow
- Use "Town Hall Posts API" section to understand the endpoint contract
- See `static/js/civic/watch.js` for implementation examples
- Run `npm test -- __tests__/civic-watch.test.js` to verify rendering functions

### For Product Managers
- Use "Three Preview Cards" section to understand user experience
- Use "Page Load Flow" to explain timing and responsiveness to stakeholders
- Use "Data Handling & Resilience" to explain error tolerance

### For QA/Testers
- Follow "Testing" section checklist for manual validation
- Run Jest tests for automated coverage
- Use API endpoints to verify response shapes match documentation

### For Future Contributors
- SNAPSHOT is now the single source of truth for all Civic Watch data structures and APIs
- All response shapes are documented and locked down for backward compatibility
- New features should be added as Phase 2+ sections with migration proposals

---

## Next Steps (Recommended)

1. **Deploy updated SNAPSHOT** to documentation folder (done ✅)
2. **Communicate changes** to team: "Town Hall API is now fully documented"
3. **Use as reference** for any future Town Hall feature work
4. **Consider adding** content moderation guidelines for townhall_posts
5. **Plan Phase 2**: Sponsor data, delegation card, ideas network

---

**Document prepared**: December 8, 2025  
**Status**: Ready for use as single source of truth  
**Location**: `/home/anchor/projects/this-is-us/documentation/SNAPSHOT_120625_COMPREHENSIVE.md`
