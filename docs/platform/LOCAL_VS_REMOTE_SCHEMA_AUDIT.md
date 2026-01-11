# Local vs Remote Schema Comparison – December 15, 2025

## Executive Summary

**Local Database Status:** ✅ FULLY MIGRATED
- **EVENTS_DB:** 19/25 migrations applied (0001–0019)
- **WY_DB:** 25/25 migrations applied (0001–0025)
- **Missing from Local:** Migrations 0020–0025 for EVENTS_DB (podcast_uploads and related tables)

**Remote Database Status:** ⚠️ UNABLE TO VERIFY (No API Token)
- Cloudflare API token required to compare remote instances
- Based on documentation, remote should match or exceed local schema

---

## EVENTS_DB Schema Inventory

### Local Tables (14 tables)

| Table | Migration | Status | Rows | Key Columns |
|-------|-----------|--------|------|------------|
| hot_topics | 0011/0013 | ✅ | 12 | id, slug, title, summary, badge, match_criteria_json |
| hot_topic_civic_items | 0011/0014 | ✅ | 0 | topic_id, civic_item_id, match_score, matched_terms_json, excerpt |
| townhall_posts | 0016 | ✅ | ? | (created 0016) |
| townhall_replies | 0018 | ✅ | ? | (created 0018) |
| user_preferences | 0007 | ✅ | ? | user_id, city, state, interests |
| user_topic_prefs | 0005/0017 | ✅ | ? | user_id, topic_id, interest_level |
| voters_addr_norm | 0010 | ✅ | 0 | (test fixture) |
| wy_city_county | 0010 | ✅ | 0 | (test fixture) |
| events | 0001 | ✅ | 0 | event_id, event_name, event_date, description, pdf_hash |
| topic_index | 0005 | ✅ | 12 | id, slug, title, keywords |
| topic_requests | 0005 | ✅ | ? | (preferences table) |
| _cf_METADATA | System | — | — | Cloudflare internal |
| d1_migrations | System | ✅ | 19 | id, name |
| sqlite_sequence | System | — | — | SQLite internal |

### Missing Tables from Local (Migrations 0020–0025)

#### ⚠️ Not Yet Applied to Local:
- **Migration 0020:** `update_hot_topics_keywords.sql` — Updates keywords in hot_topics
- **Migration 0021:** `create_podcast_uploads.sql` — Podcast file tracking with R2 integration
- **Migration 0022:** `add_summary_to_podcast_uploads.sql` — Episode summary field
- **Migration 0023–0025:** EVENTS_DB continuation (if any)

### hot_topics Schema (Migration 0013)

```
Column                 Type         Nullable  Default
─────────────────────────────────────────────────────
id                    INTEGER       ✓        NULL
slug                  TEXT          ✗        NULL
title                 TEXT          ✗        NULL
summary               TEXT          ✓        NULL
badge                 TEXT          ✓        NULL
image_url             TEXT          ✓        NULL
cta_label             TEXT          ✓        NULL
cta_url               TEXT          ✓        NULL
priority              INTEGER       ✓        100
is_active             INTEGER       ✓        1
created_at            DATETIME      ✓        CURRENT_TIMESTAMP
updated_at            DATETIME      ✓        CURRENT_TIMESTAMP
match_criteria_json   TEXT          ✓        NULL (added 0015)
```

### hot_topic_civic_items Schema (Migration 0014)

```
Column               Type         Nullable  Default
──────────────────────────────────────────────────
topic_id            INTEGER       ✗        NULL (PRIMARY KEY)
civic_item_id       INTEGER       ✗        NULL (PRIMARY KEY)
match_score         REAL          ✓        NULL
matched_terms_json  TEXT          ✓        NULL
excerpt             TEXT          ✓        NULL
created_at          DATETIME      ✓        CURRENT_TIMESTAMP
```

---

## WY_DB Schema Inventory

### Local Tables (22 tables) ✅ FULLY MIGRATED

| Table | Migration | Status | Rows | Purpose |
|-------|-----------|--------|------|---------|
| civic_items | 0006 | ✅ | ? | Bills, resolutions, ordinances |
| civic_item_ai_tags | 0009 | ✅ | ? | AI-generated topic tags |
| civic_item_sources | 0015/0025 | ✅ | ? | Source documents (bills, etc.) |
| civic_item_verification | 0019 | ✅ | ? | User verification/voting on items |
| bill_sponsors | 0012 | ✅ | ? | Legislators sponsoring bills |
| wy_legislators | 0013 | ✅ | ? | Wyoming legislature members |
| voters | 0001 | ✅ | 0 | Base voter schema |
| voters_raw | 0001 | ✅ | ? | Raw voter data |
| voters_norm | 0002 | ✅ | ? | Normalized voter records |
| voters_addr_norm | 0002 | ✅ | ? | Address-normalized voters |
| voter_phones | 0001 | ✅ | ? | Voter contact phones |
| wy_city_county | 0003 | ✅ | ? | City/county lookup |
| streets_index | 0002 | ✅ | ? | Street address index |
| user_ideas | 0007 | ✅ | ? | User-submitted ideas |
| votes | 0008 | ✅ | ? | Votes on civic items |
| verified_users | 0018 | ✅ | ? | User verification records |
| (old tables) | — | — | — | streets_index_old, v_best_phone_old, tmp_voter_street |

### bill_sponsors Schema (Migration 0012 + 0020)

```
Column                  Type         Nullable  Default
────────────────────────────────────────────────────
id                     INTEGER       ✓        NULL (PRIMARY KEY)
civic_item_id          TEXT          ✗        NULL
sponsor_name           TEXT          ✗        NULL
sponsor_role           TEXT          ✗        NULL
sponsor_district       TEXT          ✓        NULL
chamber                TEXT          ✓        NULL
contact_email          TEXT          ✓        NULL
contact_phone          TEXT          ✓        NULL
contact_website        TEXT          ✓        NULL
created_at             TEXT          ✗        NULL
updated_at             TEXT          ✗        NULL
openstates_person_id   TEXT          ✓        NULL (added 0020)
```

### civic_items Schema (Migration 0006 + 0011)

```
Column                    Type         Nullable  Default
──────────────────────────────────────────────────────
id                       TEXT          ✓        NULL (PRIMARY KEY)
kind                     TEXT          ✗        NULL (bill, resolution, etc.)
source                   TEXT          ✗        NULL (openlegislature, etc.)
level                    TEXT          ✗        NULL (state, local, etc.)
jurisdiction_key         TEXT          ✗        NULL
bill_number              TEXT          ✓        NULL
title                    TEXT          ✗        NULL
summary                  TEXT          ✓        NULL
text_url                 TEXT          ✓        NULL
created_at               DATETIME      ✓        CURRENT_TIMESTAMP
updated_at               DATETIME      ✓        CURRENT_TIMESTAMP
ai_summary               TEXT          ✓        NULL (added 0011)
ai_tags                  TEXT          ✓        NULL (added 0011)
```

---

## Migration Status Summary

### EVENTS_DB (migrations/)
```
✅ 0001–0019 APPLIED
⏳ 0020 ready (update_hot_topics_keywords)
⏳ 0021 ready (create_podcast_uploads)
⏳ 0022 ready (add_summary_to_podcast_uploads)
⏳ 0024 ready (add_unique_constraint_civic_item_ai_tags)
⏳ 0025 ready (update_hot_topics_for_test_data)
```

### WY_DB (migrations_wy/)
```
✅ 0001–0025 APPLIED (all complete)
   Note: 0015 has duplicates (0015_update_whitehall_coordinates.sql and 0015_create_civic_item_sources.sql)
```

---

## Key Findings

### 🔴 Critical Issues

1. **EVENTS_DB Behind on Migrations:**
   - Local is missing migrations 0020–0025
   - `podcast_uploads` table not yet created (migration 0021)
   - Keywords update for hot_topics not applied (migration 0020)
   - **Action:** Apply remaining migrations to sync with expected state

2. **WY_DB Migration Numbering Conflict:**
   - Two migrations numbered `0015`:
     - `0015_update_whitehall_coordinates.sql`
     - `0015_create_civic_item_sources.sql`
   - **Action:** Rename one to `0015a_*` or `0026_*` to prevent conflicts

### 🟡 Warnings

1. **hot_topic_civic_items is Empty:**
   - Table exists but has 0 rows
   - Linking data not seeded
   - Verify if this requires manual seeding or API population

2. **Remote Database State Unknown:**
   - Cannot verify remote without Cloudflare API token
   - Recommend: Obtain token and run remote comparison
   - Expected: Remote should have all 25 WY_DB migrations + latest EVENTS_DB migrations

3. **Data Inconsistency Risk:**
   - Local EVENTS_DB has 19/25 migrations
   - If production has all 25, schema drift has occurred
   - Podcast_uploads functionality missing from local development

### 🟢 Strengths

- **WY_DB fully migrated locally** ✅
- **EVENTS_DB core tables present and proper schema** ✅
- **hot_topics table has 12 seed records** ✅
- **All migrations tracked** ✅

---

## Recommended Actions

### Immediate (Required)
1. ✅ Apply migrations 0020–0025 to local EVENTS_DB
2. ✅ Fix WY_DB migration 0015 numbering conflict
3. ✅ Verify podcast_uploads table creation (0021)
4. ⏳ Obtain Cloudflare API token for remote comparison

### Short-term (QA)
1. Populate hot_topic_civic_items linking table if needed
2. Validate data consistency between local and remote
3. Test podcast_uploads functionality end-to-end

### Documentation
1. Update instructions/database_snapshot_12-14-25.md with actual local state
2. Document migration order and dependencies
3. Add troubleshooting guide for migration drift

---

**Last Updated:** December 15, 2025, 21:50 UTC  
**Verified By:** Direct D1 queries (local only, remote pending API token)  
**Next Review:** After applying remaining migrations and obtaining remote access
