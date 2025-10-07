-- Fix ALL outcome columns across all sports - recalculate based on actual_value vs line
-- This ensures data integrity for ML training

-- Fix outcomes for ALL sports
UPDATE settled_outcomes
SET outcome = CASE
  WHEN actual_value > line THEN 'win'
  WHEN actual_value <= line THEN 'loss'
  ELSE outcome  -- Keep as-is for push/void/etc
END
WHERE actual_value IS NOT NULL
  AND outcome IN ('win', 'loss');  -- Only fix win/loss, not push/void

-- Verify the fix for each sport
SELECT
  sport,
  outcome,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY sport), 1) as percentage
FROM settled_outcomes
WHERE actual_value IS NOT NULL
  AND game_date >= '2024-01-01'
  AND outcome IN ('win', 'loss')
GROUP BY sport, outcome
ORDER BY sport, outcome;
