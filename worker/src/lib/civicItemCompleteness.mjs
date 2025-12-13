/**
 * civicItemCompleteness.mjs
 *
 * Defines the minimum fields we expect for a "complete" civic bill record.
 * Completeness is used to decide which bills are safe to enrich with OpenAI
 * and surface as verified/grounded content.
 *
 * Required fields (5W + links):
 * - WHO: at least one sponsor (pass sponsorCount > 0 or hasSponsor=true).
 * - WHAT: title (short_title) and ai_summary present (plain-language summary).
 * - WHERE: jurisdiction_key === 'WY' and level === 'statewide'.
 * - WHEN: legislative_session (year) and status present; introduced_at optional.
 * - WHY: ai_summary acts as the plain-language “why”; problem statement may be
 *        stored as the first ai_key_points entry.
 * - LINKS/ID: bill_number present and external_url set (LSO source URL).
 */

/**
 * @param {object} item - civic_items row (may include ai fields)
 * @param {object} [opts]
 * @param {number} [opts.sponsorCount] - number of linked bill_sponsors rows
 * @param {boolean} [opts.hasSponsor] - shortcut flag if sponsor exists
 * @returns {boolean} true if the record meets minimum completeness
 */
export function isCivicItemComplete(item = {}, opts = {}) {
  const hasSponsor = opts.hasSponsor || (opts.sponsorCount || 0) > 0;
  const hasSummary = Boolean(item.ai_summary && String(item.ai_summary).trim().length);
  const titleOk = Boolean(item.title && String(item.title).trim().length);
  const billNumberOk = Boolean(item.bill_number && String(item.bill_number).trim().length);
  const externalOk = Boolean(item.external_url && String(item.external_url).trim().length);
  const statusOk = Boolean(item.status && String(item.status).trim().length);
  const sessionOk = Boolean(item.legislative_session && String(item.legislative_session).trim().length);

  const wyOk =
    item.jurisdiction_key === "WY" &&
    item.level === "statewide";

  return (
    wyOk &&
    hasSponsor &&
    hasSummary &&
    titleOk &&
    billNumberOk &&
    externalOk &&
    statusOk &&
    sessionOk
  );
}
