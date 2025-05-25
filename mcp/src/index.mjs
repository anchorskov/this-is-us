// mcp/src/index.mjs

import listCandidates from "../tools/listCandidates.js";
import subscribeToAlerts from "../tools/subscribeToAlerts.js";
import getCandidatePdf from "../tools/getCandidatePdf.js";
import parseCandidatePdf from "../tools/parseCandidatePdf.js";
import handleCandidateUpload from "./routes/candidate-upload.js";
import handleCandidateFile from "./routes/candidate-file.js";
import handleCandidateConfirm from "./routes/candidate-confirm.js";
import insertParsedCandidate from "../tools/insertParsedCandidate.js";
import processCandidateUpload from "../tools/processCandidateUpload.js";
import listWarriors from "../tools/warrior.mjs";

const tools = {
  listCandidates,
  subscribeToAlerts,
  getCandidatePdf,
  parseCandidatePdf,
  insertParsedCandidate,
  processCandidateUpload
};

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);
    const { pathname } = url;
    let response;

    console.log("🔍 PATH:", pathname, "METHOD:", request.method);

    try {
      if (pathname.startsWith("/api/files/") && request.method === "GET") {
        response = await handleCandidateFile(request, env);
      } else if (pathname === "/api/candidates/upload" && request.method === "POST") {
        response = await handleCandidateUpload(request, env);
      } else if (pathname === "/api/candidates/confirm" && request.method === "POST") {
        response = await handleCandidateConfirm(request, env);
      } else if (pathname === "/api/warriors" && request.method === "GET") {
        const location = url.searchParams.get("location") || "";
        const data = await listWarriors({ location }, env);
        response = new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json" }
        });
      } else if (request.method !== "POST") {
        response = new Response("Method Not Allowed", { status: 405 });
      } else {
        const { tool, input } = await request.json();
        if (!tool || !tools[tool]) {
          response = new Response(JSON.stringify({ error: "Tool not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" }
          });
        } else {
          const result = await tools[tool](input || {}, env, ctx);
          response = new Response(JSON.stringify(result), {
            headers: { "Content-Type": "application/json" }
          });
        }
      }
    } catch (err) {
      console.error("❌ Error during request:", err);
      response = new Response(
        JSON.stringify({ error: "Server error", message: err.message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
      headers.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
