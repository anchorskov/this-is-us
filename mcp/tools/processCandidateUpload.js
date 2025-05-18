// mcp/tools/processCandidateUpload.js

import parseCandidatePdf from "./parseCandidatePdf.js";
import insertParsedCandidate from "./insertParsedCandidate.js";

export default async function processCandidateUpload({ pdf_url }, env, ctx) {
  if (!pdf_url) return { error: "Missing pdf_url" };

  // Step 1: Parse the PDF
  const parsed = await parseCandidatePdf({ pdf_url }, env, ctx);

  if (parsed.error) {
    return {
      error: "Parsing failed",
      details: parsed
    };
  }

  // Step 2: Insert parsed candidate
  const inserted = await insertParsedCandidate({ ...parsed, pdf_url }, env, ctx);

  if (inserted.error) {
    return {
      error: "Insertion failed",
      candidate: parsed,
      details: inserted
    };
  }

  // 🎉 All good
  return {
    success: true,
    candidate: parsed
  };
}
