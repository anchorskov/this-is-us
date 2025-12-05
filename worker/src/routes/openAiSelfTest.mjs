/**
 * worker/src/routes/openAiSelfTest.mjs
 *
 * Dev-only endpoint for testing OpenAI API key validity.
 * GET /api/internal/openai-self-test
 */

import { runOpenAiSelfTest } from "../lib/openAiSelfTest.mjs";

/**
 * handleOpenAiSelfTest(request, env)
 *
 * Test endpoint to verify the OpenAI API key is valid.
 * Restricted to localhost/127.0.0.1 (dev only).
 *
 * @param {Request} request - HTTP request
 * @param {Object} env - Worker environment
 * @returns {Response} JSON response with { ok, model, usage, error }
 */
export async function handleOpenAiSelfTest(request, env) {
  // 🔐 Restrict to localhost/127.0.0.1 for dev use only
  const host = new URL(request.url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    return new Response(JSON.stringify({ error: "Forbidden. Dev access only." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    console.log("🧪 Running OpenAI API self-test...");
    const result = await runOpenAiSelfTest(env);

    const status = result.ok ? 200 : 503;
    console.log(`${result.ok ? "✅" : "❌"} OpenAI self-test: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      console.error(`   Error: ${result.error}`);
    }

    return new Response(JSON.stringify(result), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ OpenAI self-test exception:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: `Unexpected error: ${err.message}`,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
