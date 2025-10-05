-- ============================================================================
-- Cloud Delta Migration: Align Pipeline Schema & Fix Game ID Mapping
-- Date: October 8, 2025
-- Purpose: Production-safe schema alignment for raw_props → unified_picks → scored_props
-- ============================================================================

-- DECISION: Option A (Preferred) - Use game_id UUID with proper foreign keys
-- The Cloud schema already has both game_id (UUID FK) and external_game_id (TEXT)
-- We'll ensure the pipeline populates both correctly

-- ============================================================================
-- 1. ENSURE CRITICAL INDEXES (Idempotent)
-- ============================================================================

-- raw_props performance indexes
CREATE INDEX IF NOT EXISTS idx_raw_props_game_date
  ON public.raw_props(game_date DESC);

CREATE INDEX IF NOT EXISTS idx_raw_props_external_prop_id
  ON public.raw_props(external_prop_id)
  WHERE external_prop_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_raw_props_bookmaker_key
  ON public.raw_props(bookmaker_key)
  WHERE bookmaker_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_raw_props_promoted
  ON public.raw_props(promoted_to_picks, created_at DESC)
  WHERE promoted_to_picks = FALSE;

-- unified_picks performance indexes
CREATE INDEX IF NOT EXISTS idx_unified_picks_game_date
  ON public.unified_picks(game_date DESC);

CREATE INDEX IF NOT EXISTS idx_unified_picks_external_prop_id
  ON public.unified_picks(external_prop_id)
  WHERE external_prop_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_unified_picks_source_market
  ON public.unified_picks(source, market, game_date DESC);

CREATE INDEX IF NOT EXISTS idx_unified_picks_scored
  ON public.unified_picks(scored_at)
  WHERE scored_at IS NULL;

-- scored_props performance indexes
CREATE INDEX IF NOT EXISTS idx_scored_props_prop_ref
  ON public.scored_props(prop_ref);

CREATE INDEX IF NOT EXISTS idx_scored_props_tier
  ON public.scored_props(tier, edge DESC)
  WHERE tier IN ('S', 'A', 'B');

CREATE INDEX IF NOT EXISTS idx_scored_props_updated
  ON public.scored_props(updated_at DESC);

-- ============================================================================
-- 2. REFRESH MATERIALIZED VIEWS (If they exist as materialized)
-- ============================================================================

-- Check and refresh if materialized
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_matviews
    WHERE schemaname = 'public' AND matviewname = 'v_prop_read_model'
  ) THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_prop_read_model;
  END IF;
END $$;

-- ============================================================================
-- 3. RECREATE/UPDATE VIEWS (Idempotent - CREATE OR REPLACE)
-- ============================================================================

-- v_prop_read_model: Feed for Command Center
CREATE OR REPLACE VIEW public.v_prop_read_model AS
SELECT
  rp.id,
  rp.external_prop_id,
  rp.game_id,
  rp.external_game_id,
  rp.sport,
  rp.market,
  rp.player_name,
  rp.stat_type,
  rp.line,
  rp.odds,
  rp.over_odds,
  rp.under_odds,
  rp.game_date,
  rp.home_team,
  rp.away_team,
  rp.bookmaker_key,
  rp.bookmaker_title,
  rp.metadata,
  rp.created_at,
  rp.promoted_to_picks,
  rp.professional_score,
  rp.kelly_fraction,
  rp.clv_tracking_id,
  -- Scoring data if available
  sp.tier,
  sp.edge,
  sp.prob_win,
  sp.confidence AS score_confidence,
  sp.updated_at AS scored_at
FROM public.raw_props rp
LEFT JOIN public.unified_picks up ON up.external_prop_id = rp.external_prop_id
LEFT JOIN public.scored_props sp ON sp.prop_ref = up.id
WHERE rp.game_date >= CURRENT_DATE - INTERVAL '1 day'
  AND rp.is_valid = TRUE;

COMMENT ON VIEW public.v_prop_read_model IS 'Pipeline feed view: raw_props with scoring data for Command Center';

-- v_daily_board: Approved picks ready for promotion
CREATE OR REPLACE VIEW public.v_daily_board AS
SELECT
  up.id AS prop_id,
  up.external_prop_id,
  up.game_id,
  up.external_game_id,
  up.sport,
  up.market,
  up.selection,
  up.line,
  up.odds,
  up.game_date,
  up.matchup,
  up.player_name,
  up.bookmaker_key,
  up.status AS pick_status,
  up.promotion_status AS queue_status,
  up.tier_when_placed,
  up.professional_score,
  up.kelly_fraction,
  up.devigged_edge,
  up.clv_tracking_id,
  up.created_at,
  up.approved_at,
  up.approved_by,
  -- Scoring details
  sp.tier,
  sp.edge,
  sp.prob_win,
  sp.confidence,
  sp.updated_at AS scored_at,
  -- Promotion queue data
  pq.id AS queue_id,
  pq.status AS promotion_status,
  pq.discord_thread_id,
  pq.published_at
FROM public.unified_picks up
LEFT JOIN public.scored_props sp ON sp.prop_ref = up.id
LEFT JOIN public.promotion_queue pq ON pq.pick_id = up.id
WHERE up.game_date >= CURRENT_DATE
  AND up.status IN ('pending', 'approved')
ORDER BY sp.edge DESC NULLS LAST, up.created_at DESC;

COMMENT ON VIEW public.v_daily_board IS 'Daily board: approved picks with scoring for promotion workflow';

-- v_open_promotions: Active promotions in queue
CREATE OR REPLACE VIEW public.v_open_promotions AS
SELECT
  pq.id AS queue_id,
  pq.pick_id,
  pq.status,
  pq.priority,
  pq.discord_thread_id,
  pq.discord_message_id,
  pq.published_at,
  pq.created_at,
  pq.updated_at,
  -- Pick details
  up.external_prop_id,
  up.sport,
  up.market,
  up.selection,
  up.line,
  up.odds,
  up.game_date,
  up.matchup,
  up.player_name,
  -- Scoring
  sp.tier,
  sp.edge,
  sp.prob_win
FROM public.promotion_queue pq
JOIN public.unified_picks up ON up.id = pq.pick_id
LEFT JOIN public.scored_props sp ON sp.prop_ref = up.id
WHERE pq.status IN ('pending', 'processing', 'published')
ORDER BY pq.priority DESC, pq.created_at ASC;

COMMENT ON VIEW public.v_open_promotions IS 'Open promotions: active queue items with pick and scoring data';

-- ============================================================================
-- 4. VERIFY/RECREATE RPCS (Idempotent)
-- ============================================================================

-- submit_pick: Submit a pick for approval
CREATE OR REPLACE FUNCTION public.submit_pick(
  p_raw_id UUID,
  p_user_id UUID,
  p_selection TEXT,
  p_analysis TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pick_id UUID;
BEGIN
  -- Create unified_pick from raw_prop
  INSERT INTO public.unified_picks (
    user_id,
    raw_id,
    selection,
    analysis,
    status,
    workflow_stage,
    created_at
  )
  SELECT
    p_user_id,
    p_raw_id,
    p_selection,
    p_analysis,
    'pending',
    'submitted',
    NOW()
  FROM public.raw_props
  WHERE id = p_raw_id
  RETURNING id INTO v_pick_id;

  RETURN v_pick_id;
END;
$$;

COMMENT ON FUNCTION public.submit_pick IS 'Submit a raw prop for approval workflow';

-- approve_pick: Approve a submitted pick
CREATE OR REPLACE FUNCTION public.approve_pick(
  p_pick_id UUID,
  p_approver_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.unified_picks
  SET
    status = 'approved',
    promotion_status = 'approved',
    approved_by = p_approver_id,
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_pick_id
    AND status = 'pending';

  -- Add to promotion queue if approved
  IF FOUND THEN
    INSERT INTO public.promotion_queue (pick_id, status, priority, created_at)
    VALUES (p_pick_id, 'pending', 50, NOW())
    ON CONFLICT (pick_id) DO NOTHING;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.approve_pick IS 'Approve a pick and add to promotion queue';

-- deny_pick: Deny a submitted pick
CREATE OR REPLACE FUNCTION public.deny_pick(
  p_pick_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.unified_picks
  SET
    status = 'denied',
    promotion_status = 'denied',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('denial_reason', p_reason),
    updated_at = NOW()
  WHERE id = p_pick_id
    AND status = 'pending';

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.deny_pick IS 'Deny a pending pick with optional reason';

-- ============================================================================
-- 5. GRANT PERMISSIONS (Ensure service role can access)
-- ============================================================================

GRANT SELECT ON public.v_prop_read_model TO anon, authenticated, service_role;
GRANT SELECT ON public.v_daily_board TO anon, authenticated, service_role;
GRANT SELECT ON public.v_open_promotions TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.submit_pick TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_pick TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.deny_pick TO authenticated, service_role;

-- ============================================================================
-- 6. REFRESH POSTGREST SCHEMA CACHE
-- ============================================================================

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- VERIFICATION QUERIES (Run these after migration)
-- ============================================================================

-- Verify indexes exist
-- SELECT schemaname, tablename, indexname
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename IN ('raw_props', 'unified_picks', 'scored_props')
-- ORDER BY tablename, indexname;

-- Verify views exist
-- SELECT table_name, view_definition
-- FROM information_schema.views
-- WHERE table_schema = 'public'
--   AND table_name IN ('v_prop_read_model', 'v_daily_board', 'v_open_promotions');

-- Verify RPCs exist
-- SELECT proname, pg_get_function_arguments(oid) as args
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND proname IN ('submit_pick', 'approve_pick', 'deny_pick');

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

SELECT 'Cloud delta migration complete' AS status,
       '20251008_cloud_delta.sql' AS migration,
       NOW() AS applied_at;
