// ballots/src/index.mjs

import fetchBallotForZip from "../tools/fetchBallotForZip.js";
import generateBallotFromSources from "../tools/generateBallotFromSources.js";

// Utility to add CORS headers to responses
function withCors(resp) {
  const headers = new Headers(resp.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // ✅ Preflight CORS support
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    // ✅ GET /api/ballot?zip=XXXXX — returns source(s) from D1
    if (pathname === "/api/ballot" && request.method === "GET") {
      const zip = url.searchParams.get("zip");
      if (!zip) {
        return withCors(new Response(JSON.stringify({ error: "Missing ZIP parameter" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }));
      }

      const result = await fetchBallotForZip({ zip }, env);
      return withCors(new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" }
      }));
    }

    // ✅ POST /api/ballot/generate — AI summarizes links
    if (pathname === "/api/ballot/generate" && request.method === "POST") {
      try {
        const { sources } = await request.json();
        const result = await generateBallotFromSources({ sources }, env);
        return withCors(new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" }
        }));
      } catch (err) {
        return withCors(new Response(JSON.stringify({
          error: "Failed to process sources",
          message: err.message,
          stack: err.stack
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }));
      }
    }

    // ❌ Default fallback
    return withCors(new Response("Not Found", { status: 404 }));
  }
};
