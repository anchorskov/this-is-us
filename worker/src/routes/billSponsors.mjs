// worker/src/routes/billSponsors.mjs
// GET /api/civic/bill-sponsors?bill_id=<civic_items.id>

import { withCORS } from "../utils/cors.js";

export async function handleBillSponsors(request, env) {
  try {
    const url = new URL(request.url);
    const billId = url.searchParams.get("bill_id");
    if (!billId) {
      return withCORS(
        JSON.stringify({ error: "bill_id is required" }),
        400,
        { "Content-Type": "application/json" },
        request
      );
    }

    const { results = [] } = await env.WY_DB.prepare(
      `SELECT sponsor_name, sponsor_role, sponsor_district,
              contact_email, contact_phone, contact_website
         FROM bill_sponsors
        WHERE civic_item_id = ?
        ORDER BY
          CASE sponsor_role WHEN 'primary' THEN 0 ELSE 1 END,
          sponsor_name ASC`
    )
      .bind(billId)
      .all();

    const sponsors = results.map((row) => ({
      name: row.sponsor_name,
      role: row.sponsor_role,
      district: row.sponsor_district,
      contact_email: row.contact_email,
      contact_phone: row.contact_phone,
      contact_website: row.contact_website,
    }));

    return withCORS(JSON.stringify(sponsors), 200, {
      "Content-Type": "application/json",
    });
  } catch (err) {
    console.error("❌ handleBillSponsors error:", err);
    return withCORS(
      JSON.stringify({ error: "Internal server error" }),
      500,
      { "Content-Type": "application/json" },
      request
    );
  }
}
