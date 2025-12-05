/**
 * worker/src/lib/hotTopicsAnalyzer.mjs
 * 
 * Hot button topic analyzer for Wyoming bills using OpenAI gpt-4o.
 * 
 * **OpenAI Integration:**
 * - Uses same pattern as worker/src/routes/sandbox.js: env.OPENAI_API_KEY bearer token
 * - Model: gpt-4o
 * - Temperature: 0.2 (conservative, factual matching)
 * - Max tokens: 500 per bill (cost-efficient)
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
 *       "trigger_snippet": "Short quoted or paraphrased passage from the bill"
 *     }
 *   ],
 *   "other_flags": [
 *     {
 *       "label": "Other potential concern",
 *       "confidence": 0.7,
 *       "trigger_snippet": "Short text that triggered this label"
 *     }
 *   ]
 * }
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

/**
 * Canonical hot button topics for Wyoming with descriptive labels.
 * These are the ONLY valid slugs allowed in the topics array.
 */
const CANONICAL_TOPICS = {
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
};

const SYSTEM_PROMPT = `
You are a nonpartisan analyst matching Wyoming bills to six specific hot button topics likely to spark strong public interest.

**Only match these six topics:**

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

**Confidence Guidelines:**
- 0.85+ only for very clear, direct matches
- 0.70–0.84 for strong relevance with minor ambiguity
- <0.70 place in other_flags instead

**Output Format:**
Return STRICT JSON only, no extra prose:
{
  "topics": [
    {
      "slug": "property-tax-relief",
      "label": "Property Tax Relief",
      "confidence": 0.92,
      "trigger_snippet": "Brief quoted or paraphrased passage from the bill"
    }
  ],
  "other_flags": [
    {
      "label": "Other issue (use any label)",
      "confidence": 0.65,
      "trigger_snippet": "Short text that triggered this flag"
    }
  ]
}

Do NOT invent new topic slugs. Use ONLY the six listed above in the topics array.
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
    text_url,
  } = bill || {};

  return [
    `Bill number: ${bill_number || "unknown"}`,
    `Title: ${title || "unknown"}`,
    summary ? `Summary: ${summary}` : "Summary: (none provided)",
    subject_tags ? `Subject tags: ${subject_tags}` : "Subject tags: (none)",
    last_action ? `Last action: ${last_action}` : null,
    last_action_date ? `Last action date: ${last_action_date}` : null,
    text_url ? `Full text URL: ${text_url}` : null,
    "\nInstructions:",
    "- Match to the six canonical topics when applicable.",
    "- Place lower-confidence matches (<0.70) or off-topic ideas in other_flags.",
    "- Never invent new topic slugs; only use the six provided.",
    "- Provide short trigger snippets (quoted or paraphrased from the bill).",
  ]
    .filter(Boolean)
    .join("\n");
}

async function callOpenAI(env, body) {
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
  return res.json();
}

/**
 * analyzeBillForHotTopics(env, bill)
 * 
 * Calls OpenAI gpt-4o to match a Wyoming bill against the six canonical hot topics.
 * 
 * @param {Env} env - Worker environment with OPENAI_API_KEY
 * @param {Object} bill - civic_items row
 * @returns {Promise<{topics: Array, other_flags: Array, meta?: any}>}
 *          Returns { topics: [], other_flags: [] } on error.
 */
export async function analyzeBillForHotTopics(env, bill) {
  if (!env?.OPENAI_API_KEY) {
    console.warn("⚠️ Missing OPENAI_API_KEY; cannot analyze bills");
    return { topics: [], other_flags: [] };
  }

  const userPrompt = buildUserPrompt(bill);
  const body = {
    model: MODEL,
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  };

  let data;
  try {
    data = await callOpenAI(env, body);
  } catch (err) {
    console.error(`❌ analyzeBillForHotTopics failed for bill ${bill?.id}:`, err);
    return { topics: [], other_flags: [] };
  }

  const raw = data?.choices?.[0]?.message?.content || "{}";
  let parsed = { topics: [], other_flags: [] };

  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn(`⚠️ Failed to parse AI JSON for bill ${bill?.id}:`, raw);
    return { topics: [], other_flags: [] };
  }

  // Validate and filter to canonical topics only
  const topics = (Array.isArray(parsed.topics) ? parsed.topics : [])
    .filter(t => t?.slug && CANONICAL_TOPICS[t.slug]);

  const other_flags = Array.isArray(parsed.other_flags) ? parsed.other_flags : [];

  return { topics, other_flags, meta: { model: MODEL, raw } };
}

/**
 * saveHotTopicAnalysis(env, billId, analysis)
 * 
 * Persists the analysis results to D1:
 * 1. Insert topic matches into WY_DB.civic_item_ai_tags
 * 2. Link matched topics to EVENTS_DB.hot_topic_civic_items (cross-database two-phase pattern)
 * 
 * @param {Env} env - Worker environment with WY_DB and EVENTS_DB
 * @param {string} billId - civic_items.id (OCD bill ID)
 * @param {Object} analysis - Result from analyzeBillForHotTopics()
 * @returns {Promise<void>}
 */
export async function saveHotTopicAnalysis(env, billId, analysis) {
  const { topics = [], other_flags = [] } = analysis || {};

  // Phase 1: Save AI tags to WY_DB.civic_item_ai_tags
  if (topics.length > 0) {
    const stmt = env.WY_DB.prepare(
      `INSERT INTO civic_item_ai_tags (item_id, topic_slug, confidence, trigger_snippet)
         VALUES (?1, ?2, ?3, ?4)`
    );
    for (const topic of topics) {
      const conf = typeof topic.confidence === "number" ? topic.confidence : 0;
      const snippet = topic.trigger_snippet || null;
      try {
        await stmt.bind(billId, topic.slug, conf, snippet).run();
      } catch (err) {
        console.warn(`⚠️ Failed to insert tag for ${billId}/${topic.slug}:`, err);
      }
    }
  }

  // Phase 2: Link to EVENTS_DB.hot_topic_civic_items
  // Fetch active hot_topics from EVENTS_DB
  let topicMap = new Map();
  try {
    const { results = [] } = await env.EVENTS_DB.prepare(
      "SELECT id, slug FROM hot_topics WHERE is_active = 1"
    ).all();
    topicMap = new Map(results.map(r => [r.slug, r.id]));
  } catch (err) {
    console.warn("⚠️ Failed to fetch hot_topics from EVENTS_DB:", err);
    return; // If we can't fetch topics, exit early
  }

  // Upsert into hot_topic_civic_items using INSERT OR IGNORE
  const linkStmt = env.EVENTS_DB.prepare(
    `INSERT OR IGNORE INTO hot_topic_civic_items (topic_id, civic_item_id)
       VALUES (?1, ?2)`
  );

  for (const topic of topics) {
    const topicId = topicMap.get(topic.slug);
    if (topicId) {
      try {
        await linkStmt.bind(topicId, billId).run();
      } catch (err) {
        console.warn(
          `⚠️ Failed to link bill ${billId} to topic ${topic.slug}:`,
          err
        );
      }
    }
  }
}
