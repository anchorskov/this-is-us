// worker/src/routes/civic/delegation.mjs
// GET /api/civic/delegation
// Returns user's delegation: state house, state senate, and federal representatives.
//
// Usage:
//   GET /api/civic/delegation?user_id=firebase-uid        (verified voter lookup)
//   GET /api/civic/delegation?voter_id=voter-id            (direct voter lookup, for testing/admin)
//
// Returns:
//   {
//     source: "verified_voter" | "voter_id_lookup" | "none",
//     county: "Laramie" | null,
//     state: "Wyoming",
//     house: { district: "23", name: "...", role: "State House", email: "...", phone: "...", website: "..." } | null,
//     senate: { district: "10", name: "...", role: "State Senate", ... } | null,
//     federal: {
//       house: { name: "...", role: "U.S. House (At-Large)", ... },
//       senators: [ { ... }, { ... } ]
//     }
//   }

import { federalDelegation } from "../../lib/federalDelegation.mjs";

/**
 * Helper: Format legislator from wy_legislators row
 */
function formatLegislator(row, roleOverride = null) {
  if (!row) return null;
  
  const roleMap = {
    house: "State House",
    senate: "State Senate",
  };
  
  return {
    district: row.district_number || row.district_label,
    name: row.name,
    role: roleOverride || roleMap[row.chamber] || "Legislator",
    email: row.contact_email || "",
    phone: row.contact_phone || "",
    website: row.website_url || "",
    bio: row.bio || "",
  };
}

/**
 * Main delegation handler
 */
export async function handleGetDelegation(request, env) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("user_id");
  const voterId = url.searchParams.get("voter_id");

  let houseDist = null;
  let senateDist = null;
  let county = null;
  let source = "none";

  try {
    // ─────────────────────────────────────────────────────────────────
    // Path 1: Lookup via verified_users (preferred, authenticated)
    // ─────────────────────────────────────────────────────────────────
    if (userId) {
      const { results: verified } = await env.WY_DB.prepare(`
        SELECT voter_id, county, house, senate, status
        FROM verified_users
        WHERE user_id = ?1 AND status = 'verified'
        LIMIT 1
      `)
        .bind(userId)
        .all();

      if (verified && verified.length > 0) {
        const v = verified[0];
        houseDist = v.house;
        senateDist = v.senate;
        county = v.county;
        source = "verified_voter";
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // Path 2: Lookup via voter_id (direct, testing/admin)
    // ─────────────────────────────────────────────────────────────────
    if (!houseDist && !senateDist && voterId) {
      const { results: voter } = await env.WY_DB.prepare(`
        SELECT house, senate, city_county_id
        FROM voters_addr_norm
        WHERE voter_id = ?1
        LIMIT 1
      `)
        .bind(voterId)
        .all();

      if (voter && voter.length > 0) {
        const v = voter[0];
        houseDist = v.house;
        senateDist = v.senate;

        // Optional: lookup county from city_county_id
        if (v.city_county_id) {
          const { results: cc } = await env.WY_DB.prepare(`
            SELECT county FROM wy_city_county WHERE id = ?1 LIMIT 1
          `)
            .bind(v.city_county_id)
            .all();
          if (cc && cc.length > 0) {
            county = cc[0].county;
          }
        }

        source = "voter_id_lookup";
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // No matching voter found
    // ─────────────────────────────────────────────────────────────────
    if (!houseDist && !senateDist) {
      return new Response(
        JSON.stringify({
          source: "none",
          message: "No verified voter record found. Please verify your voter account.",
          county: null,
          state: "Wyoming",
          house: null,
          senate: null,
          federal: federalDelegation,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Lookup state legislators by district
    // ─────────────────────────────────────────────────────────────────
    let stateHouse = null;
    let stateSenate = null;

    if (houseDist) {
      const { results: house } = await env.WY_DB.prepare(`
        SELECT id, name, chamber, district_label, district_number,
               contact_email, contact_phone, website_url, bio
        FROM wy_legislators
        WHERE chamber = 'house' AND district_number = ?1
        LIMIT 1
      `)
        .bind(houseDist)
        .all();

      if (house && house.length > 0) {
        stateHouse = formatLegislator(house[0]);
      }
    }

    if (senateDist) {
      const { results: senate } = await env.WY_DB.prepare(`
        SELECT id, name, chamber, district_label, district_number,
               contact_email, contact_phone, website_url, bio
        FROM wy_legislators
        WHERE chamber = 'senate' AND district_number = ?1
        LIMIT 1
      `)
        .bind(senateDist)
        .all();

      if (senate && senate.length > 0) {
        stateSenate = formatLegislator(senate[0]);
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // Return delegation
    // ─────────────────────────────────────────────────────────────────
    const response = {
      source,
      county: county || null,
      state: "Wyoming",
      house: stateHouse,
      senate: stateSenate,
      federal: federalDelegation,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`[delegation] Error:`, err);
    return new Response(
      JSON.stringify({
        error: "delegation_lookup_failed",
        message: err.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
