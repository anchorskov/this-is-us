Status: Active
Updated: 2025-12-17
Owner: Eng Platform
Scope: Wyoming LSO Orchestrator

# Orchestrator E2E Test - Quick Reference

## One-line test

```bash
bash worker/scripts/test_orchestrator_e2e_2026.sh
```

## Requirements

✅ `./scripts/wr dev` running at `http://127.0.0.1:8787`  
✅ `curl` and `jq` installed  
✅ D1 database initialized  
✅ **No demo data** in civic_items

## What it tests

| Dimension | Assertion | Result |
|-----------|-----------|--------|
| Enumeration | lso_total_items_year > 0 | Must be 44 for 2026 |
| Delta-safe | No duplicate bill_numbers | Must be 0 |
| Document resolution | best_doc_url count | May be 0 (optional phase) |
| AI tagging | ai_tags count | May be 0 (optional phase) |
| UI endpoints | pending-bills & hot-topics return results | Must have items (or warn) |
| Completeness | db_active ≤ lso_total | Invariant enforced |

## Output format

```
PASS: year=2026 lso_total=44 db_active=44 sources=5 tags=12
```

Exit code 0 = all phases passed  
Exit code 1 = assertion failed (see reason in output)

## Check if demo data exists

Before running, verify clean state:

```bash
# Find demo rows
sqlite3 ../scripts/wr-persist/WY_DB.db "SELECT COUNT(*) FROM civic_items WHERE id LIKE 'test-%';" 

# Find demo bills
sqlite3 ../scripts/wr-persist/WY_DB.db "SELECT COUNT(*) FROM civic_items WHERE title LIKE '%Groundwater Withdrawal%';"

# Both must return 0
```

## Full documentation

See [orchestrator_e2e_test.md](orchestrator_e2e_test.md) for:
- Detailed phase breakdown
- All assertions explained
- Failure troubleshooting
- CI/CD integration example

---

*Quick reference. For full docs, see orchestrator_e2e_test.md.*
