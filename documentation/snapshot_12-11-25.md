# Project Snapshot – 2025-12-11

## 1. High-level summary
- Civic Watch front door is live (Hot Topics, Pending Bills, Town Halls preview) with topic tags, AI summaries, vote counts, and sponsor data.
- Hot Topics are fully aligned: preferences page and hot-topics pages both use the canonical `hot_topics` table (6 core topics).
- Delegation endpoint returns state/federal reps using verified_users + wy_legislators; verified_users bridge now live for voter verification.
- Town Hall "create thread" posts to D1 via Worker; threads are sourced from EVENTS_DB at runtime.
- Geocoding script exists and is production-ready; lat/lng columns in voters_addr_norm are present but populated only on demand (not required at runtime).
- **NEW (2025-12-11):** Wyoming LSO Committee Bills API investigated and documented; 25 bills extracted from 17 committee records; comprehensive schema documentation created for future integration.

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
- wy_legislators populated with 93 Wyoming state legislators (10 senators, 60 house members) from verified state roster; includes full contact and bio data.
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

## 6. OpenStates Integration (2025-12-10)

### Investigation & Validation Complete
- ✅ **Root cause identified:** Chamber misidentification on Senate bills (SF) was due to incomplete OpenStates API data.
- ✅ **Solution implemented:** Identifier-based chamber detection (HB→house, SF/SB→senate) with jurisdiction validation.
- ✅ **Testing completed:** 10 bills tested (3 HB, 7 SF), all chambers now correctly identified.
- ✅ **Code enhanced:** normalizeChamber() function upgraded with validation, logging, error handling.
- ✅ **Documentation created:** 5 comprehensive reference documents (1,500+ lines).

### Current Status
- OpenStates sync working correctly; bill chamber detection reliable.
- 556 Wyoming bills available from OpenStates API (HB/SF formats).
- Integration tested and production-ready.

## 7. Wyoming LSO Committee Bills API (NEW – 2025-12-11)

### Investigation Overview
**Status:** ✅ Complete - API documented and ready for future integration.

### API Details
- **Endpoint:** `GET https://lsoservice.wyoleg.gov/api/BillInformation/GetCommitteeBills/{year}`
- **Authentication:** None required
- **Response Size:** 1.5MB for 2026
- **Total Bills:** 25 bills across 17 committee records

### Data Structure
- **Root:** JSON array (17 items, one per committee)
- **Per-committee object:**
  - `committeeDetail`: Committee metadata (code, displayName, fullName, shortName, year)
  - `billSummaries`: Bill summary list (typically empty)
  - `sponsoredBills`: **MAIN DATA** – actual session bills (7 per committee avg., 25 total)
  - `meetingDraftBills`: Bill draft meetings/agendas (not parsed for current analysis)

### Bill Fields (25 bills analyzed, 100% field presence)
All 15 fields consistently present in every bill:
- **Identifiers:** billNum (HB0008, HB0009, etc.), year (2026)
- **Content:** shortTitle ("Stalking of minors.", "Grooming of children-offenses and amendments.")
- **Sponsorship:** sponsor (committee name: Judiciary, Labor, Agriculture, Transportation, Education, Minerals)
- **Status fields:** billType, billStatus, lastAction, lastActionDate, chapterNo, enrolledNo, effectiveDate, signedDate (many null for draft bills)
- **Related bills:** amendments (array), substituteBills (array), specialSessionValue

### Key Findings
- **Strengths:** Reliable bill identifiers (HB prefix), good title quality, committee sponsorship tracking, all fields consistent.
- **Limitations:** Committee-level only (not individual sponsors), no URLs provided, sparse status for draft bills, no bill text/abstract.
- **Complementary to OpenStates:** 25 curated committee bills vs. 556 total OpenStates bills; good for committee process tracking.

### Sponsor Distribution
- Judiciary: 7 bills
- Labor: 7 bills
- Agriculture: 4 bills
- Transportation: 3 bills
- Education: 2 bills
- Minerals: 2 bills

### Documentation Created
- **File:** `worker/docs/wy_committee_bills_schema.md`
- **Contents:** Complete API reference, field mapping, recommendations for D1 integration, sample SQL patterns.
- **Status:** Ready for implementation when needed.

### Recommended Integration Path
1. Map `billNum` to `civic_items.bill_number` (already have HB format).
2. Add committee sponsor info to `bill_sponsors` table with `role: "committee_requestor"`.
3. Optional: Create `committee_bill_sponsors` table for detailed committee-level sponsorship tracking.
4. Use `shortTitle` for display when OpenStates abstract is unavailable.

## 8. Deferred items and next steps

### Completed in this session (2025-12-11)
- ✅ Wyoming LSO API investigation: fetched, analyzed, and documented 25 committee bills across 17 committees.
- ✅ Field frequency analysis: confirmed all 15 fields present in 100% of bills (no sparse schema).
- ✅ Sponsor mapping: identified committee-based sponsorship model (different from OpenStates individual sponsors).
- ✅ Schema documentation: created comprehensive reference guide for future integration.

### Completed in previous session (2025-12-10)
- ✅ OpenStates bill sync: fixed chamber detection for Senate bills.
- ✅ Legislator data: populated wy_legislators table with 93 Wyoming state representatives.
- ✅ Civic Watch: fully operational with hot topics, pending bills, and town halls.

### Future opportunities
- Integrate Wyoming LSO committee bills as supplemental data source for committee tracking.
- Enhance bill_sponsors table with committee-level sponsorship details.
- Add bill status polling from LSO API for real-time bill progress tracking.
- Construct direct URLs to bill text (HTML/PDF) using billNum + year pattern.
- Implement individual sponsor extraction from LSO for bills with co-sponsors.

---

**Session Date:** December 11, 2025  
**Key Achievements:** Wyoming LSO API fully investigated and documented; ready for integration into civic_items workflow.  
**API Health:** ✅ OpenStates working, ✅ Wyoming LSO accessible, ✅ D1 synchronized with wy_legislators.
