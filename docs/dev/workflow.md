<!-- File: docs/dev/workflow.md -->

Status: Active
Updated: 2025-12-18
Owner: Eng Platform
Scope: Daily local development workflow

## Daily workflow
1) Start local dev
- From repo root:
  ./start_local.sh

2) Confirm correct local D1
- curl -sS http://127.0.0.1:8787/api/dev/d1/identity | jq '.bindings.WY_DB | {accessible,row_counts,latest_migrations}'

3) Wyoming bill ingestion
- Enumerate target session (example 2026):
  curl -sS -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run \
    -H "Content-Type: application/json" \
    -d '{"session":"2026","phase":"enumerate","limit":500,"force":true}' | jq .

- Scan target session (start small while testing):
  curl -sS -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run \
    -H "Content-Type: application/json" \
    -d '{"session":"2026","phase":"scan","limit":5}' | jq .

4) Verify E2E
- From worker/:
  bash scripts/verify_orchestrator_e2e.sh

## Non-negotiables
- Run ./scripts/wr from worker/
- Use worker/../scripts/wr-persist for local D1
- Prefer real sources, LSO first, then fallbacks
