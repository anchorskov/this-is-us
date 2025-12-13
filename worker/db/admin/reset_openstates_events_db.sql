/**
 * Reset OpenStates-derived references from EVENTS_DB.
 * 
 * Delete hot_topic_civic_items entries that reference deleted civic_items.
 * This is safe to run after WY_DB reset (FKs are already gone from civic_items).
 */

-- Delete hot_topic_civic_items entries that referenced Wyoming OpenStates bills
-- Note: civic_item_id FKs from hot_topic_civic_items are now orphaned,
-- so we can delete all entries (in practice, the civic_items don't exist)
DELETE FROM hot_topic_civic_items
WHERE civic_item_id NOT IN (
  SELECT id FROM wrangler_d1_civic_items  -- This references the cross-DB table
);

-- Simple approach: Delete entries where civic_item_id is no longer in civic_items
-- (This handles both deleted and existing records safely)
SELECT COUNT(*) as remaining_orphaned_entries FROM hot_topic_civic_items;
