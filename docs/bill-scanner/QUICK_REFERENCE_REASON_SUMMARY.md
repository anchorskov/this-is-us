# Quick Reference: reason_summary & User Prompt Templates

---

## New Migration SQL

**File:** `worker/migrations_wy/0010_add_reason_summary_to_civic_item_ai_tags.sql`

```sql
-- Add reason_summary column to civic_item_ai_tags
-- Captures AI explanation of why a bill matches a hot topic
ALTER TABLE civic_item_ai_tags ADD COLUMN reason_summary TEXT;
```

**Apply locally:**
```bash
./scripts/wr d1 migrations apply WY_DB --local
```

---

## Updated TypeScript/JavaScript Snippets

### 1. Analyzer JSON Shape

**From analyzeBillForHotTopics():**

```javascript
{
  "topics": [
    {
      "slug": "property-tax-relief",
      "label": "Property Tax Relief",
      "confidence": 0.92,
      "trigger_snippet": "caps property tax assessment increases at 3% annually",
      "reason_summary": "This bill directly addresses homeowner concerns by capping assessment increases to 3% per year, protecting fixed-income retirees and families from sudden property tax spikes."
    }
  ],
  "other_flags": [],
  "tokens": {
    "estimated_prompt_tokens": 150,
    "estimated_completion_tokens": 85,
    "actual_prompt_tokens": 148,
    "actual_completion_tokens": 82
  }
}
```

### 2. JSON Validation in analyzeBillForHotTopics()

```javascript
// Validate and filter to canonical topics only
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
      reason_summary: t.reason_summary || "",  // ← NEW: Default to empty string
    };
  });
```

### 3. Updated saveHotTopicAnalysis() Insert

```javascript
export async function saveHotTopicAnalysis(env, billId, analysis) {
  const { topics = [] } = analysis || {};

  if (topics.length > 0) {
    // Clear prior tags for this bill
    await env.WY_DB.prepare(
      "DELETE FROM civic_item_ai_tags WHERE item_id = ?"
    ).bind(billId).run();

    // ← Updated INSERT to include reason_summary
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

### 4. buildUserPromptTemplate() Function

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

**Usage:**
```javascript
const prompt = buildUserPromptTemplate("HB 22", "Property Tax Relief");
console.log(prompt);
// Output:
// You are a civic educator explaining Wyoming legislation to a regular citizen.
// 
// Bill: HB 22
// Topic: Property Tax Relief
// 
// Explain how this bill relates to "Property Tax Relief" in clear, everyday language...
```

---

## How to Run the Migration

```bash
# Navigate to worker directory
cd /home/anchor/projects/this-is-us/worker

# Apply migration to local WY_DB
./scripts/wr d1 migrations apply WY_DB --local

# Verify the column was added
./scripts/wr d1 execute WY_DB --local \
  --command "PRAGMA table_info(civic_item_ai_tags);" --json | jq
```

**Expected output (last row):**
```json
{
  "cid": 6,
  "name": "reason_summary",
  "type": "TEXT",
  "notnull": 0,
  "dflt_value": null,
  "pk": 0
}
```

---

## Testing the Feature

### 1. Start Dev Server
```bash
export OPENAI_API_KEY="sk-..."
export BILL_SCANNER_ENABLED=true
./scripts/wr dev --local
```

### 2. Run a Scan
```bash
curl -X POST http://127.0.0.1:8787/api/internal/civic/scan-pending-bills | jq '.results[0]'
```

### 3. Check the Response
```json
{
  "bill_id": "ocd-bill/us-wy:bill/2025/HB 22",
  "bill_number": "HB 22",
  "topics": ["property-tax-relief"],
  "user_prompt_templates": [
    "You are a civic educator explaining Wyoming legislation to a regular citizen.\n\nBill: HB 22\nTopic: Property Tax Relief\n\nExplain how this bill relates to \"Property Tax Relief\" in clear, everyday language. Describe the main changes the bill proposes, what problem it tries to solve, and how it might affect daily life for Wyoming residents. Avoid legal jargon—use simple examples if needed."
  ],
  "confidence_avg": "0.92"
}
```

### 4. Verify Database Storage
```bash
./scripts/wr d1 execute WY_DB --local \
  --command "SELECT item_id, topic_slug, confidence, trigger_snippet, reason_summary FROM civic_item_ai_tags LIMIT 1;" --json | jq '.results[0]'
```

**Expected output:**
```json
{
  "item_id": "ocd-bill/us-wy:bill/2025/HB 22",
  "topic_slug": "property-tax-relief",
  "confidence": 0.92,
  "trigger_snippet": "caps property tax assessment increases at 3% annually",
  "reason_summary": "This bill directly addresses homeowner concerns by capping assessment increases to 3% per year, protecting fixed-income retirees and families from sudden property tax spikes. It expands exemptions for agricultural land, which affects rural Wyoming communities and farm operations throughout the state."
}
```

---

## Key Changes at a Glance

| Component | Change |
|-----------|--------|
| **OpenAI Prompt** | Added reason_summary field to SYSTEM_PROMPT |
| **JSON Parsing** | Validate reason_summary, default to "" if missing |
| **Database Insert** | Include reason_summary in VALUES clause |
| **Response Shape** | Add user_prompt_templates array (one per topic) |
| **New Function** | buildUserPromptTemplate(billNumber, topicLabel) |
| **New Migration** | 0010_add_reason_summary_to_civic_item_ai_tags.sql |

---

## Token Impact

**Per bill analysis:**
- **Prompt tokens:** +0–20 (metadata for system prompt slightly longer)
- **Completion tokens:** +20–50 (1–3 sentences per reason_summary)
- **Total per bill:** ~20–50 additional tokens
- **Cost:** <$0.00001 per bill at gpt-4o rates

**For 10-bill batch:** ~$0.00010 additional cost (minimal)

---

## Commit History

1. **ecb872b** – feat: add reason_summary and buildUserPromptTemplate
   - Migration 0010 created
   - SYSTEM_PROMPT updated
   - JSON validation updated
   - buildUserPromptTemplate() added
   - saveHotTopicAnalysis() INSERT updated
   - handleScanPendingBills() response updated

2. **8eb9123** – docs: add comprehensive guide
   - Full documentation of all changes
   - Testing walkthrough
   - Future enhancement ideas

---

## Next Steps

1. ✅ Apply migration: `./scripts/wr d1 migrations apply WY_DB --local`
2. ✅ Run a test scan and verify reason_summary is captured
3. ✅ Use user_prompt_templates in UI (copy button, LLM links, etc.)
4. ⏳ Add analytics to track citizen engagement with templates
5. ⏳ Consider future schema extensions (model tracking, user feedback)

---

**Status:** ✅ Ready for immediate use  
**All constraints met:** No significant token cost, no breaking changes, graceful defaults
