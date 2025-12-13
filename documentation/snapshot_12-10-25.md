# Project Snapshot – 2025-12-10

## 1. High-level summary
- Civic Watch front door is live (Hot Topics, Pending Bills, Town Halls preview) with topic tags, AI summaries, vote counts, and sponsor data.
- Hot Topics are fully aligned: preferences page and hot-topics pages both use the canonical `hot_topics` table (6 core topics).
- Delegation endpoint returns state/federal reps using verified_users + wy_legislators; verified_users bridge now live for voter verification.
- Town Hall "create thread" posts to D1 via Worker; threads are sourced from EVENTS_DB at runtime.
- Geocoding script exists and is production-ready; lat/lng columns in voters_addr_norm are present but populated only on demand (not required at runtime).

## 2. Data model (D1)

### 2.1 Wyoming voter and address tables
- voters_addr_norm: voter_id PK, addr1/city/state/zip, senate/house districts, city_county_id, optional lat/lng (added migration 0014), used for delegation fallback and geocoding exports.
- verified_users: user_id → voter_id bridge with county, house, senate, status; used to authorize delegation lookups and future posting rights.
- wy_city_county: lookup for county names by id (used when only city_county_id is present).

### 2.2 Civic items and Hot Topics
- civic_items: bills from OpenStates; includes status, legislative_session, chamber, subject_tags, ai_summary, ai_key_points, vote aggregates.
- civic_item_ai_tags: AI topic matches per bill (slug, confidence, trigger_snippet, reason_summary).
- bill_sponsors: civic_item_id → sponsor metadata (role, district, contact_*), used on pending bill cards and bill-sponsors endpoint.
- civic_item_verification: AI verification results for bill metadata (topic_match, summary_safe, confidence, status, issues). Migration 0019: table created with indexed lookup by civic_item_id + created_at DESC to retrieve the latest verification per bill. Used by /api/internal/civic/verify-bill (runs gpt-4o-mini check) and /api/civic/pending-bills-with-topics (joins latest row to include verification_status and verification_confidence in API response).
- hot_topics (EVENTS_DB): six canonical slugs with badge/summary/priority and optional match_criteria_json; hot_topic_civic_items links topics to bills with match metadata.

### 2.3 Legislators and Delegation
- wy_legislators: chamber (house/senate), district_number/label, name, contact_email/phone, website_url, bio. Used by /api/civic/delegation.
- verified_users + wy_legislators + voters_addr_norm underpin delegation resolution.

### 2.4 Town Hall tables
- townhall_posts (EVENTS_DB): id (UUID), user_id, title, prompt, created_at, city, state, county, r2_key, file_size, expires_at.
  - Migration 0016: created table with 11 columns; no county_name or topic_slug at post level (topics linked at account setup only).
  - Migration 0019: added county TEXT column for location-based filtering and verified_users linkage.
  - Indexed by created_at DESC and county for efficient pagination and location queries.
- townhall_replies (EVENTS_DB): id (INTEGER), thread_id (FK), author_user_id, author_voter_id, body, created_at, updated_at, status, parent_reply_id (self-referencing FK).
  - Migration 0018: created table for threaded conversations within Town Hall discussions (9 columns, 4 performance indexes).
  - Supports nested replies via parent_reply_id; status field ('active', 'hidden', 'deleted') enables moderation.
  - Foreign key constraints with cascading deletes ensure data integrity.
- votes (WY_DB): target_id, target_type ('civic_item' or 'townhall_post'), value (-1, 0, 1), user_id, created_at.
  - Used for civic item votes and (future) town hall post votes.
- Town Hall posting writes to D1 only; Firestore stores user identity and profile metadata, not thread data. County linked from verified_users for authorization.

## 3. Auth and verification
- Firebase Auth is primary identity; Worker uses requireAuth (supports Firebase token, CF Access headers, __session).
- verified_users table ties Firebase uid to voter_id/county/house/senate; source flag "verified_voter" in delegation responses.
- Delegation endpoint falls back to voters_addr_norm by voter_id when provided; otherwise returns source "none".
- Town Hall posting (POST /api/townhall/posts) requires verified status; non-verified users receive 403 "not_verified" error. County auto-linked from verified_users.county.
- Town Hall replies (future endpoints) will also require verified status for authorization and moderation gating.

## 4. Worker APIs

### 4.1 Civic Watch endpoints
- GET /api/hot-topics: active topics with linked civic_items and vote counts (joins WY_DB votes and civic_items).
- GET /api/hot-topics/:slug: topic detail plus linked bills with vote aggregates.
- GET /api/civic/pending-bills-with-topics: pending bills with AI summary/key points, topic matches (confidence ≥0.5), vote counts, sponsor info, verification_status and verification_confidence from latest civic_item_verification row.
- GET /api/internal/civic/verify-bill?id=<bill_id>: internal endpoint that runs gpt-4o-mini sanity check on stored topic vs. title/abstract and summary vs. abstract; upserts result into civic_item_verification; returns verification details (topic_match, summary_safe, confidence, issues, status).
- GET /api/civic/bill-sponsors?bill_id=: sponsor metadata for a bill (from bill_sponsors table).
- GET /api/user-topics: topics user has selected (from user_topic_prefs); lists all active topics from hot_topics with checked status.
- POST /api/user-topics: toggle topic selection (user_id auto-derived from auth; writes to user_topic_prefs).

### 4.2 Town Hall endpoints
- GET /api/townhall/posts: list townhall_posts (limit param, sorted by created_at DESC, county-filterable).
- POST /api/townhall/posts: create thread in townhall_posts (Firebase auth required, verified status required for 403 gating, JSON body validation, county auto-linked).
- POST /api/townhall/posts/:thread_id/replies: create reply in townhall_replies (verified status required, supports nested replies via parent_reply_id).
- GET /api/townhall/posts/:thread_id/replies: list replies for a thread (sorted by created_at, filters active status, supports pagination).
- Legacy upload endpoints remain for PDF-backed posts (`/api/townhall/create`) but new flow uses JSON post.

### 4.3 Delegation endpoint
- GET /api/civic/delegation?user_id=uid or ?voter_id=id: resolves house/senate via verified_users or voters_addr_norm; fetches wy_legislators; returns federalDelegation static config; source flags: verified_voter, voter_id_lookup, none.

### 4.4 Shared helpers
- hotTopicsAnalyzer/billSummaryAnalyzer for AI tagging/summaries (OpenAI).
- federalDelegation static map for U.S. at-large House + senators.
- OpenStates sync (`/api/dev/openstates/sync`) to populate civic_items.

## 5. Frontend flows

### 5.1 Civic Watch page
- `layouts/civic/watch.html` + `static/js/civic/watch.js`: loads /api/hot-topics, /api/civic/pending-bills-with-topics, /api/townhall/posts previews; displays three cards (Hot Topics, Pending Bills, Town Halls) with CTA buttons; shows counts/titles; uses EVENT_API_URL/READY helpers.

### 5.2 Town Hall pages
- Create thread: `static/js/townhall/create-thread.js` posts to /api/townhall/posts with Firebase ID token; disables button and shows status messages; no Firestore writes.
- Listing/viewing threads still uses existing Town Hall pages under layouts/townhall; threads now sourced from D1 via /api/townhall/posts (Civic Watch preview).

### 5.3 Pending Bills page
- `layouts/civic/pending-bills.html` + `static/js/civic/pending-bills.js`: filters (topic/session/chamber/status), renders AI summary/key points, topic badges, vote buttons, sponsors (with contact link), copy-prompt buttons; uses /api/civic/pending-bills-with-topics.

### 5.4 Hot Topics pages
- `layouts/hot-topics/list.html` + `static/js/civic/hot-topics.js`: renders topics from /api/hot-topics, loads followed topics from Firestore `preferences.followedTopics`, sorts followed topics to top, displays ★ "Following" badge on followed topics.
- `layouts/hot-topics/single.html`: detail view with linked bills, vote controls, and topic metadata.
- Account setup page integrates with /api/user-topics to let users select topics of interest; selections saved to both D1 (user_topic_prefs) and Firestore (preferences.followedTopics).

### 5.5 Auth hooks
- Firebase scripts included globally; JS modules check `currentUser` and call `getIdToken()` for POST routes (votes, townhall posts).

## 6. Deferred items and next steps

### Completed in this session (2025-12-10)
- ✅ Hot Topics alignment: unified preferences and hot-topics pages to query the same canonical hot_topics table.
- ✅ Firestore integration: added preferences.followedTopics field for frontend followed-topic tracking.
- ✅ Followed topics highlighting: hot-topics list shows ★ badge and reorders followed topics to top.
- ✅ User-topics API: endpoints live for selecting/deselecting topics with dual persistence (D1 + Firestore).
- ✅ Town Hall D1 data model: migrations 0018 (townhall_replies) and 0019 (county column) deployed to all environments.
- ✅ Town Hall replies schema: threaded conversations with nested replies, parent_reply_id support, 4 performance indexes.
- ✅ Town Hall verification gating: POST /api/townhall/posts returns 403 for non-verified users; county auto-linked from verified_users.
- ✅ Town Hall comprehensive tests: 23 Jest tests covering schema, authorization, multi-county scenarios, all passing.
- ✅ AI verification pipeline: Migration 0019 (civic_item_verification table) created with indexes for latest-row lookup. Routes /api/internal/civic/verify-bill (gpt-4o-mini check) and /api/civic/pending-bills-with-topics (joins verification data) verified end-to-end. Tests created: Jest suite + manual test checklist. API returns verification_status ('ok'/'flagged'/'missing') and verification_confidence (0.0-1.0) per bill.

### In progress / Planned
1. **Town Hall reply endpoints**: Implement POST /api/townhall/posts/:thread_id/replies and GET /api/townhall/posts/:thread_id/replies handlers (routes ready, tests exist).
2. **Town Hall frontend threading UI**: Build reply display component, nested reply rendering, author/timestamp display.
3. **Geocoding import**: Script `scripts/geocode_voters_addr_norm.py` is production-ready with Census batch API, retries, rate limiting. Next: run script, import results back to voters_addr_norm lat/lng, then enable proximity-based town hall filtering or delegation fallback refinement.
4. **Verified users onboarding**: verified_users table live; next steps: surface voter verification flow on account/signup pages, add attestation/badge UI, tie to Town Hall posting rights.
5. **Delegation UX**: /api/civic/delegation endpoint live; next: surface on Civic Watch and Account pages; integrate with verified-user onboarding.
6. **Bill sponsor ingestion**: bill_sponsors currently manual/ingest; consider automating via OpenStates sponsor data or user-curated updates.
7. **Topic matching rules**: match_criteria_json in hot_topics is present but unused; future enhancement for rule-based (not just AI-tag) matching.

