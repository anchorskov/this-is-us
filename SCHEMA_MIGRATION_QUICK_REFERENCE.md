# Wyoming Bill Scanner: Schema & Migration Quick Reference

## Current Status

✅ **reason_summary** (WY_DB.civic_item_ai_tags)
- Migration 0010: Already applied locally and remotely
- Stores: 1-3 sentence plain-language explanation of why bill matches topic
- Status: **LIVE AND WORKING**

✅ **match_criteria_json** (EVENTS_DB.hot_topics)
- Migration 0015: Created, ready to apply
- Purpose: Flexible JSON for future rule-based filtering
- Status: **READY FOR APPLICATION**

---

## Apply Migrations Now

```bash
cd /home/anchor/projects/this-is-us/worker

# Apply to local development
npx wrangler d1 migrations apply WY_DB --local
npx wrangler d1 migrations apply EVENTS_DB --local

# Apply to production (when ready)
npx wrangler d1 migrations apply WY_DB --remote
npx wrangler d1 migrations apply EVENTS_DB --remote
```

---

## Verify Schema

```bash
# Check WY_DB civic_item_ai_tags
npx wrangler d1 execute WY_DB --local \
  --command "PRAGMA table_info(civic_item_ai_tags);" --json | jq

# Check EVENTS_DB hot_topics
npx wrangler d1 execute EVENTS_DB --local \
  --command "PRAGMA table_info(hot_topics);" --json | jq
```

---

## Example: reason_summary in API Response

When a bill is scanned and saved, the response includes plain-language explanations:

```json
{
  "bill_number": "HB 22",
  "topics": [
    {
      "slug": "property-tax-relief",
      "label": "Property Tax Relief",
      "confidence": 0.92,
      "trigger_snippet": "caps property tax assessment increases at 3% annually",
      "reason_summary": "This bill directly addresses homeowner concerns by capping property tax assessment increases to 3% per year, protecting families and retirees from sudden tax spikes."
    }
  ]
}
```

---

## Example: match_criteria_json (Future Use)

Currently NULL, but can store filtering rules:

```json
{
  "title_keywords": ["property", "tax", "assessment"],
  "summary_keywords": ["homeowner", "burden"],
  "subject_tags": ["Tax Reform"],
  "exclude_keywords": ["federal"],
  "min_rule_score": 0.7
}
```

---

## Files Changed

- `worker/migrations/0015_add_match_criteria_json_to_hot_topics.sql` – NEW
- `worker/src/lib/hotTopicsAnalyzer.mjs` – Updated docs
- `documentation/SCHEMA_REFINEMENT_COMPLETE.md` – Full details

---

## Backward Compatibility

✅ All changes are additive (no breaking changes)
✅ New columns default to NULL
✅ Existing queries work unchanged
✅ No table recreations or drops

---

**Last Updated:** December 5, 2025  
**Commits:** 895fbbb, 2fef0d5
