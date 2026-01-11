// worker/src/lib/hotTopicsValidator.mjs
// Hot Topics Validation & Staging Helper
// Validates hot topic records for completeness and stores in staging table

/**
 * Validates a hot topic record for completeness
 * 
 * @param {Object} topic - Topic object from AI analysis
 * @returns {Object} { isComplete: boolean, errors: string[], warnings: string[] }
 */
export function validateTopicRecord(topic) {
  const errors = [];
  const warnings = [];

  // REQUIRED fields (must be present and non-empty)
  if (!topic.slug || typeof topic.slug !== "string" || topic.slug.trim() === "") {
    errors.push("slug: Missing or empty");
  }

  if (!topic.title || typeof topic.title !== "string" || topic.title.trim() === "") {
    errors.push("title: Missing or empty");
  }

  if (typeof topic.confidence !== "number" || topic.confidence < 0 || topic.confidence > 1) {
    errors.push("confidence: Must be a number between 0.0 and 1.0");
  }

  if (!topic.trigger_snippet || typeof topic.trigger_snippet !== "string" || topic.trigger_snippet.trim() === "") {
    errors.push("trigger_snippet: Missing or empty");
  }

  if (!topic.reason_summary || typeof topic.reason_summary !== "string" || topic.reason_summary.trim() === "") {
    errors.push("reason_summary: Missing or empty");
  }

  // RECOMMENDED fields (should be present)
  if (!topic.summary || typeof topic.summary !== "string" || topic.summary.trim() === "") {
    warnings.push("summary: Missing or empty (recommended)");
  }

  // OPTIONAL fields (can be null/empty)
  if (topic.badge && typeof topic.badge !== "string") {
    warnings.push("badge: Should be a string");
  }

  if (topic.priority && (typeof topic.priority !== "number" || topic.priority < 0)) {
    warnings.push("priority: Should be a positive number");
  }

  // Confidence validation: flag very low confidence
  if (topic.confidence && topic.confidence < 0.5) {
    warnings.push(`confidence: Score is low (${topic.confidence}); may need manual review`);
  }

  const isComplete = errors.length === 0;

  return {
    isComplete,
    errors,
    warnings,
  };
}

/**
 * Saves a hot topic to the staging table for review
 * 
 * @param {Object} env - Cloudflare environment (WY_DB)
 * @param {string} billId - civic_items.id
 * @param {Object} topic - Topic object from AI analysis
 * @param {string} aiSource - 'openai' or 'heuristic'
 * @param {string} legislativeSession - Session identifier (e.g., '2026')
 * @returns {Promise<Object>} { success: boolean, stagingId: number, validation: Object }
 */
export async function saveTopicToStaging(env, billId, topic, aiSource = "openai", legislativeSession = null) {
  if (!env.WY_DB) {
    return {
      success: false,
      error: "WY_DB not available",
    };
  }

  const validation = validateTopicRecord(topic);

  try {
    const result = await env.WY_DB.prepare(
      `INSERT INTO hot_topics_staging (
         slug, title, summary, badge, image_url, cta_label, cta_url, priority,
         civic_item_id, confidence, trigger_snippet, reason_summary,
         ai_source, review_status, is_complete, validation_errors,
         legislative_session, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(
      topic.slug || null,
      topic.title || null,
      topic.summary || null,
      topic.badge || null,
      topic.image_url || null,
      topic.cta_label || null,
      topic.cta_url || null,
      topic.priority || 100,
      billId,
      typeof topic.confidence === "number" ? topic.confidence : null,
      topic.trigger_snippet || null,
      topic.reason_summary || null,
      aiSource,
      "pending",
      validation.isComplete ? 1 : 0,
      validation.errors.length > 0 ? JSON.stringify(validation.errors) : null,
      legislativeSession
    ).run();

    return {
      success: true,
      stagingId: result.meta.last_row_id,
      validation,
    };
  } catch (err) {
    console.error(`❌ Failed to insert topic to staging: ${err.message}`);
    return {
      success: false,
      error: err.message,
      validation,
    };
  }
}

/**
 * Get staging table statistics
 * 
 * @param {Object} env - Cloudflare environment
 * @param {string} legislativeSession - Optional session filter
 * @returns {Promise<Object>} Counts by review status
 */
export async function getStagingStats(env, legislativeSession = null) {
  if (!env.WY_DB) {
    return null;
  }

  try {
    const where = legislativeSession
      ? `WHERE legislative_session = '${legislativeSession}'`
      : "";

    const result = await env.WY_DB.prepare(
      `SELECT 
         review_status,
         COUNT(*) as count,
         SUM(CASE WHEN is_complete = 1 THEN 1 ELSE 0 END) as complete_count,
         SUM(CASE WHEN is_complete = 0 THEN 1 ELSE 0 END) as incomplete_count
       FROM hot_topics_staging
       ${where}
       GROUP BY review_status`
    ).all();

    const stats = {};
    for (const row of result.results || []) {
      stats[row.review_status] = {
        total: row.count,
        complete: row.complete_count,
        incomplete: row.incomplete_count,
      };
    }

    return stats;
  } catch (err) {
    console.error(`❌ Failed to get staging stats: ${err.message}`);
    return null;
  }
}

/**
 * Log a review action to the audit table
 * 
 * @param {Object} env - Cloudflare environment
 * @param {number} stagingId - hot_topics_staging.id
 * @param {string} action - 'approved', 'rejected', 'promoted', 'edited', etc.
 * @param {string} previousStatus - Status before this action
 * @param {string} newStatus - Status after this action
 * @param {string} reviewerName - Admin username/email
 * @param {string} notes - Optional notes/comments
 * @returns {Promise<boolean>} Success
 */
export async function logReviewAction(env, stagingId, action, previousStatus, newStatus, reviewerName, notes = null) {
  if (!env.WY_DB) {
    return false;
  }

  try {
    await env.WY_DB.prepare(
      `INSERT INTO hot_topics_review_audit (
         staging_id, action, previous_status, new_status, reviewer_name, action_timestamp, notes
       ) VALUES (?, ?, ?, ?, ?, datetime('now'), ?)`
    ).bind(
      stagingId,
      action,
      previousStatus,
      newStatus,
      reviewerName,
      notes
    ).run();

    return true;
  } catch (err) {
    console.error(`❌ Failed to log review action: ${err.message}`);
    return false;
  }
}

/**
 * Promote an approved staging record to production hot_topics table
 * 
 * @param {Object} env - Cloudflare environment
 * @param {number} stagingId - hot_topics_staging.id
 * @param {string} reviewerName - Admin performing promotion
 * @returns {Promise<Object>} { success: boolean, topic: Object | null, error: string | null }
 */
export async function promoteToProduction(env, stagingId, reviewerName) {
  if (!env.WY_DB) {
    return {
      success: false,
      error: "WY_DB not available",
    };
  }

  try {
    // Fetch the staging record
    const stagingRecord = await env.WY_DB.prepare(
      `SELECT * FROM hot_topics_staging WHERE id = ? AND review_status = 'approved'`
    ).bind(stagingId).first();

    if (!stagingRecord) {
      return {
        success: false,
        error: "Staging record not found or not approved",
      };
    }

    // Validate completeness
    const validation = validateTopicRecord(stagingRecord);
    if (!validation.isComplete) {
      return {
        success: false,
        error: "Record is incomplete: " + validation.errors.join("; "),
      };
    }

    // Insert or update in production table
    await env.WY_DB.prepare(
      `INSERT OR REPLACE INTO hot_topics (
         slug, title, summary, badge, image_url, cta_label, cta_url, priority, is_active, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))`
    ).bind(
      stagingRecord.slug,
      stagingRecord.title,
      stagingRecord.summary,
      stagingRecord.badge,
      stagingRecord.image_url,
      stagingRecord.cta_label,
      stagingRecord.cta_url,
      stagingRecord.priority,
      stagingRecord.created_at
    ).run();

    // Mark staging as promoted
    await env.WY_DB.prepare(
      `UPDATE hot_topics_staging SET review_status = 'promoted', updated_at = datetime('now') WHERE id = ?`
    ).bind(stagingId).run();

    // Log the action
    await logReviewAction(env, stagingId, "promoted", "approved", "promoted", reviewerName);

    return {
      success: true,
      topic: stagingRecord,
    };
  } catch (err) {
    console.error(`❌ Failed to promote staging record: ${err.message}`);
    return {
      success: false,
      error: err.message,
    };
  }
}
