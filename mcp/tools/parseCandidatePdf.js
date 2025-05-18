// mcp/tools/parseCandidatePdf.js

export default async function parseCandidatePdf({ pdf_url }, env) {
  if (!pdf_url) return { error: "Missing pdf_url" };

  try {
    // 🧩 Extract key from the URL
    const key = pdf_url.split("/").pop();
    if (!key) return { error: "Invalid pdf_url format – missing key" };

    // 📂 Load PDF from R2
    const obj = await env.CANDIDATE_PDFS.get(key);
    if (!obj) return { error: "PDF not found in R2" };

    const arrayBuffer = await obj.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const prompt = `
You are a form parsing agent.

Extract the following fields from this PDF:
- Full name
- Office they are running for
- Location (city and state)

Respond with JSON only. Do not explain. No extra commentary. Example format:

{
  "name": "Jane Doe",
  "office": "City Council",
  "location": "Cheyenne, WY"
}
`;

    // 🧠 Run LLM model
    const aiResponse = await env.AI.run("@cf/meta/llama-2-7b-chat-int8", {
      prompt,
      temperature: 0.2,
      max_tokens: 300,
      image: null,
      files: [{ name: "file.pdf", data: base64 }]
    });

    // 🧪 Use .text or .response fallback
    const text = aiResponse.text || aiResponse.response || "";
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}") + 1;

    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("JSON structure not found in AI output");
    }

    const jsonText = text.slice(jsonStart, jsonEnd);
    return JSON.parse(jsonText);

  } catch (e) {
    return {
      error: "Failed to extract JSON",
      message: e.message,
      stack: e.stack,
      raw: typeof e.response !== "undefined" ? e.response : null
    };
  }
}
