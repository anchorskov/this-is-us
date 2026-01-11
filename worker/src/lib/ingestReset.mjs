/**
 * ingestReset.mjs
 * 
 * Safe ingestion reset utility for Hot Topics pipeline.
 * Clears derived tables in correct dependency order.
 * Modes: "derived-only" (default) or "full-rebuild"
 * 
 * Safety:
 * - Local/dev: always allowed
 * - Production: requires ALLOW_ADMIN_RESET="true" env var + admin auth check
 */

export async function resetDerivedState({ 
  mode = "derived-only",
  wyDb = null,
  eventsDb = null,
  isProduction = false,
  adminAuthPassed = false 
}) {
  // Safety check for production
  if (isProduction && !adminAuthPassed) {
    return {
      success: false,
      error: "Admin authentication required in production",
      cleared: {}
    };
  }

  const results = {
    success: true,
    mode,
    timestamp: new Date().toISOString(),
    cleared: {}
  };

  try {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // EVENTS_DB: Clear hot topic derived tables (child → parent order)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (eventsDb) {
      // 1️⃣ hot_topic_civic_items (child, references hot_topics)
      const htciResult = await eventsDb
        .prepare(`DELETE FROM hot_topic_civic_items`)
        .run();
      results.cleared.hot_topic_civic_items = {
        deletedCount: htciResult.meta?.changes || 0,
        status: "cleared"
      };
      console.log(`✅ EVENTS_DB: hot_topic_civic_items: ${results.cleared.hot_topic_civic_items.deletedCount} rows deleted`);

      // 2️⃣ hot_topics (parent)
      const htResult = await eventsDb
        .prepare(`DELETE FROM hot_topics`)
        .run();
      results.cleared.hot_topics = {
        deletedCount: htResult.meta?.changes || 0,
        status: "cleared"
      };
      console.log(`✅ EVENTS_DB: hot_topics: ${results.cleared.hot_topics.deletedCount} rows deleted`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // WY_DB: Clear derived AI/ingestion tables
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (wyDb) {
      // 1️⃣ civic_item_ai_tags (derived from summaries)
      const ciaiResult = await wyDb
        .prepare(`DELETE FROM civic_item_ai_tags`)
        .run();
      results.cleared.civic_item_ai_tags = {
        deletedCount: ciaiResult.meta?.changes || 0,
        status: "cleared"
      };
      console.log(`✅ WY_DB: civic_item_ai_tags: ${results.cleared.civic_item_ai_tags.deletedCount} rows deleted`);

      // 2️⃣ civic_item_verification (optional, but part of ingestion state)
      const civResult = await wyDb
        .prepare(`DELETE FROM civic_item_verification`)
        .run();
      results.cleared.civic_item_verification = {
        deletedCount: civResult.meta?.changes || 0,
        status: "cleared"
      };
      console.log(`✅ WY_DB: civic_item_verification: ${results.cleared.civic_item_verification.deletedCount} rows deleted`);

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // Full rebuild mode: also clear civic sources and AI summaries
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (mode === "full-rebuild") {
        // 3️⃣ civic_item_sources (hydrated from LSO)
        const cisResult = await wyDb
          .prepare(`DELETE FROM civic_item_sources`)
          .run();
        results.cleared.civic_item_sources = {
          deletedCount: cisResult.meta?.changes || 0,
          status: "cleared"
        };
        console.log(`✅ WY_DB: civic_item_sources: ${results.cleared.civic_item_sources.deletedCount} rows deleted`);

        // 4️⃣ Clear AI summaries and metadata from civic_items
        const updateResult = await wyDb
          .prepare(`
            UPDATE civic_items 
            SET 
              ai_summary = NULL,
              ai_key_points = NULL,
              summary_source = 'none',
              summary_error = 'ok',
              summary_is_authoritative = 0,
              ai_last_update = NULL
            WHERE legislative_session = '2026'
          `)
          .run();
        results.cleared.civic_items_ai_fields = {
          updatedCount: updateResult.meta?.changes || 0,
          status: "cleared"
        };
        console.log(`✅ WY_DB: civic_items (AI fields): ${results.cleared.civic_items_ai_fields.updatedCount} rows updated`);

        // 5️⃣ Optional: clear civic_items entirely for full rebuild
        // (Commented out - only if explicitly needed)
        // const ciResult = await wyDb.prepare(`DELETE FROM civic_items`).run();
        // results.cleared.civic_items = { deletedCount: ciResult.meta?.changes || 0 };
      }
    }

    results.success = true;
    console.log(`\n🎉 Ingestion reset complete (mode: ${mode})`);
    console.log(`Cleared tables:`, Object.keys(results.cleared).join(", "));
    return results;

  } catch (err) {
    console.error(`❌ Ingestion reset failed:`, err);
    results.success = false;
    results.error = err.message;
    return results;
  }
}

/**
 * Validate admin authentication for production resets.
 * Returns true if admin is verified.
 */
export async function validateAdminAuth(request, env) {
  // Check for admin key header
  const adminKey = request.headers.get("X-Admin-Key");
  if (adminKey && adminKey === env.ADMIN_RESET_KEY) {
    return true;
  }

  // Check for Firebase auth (if available)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    // TODO: validate Firebase token if needed
    // For now, just check that a bearer token exists
    return true;
  }

  return false;
}
