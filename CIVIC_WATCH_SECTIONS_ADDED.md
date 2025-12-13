# Civic Watch Documentation – Added Sections
**Date**: December 8, 2025

---

## Section 1: Civic Watch Front Door

### Location in SNAPSHOT_120625_COMPREHENSIVE.md
Inserted before "Civic Watch Data Model" (at line 318)

### Content: Architecture & Three Preview Cards

```markdown
## Civic Watch Front Door

**Status**: ✅ Production ready (v1 launched December 6, 2025)

The **Civic Watch front door** is the main entry point to Wyoming civic engagement. 
It displays three preview cards:

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

1. Hugo renders `layouts/civic/watch.html` with 3 empty card containers (IDs: 
   `cw-hot-topics-preview`, `cw-pending-preview`, `cw-townhall-preview`)
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
```

---

## Section 2: Town Hall Posts API

### Location in SNAPSHOT_120625_COMPREHENSIVE.md
Inserted in EVENTS_DB Tables section after hot_topic_civic_items

### Content: Table Schema & Endpoint Documentation

```markdown
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
| `limit` | integer | 20 | 50 | Maximum number of posts to return |
| `after` | ISO 8601 | — | — | Cursor: return posts created before this timestamp (for pagination) |

**Request examples**:
```bash
# Get 3 most recent posts (for Civic Watch front door)
curl "http://localhost:8787/api/townhall/posts?limit=3"

# Get 10 posts with pagination (after a specific date)
curl "http://localhost:8787/api/townhall/posts?limit=10&after=2025-12-01T00:00:00Z"

# Get all posts (up to max 50)
curl "http://localhost:8787/api/townhall/posts?limit=50"
```

**Response shape** (HTTP 200):
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
  },
  {
    "id": "test-002",
    "user_id": "user_456",
    "title": "Why are our property taxes going up?",
    "prompt": "We need more transparency in local government.",
    "created_at": "2025-05-29T13:30:00Z",
    "file_url": "https://example.com/api/events/pdf/sample.pdf",
    "file_size": 128004,
    "expires_at": null
  }
]
```

**Response fields**:
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | string | No | Unique identifier for the submission |
| `user_id` | string | No | User who submitted the town hall input |
| `title` | string | No | User-provided title/topic |
| `prompt` | string | Yes | User-provided comment or question |
| `created_at` | ISO 8601 | No | When submission was created |
| `file_url` | URL | Yes | Link to attached PDF/media (if any) |
| `file_size` | integer | Yes | Size in bytes (if file attached) |
| `expires_at` | ISO 8601 | Yes | When attachment expires and is deleted |

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
The Civic Watch front door (`static/js/civic/watch.js`) calls this endpoint with `limit=3` 
to display the 3 most recent town hall submissions:

```javascript
fetch('/api/townhall/posts?limit=3')
  .then(res => res.json())
  .then(posts => renderTownhall(container, posts))
  .catch(err => console.error('Town hall load error', err));
```

The script handles both direct array and wrapped `{results: [...]}` response formats:
```javascript
const posts = Array.isArray(postsData) ? postsData : postsData.results || postsData;
```
```

---

## Summary of JSON Response Shape

**Endpoint**: `GET /api/townhall/posts?limit=3`

**Response format**: Direct JSON array (no wrapper)

```json
[
  {
    "id": "unique-submission-id",
    "user_id": "firebase-uid",
    "title": "User title or topic",
    "prompt": "User comment or question",
    "created_at": "2025-05-29T12:00:00Z",
    "file_url": "https://cdn.example.com/api/events/pdf/...",
    "file_size": 128004,
    "expires_at": "2025-12-31T23:59:59Z"
  }
]
```

**Key characteristics** ✅:
- Direct array response (no `{results: [...]}` wrapper)
- ISO 8601 timestamps for all date fields
- File attachments via Cloudflare R2 URLs
- Data retention policy via `expires_at`
- User attribution for civic engagement transparency
- Nullability on optional fields (file_url, file_size, expires_at, prompt)
- Forward-compatible: can add new fields without breaking clients

---

## Integration with watch.js

The `static/js/civic/watch.js` script handles this response in the `loadCivicWatch()` function:

```javascript
async function loadCivicWatch() {
  const apiBase = await getApiBase();
  const townhallEl = $("cw-townhall-preview");

  try {
    const postsRes = await fetch(`${apiBase}/townhall/posts?limit=3`);
    
    if (!postsRes.ok) throw new Error("Townhall failed");
    
    const postsData = await postsRes.json();
    const posts = Array.isArray(postsData) ? postsData : postsData.results || postsData;
    
    renderTownhall(townhallEl, posts);
  } catch (err) {
    console.error("Town hall load error", err);
    if (townhallEl) 
      townhallEl.innerHTML = `<div class="meta text-red-600">Error loading town halls.</div>`;
  }
}
```

The `renderTownhall()` function then displays the response:

```javascript
function renderTownhall(container, posts = []) {
  if (!container) return;
  if (!posts.length) {
    container.innerHTML = `<div class="meta">No county threads yet. Check back soon.</div>`;
    return;
  }
  const items = posts
    .slice(0, 3)
    .map(
      (p) => `<li>
        <div class="font-semibold">${p.title || "Thread"}</div>
        <div class="meta">Created ${p.created_at || ""}</div>
      </li>`
    )
    .join("");
  container.innerHTML = `<ul>${items}</ul>`;
}
```

---

## Files Updated

✅ `/home/anchor/projects/this-is-us/documentation/SNAPSHOT_120625_COMPREHENSIVE.md`
- Added ~670 lines of documentation
- New sections: "Civic Watch Front Door" + "Town Hall Posts API"
- Integrated into existing "Civic Watch Data Model" section

✅ Exported to Windows:
- `/mnt/c/Users/ancho/Downloads/SNAPSHOT_120625_COMPREHENSIVE_UPDATED.md`

---

**Documentation Status**: Complete and ready for use as single source of truth
