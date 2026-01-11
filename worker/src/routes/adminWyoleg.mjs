// worker/src/routes/adminWyoleg.mjs

import { syncWyomingBills } from "../lib/openStatesSync.mjs";
import { runAdminScan, runAdminTopics } from "./civicScan.mjs";
import { countBillsViaLsoService } from "../lib/wyolegCounter.mjs";
import { enumerateLsoAndUpsert, getActiveBillCountForYear, reconcileLegacyDuplicates, getLegacyDuplicateCountForYear } from "../lib/wyLsoEnumerate.mjs";
import { hasColumn } from "../lib/dbHelpers.mjs";
import { resetDerivedState } from "../lib/ingestReset.mjs";

function isAuthorized(request, env) {
  const host = new URL(request.url).hostname;
  if (host === "127.0.0.1" || host === "localhost") return true;
  const token = request.headers.get("x-internal-token");
  const expected = env.INTERNAL_SCAN_TOKEN;
  return expected && token && token === expected;
}

async function persistRun(env, payload) {
  try {
    await env.WY_DB.prepare(
      `INSERT OR REPLACE INTO ingestion_runs
         (run_id, started_at, finished_at, session, limit_requested, force_flag, dry_run,
          synced_count, scanned_count, resolved_docs_count, summaries_written, tags_written,
          status, error)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`
    )
      .bind(
        payload.run_id,
        payload.started_at,
        payload.finished_at,
        payload.session,
        payload.limit_requested,
        payload.force_flag ? 1 : 0,
        payload.dry_run ? 1 : 0,
        payload.synced_count,
        payload.scanned_count,
        payload.resolved_docs_count,
        payload.summaries_written,
        payload.tags_written,
        payload.status,
        payload.error || null
      )
      .run();

    if (Array.isArray(payload.items) && payload.items.length > 0) {
      const stmt = env.WY_DB.prepare(
        `INSERT INTO ingestion_run_items
           (run_id, civic_item_id, bill_number, phase, status, message, duration_ms)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
      );
      for (const item of payload.items) {
        await stmt
          .bind(
            payload.run_id,
            item.civic_item_id || null,
            item.bill_number || null,
            item.phase || null,
            item.status || null,
            item.message || null,
            item.duration_ms || null
          )
          .run();
      }
    }
  } catch (err) {
    console.warn("⚠️ Failed to persist ingestion run", err.message);
  }
}

export async function handleAdminRunWyoleg(request, env) {
  if (!isAuthorized(request, env)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body = {};
  try {
    body = await request.json();
  } catch (_) {
    body = {};
  }

  const url = new URL(request.url);
  const limit = Number(body.limit || url.searchParams.get("limit") || 25);
  const force =
    body.force === true ||
    url.searchParams.get("force") === "1" ||
    url.searchParams.get("force") === "true";
  const billId = body.billId || url.searchParams.get("billId") || null;
  const dryRun =
    body.dryRun === true ||
    url.searchParams.get("dryRun") === "1" ||
    url.searchParams.get("dryRun") === "true";
  const session =
    body.session ||
    url.searchParams.get("session") ||
    String(new Date().getFullYear());
  const phase = body.phase || url.searchParams.get("phase") || "all";

  const run_id =
    (crypto?.randomUUID && crypto.randomUUID()) ||
    `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const started_at = new Date().toISOString();
  const result = {
    run_id,
    started_at,
    finished_at: null,
    synced_count: 0,
    scanned_count: 0,
    resolved_docs_count: 0,
    summaries_written: 0,
    tags_written: 0,
    topics_written: 0,
    topics_processed: 0,
    wyoleg_total_bills: null,
    wyoleg_count_method: null,
    wyoleg_count_error: null,
    lso_total_items_year: null,
    lso_new_bills_added_this_run: null,
    lso_bills_marked_inactive_this_run: null,
    db_total_active_bills_year: 0,
    db_total_legacy_duplicates_year: 0,
    db_total_bills: 0,
    db_total_sources: 0,
    db_total_tags: 0,
    complete: false,
    remaining: null,
    errors: [],
  };

  // Schema guard: verify enumeration tracking columns exist
  try {
    const schemaCheck = await env.WY_DB.prepare(
      `PRAGMA table_info(civic_items)`
    ).all();
    const columns = schemaCheck.results.map(r => r.name);
    const requiredCols = ['inactive_at', 'enumerated_at', 'last_seen_at'];
    const missing = requiredCols.filter(col => !columns.includes(col));
    if (missing.length > 0) {
      return new Response(JSON.stringify({
        error: "schema_mismatch",
        message: `Missing columns: ${missing.join(', ')}`,
        fix: "Run: cd worker && ./scripts/wr d1 migrations apply WY_DB --local"
      }), {
        status: 409,
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (err) {
    result.errors.push(`schema_check: ${err.message}`);
  }

  try {
    // Step 0: Count bills via official Wyoming LSO Service API
    // Source: https://web.wyoleg.gov/LsoService/api/BillInformation
    // ⚠️  CRITICAL: LSO Service MUST be authoritative. OpenStates is never used for total count.
    if ((phase === "all" || phase === "enumerate") && !dryRun) {
      const countResult = await countBillsViaLsoService(session);
      
      // Accept only if total is not null
      if (countResult.total !== null) {
        result.wyoleg_total_bills = countResult.total;
        result.wyoleg_count_method = countResult.method;
        result.wyoleg_sample_bills = countResult.sampleBills || [];
        
        // Store in database
        try {
          await env.WY_DB.prepare(
            `INSERT OR REPLACE INTO ingestion_metadata (key, value_int, updated_at)
             VALUES (?1, ?2, datetime('now'))`
          ).bind(`wyoleg_${session}_total_bills`, countResult.total).run();
          
          await env.WY_DB.prepare(
            `INSERT OR REPLACE INTO ingestion_metadata (key, value_text, updated_at)
             VALUES (?1, ?2, datetime('now'))`
          ).bind(`wyoleg_${session}_count_method`, countResult.method).run();
          
          await env.WY_DB.prepare(
            `INSERT OR REPLACE INTO ingestion_metadata (key, value_text, updated_at)
             VALUES (?1, ?2, datetime('now'))`
          ).bind(`wyoleg_${session}_sample_bills`, JSON.stringify(countResult.sampleBills || [])).run();
        } catch (dbErr) {
          result.errors.push(`metadata_store: ${dbErr.message}`);
        }
        
        console.log(`✅ LSO Service: ${countResult.total} bills (method: ${countResult.method})`);
      } 
      // If total is null, it's a legitimate failure
      else {
        result.wyoleg_total_bills = null;
        result.wyoleg_count_method = countResult.method || 'lsoService_failed';
        result.wyoleg_count_error = countResult.error || 'Unable to count bills from LSO Service';
        result.errors.push(`wyoleg_count: ${result.wyoleg_count_error}`);
        console.warn(`⚠️  LSO Service bill count failed: ${result.wyoleg_count_error}`);
      }
    }
  } catch (err) {
    console.error("❌ wyoleg count error:", err);
    result.errors.push(`wyoleg_count: ${err.message}`);
  }

  // Step 0b: Reset derived state before enumeration (unless running individual phases)
  try {
    if ((phase === "all" || phase === "enumerate") && !dryRun && force) {
      console.log(`🔄 Resetting derived ingestion state (force=true, phase=${phase})...`);
      const resetResult = await resetDerivedState({
        mode: "derived-only",
        wyDb: env.WY_DB,
        eventsDb: env.EVENTS_DB,
        isProduction: false, // Always allow in local/dev
        adminAuthPassed: true
      });
      if (!resetResult.success) {
        result.errors.push(`reset: ${resetResult.error}`);
      } else {
        console.log(`✅ Derived state reset complete:`, resetResult.cleared);
        result.reset_results = resetResult; // Add reset results to response
      }
    }
  } catch (err) {
    console.error("⚠️  Reset error:", err);
    result.errors.push(`reset: ${err.message}`);
  }

  // Step 0b: Enumerate LSO bills and update civic_items with delta tracking
  try {
    if ((phase === "all" || phase === "enumerate") && !dryRun) {
      const enumRes = await enumerateLsoAndUpsert(env.WY_DB, session);
      result.lso_total_items_year = enumRes.totalInLso;
      result.lso_new_bills_added_this_run = enumRes.newBillsAdded;
      result.lso_bills_marked_inactive_this_run = enumRes.billsMarkedInactive;
      
      // Reconcile legacy duplicates: mark inactive any non-composite rows where a composite row exists
      const legacyMarkedInactive = await reconcileLegacyDuplicates(env.WY_DB, session);
      if (legacyMarkedInactive > 0) {
        console.log(`✅ Reconciliation: ${legacyMarkedInactive} legacy duplicate rows marked inactive`);
      }
      
      // Get active bill count (canonical IDs only: id LIKE 'YYYY_%')
      const activeBillCount = await getActiveBillCountForYear(env.WY_DB, session);
      result.db_total_active_bills_year = activeBillCount;
      
      // Get legacy duplicate count for diagnostics
      const legacyDupCount = await getLegacyDuplicateCountForYear(env.WY_DB, session);
      result.db_total_legacy_duplicates_year = legacyDupCount;
      
      console.log(`✅ LSO Enumeration: ${enumRes.totalInLso} total, ${enumRes.newBillsAdded} new, ${enumRes.billsMarkedInactive} marked inactive, ${legacyMarkedInactive} legacy duplicates reconciled`);
    }
  } catch (err) {
    console.error("⚠️  LSO enumeration error:", err);
    result.errors.push(`lso_enumeration: ${err.message}`);
  }

  // Step 1: Resolve documents (resolve_docs phase)
  try {
    if ((phase === "all" || phase === "resolve_docs") && !dryRun) {
      // Document resolution is integrated into runAdminScan
      // This phase will be handled by scanning with focus on source resolution
      console.log(`ℹ️  resolve_docs phase: document resolution handled in scan_ai`);
    }
  } catch (err) {
    console.error("⚠️  resolve_docs error:", err);
    result.errors.push(`resolve_docs: ${err.message}`);
  }

  // Step 2: Enrich with OpenStates (enrich_openstates phase)
  try {
    if ((phase === "all" || phase === "enrich_openstates") && !dryRun) {
      const syncRes = await syncWyomingBills(env, env.WY_DB, {
        session,
        limit,
      });
      result.synced_count = syncRes?.synced || 0;
    }
  } catch (err) {
    console.error("❌ wyoleg sync error:", err);
    result.errors.push(`sync: ${err.message}`);
  }

  // Step 3: AI scan for summaries and tags (scan_ai phase)
  try {
    if ((phase === "all" || phase === "scan" || phase === "scan_ai" || phase === "resolve_docs") && !dryRun) {
      const scanRes = await runAdminScan(env, {
        batchSize: limit,
        force,
        billId,
        dryRun,
        year: session,
      });
      result.scanned_count = scanRes?.scanned || 0;
      result.scan_candidate_count = scanRes?.scan_candidate_count || 0;
      result.resolved_docs_count = scanRes?.sources_resolved || 0;
      result.summaries_written = scanRes?.summaries_written || 0;
      result.tags_written = scanRes?.saved_tags || 0;
      result.items = scanRes?.results || [];
    }
  } catch (err) {
    console.error("❌ wyoleg scan error:", err);
    result.errors.push(`scan: ${err.message}`);
  }

  // Step 4: Topics generation for bills with summaries (topics phase)
  try {
    if ((phase === "all" || phase === "topics") && !dryRun) {
      if (force) {
        try {
          const hasSession = await hasColumn(env.WY_DB, "hot_topic_civic_items", "legislative_session");
          if (hasSession) {
            await env.WY_DB.prepare(
              `DELETE FROM hot_topic_civic_items WHERE legislative_session = ?`
            ).bind(session).run();
          } else {
            await env.WY_DB.prepare(
              `DELETE FROM hot_topic_civic_items
               WHERE civic_item_id IN (
                 SELECT id FROM civic_items WHERE legislative_session = ?
               )`
            ).bind(session).run();
          }
        } catch (err) {
          result.errors.push(`topics_clear: ${err.message}`);
        }
      }
      const topicsRes = await runAdminTopics(env, {
        limit,
        billId,
        year: session,
      });
      result.topics_processed = topicsRes?.processed || 0;
      result.topics_written = topicsRes?.topics_written || 0;
      if (Array.isArray(topicsRes?.results)) {
        result.items = [...(result.items || []), ...topicsRes.results];
      }
    }
  } catch (err) {
    console.error("❌ wyoleg topics error:", err);
    result.errors.push(`topics: ${err.message}`);
  }

  // Compute database totals and completeness
  // ⚠️  CRITICAL: Filter by legislative_session to avoid cross-year pollution
  try {
    // Check if civic_items table exists
    const tableCheck = await env.WY_DB.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='civic_items'`
    ).first().catch(() => null);
    
    if (tableCheck) {
      const billsRow = await env.WY_DB.prepare(
        `SELECT COUNT(*) as count FROM civic_items WHERE legislative_session = ?1`
      ).bind(session).first();
      result.db_total_bills = billsRow?.count || 0;

      const sourcesRow = await env.WY_DB.prepare(
        `SELECT COUNT(*) as count FROM bill_sources bs 
         WHERE EXISTS (SELECT 1 FROM civic_items ci WHERE ci.bill_id = bs.bill_id AND ci.legislative_session = ?1)`
      ).bind(session).first().catch(() => ({ count: 0 }));
      result.db_total_sources = sourcesRow?.count || 0;

      const tagsRow = await env.WY_DB.prepare(
        `SELECT COUNT(*) as count FROM bill_tags bt 
         WHERE EXISTS (SELECT 1 FROM civic_items ci WHERE ci.bill_id = bt.bill_id AND ci.legislative_session = ?1)`
      ).bind(session).first().catch(() => ({ count: 0 }));
      result.db_total_tags = tagsRow?.count || 0;

      // Count active canonical (composite-ID format: YYYY_XXX) bills for the year
      const activeBillsRow = await env.WY_DB.prepare(
        `SELECT COUNT(*) as count FROM civic_items 
         WHERE legislative_session = ?1 AND inactive_at IS NULL AND id LIKE ?`
      ).bind(session, `${session}_%`).first();
      result.db_total_active_bills_year = activeBillsRow?.count || 0;

      // Count active legacy duplicate rows (non-composite format) for the year - for diagnostics
      const legacyDupsRow = await env.WY_DB.prepare(
        `SELECT COUNT(*) as count FROM civic_items 
         WHERE legislative_session = ?1 AND inactive_at IS NULL AND id NOT LIKE ?`
      ).bind(session, `${session}_%`).first();
      result.db_total_legacy_duplicates_year = legacyDupsRow?.count || 0;
    } else {
      result.errors.push("db_totals: Wyoming LSO schema not initialized (civic_items table missing)");
    }

    // Completeness: wyoleg_total_bills IS NOT NULL AND db_total_bills >= wyoleg_total_bills
    if (result.wyoleg_total_bills !== null) {
      result.complete = result.db_total_bills >= result.wyoleg_total_bills;
      result.remaining = Math.max(result.wyoleg_total_bills - result.db_total_bills, 0);
    }
  } catch (err) {
    console.error("❌ Failed to compute database totals:", err);
    result.errors.push(`db_totals: ${err.message}`);
  }

  result.finished_at = new Date().toISOString();

  if (!dryRun) {
    await persistRun(env, {
      ...result,
      session,
      limit_requested: limit,
      force_flag: force,
      dry_run: dryRun,
      status: result.errors.length ? "partial" : "ok",
      error: result.errors.join("; ") || null,
      items:
        result.items?.map((r) => ({
          civic_item_id: r.bill_id || null,
          bill_number: r.bill_number || null,
          phase: "scan",
          status: r.error ? "error" : "ok",
          message: r.error || null,
          duration_ms: null,
        })) || [],
    });
  }

  return new Response(JSON.stringify(result), {
    status: result.errors.length ? 207 : 200,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Run orchestrator repeatedly until completeness is achieved
 * POST /api/internal/admin/wyoleg/run-until-complete
 */
export async function handleAdminRunUntilComplete(request, env) {
  if (!isAuthorized(request, env)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body = {};
  try {
    body = await request.json();
  } catch (_) {
    body = {};
  }

  const maxRuns = Number(body.maxRuns || 5);
  const limit = Number(body.limit || 25);
  const session = body.session || String(new Date().getFullYear());

  const runs = [];
  let isComplete = false;
  let lastError = null;

  console.log(`🔄 Starting run-until-complete: maxRuns=${maxRuns}, limit=${limit}, session=${session}`);

  for (let i = 1; i <= maxRuns; i++) {
    console.log(`\n📍 Run ${i}/${maxRuns}...`);

    try {
      // Call single-run endpoint via internal POST
      const runRequest = new Request("http://127.0.0.1:8787/api/internal/admin/wyoleg/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session,
          limit,
          force: false,
          dryRun: false,
        }),
      });

      const runResponse = await env.router.route(runRequest, env);
      const runData = await runResponse.json();

      const runSummary = {
        run_number: i,
        run_id: runData.run_id,
        started_at: runData.started_at,
        finished_at: runData.finished_at,
        synced_count: runData.synced_count,
        scanned_count: runData.scanned_count,
        db_total_bills: runData.db_total_bills,
        wyoleg_total_bills: runData.wyoleg_total_bills,
        complete: runData.complete,
        remaining: runData.remaining,
        errors: runData.errors,
      };

      runs.push(runSummary);

      console.log(
        `✅ Run ${i}: synced=${runData.synced_count}, db_total=${runData.db_total_bills}, ` +
        `wyoleg_total=${runData.wyoleg_total_bills}, complete=${runData.complete}`
      );

      if (runData.complete) {
        isComplete = true;
        console.log(`🎉 Completeness achieved on run ${i}!`);
        break;
      }

      // Check if we got fewer bills than limit (indicates end of data)
      if (runData.synced_count < limit && runData.wyoleg_total_bills !== null) {
        console.log(
          `ℹ️  synced=${runData.synced_count} < limit=${limit}, but completeness not yet reached. ` +
          `wyoleg_total=${runData.wyoleg_total_bills}, db_total=${runData.db_total_bills}`
        );
      }
    } catch (err) {
      lastError = err.message;
      console.error(`❌ Run ${i} failed: ${err.message}`);
      runs.push({
        run_number: i,
        error: err.message,
      });
    }
  }

  return new Response(
    JSON.stringify({
      session,
      maxRuns,
      limit,
      totalRuns: runs.length,
      complete: isComplete,
      runs,
      lastError,
    }),
    {
      status: isComplete ? 200 : 206,
      headers: { "Content-Type": "application/json" },
    }
  );
}
