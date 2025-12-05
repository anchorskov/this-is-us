// worker/src/lib/civicSummaries.mjs
// Reusable AI summarization helper for civic_items using the existing
// “six second sandbox” OpenAI pattern (see worker/src/routes/sandbox.js).

const SYSTEM_PROMPT = `You are a nonpartisan civic explainer for Wyoming voters.
- Write 2–3 short paragraphs of plain text.
- Be neutral and factual; avoid partisan framing, attacks, or advocacy.
- Describe what the item does, who it affects, and where it is in the process.
- If information is missing (no summary/abstract), say that briefly and focus on what is known (title, category, links).`;

/**
 * summarizeCivicItem(env, item)
 * @param {Env} env - Worker env with OPENAI_API_KEY
 * @param {Object} item - civic_items row with minimal fields
 * @returns {Promise<{ summaryText: string, meta?: any }>}
 */
export async function summarizeCivicItem(env, item) {
  if (!env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const {
    id,
    title,
    summary,
    external_url,
    text_url,
    category,
    subject_tags,
  } = item || {};

  const userPrompt = [
    `Title: ${title || "Unknown"}`,
    summary ? `Existing abstract: ${summary}` : `No abstract provided.`,
    category ? `Category: ${category}` : null,
    subject_tags ? `Subject tags: ${subject_tags}` : null,
    external_url ? `Primary URL: ${external_url}` : null,
    text_url ? `Text URL: ${text_url}` : null,
    `Jurisdiction: Wyoming`,
    `Instruction: return 2–3 neutral paragraphs for a busy voter.`,
  ]
    .filter(Boolean)
    .join("\n");

  const body = {
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.4,
    max_tokens: 400,
  };

  // NOTE: This mirrors the sandbox OpenAI call. If the “six second” client
  // is refactored later, swap this fetch to that helper.
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
  const summaryText =
    data?.choices?.[0]?.message?.content?.trim() ||
    "Summary unavailable. Please try again later.";

  return {
    summaryText,
    meta: {
      model: body.model,
      usage: data?.usage || null,
      itemId: id,
    },
  };
}

// TODO: If we need to fetch bill text later, add a pre-processing hook here
// to retrieve and trim external text before sending to OpenAI. Keep D1 free
// of full bill text—pass only links and metadata.***
