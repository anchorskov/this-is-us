/**
 * worker/src/lib/wyolegDocResolver.mjs
 *
 * Resolves actual PDF document URLs for Wyoming Legislature bills.
 *
 * Wyoming Legislature publishes bills in multiple formats:
 * - Introduced (initial): /session/Introduced/{bill}.pdf
 * - Engrossed (amended): /session/Engrossed/{bill}.pdf
 * - Enrolled (passed): /session/Enrolled/{bill}.pdf
 * - Fiscal notes: /session/Fiscal/{bill}.pdf
 *
 * This resolver checks for PDFs in order of preference and returns the best match.
 * Uses HEAD requests for efficiency (no download, just headers).
 *
 * @module wyolegDocResolver
 */

/**
 * generateCandidateUrls(billNumber, legislativeSession)
 *
 * Generate candidate document URLs in preference order.
 *
 * @param {string} billNumber - Bill number (e.g., "SF0013", "HB0008")
 * @param {string} legislativeSession - Legislative year (e.g., "2026")
 * @returns {Array<{url: string, kind: string}>} Ordered list of candidates
 */
export function generateCandidateUrls(billNumber, legislativeSession) {
  const base = "https://wyoleg.gov";
  const candidates = [
    // Prefer Introduced (most complete)
    { url: `${base}/${legislativeSession}/Introduced/${billNumber}.pdf`, kind: "introduced" },
    // Then Engrossed (amended version)
    { url: `${base}/${legislativeSession}/Engrossed/${billNumber}.pdf`, kind: "engrossed" },
    // Then Enrolled (final passed version)
    { url: `${base}/${legislativeSession}/Enrolled/${billNumber}.pdf`, kind: "enrolled" },
    // Fiscal notes (supplementary)
    { url: `https://www.wyoleg.gov/${legislativeSession}/Fiscal/${billNumber}.pdf`, kind: "fiscal" },
  ];
  return candidates;
}

/**
 * resolveBillDocumentUrl(billNumber, legislativeSession)
 *
 * Find the best available PDF URL for a bill.
 * Performs HEAD requests to verify existence and content-type.
 *
 * @param {string} billNumber - Bill number (e.g., "SF0013")
 * @param {string} legislativeSession - Legislative year (e.g., "2026")
 * @returns {Promise<{
 *   best_doc_url: string|null,
 *   best_doc_kind: string|null,
 *   candidates_checked: number,
 *   candidates_found: Array<{url, kind}>,
 *   notes: string,
 *   success: boolean
 * }>}
 */
export async function resolveBillDocumentUrl(billNumber, legislativeSession) {
  const candidates = generateCandidateUrls(billNumber, legislativeSession);
  const candidates_found = [];
  let notes = "";

  console.log(`🔍 Resolving PDF URLs for ${billNumber} (${legislativeSession})...`);

  for (const candidate of candidates) {
    try {
      console.log(`  📄 Checking ${candidate.kind}: ${candidate.url}`);
      const response = await fetch(candidate.url, { method: "HEAD", redirect: "follow" });

      if (response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/pdf") || contentType.includes("application/octet-stream")) {
          console.log(`    ✅ Found ${candidate.kind} PDF (${response.status})`);
          candidates_found.push({
            url: candidate.url,
            kind: candidate.kind,
            status: response.status,
            contentType,
          });
        } else {
          console.log(`    ❌ Wrong content-type: ${contentType}`);
        }
      } else {
        console.log(`    ❌ HTTP ${response.status}`);
      }
    } catch (err) {
      console.warn(`    ⚠️ Error checking ${candidate.kind}: ${err.message}`);
    }
  }

  // Return best match (first found, in preference order)
  if (candidates_found.length > 0) {
    const best = candidates_found[0];
    notes = `Found ${candidates_found.length} PDF(s). Using ${best.kind}.`;
    console.log(`✅ Resolved to: ${best.kind}`);

    return {
      best_doc_url: best.url,
      best_doc_kind: best.kind,
      candidates_checked: candidates.length,
      candidates_found: candidates_found.map((c) => ({ url: c.url, kind: c.kind })),
      notes,
      success: true,
    };
  }

  notes = `Checked ${candidates.length} candidate URLs, none returned valid PDF.`;
  console.log(`❌ ${notes}`);

  return {
    best_doc_url: null,
    best_doc_kind: null,
    candidates_checked: candidates.length,
    candidates_found: [],
    notes,
    success: false,
  };
}

/**
 * upsertCivicItemSource(env, civicItemId, resolverResult)
 *
 * Save resolver result to D1 civic_item_sources table.
 *
 * @param {Object} env - Cloudflare Worker environment with WY_DB binding
 * @param {string} civicItemId - civic_items.id (bill_number)
 * @param {Object} resolverResult - Output from resolveBillDocumentUrl()
 * @returns {Promise<boolean>} True if upserted successfully
 */
export async function upsertCivicItemSource(env, civicItemId, resolverResult) {
  const { best_doc_url, best_doc_kind, notes, success } = resolverResult;
  const status = success ? "resolved" : "not_found";
  const now = new Date().toISOString();

  try {
    const sql = `
      INSERT INTO civic_item_sources (
        civic_item_id, best_doc_url, best_doc_kind, status, checked_at, notes
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(civic_item_id) DO UPDATE SET
        best_doc_url = excluded.best_doc_url,
        best_doc_kind = excluded.best_doc_kind,
        status = excluded.status,
        checked_at = excluded.checked_at,
        notes = excluded.notes,
        last_error = NULL
    `;

    const result = await env.WY_DB.prepare(sql).bind(
      civicItemId,
      best_doc_url,
      best_doc_kind,
      status,
      now,
      notes
    ).run();

    console.log(`✅ Upserted civic_item_sources for ${civicItemId}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to upsert civic_item_sources: ${err.message}`);
    // Try to update just the error field
    try {
      await env.WY_DB.prepare(
        `UPDATE civic_item_sources SET last_error = ?, checked_at = ? WHERE civic_item_id = ?`
      ).bind(err.message, now, civicItemId).run();
    } catch {
      // Silent fail on error update
    }
    return false;
  }
}

/**
 * getCachedSource(env, civicItemId, maxAgeHours = 24)
 *
 * Retrieve cached resolver result if still fresh.
 *
 * @param {Object} env - Cloudflare Worker environment with WY_DB binding
 * @param {string} civicItemId - civic_items.id (bill_number)
 * @param {number} maxAgeHours - Max age before re-resolving (default 24)
 * @returns {Promise<Object|null>}
 */
export async function getCachedSource(env, civicItemId, maxAgeHours = 24) {
  try {
    const { results } = await env.WY_DB.prepare(
      `SELECT * FROM civic_item_sources WHERE civic_item_id = ?`
    ).bind(civicItemId).all();

    if (!results || results.length === 0) return null;

    const cached = results[0];
    const checkedAt = new Date(cached.checked_at);
    const ageMs = Date.now() - checkedAt.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);

    if (ageHours < maxAgeHours) {
      console.log(`📦 Using cached source for ${civicItemId} (${Math.round(ageHours)}h old)`);
      return cached;
    }

    console.log(`⏰ Cached source too old (${Math.round(ageHours)}h), will re-resolve`);
    return null;
  } catch (err) {
    console.warn(`⚠️ Error retrieving cached source: ${err.message}`);
    return null;
  }
}
