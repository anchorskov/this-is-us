/**
 * worker/src/lib/openAiSelfTest.mjs
 *
 * OpenAI API key health check.
 * Makes a minimal test call to verify the API key is valid.
 */

/**
 * runOpenAiSelfTest(env)
 *
 * Test the OpenAI API key with a minimal gpt-4o call.
 * Returns { ok: true, model, usage } on success.
 * Returns { ok: false, error: "..." } on failure.
 *
 * @param {Object} env - Worker environment with OPENAI_API_KEY
 * @returns {Promise<Object>} Result object with ok, model, usage, or error fields
 */
export async function runOpenAiSelfTest(env) {
  // Check if API key exists
  if (!env?.OPENAI_API_KEY) {
    return {
      ok: false,
      error: "Missing OPENAI_API_KEY",
    };
  }

  const model = "gpt-4o";

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You are a health check for an API key. Respond with the single word OK.",
          },
          {
            role: "user",
            content: "Say OK.",
          },
        ],
        temperature: 0,
        max_tokens: 5,
      }),
    });

    // Check if response is OK
    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson?.error?.message) {
          errorMsg = `${response.status}: ${errorJson.error.message}`;
        }
      } catch (e) {
        // If not JSON, use the text
        if (errorText) {
          errorMsg = `${response.status}: ${errorText.substring(0, 100)}`;
        }
      }
      return {
        ok: false,
        error: errorMsg,
      };
    }

    const data = await response.json();

    // Verify the response has the expected structure
    const content = data?.choices?.[0]?.message?.content || "";

    // Check if "OK" appears in the response (case insensitive)
    if (!content.toUpperCase().includes("OK")) {
      return {
        ok: false,
        error: `Unexpected response: "${content}"`,
      };
    }

    // Success!
    return {
      ok: true,
      model,
      usage: data?.usage || null,
    };
  } catch (err) {
    return {
      ok: false,
      error: `Fetch error: ${err.message}`,
    };
  }
}
