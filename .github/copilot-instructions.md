<!-- File: .github/copilot-instructions.md -->

# Repo instructions for Copilot

## Ground rules
- Prefer real data. Do not seed fake bills unless explicitly requested.
- Do not propose destructive commands (rm -rf) as a default. Require an explicit reason and a safer alternative first.
- Always run wrangler commands from: /home/anchor/projects/this-is-us/worker
- Local D1 must use persist path: scripts/wr-persist

## Local workflow
1) Jimmy (user) Starts local dev in a separate terminal:
- From repo root: using ./start_local.sh
- Confirm: http://127.0.0.1:8787/api/dev/d1/identity returns WY_DB accessible=true if not already running ask jimmy to start it.

2) Blank-state verification (expected civic_items=0):
- curl -sS http://127.0.0.1:8787/api/dev/d1/identity | jq '.bindings.WY_DB.row_counts'

3) Ingestion pipeline for Wyoming bills
- Enumerate first, then scan.
- Enumerate 2026:
  curl -sS -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run \
    -H "Content-Type: application/json" \
    -d '{"session":"2026","phase":"enumerate","limit":500,"force":true}' | jq .

- Scan 2026 (limit 5 while testing):
  curl -sS -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run \
    -H "Content-Type: application/json" \
    -d '{"session":"2026","phase":"scan","limit":5}' | jq .

4) E2E verification script
- From worker/: bash scripts/verify_orchestrator_e2e.sh

## Debugging priorities
- If scan_candidate_count=0, query WY_DB for active rows in the target session.
- If schema errors appear, check migrations list and PRAGMA table_info.
- If summaries return need_more_text, use fallback ladder and store summary_source and summary_error.

## Server ownership
- Wrangler and Hugo are started by Jimmy in separate shells using ./start_local.sh.
- Copilot must NOT start or restart wrangler dev or hugo dev from VS tasks.
