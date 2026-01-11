# Wyoming LSO Pipeline Test Suite – Quick Reference

**Location:** `/home/anchor/projects/this-is-us/worker/`

## Commands

### Run Full Test (with reset)
```bash
cd worker
./scripts/test-wyoleg-pipeline-local.sh --reset
```

### Run Test (idempotent, no reset)
```bash
cd worker
./scripts/test-wyoleg-pipeline-local.sh
```

### Skip Python Extraction Step
```bash
cd worker
./scripts/test-wyoleg-pipeline-local.sh --no-extract
```

## What Gets Tested

1. ✅ PDF Resolution (resolveOnly=1) → civic_item_sources populated
2. ✅ PDF Text Extraction → Python script processes bills
3. ✅ AI Summaries → OpenAI generates summaries (if key available)
4. ✅ Topic Tags → Bills matched to hot topics
5. ✅ Health Checks → SQL verification queries
6. ✅ SF0013 Spot Check → Specific bill details

## Test Criteria

| What | Pass | Warn | Fail |
|------|------|------|------|
| Bills in DB | > 0 | — | = 0 |
| Resolved PDFs | — | < 10 | = 0 |
| Summaries | > 10 | 5-10 | < 5 |
| Topic Tags | > 20 | 1-20 | = 0 |

## Key Files

```
worker/
├── scripts/test-wyoleg-pipeline-local.sh    (Main test runner)
├── scripts/sql/check-wyoleg-health.sql      (SQL verification)
├── scripts/reset-civic-local.sh             (Reset state)
├── scripts/extract_pdf_text_and_analyze.py  (Extract PDFs + AI)
├── scripts/run-civic-pipeline-local.sh      (Full pipeline)
└── scripts/verify-hot-topics-state.sh       (Health report)

src/
└── routes/civicScan.mjs                     (Modified for resolveOnly)
```

## Endpoints

### Resolve Only (no OpenAI)
```
POST http://127.0.0.1:8787/api/internal/civic/scan-pending-bills?resolveOnly=1
```

### Full Scan (with topics)
```
POST http://127.0.0.1:8787/api/internal/civic/scan-pending-bills?force=1
```

## Persistence

Local D1 state saved to: `../scripts/wr-persist/`  
Survives worker restarts ✅  
Cleared with `--reset` flag ✅

## Typical Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🧪 Wyoming LSO Pipeline Test Suite
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[... multiple steps ...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📊 Test Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pipeline Metrics:
  Bills in civic_items: 25
  Resolved sources: 18
  Summaries (>40 chars): 15
  AI tags total: 42

✅ TEST PASSED ✨
```

## Troubleshooting

| Issue | Check | Fix |
|-------|-------|-----|
| No bills | Check `civic_items` count | Run seeding script |
| No sources | Check PDF resolver | Review `../scripts/wr-dev.log` |
| No summaries | Check OpenAI key | Set `OPENAI_API_KEY` in env |
| No tags | Check AI tags table | May need more bills with summaries |

## Environment Variables

```bash
# Required for full pipeline
OPENAI_API_KEY=sk-...
BILL_SCANNER_ENABLED=true

# Optional
DOC_RESOLVER_DEBUG=true  # Verbose resolver logs
```

## Full Documentation

See: [WYOLEG_TEST_SUITE_IMPLEMENTATION.md](./WYOLEG_TEST_SUITE_IMPLEMENTATION.md)
