# This Is Us – Project Snapshot (2025-12-06)
## Executive Summary

**This Is Us** is a Hugo + Cloudflare Workers civic engagement platform designed to make Wyoming legislation accessible to everyday citizens. It combines **static content delivery** (Hugo/Netlify) with **real-time data processing** (Cloudflare Workers D1 + OpenAI) to surface bills, track voting trends, and connect legislation to citizen-relevant topics.

### Current State: **Functional Core with Data-Driven Enhancements**
- ✅ **Two citizen-facing tools operational**: Hot Topics list/detail pages and Pending Bills with filters
- ✅ **AI-enriched content**: OpenAI generates plain-language summaries and topic matches with confidence scoring
- ✅ **Interactive voting**: Thumbs up/down/info buttons on bills with real-time vote aggregation
- ✅ **Topic-bill linking**: Bidirectional navigation between topic pages and pending bills
- ⚠️ **Data dependency**: Quality of UX depends on OpenStates sync frequency and AI scan coverage
- ⚠️ **Auth model**: Voting without strict user authentication (relies on client-side `currentUser.uid`)

### Core Problem We Solve
Wyoming residents struggle to understand pending legislation. The project bridges this gap by:
1. **Aggregating bills** from OpenStates API into a searchable local database
2. **Generating citizen-friendly explanations** via OpenAI (avoiding legalese)
3. **Connecting bills to relatable topics** (property taxes, water rights, education, etc.) so users know *why* a bill matters
4. **Enabling feedback** through voting to identify consensus and engage residents

---

## Overview

The stack pairs a **static Hugo site** (content + templating) with a **serverless Worker API** (Cloudflare Workers) that orchestrates **two D1 databases** (WY_DB for bills, EVENTS_DB for topics) and **OpenAI integrations** for text analysis. Data flows:

```
OpenStates API
    ↓
    (openStatesSync.mjs)
    ↓
WY_DB (civic_items, civic_item_ai_tags)
    ↓
    (billSummaryAnalyzer, hotTopicsAnalyzer)
    ↓
OpenAI (gpt-4o)
    ↓
    (saveAnalysis, saveBillSummary)
    ↓
WY_DB + EVENTS_DB (hot_topic_civic_items)
    ↓
Worker APIs
    ↓
Hugo Pages (/hot-topics, /civic/pending)
    ↓
Citizens (browser JavaScript rendering)
```

**Key insight**: The platform is not a static website—it's a **data processing + ranking + communication system** that uses AI to translate legislation into plain language and votes to identify community priorities.

## Major Code Areas

### Worker (Cloudflare Workers / Backend API)
**Entry point**: `worker/src/index.mjs` – Uses `itty-router` to map HTTP requests to handlers.

#### Routes Layer (`worker/src/routes/`)
| Route | Handler | Purpose | Status |
|-------|---------|---------|--------|
| `GET /api/hot-topics` | `hotTopicsAnalyzer.handleListHotTopics` | List 6 canonical topics with bill counts, priority order, images, CTAs | ✅ Functional |
| `GET /api/hot-topics/:slug` | `handleHotTopicsDetail` | Topic detail: full description, linked bills, voting UI per bill | ✅ Functional |
| `GET /api/civic/pending-bills-with-topics` | `pendingBills.handlePendingBillsWithTopics` | Enriched pending bill list with AI summaries, topic matches, vote counts; supports filters (topic, session, chamber, status) | ✅ Functional |
| `GET /api/civic/pending-bills` | `pendingBills.handlePendingBills` | Legacy: base pending bills without topic enrichment (not actively used in UI) | ✅ Works, deprecated UI |
| `POST /api/civic/items/:id/vote` | `civicVotes.handleVoteCivicItem` | Record thumbs up/down/info vote; expects `user_id` + `value` in body | ⚠️ No auth validation |
| `GET /api/dev/openstates/sync` | `civicItems.handleOpenStatesScan` | Manually trigger OpenStates fetch & upsert (dev-only, no auth guard) | ✅ Functional, unguarded |
| `GET /api/internal/civic/scan-pending-bills` | `civicScan.handleScanPendingBills` | Scan all pending bills for hot topic matches via OpenAI | ✅ Functional, unguarded |
| `POST /api/internal/civic/test-bill-summary` | `civicScan.handleTestBillSummary` | Generate & cache AI summary for a single bill (dev/testing) | ✅ Functional, localhost-only |

#### Library Layer (`worker/src/lib/`)
- **`hotTopicsAnalyzer.mjs`**
  - `analyzeBillForHotTopics(env, bill)` – Calls OpenAI gpt-4o with 6 topics in system prompt; returns array of `{slug, confidence, trigger_snippet, reason_summary}`
  - `saveHotTopicAnalysis(env, billId, topics)` – Writes to `civic_item_ai_tags` and cross-links in `hot_topic_civic_items`
  - `buildUserPromptTemplate(topic, bill)` – Pure helper: generates citizen-friendly prompt for "explain this bill in context of this topic"
  - `getSinglePendingBill(env, options)` – Query helper: fetches bill with AI summary fields included

- **`billSummaryAnalyzer.mjs`**
  - `analyzeBillSummary(env, bill)` – Calls OpenAI with bill text; returns `{plain_summary: string, key_points: [string, ...]}`
  - `saveBillSummary(env, billId, analysis)` – Writes `ai_summary`, `ai_key_points`, `ai_summary_generated_at` to `civic_items`
  - `ensureBillSummary(env, bill)` – Cache-aware wrapper: checks if `ai_summary_generated_at` is null; if so, generates & saves; otherwise returns cached value

- **`openStatesSync.mjs`**
  - `fetchOpenStatesBills(session, limit)` – Calls OpenStates API (Wyoming only); returns bills with metadata
  - `normalizeBillData(raw)` – Maps OpenStates fields to WY_DB schema (normalizes chamber, infers status from actions, formats subjects as JSON)
  - `upsertCivicItems(env, bills)` – Bulk upsert into `civic_items`; skips if bill already exists (by bill_number + legislative_session)

#### API Behavior Details

**`/api/civic/pending-bills-with-topics` (Main Endpoint)**
- **Filters applied in order**:
  1. Status must be in `["introduced", "in_committee", "pending_vote"]`
  2. Topic matches filtered to `confidence >= 0.5` (threshold in code)
  3. Optional query params: `topic_slug`, `session`, `chamber`, `status`
- **Response shape**:
  ```json
  {
    "results": [
      {
        "id": "ocd-bill/...",
        "bill_number": "HB 22",
        "title": "Property Tax Assessment Cap",
        "chamber": "lower",
        "status": "introduced",
        "legislative_session": "2025",
        "subject_tags": ["taxes", "property"],
        "ai_plain_summary": "This bill caps annual property tax increases...",
        "ai_key_points": ["Homeowners get stable tax bills", "Helps fixed-income residents"],
        "up_votes": 23,
        "down_votes": 5,
        "info_votes": 12,
        "topics": [
          {
            "slug": "property-tax-relief",
            "label": "Property Taxes & Assessment Reform",
            "badge": "Taxes",
            "priority": 10,
            "confidence": 0.92,
            "reason_summary": "Bill explicitly caps tax assessment increases",
            "trigger_snippet": "annual property tax increase... 3% or inflation",
            "user_prompt_template": "You are a civic educator...[full prompt]"
          }
        ]
      }
    ]
  }
  ```
- **Key observations**:
  - Each bill appears once per topic match; if a bill matches 2 topics, it's in the array twice
  - `user_prompt_template` is a full, ready-to-use prompt for copy-to-clipboard (no OpenAI call needed)
  - Vote counts are real-time aggregates from the `votes` table
  - If no topics match (or `civic_item_ai_tags` is empty), bill appears with empty `topics: []`

## Data Tables (Cloudflare D1)
- **WY_DB (wy)**
  - `civic_items`: Wyoming bills from OpenStates. Columns include `bill_number`, `title`, `summary`, `status`, `legislative_session`, `chamber`, `subject_tags`, `last_action`, `last_action_date`, `ai_summary`, `ai_key_points`, vote aggregates.
  - `civic_item_ai_tags`: Topic matches per bill with `topic_slug`, `confidence`, `trigger_snippet`, `reason_summary`.
  - `votes`: Generic vote table; used for bill thumbs up/down/info.
  - Voter/staging tables (voters, voters_addr_norm, etc.) not actively surfaced in the UI.
- **EVENTS_DB (events_db_local)**
  - `hot_topics`: Six canonical topics, presentation fields (`badge`, `summary`, `priority`), and `match_criteria_json` (future rule-based matching).
  - `hot_topic_civic_items`: Links hot topics to bills; supports match metadata (score, matched_terms_json, excerpt).
  - `townhall_posts`: Community-initiated discussion threads on civic topics. Columns: id (PRIMARY KEY), user_id, title, prompt, created_at, r2_key (file reference), file_size, expires_at, city, state.
  - `user_preferences`, `topic_index`, and other preference/event tables for future use.
- **BALLOT_DB**: Present but not actively used in current civic flows.

## Data Ingestion & AI
- **OpenStates integration**: `openStatesSync.mjs` fetches Wyoming bills (by session) and upserts into `civic_items`. Status is inferred from actions; chamber normalized; subjects stored as JSON/text.
- **OpenAI usage**:
  - Topic tagging: `analyzeBillForHotTopics` (OpenAI gpt-4o) -> `saveHotTopicAnalysis` writes into `civic_item_ai_tags` and links to `hot_topic_civic_items`.
  - Bill summaries: `analyzeBillSummary` -> `ai_summary` + `ai_key_points` stored on `civic_items`.
  - `buildUserPromptTemplate`: Pure helper to produce citizen-friendly prompts per bill/topic (no API call).
- **Confidence thresholds**: Pending bills endpoint filters topics to confidence ≥ 0.5 by default.

## Current UX Flows
- **Hot Topics pages**:
  - `/hot-topics/` uses `static/js/civic/hot-topics.js` to fetch `/api/hot-topics` and render cards; counts of linked bills shown.
  - `/hot-topics/{slug}` shows topic detail, linked bills, and voting UI for each bill.
  - Local tabs (partial `civic-nav.html`) let users jump to pending bills.
  - Inline prompt to visit Pending Bills added under the intro.
- **Pending Bills page**:
  - `/civic/pending/` uses `static/js/civic/pending-bills.js` to fetch `/api/civic/pending-bills-with-topics`.
  - Filters: topic, session, chamber, status.
  - Cards show bill meta, AI plain summary, key points, topic badges with reason/snippet, copy-prompt button, and vote buttons (👍/👎/❓).
  - Uses `EVENTS_API_READY`/`EVENTS_API_URL` to target the Worker.
- **Town Hall threads**:
  - `/townhall/` uses `static/js/townhall/home.js` to fetch `/api/townhall/posts` and display community discussion threads.
  - `/townhall/create-thread/` form allows authenticated users to POST to `/api/townhall/create` with title, prompt, location (city/state), and optional file upload.
  - Town Hall table (EVENTS_DB `townhall_posts`) stores thread metadata: id, user_id, title, prompt, city, state, created_at, file metadata (r2_key, file_size, expires_at).
  - **GET /api/townhall/posts** (public read): Returns list of recent threads with limit/pagination support.
  - **POST /api/townhall/create** (auth required): Creates a new thread; expects form-data with title, prompt, city, state, file (optional).
  - Status: ✅ Functional (Firestore write path to be migrated to D1 in Phase 2).

## Open Issues / Risks
- **Data availability**: If `civic_items` or `civic_item_ai_tags` are empty (no OpenStates sync or AI scan), pending bills page renders empty state; not a code bug but a data gap. Run OpenStates sync and topic scans to populate.
- **Auth for voting**: `handleVoteCivicItem` expects `user_id` in the body; front-end uses `window.currentUser.uid`. There’s no strict server-side auth check; risk of spoofed user IDs.
- **Error visibility**: Pending page currently shows generic empty state; add clearer error messaging when API 500/404 or when no data is present.
- **Module vs. non-module scripts**: Pending page script is a plain deferred script (no ES imports). If shared utilities are imported later, switch back to `type="module"`.
- **Styling consistency**: Hot Topics detail has vote styles; pending page uses a similar but locally defined vote style. Consider centralizing shared styles.

## UX/UI Improvement Ideas
- **Loading and error states**: Add inline error banners when the API fails; show skeleton cards while loading to reduce perceived latency.
- **Empty-state guidance**: When no bills match filters, suggest clearing filters or provide a “refresh topics” hint.
- **Topic filter chips**: Convert topic dropdown to clickable chips with icons/badges for quicker scanning.
- **Vote affordance**: Add a small “Signed in as …” hint near votes; gray out/tooltip when not signed in. Persist user’s last vote (highlight selection).
- **Card density options**: Provide a compact/list toggle for power users; current cards are wide and sparse.
- **Summary clarity**: Add “Last updated” or “AI summary generated at” if available to build trust.
- **Hot topic/bill cross-links**: On pending cards, link topic badges back to the hot topic detail page.
- **Accessibility**: Ensure keyboard focus states on vote buttons and copy buttons; add aria labels for confidence and snippets.
- **Navigation**: Consider a “Civic Watch” menu grouping in the global nav (Hot Topics, Pending Bills, Town Hall) for discoverability.

## Operational Notes
- **Local dev commands**:
  - Hugo: `hugo server --baseURL http://localhost:1313 --bind 0.0.0.0`
  - Worker: `cd worker && export BILL_SCANNER_ENABLED=true && npx wrangler dev --local`
  - OpenStates sync (dev): `GET /api/dev/openstates/sync?session=2025&limit=20`
  - Pending bills API: `curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics" | jq`
- **Data population**:
  - Run OpenStates sync to get bills into `civic_items`.
  - Run topic scan (`/api/internal/civic/scan-pending-bills`) to populate `civic_item_ai_tags` and `hot_topic_civic_items`.
  - Run bill summary analyzer (`/api/internal/civic/test-bill-summary`) to fill `ai_summary`/`ai_key_points`.

## Summary
The project now delivers two coordinated civic views (Hot Topics and Pending Bills) with AI-enriched content, topic badges, and voting. Data flows from OpenStates → D1 (WY_DB) → OpenAI analysis → Worker APIs → Hugo pages. Next UX gains come from better empty/error handling, clearer voting affordances, and small navigation polish. Backend hardening should focus on auth for voting and ensuring data pipelines (OpenStates + AI scans) run regularly so the UI stays populated.
