-- Clear 49ers vs Rams picks for clean test
DELETE FROM unified_picks
WHERE external_game_id = 'c4b72eabb3d557e73022ec730d8e3944';

-- Verify deletion
SELECT COUNT(*) as remaining_picks
FROM unified_picks
WHERE external_game_id = 'c4b72eabb3d557e73022ec730d8e3944';
-- Expected: 0
