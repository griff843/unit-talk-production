-- Fix NFL outcome column - recalculate based on actual_value vs line
-- Bug: All NFL outcomes from 2025-10-05 were incorrectly set to 'loss'
-- Should be: 'win' if actual_value > line, 'loss' if actual_value <= line

UPDATE settled_outcomes
SET outcome = CASE
  WHEN actual_value > line THEN 'win'
  WHEN actual_value <= line THEN 'loss'
  ELSE outcome  -- Keep as-is for push/void/etc
END
WHERE sport = 'NFL'
  AND actual_value IS NOT NULL
  AND game_date >= '2024-01-01'
  AND outcome IN ('win', 'loss');  -- Only fix win/loss, not push/void

-- Verify the fix
SELECT
  sport,
  outcome,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as percentage
FROM settled_outcomes
WHERE sport = 'NFL'
  AND actual_value IS NOT NULL
  AND game_date >= '2024-01-01'
  AND outcome IN ('win', 'loss')
GROUP BY sport, outcome
ORDER BY outcome;
