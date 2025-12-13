/**
 * worker/src/lib/billSummaryAnalyzer.mjs
 * 
 * Bill-level AI summary analyzer for Wyoming civic items.
 * Generates and caches plain-language summaries and key points for pending bills.
 * 
 * **Input (civic_items row):**
 * - id: Bill ID
 * - bill_number: e.g., "HB 22"
 * - title: Official bill title
 * - summary: Official bill summary
 * - subject_tags: Comma-separated subject tags
 * - status: "introduced", "in_committee", "pending_vote"
 * - legislative_session: e.g., "2025"
 * - chamber: "lower" or "upper"
 * 
 * **Output Shape:**
 * {
 *   "plain_summary": "2-3 sentence plain language explanation suitable for any citizen",
 *   "key_points": [
 *     "First major change or impact",
 *     "Second major change or impact",
 *     "Optional third change or impact"
 *   ]
 * }
 * 
 * **Storage (civic_items columns):**
 * - ai_summary: Stores plain_summary (TEXT)
 * - ai_key_points: Stores JSON stringified key_points array (TEXT)
 * - ai_summary_version: Hash/version for refresh detection (TEXT, optional)
 * - ai_summary_generated_at: DATETIME of last generation
 * 
 * **OpenAI Integration:**
 * - Model: gpt-4o
 * - Temperature: 0.2–0.3 (conservative, factual)
 * - Max tokens: 350–450 per bill
 * - Cost: ~$0.0003 per bill (est. 150 prompt + 80 completion tokens)
 * 
 * **Caching Strategy:**
 * - Generate once per bill_number + legislative_session combo
 * - Reuse for all card displays and API responses
 * - Refresh when ai_summary_updated_at is NULL (not yet generated)
 * - Future: Refresh when bill_text hash changes (ai_summary_version)
 */

const MODEL = "gpt-4o";
const TEMPERATURE = 0.25;
const MAX_TOKENS = 400;

const SYSTEM_PROMPT = `
You are the Civic Translator for this-is-us.org, a neutral civic educator.
- Explain bills in clear, 8th-grade language.
- Stay strictly neutral and factual.
- Use ONLY the official data provided (LSO short title, official summary/abstract, and supplied text snippet if present).
- Do NOT invent or guess missing details. If the text is too thin to explain the bill, set note to "need_more_text" and leave summary empty.
- If the text appears to be about a different subject than the provided metadata, set note to "mismatch_topic" and leave summary empty.
- Return ONLY valid JSON, no markdown or extra commentary.
`;

const USER_PROMPT_TEMPLATE = (bill) => `
Input data:
- Jurisdiction: Wyoming
- Legislative Session Year: ${bill.legislative_session || "(unknown)"}
- Chamber: ${bill.chamber || "(unknown)"}
- Bill Number: ${bill.bill_number || "(missing)"}
- LSO Short Title: ${bill.short_title || "(missing)"}
- Bill Title: ${bill.title || "(missing)"}
- Official Summary/Abstract: ${bill.summary || "(none provided)"}
- Status: ${bill.status || "(unknown)"}
- Primary Topic: ${bill.subject_tags || "(none)"}
- Bill Text: ${bill.text_excerpt || "(not provided; rely on official summary/short title)"}

Required output as JSON only:
{
  "plain_summary": "2-3 sentences in everyday language, or empty string if insufficient text",
  "key_points": [
    "Top change or impact, action-verb led, if text supports it",
    "Second change or impact"
  ],
  "note": "ok | need_more_text | mismatch_topic"
}

Pre-checks:
- If the summary is missing/too short to know what the bill does, set note to "need_more_text" and leave summary/key_points empty.
- If the subject_tags/topic conflicts with the provided summary text, set note to "mismatch_topic" and leave summary/key_points empty.

When consistent:
- Provide 1–2 sentences that describe what the bill does in daily-life terms.
- 2–3 bullets for key changes; start bullets with action verbs ("Creates", "Requires", "Raises", "Repeals").
- Call out penalties or enforcement if present in the text.
`;

// Alternative prompt for bills with very minimal data (title-only, like LSO bills)
const SYSTEM_PROMPT_TITLE_ONLY = `
You are the Civic Translator for this-is-us.org, a neutral civic educator.
- Explain bills in clear, 8th-grade language based ONLY on the bill title.
- Stay strictly neutral and factual.
- Infer the likely intent and impact from the title alone.
- If the title is too vague or ambiguous, return an empty summary and set note to "ambiguous_title".
- Return ONLY valid JSON, no markdown or extra commentary.
`;

const USER_PROMPT_TITLE_ONLY = (bill) => `
Input data:
- Jurisdiction: Wyoming
- Legislative Session Year: ${bill.legislative_session || "(unknown)"}
- Chamber: ${bill.chamber || "(unknown)"}
- Bill Number: ${bill.bill_number || "(missing)"}
- LSO Short Title: ${bill.short_title || "(missing)"}
- Bill Title: ${bill.title || "(missing)"}

Required output as JSON only:
{
  "plain_summary": "1-2 sentences explaining what this bill likely does based on the title",
  "key_points": [
    "Likely primary impact or change"
  ],
  "note": "ok | ambiguous_title"
}

Instructions:
- Use the title to infer what the bill probably addresses.
- Provide a single 1-2 sentence explanation of the likely purpose.
- If the title clearly indicates the subject (e.g., "Stalking of minors" = bill about making stalking of minors illegal or tougher), explain that simply.
- If title is vague or cryptic, set note to "ambiguous_title" and leave summary empty.
`;

function getShortTitle(bill = {}) {
  return (bill.short_title || bill.summary || "").trim();
}

/**
 * analyzeBillSummary(env, bill)
 * 
 * Call OpenAI to generate a plain-language summary and key points.
 * Returns { plain_summary, key_points } or empty object on error.
 * 
 * For bills with detailed summaries, uses full context.
 * For bills with title-only data (like LSO), delegates to analyzeBillSummaryFromTitle.
 * 
 * @param {Object} env - Cloudflare Worker environment with OPENAI_API_KEY
 * @param {Object} bill - Row from civic_items with id, bill_number, title, summary, etc.
 * @returns {Promise<{plain_summary: string, key_points: string[]}>}
 */
export async function analyzeBillSummary(env, bill) {
  if (!env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY not configured");
    return { plain_summary: "", key_points: [] };
  }

  const shortTitle = getShortTitle(bill);
  // Detect if this is title-only (thin) data
  // E.g., summary == title, or summary is < 10 words
  const summaryText = (bill.summary || "").trim();
  const isThinData =
    !summaryText || summaryText.length < 30 || summaryText === bill.title;
  
  if (isThinData) {
    console.log(`📝 Using title-only analyzer for ${bill.bill_number} (thin data)`);
    return analyzeBillSummaryFromTitle(env, { ...bill, short_title: shortTitle });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: USER_PROMPT_TEMPLATE({
              ...bill,
              short_title: shortTitle,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ OpenAI API error (${response.status}):`, error);
      return { plain_summary: "", key_points: [] };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseErr) {
      console.warn(`⚠️ Failed to parse OpenAI response as JSON:`, content);
      return { plain_summary: "", key_points: [] };
    }

    // Validate output shape
    const plain_summary =
      typeof parsed.plain_summary === "string" ? parsed.plain_summary.slice(0, 500) : "";
    const key_points = Array.isArray(parsed.key_points)
      ? parsed.key_points
          .slice(0, 3)
          .map((p) => (typeof p === "string" ? p.slice(0, 200) : ""))
          .filter(Boolean)
      : [];
    const note = typeof parsed.note === "string" ? parsed.note : "";

    if (!plain_summary && (!key_points.length || note === "need_more_text" || note === "mismatch_topic")) {
      console.warn(
        `⚠️ Model returned no summary for ${bill.bill_number} (note=${note || "none"})`
      );
      return { plain_summary: "", key_points: [] };
    }

    console.log(`✅ Generated summary for ${bill.bill_number}: ${plain_summary.length} chars, ${key_points.length} points`);

    return { plain_summary, key_points };
  } catch (err) {
    console.error(`❌ Error calling OpenAI for ${bill.bill_number}:`, err.message);
    return { plain_summary: "", key_points: [] };
  }
}

/**
 * analyzeBillSummaryFromTitle(env, bill)
 * 
 * Generate summary from title alone (for bills with minimal metadata, like LSO).
 * Uses a simplified prompt designed for title-only inference.
 * 
 * @param {Object} env - Cloudflare Worker environment with OPENAI_API_KEY
 * @param {Object} bill - Row from civic_items
 * @returns {Promise<{plain_summary: string, key_points: string[]}>}
 */
async function analyzeBillSummaryFromTitle(env, bill) {
  if (!env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY not configured");
    return { plain_summary: "", key_points: [] };
  }

  const shortTitle = getShortTitle(bill);
  const billForPrompt = {
    ...bill,
    short_title: shortTitle,
    title: bill.title || shortTitle || bill.bill_number,
  };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: TEMPERATURE,
        max_tokens: 200, // Lighter token budget for title-only
        messages: [
          { role: "system", content: SYSTEM_PROMPT_TITLE_ONLY },
          { role: "user", content: USER_PROMPT_TITLE_ONLY(billForPrompt) },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ OpenAI API error for title-only (${response.status}):`, error);
      return { plain_summary: "", key_points: [] };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseErr) {
      console.warn(`⚠️ Failed to parse title-only response as JSON:`, content);
      return { plain_summary: "", key_points: [] };
    }

    // Validate output shape
    const plain_summary =
      typeof parsed.plain_summary === "string" ? parsed.plain_summary.slice(0, 500) : "";
    const key_points = Array.isArray(parsed.key_points)
      ? parsed.key_points
          .slice(0, 2)
          .map((p) => (typeof p === "string" ? p.slice(0, 200) : ""))
          .filter(Boolean)
      : [];
    const note = typeof parsed.note === "string" ? parsed.note : "";

    if (!plain_summary) {
      console.warn(
        `⚠️ Title-only analyzer returned no summary for ${bill.bill_number} (note=${note || "none"})`
      );
      return { plain_summary: "", key_points: [] };
    }

    console.log(`✅ Generated title-only summary for ${bill.bill_number}: ${plain_summary.length} chars, ${key_points.length} points`);

    return { plain_summary, key_points };
  } catch (err) {
    console.error(`❌ Error calling OpenAI for title-only (${bill.bill_number}):`, err.message);
    return { plain_summary: "", key_points: [] };
  }
}

/**
 * saveBillSummary(env, billId, analysis)
 * 
 * Persist bill-level summary to WY_DB.civic_items.
 * Idempotent: overwrites existing summaries.
 * 
 * @param {Object} env - Cloudflare environment with WY_DB binding
 * @param {string} billId - civic_items.id
 * @param {Object} analysis - { plain_summary, key_points }
 */
export async function saveBillSummary(env, billId, analysis) {
  const { plain_summary = "", key_points = [] } = analysis || {};

  try {
    const keyPointsJson = JSON.stringify(key_points);
    
    await env.WY_DB.prepare(
      `UPDATE civic_items
       SET ai_summary = ?, ai_key_points = ?, ai_summary_generated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(plain_summary, keyPointsJson, billId).run();

    console.log(`✅ Saved summary for ${billId}`);
  } catch (err) {
    console.error(`⚠️ Failed to save summary for ${billId}:`, err.message);
  }
}

/**
 * ensureBillSummary(env, bill)
 * 
 * Return cached summary if available and recent; otherwise generate and save.
 * "Recent" is defined as: ai_summary_generated_at is not NULL.
 * 
 * Future policies:
 * - Refresh when legislative_session changes
 * - Refresh when bill_text hash (ai_summary_version) differs
 * - Periodic refresh (e.g., 30 days) if bill status changes
 * 
 * @param {Object} env - Cloudflare environment
 * @param {Object} bill - Row from civic_items
 * @returns {Promise<{plain_summary: string, key_points: string[]}>}
 */
export async function ensureBillSummary(env, bill) {
  // Check if summary already exists and is considered "fresh"
  if (bill.ai_summary && bill.ai_summary_generated_at) {
    console.log(`📦 Using cached summary for ${bill.bill_number}`);
    
    // Parse key_points from JSON
    let key_points = [];
    try {
      key_points = JSON.parse(bill.ai_key_points || "[]");
    } catch {
      key_points = [];
    }
    
    return { plain_summary: bill.ai_summary, key_points };
  }

  // Generate new summary
  console.log(`🤖 Generating new summary for ${bill.bill_number}...`);
  const analysis = await analyzeBillSummary(env, bill);
  
  // Save to database
  await saveBillSummary(env, bill.id, analysis);
  
  return analysis;
}

export function buildAiSummaryNotice(generatedAt) {
  if (!generatedAt) return "";
  const dateStr = String(generatedAt).split("T")[0];
  return `Generated by AI using draft bill language from the Wyoming Legislature as of ${dateStr}. Bills can be amended before final passage.`;
}
