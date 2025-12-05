// worker/src/routes/voters.js
import { withCORS } from "../utils/cors.js";

/**
 * Voter lookup handler against the WY voter table.
 *
 * Schema assumptions (documented per instructions):
 *   - Table name: voters_addr_norm (normalized voter address data)
 *   - Local data contains: voter_id, addr1, city, state, zip, senate, house, city_county_id
 *   - Names (ln, fn) may be NULL in local test data; use voter_id or address info for lookup
 *   - Remote has full data with names via voters_raw table join
 * 
 * Local test data: Address information only (274k+ records)
 * Lookup strategy: By voter_id, city, county, or address
 */

const TABLE_NAME = "voters_addr_norm";

const json = (body, status = 200) =>
  withCORS(JSON.stringify(body), status, {
    "Content-Type": "application/json",
  });

export async function handleVoterLookup(request, env) {
  try {
    const url = new URL(request.url);
    const normalize = (val) => val?.trim().toUpperCase() || null;

    const voterId = normalize(url.searchParams.get("voter_id"));
    const lastName = normalize(url.searchParams.get("last_name"));
    const firstName = normalize(url.searchParams.get("first_name"));
    const city = normalize(url.searchParams.get("city"));
    const county = normalize(url.searchParams.get("county"));

    // Require either voter_id OR (last_name + county)
    if (!voterId && !lastName) {
      return json({ error: "voter_id OR last_name is required" }, 400);
    }
    if (!voterId && !county) {
      return json({ error: "county is required (when searching by name)" }, 400);
    }

    let limit = parseInt(url.searchParams.get("limit") || "25", 10);
    if (Number.isNaN(limit) || limit <= 0) limit = 25;
    limit = Math.min(Math.max(limit, 1), 100);

    let offset = parseInt(url.searchParams.get("offset") || "0", 10);
    if (Number.isNaN(offset) || offset < 0) offset = 0;

    const clauses = [];
    const params = [];

    // If voter_id provided, use it
    if (voterId) {
      clauses.push("v.voter_id = ?");
      params.push(voterId);
    } else {
      // Otherwise search by name + county
      if (lastName) {
        clauses.push("v.ln LIKE ?");
        params.push(`${lastName}%`);
      }
      if (firstName) {
        clauses.push("v.fn LIKE ?");
        params.push(`${firstName}%`);
      }
      if (county) {
        clauses.push("cc.county_norm LIKE ?");
        params.push(`${county}%`);
      }
    }

    if (city && !voterId) {
      clauses.push("v.city = ?");
      params.push(city);
    }

    const whereSql = clauses.length > 0 ? clauses.map((c) => ` AND ${c}`).join("") : "";

    const sql = `
      SELECT
        v.voter_id,
        v.ln as last_name,
        v.fn as first_name,
        v.addr1 as street_address,
        v.city,
        v.state,
        v.zip,
        v.senate,
        v.house,
        cc.county_norm as county
      FROM ${TABLE_NAME} v
      JOIN wy_city_county cc ON v.city_county_id = cc.id
      WHERE 1 = 1
      ${whereSql}
      ORDER BY v.ln, v.fn, v.city
      LIMIT ?
      OFFSET ?`;

    params.push(limit, offset);

    const stmt = env.WY_DB.prepare(sql).bind(...params);
    const { results } = await stmt.all();

    return json({ results, limit, offset });
  } catch (err) {
    console.error("❌ /api/voters/lookup error:", err);
    return json({ error: "Internal server error" }, 500);
  }
}
