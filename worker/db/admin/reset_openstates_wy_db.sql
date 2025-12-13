/**
 * Reset OpenStates-derived bills from WY_DB only.
 * 
 * ⚠️  WARNING: This script DELETES DATA.
 * 
 * Delete order (respecting FK constraints):
 *   1. votes (target_type='civic_item')
 *   2. bill_sponsors
 *   3. civic_item_ai_tags
 *   4. civic_items (source='open_states')
 */

-- Step 1: Delete votes for civic_items from Wyoming OpenStates bills
DELETE FROM votes
WHERE target_type = 'civic_item'
  AND target_id IN (
    SELECT id FROM civic_items
    WHERE source = 'open_states'
      AND jurisdiction_key = 'WY'
  );

-- Step 2: Delete bill sponsors for Wyoming OpenStates bills
DELETE FROM bill_sponsors
WHERE civic_item_id IN (
  SELECT id FROM civic_items
  WHERE source = 'open_states'
    AND jurisdiction_key = 'WY'
);

-- Step 3: Delete civic_item_ai_tags for Wyoming OpenStates bills
DELETE FROM civic_item_ai_tags
WHERE item_id IN (
  SELECT id FROM civic_items
  WHERE source = 'open_states'
    AND jurisdiction_key = 'WY'
);

-- Step 4: Delete the bills themselves
DELETE FROM civic_items
WHERE source = 'open_states'
  AND jurisdiction_key = 'WY';

-- Verification: Check remaining count
SELECT COUNT(*) as remaining_openstates_bills FROM civic_items WHERE source = 'open_states';
