// worker/src/jobs/pendingBillsRefresh.mjs
// Weekly refresh: sync latest WY bills and scan them for topics/summaries.

import { syncWyomingBills } from "../lib/openStatesSync.mjs";
import { runScheduledPendingBillScan } from "../routes/civicScan.mjs";

/**
 * runPendingBillsRefresh
 * - Sync latest bills from the WY LSO/OpenStates source.
 * - Scan pending bills for hot topics + summaries (respects BILL_SCANNER_ENABLED).
 */
export async function runPendingBillsRefresh(env, opts = {}) {
  const session = opts.session || String(new Date().getFullYear());
  const limit = opts.limit || 200;

  const ingest = await syncWyomingBills(env, env.WY_DB, {
    session,
    limit,
  });

  const scan = await runScheduledPendingBillScan(env, {
    batchSize: opts.batchSize,
  });

  return { ingest, scan };
}

