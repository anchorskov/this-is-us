# Bill Scanner Documentation Index

**Project:** this-is-us (Wyoming bill scanner)  
**Date:** December 5, 2025  
**Status:** ✅ **TESTING READY**

---

## 📚 Documentation Suite

### Core Testing Documents

| Document | Purpose | Key Sections | When to Use |
|----------|---------|--------------|------------|
| **BILL_SCANNER_TESTING.md** | Complete testing guide & quick start | Parts 1–6, edge cases, success criteria | **START HERE** – Read first for overview |
| **TEST_BILL_SCANNER.md** | Step-by-step test checklist | 6 parts with exact commands | Following TESTING.md, need specific commands |
| **test/test-bill-scanner.js** | Automated Node.js integration tests | 6 assertions, environment checks | After manual testing, run `node test/test-bill-scanner.js` |

### Implementation & Security

| Document | Purpose | Key Sections | When to Use |
|----------|---------|--------------|------------|
| **BILL_SCANNER_SECURITY.md** | Security guards & access control | Feature flag, host check, API key | Understanding why scan is dev-only, planning production |
| **BILL_SCANNER_REFERENCE.md** | Technical implementation guide | Architecture, OpenAI config, examples | Deep dive into how analyzer works, debugging |
| **BILL_SCANNER_SUMMARY.md** | Executive overview | What was done, files modified, status | High-level summary of implementation |

---

## 🎯 How to Use This Documentation

### Scenario 1: I want to test the bill scanner locally

**Path:**
1. Read `BILL_SCANNER_TESTING.md` (Quick Start section)
2. Follow `TEST_BILL_SCANNER.md` (Parts 1–3)
3. Run `node test/test-bill-scanner.js` to validate
4. Refer to `TEST_BILL_SCANNER.md` Part 4 for database verification

**Time:** ~15 minutes

---

### Scenario 2: My test is failing, what do I do?

**Path:**
1. Check `TEST_BILL_SCANNER.md` Part 8 (Troubleshooting Checklist)
2. Review `BILL_SCANNER_SECURITY.md` (Guards & Restrictions)
3. Check ./scripts/wr dev logs for error emoji (❌⚠️)
4. If OpenAI issue, check `BILL_SCANNER_REFERENCE.md` (Configuration section)

**Time:** ~10 minutes to diagnose

---

### Scenario 3: I need to understand the architecture

**Path:**
1. Read `BILL_SCANNER_SUMMARY.md` (What Was Done section)
2. Study `BILL_SCANNER_REFERENCE.md` (Design patterns, two-phase saves)
3. Review source code:
   - `worker/src/lib/hotTopicsAnalyzer.mjs` (analyzer logic)
   - `worker/src/routes/civicScan.mjs` (endpoint handler)
   - `worker/src/routes/hotTopics.mjs` (GET endpoint)

**Time:** ~30 minutes

---

### Scenario 4: I'm deploying to production

**Path:**
1. Review `BILL_SCANNER_SECURITY.md` (Production Deployment section)
2. Check `BILL_SCANNER_REFERENCE.md` (Configuration in production)
3. Plan auth/restriction changes before deploying
4. Run full test suite locally first

**Time:** ~45 minutes planning + deployment

---

### Scenario 5: I need to add a new hot topic

**Path:**
1. Read `BILL_SCANNER_REFERENCE.md` (Six Canonical Topics section)
2. Modify `worker/src/lib/hotTopicsAnalyzer.mjs`:
   - Add to CANONICAL_TOPICS map
   - Update SYSTEM_PROMPT with description
3. Test with `node test/test-bill-scanner.js`

**Time:** ~20 minutes

---

## 📋 Quick Navigation

### Implementation Files
- **Analyzer:** `worker/src/lib/hotTopicsAnalyzer.mjs` (150 lines)
- **Endpoint:** `worker/src/routes/civicScan.mjs` (120 lines)
- **Topics endpoint:** `worker/src/routes/hotTopics.mjs` (180 lines)
- **Router:** `worker/src/index.mjs` (line ~85 for route registration)
- **Migration:** `worker/migrations_wy/0009_add_civic_item_ai_tags.sql`

### Test Files
- **Integration test:** `test/test-bill-scanner.js` (240 lines)
- **Test checklist:** `TEST_BILL_SCANNER.md` (500 lines)

### Documentation
- **Testing guide:** `BILL_SCANNER_TESTING.md` (380 lines)
- **Security analysis:** `BILL_SCANNER_SECURITY.md` (300 lines)
- **Technical reference:** `BILL_SCANNER_REFERENCE.md` (450 lines)
- **Executive summary:** `BILL_SCANNER_SUMMARY.md` (270 lines)
- **This index:** `BILL_SCANNER_INDEX.md` (you are here)

---

## 🔑 Key Concepts Quick Reference

### Six Canonical Hot Topics
```
1. property-tax-relief       – Property Tax Relief
2. water-rights              – Water Rights & Drought Planning
3. education-funding         – Education Funding & Local Control
4. energy-permitting         – Energy Permitting & Grid Reliability
5. public-safety-fentanyl    – Public Safety & Fentanyl Response
6. housing-land-use          – Housing & Land Use
```

### OpenAI Configuration
```
Model:        gpt-4o
Temperature:  0.2 (conservative, factual)
Max Tokens:   500 (cost-efficient)
Cost:         ~$0.01–0.02 per bill
```

### Security Guards
```
Feature Flag:  BILL_SCANNER_ENABLED (must be "true")
Host Check:    127.0.0.1 or localhost only
API Key:       OPENAI_API_KEY (optional, graceful degradation)
```

### Endpoint
```
POST /api/internal/civic/scan-pending-bills
Security:     Localhost-only, feature flag protected
Batch size:   5 bills per request
Status filter: introduced, in_committee, pending_vote
```

### Database Tables
```
WY_DB.civic_items
└─ civic_item_ai_tags (analyzed results)

EVENTS_DB.hot_topics
└─ hot_topic_civic_items (links to bills)
```

---

## ✅ Pre-Testing Checklist

Before running tests, confirm:

- [ ] `worker/src/lib/hotTopicsAnalyzer.mjs` refactored (✅ done)
- [ ] `worker/src/routes/civicScan.mjs` refactored (✅ done)
- [ ] Migration 0009 applied to WY_DB (✅ done)
- [ ] Migrations 0001–0003 applied to EVENTS_DB (✅ done)
- [ ] 6 hot topics seeded in EVENTS_DB (✅ done)
- [ ] 5+ pending bills available in WY_DB (✅ done)
- [ ] Route wired in index.mjs (✅ done)
- [ ] Documentation committed to git (✅ done)

---

## 🚀 Testing Roadmap

### Phase 1: Setup (5 min)
- [ ] Read BILL_SCANNER_TESTING.md
- [ ] Set environment variables (OPENAI_API_KEY, BILL_SCANNER_ENABLED)
- [ ] Start `./scripts/wr dev --local`

### Phase 2: Manual Tests (10 min)
- [ ] Run curl scan command
- [ ] Check response structure
- [ ] Verify databases updated
- [ ] Test GET /api/hot-topics

### Phase 3: Automated Tests (5 min)
- [ ] Run `node test/test-bill-scanner.js`
- [ ] Review test output
- [ ] Confirm all 6 assertions pass

### Phase 4: Verification (5 min)
- [ ] Check ./scripts/wr dev logs (🚀📋📄✅)
- [ ] Verify no duplicate tags on re-scan
- [ ] Confirm confidence scores are reasonable

### Phase 5: Troubleshooting (if needed)
- [ ] Consult TEST_BILL_SCANNER.md Part 8
- [ ] Check BILL_SCANNER_SECURITY.md guards
- [ ] Review BILL_SCANNER_REFERENCE.md config

**Total time:** 25–45 minutes (depending on issues)

---

## 📊 Test Coverage

| Component | Test Type | Coverage |
|-----------|-----------|----------|
| Feature flag guard | Manual (TEST_BILL_SCANNER.md) | ✅ Explicit test |
| Host check guard | Manual (TEST_BILL_SCANNER.md) | ✅ Explicit test |
| OpenAI integration | Automated (test-bill-scanner.js) | ✅ Validates response |
| Response shape | Automated (test-bill-scanner.js) | ✅ Validates structure |
| Topic validation | Automated (test-bill-scanner.js) | ✅ Canonical check |
| Confidence scores | Automated (test-bill-scanner.js) | ✅ Range check |
| Database saves | Manual (TEST_BILL_SCANNER.md) | ✅ SQL queries |
| Cross-DB links | Manual (TEST_BILL_SCANNER.md) | ✅ SQL queries |
| GET /api/hot-topics | Manual (TEST_BILL_SCANNER.md) | ✅ curl test |
| Error handling | Manual (TEST_BILL_SCANNER.md) | ✅ Edge cases |

---

## 🔍 Common Questions

### Q: Where do I start?
**A:** Read `BILL_SCANNER_TESTING.md` (takes 5 min), then follow Part 1–3 of `TEST_BILL_SCANNER.md`.

### Q: How do I know if my scan worked?
**A:** Check three things:
1. Curl response has `scanned > 0` and `topics` array
2. WY_DB has rows in `civic_item_ai_tags`
3. EVENTS_DB has rows in `hot_topic_civic_items`

### Q: What if I get 403 errors?
**A:** Check `BILL_SCANNER_SECURITY.md` guards section. Usually missing BILL_SCANNER_ENABLED or wrong hostname.

### Q: Can I run this in production as-is?
**A:** No. Read `BILL_SCANNER_SECURITY.md` (Production Deployment section) first. Need auth/IP restrictions.

### Q: What if OpenAI returns bad data?
**A:** Check `BILL_SCANNER_REFERENCE.md` (Error Handling section). Function gracefully returns empty topics.

### Q: How much does this cost?
**A:** ~$0.01–0.02 per bill with gpt-4o. Full 40-bill session ≈ $0.50 with batching. See `BILL_SCANNER_REFERENCE.md` (Cost section).

---

## 📞 Support

### For Testing Help
→ See `TEST_BILL_SCANNER.md` (Part 8: Troubleshooting)

### For Security Questions
→ See `BILL_SCANNER_SECURITY.md`

### For Architecture Understanding
→ See `BILL_SCANNER_REFERENCE.md`

### For Implementation Details
→ Review source code in `worker/src/lib/` and `worker/src/routes/`

### For Quick Reference
→ See `BILL_SCANNER_SUMMARY.md` (Executive Overview)

---

## 📝 Document Change Log

| Date | Document | Change |
|------|----------|--------|
| 2025-12-05 | All | Initial suite created |
| 2025-12-05 | test-bill-scanner.js | 6 assertions, Node.js integration |
| 2025-12-05 | BILL_SCANNER_TESTING.md | Complete guide with quick-start |
| 2025-12-05 | BILL_SCANNER_SECURITY.md | Guard documentation + testing |
| 2025-12-05 | BILL_SCANNER_INDEX.md | This file (navigation guide) |

---

## ✨ Success Indicators

After following the test plan, you should see:

✅ `./scripts/wr dev --local` starts without errors  
✅ `curl -X POST http://127.0.0.1:8787/api/internal/civic/scan-pending-bills` returns 200  
✅ Response includes scanned > 0 and results array  
✅ Each result has topics array with canonical slugs  
✅ WY_DB.civic_item_ai_tags has new rows  
✅ EVENTS_DB.hot_topic_civic_items has new links  
✅ GET /api/hot-topics shows updated civic_items  
✅ `node test/test-bill-scanner.js` shows "✅ ALL TESTS PASSED"  
✅ Wrangler logs show emoji prefixes (🚀📋📄✅)  
✅ No ❌ or error messages in ./scripts/wr console  

---

## 🎯 Next Milestone

Once all tests pass:
1. Review production requirements (BILL_SCANNER_SECURITY.md)
2. Plan deployment strategy
3. Add authentication/authorization
4. Deploy to Cloudflare Workers
5. Monitor OpenAI API costs and accuracy

---

**Status:** ✅ **DOCUMENTATION COMPLETE**  
**Last Updated:** December 5, 2025  
**All Files:** Committed to `main` branch

**Start testing:** Read `BILL_SCANNER_TESTING.md` now →
