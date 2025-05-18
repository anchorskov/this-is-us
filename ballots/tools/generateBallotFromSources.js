// ballots/tools/generateBallotFromSources.js

export default async function generateBallotFromSources({ sources = [] }, env) {
  if (!sources.length) return { error: "No sources provided" };

  try {
    const summaries = [];

    for (const source of sources) {
      const { url, label, type, notes } = source;

      const response = await fetch(url);
      const html = await response.text();

      const prompt = `
You are a civic assistant helping users understand their local ballot.

Using the HTML content provided, extract relevant information about:
- Candidates (name, office, location, party if available)
- Ballot measures (title, summary, pro/con arguments)
- Election context (cycle, date, type)

Respond in JSON format. Include only verified, clearly extractable facts.

SOURCE INFO:
Label: ${label}
Type: ${type}
Notes: ${notes}
URL: ${url}

PAGE CONTENT:
${html.slice(0, 4000)}  // limit to first ~4K characters
`;

      const aiResponse = await env.AI.run("@cf/meta/llama-2-7b-chat-int8", {
        prompt,
        temperature: 0.2,
        max_tokens: 800
      });

      summaries.push({
        label,
        type,
        url,
        summary: aiResponse.text
      });
    }

    return { success: true, summaries };

  } catch (err) {
    return { error: "AI parsing failed", message: err.message };
  }
}
