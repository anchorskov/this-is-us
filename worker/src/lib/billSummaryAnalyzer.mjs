/**
 * worker/src/lib/billSummaryAnalyzer.mjs
 * 
 * Bill-level AI summary analyzer for Wyoming civic items.
 * Generates and caches plain-language summaries and key points for pending bills.
 * 
 * **Text Source Fallback Ladder:**
 * 1. LSO BillInformation HTML (SummaryHTML, DigestHTML, CurrentBillHTML)
 * 2. Fetched bill text from text_url (if not PDF)
 * 3. PDF extraction from resolved wyoleg.gov PDF
 * 4. OpenStates abstract (non-authoritative, flagged as such)
 * 5. None - mark as "no_text_available"
 * 
 * Each source is gated by minimum text thickness (MIN_TEXT_CHARS).
 * Metadata persists: summary_source, summary_error, summary_is_authoritative.
 */

import { fetchLsoBillHtml, extractTextFromLsoHtml } from "./fetchLsoBillHtml.mjs";
import { resolveDocument } from "./docResolver/index.mjs";
import { getDb, hasTable, hasColumn } from "./dbHelpers.mjs";

const MODEL = "gpt-4o";
const TEMPERATURE = 0.25;
const MAX_TOKENS = 400;
const MIN_TEXT_CHARS = 50;        // Minimum "thickness" for HTML text
const MIN_PDF_TEXT_CHARS = 200;   // PDF requires more text to be useful
const MIN_OPENSTATES_CHARS = 100; // OpenStates abstract minimum

const STOPWORDS = new Set([
  "a","an","and","are","as","at","be","by","for","from","has","have","if","in","is","it","of","on","or","that","the","to","was","were","will","with","this","these","those","their","its","into","over","under","than","then","about","but","not","no","yes","may","can","shall","must",
]);

const GENERIC_WORDS = new Set([
  "bill","act","law","laws","statute","statutes","code","section","chapter","article","legislature","legislative","session","committee","amend","amends","amended","amendment","repeal","repeals","state","states","wyoming","public","government","county","counties","city","cities","department","agency","program","programs","general","various","regarding","relating","includes","including","provide","provides","provision","provisions",
]);

function toTitleCase(word) {
  if (!word) return "";
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

function normalizeTopicLabel(label) {
  const cleaned = (label || "")
    .replace(/[^A-Za-z0-9&\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((w) => toTitleCase(w))
    .join(" ");
}

export function isValidTopicLabel(label) {
  if (!label || typeof label !== "string") return false;
  const trimmed = label.trim();
  if (trimmed.length < 3 || trimmed.length > 40) return false;
  return /[A-Za-z0-9]/.test(trimmed);
}

export function normalizeHotTopicLabel(label) {
  if (!label || typeof label !== "string") return "";
  return label.trim().replace(/\s+/g, " ");
}

export function isValidHotTopicLabel(label) {
  if (!label || typeof label !== "string") return false;
  const trimmed = label.trim();
  if (trimmed.length < 3 || trimmed.length > 40) return false;
  return /[A-Za-z0-9]/.test(trimmed);
}

export function sanitizeTopicKey(keyLike) {
  const cleaned = (keyLike || "")
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .replace(/--+/g, "-");
  return cleaned;
}

export function slugifyHotTopicLabel(label) {
  const normalized = normalizeHotTopicLabel(label);
  return sanitizeTopicKey(normalized);
}

export function generateHotTopicCandidates(text) {
  const raw = (text || "").toLowerCase();
  const tokens = raw
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/g)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));

  if (tokens.length < 2) {
    return ["General Policy"];
  }

  const wordCounts = new Map();
  for (const w of tokens) {
    wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
  }

  const bigramScores = new Map();
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const w1 = tokens[i];
    const w2 = tokens[i + 1];
    const baseScore = (wordCounts.get(w1) || 0) + (wordCounts.get(w2) || 0);
    // Penalize generic legislative words instead of removing the pair entirely
    const penalty =
      (GENERIC_WORDS.has(w1) ? 0.5 : 1) * (GENERIC_WORDS.has(w2) ? 0.5 : 1);
    const adjustedScore = baseScore * penalty;
    if (adjustedScore <= 0.1) continue;
    const key = `${w1} ${w2}`;
    bigramScores.set(key, (bigramScores.get(key) || 0) + adjustedScore);
  }

  let candidates = Array.from(bigramScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([pair]) => {
      const [a, b] = pair.split(" ");
      return `${toTitleCase(a)} ${toTitleCase(b)}`;
    })
    .filter((label, idx, arr) => arr.indexOf(label) === idx)
    .filter((label) => isValidHotTopicLabel(label));

  if (candidates.length === 0) {
    const ranked = Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word)
      .filter((word) => !GENERIC_WORDS.has(word));
    if (ranked.length >= 2) {
      const fallback = `${toTitleCase(ranked[0])} ${toTitleCase(ranked[1])}`;
      if (isValidHotTopicLabel(fallback)) {
        candidates = [fallback];
      }
    }
  }

  if (candidates.length === 0) {
    return ["General Policy"];
  }

  if (candidates.length < 3) {
    const ranked = Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word)
      .filter((word) => !GENERIC_WORDS.has(word));
    for (const word of ranked) {
      if (candidates.length >= 3) break;
      const label = normalizeTopicLabel(word);
      if (label && !candidates.includes(label)) {
        candidates.push(label);
      }
    }
  }

  while (candidates.length < 3) {
    const fallback = `General Policy ${candidates.length + 1}`;
    candidates.push(fallback);
  }

  return candidates.slice(0, 7);
}

export function pickHotTopicLabel(openAiLabel, candidates) {
  const normalized = normalizeHotTopicLabel(openAiLabel);
  if (isValidHotTopicLabel(normalized)) return normalized;
  for (const candidate of candidates || []) {
    if (isValidHotTopicLabel(candidate)) return candidate;
  }
  return "General Policy";
}

function normalizeTopicObject(raw, summaryText = "") {
  const topic_key = sanitizeTopicKey(
    raw?.topic_key || raw?.key || raw?.slug || raw?.label_short || raw?.label || raw?.short_label
  );
  const label_short = normalizeTopicLabel(
    raw?.label_short || raw?.short_label || raw?.label || raw?.title || ""
  ).slice(0, 40).trim();
  const label_full =
    (raw?.label_full || raw?.full_label || raw?.label_full || "").trim() ||
    label_short;
  const one_sentence = (raw?.one_sentence || raw?.summary || summaryText || "")
    .toString()
    .trim()
    .slice(0, 240);
  const parent_key = raw?.parent_key ? sanitizeTopicKey(raw.parent_key) : null;
  const confidence =
    typeof raw?.confidence === "number"
      ? Math.min(Math.max(raw.confidence, 0), 1)
      : 0.5;

  if (!topic_key || !label_short || !isValidTopicLabel(label_short)) return null;
  return {
    topic_key,
    label_short,
    label_full: label_full || label_short,
    one_sentence,
    parent_key: parent_key || null,
    confidence,
  };
}

/**
 * extractTextFromPdf(pdfUrl, env)
 * 
 * Fetch a PDF and extract text using Workers AI (if available).
 * Does NOT store the PDF in R2; uses in-memory base64 conversion.
 * 
 * @param {string} pdfUrl - URL to PDF
 * @param {Object} env - Worker environment with optional env.AI binding
 * @returns {Promise<{text: string, chars: number}|null>}
 */
async function extractTextFromPdf(pdfUrl, env) {
  if (!pdfUrl) return null;
  
  try {
    // Validate PDF with HEAD request
    const headRes = await fetch(pdfUrl, { method: "HEAD" });
    if (!headRes.ok || !headRes.headers.get("content-type")?.includes("application/pdf")) {
      console.log(`⏭️  PDF HEAD failed or not PDF: ${pdfUrl}`);
      return null;
    }
    
    // Check if Workers AI is configured
    if (!env?.AI) {
      console.log(`⏭️  Workers AI not configured (env.AI missing). Will fall back to other sources.`);
      return null;
    }
    
    // Fetch PDF bytes
    console.log(`   → Fetching PDF for text extraction...`);
    const fetchRes = await fetch(pdfUrl);
    if (!fetchRes.ok) {
      console.log(`⏭️  PDF fetch failed: ${fetchRes.status}`);
      return null;
    }
    
    const arrayBuffer = await fetchRes.arrayBuffer();
    
    // Convert to base64 in-memory (no R2 writes)
    const uint8Array = new Uint8Array(arrayBuffer);
    const binaryString = String.fromCharCode(...uint8Array);
    const base64 = btoa(binaryString);
    
    // Use Workers AI to extract text from PDF
    const prompt = `Extract all plain text from this PDF. Return only the extracted text, no commentary.`;
    
    const aiResponse = await env.AI.run("@cf/meta/llama-2-7b-chat-int8", {
      prompt,
      temperature: 0.2,
      max_tokens: 2000,
      image: null,
      files: [{ name: "bill.pdf", data: base64 }]
    });
    
    const extractedText = aiResponse.text || aiResponse.response || "";
    const textLength = extractedText.length;
    
    if (textLength === 0) {
      console.log(`⏭️  PDF extraction returned empty text`);
      return null;
    }
    
    console.log(`   ✅ Extracted ${textLength} chars from PDF`);
    return { text: extractedText, chars: textLength };
    
  } catch (err) {
    console.warn(`⚠️ PDF extraction error: ${err.message}`);
    return null;

  }
}

/**
 * fetchOpenStatesAbstract(billNumber, session)
 * 
 * Fallback to OpenStates bill abstract.
 * Only used if LSO HTML and PDF are unavailable.
 * Results marked as non-authoritative.
 * 
 * @param {string} billNumber - e.g., "HB0011"
 * @param {string} session - e.g., "2026"
 * @returns {Promise<{text: string, source: string}|null>}
 */
async function fetchOpenStatesAbstract(billNumber, session) {
  if (!billNumber || !session) return null;
  
  try {
    // OpenStates Wyoming bills API
    // Format: https://openstates.org/api/v3/bills/?state=wy&session=2026&bill_id=HB1
    const normalized = billNumber.replace(/^0+(?!$)/, "");  // Remove leading zeros
    const url = `https://openstates.org/api/v3/bills/?state=wy&session=${session}&bill_id=${normalized}`;
    
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`⏭️  OpenStates request failed: ${res.status}`);
      return null;
    }
    
    const data = await res.json();
    if (!data.results || !data.results.length) {
      console.log(`⏭️  OpenStates returned no bills for ${billNumber}`);
      return null;
    }
    
    const bill = data.results[0];
    const abstract = bill.abstract || "";
    
    if (!abstract || abstract.length < MIN_OPENSTATES_CHARS) {
      console.log(`⏭️  OpenStates abstract too thin (${abstract?.length || 0} chars)`);
      return null;
    }
    
    console.log(`✅ Got OpenStates abstract: ${abstract.length} chars`);
    return { text: abstract, source: "openstates" };
  } catch (err) {
    console.warn(`⚠️ OpenStates fetch failed: ${err.message}`);
    return null;
  }
}


/**
 * fetchBillText(textUrl)
 * 
 * Fetch the full bill text from the text_url (wyoleg.gov).
 * Handles both HTML and plain text responses, extracts meaningful content.
 * Returns up to 3000 characters of cleaned text.
 * Skips PDFs - use LSO HTML instead.
 * 
 * @param {string} textUrl - URL to bill text (e.g., wyoleg.gov/legis/2025/billhtml/hb0008.html)
 * @returns {Promise<string|null>} - Bill text or null if fetch fails
 */
async function fetchBillText(textUrl) {
  if (!textUrl) return null;
  
  try {
    const response = await fetch(textUrl, { 
      method: 'GET'
    });
    
    if (!response.ok) {
      console.warn(`⚠️ Failed to fetch bill text (${response.status}): ${textUrl}`);
      return null;
    }
    
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes("application/pdf")) {
      console.log(`⏭️  Skipping PDF content at ${textUrl}`);
      return null;
    }
    
    // Skip PDFs - use LSO HTML service instead
    if (contentType.includes('application/pdf')) {
      console.log(`⚠️ Bill text is PDF, skipping PDF parsing. Will use LSO HTML instead.`);
      return null;
    }
    
    let text = '';
    
    if (contentType.includes('text/html')) {
      // For HTML, extract text content and remove scripts/styles
      const html = await response.text();
      
      // Skip if this looks like an Angular SPA shell (no meaningful content)
      if (html.includes('data-status="loading"') || html.includes('<app-root>')) {
        console.log(`⏭️  Skipping SPA shell for ${textUrl}`);
        return null;
      }
      
      // Simple HTML stripping: remove script/style tags and their content
      text = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, '\n')  // Replace tags with newlines
        .replace(/\n+/g, '\n')      // Collapse multiple newlines
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .trim();
    } else {
      // For plain text, use as-is
      text = await response.text();
    }
    
    // Skip if resulting text is too short (likely no actual content)
    if (!text || text.length < 50) {
      console.log(`⏭️  Skipping thin text (${text?.length || 0} chars) from ${textUrl}`);
      return null;
    }
    
    // Limit to 3000 characters to stay within token budget
    // Average: ~4 chars per token, so 3000 chars ≈ 750 tokens
    if (text.length > 3000) {
      text = text.substring(0, 3000) + '\n... [text truncated]';
    }
    
    console.log(`✅ Fetched bill text: ${text.length} chars from ${textUrl}`);
    return text || null;
  } catch (err) {
    console.warn(`⚠️ Error fetching bill text: ${err.message}`);
    return null;
  }
}

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
${bill.text_excerpt ? `- Full Bill Text (from text_url): ${bill.text_excerpt}` : `- Bill Text: (not provided; rely on official summary/short title)`}

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
 * Generate plain-language summary using fallback text source ladder:
 * 1. LSO HTML (SummaryHTML, DigestHTML, CurrentBillHTML)
 * 2. Fetch from text_url (non-PDF)
 * 3. PDF extraction
 * 4. OpenStates abstract (non-authoritative)
 * 5. Title-only analysis if text available
 * 6. None - return no_text_available
 * 
 * Returns { plain_summary, key_points, note, source, is_authoritative }
 * Never returns empty plain_summary unless no text available.
 * 
 * @param {Object} env - Cloudflare Worker environment with OPENAI_API_KEY
 * @param {Object} bill - Row from civic_items
 * @returns {Promise<{plain_summary: string, key_points: string[], note: string, source: string, is_authoritative: boolean}>}
 */
export async function analyzeBillSummary(env, bill) {
  if (!env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY not configured");
    return {
      plain_summary: "",
      key_points: [],
      note: "api_error",
      source: "none",
      is_authoritative: false,
    };
  }

  const shortTitle = getShortTitle(bill);
  let billText = null;
  let textSource = "none";
  let isAuthoritative = false;

  // ============ SOURCE 1: LSO HTML ============
  if (bill.legislative_session && bill.bill_number) {
    console.log(`🌐 [1/5] Trying LSO HTML for ${bill.bill_number}...`);
    try {
      const lsoHtml = await fetchLsoBillHtml(bill.legislative_session, bill.bill_number);
      billText = extractTextFromLsoHtml(
        lsoHtml.currentBillHTML,
        lsoHtml.digestHTML,
        lsoHtml.summaryHTML
      );
      if (billText && billText.length >= MIN_TEXT_CHARS) {
        console.log(`   ✅ Got ${billText.length} chars from LSO HTML`);
        textSource = "lso_html";
        isAuthoritative = true;
        return await callOpenAiForSummary(
          env,
          { ...bill, short_title: shortTitle, text_excerpt: billText },
          "lso_html"
        );
      } else {
        console.log(`   ⏭️  LSO HTML too thin (${billText?.length || 0} chars)`);
      }
    } catch (err) {
      console.warn(`⚠️ LSO HTML fetch failed: ${err.message}`);
    }
  }

  // ============ SOURCE 2: text_url (non-PDF) ============
  if (bill.text_url && !billText) {
    console.log(`📄 [2/5] Trying text_url (non-PDF)...`);
    billText = await fetchBillText(bill.text_url);
    if (billText && billText.length >= MIN_TEXT_CHARS) {
      console.log(`   ✅ Got ${billText.length} chars from text_url`);
      textSource = "text_url";
      isAuthoritative = true;
      return await callOpenAiForSummary(
        env,
        { ...bill, short_title: shortTitle, text_excerpt: billText },
        "text_url"
      );
    } else {
      console.log(`   ⏭️  text_url too thin or is PDF (${billText?.length || 0} chars)`);
    }
  }

  // ============ SOURCE 3: PDF Extraction ============
  if (!billText && bill.legislative_session && bill.bill_number) {
    console.log(`📋 [3/5] Resolving PDF for ${bill.bill_number}...`);
    try {
      const resolved = await resolveDocument(env, {
        sourceKey: "wyoleg",
        year: bill.legislative_session,
        billNumber: bill.bill_number,
      });
      if (resolved.best && resolved.best.kind === "pdf") {
        console.log(`   → Found PDF at ${resolved.best.url}`);
        const pdfText = await extractTextFromPdf(resolved.best.url, env);
        if (
          pdfText &&
          pdfText.text &&
          pdfText.text.length >= MIN_PDF_TEXT_CHARS
        ) {
          console.log(`   ✅ Got ${pdfText.text.length} chars from PDF`);
          billText = pdfText.text;
          textSource = "pdf";
          isAuthoritative = true;
          return await callOpenAiForSummary(
            env,
            { ...bill, short_title: shortTitle, text_excerpt: billText },
            "pdf"
          );
        } else {
          console.log(`   ⏭️  PDF text too thin (${pdfText?.text?.length || 0} chars)`);
        }
      } else {
        console.log(`   ⏭️  No PDF found`);
      }
    } catch (err) {
      console.warn(`⚠️ PDF resolution failed: ${err.message}`);
    }
  }

  // ============ SOURCE 4: OpenStates Abstract (non-authoritative) ============
  if (!billText && bill.legislative_session && bill.bill_number) {
    console.log(`🌐 [4/5] Trying OpenStates...`);
    const osResult = await fetchOpenStatesAbstract(
      bill.bill_number,
      bill.legislative_session
    );
    if (osResult && osResult.text.length >= MIN_OPENSTATES_CHARS) {
      console.log(`   ✅ Got ${osResult.text.length} chars from OpenStates`);
      billText = osResult.text;
      textSource = "openstates";
      isAuthoritative = false;
      return await callOpenAiForSummary(
        env,
        { ...bill, short_title: shortTitle, text_excerpt: billText },
        "openstates"
      );
    } else {
      console.log(`   ⏭️  OpenStates abstract too thin or missing`);
    }
  }

  // ============ SOURCE 5: Title-only if any text at all ============
  if (!billText && (bill.title || bill.summary)) {
    console.log(`📝 [5/5] Using title-only analysis...`);
    return analyzeBillSummaryFromTitle(env, { ...bill, short_title: shortTitle });
  }

  // ============ NO TEXT AVAILABLE ============
  console.log(`❌ [NO SOURCES] No usable text found for ${bill.bill_number}`);
  return {
    plain_summary: "",
    key_points: [],
    note: "no_text_available",
    source: "none",
    is_authoritative: false,
  };
}

async function callOpenAiForTopics(env, summaryText, keyPoints, candidates) {
  if (env?.TEST_TOPICS_RESPONSE) {
    return env.TEST_TOPICS_RESPONSE;
  }

  if (!env?.OPENAI_API_KEY) {
    return null;
  }

  const prompt = `
You are a policy librarian. Read the bill summary and key points, then propose 3-7 topic objects.

Rules:
- label_short: short topic label (max 40 chars), clear and human-readable.
- slug: optional lowercase kebab-case slug (letters/numbers/hyphen), unique per topic.
- label_full: Longer label if useful (may match label_short).
- one_sentence: 1-2 sentence plain description (<=240 chars).
- parent_key: optional slug if it belongs under a broader topic.
- confidence: 0.0-1.0
- Do NOT invent empty/null fields.
- If unsure, provide fewer but valid topics.

Candidates from heuristic: ${candidates.join(", ")}
Bill summary: ${summaryText}
Key points: ${Array.isArray(keyPoints) && keyPoints.length > 0 ? keyPoints.join(" | ") : "None"}

Return ONLY JSON:
{
  "topics": [
    {"slug":"property-tax-relief","label_short":"Property Tax Relief","label_full":"Property Tax Relief","one_sentence":"...","confidence":0.86},
    {"slug":"water-rights","label_short":"Water Rights & Drought Planning","label_full":"Water Rights & Drought Planning","one_sentence":"...", "parent_key":"natural-resources","confidence":0.72}
  ]
}
`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.25,
        max_tokens: 300,
        messages: [
          { role: "system", content: "You generate STRICT JSON only. No prose." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    return content;
  } catch {
    return null;
  }
}

async function callOpenAiForTopicDescription(env, topicLabel, summaries) {
  if (!env?.OPENAI_API_KEY) return null;
  const prompt = `
You write concise civic topic descriptions for a public preferences page.

Topic label: ${topicLabel}
Bill summaries:
${summaries.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Write 1-2 sentences (<=240 chars) describing the topic in plain language.
Return ONLY JSON:
{ "description": "..." }
`.trim();

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 120,
        messages: [
          { role: "system", content: "Return strict JSON only." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(content);
    const description = String(parsed?.description || "").trim().slice(0, 240);
    return description || null;
  } catch {
    return null;
  }
}

async function buildTopicDescription(env, db, topicId, session, label) {
  try {
    const { results = [] } = await db
      .prepare(
        `SELECT ci.ai_summary, ci.summary
           FROM hot_topic_civic_items htc
           JOIN civic_items ci ON ci.id = htc.civic_item_id
          WHERE htc.topic_id = ?${session ? " AND htc.legislative_session = ?" : ""}
          ORDER BY htc.confidence DESC, ci.last_action_date DESC
          LIMIT 5`
      )
      .bind(topicId, ...(session ? [session] : []))
      .all();
    const summaries = results
      .map((r) => r.ai_summary || r.summary || "")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);
    if (!summaries.length) return null;
    return await callOpenAiForTopicDescription(env, label, summaries);
  } catch {
    return null;
  }
}

function parseTopicResponse(raw) {
  if (!raw) return null;
  let payload = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    const jsonStr = trimmed.startsWith("```")
      ? trimmed.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "")
      : trimmed;
    try {
      payload = JSON.parse(jsonStr);
    } catch {
      return null;
    }
  }
  if (!payload || typeof payload !== "object") return null;
  const arr = Array.isArray(payload.topics) ? payload.topics : [];
  return arr;
}

export async function ensureHotTopicForBill(env, dbOverride, civicItem) {
  const db = dbOverride || getDb(env, "WY_DB");
  if (!db) {
    return { status: "skipped", reason: "db_missing" };
  }

  // Check for draft tables first (new workflow), fall back to production tables
  const hasDraftTopics = await hasTable(db, "hot_topics_draft");
  const hasDraftLinks = await hasTable(db, "hot_topic_civic_items_draft");
  const hasProductionTopics = await hasTable(db, "hot_topics");
  const hasProductionLinks = await hasTable(db, "hot_topic_civic_items");
  
  // Use draft tables if available; otherwise use production tables
  const useDraft = hasDraftTopics && hasDraftLinks;
  const topicsTable = useDraft ? "hot_topics_draft" : "hot_topics";
  const linksTable = useDraft ? "hot_topic_civic_items_draft" : "hot_topic_civic_items";
  
  if (!useDraft && (!hasProductionTopics || !hasProductionLinks)) {
    return { status: "skipped", reason: "hot_topics_schema_missing" };
  }

  const hasConfidence = await hasColumn(db, linksTable, "confidence");
  const hasTopicSession = await hasColumn(db, topicsTable, "legislative_session");
  const hasLinkSession = await hasColumn(db, linksTable, "legislative_session");
  const hasDescription = await hasColumn(db, topicsTable, "description");
  const hasStatus = useDraft && await hasColumn(db, topicsTable, "status");
  const hasAiSource = useDraft && await hasColumn(db, topicsTable, "ai_source");
  const hasSourceRunId = useDraft && await hasColumn(db, topicsTable, "source_run_id");
  
  if (!hasConfidence) {
    return { status: "skipped", reason: "missing_confidence_column" };
  }

  const summaryText = civicItem?.ai_summary || "";
  const summaryError = civicItem?.summary_error || "ok";
  if (summaryError !== "ok" || summaryText.length <= 60) {
    return { status: "skipped", reason: "summary_not_ready" };
  }

  let keyPoints = civicItem?.ai_key_points || [];
  if (typeof keyPoints === "string") {
    try {
      keyPoints = JSON.parse(keyPoints);
    } catch {
      keyPoints = [];
    }
  }

  const sessionValue = civicItem?.legislative_session
    ? String(civicItem.legislative_session)
    : "unknown";

  try {
    const existing = await db
      .prepare(
        `SELECT COUNT(*) as count FROM ${linksTable} WHERE civic_item_id = ?` +
          (hasLinkSession && sessionValue ? " AND legislative_session = ?" : "")
      )
      .bind(civicItem.id, ...(hasLinkSession && sessionValue ? [sessionValue] : []))
      .first();
    if ((existing?.count || 0) > 0) {
      return { status: "existing", topic_count: existing.count };
    }
  } catch (err) {
    console.warn(`⚠️ ${linksTable} lookup failed for ${civicItem.id}:`, err.message);
  }

  const candidates = generateHotTopicCandidates(
    `${summaryText} ${Array.isArray(keyPoints) ? keyPoints.join(" ") : ""}`.trim()
  );
  const raw = await callOpenAiForTopics(env, summaryText, keyPoints, candidates);
  const parsed = parseTopicResponse(raw);
  const fromAi = (parsed || [])
    .map((p) => normalizeTopicObject(p, summaryText))
    .filter(Boolean)
    .slice(0, 7);

  const fallbackTopics = candidates
    .slice(0, 3)
    .map((label) => {
      const topic_key = sanitizeTopicKey(label);
      const label_short = normalizeTopicLabel(label);
      if (!topic_key || !isValidTopicLabel(label_short)) return null;
      return {
        topic_key,
        label_short,
        label_full: label_short,
        one_sentence: summaryText.slice(0, 200),
        parent_key: null,
        confidence: 0.4,
      };
    })
    .filter(Boolean);

  const topicsByKey = new Map();
  for (const topic of fromAi) {
    topicsByKey.set(topic.topic_key, topic);
  }
  for (const topic of fallbackTopics) {
    if (!topicsByKey.has(topic.topic_key) && topicsByKey.size < 7) {
      topicsByKey.set(topic.topic_key, topic);
    }
  }

  const topics = Array.from(topicsByKey.values()).slice(0, 7);
  if (topics.length === 0) {
    return { status: "skipped", reason: "no_topics" };
  }

  const inserted = [];
  const descriptionUpdated = new Set();
  for (const topic of topics) {
    const slug = sanitizeTopicKey(topic.topic_key || topic.label_short);
    if (!slug) continue;

    let topicId = null;
    try {
      const existingTopic = await db
        .prepare(
          `SELECT id FROM ${topicsTable} WHERE slug = ?` +
            (hasTopicSession && sessionValue ? " AND legislative_session = ?" : "") +
            " LIMIT 1"
        )
        .bind(slug, ...(hasTopicSession && sessionValue ? [sessionValue] : []))
        .first();
      topicId = existingTopic?.id || null;
    } catch (err) {
      console.warn(`⚠️ ${topicsTable} fetch failed for ${slug}:`, err.message);
    }

    if (!topicId) {
      try {
        const columns = ["slug", "title", "summary", "priority"];
        const values = [
          slug,
          topic.label_short,
          topic.one_sentence || null,
          100,
        ];
        
        // Add status field for draft table
        if (useDraft && hasStatus) {
          columns.push("status");
          values.push("draft");
        }
        
        // Add is_active for production table or draft table
        if (!useDraft) {
          columns.push("is_active");
          values.push(1);
        }
        
        // Add ai_source for draft table
        if (useDraft && hasAiSource) {
          columns.push("ai_source");
          values.push(raw ? "openai" : "heuristic");
        }
        
        // Add source_run_id for draft table
        if (useDraft && hasSourceRunId) {
          columns.push("source_run_id");
          values.push(null);
        }
        
        if (hasTopicSession) {
          columns.push("legislative_session");
          values.push(sessionValue);
        }
        if (hasDescription) {
          columns.push("description");
          values.push(null);
        }
        
        const placeholders = columns.map(() => "?").join(", ");
        const insertSql = `
          INSERT INTO ${topicsTable} (${columns.join(", ")}, created_at, updated_at)
          VALUES (${placeholders}, datetime('now'), datetime('now'))
          ON CONFLICT(${hasTopicSession ? "legislative_session, slug" : "slug"}) DO UPDATE SET
            title=excluded.title,
            summary=excluded.summary,
            updated_at=datetime('now')
        `;
        await db.prepare(insertSql).bind(...values).run();
        const insertedTopic = await db
          .prepare(
            `SELECT id FROM ${topicsTable} WHERE slug = ?` +
              (hasTopicSession && sessionValue ? " AND legislative_session = ?" : "") +
              " LIMIT 1"
          )
          .bind(slug, ...(hasTopicSession && sessionValue ? [sessionValue] : []))
          .first();
        topicId = insertedTopic?.id || null;
      } catch (err) {
        console.warn(`⚠️ ${topicsTable} insert failed for ${slug}:`, err.message);
      }
    }

    if (!topicId) continue;

    try {
      const linkColumns = [
        "topic_id",
        "civic_item_id",
        "confidence",
      ];
      
      // Add source and generated_at for draft links
      if (useDraft) {
        if (await hasColumn(db, linksTable, "ai_source")) {
          linkColumns.push("ai_source");
        }
        if (await hasColumn(db, linksTable, "trigger_snippet")) {
          linkColumns.push("trigger_snippet");
        }
        if (await hasColumn(db, linksTable, "reason_summary")) {
          linkColumns.push("reason_summary");
        }
      } else {
        linkColumns.push("source", "generated_at");
      }
      
      if (hasLinkSession) {
        linkColumns.push("legislative_session");
      }
      
      const linkSql = `
        INSERT OR REPLACE INTO ${linksTable} (${linkColumns.join(", ")})
        VALUES (${linkColumns.map(() => "?").join(", ")})
      `;
      
      const linkValues = [
        topicId,
        civicItem.id,
        topic.confidence ?? 0.5,
      ];
      
      if (useDraft) {
        if (linkColumns.includes("ai_source")) {
          linkValues.push(raw ? "openai" : "heuristic");
        }
        if (linkColumns.includes("trigger_snippet")) {
          linkValues.push(null); // No snippet available from bill summary
        }
        if (linkColumns.includes("reason_summary")) {
          linkValues.push(null); // Will be filled in during admin review
        }
      } else {
        linkValues.push(raw ? "openai" : "heuristic", new Date().toISOString());
      }
      
      if (hasLinkSession) {
        linkValues.push(sessionValue);
      }
      await db.prepare(linkSql).bind(...linkValues).run();
      inserted.push(topic);
    } catch (err) {
      console.warn(
        `⚠️ ${linksTable} link failed for ${civicItem.id}/${slug}:`,
        err.message
      );
    }

    if (hasDescription && topicId && !descriptionUpdated.has(topicId)) {
      try {
        const current = await db
          .prepare(`SELECT description, title FROM ${topicsTable} WHERE id = ?`)
          .bind(topicId)
          .first();
        const existingDesc = String(current?.description || "").trim();
        if (!existingDesc) {
          const label = current?.title || topic.label_short;
          const description = await buildTopicDescription(
            env,
            db,
            topicId,
            hasLinkSession ? sessionValue : null,
            label
          );
          if (description) {
            await db
              .prepare(`UPDATE ${topicsTable} SET description = ? WHERE id = ?`)
              .bind(description, topicId)
              .run();
            descriptionUpdated.add(topicId);
          }
        }
      } catch (err) {
        console.warn(`⚠️ ${topicsTable} description update failed for ${slug}:`, err.message);
      }
    }
  }

  if (inserted.length === 0) {
    return { status: "skipped", reason: "no_topics_persisted" };
  }

  return {
    status: "created",
    topics: inserted,
    source: raw ? "openai" : "heuristic",
    topic_count: inserted.length,
    first_topic: inserted[0]?.label_short || null,
    target_table: topicsTable,
  };
}

/**
 * callOpenAiForSummary(env, bill, source)
 * 
 * Call OpenAI to generate summary with populated text_excerpt.
 * Returns { plain_summary, key_points, note, source, is_authoritative }
 * 
 * @param {Object} env
 * @param {Object} bill
 * @param {string} source - "lso_html" | "text_url" | "pdf" | "openstates"
 * @returns {Promise<{plain_summary: string, key_points: string[], note: string, source: string, is_authoritative: boolean}>}
 */
async function callOpenAiForSummary(env, bill, source) {
  const shortTitle = getShortTitle(bill);
  
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
              text_excerpt: bill.text_excerpt,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ OpenAI API error (${response.status}):`, error);
      return {
        plain_summary: "",
        key_points: [],
        note: "api_error",
        source,
        is_authoritative: source !== "openstates",
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON response
    let parsed;
    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr
          .replace(/^```(?:json)?\s*\n?/, "")
          .replace(/\n?```\s*$/, "");
      }
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.warn(`⚠️ Failed to parse OpenAI response:`, content);
      return {
        plain_summary: "",
        key_points: [],
        note: "parse_error",
        source,
        is_authoritative: source !== "openstates",
      };
    }

    // Validate output shape
    const plain_summary =
      typeof parsed.plain_summary === "string"
        ? parsed.plain_summary.slice(0, 500)
        : "";
    const key_points = Array.isArray(parsed.key_points)
      ? parsed.key_points
          .slice(0, 3)
          .map((p) => (typeof p === "string" ? p.slice(0, 200) : ""))
          .filter(Boolean)
      : [];
    const note = typeof parsed.note === "string" ? parsed.note : "";

    // CRITICAL: Never return empty summary unless flagged
    if (
      !plain_summary &&
      (!key_points.length ||
        note === "need_more_text" ||
        note === "mismatch_topic")
    ) {
      console.warn(
        `⚠️ OpenAI returned no summary for ${bill.bill_number} (note=${note || "none"}), source=${source}`
      );
      return {
        plain_summary: "",
        key_points: [],
        note: note || "empty_summary",
        source,
        is_authoritative: source !== "openstates",
      };
    }

    console.log(
      `✅ Generated summary for ${bill.bill_number} from ${source}: ${plain_summary.length} chars`
    );

    return {
      plain_summary,
      key_points,
      note: note || "ok",
      source,
      is_authoritative: source !== "openstates",
    };
  } catch (err) {
    console.error(
      `❌ Error calling OpenAI for ${bill.bill_number}:`,
      err.message
    );
    return {
      plain_summary: "",
      key_points: [],
      note: "exception",
      source,
      is_authoritative: source !== "openstates",
    };
  }
}


/**
 * analyzeBillSummaryFromTitle(env, bill)
 * 
 * Generate summary from title alone (for bills with minimal metadata, like LSO).
 * Uses a simplified prompt designed for title-only inference.
 * Returns { plain_summary, key_points, note, source, is_authoritative }
 * 
 * @param {Object} env - Cloudflare Worker environment with OPENAI_API_KEY
 * @param {Object} bill - Row from civic_items
 * @returns {Promise<{plain_summary: string, key_points: string[], note: string, source: string, is_authoritative: boolean}>}
 */
async function analyzeBillSummaryFromTitle(env, bill) {
  if (!env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY not configured");
    return {
      plain_summary: "",
      key_points: [],
      note: "api_error",
      source: "title_only",
      is_authoritative: false,
    };
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
      console.error(
        `❌ OpenAI API error for title-only (${response.status}):`,
        error
      );
      return {
        plain_summary: "",
        key_points: [],
        note: "api_error",
        source: "title_only",
        is_authoritative: false,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON response
    let parsed;
    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr
          .replace(/^```(?:json)?\s*\n?/, "")
          .replace(/\n?```\s*$/, "");
      }
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.warn(`⚠️ Failed to parse title-only response as JSON:`, content);
      return {
        plain_summary: "",
        key_points: [],
        note: "parse_error",
        source: "title_only",
        is_authoritative: false,
      };
    }

    // Validate output shape
    const plain_summary =
      typeof parsed.plain_summary === "string"
        ? parsed.plain_summary.slice(0, 500)
        : "";
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
      return {
        plain_summary: "",
        key_points: [],
        note: note || "empty_summary",
        source: "title_only",
        is_authoritative: false,
      };
    }

    console.log(
      `✅ Generated title-only summary for ${bill.bill_number}: ${plain_summary.length} chars, ${key_points.length} points`
    );

    return {
      plain_summary,
      key_points,
      note: note || "ok",
      source: "title_only",
      is_authoritative: false,
    };
  } catch (err) {
    console.error(
      `❌ Error calling OpenAI for title-only (${bill.bill_number}):`,
      err.message
    );
    return {
      plain_summary: "",
      key_points: [],
      note: "exception",
      source: "title_only",
      is_authoritative: false,
    };
  }
}

/**
 * saveBillSummary(env, billId, analysis)
 * 
 * Persist bill-level summary to WY_DB.civic_items with metadata.
 * Idempotent: overwrites existing summaries.
 * 
 * @param {Object} env - Cloudflare environment with WY_DB binding
 * @param {string} billId - civic_items.id
 * @param {Object} analysis - { plain_summary, key_points, note, source, is_authoritative }
 */
export async function saveBillSummary(env, billId, analysis) {
  const {
    plain_summary = "",
    key_points = [],
    note = "ok",
    source = "none",
    is_authoritative = true,
  } = analysis || {};

  // Do NOT save empty summaries
  if (!plain_summary || plain_summary.length === 0) {
    console.log(`⏭️  Skipping empty summary for ${billId} (source=${source}, error=${note})`);
    try {
      const summaryError = note === "ok" ? "ok" : note;
      const isAuthInt = is_authoritative ? 1 : 0;
      await env.WY_DB.prepare(
        `UPDATE civic_items
         SET summary_source = ?,
             summary_error = ?,
             summary_is_authoritative = ?
         WHERE id = ?`
      )
        .bind(source, summaryError, isAuthInt, billId)
        .run();
    } catch (err) {
      console.error(`⚠️ Failed to save summary metadata for ${billId}:`, err.message);
    }
    return;
  }

  try {
    const keyPointsJson = JSON.stringify(key_points);
    const summaryError = note === "ok" ? "ok" : note;
    const isAuthInt = is_authoritative ? 1 : 0;
    
    await env.WY_DB.prepare(
      `UPDATE civic_items
       SET ai_summary = ?, 
           ai_key_points = ?, 
           ai_summary_generated_at = CURRENT_TIMESTAMP,
           summary_source = ?,
           summary_error = ?,
           summary_is_authoritative = ?
       WHERE id = ?`
    )
    .bind(
      plain_summary,
      keyPointsJson,
      source,
      summaryError,
      isAuthInt,
      billId
    )
    .run();

    console.log(
      `✅ Saved summary for ${billId}: ${plain_summary.length} chars, source=${source}, authoritative=${isAuthInt}`
    );
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
 * Returns the full analysis object with metadata: { plain_summary, key_points, note, source, is_authoritative }
 * 
 * Future policies:
 * - Refresh when legislative_session changes
 * - Refresh when bill_text hash (ai_summary_version) differs
 * - Periodic refresh (e.g., 30 days) if bill status changes
 * 
 * @param {Object} env - Cloudflare environment
 * @param {Object} bill - Row from civic_items
 * @returns {Promise<{plain_summary: string, key_points: string[], note: string, source: string, is_authoritative: boolean}>}
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
    
    // Extract metadata from cached record
    const source = bill.summary_source || "none";
    const is_authoritative = bill.summary_is_authoritative !== 0; // 0 = false, default 1 = true
    const note = bill.summary_error || "ok";
    
    return {
      plain_summary: bill.ai_summary,
      key_points,
      note,
      source,
      is_authoritative,
    };
  }

  // Test hook: allow injecting summary results via env for deterministic runs
  const mockSummaries = env?.TEST_SUMMARY_RESPONSES;
  if (mockSummaries && mockSummaries[bill.bill_number]) {
    const injected = mockSummaries[bill.bill_number];
    const plain_summary = injected.plain_summary || "";
    const key_points = injected.key_points || [];
    const note = injected.note || "ok";
    const source = injected.source || "test";
    const is_authoritative = injected.is_authoritative !== false;
    
    const analysis = { plain_summary, key_points, note, source, is_authoritative };
    if (plain_summary) {
      await saveBillSummary(env, bill.id, analysis);
    }
    return analysis;
  }

  // Generate new summary
  console.log(`🤖 Generating new summary for ${bill.bill_number}...`);
  const analysis = await analyzeBillSummary(env, bill);
  
  // Save to database (even if empty, so we track the error reason)
  await saveBillSummary(env, bill.id, analysis);
  
  return analysis;
}

export function buildAiSummaryNotice(generatedAt) {
  if (!generatedAt) return "";
  const dateStr = String(generatedAt).split("T")[0];
  return `Generated by AI using draft bill language from the Wyoming Legislature as of ${dateStr}. Bills can be amended before final passage.`;
}
