// worker/src/routes/fetchLsoText.mjs
// Internal helper to enrich an LSO civic_item with official URLs (page + PDF)

import { fetchLsoBillTextMetadata } from "../lib/wyLsoBillText.mjs";
import { withCORS } from "../utils/cors.js";

export async function handleFetchLsoText(request, env) {
  try {
    const url = new URL(request.url);
    const billId = url.searchParams.get("bill_id");
    if (!billId) {
      return withCORS(
        JSON.stringify({ error: "bill_id is required" }),
        400,
        { "Content-Type": "application/json" }
      );
    }

    const { results: rows = [] } = await env.WY_DB.prepare(
      "SELECT * FROM civic_items WHERE id = ?"
    )
      .bind(billId)
      .all();

    const bill = rows[0];
    if (!bill) {
      return withCORS(
        JSON.stringify({ error: "Bill not found" }),
        404,
        { "Content-Type": "application/json" }
      );
    }
    if (bill.source !== "lso") {
      return withCORS(
        JSON.stringify({ error: "Only LSO bills are supported" }),
        400,
        { "Content-Type": "application/json" }
      );
    }

    const { billUrl, pdfUrl } = await fetchLsoBillTextMetadata(env, bill);

    // Update URLs if we found better data
    await env.WY_DB.prepare(
      `UPDATE civic_items
          SET external_url = COALESCE(?, external_url),
              text_url = COALESCE(?, text_url),
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`
    )
      .bind(billUrl || bill.external_url, pdfUrl || bill.text_url, billId)
      .run();

    return withCORS(
      JSON.stringify({
        ok: true,
        bill_id: billId,
        external_url: billUrl || bill.external_url || null,
        text_url: pdfUrl || bill.text_url || null,
      }),
      200,
      { "Content-Type": "application/json" }
    );
  } catch (err) {
    console.error("❌ handleFetchLsoText failed:", err);
    return withCORS(
      JSON.stringify({ error: "Internal server error", message: err.message }),
      500,
      { "Content-Type": "application/json" }
    );
  }
}

export default handleFetchLsoText;
