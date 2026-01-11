# Copilot Prompt: Test Wyoming LSO Orchestrator & Debug Hot Topics

**Copy the entire section below and paste into Copilot Chat.**

---

## Prompt

```
We added POST /api/internal/admin/wyoleg/run (Wyoming LSO ingestion orchestrator endpoint). Create a local test plan and scripts that prove the endpoint actually populates the UI inputs for Hot Topics.

CONTEXT:

Orchestrator Details:
- Route: POST /api/internal/admin/wyoleg/run
- Auth: X-Internal-Token header (localhost accepts "local-dev")
- Body/Query: { limit: 25, force: true, dryRun: false, session: "2025" }
- Response: { run_id, started_at, finished_at, synced_count, scanned_count, resolved_docs_count, summaries_written, tags_written, errors:[] }

Pipeline (what it does in order):
1. Bill Sync: Calls syncWyomingBills(env, WY_DB, { session, limit }) to fetch pending bills from OpenStates
2. Document Resolution: For each bill, finds PDF URLs from wyoleg.gov; caches in civic_item_sources
3. Summary Generation: Calls OpenAI to generate plain-language summaries; stores in civic_items.ai_summary
4. Hot Topic Tagging: Analyzes summaries for matches; stores tags in civic_item_ai_tags

Databases:
- EVENTS_DB: hot_topics, hot_topic_civic_items
- WY_DB: civic_items, civic_item_sources, civic_item_ai_tags, ingestion_runs, ingestion_run_items

Endpoints to test:
- POST /api/internal/admin/wyoleg/run (the orchestrator)
- GET /api/hot-topics (returns topics with linked bills)
- GET /api/civic/pending-bills-with-topics (returns bills with assigned topics)

Local Setup:
- Persist: worker/../scripts/wr-persist
- Dev: http://127.0.0.1:8787
- DB access: ./scripts/wr d1 execute WY_DB --local --persist-to ./../scripts/wr-persist --command "SELECT ..." --json

TEST PLAN:

Phase 1: Pre-Conditions
1. Verify D1 tables exist (hot_topics, civic_items, civic_item_ai_tags, ingestion_runs)
2. Seed initial hot_topics (should have 5-10 topics)
3. Verify OpenAI key is configured (OPENAI_API_KEY)

Phase 2: Run Orchestrator
1. Call POST /api/internal/admin/wyoleg/run with force=true, limit=5
2. Capture run_id, started_at, finished_at
3. Record synced_count, scanned_count, resolved_docs_count, summaries_written, tags_written
4. If errors array non-empty, print and halt for diagnosis

Phase 3: Verify Data Changes
1. Confirm civic_items row count increased by synced_count
2. Confirm civic_item_sources rows > 0 (documents resolved)
3. Confirm civic_items.ai_summary populated (summaries written > 0)
4. Confirm civic_item_ai_tags rows > 0 (tags_written > 0)
5. Confirm ingestion_runs has one row with run_id from Phase 2

Phase 4: Verify API Response
1. GET /api/hot-topics → should return JSON array with topics and civic_items populated
2. GET /api/civic/pending-bills-with-topics → should return bills with topics field non-empty
3. If either returns empty, provide SQL diagnostics to identify the gap

Phase 5: Gap Detection (If APIs Return Empty)
If /api/hot-topics returns [] or /api/civic/pending-bills-with-topics shows 0 bills:
  - Run SQL to check if tags exist: SELECT COUNT(*) FROM civic_item_ai_tags
  - Run SQL to check if topics exist: SELECT COUNT(*) FROM hot_topics
  - Run SQL to check if summaries exist: SELECT COUNT(*) FROM civic_items WHERE ai_summary IS NOT NULL
  - If tags exist but topics empty, the issue is topic definition or junction table
  - If topics exist but civic_items empty, the issue is summary/tag generation
  - Provide exact SQL to identify the gap and remediation steps

DELIVERABLES:

1. Test Script (shell): worker/scripts/test-wyoleg-orchestrator-debug.sh
   - Usage: ./test-wyoleg-orchestrator-debug.sh
   - Implements all 5 phases above
   - Pre-check: table existence, row counts
   - Run orchestrator: curl POST with response capture
   - Post-check: row counts increased
   - API verification: curl /api/hot-topics and /api/civic/pending-bills-with-topics
   - Gap detection: if either API returns empty, run targeted SQL and print remediation

2. Troubleshooting Guide (markdown): ORCHESTRATOR_DEBUG.md
   - Section for each failure mode:
     a) "No bills synced" → verify OpenStates credentials, run manual sync test
     b) "Summaries not generated" → check OpenAI key, verify bill text_url
     c) "Tags not inserted" → check hot_topics table, verify analyzer runs
     d) "Hot topics API empty" → check junction table hot_topic_civic_items
     e) "Pending bills API empty" → check filter logic, verify summaries populated
   - For each failure mode, provide ready-to-run SQL diagnostics
   - Success criteria: /api/hot-topics returns ≥1 topic with ≥1 civic_item

3. Success Criteria Output
   - Print formatted summary:
     RUN SUMMARY:
     ✅ Synced: 12 bills
     ✅ Scanned: 12 bills
     ✅ Resolved: 10 PDFs
     ✅ Summaries: 12 generated
     ✅ Tags: 18 inserted
     ✅ hot-topics API: 5 topics with 18 total civic_items
     ✅ pending-bills API: 12 bills with topics assigned
     
     NEXT STEPS:
     - Review hot-topics UI at http://127.0.0.1:1313/civic/hot-topics/
     - Verify each topic shows bills underneath

IMPORTANT:
- Always use persist dir: worker/../scripts/wr-persist
- Assume ./scripts/wr dev already running on 127.0.0.1:8787
- Include paste-ready SQL queries (not just references)
- For each SQL, show expected vs actual output format
- If test fails, provide exact remediation steps (not just "check X")

PASTE EVERYTHING BELOW THIS LINE INTO COPILOT:
```

---

## Ready-to-Paste Test Commands

If you want to test manually before running the full script, here are the exact commands:

### Check 1: Table Existence

```bash
cd /home/anchor/projects/this-is-us/worker

./scripts/wr d1 execute WY_DB --local --persist-to ./../scripts/wr-persist --command \
  "SELECT name FROM sqlite_schema WHERE type='table' AND name IN ('civic_items','civic_item_sources','civic_item_ai_tags','ingestion_runs') ORDER BY name;" --json
```

**Expected output:**
```json
[
  {"name": "civic_items"},
  {"name": "civic_item_sources"},
  {"name": "civic_item_ai_tags"},
  {"name": "ingestion_runs"}
]
```

---

### Check 2: Orchestrator Endpoint (Dry-Run)

```bash
curl -sS -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: local-dev" \
  --data '{"limit": 5, "force": true, "dryRun": true}' | jq .
```

**Expected output:**
```json
{
  "run_id": "run-1702771200000-abc123",
  "started_at": "2025-12-16T15:20:00.000Z",
  "finished_at": "2025-12-16T15:20:05.000Z",
  "synced_count": 0,
  "scanned_count": 0,
  "resolved_docs_count": 0,
  "summaries_written": 0,
  "tags_written": 0,
  "errors": []
}
```

---

### Check 3: Orchestrator Endpoint (Real Run)

```bash
curl -sS -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: local-dev" \
  --data '{"limit": 5, "force": true, "dryRun": false}' | jq .
```

**Expected output:**
```json
{
  "run_id": "run-1702771200000-def456",
  "started_at": "2025-12-16T15:21:00.000Z",
  "finished_at": "2025-12-16T15:21:30.000Z",
  "synced_count": 5,
  "scanned_count": 5,
  "resolved_docs_count": 4,
  "summaries_written": 5,
  "tags_written": 7,
  "errors": []
}
```

---

### Check 4: Hot Topics API

```bash
curl -sS http://127.0.0.1:8787/api/hot-topics | jq '.[] | {slug, label, civic_items_count: (.civic_items | length)}'
```

**Expected output:**
```json
{
  "slug": "election-integrity",
  "label": "Election Integrity",
  "civic_items_count": 3
}
{
  "slug": "education-reform",
  "label": "Education Reform",
  "civic_items_count": 2
}
```

---

### Check 5: Pending Bills API

```bash
curl -sS http://127.0.0.1:8787/api/civic/pending-bills-with-topics | jq '.results[0] | {bill_number, title, topics: (.topics | length)}'
```

**Expected output:**
```json
{
  "bill_number": "HB 22",
  "title": "Property Tax Assessment Cap",
  "topics": 1
}
```

---

### Diagnosis 1: If No Tags Exist

```bash
./scripts/wr d1 execute WY_DB --local --persist-to ./../scripts/wr-persist --command \
  "SELECT item_id, topic_slug, confidence FROM civic_item_ai_tags LIMIT 5;" --json
```

**If returns `[]`:** Tags are not being generated. Check OpenAI key and bill summaries:

```bash
./scripts/wr d1 execute WY_DB --local --persist-to ./../scripts/wr-persist --command \
  "SELECT bill_number, ai_summary FROM civic_items WHERE ai_summary IS NOT NULL LIMIT 3;" --json
```

---

### Diagnosis 2: If Hot Topics API Returns Empty

```bash
./scripts/wr d1 execute EVENTS_DB --local --persist-to ./../scripts/wr-persist --command \
  "SELECT id, slug, label FROM hot_topics ORDER BY label;" --json
```

**If returns `[]`:** Topics are not seeded. Seed with:

```bash
./scripts/wr d1 execute EVENTS_DB --local --persist-to ./../scripts/wr-persist --command \
  "INSERT INTO hot_topics (slug, label, description) VALUES 
   ('election-integrity', 'Election Integrity', 'Voting rights and election administration'),
   ('education-reform', 'Education Reform', 'K-12 and higher education policy');" --json
```

---

### Diagnosis 3: If Pending Bills API Returns Empty

```bash
./scripts/wr d1 execute WY_DB --local --persist-to ./../scripts/wr-persist --command \
  "SELECT COUNT(*) as count FROM civic_items WHERE status IN ('introduced','in_committee','pending_vote');" --json
```

**If returns `[{"count": 0}]`:** No bills in pending status. Seed bills:

```bash
cd worker && ./scripts/test-wyoleg-pipeline-local.sh --reset
```

---

## How to Use This Prompt

1. **Copy the "Prompt" section** (between the three backticks)
2. **Open Copilot Chat**
3. **Paste the entire prompt**
4. **Copilot will generate:**
   - Complete test shell script
   - Troubleshooting guide with SQL diagnostics
   - Success criteria checklist

5. **Then run the generated script:**
   ```bash
   cd /home/anchor/projects/this-is-us/worker
   ./scripts/test-wyoleg-orchestrator-debug.sh
   ```

6. **If any failures, Copilot will provide exact remediation SQL commands**

---

## Expected Output After Successful Run

```
╔════════════════════════════════════════════════════════════════════╗
║          WYOMING LSO ORCHESTRATOR TEST SUITE (Debug)               ║
╚════════════════════════════════════════════════════════════════════╝

✅ PHASE 1: PRE-CONDITIONS
   - D1 tables exist ✅
   - Hot topics seeded: 5 topics ✅
   - OpenAI key configured ✅

✅ PHASE 2: ORCHESTRATOR RUN
   - Request: POST /api/internal/admin/wyoleg/run ✅
   - Status: 200 OK ✅
   - Run ID: run-1702771200000-abc123def456 ✅

📊 PHASE 3: DATA CHANGES
   - civic_items: 5 new rows ✅
   - civic_item_sources: 4 URLs resolved ✅
   - civic_items (ai_summary): 5 summaries generated ✅
   - civic_item_ai_tags: 7 new tags ✅
   - ingestion_runs: 1 new row ✅

🌐 PHASE 4: API RESPONSE
   - GET /api/hot-topics: 5 topics, 7 total civic_items ✅
   - GET /api/civic/pending-bills-with-topics: 5 bills with topics ✅

✅ TEST SUITE PASSED

NEXT STEPS:
1. Open browser: http://127.0.0.1:1313/civic/hot-topics/
2. Verify hot topics UI displays 5 topics with bill counts
3. Click on a topic to verify bills appear underneath
```
