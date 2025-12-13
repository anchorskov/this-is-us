// worker/src/lib/civicVerification.mjs
// Lightweight verification helper that uses gpt-4o-mini to sanity check
// topic assignment and plain-language summaries against the bill title/abstract.

const VERIFY_SYSTEM_PROMPT = `
You are a nonpartisan QA checker for Wyoming civic bill metadata.
Return ONLY valid JSON with no commentary.
Fields to return:
{
  "openai_topics": ["topic-slug", ...],   // top 1–3 topic slugs you believe apply
  "stored_topic": "topic-slug-or-null",
  "topic_match": true|false,              // does stored_topic fit the bill title/abstract?
  "summary_safe": true|false,             // does provided summary stay consistent with title/abstract?
  "issues": ["short issue statements"],
  "confidence": 0.0-1.0
}
If unsure, set confidence lower and include issues.
`;

function buildVerifyPrompt({ bill, aiSummary, storedTopic, hotTopics }) {
  const topicList = hotTopics
    .map((t) => `- ${t.slug}: ${t.title || t.label || t.slug}`)
    .join("\n");

  const lines = [
    `Bill number: ${bill.bill_number || "(missing)"}`,
    `Title: ${bill.title || "(missing)"}`,
    bill.summary ? `Abstract: ${bill.summary}` : "Abstract: (missing)",
    aiSummary ? `Existing plain summary: ${aiSummary}` : "Existing plain summary: (missing)",
    `Stored topic: ${storedTopic || "(none)"}`,
    "Allowed hot topics:",
    topicList || "(none provided)",
    "Check if stored topic fits title/abstract. Check if summary makes claims not supported by title/abstract.",
    "Return ONLY JSON.",
  ];

  return lines.join("\n");
}

// Structural guardrails: OpenStates WY bills need summary + mapped sponsor before going green.
function buildStructuralChecks({ bill, aiSummary, hasWyomingSponsor }) {
  const isWyoming =
    bill?.source === "open_states" && (bill?.jurisdiction_key || bill?.jurisdiction) === "WY";
  const hasSummary = Boolean(aiSummary && String(aiSummary).trim().length > 0);
  const wyomingSponsor = Boolean(hasWyomingSponsor);

  // OpenStates-specific gate: must be Wyoming, have summary, and have mapped sponsor.
  if (bill?.source === "open_states") {
    if (!isWyoming) {
      return {
        is_wyoming: false,
        has_summary: hasSummary,
        has_wyoming_sponsor: wyomingSponsor,
        structural_ok: false,
        structural_reason: "wrong_jurisdiction",
      };
    }
    if (!hasSummary) {
      return {
        is_wyoming: true,
        has_summary: false,
        has_wyoming_sponsor: wyomingSponsor,
        structural_ok: false,
        structural_reason: "missing_summary",
      };
    }
    if (!wyomingSponsor) {
      return {
        is_wyoming: true,
        has_summary: true,
        has_wyoming_sponsor: false,
        structural_ok: false,
        structural_reason: "no_wyoming_sponsor",
      };
    }
  } else if (!hasSummary) {
    return {
      is_wyoming: isWyoming,
      has_summary: false,
      has_wyoming_sponsor: wyomingSponsor,
      structural_ok: false,
      structural_reason: "missing_summary",
    };
  }

  return {
    is_wyoming: isWyoming,
    has_summary: hasSummary,
    has_wyoming_sponsor: wyomingSponsor,
    structural_ok: true,
    structural_reason: null,
  };
}

export async function verifyBillWithMiniModel(
  env,
  { bill, aiSummary, storedTopic, hotTopics, hasWyomingSponsor }
) {
  if (!env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const userPrompt = buildVerifyPrompt({ bill, aiSummary, storedTopic, hotTopics: hotTopics || [] });

  const body = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: VERIFY_SYSTEM_PROMPT.trim() },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
    max_tokens: 320,
  };

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
    throw new Error(`OpenAI verification failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || "{}";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    parsed = {
      openai_topics: [],
      stored_topic: storedTopic || null,
      topic_match: false,
      summary_safe: false,
      issues: ["Model did not return valid JSON"],
      confidence: 0,
    };
  }

  const parsedResult = {
    openai_topics: parsed.openai_topics || [],
    stored_topic: parsed.stored_topic || storedTopic || null,
    topic_match: Boolean(parsed.topic_match),
    summary_safe: Boolean(parsed.summary_safe),
    issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    confidence:
      typeof parsed.confidence === "number"
        ? Math.max(0, Math.min(1, parsed.confidence))
        : null,
    model: body.model,
    raw,
  };

  const structural = buildStructuralChecks({
    bill,
    aiSummary,
    hasWyomingSponsor,
  });

  const statusReason =
    structural.structural_reason ||
    (!parsedResult.topic_match || !parsedResult.summary_safe ? "model_mismatch" : null);

  const status =
    structural.structural_ok && parsedResult.topic_match && parsedResult.summary_safe
      ? "ok"
      : "flagged";

  const issues = Array.isArray(parsedResult.issues) ? [...parsedResult.issues] : [];
  if (statusReason && !issues.includes(statusReason)) {
    issues.unshift(statusReason);
  }

  return {
    openai_topics: parsedResult.openai_topics,
    stored_topic: parsedResult.stored_topic,
    topic_match: parsedResult.topic_match,
    summary_safe: parsedResult.summary_safe,
    issues,
    confidence: parsedResult.confidence,
    model: parsedResult.model,
    raw: parsedResult.raw,
    status,
    status_reason: statusReason,
    structural_ok: structural.structural_ok,
    structural_reason: structural.structural_reason,
    is_wyoming: structural.is_wyoming,
    has_summary: structural.has_summary,
    has_wyoming_sponsor: structural.has_wyoming_sponsor,
  };
}
