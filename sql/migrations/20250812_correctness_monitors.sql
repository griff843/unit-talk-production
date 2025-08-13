-- Migration: Correctness Monitors
-- Cross-check odds/game-times vs providers for data validation and accuracy monitoring
-- Version: 1.0.0
-- Author: System

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ============================================================================
-- CORRECTNESS MONITORING TABLES
-- ============================================================================

-- Provider data sources for validation
CREATE TABLE IF NOT EXISTS data_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_name VARCHAR(100) NOT NULL UNIQUE,
  provider_type VARCHAR(50) NOT NULL, -- 'primary', 'validation', 'reference'
  reliability_score DECIMAL(3,2) DEFAULT 0.95, -- 0.00-1.00
  api_endpoint TEXT,
  refresh_interval_minutes INTEGER DEFAULT 60,
  supported_sports TEXT[] DEFAULT '{}',
  data_types TEXT[] DEFAULT '{}', -- 'odds', 'game_times', 'player_props', 'line_moves'
  priority_order INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  environment VARCHAR(50) DEFAULT 'production',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data validation rules and thresholds
CREATE TABLE IF NOT EXISTS validation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_name VARCHAR(200) NOT NULL,
  rule_type VARCHAR(50) NOT NULL, -- 'odds_variance', 'time_drift', 'line_movement', 'availability'
  data_type VARCHAR(50) NOT NULL, -- 'odds', 'game_times', 'player_props'
  sport VARCHAR(50),
  threshold_config JSONB NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

-- Data snapshots for cross-provider comparison
CREATE TABLE IF NOT EXISTS data_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_timestamp TIMESTAMPTZ DEFAULT NOW(),
  provider_id UUID REFERENCES data_providers(id),
  game_id VARCHAR(200) NOT NULL,
  sport VARCHAR(50) NOT NULL,
  game_time TIMESTAMPTZ,
  home_team VARCHAR(200),
  away_team VARCHAR(200),
  odds_data JSONB, -- spread, moneyline, totals, props
  line_data JSONB, -- current lines and movements
  metadata JSONB DEFAULT '{}',
  environment VARCHAR(50) DEFAULT 'production',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_data_snapshots_game_provider (game_id, provider_id),
  INDEX idx_data_snapshots_sport_time (sport, game_time),
  INDEX idx_data_snapshots_timestamp (snapshot_timestamp)
);

-- Validation results and discrepancies
CREATE TABLE IF NOT EXISTS validation_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  validation_timestamp TIMESTAMPTZ DEFAULT NOW(),
  rule_id UUID REFERENCES validation_rules(id),
  game_id VARCHAR(200) NOT NULL,
  sport VARCHAR(50) NOT NULL,
  primary_provider_id UUID REFERENCES data_providers(id),
  validation_provider_id UUID REFERENCES data_providers(id),
  validation_type VARCHAR(50) NOT NULL,
  discrepancy_found BOOLEAN DEFAULT false,
  discrepancy_severity VARCHAR(20) DEFAULT 'low',
  discrepancy_details JSONB,
  expected_value JSONB,
  actual_value JSONB,
  variance_percentage DECIMAL(10,4),
  resolution_status VARCHAR(50) DEFAULT 'open', -- 'open', 'investigating', 'resolved', 'false_positive'
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(100),
  environment VARCHAR(50) DEFAULT 'production',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_validation_results_game_time (game_id, validation_timestamp),
  INDEX idx_validation_results_severity (discrepancy_severity, discrepancy_found),
  INDEX idx_validation_results_status (resolution_status),
  INDEX idx_validation_results_provider (primary_provider_id, validation_provider_id)
);

-- Data quality metrics and trends
CREATE TABLE IF NOT EXISTS data_quality_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_timestamp TIMESTAMPTZ DEFAULT NOW(),
  provider_id UUID REFERENCES data_providers(id),
  sport VARCHAR(50),
  metric_type VARCHAR(50) NOT NULL, -- 'accuracy', 'timeliness', 'completeness', 'consistency'
  metric_value DECIMAL(10,4) NOT NULL,
  sample_size INTEGER DEFAULT 1,
  measurement_period_minutes INTEGER DEFAULT 60,
  benchmark_value DECIMAL(10,4),
  performance_score DECIMAL(5,2), -- 0-100 score
  trend_direction VARCHAR(20), -- 'improving', 'stable', 'degrading'
  environment VARCHAR(50) DEFAULT 'production',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_data_quality_provider_sport (provider_id, sport),
  INDEX idx_data_quality_timestamp (metric_timestamp),
  INDEX idx_data_quality_type (metric_type)
);

-- Correctness alerts and notifications
CREATE TABLE IF NOT EXISTS correctness_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_type VARCHAR(50) NOT NULL, -- 'odds_discrepancy', 'time_drift', 'data_missing', 'quality_degradation'
  severity VARCHAR(20) NOT NULL,
  provider_id UUID REFERENCES data_providers(id),
  game_id VARCHAR(200),
  sport VARCHAR(50),
  validation_result_id UUID REFERENCES validation_results(id),
  alert_title VARCHAR(300) NOT NULL,
  alert_description TEXT,
  recommended_actions TEXT[],
  impact_assessment TEXT,
  threshold_value DECIMAL(10,4),
  actual_value DECIMAL(10,4),
  status VARCHAR(50) DEFAULT 'open',
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by VARCHAR(100),
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(100),
  resolution_notes TEXT,
  environment VARCHAR(50) DEFAULT 'production',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_correctness_alerts_status_severity (status, severity),
  INDEX idx_correctness_alerts_provider (provider_id),
  INDEX idx_correctness_alerts_game (game_id),
  CONSTRAINT valid_alert_status CHECK (status IN ('open', 'acknowledged', 'investigating', 'resolved', 'false_positive'))
);

-- ============================================================================
-- CORRECTNESS MONITORING FUNCTIONS
-- ============================================================================

-- Capture data snapshot from provider
CREATE OR REPLACE FUNCTION capture_data_snapshot(
  p_provider_name VARCHAR(100),
  p_game_id VARCHAR(200),
  p_sport VARCHAR(50),
  p_game_time TIMESTAMPTZ,
  p_home_team VARCHAR(200),
  p_away_team VARCHAR(200),
  p_odds_data JSONB,
  p_line_data JSONB DEFAULT '{}',
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_provider_id UUID;
  v_snapshot_id UUID;
BEGIN
  -- Get provider ID
  SELECT id INTO v_provider_id
  FROM data_providers 
  WHERE provider_name = p_provider_name 
    AND is_active = true;
  
  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'Provider % not found or inactive', p_provider_name;
  END IF;
  
  -- Insert snapshot
  INSERT INTO data_snapshots (
    provider_id, game_id, sport, game_time,
    home_team, away_team, odds_data, line_data, metadata
  ) VALUES (
    v_provider_id, p_game_id, p_sport, p_game_time,
    p_home_team, p_away_team, p_odds_data, p_line_data, p_metadata
  ) RETURNING id INTO v_snapshot_id;
  
  RETURN v_snapshot_id;
END;
$$;

-- Compare data between providers and detect discrepancies
CREATE OR REPLACE FUNCTION validate_data_consistency(
  p_game_id VARCHAR(200),
  p_sport VARCHAR(50),
  p_validation_type VARCHAR(50) DEFAULT 'odds_variance',
  p_time_window_minutes INTEGER DEFAULT 5
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result_id UUID;
  v_primary_snapshot RECORD;
  v_validation_snapshot RECORD;
  v_rule RECORD;
  v_discrepancy BOOLEAN := false;
  v_severity VARCHAR(20) := 'low';
  v_variance DECIMAL(10,4) := 0;
  v_details JSONB := '{}';
  v_expected JSONB;
  v_actual JSONB;
BEGIN
  -- Get validation rule
  SELECT * INTO v_rule
  FROM validation_rules 
  WHERE rule_type = p_validation_type 
    AND (sport IS NULL OR sport = p_sport)
    AND is_active = true
  ORDER BY priority_order ASC
  LIMIT 1;
  
  IF v_rule IS NULL THEN
    RAISE EXCEPTION 'No validation rule found for type %', p_validation_type;
  END IF;
  
  -- Get primary provider snapshot (highest priority)
  SELECT ds.*, dp.provider_name
  INTO v_primary_snapshot
  FROM data_snapshots ds
  JOIN data_providers dp ON ds.provider_id = dp.id
  WHERE ds.game_id = p_game_id
    AND ds.sport = p_sport
    AND dp.provider_type = 'primary'
    AND ds.snapshot_timestamp > NOW() - INTERVAL '1 minute' * p_time_window_minutes
  ORDER BY dp.priority_order ASC, ds.snapshot_timestamp DESC
  LIMIT 1;
  
  -- Get validation provider snapshot
  SELECT ds.*, dp.provider_name
  INTO v_validation_snapshot
  FROM data_snapshots ds
  JOIN data_providers dp ON ds.provider_id = dp.id
  WHERE ds.game_id = p_game_id
    AND ds.sport = p_sport
    AND dp.provider_type = 'validation'
    AND ds.snapshot_timestamp > NOW() - INTERVAL '1 minute' * p_time_window_minutes
    AND dp.id != COALESCE(v_primary_snapshot.provider_id, uuid_nil())
  ORDER BY dp.priority_order ASC, ds.snapshot_timestamp DESC
  LIMIT 1;
  
  IF v_primary_snapshot IS NULL OR v_validation_snapshot IS NULL THEN
    -- Create result for missing data
    INSERT INTO validation_results (
      rule_id, game_id, sport,
      primary_provider_id, validation_provider_id,
      validation_type, discrepancy_found, discrepancy_severity,
      discrepancy_details, resolution_status
    ) VALUES (
      v_rule.id, p_game_id, p_sport,
      v_primary_snapshot.provider_id, v_validation_snapshot.provider_id,
      p_validation_type, true, 'high',
      '{"error": "Missing data from one or both providers"}', 'open'
    ) RETURNING id INTO v_result_id;
    
    RETURN v_result_id;
  END IF;
  
  -- Perform validation based on type
  CASE p_validation_type
    WHEN 'odds_variance' THEN
      -- Compare odds variance
      v_expected := v_primary_snapshot.odds_data;
      v_actual := v_validation_snapshot.odds_data;
      
      -- Calculate variance for spread odds
      IF v_expected ? 'spread' AND v_actual ? 'spread' THEN
        v_variance := ABS((v_expected->'spread'->>'home_odds')::DECIMAL - 
                         (v_actual->'spread'->>'home_odds')::DECIMAL);
        
        IF v_variance > (v_rule.threshold_config->>'max_odds_variance')::DECIMAL THEN
          v_discrepancy := true;
          v_severity := v_rule.severity;
          v_details := jsonb_build_object(
            'odds_variance', v_variance,
            'threshold', v_rule.threshold_config->>'max_odds_variance',
            'primary_odds', v_expected->'spread',
            'validation_odds', v_actual->'spread'
          );
        END IF;
      END IF;
      
    WHEN 'time_drift' THEN
      -- Compare game times
      IF v_primary_snapshot.game_time IS NOT NULL AND v_validation_snapshot.game_time IS NOT NULL THEN
        v_variance := EXTRACT(EPOCH FROM ABS(v_primary_snapshot.game_time - v_validation_snapshot.game_time)) / 60;
        
        IF v_variance > (v_rule.threshold_config->>'max_time_drift_minutes')::DECIMAL THEN
          v_discrepancy := true;
          v_severity := v_rule.severity;
          v_details := jsonb_build_object(
            'time_drift_minutes', v_variance,
            'threshold', v_rule.threshold_config->>'max_time_drift_minutes',
            'primary_time', v_primary_snapshot.game_time,
            'validation_time', v_validation_snapshot.game_time
          );
        END IF;
      END IF;
      
    WHEN 'line_movement' THEN
      -- Compare line movements
      v_expected := v_primary_snapshot.line_data;
      v_actual := v_validation_snapshot.line_data;
      
      IF v_expected ? 'spread_line' AND v_actual ? 'spread_line' THEN
        v_variance := ABS((v_expected->>'spread_line')::DECIMAL - 
                         (v_actual->>'spread_line')::DECIMAL);
        
        IF v_variance > (v_rule.threshold_config->>'max_line_variance')::DECIMAL THEN
          v_discrepancy := true;
          v_severity := v_rule.severity;
          v_details := jsonb_build_object(
            'line_variance', v_variance,
            'threshold', v_rule.threshold_config->>'max_line_variance',
            'primary_line', v_expected->>'spread_line',
            'validation_line', v_actual->>'spread_line'
          );
        END IF;
      END IF;
  END CASE;
  
  -- Insert validation result
  INSERT INTO validation_results (
    rule_id, game_id, sport,
    primary_provider_id, validation_provider_id,
    validation_type, discrepancy_found, discrepancy_severity,
    discrepancy_details, expected_value, actual_value,
    variance_percentage, resolution_status
  ) VALUES (
    v_rule.id, p_game_id, p_sport,
    v_primary_snapshot.provider_id, v_validation_snapshot.provider_id,
    p_validation_type, v_discrepancy, v_severity,
    v_details, v_expected, v_actual,
    v_variance, 'open'
  ) RETURNING id INTO v_result_id;
  
  -- Create alert if discrepancy found
  IF v_discrepancy THEN
    PERFORM create_correctness_alert(
      CASE p_validation_type 
        WHEN 'odds_variance' THEN 'odds_discrepancy'
        WHEN 'time_drift' THEN 'time_drift'
        WHEN 'line_movement' THEN 'line_discrepancy'
        ELSE 'data_inconsistency'
      END,
      v_severity,
      v_primary_snapshot.provider_id,
      p_game_id,
      p_sport,
      v_result_id,
      format('Data discrepancy detected: %s variance of %s', p_validation_type, v_variance),
      format('Discrepancy found between %s and %s for game %s', 
             v_primary_snapshot.provider_name, 
             v_validation_snapshot.provider_name, 
             p_game_id),
      ARRAY['Investigate data sources', 'Verify with additional providers', 'Check data freshness']
    );
  END IF;
  
  RETURN v_result_id;
END;
$$;

-- Create correctness alert
CREATE OR REPLACE FUNCTION create_correctness_alert(
  p_alert_type VARCHAR(50),
  p_severity VARCHAR(20),
  p_provider_id UUID,
  p_game_id VARCHAR(200),
  p_sport VARCHAR(50),
  p_validation_result_id UUID,
  p_title VARCHAR(300),
  p_description TEXT,
  p_actions TEXT[]
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_alert_id UUID;
BEGIN
  INSERT INTO correctness_alerts (
    alert_type, severity, provider_id, game_id, sport,
    validation_result_id, alert_title, alert_description,
    recommended_actions, status
  ) VALUES (
    p_alert_type, p_severity, p_provider_id, p_game_id, p_sport,
    p_validation_result_id, p_title, p_description,
    p_actions, 'open'
  ) RETURNING id INTO v_alert_id;
  
  RETURN v_alert_id;
END;
$$;

-- Calculate data quality metrics
CREATE OR REPLACE FUNCTION calculate_quality_metrics(
  p_provider_name VARCHAR(100),
  p_sport VARCHAR(50) DEFAULT NULL,
  p_hours_lookback INTEGER DEFAULT 24
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_provider_id UUID;
  v_total_validations INTEGER;
  v_accurate_validations INTEGER;
  v_accuracy_rate DECIMAL(10,4);
  v_avg_timeliness DECIMAL(10,4);
  v_completeness_rate DECIMAL(10,4);
  v_consistency_rate DECIMAL(10,4);
BEGIN
  -- Get provider ID
  SELECT id INTO v_provider_id
  FROM data_providers 
  WHERE provider_name = p_provider_name AND is_active = true;
  
  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'Provider % not found', p_provider_name;
  END IF;
  
  -- Calculate accuracy metrics
  SELECT COUNT(*), COUNT(*) FILTER (WHERE NOT discrepancy_found)
  INTO v_total_validations, v_accurate_validations
  FROM validation_results vr
  WHERE (vr.primary_provider_id = v_provider_id OR vr.validation_provider_id = v_provider_id)
    AND vr.validation_timestamp > NOW() - INTERVAL '1 hour' * p_hours_lookback
    AND (p_sport IS NULL OR vr.sport = p_sport);
  
  v_accuracy_rate := CASE 
    WHEN v_total_validations > 0 THEN v_accurate_validations::DECIMAL / v_total_validations 
    ELSE 1.0 
  END;
  
  -- Calculate timeliness (average snapshot delay)
  SELECT AVG(EXTRACT(EPOCH FROM (snapshot_timestamp - created_at)) / 60)
  INTO v_avg_timeliness
  FROM data_snapshots ds
  WHERE ds.provider_id = v_provider_id
    AND ds.created_at > NOW() - INTERVAL '1 hour' * p_hours_lookback
    AND (p_sport IS NULL OR ds.sport = p_sport);
  
  -- Calculate completeness (snapshots vs expected games)
  -- Simplified: assume 100% for now, would need expected game count
  v_completeness_rate := 0.95;
  
  -- Calculate consistency (variance across multiple snapshots)
  -- Simplified: use accuracy rate as proxy
  v_consistency_rate := v_accuracy_rate;
  
  -- Insert metrics
  INSERT INTO data_quality_metrics (
    provider_id, sport, metric_type, metric_value, 
    sample_size, measurement_period_minutes
  ) VALUES 
    (v_provider_id, p_sport, 'accuracy', v_accuracy_rate, v_total_validations, p_hours_lookback * 60),
    (v_provider_id, p_sport, 'timeliness', COALESCE(v_avg_timeliness, 0), v_total_validations, p_hours_lookback * 60),
    (v_provider_id, p_sport, 'completeness', v_completeness_rate, v_total_validations, p_hours_lookback * 60),
    (v_provider_id, p_sport, 'consistency', v_consistency_rate, v_total_validations, p_hours_lookback * 60);
END;
$$;

-- Resolve validation discrepancy
CREATE OR REPLACE FUNCTION resolve_validation_discrepancy(
  p_result_id UUID,
  p_resolution_status VARCHAR(50),
  p_resolution_notes TEXT,
  p_resolved_by VARCHAR(100)
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE validation_results 
  SET 
    resolution_status = p_resolution_status,
    resolution_notes = p_resolution_notes,
    resolved_at = NOW(),
    resolved_by = p_resolved_by
  WHERE id = p_result_id;
  
  -- Also resolve associated alerts
  UPDATE correctness_alerts
  SET 
    status = CASE 
      WHEN p_resolution_status = 'false_positive' THEN 'false_positive'
      ELSE 'resolved'
    END,
    resolved_at = NOW(),
    resolved_by = p_resolved_by,
    resolution_notes = p_resolution_notes
  WHERE validation_result_id = p_result_id
    AND status IN ('open', 'acknowledged', 'investigating');
  
  RETURN true;
END;
$$;

-- ============================================================================
-- MONITORING VIEWS
-- ============================================================================

-- Data provider health status
CREATE OR REPLACE VIEW data_provider_health AS
SELECT 
  dp.id,
  dp.provider_name,
  dp.provider_type,
  dp.reliability_score,
  dp.is_active,
  -- Recent snapshot count
  COUNT(ds.id) FILTER (WHERE ds.created_at > NOW() - INTERVAL '1 hour') as snapshots_last_hour,
  COUNT(ds.id) FILTER (WHERE ds.created_at > NOW() - INTERVAL '24 hours') as snapshots_last_day,
  -- Recent validation results
  COUNT(vr.id) FILTER (WHERE vr.validation_timestamp > NOW() - INTERVAL '1 hour') as validations_last_hour,
  COUNT(vr.id) FILTER (WHERE vr.validation_timestamp > NOW() - INTERVAL '1 hour' AND vr.discrepancy_found = true) as discrepancies_last_hour,
  -- Data quality score (average of recent metrics)
  COALESCE(AVG(dqm.performance_score) FILTER (WHERE dqm.metric_timestamp > NOW() - INTERVAL '1 hour'), 0) as quality_score,
  -- Last activity
  MAX(ds.snapshot_timestamp) as last_snapshot_time,
  MAX(vr.validation_timestamp) as last_validation_time
FROM data_providers dp
LEFT JOIN data_snapshots ds ON dp.id = ds.provider_id
LEFT JOIN validation_results vr ON dp.id IN (vr.primary_provider_id, vr.validation_provider_id)
LEFT JOIN data_quality_metrics dqm ON dp.id = dqm.provider_id
WHERE dp.environment = 'production'
GROUP BY dp.id, dp.provider_name, dp.provider_type, dp.reliability_score, dp.is_active;

-- Validation discrepancy summary
CREATE OR REPLACE VIEW validation_discrepancy_summary AS
SELECT 
  vr.sport,
  vr.validation_type,
  vr.discrepancy_severity,
  COUNT(*) as total_validations,
  COUNT(*) FILTER (WHERE vr.discrepancy_found = true) as discrepancies_found,
  ROUND((COUNT(*) FILTER (WHERE vr.discrepancy_found = true)::DECIMAL / NULLIF(COUNT(*), 0) * 100), 2) as discrepancy_rate_percent,
  AVG(vr.variance_percentage) FILTER (WHERE vr.discrepancy_found = true) as avg_variance,
  MAX(vr.variance_percentage) as max_variance,
  COUNT(*) FILTER (WHERE vr.resolution_status = 'open') as open_discrepancies,
  COUNT(*) FILTER (WHERE vr.resolution_status = 'resolved') as resolved_discrepancies,
  MIN(vr.validation_timestamp) as first_validation,
  MAX(vr.validation_timestamp) as last_validation
FROM validation_results vr
WHERE vr.validation_timestamp > NOW() - INTERVAL '24 hours'
  AND vr.environment = 'production'
GROUP BY vr.sport, vr.validation_type, vr.discrepancy_severity
ORDER BY discrepancy_rate_percent DESC, total_validations DESC;

-- Active correctness alerts
CREATE OR REPLACE VIEW active_correctness_alerts AS
SELECT 
  ca.id,
  ca.alert_type,
  ca.severity,
  dp.provider_name,
  ca.game_id,
  ca.sport,
  ca.alert_title,
  ca.alert_description,
  ca.threshold_value,
  ca.actual_value,
  ca.status,
  ca.acknowledged_by,
  ca.acknowledged_at,
  vr.variance_percentage,
  vr.validation_type,
  EXTRACT(EPOCH FROM (NOW() - ca.created_at)) / 60 as age_minutes,
  ca.created_at
FROM correctness_alerts ca
LEFT JOIN data_providers dp ON ca.provider_id = dp.id
LEFT JOIN validation_results vr ON ca.validation_result_id = vr.id
WHERE ca.status IN ('open', 'acknowledged', 'investigating')
  AND ca.environment = 'production'
ORDER BY 
  CASE ca.severity 
    WHEN 'critical' THEN 1 
    WHEN 'high' THEN 2 
    WHEN 'medium' THEN 3 
    ELSE 4 
  END,
  ca.created_at DESC;

-- Data quality dashboard
CREATE OR REPLACE VIEW data_quality_dashboard AS
SELECT 
  dp.provider_name,
  dqm.sport,
  dqm.metric_type,
  dqm.metric_value,
  dqm.performance_score,
  dqm.trend_direction,
  dqm.sample_size,
  dqm.metric_timestamp,
  -- Quality rating
  CASE 
    WHEN dqm.performance_score >= 95 THEN 'Excellent'
    WHEN dqm.performance_score >= 90 THEN 'Good'
    WHEN dqm.performance_score >= 80 THEN 'Fair'
    WHEN dqm.performance_score >= 70 THEN 'Poor'
    ELSE 'Critical'
  END as quality_rating,
  -- Benchmark comparison
  CASE 
    WHEN dqm.benchmark_value IS NOT NULL THEN 
      ROUND((dqm.metric_value - dqm.benchmark_value) / dqm.benchmark_value * 100, 2)
    ELSE NULL
  END as benchmark_variance_percent
FROM data_quality_metrics dqm
JOIN data_providers dp ON dqm.provider_id = dp.id
WHERE dqm.metric_timestamp > NOW() - INTERVAL '24 hours'
  AND dp.environment = 'production'
ORDER BY dp.provider_name, dqm.sport, dqm.metric_type, dqm.metric_timestamp DESC;

-- Game validation status
CREATE OR REPLACE VIEW game_validation_status AS
SELECT 
  ds.game_id,
  ds.sport,
  ds.home_team,
  ds.away_team,
  ds.game_time,
  -- Provider coverage
  COUNT(DISTINCT ds.provider_id) as provider_count,
  STRING_AGG(DISTINCT dp.provider_name, ', ' ORDER BY dp.provider_name) as providers,
  -- Validation results
  COUNT(vr.id) as total_validations,
  COUNT(vr.id) FILTER (WHERE vr.discrepancy_found = true) as discrepancies_found,
  COUNT(vr.id) FILTER (WHERE vr.discrepancy_found = true AND vr.discrepancy_severity IN ('high', 'critical')) as critical_discrepancies,
  -- Data freshness
  MAX(ds.snapshot_timestamp) as latest_snapshot,
  MIN(ds.snapshot_timestamp) as earliest_snapshot,
  EXTRACT(EPOCH FROM (NOW() - MAX(ds.snapshot_timestamp))) / 60 as minutes_since_last_update,
  -- Overall status
  CASE 
    WHEN COUNT(vr.id) FILTER (WHERE vr.discrepancy_found = true AND vr.discrepancy_severity = 'critical') > 0 THEN 'CRITICAL'
    WHEN COUNT(vr.id) FILTER (WHERE vr.discrepancy_found = true AND vr.discrepancy_severity = 'high') > 0 THEN 'WARNING'
    WHEN COUNT(vr.id) FILTER (WHERE vr.discrepancy_found = true) > 0 THEN 'CAUTION'
    WHEN COUNT(DISTINCT ds.provider_id) >= 2 THEN 'HEALTHY'
    ELSE 'INCOMPLETE'
  END as validation_status
FROM data_snapshots ds
JOIN data_providers dp ON ds.provider_id = dp.id
LEFT JOIN validation_results vr ON ds.game_id = vr.game_id AND ds.sport = vr.sport
WHERE ds.snapshot_timestamp > NOW() - INTERVAL '24 hours'
  AND dp.environment = 'production'
GROUP BY ds.game_id, ds.sport, ds.home_team, ds.away_team, ds.game_time
ORDER BY validation_status DESC, minutes_since_last_update ASC;

-- Insert default data providers
INSERT INTO data_providers (provider_name, provider_type, reliability_score, supported_sports, data_types, priority_order) VALUES
('optimal_api', 'primary', 0.95, ARRAY['nfl', 'nba', 'mlb', 'nhl'], ARRAY['odds', 'game_times', 'player_props'], 1),
('odds_api', 'validation', 0.92, ARRAY['nfl', 'nba', 'mlb', 'nhl'], ARRAY['odds', 'line_moves'], 2),
('espn_api', 'reference', 0.88, ARRAY['nfl', 'nba', 'mlb', 'nhl'], ARRAY['game_times'], 3),
('sportsbook_direct', 'validation', 0.90, ARRAY['nfl', 'nba', 'mlb'], ARRAY['odds', 'line_moves'], 4)
ON CONFLICT (provider_name) DO NOTHING;

-- Insert default validation rules
INSERT INTO validation_rules (rule_name, rule_type, data_type, threshold_config, severity) VALUES
('Odds Variance Check', 'odds_variance', 'odds', '{"max_odds_variance": 50, "min_sample_size": 2}', 'medium'),
('Game Time Drift', 'time_drift', 'game_times', '{"max_time_drift_minutes": 15}', 'high'),
('Spread Line Movement', 'line_movement', 'odds', '{"max_line_variance": 2.0, "time_window_minutes": 30}', 'medium'),
('Data Availability Check', 'availability', 'odds', '{"max_delay_minutes": 10, "min_providers": 2}', 'high')
ON CONFLICT DO NOTHING;

COMMIT;