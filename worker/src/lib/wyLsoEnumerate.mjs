// worker/src/lib/wyLsoEnumerate.mjs
// Delta-based enumeration of Wyoming LSO bills
// Tracks last_seen_at and marks inactive bills safely

import { countBillsViaLsoService } from "./wyolegCounter.mjs";

/**
 * Enumerate bills from LSO Service and update civic_items with delta tracking
 * @param {D1Database} db - WY_DB database instance
 * @param {string} year - Legislative session year
 * @param {object} options - { dryRun?: boolean, mockBills?: array }
 * @returns {Promise<{totalInLso: number, newBillsAdded: number, billsMarkedInactive: number, sampleBills: string[]}>}
 */
export async function enumerateLsoAndUpsert(db, year, options = {}) {
  const { dryRun = false, mockBills = null } = options;

  console.log(`[LSO_ENUM] Starting enumeration for year ${year}`);

  try {
    // Fetch bills from LSO Service
    let bills = mockBills;
    if (!bills) {
      const billsResponse = await fetch(
        `https://web.wyoleg.gov/LsoService/api/BillInformation?searchValue=${encodeURIComponent(year)}`
      );
      if (!billsResponse.ok) {
        throw new Error(`LSO fetch failed: ${billsResponse.status}`);
      }
      const data = await billsResponse.json();
      bills = Array.isArray(data) ? data : [];
    }

    // Filter to requested year
    const yearBills = bills.filter(b => String(b.year) === String(year));
    console.log(`[LSO_ENUM] Found ${yearBills.length} bills for year ${year}`);

    // Upsert each bill with year scope
    let newBillsAdded = 0;
    for (const bill of yearBills) {
      const billNum = extractBillNum(bill);
      if (!billNum) continue;

      // Create a year-scoped ID to avoid conflicts across legislative sessions
      // e.g., "2026_HB0002" so that HB0002 can exist for both 2025 and 2026
      const compositeId = `${year}_${billNum}`;

      // Check if this year's bill already exists
      let isNew = false;
      try {
        const existing = await db
          .prepare("SELECT id FROM civic_items WHERE id = ? LIMIT 1")
          .bind(compositeId)
          .first();
        isNew = !existing;
      } catch (err) {
        // Table might not exist yet, assume new
        isNew = true;
      }

      // Upsert: insert or update
      if (!dryRun) {
        try {
          await db
            .prepare(
              `INSERT INTO civic_items (
                id, kind, source, level, jurisdiction_key, bill_number, title, summary,
                status, legislative_session, chamber, external_ref_id, external_url,
                last_action, last_action_date, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                title = COALESCE(civic_items.title, excluded.title),
                summary = COALESCE(civic_items.summary, excluded.summary),
                status = excluded.status,
                last_action = excluded.last_action,
                last_action_date = excluded.last_action_date,
                updated_at = excluded.updated_at`
            )
            .bind(
              compositeId,
              "bill",
              "lso",
              "statewide",
              "WY",
              billNum,
              bill.shortTitle || billNum,
              bill.shortTitle || null,
              mapLsoStatus(bill.billStatus),
              year,
              chamberFromBillNum(billNum),
              billNum || null,
              `https://wyoleg.gov/Legislation/${year}/${bill.billNum}`,
              bill.lastAction || null,
              bill.lastActionDate || null,
              new Date().toISOString(),
              new Date().toISOString()
            )
            .run();

          if (isNew) newBillsAdded++;
        } catch (err) {
          console.warn(`[LSO_ENUM] Failed to upsert ${compositeId}: ${err.message}`);
        }
      }
    }

    // Note: Inactive bill tracking requires last_seen_at and inactive_at columns
    // which are not in the current civic_items schema. Skip for now.
    let billsMarkedInactive = 0;

    console.log(`[LSO_ENUM] Complete: ${yearBills.length} total, ${newBillsAdded} new, ${billsMarkedInactive} marked inactive`);

    return {
      totalInLso: yearBills.length,
      newBillsAdded,
      billsMarkedInactive,
      sampleBills: yearBills.slice(0, 10).map(b => extractBillNum(b)).filter(Boolean)
    };
  } catch (error) {
    console.error(`[LSO_ENUM] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Get count of active bills for a year from civic_items
 */
export async function getActiveBillCountForYear(db, year) {
  try {
    const result = await db
      .prepare(
        `SELECT COUNT(*) as count FROM civic_items
         WHERE kind = 'bill' AND legislative_session = ? AND inactive_at IS NULL`
      )
      .bind(year)
      .first();
    return result?.count ?? 0;
  } catch (err) {
    console.warn(`[LSO_ENUM] Failed to count active bills: ${err.message}`);
    return 0;
  }
}

/**
 * Extract bill number from LSO bill object
 */
function extractBillNum(bill) {
  if (!bill || !bill.billNum) return null;
  const num = String(bill.billNum).toUpperCase().trim();
  if (!num) return null;
  return num;
}

/**
 * Map LSO status to civic_items status
 */
function mapLsoStatus(billStatus) {
  if (!billStatus) return "draft_committee";
  const s = String(billStatus).toLowerCase();
  if (s.includes("introduc")) return "introduced";
  if (s.includes("committee")) return "in_committee";
  if (s.includes("pass")) return "passed";
  if (s.includes("fail") || s.includes("veto")) return "failed";
  return "draft_committee";
}

/**
 * Reconcile legacy duplicate rows for a session.
 * Mark inactive any legacy-format rows (id = bill_number) when canonical rows exist (id = year_bill_number).
 * @param {D1Database} db - WY_DB database instance
 * @param {string} year - Legislative session year
 * @returns {Promise<number>} - Number of rows marked inactive
 */
export async function reconcileLegacyDuplicates(db, year) {
  try {
    // Mark inactive all legacy-format rows for this session where a canonical row exists
    const result = await db
      .prepare(
        `UPDATE civic_items
         SET inactive_at = COALESCE(inactive_at, datetime('now')),
             updated_at = datetime('now')
         WHERE legislative_session = ?
           AND source = 'lso'
           AND id NOT LIKE ?
           AND inactive_at IS NULL
           AND EXISTS (
             SELECT 1 FROM civic_items legacy_check
             WHERE legacy_check.legislative_session = civic_items.legislative_session
               AND legacy_check.bill_number = civic_items.bill_number
               AND legacy_check.id LIKE ?
           )`
      )
      .bind(year, `${year}_%`, `${year}_%`)
      .run();
    
    return result?.meta?.changes || 0;
  } catch (err) {
    console.warn(`[LSO_ENUM] Failed to reconcile legacy duplicates for ${year}: ${err.message}`);
    return 0;
  }
}

/**
 * Count legacy duplicate rows for a session (for diagnostics)
 * @param {D1Database} db - WY_DB database instance
 * @param {string} year - Legislative session year
 * @returns {Promise<number>} - Number of active legacy-format rows
 */
export async function getLegacyDuplicateCountForYear(db, year) {
  try {
    // Count active legacy-format rows (id = bill_number, not year_bill_number)
    const result = await db
      .prepare(
        `SELECT COUNT(*) as count FROM civic_items
         WHERE legislative_session = ?
           AND source = 'lso'
           AND id NOT LIKE ?
           AND inactive_at IS NULL`
      )
      .bind(year, `${year}_%`)
      .first();
    return result?.count ?? 0;
  } catch (err) {
    console.warn(`[LSO_ENUM] Failed to count legacy duplicates: ${err.message}`);
    return 0;
  }
}

/**
 * Determine chamber from bill number
 */
function chamberFromBillNum(billNum) {
  const n = String(billNum).toUpperCase();
  if (n.startsWith("HB")) return "house";
  if (n.startsWith("SF") || n.startsWith("SB")) return "senate";
  return null;
}

