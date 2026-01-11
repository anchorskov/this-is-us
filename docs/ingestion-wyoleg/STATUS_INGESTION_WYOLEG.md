# STATUS: Wyoming LSO (wyoleg.gov) Ingestion

Date: Generated locally (this-is-us repo)  
Scope: Local pipeline status (D1 local, worker dev)  

## Current State (Local)
- Source: Wyoming LSO (wyoleg.gov) pending bills (LSO/OpenStates upstream via worker).
- DB bindings: `WY_DB` (civic_items, civic_item_sources, civic_item_ai_tags, civic_item_verification, bill_sponsors); `EVENTS_DB` (hot_topics, hot_topic_civic_items).
- Local persistence: `./worker/../scripts/wr-persist`.
- Hot Topics migrations applied locally; tables exist with data (12 hot_topics, 0 junction rows).
- Resolver enabled: doc resolver resolves wyoleg PDFs (Introduced/Enroll/Digest/Fiscal, amendments) before AI analysis; writes to `civic_item_sources`.
- AI analysis: summaries + hot-topic tags via `scan-pending-bills` route; tags stored in `civic_item_ai_tags`.
- UI endpoints: `/api/civic/pending-bills-with-topics` and `/api/hot-topics` feed static JS (pending-bills.js, hot-topics.js).

## Pipeline Map (Sequence)
1) **Bill list ingestion**
   - File: `worker/src/lib/openStatesSync.mjs` (called by `runPendingBillsRefresh` in `worker/src/jobs/pendingBillsRefresh.mjs`).
   - Route/cron: `/api/dev/openstates/sync` (dev) and scheduled cron (see `./scripts/wr.toml` cron).
   - DB: `WY_DB.civic_items`, `bill_sponsors`, `civic_item_verification`.
   - Flags: `BILL_SCANNER_ENABLED` gates scan step; OpenStates/LSO creds via env.

2) **Document resolution (wyoleg PDFs)**
   - Files: `worker/src/lib/docResolver/index.mjs`, `.../profiles/wyoleg.mjs`.
   - Templates: `{year}/Introduced|Enroll|Digest|Fiscal/{bill}.pdf`; checkpoints `/Legislation/{year}/{bill}`, `/Legislation/Amendment/{year}?billNumber={bill}` with /Amends/*.pdf parsing; SPA shell detection.
   - Route: used inside `scan-pending-bills` (below).
   - DB: `WY_DB.civic_item_sources` (best_doc_url, kind, status, checked_at, last_error).

3) **Text/Summary + Hot Topics analysis**
   - Route: `POST /api/internal/civic/scan-pending-bills` (token-gated except localhost); cron triggers `runPendingBillsRefresh`.
   - File: `worker/src/routes/civicScan.mjs` (selection, doc resolve, summary, tagging).
   - AI summary: `worker/src/lib/billSummaryAnalyzer.mjs` → `civic_items.ai_summary`, `ai_key_points`.
   - Hot-topic tagging: `worker/src/lib/hotTopicsAnalyzer.mjs` → `civic_item_ai_tags`; links to `EVENTS_DB.hot_topic_civic_items`.
   - Flags: `BILL_SCANNER_ENABLED=true`; auth header `X-Internal-Token` for non-local.

4) **UI consumption**
   - Pending bills: `worker/src/routes/pendingBills.mjs` → `/api/civic/pending-bills-with-topics`; DB `WY_DB` + `EVENTS_DB`.
   - Hot topics list/detail: `worker/src/routes/hotTopics.mjs` → `/api/hot-topics`, `/api/hot-topics/:slug`; DB `EVENTS_DB`, `WY_DB`.
   - Frontend: `static/js/civic/pending-bills.js`, `static/js/civic/hot-topics.js`.

## Tables and Columns (Key)
- `WY_DB.civic_items`: bill metadata, AI summary fields (`ai_summary`, `ai_key_points`, `ai_summary_generated_at`).
- `WY_DB.civic_item_sources`: resolved doc provenance (`civic_item_id` PK, best_doc_url, best_doc_kind, status, checked_at, last_error).
- `WY_DB.civic_item_ai_tags`: hot-topic tags (`item_id`, `topic_slug`, `confidence`, `trigger_snippet`, `reason_summary`, unique item/topic).
- `WY_DB.civic_item_verification`: verification status for pending bills.
- `WY_DB.bill_sponsors`: sponsor data tied to civic_items.
- `EVENTS_DB.hot_topics`, `EVENTS_DB.hot_topic_civic_items`: canonical topics and manual links.
- `EVENTS_DB.podcast_uploads`: unrelated to wyoleg but present.

## Endpoints and Scripts
- Routes:
  - `POST /api/internal/civic/scan-pending-bills` (doc resolve + summary + tags).
  - `GET /api/civic/pending-bills-with-topics`.
  - `GET /api/hot-topics`, `GET /api/hot-topics/:slug`.
  - Dev: `/api/dev/openstates/sync`, `/api/internal/civic/test-one`.
- Cron: `./scripts/wr.toml` has weekly pending-bills refresh (`runPendingBillsRefresh` → sync + scan).
- Scripts:
  - `worker/scripts/apply-migrations-local.sh` (local migrations, persist).
  - `worker/scripts/test-wyoleg-pipeline-local.sh` (end-to-end local, persist).
  - `worker/scripts/test-doc-resolver-local.sh` (resolve SF0013).
  - `worker/scripts/audit-wyoleg-ingestion.sh` (audit entrypoints, counts, schema).
  - `worker/scripts/run-civic-pipeline-local.sh`, `reset-civic-local.sh`, `verify-hot-topics-state.sh`.

## Top 10 Failure Modes (and detection)
1) Missing hot_topics tables locally → `/api/hot-topics` 500. Detect: `./scripts/wr d1 execute EVENTS_DB --local ... SELECT name FROM sqlite_master WHERE name='hot_topics';`
2) No persistence/duplicate D1 → data drift. Detect: `find ../scripts/wr* -name "*.sqlite"`; ensure `--persist-to ./../scripts/wr-persist`.
3) Scanner disabled → no tags/summaries. Detect logs: “BILL_SCANNER_ENABLED != true”.
4) Missing token on scan endpoint → 401. Detect: response error JSON `Unauthorized`.
5) SPA shell doc fetch (no PDF) → civic_item_sources missing URL. Detect: query `best_doc_url IS NULL`.
6) AI summary absent → `pending-bills-with-topics` filter hides bills. Detect: `COUNT(*) WHERE ai_summary IS NULL OR ai_summary=''`.
7) No hot_topic_civic_items links → `/api/hot-topics` returns topics with empty civic_items. Detect: `COUNT(*) FROM hot_topic_civic_items`.
8) OpenAI env missing → summaries/tags fail. Detect logs from `billSummaryAnalyzer` / `hotTopicsAnalyzer`.
9) Migrations not applied remotely → schema errors. Detect: `d1_migrations` mismatch between local/remote.
10) Guardrails absent → wrong state dir. Detect: guardrail script warnings; fix config/persist flags.

## Single Source of Truth Recommendations
- Always run local worker with `--persist-to ./worker/../scripts/wr-persist` and `XDG_CONFIG_HOME=./worker/.config`.
- Apply migrations via `./scripts/apply-migrations-local.sh` before tests.
- Treat `WY_DB` as source for bills/tags/summaries; `EVENTS_DB` for topics/links. Do not duplicate hot_topics elsewhere.
- Run `./scripts/audit-wyoleg-ingestion.sh` before commits to capture schema and counts.
