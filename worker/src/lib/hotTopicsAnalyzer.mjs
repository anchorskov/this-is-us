/**
 * worker/src/lib/hotTopicsAnalyzer.mjs
 * 
 * Hot button topic analyzer for Wyoming bills using OpenAI gpt-4o.
 * 
 * **NOTE: Two-Level Summarization Strategy**
 * This module provides TOPIC-LEVEL AI analysis (why a bill matches specific hot topics).
 * See worker/src/lib/billSummaryAnalyzer.mjs for BILL-LEVEL summaries (what the bill does).
 * - hotTopicsAnalyzer → civic_item_ai_tags.reason_summary (topic-specific: "why this bill matters for X topic")
 * - billSummaryAnalyzer → civic_items.ai_summary (bill-level: "what this bill does overall")
 * Both cached, generated once per bill, reused for all card displays.
 * 
 * **OpenAI Integration:**
 * - Uses same pattern as worker/src/routes/sandbox.js: env.OPENAI_API_KEY bearer token
 * - Model: gpt-4o
 * - Temperature: 0.2 (conservative, factual matching)
 * - Max tokens: 400–500 per bill (cost-efficient, configurable)
 * 
 * **Input Shape (civic_items row):**
 * - id (TEXT): OCD bill ID
 * - bill_number (TEXT): e.g., "HB 22"
 * - title (TEXT): Bill title
 * - summary (TEXT): Abstract or summary
 * - subject_tags (TEXT): Comma-separated subjects
 * - status (TEXT): e.g., "introduced", "in_committee"
 * - legislative_session (INTEGER): e.g., 2025
 * - chamber (TEXT): "lower" or "upper"
 * - last_action (TEXT): Most recent action description
 * - last_action_date (TEXT): ISO date of last action
 * - text_url (TEXT, optional): Link to full bill text
 * 
 * **Output Shape:**
 * {
 *   "topics": [
 *     {
 *       "slug": "property-tax-relief",
 *       "label": "Property Tax Relief",
 *       "confidence": 0.92,
 *       "trigger_snippet": "Short quoted or paraphrased passage from the bill",
 *       "reason_summary": "One to three sentences explaining why this bill matches this topic."
 *     }
 *   ],
 *   "other_flags": [
 *     {
 *       "label": "Other potential concern",
 *       "confidence": 0.7,
 *       "trigger_snippet": "Short text that triggered this label"
 *     }
 *   ],
 *   "tokens": {
 *     "estimated_prompt_tokens": 125,
 *     "estimated_completion_tokens": 80,
 *     "actual_prompt_tokens": 120,
 *     "actual_completion_tokens": 78
 *   }
 * }
 * 
 * **Cost Estimation:**
 * - Prompt tokens estimated as: text.length / 4 (conservative)
 * - Completion tokens estimated as: (max_tokens * 0.3) for typical response
 * - OpenAI API includes actual usage in response; logged for verification
 * - At gpt-4o pricing (~$0.0015 per 1K input, ~$0.006 per 1K output):
 *   - Single bill scan ≈ $0.00015 (est. 100 prompt + 60 completion tokens)
 *   - 10-bill batch ≈ $0.0015 (most cost-efficient per bill)
 *   - 40-bill session ≈ $0.006 total
 * 
 * **User Prompt Template Helper:**
 * The buildUserPromptTemplate(billNumber, topicLabel) function (no OpenAI call)
 * returns a citizen-friendly prompt string suitable for pasting into any LLM.
 * Used to help citizens understand bills in their own words.
 * 
 * **Canonical Hot Topics:**
 * Only these six slugs may appear in topics array:
 * - property-tax-relief
 * - water-rights
 * - education-funding
 * - energy-permitting
 * - public-safety-fentanyl
 * - housing-land-use
 */

const MODEL = "gpt-4o";
const TEMPERATURE = 0.2;
const MAX_TOKENS = 500;
const MAX_TOKENS_SUMMARY_ONLY = 400;
const RETRIES = 1; // number of retries on OpenAI failure (total attempts = 1 + RETRIES)

const PENDING_STATUSES = ["introduced", "in_committee", "pending_vote"];

/**
 * Canonical hot button topics for Wyoming with descriptive labels.
 * These are the ONLY valid slugs allowed in the topics array.
 * 
 * NOTE: Topics expanded to include broader categories that match our test dataset:
 * - Original 6 "hot button" topics (high political sensitivity)
 * - Extended 4 topics (broader policy areas reflecting current legislature)
 * Total: 10 topics
 */
const CANONICAL_TOPICS = {
  // Original 6 hot button topics
  "property-tax-relief": {
    label: "Property Tax Relief",
    description: "Rising assessments squeezing homeowners; proposals cap increases and expand exemptions.",
  },
  "water-rights": {
    label: "Water Rights & Drought Planning",
    description: "Allocation rules and storage/efficiency funding to balance agricultural, energy, and municipal needs.",
  },
  "education-funding": {
    label: "Education Funding & Local Control",
    description: "Adjusting school funding and curriculum oversight; impacts class sizes and local boards.",
  },
  "energy-permitting": {
    label: "Energy Permitting & Grid Reliability",
    description: "Streamlining permits for transmission or generation with reclamation standards.",
  },
  "public-safety-fentanyl": {
    label: "Public Safety & Fentanyl Response",
    description: "Penalties, interdiction funding, and treatment resources targeting opioid trafficking.",
  },
  "housing-land-use": {
    label: "Housing & Land Use",
    description: "Zoning reforms, infrastructure grants, and incentives for workforce housing near jobs.",
  },
  
  // Extended topics from current legislative session
  "healthcare-access": {
    label: "Healthcare Access & Medicaid",
    description: "Medicaid coverage, hospital services, EMS funding, and healthcare provider support.",
  },
  "reproductive-health": {
    label: "Reproductive Health & Rights",
    description: "Pregnancy centers, birthing facilities, and reproductive healthcare access.",
  },
  "child-safety-education": {
    label: "Child Safety & Education",
    description: "Minor protection, school safety, curriculum oversight, and K-12 education initiatives.",
  },
  "criminal-justice-reform": {
    label: "Criminal Justice & Public Safety",
    description: "Crime amendments, penalties, law enforcement resources, and public safety initiatives.",
  },
};

const SYSTEM_PROMPT = `
You are a nonpartisan analyst matching Wyoming bills to ten specific policy areas of public interest.

**Match these ten topics only:**

1. **property-tax-relief** – Property Tax Relief
   Rising assessments squeezing homeowners; proposals cap increases and expand exemptions.

2. **water-rights** – Water Rights & Drought Planning
   Allocation rules and storage/efficiency funding to balance agricultural, energy, and municipal needs.

3. **education-funding** – Education Funding & Local Control
   Adjusting school funding and curriculum oversight; impacts class sizes and local boards.

4. **energy-permitting** – Energy Permitting & Grid Reliability
   Streamlining permits for transmission or generation with reclamation standards.

5. **public-safety-fentanyl** – Public Safety & Fentanyl Response
   Penalties, interdiction funding, and treatment resources targeting opioid trafficking.

6. **housing-land-use** – Housing & Land Use
   Zoning reforms, infrastructure grants, and incentives for workforce housing near jobs.

7. **healthcare-access** – Healthcare Access & Medicaid
   Medicaid coverage, hospital services, EMS funding, and healthcare provider support.

8. **reproductive-health** – Reproductive Health & Rights
   Pregnancy centers, birthing facilities, and reproductive healthcare access.

9. **child-safety-education** – Child Safety & Education
   Minor protection, school safety, curriculum oversight, and K-12 education initiatives.

10. **criminal-justice-reform** – Criminal Justice & Public Safety
    Crime amendments, penalties, law enforcement resources, and public safety initiatives.

**Confidence Guidelines:**
- 0.70+ for strong topical match (clearly related to topic area)
- 0.50–0.69 for moderate relevance with reasonable connection
- <0.50 place in other_flags instead (or omit if very weak)

**Output Format:**
Return STRICT JSON only, no extra prose:
{
  "topics": [
    {
      "slug": "criminal-justice-reform",
      "label": "Criminal Justice & Public Safety",
      "confidence": 0.85,
      "trigger_snippet": "Brief quoted or paraphrased passage from the bill",
      "reason_summary": "One to three sentences explaining plainly why this bill matches this topic. Mention key changes and why Wyomingites care."
    }
  ],
  "other_flags": [
    {
      "label": "Other issue (use any label)",
      "confidence": 0.45,
      "trigger_snippet": "Short text that triggered this flag"
    }
  ]
}

Do NOT invent new topic slugs. Use ONLY the ten listed above in the topics array.
Use short snippets. Do not include any fields beyond those shown.
`;

function buildUserPrompt(bill) {
  const {
    bill_number,
    title,
    summary,
    subject_tags,
    last_action,
    last_action_date,
    ai_summary,
    ai_key_points,
  } = bill || {};

  // Use AI-generated summary if available (richer, more detailed)
  // Otherwise fall back to basic summary field
  const bestSummary = ai_summary || summary;
  const keyPointsText = Array.isArray(ai_key_points) && ai_key_points.length > 0
    ? `Key points: ${ai_key_points.join(" | ")}`
    : null;

  return [
    `Bill number: ${bill_number || "unknown"}`,
    `Title: ${title || "unknown"}`,
    bestSummary ? `Summary: ${bestSummary}` : "Summary: (none provided)",
    keyPointsText ? `${keyPointsText}` : null,
    subject_tags ? `Subject tags: ${subject_tags}` : null,
    last_action ? `Last action: ${last_action}` : null,
    last_action_date ? `Last action date: ${last_action_date}` : null,
    "\nInstructions:",
    "- Match to the canonical topics when applicable.",
    "- Place lower-confidence matches (<0.70) or off-topic bills in other_flags.",
    "- Never invent new topic slugs; only use the provided topics.",
    "- Provide short trigger snippets (quoted or paraphrased from the bill).",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * getSinglePendingBill(env, options)
 * 
 * Fetch exactly one pending bill from WY_DB.civic_items.
 * Useful for single-bill testing without OpenAI.
 * 
 * @param {Env} env - Worker environment with WY_DB
 * @param {Object} options - Optional filters
 * @param {string} options.billNumber - Target specific bill (e.g., "HB 22")
 * @param {string} options.itemId - Target specific item by OCD ID
 * @returns {Promise<Object|null>} Single civic_items row or null
 * 
 * **Prompt fields included:**
 * - bill_number, title, summary, subject_tags, last_action, last_action_date
 * (Omits text_url and full bill text for cost efficiency)
 * 
 * **Future expansion (when needed):**
 * - Add opts.includeFullText to fetch and include text_url + full bill content
 * - Add opts.orderBy = 'bill_number' | 'last_action_date' (default)
 */
export async function getSinglePendingBill(env, options = {}) {
  const { billNumber, itemId } = options;

  let sql = `
    SELECT 
      id, 
      bill_number, 
      title, 
      summary, 
      subject_tags, 
      status, 
      legislative_session,
      chamber,
      last_action,
      last_action_date,
      text_url,
      ai_summary,
      ai_key_points,
      ai_summary_generated_at
    FROM civic_items
  `;

  const params = [];

  if (itemId) {
    // Direct lookup by OCD item ID
    sql += ` WHERE id = ?`;
    params.push(itemId);
  } else if (billNumber) {
    // Lookup by bill number
    sql += ` WHERE bill_number = ? AND status IN (${PENDING_STATUSES.map(() => "?").join(",")})`;
    params.push(billNumber, ...PENDING_STATUSES);
  } else {
    // Fetch most recent pending bill
    sql += ` WHERE status IN (${PENDING_STATUSES.map(() => "?").join(",")})`;
    params.push(...PENDING_STATUSES);
  }

  sql += ` ORDER BY last_action_date DESC LIMIT 1`;

  try {
    const result = await env.WY_DB.prepare(sql).bind(...params).first();
    return result || null;
  } catch (err) {
    console.error(`❌ getSinglePendingBill error:`, err);
    return null;
  }
}

async function callOpenAI(env, body, billId) {
  // Estimate tokens BEFORE the call
  const systemTokens = SYSTEM_PROMPT.length / 4;
  const userTokens = body.messages[1].content.length / 4;
  const estimatedPromptTokens = Math.ceil(systemTokens + userTokens);
  const estimatedCompletionTokens = Math.ceil(body.max_tokens * 0.3);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI request failed: ${res.status} ${text}`);
    }

    const data = await res.json();

    // Log token usage (estimate vs actual)
    const usage = data?.usage || {};
    const actualPromptTokens = usage.prompt_tokens || null;
    const actualCompletionTokens = usage.completion_tokens || null;

    console.log(`💰 OpenAI usage [${billId}]:`);
    console.log(`   Estimated: ${estimatedPromptTokens} prompt + ${estimatedCompletionTokens} completion = ${estimatedPromptTokens + estimatedCompletionTokens} total`);
    if (actualPromptTokens !== null) {
      console.log(`   Actual:    ${actualPromptTokens} prompt + ${actualCompletionTokens} completion = ${actualPromptTokens + actualCompletionTokens} total`);
      const promptDiff = actualPromptTokens - estimatedPromptTokens;
      const completionDiff = actualCompletionTokens - estimatedCompletionTokens;
      console.log(`   Variance:  prompt ${promptDiff > 0 ? "+" : ""}${promptDiff}, completion ${completionDiff > 0 ? "+" : ""}${completionDiff}`);
    }

    return {
      data,
      tokens: {
        estimated_prompt_tokens: estimatedPromptTokens,
        estimated_completion_tokens: estimatedCompletionTokens,
        actual_prompt_tokens: actualPromptTokens,
        actual_completion_tokens: actualCompletionTokens,
      },
    };
  } catch (err) {
    console.error(`❌ OpenAI API error [${billId}]:`, err.message);
    throw err;
  }
}

/**
 * generateBillSummary(env, bill)
 * 
 * Generate a short, citizen-friendly AI summary + key points for a bill.
 * Cached in civic_items.ai_summary and ai_key_points to avoid repeated API calls.
 * 
 * **Output:**
 * {
 *   "ai_summary": "One to two sentences explaining the bill's main purpose in plain language.",
 *   "ai_key_points": ["Point 1", "Point 2", "Point 3"]
 * }
 * 
 * **Cost:** ~$0.0002 per bill (150 prompt + 60 completion tokens)
 * 
 * @param {Env} env - Worker environment with OPENAI_API_KEY
 * @param {Object} bill - civic_items row with bill_number, title, summary, etc.
 * @returns {Promise<{ai_summary: string, ai_key_points: Array<string>}>}
 */
export async function generateBillSummary(env, bill) {
  if (!env?.OPENAI_API_KEY) {
    console.warn("⚠️ Missing OPENAI_API_KEY; cannot generate bill summary");
    return { ai_summary: "", ai_key_points: [] };
  }

  const billPrompt = `
You are a civic educator explaining Wyoming legislation to regular citizens.

**Bill:** ${bill.bill_number} - ${bill.title}
**Summary:** ${bill.summary || "(No summary provided)"}
**Status:** ${bill.status}
**Chamber:** ${bill.chamber}

Please provide:
1. A plain-language explanation (1–2 sentences) of what this bill does and why it matters to regular Wyoming residents.
2. Exactly 2–3 key points about the bill's main impacts or changes, formatted as a JSON array.

Respond ONLY with valid JSON:
{
  "ai_summary": "...",
  "ai_key_points": ["...", "...", "..."]
}
`.trim();

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: billPrompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`OpenAI API error: ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.warn(`⚠️ Failed to parse bill summary response for ${bill.bill_number}:`, content);
      return { ai_summary: "", ai_key_points: [] };
    }

    // Validate and sanitize
    const ai_summary = String(parsed.ai_summary || "").slice(0, 500); // Limit to 500 chars
    const ai_key_points = Array.isArray(parsed.ai_key_points)
      ? parsed.ai_key_points.map((pt) => String(pt).slice(0, 200)).slice(0, 3)
      : [];

    return { ai_summary, ai_key_points };
  } catch (err) {
    console.error(`❌ Bill summary error [${bill.bill_number}]:`, err.message);
    return { ai_summary: "", ai_key_points: [] };
  }
}

/**
 * analyzeBillForHotTopics(env, bill, opts)
 * 
 * Calls OpenAI gpt-4o to match a Wyoming bill against the six canonical hot topics.
 * 
 * **Default behavior (cost-efficient):**
 * - Includes: bill_number, title, summary, subject_tags, last_action, last_action_date
 * - Omits: full bill text (avoids large tokens)
 * - max_tokens: 500 (typical response ~80–120 completion tokens)
 * - Cost per bill: ~$0.00015 USD at gpt-4o rates
 * 
 * **Options (opts parameter):**
 * - opts.summaryOnly = true: Reduce max_tokens to 400 for even lower cost (~$0.00010)
 * - (Future) opts.includeFullText: Pull and include bill text_url content (higher cost)
 * 
 * @param {Env} env - Worker environment with OPENAI_API_KEY
 * @param {Object} bill - civic_items row
 * @param {Object} opts - Optional behavior flags
 * @param {boolean} opts.summaryOnly - Use smaller max_tokens (400) for lower cost
 * @returns {Promise<{topics: Array, other_flags: Array, tokens?: Object}>}
 *          Returns { topics: [], other_flags: [], tokens: {...} } on error or success.
 */
export async function analyzeBillForHotTopics(env, bill, opts = {}) {
  if (!env?.OPENAI_API_KEY) {
    console.warn("⚠️ Missing OPENAI_API_KEY; cannot analyze bills");
    return { topics: [], other_flags: [] };
  }

  const billId = bill?.id || "unknown";
  const userPrompt = buildUserPrompt(bill);
  const maxTokens = opts.summaryOnly ? MAX_TOKENS_SUMMARY_ONLY : MAX_TOKENS;

  const body = {
    model: MODEL,
    temperature: TEMPERATURE,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  };

  let response = null;
  let tokenData = null;

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const result = await callOpenAI(env, body, billId);
      response = result.data;
      tokenData = result.tokens;
      break;
    } catch (err) {
      if (attempt === RETRIES) {
        console.error(`❌ analyzeBillForHotTopics failed for bill ${billId}:`, err.message);
        return { topics: [], other_flags: [], tokens: tokenData };
      }
    }
  }

  const raw = response?.choices?.[0]?.message?.content || "{}";
  let parsed = { topics: [], other_flags: [] };

  try {
    // Strip markdown code fences if present (e.g., ```json ... ```)
    let jsonStr = raw.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr
        .replace(/^```(?:json)?\s*\n?/, "")
        .replace(/\n?```\s*$/, "");
    }
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    console.warn(`⚠️ Failed to parse AI JSON for bill ${billId}:`, raw);
    return { topics: [], other_flags: [], tokens: tokenData };
  }

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
        reason_summary: t.reason_summary || "",
      };
    });

  const other_flags = Array.isArray(parsed.other_flags)
    ? parsed.other_flags.map((f) => ({
        label: f?.label || null,
        confidence:
          typeof f?.confidence === "number" ? Math.max(0, Math.min(1, f.confidence)) : 0,
        trigger_snippet: f?.trigger_snippet || null,
      }))
    : [];

  return { topics, other_flags, tokens: tokenData };
}

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

/**
 * saveHotTopicAnalysis(env, billId, analysis)
 * 
 * Persists the analysis results to D1:
 * 1. Insert topic matches into WY_DB.civic_item_ai_tags
 * 2. (Deprecated) Linking to hot_topic_civic_items is handled elsewhere.
 * 
 * **Current tracking:**
 * - item_id: Bill OCD ID
 * - topic_slug: One of six canonical slugs
 * - confidence: 0.0–1.0 score
 * - trigger_snippet: Quoted/paraphrased text from bill
 * 
 * **Future tracking ideas (Milestone 4):**
 * If you want to improve debugging and cost analysis, consider adding these fields
 * to civic_item_ai_tags (new migration required):
 * - model (TEXT): gpt-4o (or future models)
 * - estimated_prompt_tokens (INTEGER): Tokens before API call
 * - actual_prompt_tokens (INTEGER): Actual usage from OpenAI response
 * - actual_completion_tokens (INTEGER): Actual completion tokens
 * - raw_analysis_json (TEXT): Full JSON response for debugging
 * 
 * These would enable:
 * - Cost tracking and billing per scan
 * - Model performance evaluation
 * - Debugging when confidence scores don't match expectations
 * 
 * Implementation: Define in new migration 0010_enhance_civic_item_ai_tags.sql
 * 
 * @param {Env} env - Worker environment with WY_DB
 * @param {string} billId - civic_items.id (OCD bill ID)
 * @param {Object} analysis - Result from analyzeBillForHotTopics()
 * @returns {Promise<void>}
 */
/**
 * saveHotTopicAnalysis(env, billId, analysis)
 * 
 * Persists AI analysis results to WY_DB.
 * 
 * **Phase 1:** Save to WY_DB.civic_item_ai_tags
 * - Stores: item_id, topic_slug, confidence, trigger_snippet, reason_summary
 * - reason_summary: One to two sentences explaining plainly why this bill matches this topic.
 *   Example: "This bill directly addresses homeowner concerns by capping property tax assessment 
/**
 * saveBillSummary(env, billId, summary, keyPoints, summaryVersion)
 * 
 * Persist bill-level AI summary and key points to WY_DB.civic_items.
 * Includes version tracking to detect when bill text changes and summary needs refresh.
 * 
 * @param {Object} env - Cloudflare Worker environment with WY_DB binding
 * @param {string} billId - Bill ID (e.g., "test-hb22")
 * @param {string} summary - Plain-language bill summary (capped at 500 chars)
 * @param {Array<string>} keyPoints - Array of 2-3 key points (each capped at 200 chars)
 * @param {string} summaryVersion - Version identifier (e.g., text hash or timestamp)
 */
export async function saveBillSummary(env, billId, summary, keyPoints = [], summaryVersion = null) {
  try {
    const keyPointsJson = JSON.stringify(keyPoints);
    const stmt = env.WY_DB.prepare(`
      UPDATE civic_items
      SET 
        ai_summary = ?1,
        ai_key_points = ?2,
        ai_summary_version = ?3,
        ai_summary_generated_at = ?4
      WHERE id = ?5
    `);
    
    await stmt.bind(
      summary || "",
      keyPointsJson,
      summaryVersion || new Date().toISOString(),
      new Date().toISOString(),
      billId
    ).run();
  } catch (err) {
    console.warn(`⚠️ Failed to save bill summary for ${billId}:`, err.message);
  }
}

/**
 * saveHotTopicAnalysis(env, billId, analysis)
 * 
 * Persist AI analysis results to WY_DB.
 * 
 * **Phase 1:** Save to WY_DB.civic_item_ai_tags
 * - Stores: item_id, topic_slug, confidence, trigger_snippet, reason_summary
 * - reason_summary: One to two sentences explaining plainly why this bill matches this topic.
 *   Example: "This bill directly addresses homeowner concerns by capping property tax assessment 
 *   increases to 3% per year, protecting families and retirees from sudden tax spikes."
 * 
 * **Phase 2:** No-op (hot_topic_civic_items is populated by billSummaryAnalyzer)
 * 
 * @param {Object} env - Cloudflare Worker environment with WY_DB binding
 * @param {string} billId - Bill ID (e.g., "ocd-bill/us-wy:bill/2025/HB 22")
 * @param {Object} analysis - Result from analyzeBillForHotTopics() with topics array
 */
export async function saveHotTopicAnalysis(env, billId, analysis) {
  const { topics = [], other_flags = [], legislative_session = "unknown" } = analysis || {};
  
  // NEW: Import and use staging system for review workflow
  // This saves topics to staging table instead of directly to production
  // allowing admin review before they appear to users
  try {
    const { saveTopicToStaging } = await import("./hotTopicsValidator.mjs");
    
    for (const topic of topics) {
      try {
        const result = await saveTopicToStaging(
          env,
          billId,
          {
            slug: topic.slug,
            title: topic.label || topic.slug,
            confidence: topic.confidence || 0,
            trigger_snippet: topic.trigger_snippet || null,
            reason_summary: topic.reason_summary || "",
          },
          "openai",
          legislative_session
        );
        
        if (!result.success) {
          console.warn(
            `⚠️ Failed to save topic to staging for ${billId}/${topic.slug}:`,
            result.error
          );
        }
      } catch (err) {
        console.warn(
          `⚠️ Error saving topic to staging ${billId}/${topic.slug}:`,
          err.message
        );
      }
    }
  } catch (importErr) {
    // Fallback: If staging system is not available, use legacy civic_item_ai_tags table
    console.warn(
      `⚠️ Staging system unavailable, falling back to legacy insert:`,
      importErr.message
    );
    
    const slugs = topics.map((t) => t.slug).filter(Boolean);

    // Phase 1: Save AI tags to WY_DB.civic_item_ai_tags (idempotent)
    try {
      if (slugs.length === 0) {
        await env.WY_DB.prepare(
          "DELETE FROM civic_item_ai_tags WHERE item_id = ?"
        ).bind(billId).run();
      } else {
        const placeholders = slugs.map(() => "?").join(",");
        await env.WY_DB.prepare(
          `DELETE FROM civic_item_ai_tags 
            WHERE item_id = ? AND topic_slug NOT IN (${placeholders})`
        )
          .bind(billId, ...slugs)
          .run();
      }
    } catch (err) {
      console.warn(`⚠️ Failed to clear stale tags for ${billId}:`, err);
    }

    if (topics.length > 0) {
      const stmt = env.WY_DB.prepare(
        `INSERT OR REPLACE INTO civic_item_ai_tags (item_id, topic_slug, confidence, trigger_snippet, reason_summary)
           VALUES (?1, ?2, ?3, ?4, ?5)`
      );
      for (const topic of topics) {
        const conf = typeof topic.confidence === "number" ? topic.confidence : 0;
        const snippet = topic.trigger_snippet || null;
        const reason = topic.reason_summary || "";
        try {
          await stmt.bind(billId, topic.slug, conf, snippet, reason).run();
        } catch (err) {
          console.warn(`⚠️ Failed to upsert tag for ${billId}/${topic.slug}:`, err);
        }
      }
    }
  }

  return;
}
