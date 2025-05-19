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
    // CORS headers for all responses
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const { pathname } = url;
    let response;

    console.log("🔍 PATH:", pathname, "METHOD:", request.method);

    // Serve candidate PDF files
    if (pathname.startsWith("/api/files/") && request.method === "GET") {
      response = await handleCandidateFile(request, env);
    }
    // Upload a new candidate PDF (step 1)
    else if (pathname === "/api/candidates/upload" && request.method === "POST") {
      response = await handleCandidateUpload(request, env);
    }
    // Confirm candidate details (step 2)
    else if (pathname === "/api/candidates/confirm" && request.method === "POST") {
      response = await handleCandidateConfirm(request, env);
    }
    // Block non-POST requests from falling through to tools
    else if (request.method !== "POST") {
      response = new Response("Method Not Allowed", { status: 405 });
    }
    // Generic tool dispatch for other JSON-based tools
    else {
      try {
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
      } catch (err) {
        console.error("❌ Error in tool dispatch:", err);
        response = new Response(JSON.stringify({
          error: "Failed to execute tool",
          message: err.message,
          stack: err.stack
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Merge CORS headers into the final response
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
