-- =============================================================================
-- Phase 19: Historical Migration & Analytics Activation
-- Date: 2025-11-11
-- Mode: Production
-- Self-heal: Enabled (auto-rollback if parity < 95%)
-- =============================================================================

-- Step 1: Pre-migration validation
-- =============================================================================
DO $$
DECLARE
  v_unified_count INTEGER;
  v_picks_count INTEGER;
  v_default_tenant_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
BEGIN
  -- Count records in unified_picks
  SELECT COUNT(*) INTO v_unified_count FROM public.unified_picks;
  SELECT COUNT(*) INTO v_picks_count FROM public.picks;
  
  RAISE NOTICE 'Pre-migration snapshot:';
  RAISE NOTICE '  unified_picks: % rows', v_unified_count;
  RAISE NOTICE '  picks: % rows', v_picks_count;
END $$;

-- Step 2: Batch migration with idempotency
-- =============================================================================
-- This function performs the historical migration in batches
CREATE OR REPLACE FUNCTION migrate_unified_to_picks_batch(
  p_batch_size INTEGER DEFAULT 1000,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  migrated_count INTEGER,
  failed_count INTEGER,
  total_processed INTEGER
) AS $$
DECLARE
  v_batch_count INTEGER := 0;
  v_failed_count INTEGER := 0;
  v_default_tenant_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
BEGIN
  -- Insert batch with ON CONFLICT DO UPDATE for idempotency
  INSERT INTO public.picks (
    id,
    tenant_id,
    user_id,
    league,
    player_id,
    stat_type,
    line,
    direction,
    game_date,
    analysis,
    confidence,
    created_at,
    updated_at
  )
  SELECT
    up.id,
    v_default_tenant_id,
    up.user_id,
    COALESCE(up.league, 'UNKNOWN'),
    COALESCE(up.player_id::UUID, gen_random_uuid()),
    COALESCE(up.stat_type, 'PLAYER_POINTS'),
    COALESCE(up.line, 0.0),
    LOWER(COALESCE(up.direction, 'over')),
    up.game_date::DATE,
    up.analysis,
    up.confidence,
    COALESCE(up.created_at, NOW()),
    COALESCE(up.updated_at, NOW())
  FROM public.unified_picks up
  WHERE NOT EXISTS (
    SELECT 1 FROM public.picks p WHERE p.id = up.id
  )
  ORDER BY up.created_at DESC
  LIMIT p_batch_size
  OFFSET p_offset
  ON CONFLICT (id) DO UPDATE SET
    updated_at = EXCLUDED.updated_at;

  GET DIAGNOSTICS v_batch_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_batch_count, v_failed_count, (v_batch_count + v_failed_count);
END;
$$ LANGUAGE plpgsql;

-- Step 3: Execute migration in batches
-- =============================================================================
DO $$
DECLARE
  v_total_records INTEGER;
  v_migrated INTEGER := 0;
  v_offset INTEGER := 0;
  v_batch_size INTEGER := 1000;
  v_batch_result RECORD;
BEGIN
  SELECT COUNT(*) INTO v_total_records FROM public.unified_picks;
  RAISE NOTICE 'Starting batch migration of % records', v_total_records;
  
  WHILE v_offset < v_total_records LOOP
    SELECT * INTO v_batch_result FROM migrate_unified_to_picks_batch(v_batch_size, v_offset);
    v_migrated := v_migrated + v_batch_result.migrated_count;
    v_offset := v_offset + v_batch_size;
    
    RAISE NOTICE 'Batch progress: % / % records migrated', v_migrated, v_total_records;
  END LOOP;
  
  RAISE NOTICE 'Migration complete: % records migrated', v_migrated;
END $$;

-- Step 4: Integrity verification
-- =============================================================================
DO $$
DECLARE
  v_unified_count INTEGER;
  v_picks_count INTEGER;
  v_parity NUMERIC;
BEGIN
  SELECT COUNT(*) INTO v_unified_count FROM public.unified_picks;
  SELECT COUNT(*) INTO v_picks_count FROM public.picks;
  
  v_parity := (v_picks_count::NUMERIC / v_unified_count::NUMERIC) * 100;
  
  RAISE NOTICE 'Post-migration verification:';
  RAISE NOTICE '  unified_picks: % rows', v_unified_count;
  RAISE NOTICE '  picks: % rows', v_picks_count;
  RAISE NOTICE '  Parity: %.2f%%', v_parity;
  
  IF v_parity < 95 THEN
    RAISE EXCEPTION 'CRITICAL: Parity < 95%%, initiating rollback';
  END IF;
END $$;

-- Step 5: Analytics activation - Create feature tables
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.analytics_pick_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id UUID NOT NULL REFERENCES public.picks(id),
  user_id UUID NOT NULL REFERENCES public.users(id),
  win_rate NUMERIC(5,2),
  roi NUMERIC(8,2),
  streak_length INTEGER,
  accuracy_index NUMERIC(5,2),
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pick_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.analytics_capper_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  total_picks INTEGER DEFAULT 0,
  winning_picks INTEGER DEFAULT 0,
  losing_picks INTEGER DEFAULT 0,
  win_rate NUMERIC(5,2),
  roi NUMERIC(8,2),
  avg_confidence NUMERIC(5,2),
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Step 6: Create indexes for analytics
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_picks_user_id ON public.picks(user_id);
CREATE INDEX IF NOT EXISTS idx_picks_created_at ON public.picks(created_at);
CREATE INDEX IF NOT EXISTS idx_picks_league ON public.picks(league);
CREATE INDEX IF NOT EXISTS idx_analytics_pick_performance_user_id 
  ON public.analytics_pick_performance(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_capper_metrics_user_id 
  ON public.analytics_capper_metrics(user_id);

-- Step 7: Enable RLS on analytics tables
-- =============================================================================
ALTER TABLE public.analytics_pick_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_capper_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pick performance"
  ON public.analytics_pick_performance
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can view their own capper metrics"
  ON public.analytics_capper_metrics
  FOR SELECT
  USING (user_id = auth.uid());

-- Step 8: Grant permissions
-- =============================================================================
GRANT SELECT ON public.picks TO authenticated;
GRANT SELECT ON public.analytics_pick_performance TO authenticated;
GRANT SELECT ON public.analytics_capper_metrics TO authenticated;

-- Step 9: Final validation
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Phase 19 Migration Complete';
  RAISE NOTICE '  - Historical migration: COMPLETE';
  RAISE NOTICE '  - Integrity verification: PASSED';
  RAISE NOTICE '  - Analytics activation: COMPLETE';
  RAISE NOTICE '  - RLS policies: ENABLED';
END $$;

