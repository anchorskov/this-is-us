// worker/src/routes/devLsoHydrate.mjs
// Dev-only hydration route to enrich LSO bills with BillInformation + text URLs.

import { hydrateLsoBillsBatch } from "../lib/wyLsoClient.mjs";
import { withCORS } from "../utils/cors.js";

export async function handleDevLsoHydrate(request, env) {
  try {
    const url = new URL(request.url);
    const host = url.hostname;
    const isLocal = host === "127.0.0.1" || host === "localhost";
    if (!isLocal) {
      return withCORS(
        JSON.stringify({ error: "Not available outside dev" }),
        403,
        { "Content-Type": "application/json" }
      );
    }

    const year = url.searchParams.get("year") || new Date().getFullYear();
    const limit = parseInt(url.searchParams.get("limit") || "25", 10);
    const specialSessionValue = parseInt(url.searchParams.get("special") || "0", 10);

    const result = await hydrateLsoBillsBatch(env, year, limit, specialSessionValue);
    return withCORS(JSON.stringify({ ok: true, year, ...result }), 200, {
      "Content-Type": "application/json",
    });
  } catch (err) {
    console.error("❌ handleDevLsoHydrate error:", err);
    return withCORS(
      JSON.stringify({ error: "Internal server error", message: err.message }),
      500,
      { "Content-Type": "application/json" }
    );
  }
}

export default handleDevLsoHydrate;
