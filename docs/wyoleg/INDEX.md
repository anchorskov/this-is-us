Status: Active
Updated: 2025-12-17
Owner: Eng Platform
Scope: Wyoming LSO Bills

# Wyoming LSO Documentation

## Start here

- **[Orchestrator E2E Test - Quick Reference](orchestrator_e2e_quickstart.md)** (2 min)  
  One-line command to validate entire ingestion pipeline. Pass/fail with clear metrics.

- **[Orchestrator E2E Test Harness](orchestrator_e2e_test.md)** (10 min)  
  Full test documentation. 7 phases, all invariants explained, troubleshooting guide.

## Related docs

See parent directories for:
- `docs/ai/` — AI contract and conventions
- `docs/` — Other project documentation

## Test files

- `worker/scripts/test_orchestrator_e2e_2026.sh` — Executable test harness (20 KB)
- `worker/scripts/test_lso_authoritative_counts.sh` — Bill count validation
- `worker/scripts/test_lso_delta_enumeration.sh` — Delta enumeration tests

## Coverage

Current test harness validates:

✅ Enumeration correctness (44 bills for 2026)  
✅ Delta-safe upserts (no duplicates)  
✅ Database invariants (active ≤ total)  
✅ Document resolution (sample rows)  
✅ AI tagging (topic histogram)  
✅ UI endpoints (pending-bills, hot-topics)  
✅ Completeness metrics (LSO vs DB counts)

All tests assume year=2026 and real LSO Service data (no seeds/mocks).
