// mcp/src/index.mjs

import listCandidates from "../tools/listCandidates.js";
import subscribeToAlerts from "../tools/subscribeToAlerts.js";
import getCandidatePdf from "../tools/getCandidatePdf.js";
import parseCandidatePdf from "../tools/parseCandidatePdf.js";
import handleCandidateUpload from "./routes/candidate-upload.js";
import handleCandidateFile from "./routes/candidate-file.js";
import insertParsedCandidate from "../tools/insertParsedCandidate.js"; // ✅
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
    const url = new URL(request.url);
    console.log("🔍 PATH:", url.pathname, "METHOD:", request.method);

    const pathname = url.pathname;

    // ✅ Route: PDF file retrieval
    if (pathname.startsWith("/api/files/") && request.method === "GET") {
      console.log("📄 Routing to handleCandidateFile:", pathname);
      return handleCandidateFile(request, env);
    }

    // ✅ Route: Upload PDF
    if (pathname === "/api/candidates/upload" && request.method === "POST") {
      return handleCandidateUpload(request, env);
    }

    // ❌ Block non-POST requests to tool handler
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // ✅ Tool dispatch
    try {
      const { tool, input } = await request.json();

      if (!tool || !tools[tool]) {
        return new Response(JSON.stringify({ error: "Tool not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }

      const result = await tools[tool](input || {}, env, ctx);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({
        error: "Failed to execute tool",
        message: err.message,
        stack: err.stack
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
