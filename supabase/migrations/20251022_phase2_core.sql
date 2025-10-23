-- Phase 2 Core: SECURITY DEFINER Admin Functions for CI/CD
-- Date: 2025-10-22
-- Purpose: Enable RPC-based backfill, scoring, and view refresh from GitHub Actions
-- Note: Re-created with new timestamp to force reapplication

-- ============================================================================
-- 1. admin_backfill_market_props: Backfill market_props from raw_props
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_backfill_market_props(p_days int DEFAULT 3)
RETURNS TABLE (
  rows_inserted bigint,
  rows_skipped bigint,
  total_market_props bigint
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted bigint := 0;
  v_total bigint := 0;
  v_cutoff_date date;
BEGIN
  -- Calculate cutoff date
  v_cutoff_date := CURRENT_DATE - (p_days || ' days')::interval;
  
  -- Insert from raw_props to market_props
  WITH inserted AS (
    INSERT INTO public.market_props (
      sport, market, selection, line, odds, over_odds, under_odds,
      bookmaker_key, best_book, best_available_line,
      game_date, game_time, player_name, team, opponent,
      external_prop_id, external_game_id, game_id, metadata,
      created_at, updated_at
    )
    SELECT
      COALESCE((rp.metadata->>'sport')::text, rp.sport, 'NFL'),
      COALESCE((rp.metadata->>'market')::text, (rp.metadata->>'market_type')::text, 'player_prop'),
      COALESCE(rp.selection, (rp.metadata->>'selection')::text),
      rp.line,
      rp.odds,
      rp.over_odds,
      rp.under_odds,
      COALESCE((rp.metadata->>'bookmaker_key')::text, (rp.metadata->>'bookmaker')::text, 'unknown'),
      (rp.metadata->>'best_book')::text,
      (rp.metadata->>'best_available_line')::numeric,
      rp.game_date,
      rp.game_time,
      COALESCE((rp.metadata->>'player_name')::text, rp.player_name),
      (rp.metadata->>'team')::text,
      (rp.metadata->>'opponent')::text,
      COALESCE(rp.external_prop_id, 'raw_' || rp.id::text),
      rp.external_game_id,
      rp.game_id,
      rp.metadata,
      NOW(),
      NOW()
    FROM public.raw_props rp
    WHERE rp.game_date >= v_cutoff_date
      AND rp.game_date >= CURRENT_DATE
    ON CONFLICT (bookmaker_key, external_prop_id) 
    DO UPDATE SET
      updated_at = NOW(),
      odds = EXCLUDED.odds,
      over_odds = EXCLUDED.over_odds,
      under_odds = EXCLUDED.under_odds,
      line = EXCLUDED.line,
      metadata = EXCLUDED.metadata
    RETURNING id
  )
  SELECT COUNT(*) INTO v_inserted FROM inserted;
  
  -- Get total count
  SELECT COUNT(*) INTO v_total
  FROM public.market_props
  WHERE game_date >= CURRENT_DATE;
  
  RETURN QUERY SELECT v_inserted, (0)::bigint, v_total;
END;
$$;

COMMENT ON FUNCTION admin_backfill_market_props IS 
'Backfills market_props from raw_props for last N days. SECURITY DEFINER for CI/CD use.';

-- ============================================================================
-- 2. admin_score_batch: Score unscored market props
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_score_batch(p_limit int DEFAULT 5000)
RETURNS TABLE (
  rows_scored bigint,
  rows_remaining bigint
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_scored bigint := 0;
  v_remaining bigint := 0;
BEGIN
  -- Insert scores for unscored props
  WITH to_score AS (
    SELECT mp.id
    FROM public.market_props mp
    LEFT JOIN public.scored_props sp ON sp.prop_ref = mp.id
    WHERE mp.game_date >= CURRENT_DATE
      AND sp.id IS NULL
    LIMIT p_limit
  ),
  inserted AS (
    INSERT INTO public.scored_props (
      prop_ref,
      professional_score,
      tier,
      edge,
      confidence,
      prob_win,
      kelly_fraction,
      clv_pct,
      created_at,
      updated_at
    )
    SELECT
      ts.id,
      55.0,  -- Placeholder score (will be replaced by Enhanced45Factor)
      'B',   -- Placeholder tier
      0.05,  -- Placeholder edge
      0.70,  -- Placeholder confidence
      0.55,  -- Placeholder prob_win
      0.02,  -- Placeholder kelly
      0.03,  -- Placeholder CLV
      NOW(),
      NOW()
    FROM to_score ts
    ON CONFLICT (prop_ref) 
    DO UPDATE SET
      updated_at = NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_scored FROM inserted;
  
  -- Count remaining unscored
  SELECT COUNT(*) INTO v_remaining
  FROM public.market_props mp
  LEFT JOIN public.scored_props sp ON sp.prop_ref = mp.id
  WHERE mp.game_date >= CURRENT_DATE
    AND sp.id IS NULL;
  
  RETURN QUERY SELECT v_scored, v_remaining;
END;
$$;

COMMENT ON FUNCTION admin_score_batch IS 
'Scores a batch of unscored market props. SECURITY DEFINER for CI/CD use.';

-- ============================================================================
-- 3. admin_refresh_views: Refresh materialized views
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_refresh_views()
RETURNS TABLE (
  view_name text,
  rows_count bigint,
  refresh_duration_ms bigint
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_time timestamptz;
  v_end_time timestamptz;
  v_count bigint;
BEGIN
  -- Note: v_prop_read_model and v_daily_board are regular views, not materialized
  -- If they were materialized views, we would refresh them here
  -- For now, just return metadata about the views
  
  -- Check if v_prop_read_model exists and count rows
  v_start_time := clock_timestamp();
  SELECT COUNT(*) INTO v_count FROM public.v_prop_read_model;
  v_end_time := clock_timestamp();
  
  RETURN QUERY SELECT 
    'v_prop_read_model'::text,
    v_count,
    EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::bigint;
  
  -- Check v_daily_board
  v_start_time := clock_timestamp();
  SELECT COUNT(*) INTO v_count FROM public.v_daily_board;
  v_end_time := clock_timestamp();
  
  RETURN QUERY SELECT 
    'v_daily_board'::text,
    v_count,
    EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::bigint;
END;
$$;

COMMENT ON FUNCTION admin_refresh_views IS 
'Refreshes materialized views (or validates regular views). SECURITY DEFINER for CI/CD use.';

-- ============================================================================
-- 4. Grant permissions to service_role
-- ============================================================================
GRANT EXECUTE ON FUNCTION admin_backfill_market_props(int) TO service_role;
GRANT EXECUTE ON FUNCTION admin_score_batch(int) TO service_role;
GRANT EXECUTE ON FUNCTION admin_refresh_views() TO service_role;

-- ============================================================================
-- 5. Ensure views exist (drop and recreate to handle schema changes)
-- ============================================================================
DROP VIEW IF EXISTS public.v_prop_read_model CASCADE;
CREATE VIEW public.v_prop_read_model AS
SELECT 
  mp.id AS prop_ref,
  'market'::TEXT AS source,
  mp.sport,
  mp.market,
  mp.selection,
  mp.line,
  mp.odds,
  sp.edge,
  sp.prob_win,
  sp.professional_score,
  sp.tier,
  pq.status AS queue_status,
  mp.game_date,
  mp.player_name,
  mp.team,
  mp.opponent,
  mp.created_at,
  mp.updated_at
FROM public.market_props mp
LEFT JOIN public.scored_props sp ON sp.prop_ref = mp.id
LEFT JOIN public.promotion_queue pq ON pq.prop_ref = mp.id AND pq.source = 'market'
WHERE mp.game_date >= CURRENT_DATE;

GRANT SELECT ON public.v_prop_read_model TO authenticated, anon, service_role;

DROP VIEW IF EXISTS public.v_daily_board CASCADE;
CREATE VIEW public.v_daily_board AS
SELECT 
  mp.id AS prop_ref,
  mp.sport,
  mp.market,
  mp.selection,
  mp.line,
  mp.odds,
  sp.professional_score,
  sp.tier,
  sp.edge,
  sp.confidence,
  sp.prob_win,
  mp.game_date,
  mp.player_name,
  mp.team,
  mp.opponent,
  mp.created_at
FROM public.market_props mp
INNER JOIN public.scored_props sp ON sp.prop_ref = mp.id
WHERE mp.game_date >= CURRENT_DATE 
  AND sp.tier IN ('S', 'A', 'B')
ORDER BY sp.tier, sp.edge DESC;

GRANT SELECT ON public.v_daily_board TO authenticated, anon, service_role;

-- ============================================================================
-- 6. Reload PostgREST schema cache
-- ============================================================================
NOTIFY pgrst, 'reload schema';

