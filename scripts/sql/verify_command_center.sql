-- ================================================================
-- Command Center Verification Checks
-- ================================================================
-- Verifies the Command Center is properly wired to read-models

-- Check 1: Board has rows for today+
SELECT count(*) > 0 AS board_has_rows
FROM public.v_daily_board
WHERE game_date >= now()::date;

-- Check 2: Feed has rows for today+
SELECT count(*) > 0 AS feed_has_rows
FROM public.v_prop_read_model
WHERE game_date >= now()::date;

-- Check 3: Recent scoring (last 2 hours)
SELECT count(*) > 0 AS recent_scoring
FROM public.scored_props
WHERE updated_at >= now() - interval '2 hours';

-- Check 4: Last 5 approved in promotion_queue
SELECT
  id,
  prop_ref,
  status,
  publish_at,
  approved_by,
  created_at
FROM public.promotion_queue
WHERE status = 'approved'
ORDER BY publish_at DESC NULLS LAST
LIMIT 5;
