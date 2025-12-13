/**
 * Reset OpenStates-derived pending bills from D1 databases.
 * 
 * ⚠️  WARNING: This script DELETES DATA.
 * 
 * Purpose: Remove all bill data imported from OpenStates so that sync can start fresh.
 * Schema: Unchanged (no table drops, no migrations).
 * Data Scope: Targets source='open_states' records across WY_DB and EVENTS_DB.
 * 
 * Safe to run multiple times (idempotent DELETE queries).
 * 
 * Order of deletion:
 *   1. votes (WY_DB) - rows referencing civic_items via target_id
 *   2. bill_sponsors (WY_DB) - rows referencing civic_items
 *   3. civic_item_ai_tags (WY_DB) - AI analysis linked to civic_items
 *   4. hot_topic_civic_items (EVENTS_DB) - junction links to civic_items
 *   5. civic_items (WY_DB) - root bill table
 * 
 * Two deletion strategies:
 * 
 * STRATEGY A (SCOPED - DEFAULT): Wyoming + 2025 session only
 * - Keeps other sessions if they exist
 * - Lower risk during testing
 * - Can be re-run without losing multi-session data
 * 
 * STRATEGY B (FULL WIPE): All source='open_states' bills
 * - Complete reset regardless of jurisdiction or session
 * - Use only if data is corrupted or you want blank slate
 * - Uncomment to use
 */

-- ============================================================================
-- STRATEGY A: Scoped Reset (Wyoming + 2025 session)
-- ============================================================================

-- Step 1: Delete AI tags for Wyoming 2025 bills
-- (WY_DB) - civic_item_ai_tags.item_id references civic_items.id
DELETE FROM civic_item_ai_tags
WHERE item_id IN (
  SELECT id FROM civic_items
  WHERE source = 'open_states'
    AND jurisdiction_key = 'WY'
    AND legislative_session = '2025'
);

-- Step 2: Delete verification results for Wyoming 2025 bills
-- (WY_DB) - civic_item_verification.civic_item_id references civic_items.id
DELETE FROM civic_item_verification
WHERE civic_item_id IN (
  SELECT id FROM civic_items
  WHERE source = 'open_states'
    AND jurisdiction_key = 'WY'
    AND legislative_session = '2025'
);

-- Step 3: Delete civic_items (Wyoming 2025, OpenStates source)
-- (WY_DB) - root bill table
DELETE FROM civic_items
WHERE source = 'open_states'
  AND jurisdiction_key = 'WY'
  AND legislative_session = '2025';


-- ============================================================================
-- STRATEGY B (COMMENTED OUT): Full Wipe - All OpenStates Bills
-- ============================================================================
-- Uncomment below to delete ALL OpenStates-derived bills regardless of session.
-- Use only if you want a complete blank slate.

/*
-- Delete all votes for any OpenStates-derived civic_item
DELETE FROM votes
WHERE target_type = 'civic_item'
  AND target_id IN (
    SELECT id FROM civic_items WHERE source = 'open_states'
  );

-- Delete all sponsors for OpenStates bills
DELETE FROM bill_sponsors
WHERE civic_item_id IN (
  SELECT id FROM civic_items WHERE source = 'open_states'
);

-- Delete all AI tags for OpenStates bills
DELETE FROM civic_item_ai_tags
WHERE item_id IN (
  SELECT id FROM civic_items WHERE source = 'open_states'
);

-- Delete all verification results for OpenStates bills
DELETE FROM civic_item_verification
WHERE civic_item_id IN (
  SELECT id FROM civic_items WHERE source = 'open_states'
);

-- Delete all civic_items from OpenStates
DELETE FROM civic_items WHERE source = 'open_states';

-- NOTE: To delete related tables from other databases, run separately:
-- votes table (if exists): DELETE FROM votes WHERE target_type = 'civic_item' AND target_id IN (SELECT id FROM civic_items WHERE source = 'open_states');
-- bill_sponsors table (if exists): DELETE FROM bill_sponsors WHERE civic_item_id IN (SELECT id FROM civic_items WHERE source = 'open_states');
-- hot_topic_civic_items (EVENTS_DB): DELETE FROM hot_topic_civic_items WHERE civic_item_id IN (SELECT id FROM civic_items WHERE source = 'open_states');
*/

-- ============================================================================
-- End of reset script
-- ============================================================================
