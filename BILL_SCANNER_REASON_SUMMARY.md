# Bill Scanner: Reason Summary & User Prompt Template

**Commit:** `ecb872b`  
**Date:** December 5, 2025

---

## Overview

Extended the Wyoming bill scanner to capture **AI explanations** of why bills match hot topics, and provide **reusable LLM prompt templates** that citizens can paste into any AI to understand bills in plain language.

### New Components

1. **reason_summary field** – AI-generated explanation stored in database
2. **buildUserPromptTemplate()** – Pure helper for citizen-friendly prompts
3. **user_prompt_templates array** – Available in scan results

---

## 1. Database Migration

### File: `worker/migrations_wy/0010_add_reason_summary_to_civic_item_ai_tags.sql`

```sql
-- Add reason_summary column to civic_item_ai_tags
-- Captures AI explanation of why a bill matches a hot topic
ALTER TABLE civic_item_ai_tags ADD COLUMN reason_summary TEXT;
```

**Apply locally:**
```bash
cd /home/anchor/projects/this-is-us/worker
npx wrangler d1 migrations apply WY_DB --local
```

**Table schema after migration:**
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto-increment |
| item_id | TEXT NOT NULL | References civic_items.id |
| topic_slug | TEXT NOT NULL | e.g., "property-tax-relief" |
| confidence | REAL NOT NULL | 0.0–1.0 match score |
| trigger_snippet | TEXT | Quoted/paraphrased passage |
| **reason_summary** | **TEXT** | **NEW: 1-3 sentences explaining the match** |
| created_at | TEXT NOT NULL | Timestamp |

---

## 2. OpenAI Prompt Enhancement

### Updated System Prompt

The SYSTEM_PROMPT in `hotTopicsAnalyzer.mjs` now includes:

```javascript
"reason_summary": "One to three sentences explaining plainly why this bill matches this topic. Mention key changes and why Wyomingites care."
```

**Example output from OpenAI:**

```json
{
  "slug": "property-tax-relief",
  "label": "Property Tax Relief",
  "confidence": 0.92,
  "trigger_snippet": "caps property tax assessment increases at 3% annually",
  "reason_summary": "This bill directly addresses homeowner concerns by capping assessment increases to 3% per year, protecting fixed-income retirees and families from sudden property tax spikes. It expands exemptions for agricultural land, which affects rural Wyoming communities and farm operations throughout the state."
}
```

**Token impact:** ~20–50 additional tokens per topic match (minimal cost increase).

---

## 3. JSON Validation & Storage

### Updated `analyzeBillForHotTopics()` Output

Each topic now includes `reason_summary`:

```javascript
export async function analyzeBillForHotTopics(env, bill, opts = {}) {
  // ... OpenAI call ...
  
  const topics = (Array.isArray(parsed.topics) ? parsed.topics : [])
    .filter((t) => t?.slug && CANONICAL_TOPICS[t.slug])
    .map((t) => {
      const canonical = CANONICAL_TOPICS[t.slug];
      const conf = typeof t.confidence === "number" ? Math.max(0, Math.min(1, t.confidence)) : 0;
      return {
        slug: t.slug,
        label: canonical.label,
        confidence: conf,
        trigger_snippet: t.trigger_snippet || null,
        reason_summary: t.reason_summary || "",  // ← NEW: Default to empty string if missing
      };
    });
  
  return { topics, other_flags, tokens: tokenData };
}
```

**Defaults:** If OpenAI omits `reason_summary`, it defaults to empty string (graceful fallback).

---

## 4. Database Insert

### Updated `saveHotTopicAnalysis()`

The INSERT statement now includes the `reason_summary` column:

```javascript
export async function saveHotTopicAnalysis(env, billId, analysis) {
  const { topics = [], other_flags = [] } = analysis || {};

  if (topics.length > 0) {
    // Clear prior tags for this bill to avoid duplication
    await env.WY_DB.prepare(
      "DELETE FROM civic_item_ai_tags WHERE item_id = ?"
    ).bind(billId).run();

    // ← INSERT now includes reason_summary
    const stmt = env.WY_DB.prepare(
      `INSERT INTO civic_item_ai_tags (item_id, topic_slug, confidence, trigger_snippet, reason_summary)
         VALUES (?1, ?2, ?3, ?4, ?5)`
    );
    for (const topic of topics) {
      const conf = typeof topic.confidence === "number" ? topic.confidence : 0;
      const snippet = topic.trigger_snippet || null;
      const reason = topic.reason_summary || "";  // ← Extract reason_summary
      try {
        await stmt.bind(billId, topic.slug, conf, snippet, reason).run();
      } catch (err) {
        console.warn(`⚠️ Failed to insert tag for ${billId}/${topic.slug}:`, err);
      }
    }
  }

  // Phase 2: Link to EVENTS_DB.hot_topic_civic_items (unchanged)
  // ...
}
```

---

## 5. User Prompt Template Helper

### New Function: `buildUserPromptTemplate()`

**File:** `worker/src/lib/hotTopicsAnalyzer.mjs`

```javascript
/**
 * buildUserPromptTemplate(billNumber, topicLabel)
 * 
 * Construct a citizen-friendly LLM prompt template without calling OpenAI.
 * Returns a string that citizens can paste into any LLM (ChatGPT, Claude, etc.)
 * to get an explanation of how a Wyoming bill relates to a topic they care about.
 * 
 * @param {string} billNumber - Bill identifier (e.g., "HB 22")
 * @param {string} topicLabel - Human-readable topic (e.g., "Property Tax Relief")
 * @returns {string} A prompt suitable for copy-pasting into any LLM
 */
export function buildUserPromptTemplate(billNumber, topicLabel) {
  return (
    `You are a civic educator explaining Wyoming legislation to a regular citizen.\n\n` +
    `Bill: ${billNumber}\n` +
    `Topic: ${topicLabel}\n\n` +
    `Explain how this bill relates to "${topicLabel}" in clear, everyday language. ` +
    `Describe the main changes the bill proposes, what problem it tries to solve, ` +
    `and how it might affect daily life for Wyoming residents. ` +
    `Avoid legal jargon—use simple examples if needed.`
  );
}
```

**Example output:**

```
You are a civic educator explaining Wyoming legislation to a regular citizen.

Bill: HB 22
Topic: Property Tax Relief

Explain how this bill relates to "Property Tax Relief" in clear, everyday language. Describe the main changes the bill proposes, what problem it tries to solve, and how it might affect daily life for Wyoming residents. Avoid legal jargon—use simple examples if needed.
```

**Key features:**
- Pure function (no OpenAI call, no database access)
- Returns a plain string citizens can copy/paste
- Works with any LLM (ChatGPT, Claude, Gemini, local models, etc.)
- Zero cost (no API calls)

---

## 6. Wire Into Scan Results

### Updated `handleScanPendingBills()` in `civicScan.mjs`

```javascript
export async function handleScanPendingBills(request, env) {
  // ... scan setup ...

  const results = [];

  for (const bill of bills) {
    try {
      const analysis = await analyzeBillForHotTopics(env, bill);
      await saveHotTopicAnalysis(env, bill.id, analysis);

      // Collect results
      const topicSlugs = analysis.topics.map(t => t.slug);
      // ← NEW: Build user_prompt_templates array
      const userPromptTemplates = analysis.topics.map(t => 
        buildUserPromptTemplate(bill.bill_number, t.label)
      );
      
      results.push({
        bill_id: bill.id,
        bill_number: bill.bill_number,
        topics: topicSlugs,
        user_prompt_templates: userPromptTemplates,  // ← NEW: Array of prompts
        confidence_avg: 
          topicSlugs.length > 0
            ? (analysis.topics.reduce((sum, t) => sum + (t.confidence || 0), 0) / topicSlugs.length)
              .toFixed(2)
            : null,
      });
    } catch (billErr) {
      // Error handling...
    }
  }

  return new Response(
    JSON.stringify({
      scanned: results.length,
      results,
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
```

**Example response:**

```json
{
  "scanned": 1,
  "results": [
    {
      "bill_id": "ocd-bill/us-wy:bill/2025/HB 22",
      "bill_number": "HB 22",
      "topics": ["property-tax-relief"],
      "user_prompt_templates": [
        "You are a civic educator explaining Wyoming legislation to a regular citizen.\n\nBill: HB 22\nTopic: Property Tax Relief\n\nExplain how this bill relates to \"Property Tax Relief\" in clear, everyday language..."
      ],
      "confidence_avg": "0.92"
    }
  ],
  "timestamp": "2025-12-05T15:42:18.000Z"
}
```

---

## 7. Testing the New Features

### Step 1: Apply Migration

```bash
cd /home/anchor/projects/this-is-us/worker
npx wrangler d1 migrations apply WY_DB --local
```

### Step 2: Start Dev Server

```bash
export OPENAI_API_KEY="sk-..."
export BILL_SCANNER_ENABLED=true
npx wrangler dev --local
```

### Step 3: Run Scan

```bash
curl -X POST http://127.0.0.1:8787/api/internal/civic/scan-pending-bills | jq '.results[0]'
```

**Expected output includes:**
```json
{
  "bill_id": "...",
  "bill_number": "HB 22",
  "topics": ["property-tax-relief"],
  "user_prompt_templates": [
    "You are a civic educator...\nBill: HB 22\nTopic: Property Tax Relief\n..."
  ],
  "confidence_avg": "0.92"
}
```

### Step 4: Verify Database

```bash
npx wrangler d1 execute WY_DB --local \
  --command "SELECT item_id, topic_slug, reason_summary FROM civic_item_ai_tags LIMIT 1;" --json
```

**Expected output:**
```json
{
  "results": [
    {
      "item_id": "ocd-bill/us-wy:bill/2025/HB 22",
      "topic_slug": "property-tax-relief",
      "reason_summary": "This bill directly addresses homeowner concerns by capping assessment increases to 3% per year..."
    }
  ]
}
```

---

## 8. Code Changes Summary

| File | Changes |
|------|---------|
| `worker/migrations_wy/0010_add_reason_summary_to_civic_item_ai_tags.sql` | **NEW:** Add reason_summary column |
| `worker/src/lib/hotTopicsAnalyzer.mjs` | Update SYSTEM_PROMPT, add reason_summary to JSON validation, add buildUserPromptTemplate(), update INSERT |
| `worker/src/routes/civicScan.mjs` | Import buildUserPromptTemplate, build user_prompt_templates in handleScanPendingBills |

**Total lines added:** ~45  
**Total lines modified:** 5  
**New functions:** 1 (buildUserPromptTemplate)  
**New migrations:** 1 (0010)

---

## 9. Future Enhancements

### UI Integration
- Display `reason_summary` on bill detail pages
- Show `user_prompt_templates` as "Explain this bill" buttons
- Link to citizen's favorite LLM with pre-filled prompt

### Analytics
- Track which templates are most clicked
- A/B test prompt phrasing for different audiences
- Measure citizen engagement with bills

### Schema Extensions (Milestone 4)
If tracking model performance, consider future migration:
```sql
ALTER TABLE civic_item_ai_tags ADD COLUMN model TEXT;
ALTER TABLE civic_item_ai_tags ADD COLUMN user_feedback_helpful INT;  -- 0/1
ALTER TABLE civic_item_ai_tags ADD COLUMN user_feedback_clear INT;   -- 0/1
```

---

## 10. Migration Checklist

- [x] New migration file created (0010)
- [x] SYSTEM_PROMPT updated to request reason_summary
- [x] JSON validation includes reason_summary with empty string default
- [x] INSERT statement includes reason_summary column
- [x] buildUserPromptTemplate() pure helper added
- [x] user_prompt_templates array wired into scan response
- [x] All imports updated
- [x] Code style matches existing patterns
- [x] Committed and pushed to main

---

## Summary

**What users see:**

1. **In database:** Explanations of why each bill matches each topic (searchable, auditable)
2. **In API response:** User-friendly prompts they can paste into any LLM
3. **In logs:** Confirmation of reason_summary storage with full audit trail

**Token cost:** Minimal increase (~20–50 tokens per topic match, <$0.00001 per bill)

**Next steps:**
1. Run `npx wrangler d1 migrations apply WY_DB --local` to add column
2. Test with full scan to verify reason_summary is captured
3. Use user_prompt_templates in UI to help citizens understand bills

---

**Commit:** `ecb872b`  
**Status:** ✅ Ready for local testing and integration
