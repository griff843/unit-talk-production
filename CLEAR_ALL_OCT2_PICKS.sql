-- Clear all Oct 2 picks for fresh full ingestion
DELETE FROM unified_picks
WHERE game_date >= '2025-10-02T04:00:00Z'
  AND game_date < '2025-10-03T04:00:00Z';

-- Verify deletion
SELECT COUNT(*) as remaining_picks
FROM unified_picks
WHERE game_date >= '2025-10-02T04:00:00Z'
  AND game_date < '2025-10-03T04:00:00Z';
-- Expected: 0
