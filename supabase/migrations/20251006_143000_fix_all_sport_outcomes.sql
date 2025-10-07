-- Migration: Fix outcome calculation for all sports
-- Issue: NFL (and potentially other sports) have incorrect outcome values
-- All outcomes should be calculated as: actual_value > line = 'win', else 'loss'
-- This is idempotent and safe to re-run

BEGIN;

-- Fix outcomes for ALL sports based on actual_value vs line
UPDATE settled_outcomes
SET outcome = CASE
  WHEN actual_value > line THEN 'win'
  WHEN actual_value <= line THEN 'loss'
  ELSE outcome  -- Preserve push/void/pending
END
WHERE actual_value IS NOT NULL
  AND outcome IN ('win', 'loss');

-- Log the fix
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Fixed % outcome records', affected_count;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;

-- Verification query (run separately after migration)
-- SELECT
--   sport,
--   outcome,
--   COUNT(*) as count,
--   ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY sport), 1) as percentage
-- FROM settled_outcomes
-- WHERE actual_value IS NOT NULL
--   AND game_date >= '2024-01-01'
--   AND outcome IN ('win', 'loss')
-- GROUP BY sport, outcome
-- ORDER BY sport, outcome;
