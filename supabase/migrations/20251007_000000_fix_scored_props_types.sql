-- Fix scored_props column types to NUMERIC
-- Must drop views first, then recreate

-- Drop views temporarily (must drop ALL dependent views before altering table)
DROP VIEW IF EXISTS public.v_daily_board CASCADE;
DROP VIEW IF EXISTS public.v_prop_read_model CASCADE;
DROP VIEW IF EXISTS public.v_open_promotions CASCADE;
DROP VIEW IF EXISTS public.v_command_center_board CASCADE;

-- Fix column types
ALTER TABLE public.scored_props
  ALTER COLUMN edge TYPE NUMERIC USING edge::NUMERIC,
  ALTER COLUMN prob_win TYPE NUMERIC USING prob_win::NUMERIC,
  ALTER COLUMN professional_score TYPE NUMERIC USING professional_score::NUMERIC,
  ALTER COLUMN confidence TYPE NUMERIC USING confidence::NUMERIC,
  ALTER COLUMN kelly_fraction TYPE NUMERIC USING kelly_fraction::NUMERIC,
  ALTER COLUMN clv_pct TYPE NUMERIC USING clv_pct::NUMERIC;

-- Recreate v_daily_board
CREATE OR REPLACE VIEW public.v_daily_board AS
SELECT
  u.id AS prop_id,
  u.sport,
  u.market,
  u.selection,
  u.line,
  u.odds,
  u.game_date,
  u.player_name,
  s.edge,
  s.prob_win,
  s.professional_score,
  s.tier,
  s.confidence,
  s.kelly_fraction,
  s.clv_pct,
  pq.status AS queue_status,
  pq.publish_at,
  pq.approved_by,
  pq.denied_by
FROM public.unified_picks u
LEFT JOIN public.scored_props s ON s.prop_ref = u.id
LEFT JOIN public.promotion_queue pq ON pq.prop_ref = u.id
WHERE u.game_date >= (NOW()::DATE)
ORDER BY
  CASE COALESCE(s.tier,'C')
    WHEN 'S' THEN 0
    WHEN 'A' THEN 1
    WHEN 'B' THEN 2
    WHEN 'C' THEN 3
    ELSE 9
  END,
  s.edge DESC NULLS LAST,
  u.game_date;

-- Recreate v_prop_read_model
CREATE OR REPLACE VIEW public.v_prop_read_model AS
SELECT
  u.id AS prop_ref,
  u.sport,
  u.market,
  u.selection,
  u.line,
  u.odds,
  u.player_name,
  u.game_date,
  s.edge,
  s.prob_win,
  s.professional_score,
  s.tier,
  s.confidence,
  s.kelly_fraction,
  s.clv_pct
FROM public.unified_picks u
LEFT JOIN public.scored_props s ON s.prop_ref = u.id;

-- Recreate v_open_promotions
CREATE OR REPLACE VIEW public.v_open_promotions AS
SELECT
  pq.id AS queue_id,
  pq.prop_ref,
  pq.status,
  pq.publish_at,
  u.sport,
  u.market,
  u.selection,
  u.line,
  u.odds,
  u.player_name,
  u.game_date,
  s.edge,
  s.prob_win,
  s.tier
FROM public.promotion_queue pq
JOIN public.unified_picks u ON u.id = pq.prop_ref
LEFT JOIN public.scored_props s ON s.prop_ref = pq.prop_ref
WHERE pq.status = 'pending'
ORDER BY pq.created_at DESC, s.edge DESC NULLS LAST;

-- Recreate v_command_center_board (using promotion_queue instead of approval_queue)
CREATE OR REPLACE VIEW public.v_command_center_board AS
SELECT
  pq.id AS queue_id,
  pq.status,
  pq.reason,
  pq.created_at AS queued_at,
  pq.approved_by,
  pq.denied_by,
  pq.publish_at,
  u.id AS pick_id,
  u.sport,
  u.market,
  u.selection,
  u.line,
  u.odds,
  u.player_name,
  u.game_date,
  s.edge,
  s.prob_win,
  s.professional_score,
  s.tier,
  s.confidence,
  s.kelly_fraction,
  s.clv_pct
FROM public.promotion_queue pq
JOIN public.unified_picks u ON u.id = pq.prop_ref
LEFT JOIN public.scored_props s ON s.prop_ref = pq.prop_ref
WHERE pq.status IN ('pending', 'approved')
  AND u.game_date >= CURRENT_DATE - INTERVAL '1 day'
ORDER BY
  pq.status ASC,
  s.edge DESC NULLS LAST,
  pq.created_at DESC;

DO $$
BEGIN
  RAISE NOTICE '✅ scored_props column types fixed to NUMERIC and all views recreated';
END $$;
