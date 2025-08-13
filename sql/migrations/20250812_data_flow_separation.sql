-- Data Hygiene: Enforce raw→scored→final→settled separation
-- Ensures strict table separation and data flow integrity
-- Blocks writes to downstream tables except through authorized functions
-- Migration: 20250812_data_flow_separation.sql

-- =============================================================================
-- DROP EXISTING POLICIES (Clean slate)
-- =============================================================================
DROP POLICY IF EXISTS "raw_props_select" ON raw_props;
DROP POLICY IF EXISTS "scored_props_select" ON scored_props;
DROP POLICY IF EXISTS "final_picks_select" ON final_picks;
DROP POLICY IF EXISTS "settled_picks_select" ON settled_picks;

-- =============================================================================
-- CREATE DATA FLOW VALIDATION FUNCTIONS
-- =============================================================================

-- Function to validate raw props ingestion
CREATE OR REPLACE FUNCTION app.ingest_raw_prop(
  p_provider_name VARCHAR(100),
  p_external_prop_id VARCHAR(255),
  p_sport VARCHAR(50),
  p_player_name VARCHAR(255),
  p_stat_type VARCHAR(100),
  p_line DECIMAL(10,2),
  p_over_odds INTEGER,
  p_under_odds INTEGER,
  p_game_start TIMESTAMP WITH TIME ZONE,
  p_source_data JSONB DEFAULT NULL,
  p_idempotency_key VARCHAR(255) DEFAULT NULL
) RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_prop_id UUID;
  v_existing_prop_id UUID;
BEGIN
  -- Validate input parameters
  IF p_provider_name IS NULL OR p_external_prop_id IS NULL OR p_sport IS NULL THEN
    RAISE EXCEPTION 'Required parameters cannot be null';
  END IF;

  -- Check for duplicate based on idempotency key
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_prop_id 
    FROM raw_props 
    WHERE idempotency_key = p_idempotency_key;
    
    IF v_existing_prop_id IS NOT NULL THEN
      -- Return existing prop ID (idempotent)
      RETURN v_existing_prop_id;
    END IF;
  END IF;

  -- Check for duplicate based on business key
  SELECT id INTO v_existing_prop_id 
  FROM raw_props 
  WHERE provider_name = p_provider_name 
    AND external_prop_id = p_external_prop_id
    AND created_at > NOW() - INTERVAL '24 hours';
  
  IF v_existing_prop_id IS NOT NULL THEN
    -- Update existing prop with fresh data
    UPDATE raw_props 
    SET 
      line = p_line,
      over_odds = p_over_odds,
      under_odds = p_under_odds,
      game_start = p_game_start,
      source_data = p_source_data,
      updated_at = NOW()
    WHERE id = v_existing_prop_id;
    
    RETURN v_existing_prop_id;
  END IF;

  -- Insert new raw prop
  INSERT INTO raw_props (
    provider_name,
    external_prop_id,
    sport,
    player_name,
    stat_type,
    line,
    over_odds,
    under_odds,
    game_start,
    source_data,
    idempotency_key,
    created_at,
    updated_at
  ) VALUES (
    p_provider_name,
    p_external_prop_id,
    p_sport,
    p_player_name,
    p_stat_type,
    p_line,
    p_over_odds,
    p_under_odds,
    p_game_start,
    p_source_data,
    p_idempotency_key,
    NOW(),
    NOW()
  ) RETURNING id INTO v_prop_id;

  -- Log ingestion
  INSERT INTO audit_log (table_name, operation, record_id, details)
  VALUES ('raw_props', 'INSERT', v_prop_id, jsonb_build_object(
    'provider', p_provider_name,
    'sport', p_sport,
    'player', p_player_name,
    'stat_type', p_stat_type
  ));

  RETURN v_prop_id;
END;
$$;

-- Function to score raw props
CREATE OR REPLACE FUNCTION app.score_prop(
  p_raw_prop_id UUID,
  p_professional_score INTEGER,
  p_confidence_score DECIMAL(5,4),
  p_expected_value DECIMAL(8,4),
  p_grading_features JSONB,
  p_scored_by UUID DEFAULT NULL
) RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_scored_prop_id UUID;
  v_raw_prop_exists BOOLEAN;
  v_existing_scored_prop_id UUID;
BEGIN
  -- Validate raw prop exists
  SELECT EXISTS(SELECT 1 FROM raw_props WHERE id = p_raw_prop_id) 
  INTO v_raw_prop_exists;
  
  IF NOT v_raw_prop_exists THEN
    RAISE EXCEPTION 'Raw prop with ID % does not exist', p_raw_prop_id;
  END IF;

  -- Check for existing scored prop (idempotent)
  SELECT id INTO v_existing_scored_prop_id 
  FROM scored_props 
  WHERE raw_prop_id = p_raw_prop_id;
  
  IF v_existing_scored_prop_id IS NOT NULL THEN
    -- Update existing scored prop
    UPDATE scored_props 
    SET 
      professional_score = p_professional_score,
      confidence_score = p_confidence_score,
      expected_value = p_expected_value,
      grading_features = p_grading_features,
      scored_by = COALESCE(p_scored_by, scored_by),
      scored_at = NOW()
    WHERE id = v_existing_scored_prop_id;
    
    RETURN v_existing_scored_prop_id;
  END IF;

  -- Insert new scored prop
  INSERT INTO scored_props (
    raw_prop_id,
    professional_score,
    confidence_score,
    expected_value,
    grading_features,
    scored_by,
    scored_at,
    created_at
  ) VALUES (
    p_raw_prop_id,
    p_professional_score,
    p_confidence_score,
    p_expected_value,
    p_grading_features,
    p_scored_by,
    NOW(),
    NOW()
  ) RETURNING id INTO v_scored_prop_id;

  -- Log scoring
  INSERT INTO audit_log (table_name, operation, record_id, details)
  VALUES ('scored_props', 'INSERT', v_scored_prop_id, jsonb_build_object(
    'raw_prop_id', p_raw_prop_id,
    'professional_score', p_professional_score,
    'expected_value', p_expected_value
  ));

  RETURN v_scored_prop_id;
END;
$$;

-- Function to settle final picks
CREATE OR REPLACE FUNCTION app.settle_pick(
  p_final_pick_id UUID,
  p_outcome VARCHAR(20), -- 'win', 'loss', 'push', 'void'
  p_actual_value DECIMAL(10,2),
  p_settlement_data JSONB DEFAULT NULL,
  p_settled_by UUID DEFAULT NULL
) RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_settled_pick_id UUID;
  v_final_pick_exists BOOLEAN;
  v_existing_settled_pick_id UUID;
  v_safe_mode BOOLEAN;
  v_system_freeze BOOLEAN;
BEGIN
  -- Check system state
  SELECT value::boolean INTO v_safe_mode 
  FROM system_config WHERE key = 'SAFE_MODE';
  
  SELECT value::boolean INTO v_system_freeze 
  FROM system_config WHERE key = 'SYSTEM_FREEZE';
  
  IF v_system_freeze THEN
    RAISE EXCEPTION 'System is frozen - settlement operations disabled';
  END IF;

  -- Validate final pick exists
  SELECT EXISTS(SELECT 1 FROM final_picks WHERE id = p_final_pick_id AND settled_at IS NULL) 
  INTO v_final_pick_exists;
  
  IF NOT v_final_pick_exists THEN
    RAISE EXCEPTION 'Final pick with ID % does not exist or is already settled', p_final_pick_id;
  END IF;

  -- Validate outcome
  IF p_outcome NOT IN ('win', 'loss', 'push', 'void') THEN
    RAISE EXCEPTION 'Invalid outcome: %. Must be win, loss, push, or void', p_outcome;
  END IF;

  -- Check for existing settlement (idempotent)
  SELECT id INTO v_existing_settled_pick_id 
  FROM settled_picks 
  WHERE final_pick_id = p_final_pick_id;
  
  IF v_existing_settled_pick_id IS NOT NULL THEN
    -- Update existing settlement
    UPDATE settled_picks 
    SET 
      outcome = p_outcome,
      actual_value = p_actual_value,
      settlement_data = p_settlement_data,
      settled_by = COALESCE(p_settled_by, settled_by),
      settled_at = NOW()
    WHERE id = v_existing_settled_pick_id;
    
    -- Update final pick
    UPDATE final_picks 
    SET settled_at = NOW()
    WHERE id = p_final_pick_id;
    
    RETURN v_existing_settled_pick_id;
  END IF;

  -- Insert new settlement
  INSERT INTO settled_picks (
    final_pick_id,
    outcome,
    actual_value,
    settlement_data,
    settled_by,
    settled_at,
    created_at
  ) VALUES (
    p_final_pick_id,
    p_outcome,
    p_actual_value,
    p_settlement_data,
    p_settled_by,
    NOW(),
    NOW()
  ) RETURNING id INTO v_settled_pick_id;

  -- Update final pick settlement timestamp
  UPDATE final_picks 
  SET settled_at = NOW()
  WHERE id = p_final_pick_id;

  -- Log settlement
  INSERT INTO audit_log (table_name, operation, record_id, details)
  VALUES ('settled_picks', 'INSERT', v_settled_pick_id, jsonb_build_object(
    'final_pick_id', p_final_pick_id,
    'outcome', p_outcome,
    'actual_value', p_actual_value
  ));

  RETURN v_settled_pick_id;
END;
$$;

-- =============================================================================
-- CREATE STRICT RLS POLICIES
-- =============================================================================

-- raw_props: Allow reads, but writes only through ingest_raw_prop function
CREATE POLICY "raw_props_select" ON raw_props FOR SELECT USING (true);
CREATE POLICY "raw_props_insert" ON raw_props FOR INSERT 
  WITH CHECK (current_setting('role') = 'service_role');

-- scored_props: Allow reads, but writes only through score_prop function  
CREATE POLICY "scored_props_select" ON scored_props FOR SELECT USING (true);
CREATE POLICY "scored_props_insert" ON scored_props FOR INSERT 
  WITH CHECK (current_setting('role') = 'service_role');
CREATE POLICY "scored_props_update" ON scored_props FOR UPDATE 
  USING (current_setting('role') = 'service_role');

-- final_picks: Allow reads, writes only through promote_pick function
CREATE POLICY "final_picks_select" ON final_picks FOR SELECT USING (true);
CREATE POLICY "final_picks_insert" ON final_picks FOR INSERT 
  WITH CHECK (current_setting('role') = 'service_role');
CREATE POLICY "final_picks_update" ON final_picks FOR UPDATE 
  USING (current_setting('role') = 'service_role' AND settled_at IS NULL);

-- settled_picks: Allow reads, writes only through settle_pick function
CREATE POLICY "settled_picks_select" ON settled_picks FOR SELECT USING (true);
CREATE POLICY "settled_picks_insert" ON settled_picks FOR INSERT 
  WITH CHECK (current_setting('role') = 'service_role');
CREATE POLICY "settled_picks_update" ON settled_picks FOR UPDATE 
  USING (current_setting('role') = 'service_role');

-- =============================================================================
-- CREATE DATA FLOW VIEWS
-- =============================================================================

-- View for complete prop pipeline status
CREATE OR REPLACE VIEW data_flow_status AS
SELECT 
  rp.id as raw_prop_id,
  rp.provider_name,
  rp.sport,
  rp.player_name,
  rp.stat_type,
  rp.line,
  rp.created_at as ingested_at,
  
  sp.id as scored_prop_id,
  sp.professional_score,
  sp.confidence_score,
  sp.expected_value,
  sp.scored_at,
  
  fp.id as final_pick_id,
  fp.tier,
  fp.promoted_at,
  fp.published_at,
  fp.settled_at as final_settled_at,
  
  stp.id as settled_pick_id,
  stp.outcome,
  stp.actual_value,
  stp.settled_at,
  
  -- Status indicators
  CASE 
    WHEN stp.id IS NOT NULL THEN 'settled'
    WHEN fp.id IS NOT NULL THEN 'promoted'
    WHEN sp.id IS NOT NULL THEN 'scored'
    ELSE 'raw'
  END as pipeline_stage,
  
  -- Processing times
  sp.scored_at - rp.created_at as time_to_score,
  fp.promoted_at - sp.scored_at as time_to_promote,
  stp.settled_at - fp.promoted_at as time_to_settle,
  
  -- Data integrity flags
  (rp.id IS NOT NULL) as has_raw_data,
  (sp.id IS NOT NULL) as has_scoring,
  (fp.id IS NOT NULL) as has_promotion,
  (stp.id IS NOT NULL) as has_settlement
  
FROM raw_props rp
LEFT JOIN scored_props sp ON rp.id = sp.raw_prop_id
LEFT JOIN final_picks fp ON sp.id = fp.scored_prop_id
LEFT JOIN settled_picks stp ON fp.id = stp.final_pick_id
ORDER BY rp.created_at DESC;

-- View for data hygiene monitoring
CREATE OR REPLACE VIEW data_hygiene_metrics AS
SELECT 
  -- Overall counts
  (SELECT COUNT(*) FROM raw_props WHERE created_at > NOW() - INTERVAL '24 hours') as raw_props_24h,
  (SELECT COUNT(*) FROM scored_props WHERE scored_at > NOW() - INTERVAL '24 hours') as scored_props_24h,
  (SELECT COUNT(*) FROM final_picks WHERE promoted_at > NOW() - INTERVAL '24 hours') as promoted_picks_24h,
  (SELECT COUNT(*) FROM settled_picks WHERE settled_at > NOW() - INTERVAL '24 hours') as settled_picks_24h,
  
  -- Orphaned records (data integrity issues)
  (SELECT COUNT(*) FROM raw_props rp 
   WHERE NOT EXISTS(SELECT 1 FROM scored_props sp WHERE sp.raw_prop_id = rp.id)
   AND rp.created_at < NOW() - INTERVAL '2 hours') as orphaned_raw_props,
   
  (SELECT COUNT(*) FROM scored_props sp 
   WHERE NOT EXISTS(SELECT 1 FROM final_picks fp WHERE fp.scored_prop_id = sp.id)
   AND sp.scored_at < NOW() - INTERVAL '1 hour') as orphaned_scored_props,
   
  (SELECT COUNT(*) FROM final_picks fp 
   WHERE NOT EXISTS(SELECT 1 FROM settled_picks sp WHERE sp.final_pick_id = fp.id)
   AND fp.promoted_at < NOW() - INTERVAL '6 hours'
   AND fp.settled_at IS NULL) as unsettled_final_picks,
  
  -- Processing rate metrics
  (SELECT AVG(EXTRACT(EPOCH FROM (sp.scored_at - rp.created_at)))
   FROM raw_props rp 
   JOIN scored_props sp ON rp.id = sp.raw_prop_id
   WHERE rp.created_at > NOW() - INTERVAL '24 hours') as avg_score_time_seconds,
   
  (SELECT AVG(EXTRACT(EPOCH FROM (fp.promoted_at - sp.scored_at)))
   FROM scored_props sp 
   JOIN final_picks fp ON sp.id = fp.scored_prop_id
   WHERE sp.scored_at > NOW() - INTERVAL '24 hours') as avg_promote_time_seconds;

-- =============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

-- Indexes for data flow queries
CREATE INDEX IF NOT EXISTS idx_raw_props_provider_external_id 
  ON raw_props(provider_name, external_prop_id);

CREATE INDEX IF NOT EXISTS idx_raw_props_created_at 
  ON raw_props(created_at);

CREATE INDEX IF NOT EXISTS idx_scored_props_raw_prop_id 
  ON scored_props(raw_prop_id);

CREATE INDEX IF NOT EXISTS idx_final_picks_scored_prop_id 
  ON final_picks(scored_prop_id);

CREATE INDEX IF NOT EXISTS idx_settled_picks_final_pick_id 
  ON settled_picks(final_pick_id);

CREATE INDEX IF NOT EXISTS idx_raw_props_idempotency_key 
  ON raw_props(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- =============================================================================
-- ENABLE RLS ON ALL TABLES
-- =============================================================================

ALTER TABLE raw_props ENABLE ROW LEVEL SECURITY;
ALTER TABLE scored_props ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE settled_picks ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION app.ingest_raw_prop TO service_role;
GRANT EXECUTE ON FUNCTION app.score_prop TO service_role;
GRANT EXECUTE ON FUNCTION app.settle_pick TO service_role;

-- Grant select permissions on views
GRANT SELECT ON data_flow_status TO anon, authenticated, service_role;
GRANT SELECT ON data_hygiene_metrics TO anon, authenticated, service_role;

-- =============================================================================
-- MIGRATION VERIFICATION
-- =============================================================================

-- Test data flow functions work correctly
DO $$
DECLARE
  v_raw_id UUID;
  v_scored_id UUID;
  v_settled_id UUID;
BEGIN
  -- Test raw prop ingestion
  SELECT app.ingest_raw_prop(
    'test_provider',
    'test_prop_001',
    'TEST',
    'Test Player',
    'test_stat',
    1.5,
    -110,
    -110,
    NOW() + INTERVAL '2 hours',
    '{"test": true}'::jsonb,
    'test_migration_' || extract(epoch from now())
  ) INTO v_raw_id;
  
  -- Test prop scoring
  SELECT app.score_prop(
    v_raw_id,
    85,
    0.75,
    0.05,
    '{"test_feature": true}'::jsonb
  ) INTO v_scored_id;
  
  RAISE NOTICE 'Migration test successful: raw_id=%, scored_id=%', v_raw_id, v_scored_id;
  
  -- Cleanup test data
  DELETE FROM scored_props WHERE id = v_scored_id;
  DELETE FROM raw_props WHERE id = v_raw_id;
END
$$;

-- Migration completed
INSERT INTO audit_log (table_name, operation, details)
VALUES ('migration', 'COMPLETE', jsonb_build_object(
  'migration', '20250812_data_flow_separation',
  'timestamp', NOW(),
  'description', 'Data hygiene: Enforce raw→scored→final→settled separation'
));