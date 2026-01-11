/**
 * worker/src/routes/adminHotTopics.mjs
 * 
 * Admin endpoints for hot topics draft review and publishing workflow.
 * All endpoints require Firebase auth + admin role (roleLevel >= 50).
 * 
 * Endpoints:
 *   GET /api/admin/hot-topics/drafts - List draft topics with linked bills
 *   POST /api/admin/hot-topics/drafts/:topicId - Edit draft topic
 *   POST /api/admin/hot-topics/publish - Publish approved topics to live tables
 *   POST /api/admin/hot-topics/reject - Reject/delete draft topic
 */

import { requireAuth } from '../auth/verifyFirebaseOrAccess.mjs';
import { hasColumn } from "../lib/dbHelpers.mjs";

/**
 * GET /api/admin/hot-topics/drafts
 * 
 * Returns all draft topics with:
 *   - Draft topic metadata
 *   - Count of linked bills
 *   - Average confidence score
 *   - List of linked bills (bill_number, title, ai_summary, official_url, confidence, source_run_id)
 * 
 * Query params:
 *   - status: filter by status (draft, approved, rejected, published) - optional
 *   - session: filter by legislative_session from civic_items - optional
 */
export async function handleListDraftTopics(request, env) {
  try {
    // Verify auth (Firebase or Cloudflare Access)
    // In production, role check happens in middleware; in dev, all authenticated users can access admin endpoints
    const user = await requireAuth(request, env);
    if (!user || !user.uid) {
      return new Response(JSON.stringify({ error: 'Unauthenticated' }), { status: 401 });
    }

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status') || null;
    const sessionFilter = url.searchParams.get('session') || null;

    // Build query for draft topics
    let query = 'SELECT * FROM hot_topics_draft WHERE 1=1';
    const params = [];

    if (statusFilter) {
      query += ' AND status = ?';
      params.push(statusFilter);
    }

    query += ' ORDER BY created_at DESC';

    const drafts = await env.WY_DB.prepare(query).bind(...params).all();

    // For each draft, fetch linked bills and aggregate stats
    const results = [];
    for (const draft of drafts.results || []) {
      const linkedBillsResult = await env.WY_DB.prepare(`
        SELECT
          ci.id as civic_item_id,
          ci.bill_number,
          ci.title,
          ci.ai_summary,
          COALESCE(ci.external_url, ci.text_url) AS official_url,
          dtci.confidence,
          dtci.trigger_snippet,
          dtci.reason_summary,
          ci.legislative_session
        FROM hot_topic_civic_items_draft dtci
        JOIN civic_items ci ON dtci.civic_item_id = ci.id
        WHERE dtci.topic_id = ?
        ORDER BY dtci.sort_order ASC, ci.bill_number ASC
      `).bind(draft.id).all();

      const linkedBills = (linkedBillsResult.results || [])
        .filter(bill => !sessionFilter || bill.legislative_session === sessionFilter);

      const avgConfidence = linkedBills.length > 0
        ? linkedBills.reduce((sum, b) => sum + (b.confidence || 0), 0) / linkedBills.length
        : draft.confidence || 0;

      results.push({
        id: draft.id,
        slug: draft.slug,
        title: draft.title,
        summary: draft.summary,
        badge: draft.badge,
        imageUrl: draft.image_url,
        ctaLabel: draft.cta_label,
        ctaUrl: draft.cta_url,
        priority: draft.priority,
        officialUrl: draft.official_url,
        status: draft.status,
        invalidated: draft.invalidated ?? 0,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        linkedBillCount: linkedBills.length,
        sourceRunId: draft.source_run_id,
        aiSource: draft.ai_source,
        reviewedAt: draft.reviewed_at,
        reviewedBy: draft.reviewed_by,
        reviewerNotes: draft.reviewer_notes,
        createdAt: draft.created_at,
        updatedAt: draft.updated_at,
        linkedBills: linkedBills.map(b => ({
          civicItemId: b.civic_item_id,
          billNumber: b.bill_number,
          title: b.title,
          aiSummary: b.ai_summary,
          officialUrl: b.official_url,
          confidence: b.confidence,
          triggerSnippet: b.trigger_snippet,
          reasonSummary: b.reason_summary,
          legislativeSession: b.legislative_session
        }))
      });
    }

    return new Response(JSON.stringify({ drafts: results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    if (err instanceof Response) {
      return err;
    }
    console.error('Error listing draft topics:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

/**
 * POST /api/admin/hot-topics/drafts/:topicId
 * 
 * Edit a draft topic or manage its linked bills.
 * 
 * Body:
 *   - title?: string - Update topic title
 *   - slug?: string - Update slug
 *   - summary?: string - Update summary
 *   - badge?: string - Update badge
 *   - imageUrl?: string - Update image URL
 *   - ctaLabel?: string - Update CTA label
 *   - ctaUrl?: string - Update CTA URL
 *   - priority?: number - Update priority
 *   - removeLinkedBillIds?: string[] - Civic item IDs to unlink
 *   - reorderLinkedBills?: { civicItemId: string, sortOrder: number }[] - Reorder linked bills
 */
export async function handleEditDraftTopic(request, env, { topicId }) {
  try {
    const user = await requireAuth(request, env);
    if (!user || !user.uid) {
      return new Response(JSON.stringify({ error: 'Unauthenticated' }), { status: 401 });
    }

    const body = await request.json();
    const hasInvalidated = await hasColumn(env.WY_DB, "hot_topics_draft", "invalidated");

    // Verify topic exists
    const topic = await env.WY_DB.prepare(
      'SELECT id FROM hot_topics_draft WHERE id = ?'
    ).bind(topicId).first();

    if (!topic) {
      return new Response(JSON.stringify({ error: 'Topic not found' }), { status: 404 });
    }

    // Update topic fields if provided
    if (body.title || body.slug || body.summary || body.badge || body.imageUrl ||
        body.ctaLabel || body.ctaUrl || body.priority !== undefined || (hasInvalidated && body.invalidated !== undefined)) {
      const updateFields = [];
      const updateValues = [];

      if (body.title !== undefined) {
        updateFields.push('title = ?');
        updateValues.push(body.title);
      }
      if (body.slug !== undefined) {
        updateFields.push('slug = ?');
        updateValues.push(body.slug);
      }
      if (body.summary !== undefined) {
        updateFields.push('summary = ?');
        updateValues.push(body.summary);
      }
      if (body.badge !== undefined) {
        updateFields.push('badge = ?');
        updateValues.push(body.badge);
      }
      if (body.imageUrl !== undefined) {
        updateFields.push('image_url = ?');
        updateValues.push(body.imageUrl);
      }
      if (body.ctaLabel !== undefined) {
        updateFields.push('cta_label = ?');
        updateValues.push(body.ctaLabel);
      }
      if (body.ctaUrl !== undefined) {
        updateFields.push('cta_url = ?');
        updateValues.push(body.ctaUrl);
      }
      if (body.priority !== undefined) {
        updateFields.push('priority = ?');
        updateValues.push(body.priority);
      }
      if (body.officialUrl !== undefined) {
        updateFields.push('official_url = ?');
        updateValues.push(body.officialUrl);
      }
      if (hasInvalidated && body.invalidated !== undefined) {
        updateFields.push('invalidated = ?');
        updateValues.push(body.invalidated ? 1 : 0);
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(topicId);

      await env.WY_DB.prepare(
        `UPDATE hot_topics_draft SET ${updateFields.join(', ')} WHERE id = ?`
      ).bind(...updateValues).run();
    }

    // Handle linked bill removals
    if (Array.isArray(body.removeLinkedBillIds) && body.removeLinkedBillIds.length > 0) {
      for (const civicItemId of body.removeLinkedBillIds) {
        await env.WY_DB.prepare(
          'DELETE FROM hot_topic_civic_items_draft WHERE topic_id = ? AND civic_item_id = ?'
        ).bind(topicId, civicItemId).run();
      }
    }

    // Handle reordering
    if (Array.isArray(body.reorderLinkedBills)) {
      for (const link of body.reorderLinkedBills) {
        await env.WY_DB.prepare(
          'UPDATE hot_topic_civic_items_draft SET sort_order = ? WHERE topic_id = ? AND civic_item_id = ?'
        ).bind(link.sortOrder, topicId, link.civicItemId).run();
      }
    }

    // Return updated topic
    const updated = await env.WY_DB.prepare(
      'SELECT * FROM hot_topics_draft WHERE id = ?'
    ).bind(topicId).first();

    return new Response(JSON.stringify({ topic: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    if (err instanceof Response) {
      return err;
    }
    console.error('Error editing draft topic:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

/**
 * POST /api/admin/hot-topics/publish
 * 
 * Publish (move to live tables) one or more approved draft topics.
 * 
 * Body:
 *   - topicIds: number[] - IDs of draft topics to publish
 *   - publisherName: string - Name of person approving (for audit)
 */
export async function handlePublishTopics(request, env) {
  try {
    const user = await requireAuth(request, env);
    if (!user || !user.uid) {
      return new Response(JSON.stringify({ error: 'Unauthenticated' }), { status: 401 });
    }

    const body = await request.json();
    const { topicIds = [], publisherName = 'Unknown' } = body;
    const hasInvalidated = await hasColumn(env.WY_DB, "hot_topics", "invalidated");

    if (!Array.isArray(topicIds) || topicIds.length === 0) {
      return new Response(JSON.stringify({ error: 'No topic IDs provided' }), { status: 400 });
    }

    const results = {
      published: [],
      errors: []
    };

    for (const topicId of topicIds) {
      try {
        // Get draft topic
        const draft = await env.WY_DB.prepare(
          'SELECT * FROM hot_topics_draft WHERE id = ? AND status = ?'
        ).bind(topicId, 'approved').first();

        if (!draft) {
          results.errors.push({ topicId, error: 'Not found or not approved' });
          continue;
        }

        // Insert/upsert into live hot_topics table (assuming table exists)
        // On conflict, update the fields
        const insertColumns = [
          "slug",
          "title",
          "summary",
          "badge",
          "image_url",
          "cta_label",
          "cta_url",
          "priority",
          "official_url"
        ];
        const insertValues = [
          draft.slug,
          draft.title,
          draft.summary,
          draft.badge,
          draft.image_url,
          draft.cta_label,
          draft.cta_url,
          draft.priority,
          draft.official_url
        ];
        const updateAssignments = [
          "title = excluded.title",
          "summary = excluded.summary",
          "badge = excluded.badge",
          "image_url = excluded.image_url",
          "cta_label = excluded.cta_label",
          "cta_url = excluded.cta_url",
          "priority = excluded.priority",
          "official_url = excluded.official_url",
          "updated_at = CURRENT_TIMESTAMP"
        ];

        if (hasInvalidated) {
          insertColumns.push("invalidated");
          insertValues.push(draft.invalidated ? 1 : 0);
          updateAssignments.push("invalidated = excluded.invalidated");
        }

        const insertSql = `
          INSERT INTO hot_topics (
            ${insertColumns.join(", ")}, created_at, updated_at
          ) VALUES (${insertColumns.map(() => "?").join(", ")}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(slug) DO UPDATE SET
            ${updateAssignments.join(", ")}
        `;

        await env.WY_DB.prepare(insertSql)
          .bind(...insertValues)
          .run();

        // Get the live topic ID
        const liveTopic = await env.WY_DB.prepare(
          'SELECT id FROM hot_topics WHERE slug = ?'
        ).bind(draft.slug).first();

        if (!liveTopic) {
          results.errors.push({ topicId, error: 'Failed to insert live topic' });
          continue;
        }

        // Copy linked bills from draft to live
        const draftLinks = await env.WY_DB.prepare(
          'SELECT civic_item_id, confidence, trigger_snippet, reason_summary, sort_order FROM hot_topic_civic_items_draft WHERE topic_id = ?'
        ).bind(topicId).all();

        for (const link of draftLinks.results || []) {
          await env.WY_DB.prepare(`
            INSERT INTO hot_topic_civic_items (topic_id, civic_item_id, confidence, trigger_snippet, reason_summary, sort_order, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(topic_id, civic_item_id) DO UPDATE SET
              confidence = excluded.confidence,
              trigger_snippet = excluded.trigger_snippet,
              reason_summary = excluded.reason_summary,
              sort_order = excluded.sort_order
          `).bind(
            liveTopic.id,
            link.civic_item_id,
            link.confidence,
            link.trigger_snippet,
            link.reason_summary,
            link.sort_order
          ).run();
        }

        // Update draft status to published
        await env.WY_DB.prepare(
          'UPDATE hot_topics_draft SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind('published', publisherName, topicId).run();

        results.published.push(topicId);
      } catch (err) {
        console.error(`Error publishing topic ${topicId}:`, err);
        results.errors.push({ topicId, error: err.message });
      }
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    if (err instanceof Response) {
      return err;
    }
    console.error('Error publishing topics:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

/**
 * POST /api/admin/hot-topics/reject
 * 
 * Reject (mark as rejected) a draft topic.
 * 
 * Body:
 *   - topicId: number - ID of draft topic to reject
 *   - reason: string - Reason for rejection
 *   - reviewerName: string - Name of person rejecting
 */
export async function handleRejectTopic(request, env) {
  try {
    const user = await requireAuth(request, env);
    if (!user || !user.uid) {
      return new Response(JSON.stringify({ error: 'Unauthenticated' }), { status: 401 });
    }

    const body = await request.json();
    const { topicId, reason = '', reviewerName = 'Unknown' } = body;

    if (!topicId) {
      return new Response(JSON.stringify({ error: 'Topic ID required' }), { status: 400 });
    }

    // Update draft topic status
    await env.WY_DB.prepare(`
      UPDATE hot_topics_draft
      SET status = ?, reviewer_notes = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind('rejected', reason, reviewerName, topicId).run();

    return new Response(JSON.stringify({ success: true, topicId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    if (err instanceof Response) {
      return err;
    }
    console.error('Error rejecting topic:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

/**
 * POST /api/admin/hot-topics/approve
 * 
 * Approve a draft topic (mark for publishing).
 * 
 * Body:
 *   - topicId: number - ID of draft topic to approve
 *   - reviewerName: string - Name of person approving
 */
export async function handleApproveTopic(request, env) {
  try {
    const user = await requireAuth(request, env);
    if (!user || !user.uid) {
      return new Response(JSON.stringify({ error: 'Unauthenticated' }), { status: 401 });
    }

    const body = await request.json();
    const { topicId, reviewerName = 'Unknown' } = body;

    if (!topicId) {
      return new Response(JSON.stringify({ error: 'Topic ID required' }), { status: 400 });
    }

    // Update draft topic status
    await env.WY_DB.prepare(`
      UPDATE hot_topics_draft
      SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind('approved', reviewerName, topicId).run();

    return new Response(JSON.stringify({ success: true, topicId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    if (err instanceof Response) {
      return err;
    }
    console.error('Error approving topic:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
