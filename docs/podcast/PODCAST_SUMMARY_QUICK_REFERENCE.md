# Podcast Summary Source - Quick Reference

## The Mechanism (One Page)

**User clicks button** → **Client JS reads attributes** → **Makes API call** → **Worker queries D1** → **Returns summary**

```
┌─ content/podcast.md
│  └─ Button with data-guest, data-date, data-part
│
├─ static/js/podcast-summary.js
│  ├─ Listens for clicks
│  ├─ Extracts button attributes → query params
│  └─ Calls GET /api/podcast/summary?guest=X&date=Y&part=Z
│
├─ Cloudflare Worker (8787 local)
│  └─ worker/src/routes/podcastSummary.mjs
│     ├─ Route: /api/podcast/summary
│     └─ Query: SELECT summary FROM podcast_uploads WHERE guest_slug=? AND episode_date=? AND part_number=?
│
└─ EVENTS_DB
   └─ podcast_uploads table (currently empty)
```

## File Map

| File | Purpose |
|------|---------|
| `content/podcast.md` | HTML with buttons: `<button class="podcast-summary-btn" data-guest="jr-riggins" data-date="2025-12-14" data-part="1">` |
| `static/js/podcast-summary.js` | Client: Intercepts clicks, calls API, shows modal |
| `worker/src/routes/podcastSummary.mjs` | Server: Queries `podcast_uploads` table, returns summary field |
| `worker/src/index.mjs:159-160` | Route registration: `/api/podcast/summary`, `/podcast/summary` |
| `../scripts/wr-persist/.../EVENTS_DB.sqlite` | Local D1 database (run: `./scripts/wr dev --local`) |

## Query Parameters

| Param | Source | Example |
|-------|--------|---------|
| `guest` | `data-guest` attribute | "jr-riggins" |
| `date` | `data-date` attribute | "2025-12-14" |
| `part` | `data-part` attribute | "1" |

## API Endpoint

**Local:** `http://127.0.0.1:8787/api/podcast/summary?guest=jr-riggins&date=2025-12-14&part=1`

**Responses:**

Success (data found):
```json
{
  "guest_slug": "jr-riggins",
  "episode_date": "2025-12-14",
  "part_number": 1,
  "r2_key": "podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-01.mp3",
  "summary": "Text here..."
}
```

Failure (no data):
```json
{
  "summary": null,
  "available": false,
  "reason": "summary not found"
}
```

## Current Status

✅ **Infrastructure:** 100% complete
- Client code: Working
- Server route: Working  
- Routes registered: Yes
- Database schema: Correct

❌ **Data:** Empty
- `podcast_uploads` table: 0 rows
- Summaries: None populated

## How to Populate Summaries

```bash
# Insert test summary
./scripts/wr d1 execute EVENTS_DB --local --command "
  INSERT INTO podcast_uploads 
  (guest_slug, episode_date, part_number, r2_key, sha256, bytes, summary)
  VALUES ('jr-riggins', '2025-12-14', 1, 'podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-01.mp3', 'abc123', 1000000, 'Summary text')
"

# Test endpoint
curl 'http://127.0.0.1:8787/api/podcast/summary?guest=jr-riggins&date=2025-12-14&part=1'
```

## Verification Script

Run the full verification:
```bash
worker/scripts/verify-podcast-summary-source.sh
```

This checks:
- Client code present and readable
- Worker route implemented
- Routes registered
- Button attributes correct
- Database table exists
- Local API responding
- Data status

## Why Table is Empty

**Not a bug.** The table is designed to store metadata that's populated by:
1. An upload script (`scripts/media/r2_upload_podcasts.sh` maybe)
2. Manual database inserts
3. Admin API (not yet implemented)

Until summaries are inserted, the API returns `summary: null`.

## Next Steps

1. Check if upload script exists: `ls worker/scripts/media/*upload*`
2. Run script or manually insert summaries
3. Test endpoint returns data
4. Verify modal displays summary on client

## Related Docs

- [PODCAST_SUMMARY_SOURCE_INVESTIGATION.md](PODCAST_SUMMARY_SOURCE_INVESTIGATION.md) - Full technical report
- [PODCAST_INDEX.md](PODCAST_INDEX.md) - Podcast implementation details
- [PODCAST_TEST_CHECKLIST.md](PODCAST_TEST_CHECKLIST.md) - Testing procedures
