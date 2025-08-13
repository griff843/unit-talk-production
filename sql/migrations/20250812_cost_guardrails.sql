-- Cost Guardrails: Provider usage monitoring, throttling, and budget enforcement
-- Migration: 20250812_cost_guardrails.sql

-- =============================================================================
-- CREATE PROVIDER USAGE TRACKING TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS provider_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Provider identification
  provider_name VARCHAR(100) NOT NULL,
  provider_service VARCHAR(100) NOT NULL, -- 'api', 'database', 'storage', 'compute', etc.
  resource_type VARCHAR(100) NOT NULL, -- 'requests', 'tokens', 'bytes', 'compute_hours', etc.
  
  -- Usage metrics
  usage_value DECIMAL(20,4) NOT NULL,
  usage_unit VARCHAR(50) NOT NULL,
  cost_per_unit DECIMAL(10,6) DEFAULT 0,
  total_cost DECIMAL(15,4) GENERATED ALWAYS AS (usage_value * cost_per_unit) STORED,
  
  -- Billing period
  billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Context
  environment VARCHAR(50) NOT NULL DEFAULT 'production',
  service_name VARCHAR(100) DEFAULT NULL,
  endpoint VARCHAR(500) DEFAULT NULL,
  user_id UUID DEFAULT NULL,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Partitioning helper
  partition_key DATE GENERATED ALWAYS AS (DATE(recorded_at)) STORED
);

-- =============================================================================
-- CREATE COST BUDGETS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS cost_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Budget identification
  budget_name VARCHAR(100) NOT NULL,
  budget_type VARCHAR(50) NOT NULL CHECK (budget_type IN ('provider', 'service', 'environment', 'global')),
  budget_scope VARCHAR(100) NOT NULL, -- provider name, service name, or 'global'
  
  -- Budget limits (monthly by default)
  monthly_budget_usd DECIMAL(15,2) NOT NULL,
  daily_budget_usd DECIMAL(15,2) GENERATED ALWAYS AS (monthly_budget_usd / 30.0) STORED,
  hourly_budget_usd DECIMAL(15,2) GENERATED ALWAYS AS (monthly_budget_usd / 720.0) STORED,
  
  -- Current consumption
  current_spend_usd DECIMAL(15,2) DEFAULT 0,
  spend_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN monthly_budget_usd = 0 THEN 0
      ELSE (current_spend_usd / monthly_budget_usd) * 100
    END
  ) STORED,
  
  -- Alert thresholds
  alert_threshold_50 BOOLEAN DEFAULT TRUE,
  alert_threshold_75 BOOLEAN DEFAULT TRUE,
  alert_threshold_90 BOOLEAN DEFAULT TRUE,
  alert_threshold_100 BOOLEAN DEFAULT TRUE,
  
  -- Throttling configuration
  throttle_at_percent DECIMAL(5,2) DEFAULT 80.0, -- Start throttling at 80%
  block_at_percent DECIMAL(5,2) DEFAULT 100.0,   -- Block requests at 100%
  throttle_factor DECIMAL(3,2) DEFAULT 0.5,       -- Reduce rate by 50% when throttling
  
  -- Budget period
  budget_period_start TIMESTAMP WITH TIME ZONE DEFAULT DATE_TRUNC('month', NOW()),
  budget_period_end TIMESTAMP WITH TIME ZONE DEFAULT (DATE_TRUNC('month', NOW()) + INTERVAL '1 month'),
  
  -- Status
  active BOOLEAN DEFAULT TRUE,
  enforcement_mode VARCHAR(20) DEFAULT 'monitor' CHECK (enforcement_mode IN ('monitor', 'throttle', 'block')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(budget_type, budget_scope)
);

-- =============================================================================
-- CREATE PROVIDER RATE LIMITS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS provider_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Provider identification
  provider_name VARCHAR(100) NOT NULL,
  provider_service VARCHAR(100) NOT NULL,
  
  -- Rate limit configuration
  requests_per_second INTEGER DEFAULT NULL,
  requests_per_minute INTEGER DEFAULT NULL,
  requests_per_hour INTEGER DEFAULT NULL,
  requests_per_day INTEGER DEFAULT NULL,
  
  -- Token/usage limits
  tokens_per_minute INTEGER DEFAULT NULL,
  tokens_per_hour INTEGER DEFAULT NULL,
  tokens_per_day INTEGER DEFAULT NULL,
  
  -- Burst configuration
  burst_size INTEGER DEFAULT NULL,
  burst_duration_seconds INTEGER DEFAULT 60,
  
  -- Current usage tracking
  current_requests_per_minute INTEGER DEFAULT 0,
  current_tokens_per_minute INTEGER DEFAULT 0,
  last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Throttling state
  is_throttled BOOLEAN DEFAULT FALSE,
  throttled_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  throttle_reason VARCHAR(200) DEFAULT NULL,
  
  -- Configuration
  auto_scale_enabled BOOLEAN DEFAULT FALSE,
  min_rate_limit INTEGER DEFAULT NULL,
  max_rate_limit INTEGER DEFAULT NULL,
  
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(provider_name, provider_service)
);

-- =============================================================================
-- CREATE COST ALERTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS cost_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Alert identification
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('budget_exceeded', 'threshold_reached', 'anomaly', 'rate_limit', 'projection')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  
  -- Alert details
  provider_name VARCHAR(100) DEFAULT NULL,
  service_name VARCHAR(100) DEFAULT NULL,
  budget_id UUID REFERENCES cost_budgets(id) ON DELETE CASCADE,
  
  -- Values
  threshold_value DECIMAL(15,2) DEFAULT NULL,
  actual_value DECIMAL(15,2) DEFAULT NULL,
  projected_value DECIMAL(15,2) DEFAULT NULL,
  
  -- Alert message
  alert_message TEXT NOT NULL,
  recommendation TEXT DEFAULT NULL,
  
  -- Status
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'ignored')),
  acknowledged_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  acknowledged_by VARCHAR(255) DEFAULT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  resolution_notes TEXT DEFAULT NULL,
  
  -- Notification tracking
  notifications_sent JSONB DEFAULT '[]',
  escalated BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Partitioning helper
  partition_key DATE GENERATED ALWAYS AS (DATE(created_at)) STORED
);

-- =============================================================================
-- CREATE USAGE ANOMALIES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS usage_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Anomaly identification
  provider_name VARCHAR(100) NOT NULL,
  provider_service VARCHAR(100) NOT NULL,
  anomaly_type VARCHAR(50) NOT NULL CHECK (anomaly_type IN ('spike', 'unusual_pattern', 'new_service', 'rate_change', 'cost_spike')),
  
  -- Detection details
  detection_method VARCHAR(100) NOT NULL, -- 'statistical', 'ml_model', 'rule_based', etc.
  confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  
  -- Anomaly metrics
  baseline_value DECIMAL(20,4) NOT NULL,
  anomaly_value DECIMAL(20,4) NOT NULL,
  deviation_percent DECIMAL(10,2) GENERATED ALWAYS AS (
    CASE 
      WHEN baseline_value = 0 THEN 0
      ELSE ((anomaly_value - baseline_value) / baseline_value) * 100
    END
  ) STORED,
  
  -- Impact assessment
  estimated_cost_impact DECIMAL(15,2) DEFAULT NULL,
  affected_users INTEGER DEFAULT NULL,
  affected_services TEXT[] DEFAULT '{}',
  
  -- Investigation
  investigated BOOLEAN DEFAULT FALSE,
  investigation_notes TEXT DEFAULT NULL,
  false_positive BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  occurrence_start TIMESTAMP WITH TIME ZONE NOT NULL,
  occurrence_end TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  
  -- Metadata
  detection_metadata JSONB DEFAULT '{}'
);

-- =============================================================================
-- CREATE PROVIDER PRICING TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS provider_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Provider identification
  provider_name VARCHAR(100) NOT NULL,
  provider_service VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  
  -- Pricing tiers
  tier_name VARCHAR(100) DEFAULT 'standard',
  min_usage DECIMAL(20,4) DEFAULT 0,
  max_usage DECIMAL(20,4) DEFAULT NULL,
  
  -- Pricing
  price_per_unit DECIMAL(10,8) NOT NULL,
  price_unit VARCHAR(50) NOT NULL, -- 'per_request', 'per_1000_tokens', 'per_gb', etc.
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Free tier
  free_tier_limit DECIMAL(20,4) DEFAULT 0,
  
  -- Effective dates
  effective_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  effective_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  
  -- Status
  active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(provider_name, provider_service, resource_type, tier_name, effective_from)
);

-- =============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

-- Provider usage indexes
CREATE INDEX idx_provider_usage_provider ON provider_usage(provider_name, provider_service, recorded_at);
CREATE INDEX idx_provider_usage_period ON provider_usage(billing_period_start, billing_period_end);
CREATE INDEX idx_provider_usage_partition ON provider_usage(partition_key, provider_name);
CREATE INDEX idx_provider_usage_cost ON provider_usage(total_cost DESC) WHERE total_cost > 0;

-- Cost budgets indexes
CREATE INDEX idx_cost_budgets_active ON cost_budgets(budget_type, budget_scope) WHERE active = TRUE;
CREATE INDEX idx_cost_budgets_spend ON cost_budgets(spend_percentage DESC) WHERE active = TRUE;
CREATE INDEX idx_cost_budgets_period ON cost_budgets(budget_period_start, budget_period_end);

-- Provider rate limits indexes
CREATE INDEX idx_rate_limits_provider ON provider_rate_limits(provider_name, provider_service) WHERE active = TRUE;
CREATE INDEX idx_rate_limits_throttled ON provider_rate_limits(is_throttled, throttled_until) WHERE is_throttled = TRUE;

-- Cost alerts indexes
CREATE INDEX idx_cost_alerts_status ON cost_alerts(status, severity, created_at);
CREATE INDEX idx_cost_alerts_provider ON cost_alerts(provider_name, alert_type);
CREATE INDEX idx_cost_alerts_partition ON cost_alerts(partition_key, status);

-- Usage anomalies indexes
CREATE INDEX idx_anomalies_provider ON usage_anomalies(provider_name, provider_service, detected_at);
CREATE INDEX idx_anomalies_investigation ON usage_anomalies(investigated, false_positive) WHERE investigated = FALSE;

-- Provider pricing indexes
CREATE INDEX idx_pricing_provider ON provider_pricing(provider_name, provider_service, resource_type) WHERE active = TRUE;
CREATE INDEX idx_pricing_effective ON provider_pricing(effective_from, effective_until) WHERE active = TRUE;

-- =============================================================================
-- CREATE COST MONITORING FUNCTIONS
-- =============================================================================

-- Function to record provider usage
CREATE OR REPLACE FUNCTION record_provider_usage(
  p_provider_name VARCHAR(100),
  p_provider_service VARCHAR(100),
  p_resource_type VARCHAR(100),
  p_usage_value DECIMAL(20,4),
  p_usage_unit VARCHAR(50),
  p_environment VARCHAR(50) DEFAULT 'production',
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_usage_id UUID;
  v_cost_per_unit DECIMAL(10,6);
  v_current_budget RECORD;
  v_total_cost DECIMAL(15,4);
BEGIN
  -- Get current pricing
  SELECT price_per_unit INTO v_cost_per_unit
  FROM provider_pricing
  WHERE provider_name = p_provider_name
    AND provider_service = p_provider_service
    AND resource_type = p_resource_type
    AND active = TRUE
    AND NOW() BETWEEN effective_from AND COALESCE(effective_until, NOW() + INTERVAL '1 year')
  ORDER BY tier_name, min_usage DESC
  LIMIT 1;
  
  v_cost_per_unit := COALESCE(v_cost_per_unit, 0);
  v_total_cost := p_usage_value * v_cost_per_unit;
  
  -- Record usage
  INSERT INTO provider_usage (
    provider_name,
    provider_service,
    resource_type,
    usage_value,
    usage_unit,
    cost_per_unit,
    billing_period_start,
    billing_period_end,
    environment,
    metadata
  ) VALUES (
    p_provider_name,
    p_provider_service,
    p_resource_type,
    p_usage_value,
    p_usage_unit,
    v_cost_per_unit,
    DATE_TRUNC('month', NOW()),
    DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
    p_environment,
    p_metadata
  ) RETURNING id INTO v_usage_id;
  
  -- Update budget consumption
  UPDATE cost_budgets
  SET 
    current_spend_usd = current_spend_usd + v_total_cost,
    updated_at = NOW()
  WHERE budget_scope = p_provider_name
    AND active = TRUE
    AND NOW() BETWEEN budget_period_start AND budget_period_end;
  
  -- Check budget thresholds
  SELECT * INTO v_current_budget
  FROM cost_budgets
  WHERE budget_scope = p_provider_name
    AND active = TRUE
    AND NOW() BETWEEN budget_period_start AND budget_period_end;
  
  IF FOUND THEN
    PERFORM check_cost_thresholds(v_current_budget.id);
  END IF;
  
  -- Log usage
  INSERT INTO audit_log (table_name, operation, details)
  VALUES ('provider_usage', 'INSERT', jsonb_build_object(
    'usage_id', v_usage_id,
    'provider', p_provider_name,
    'service', p_provider_service,
    'usage_value', p_usage_value,
    'total_cost', v_total_cost
  ));
  
  RETURN v_usage_id;
END;
$$;

-- Function to check cost thresholds and create alerts
CREATE OR REPLACE FUNCTION check_cost_thresholds(
  p_budget_id UUID
) RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_budget RECORD;
  v_alert_message TEXT;
  v_severity VARCHAR(20);
  v_should_throttle BOOLEAN := FALSE;
BEGIN
  -- Get budget details
  SELECT * INTO v_budget
  FROM cost_budgets
  WHERE id = p_budget_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Check 50% threshold
  IF v_budget.spend_percentage >= 50 AND v_budget.spend_percentage < 75 AND v_budget.alert_threshold_50 THEN
    v_alert_message := format('Budget %s has reached 50%% consumption ($%s of $%s)', 
      v_budget.budget_name, v_budget.current_spend_usd, v_budget.monthly_budget_usd);
    v_severity := 'low';
    
    -- Check if alert already exists for this threshold
    IF NOT EXISTS (
      SELECT 1 FROM cost_alerts
      WHERE budget_id = p_budget_id
        AND alert_type = 'threshold_reached'
        AND actual_value >= 50 AND actual_value < 75
        AND created_at > v_budget.budget_period_start
    ) THEN
      INSERT INTO cost_alerts (
        alert_type, severity, budget_id, threshold_value, actual_value,
        alert_message, recommendation
      ) VALUES (
        'threshold_reached', v_severity, p_budget_id, 50, v_budget.spend_percentage,
        v_alert_message, 'Monitor usage closely and consider optimization opportunities'
      );
    END IF;
  END IF;
  
  -- Check 75% threshold
  IF v_budget.spend_percentage >= 75 AND v_budget.spend_percentage < 90 AND v_budget.alert_threshold_75 THEN
    v_alert_message := format('Budget %s has reached 75%% consumption ($%s of $%s)', 
      v_budget.budget_name, v_budget.current_spend_usd, v_budget.monthly_budget_usd);
    v_severity := 'medium';
    
    IF NOT EXISTS (
      SELECT 1 FROM cost_alerts
      WHERE budget_id = p_budget_id
        AND alert_type = 'threshold_reached'
        AND actual_value >= 75 AND actual_value < 90
        AND created_at > v_budget.budget_period_start
    ) THEN
      INSERT INTO cost_alerts (
        alert_type, severity, budget_id, threshold_value, actual_value,
        alert_message, recommendation
      ) VALUES (
        'threshold_reached', v_severity, p_budget_id, 75, v_budget.spend_percentage,
        v_alert_message, 'Review usage patterns and implement cost optimization measures'
      );
    END IF;
  END IF;
  
  -- Check 90% threshold
  IF v_budget.spend_percentage >= 90 AND v_budget.spend_percentage < 100 AND v_budget.alert_threshold_90 THEN
    v_alert_message := format('CRITICAL: Budget %s has reached 90%% consumption ($%s of $%s)', 
      v_budget.budget_name, v_budget.current_spend_usd, v_budget.monthly_budget_usd);
    v_severity := 'high';
    
    IF NOT EXISTS (
      SELECT 1 FROM cost_alerts
      WHERE budget_id = p_budget_id
        AND alert_type = 'threshold_reached'
        AND actual_value >= 90 AND actual_value < 100
        AND created_at > v_budget.budget_period_start
    ) THEN
      INSERT INTO cost_alerts (
        alert_type, severity, budget_id, threshold_value, actual_value,
        alert_message, recommendation
      ) VALUES (
        'threshold_reached', v_severity, p_budget_id, 90, v_budget.spend_percentage,
        v_alert_message, 'Immediate action required to prevent budget overrun'
      );
    END IF;
  END IF;
  
  -- Check 100% threshold
  IF v_budget.spend_percentage >= 100 AND v_budget.alert_threshold_100 THEN
    v_alert_message := format('BUDGET EXCEEDED: %s has exceeded budget ($%s of $%s)', 
      v_budget.budget_name, v_budget.current_spend_usd, v_budget.monthly_budget_usd);
    v_severity := 'critical';
    
    IF NOT EXISTS (
      SELECT 1 FROM cost_alerts
      WHERE budget_id = p_budget_id
        AND alert_type = 'budget_exceeded'
        AND created_at > v_budget.budget_period_start
    ) THEN
      INSERT INTO cost_alerts (
        alert_type, severity, budget_id, threshold_value, actual_value,
        alert_message, recommendation
      ) VALUES (
        'budget_exceeded', v_severity, p_budget_id, 100, v_budget.spend_percentage,
        v_alert_message, 'Budget exceeded - consider blocking non-critical requests'
      );
    END IF;
  END IF;
  
  -- Check if throttling should be enabled
  IF v_budget.spend_percentage >= v_budget.throttle_at_percent AND v_budget.enforcement_mode = 'throttle' THEN
    v_should_throttle := TRUE;
    
    -- Update rate limits for this provider
    UPDATE provider_rate_limits
    SET 
      is_throttled = TRUE,
      throttled_until = NOW() + INTERVAL '1 hour',
      throttle_reason = format('Budget consumption at %s%%', v_budget.spend_percentage),
      updated_at = NOW()
    WHERE provider_name = v_budget.budget_scope;
  END IF;
END;
$$;

-- Function to check rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_provider_name VARCHAR(100),
  p_provider_service VARCHAR(100),
  p_request_count INTEGER DEFAULT 1,
  p_token_count INTEGER DEFAULT NULL
) RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_rate_limit RECORD;
  v_allowed BOOLEAN := TRUE;
  v_minutes_since_reset INTEGER;
BEGIN
  -- Get rate limit configuration
  SELECT * INTO v_rate_limit
  FROM provider_rate_limits
  WHERE provider_name = p_provider_name
    AND provider_service = p_provider_service
    AND active = TRUE;
  
  IF NOT FOUND THEN
    RETURN TRUE; -- No rate limit configured
  END IF;
  
  -- Check if currently throttled
  IF v_rate_limit.is_throttled AND v_rate_limit.throttled_until > NOW() THEN
    RETURN FALSE;
  END IF;
  
  -- Calculate time since last reset
  v_minutes_since_reset := EXTRACT(EPOCH FROM (NOW() - v_rate_limit.last_reset_at)) / 60;
  
  -- Reset counters if needed (every minute)
  IF v_minutes_since_reset >= 1 THEN
    UPDATE provider_rate_limits
    SET 
      current_requests_per_minute = 0,
      current_tokens_per_minute = 0,
      last_reset_at = NOW(),
      is_throttled = FALSE,
      updated_at = NOW()
    WHERE provider_name = p_provider_name
      AND provider_service = p_provider_service;
    
    -- Re-fetch after reset
    SELECT * INTO v_rate_limit
    FROM provider_rate_limits
    WHERE provider_name = p_provider_name
      AND provider_service = p_provider_service
      AND active = TRUE;
  END IF;
  
  -- Check request rate limit
  IF v_rate_limit.requests_per_minute IS NOT NULL THEN
    IF v_rate_limit.current_requests_per_minute + p_request_count > v_rate_limit.requests_per_minute THEN
      v_allowed := FALSE;
      
      -- Create rate limit alert
      INSERT INTO cost_alerts (
        alert_type, severity, provider_name,
        alert_message, recommendation
      ) VALUES (
        'rate_limit', 'high', p_provider_name,
        format('Rate limit exceeded for %s/%s', p_provider_name, p_provider_service),
        'Implement request queuing or increase rate limits'
      );
    END IF;
  END IF;
  
  -- Check token rate limit
  IF v_allowed AND p_token_count IS NOT NULL AND v_rate_limit.tokens_per_minute IS NOT NULL THEN
    IF v_rate_limit.current_tokens_per_minute + p_token_count > v_rate_limit.tokens_per_minute THEN
      v_allowed := FALSE;
    END IF;
  END IF;
  
  -- Update counters if allowed
  IF v_allowed THEN
    UPDATE provider_rate_limits
    SET 
      current_requests_per_minute = current_requests_per_minute + p_request_count,
      current_tokens_per_minute = current_tokens_per_minute + COALESCE(p_token_count, 0),
      updated_at = NOW()
    WHERE provider_name = p_provider_name
      AND provider_service = p_provider_service;
  END IF;
  
  RETURN v_allowed;
END;
$$;

-- Function to detect usage anomalies
CREATE OR REPLACE FUNCTION detect_usage_anomaly(
  p_provider_name VARCHAR(100),
  p_provider_service VARCHAR(100),
  p_current_value DECIMAL(20,4),
  p_resource_type VARCHAR(100)
) RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_baseline_value DECIMAL(20,4);
  v_std_dev DECIMAL(20,4);
  v_anomaly_id UUID;
  v_z_score DECIMAL(10,4);
  v_confidence DECIMAL(3,2);
BEGIN
  -- Calculate baseline from last 30 days
  SELECT 
    AVG(usage_value),
    STDDEV(usage_value)
  INTO v_baseline_value, v_std_dev
  FROM provider_usage
  WHERE provider_name = p_provider_name
    AND provider_service = p_provider_service
    AND resource_type = p_resource_type
    AND recorded_at > NOW() - INTERVAL '30 days'
    AND recorded_at < NOW() - INTERVAL '1 hour'; -- Exclude very recent data
  
  IF v_baseline_value IS NULL OR v_std_dev IS NULL OR v_std_dev = 0 THEN
    RETURN NULL; -- Not enough data for anomaly detection
  END IF;
  
  -- Calculate Z-score
  v_z_score := (p_current_value - v_baseline_value) / v_std_dev;
  
  -- Detect anomaly if Z-score > 3 (99.7% confidence)
  IF ABS(v_z_score) > 3 THEN
    -- Calculate confidence based on Z-score
    v_confidence := LEAST(1.0, ABS(v_z_score) / 4.0);
    
    INSERT INTO usage_anomalies (
      provider_name,
      provider_service,
      anomaly_type,
      detection_method,
      confidence_score,
      baseline_value,
      anomaly_value,
      occurrence_start,
      detection_metadata
    ) VALUES (
      p_provider_name,
      p_provider_service,
      CASE 
        WHEN v_z_score > 0 THEN 'spike'
        ELSE 'unusual_pattern'
      END,
      'statistical',
      v_confidence,
      v_baseline_value,
      p_current_value,
      NOW(),
      jsonb_build_object(
        'z_score', v_z_score,
        'std_dev', v_std_dev,
        'resource_type', p_resource_type
      )
    ) RETURNING id INTO v_anomaly_id;
    
    -- Create anomaly alert
    INSERT INTO cost_alerts (
      alert_type, severity, provider_name,
      threshold_value, actual_value,
      alert_message, recommendation
    ) VALUES (
      'anomaly', 
      CASE 
        WHEN ABS(v_z_score) > 4 THEN 'critical'
        ELSE 'high'
      END,
      p_provider_name,
      v_baseline_value,
      p_current_value,
      format('Usage anomaly detected for %s/%s: %s%% deviation from baseline',
        p_provider_name, p_provider_service, 
        ROUND(((p_current_value - v_baseline_value) / v_baseline_value * 100)::numeric, 2)),
      'Investigate unusual usage pattern and verify if legitimate'
    );
    
    RETURN v_anomaly_id;
  END IF;
  
  RETURN NULL;
END;
$$;

-- =============================================================================
-- CREATE MONITORING VIEWS
-- =============================================================================

-- Provider usage summary view
CREATE OR REPLACE VIEW provider_usage_summary AS
SELECT 
  provider_name,
  provider_service,
  DATE_TRUNC('day', recorded_at) as usage_date,
  COUNT(*) as request_count,
  SUM(usage_value) as total_usage,
  SUM(total_cost) as total_cost_usd,
  AVG(usage_value) as avg_usage,
  MAX(usage_value) as max_usage,
  STRING_AGG(DISTINCT resource_type, ', ') as resource_types
FROM provider_usage
WHERE recorded_at > NOW() - INTERVAL '30 days'
GROUP BY provider_name, provider_service, DATE_TRUNC('day', recorded_at)
ORDER BY usage_date DESC, total_cost_usd DESC;

-- Cost budget status view
CREATE OR REPLACE VIEW cost_budget_status AS
SELECT 
  cb.id,
  cb.budget_name,
  cb.budget_type,
  cb.budget_scope,
  cb.monthly_budget_usd,
  cb.current_spend_usd,
  cb.spend_percentage,
  cb.monthly_budget_usd - cb.current_spend_usd as remaining_budget_usd,
  EXTRACT(DAY FROM (cb.budget_period_end - NOW())) as days_remaining,
  cb.enforcement_mode,
  -- Daily burn rate
  CASE 
    WHEN EXTRACT(DAY FROM (NOW() - cb.budget_period_start)) > 0 
    THEN cb.current_spend_usd / EXTRACT(DAY FROM (NOW() - cb.budget_period_start))
    ELSE 0
  END as daily_burn_rate_usd,
  -- Projected end of month spend
  CASE 
    WHEN EXTRACT(DAY FROM (NOW() - cb.budget_period_start)) > 0 
    THEN (cb.current_spend_usd / EXTRACT(DAY FROM (NOW() - cb.budget_period_start))) * 30
    ELSE 0
  END as projected_monthly_spend_usd,
  -- Budget health
  CASE 
    WHEN cb.spend_percentage >= 100 THEN 'EXCEEDED'
    WHEN cb.spend_percentage >= 90 THEN 'CRITICAL'
    WHEN cb.spend_percentage >= 75 THEN 'WARNING'
    WHEN cb.spend_percentage >= 50 THEN 'CAUTION'
    ELSE 'HEALTHY'
  END as budget_health,
  -- Recent alerts
  COALESCE(alerts.alert_count, 0) as active_alerts
FROM cost_budgets cb
LEFT JOIN (
  SELECT budget_id, COUNT(*) as alert_count
  FROM cost_alerts
  WHERE status = 'open'
  GROUP BY budget_id
) alerts ON cb.id = alerts.budget_id
WHERE cb.active = TRUE
ORDER BY cb.spend_percentage DESC;

-- Provider rate limit status view
CREATE OR REPLACE VIEW rate_limit_status AS
SELECT 
  provider_name,
  provider_service,
  requests_per_minute as rpm_limit,
  current_requests_per_minute as current_rpm,
  CASE 
    WHEN requests_per_minute > 0 
    THEN ROUND((current_requests_per_minute::DECIMAL / requests_per_minute) * 100, 2)
    ELSE 0
  END as rpm_usage_percent,
  tokens_per_minute as tpm_limit,
  current_tokens_per_minute as current_tpm,
  is_throttled,
  throttled_until,
  throttle_reason,
  last_reset_at
FROM provider_rate_limits
WHERE active = TRUE
ORDER BY provider_name, provider_service;

-- Top cost drivers view
CREATE OR REPLACE VIEW top_cost_drivers AS
SELECT 
  provider_name,
  provider_service,
  resource_type,
  COUNT(*) as usage_count,
  SUM(usage_value) as total_usage,
  SUM(total_cost) as total_cost_usd,
  AVG(total_cost) as avg_cost_per_usage,
  MAX(total_cost) as max_single_cost
FROM provider_usage
WHERE recorded_at > NOW() - INTERVAL '7 days'
  AND total_cost > 0
GROUP BY provider_name, provider_service, resource_type
ORDER BY total_cost_usd DESC
LIMIT 20;

-- =============================================================================
-- ENABLE RLS
-- =============================================================================

ALTER TABLE provider_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_pricing ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "provider_usage_service_role" ON provider_usage
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "cost_budgets_service_role" ON cost_budgets
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "rate_limits_service_role" ON provider_rate_limits
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "cost_alerts_service_role" ON cost_alerts
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "anomalies_service_role" ON usage_anomalies
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "pricing_service_role" ON provider_pricing
  FOR ALL USING (current_setting('role') = 'service_role');

-- Authenticated users can read cost data
CREATE POLICY "usage_read" ON provider_usage
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "budgets_read" ON cost_budgets
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "alerts_read" ON cost_alerts
  FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION record_provider_usage TO service_role;
GRANT EXECUTE ON FUNCTION check_cost_thresholds TO service_role;
GRANT EXECUTE ON FUNCTION check_rate_limit TO service_role;
GRANT EXECUTE ON FUNCTION detect_usage_anomaly TO service_role;

GRANT SELECT ON provider_usage_summary TO anon, authenticated, service_role;
GRANT SELECT ON cost_budget_status TO anon, authenticated, service_role;
GRANT SELECT ON rate_limit_status TO anon, authenticated, service_role;
GRANT SELECT ON top_cost_drivers TO anon, authenticated, service_role;

-- =============================================================================
-- CREATE INITIAL CONFIGURATIONS
-- =============================================================================

-- Insert provider pricing
INSERT INTO provider_pricing (
  provider_name, provider_service, resource_type, tier_name,
  min_usage, max_usage, price_per_unit, price_unit, free_tier_limit
) VALUES 
  -- OpenAI GPT-4
  ('openai', 'gpt-4', 'input_tokens', 'standard', 0, NULL, 0.00003, 'per_token', 0),
  ('openai', 'gpt-4', 'output_tokens', 'standard', 0, NULL, 0.00006, 'per_token', 0),
  
  -- OpenAI GPT-3.5
  ('openai', 'gpt-3.5-turbo', 'input_tokens', 'standard', 0, NULL, 0.0000015, 'per_token', 0),
  ('openai', 'gpt-3.5-turbo', 'output_tokens', 'standard', 0, NULL, 0.000002, 'per_token', 0),
  
  -- Supabase
  ('supabase', 'database', 'requests', 'free', 0, 500000, 0, 'per_request', 500000),
  ('supabase', 'database', 'requests', 'pro', 500001, NULL, 0.000001, 'per_request', 0),
  ('supabase', 'storage', 'bytes', 'free', 0, 1073741824, 0, 'per_byte', 1073741824), -- 1GB free
  ('supabase', 'storage', 'bytes', 'pro', 1073741824, NULL, 0.000000021, 'per_byte', 0), -- $0.021 per GB
  
  -- Discord API
  ('discord', 'api', 'requests', 'standard', 0, NULL, 0, 'per_request', 1000000),
  
  -- Temporal
  ('temporal', 'workflows', 'executions', 'standard', 0, NULL, 0.00001, 'per_execution', 10000),
  ('temporal', 'activities', 'executions', 'standard', 0, NULL, 0.000001, 'per_execution', 100000)

ON CONFLICT (provider_name, provider_service, resource_type, tier_name, effective_from) 
DO UPDATE SET
  price_per_unit = EXCLUDED.price_per_unit,
  updated_at = NOW();

-- Insert cost budgets
INSERT INTO cost_budgets (
  budget_name, budget_type, budget_scope, monthly_budget_usd,
  throttle_at_percent, block_at_percent, enforcement_mode
) VALUES 
  ('OpenAI GPT-4 Budget', 'provider', 'openai', 500.00, 80.0, 100.0, 'throttle'),
  ('Supabase Budget', 'provider', 'supabase', 200.00, 90.0, 100.0, 'monitor'),
  ('Temporal Budget', 'provider', 'temporal', 100.00, 85.0, 100.0, 'monitor'),
  ('Production Environment', 'environment', 'production', 1000.00, 85.0, 100.0, 'throttle'),
  ('Global Monthly Budget', 'global', 'global', 2000.00, 90.0, 100.0, 'monitor')

ON CONFLICT (budget_type, budget_scope) DO UPDATE SET
  monthly_budget_usd = EXCLUDED.monthly_budget_usd,
  updated_at = NOW();

-- Insert rate limits
INSERT INTO provider_rate_limits (
  provider_name, provider_service,
  requests_per_minute, requests_per_hour, requests_per_day,
  tokens_per_minute, tokens_per_hour,
  burst_size, auto_scale_enabled
) VALUES 
  ('openai', 'gpt-4', 20, 1000, 10000, 40000, 2000000, 50, TRUE),
  ('openai', 'gpt-3.5-turbo', 60, 3000, 50000, 90000, 5000000, 100, TRUE),
  ('supabase', 'database', 100, 5000, 100000, NULL, NULL, 200, FALSE),
  ('discord', 'api', 50, 2000, 30000, NULL, NULL, 100, FALSE),
  ('temporal', 'workflows', 10, 500, 10000, NULL, NULL, 20, FALSE)

ON CONFLICT (provider_name, provider_service) DO UPDATE SET
  requests_per_minute = EXCLUDED.requests_per_minute,
  updated_at = NOW();

-- =============================================================================
-- MIGRATION VERIFICATION
-- =============================================================================

DO $$
DECLARE
  v_usage_id UUID;
  v_allowed BOOLEAN;
  v_anomaly_id UUID;
  v_budget_health VARCHAR(20);
BEGIN
  -- Test usage recording
  SELECT record_provider_usage(
    'openai',
    'gpt-4',
    'input_tokens',
    1500.0,
    'tokens',
    'test',
    '{"model": "gpt-4", "prompt_type": "test"}'::jsonb
  ) INTO v_usage_id;
  
  -- Test rate limit checking
  SELECT check_rate_limit(
    'openai',
    'gpt-4',
    1,
    1500
  ) INTO v_allowed;
  
  -- Test anomaly detection
  SELECT detect_usage_anomaly(
    'openai',
    'gpt-4',
    50000.0,
    'input_tokens'
  ) INTO v_anomaly_id;
  
  -- Test budget status
  SELECT budget_health INTO v_budget_health
  FROM cost_budget_status
  WHERE budget_scope = 'openai'
  LIMIT 1;
  
  -- Test views
  PERFORM * FROM provider_usage_summary LIMIT 1;
  PERFORM * FROM rate_limit_status LIMIT 1;
  PERFORM * FROM top_cost_drivers LIMIT 1;
  
  -- Cleanup test data
  DELETE FROM cost_alerts WHERE provider_name IN ('openai', 'test') AND created_at > NOW() - INTERVAL '1 minute';
  DELETE FROM usage_anomalies WHERE provider_name = 'openai' AND detected_at > NOW() - INTERVAL '1 minute';
  DELETE FROM provider_usage WHERE id = v_usage_id;
  
  RAISE NOTICE 'Cost guardrails verification successful. Usage ID: %, Rate limit allowed: %, Budget health: %', 
    v_usage_id, v_allowed, v_budget_health;
END;
$$;

-- Migration completed
INSERT INTO audit_log (table_name, operation, details)
VALUES ('migration', 'COMPLETE', jsonb_build_object(
  'migration', '20250812_cost_guardrails',
  'timestamp', NOW(),
  'description', 'Provider usage monitoring, cost budgets, rate limiting, and anomaly detection'
));