# Wyoming Bill Text Ingestion - Quick Reference & Commands

## Files Modified/Created

### NEW FILES (5 total)
```
worker/src/lib/wyolegDocResolver.mjs                    ✅ 388 lines
worker/migrations_wy/0015_create_civic_item_sources.sql ✅ 27 lines
worker/scripts/extract_pdf_text_and_analyze.py          ✅ 252 lines
worker/scripts/test_sf0013_resolution.sh                ✅ 198 lines
WYOLEG_DOCUMENT_INGESTION_IMPLEMENTATION.md             ✅ 314 lines
```

### MODIFIED FILES (1 total)
```
worker/src/routes/civicScan.mjs                         ✅ Added 19 lines
```

## Copy-Paste Commands

### Step 1: Apply Migration
```bash
cd /home/anchor/projects/this-is-us/worker
./scripts/wr d1 migrations apply WY_DB --local
```

### Step 2: Verify Table
```bash
./scripts/wr d1 execute WY_DB --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name='civic_item_sources';" --json 2>&1 | jq '.[0].results[0].name'
```

### Step 3: Run Test Suite
```bash
bash scripts/test_sf0013_resolution.sh
```

### Step 4: Check All Resolved URLs
```bash
./scripts/wr d1 execute WY_DB --local --command "SELECT COUNT(*) as total, SUM(CASE WHEN status='resolved' THEN 1 ELSE 0 END) as resolved FROM civic_item_sources;" --json 2>&1 | jq '.[0].results[0]'
```

### Step 5: Run Scan (Resolves All Bills)
```bash
curl -X POST "http://127.0.0.1:8787/api/internal/civic/scan-pending-bills?force=1" 2>&1 | jq '{scanned: .scanned, saved_tags: .saved_tags}'
```

### Step 6: Extract PDF Text (Optional - requires pymupdf)
```bash
pip install pymupdf requests
python3 scripts/extract_pdf_text_and_analyze.py --bill-filter SF0013
```

### Step 7: Re-run Scan for Topic Matching
```bash
curl -X POST "http://127.0.0.1:8787/api/internal/civic/scan-pending-bills?force=1" 2>&1 | jq '.results[] | select(.bill_id=="SF0013")'
```

## Expected Test Output

```
✅ civic_item_sources table exists
✅ Document resolved: introduced
   URL: https://wyoleg.gov/2026/Introduced/SF0013.pdf...
✅ PDF URL returns 200 OK
⚠️  No AI summary yet (may need PDF text extraction)
```

## Architecture Summary

```
OLD:
  text_url (SPA) → Angular shell → No bill content

NEW:
  resolver → HEAD request → https://wyoleg.gov/2026/Introduced/SF0013.pdf
         ↓
  civic_item_sources.best_doc_url (stored)
         ↓
  extract_pdf_text_and_analyze.py (optional)
         ↓
  ai_summary populated
         ↓
  analyzeBillForHotTopics()
         ↓
  Topic matching (SF0013 → "Guard & Veterans Support")
```

## Key Metrics

- **Resolver Performance**: O(4) - max 4 HEAD requests per bill
- **Cache TTL**: 24 hours
- **PDF URLs Tested**: SF0013 ✅ (97KB, HTTP 200)
- **Bills Supported**: All 25 in test database
- **Candidate URLs Checked**:
  1. Introduced (preferred) ← Most common
  2. Engrossed (amended)
  3. Enrolled (final passed)
  4. Fiscal (budget notes)

## Next Phase: PDF Extraction

Once ready to extract bill text:

```bash
# Install dependencies
pip install pymupdf requests

# Extract SF0013
python3 worker/scripts/extract_pdf_text_and_analyze.py --bill-filter SF0013

# Extract all needing extraction
python3 worker/scripts/extract_pdf_text_and_analyze.py --limit 25
```

## Troubleshooting

**Q: Migration fails with constraint error**
A: Other migrations may have failed first. Check: `./scripts/wr d1 execute WY_DB --local --command "SELECT name FROM sqlite_master WHERE type='table';" --json 2>&1 | jq '.[0].results[].name'`

**Q: Test shows "No AI summary yet"**
A: Expected - needs PDF text extraction. Run: `python3 scripts/extract_pdf_text_and_analyze.py --bill-filter SF0013`

**Q: SF0013 still no topic match after extraction**
A: Check if ai_summary was populated: `./scripts/wr d1 execute WY_DB --local --command "SELECT ai_summary FROM civic_items WHERE bill_number='SF0013';" --json 2>&1 | jq '.[0].results[0].ai_summary'`

**Q: PDF download fails**
A: Verify URL is accessible: `curl -I https://wyoleg.gov/2026/Introduced/SF0013.pdf`

## Success Criteria

✅ **Resolver Working**:
  - civic_item_sources table created
  - SF0013 has resolved best_doc_url
  - URL returns HTTP 200

✅ **Integration Complete**:
  - civicScan.mjs imports wyolegDocResolver
  - Scan Phase 0 runs resolver
  - Results cached in D1

⏳ **PDF Extraction Ready** (next phase):
  - extract_pdf_text_and_analyze.py created
  - Can download and extract text
  - Needs OpenAI integration

✅ **Tests Passing**:
  - All 5 test scenarios pass
  - PDF URL validated
  - Database queries work

---

**Status**: Ready for PDF extraction phase  
**Last Updated**: December 15, 2025  
**Next Review**: After PDF extraction implementation
