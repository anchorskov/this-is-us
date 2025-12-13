-- Migration: 0015_update_whitehall_coordinates
-- Purpose: Update WHITE HALL addresses at University of Wyoming with known coordinates
-- Date: December 9, 2025
-- Context: WHITE HALL variants (WHITE HALL, WHITE HALL A, WHITE HALL B, etc.) are dormitory 
--          buildings at University of Wyoming in Laramie that don't have standard street addresses.
--          Using primary campus location coordinates.

-- Update all WHITE HALL variants in Laramie to University of Wyoming coordinates
UPDATE voters_addr_norm 
SET lat = 41.314007, lng = -105.584905 
WHERE addr1 LIKE '%WHITE HALL%' AND city = 'LARAMIE';

-- Verify the update
-- SELECT COUNT(*) as updated_records FROM voters_addr_norm 
-- WHERE lat = 41.314007 AND lng = -105.584905 AND city = 'LARAMIE';
