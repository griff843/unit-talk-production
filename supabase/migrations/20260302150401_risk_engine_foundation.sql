-- ============================================================================
-- RISK ENGINE FOUNDATION
-- Sprint: RISK-ENGINE-FOUNDATION-001
-- Date: 2026-03-02
--
-- PURPOSE:
-- Create foundational tables for the Risk Engine: audit logging (risk_events),
-- configurable thresholds (risk_engine_config), and model calibration tracking
-- (drift_snapshots). These tables support fail-closed enforcement of exposure
-- limits and drift throttling in the promotion pipeline.
--
-- TABLES CREATED:
-- 1. risk_events       - Audit log for all risk engine decisions
-- 2. risk_engine_config - Tunable threshold configuration
-- 3. drift_snapshots    - Model calibration tracking from settled legs
--
-- ROLLBACK: See end of file
-- ============================================================================

-- ============================================================================
-- 1. RISK EVENTS (Audit Log)
-- ============================================================================

CREATE TABLE IF NOT EXISTS risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event identification
  event_type TEXT NOT NULL CHECK (event_type IN (
    'EXPOSURE_CHECK',
    'EXPOSURE_BREACH',
    'DRIFT_CHECK',
    'DRIFT_THROTTLE',
    'PROMOTION_BLOCKED',
    'PROMOTION_ALLOWED',
    'ENGINE_ERROR'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical', 'emergency')),

  -- Context
  pick_id UUID,
  sport TEXT,
  event_id UUID,

  -- Decision
  decision TEXT CHECK (decision IN ('ALLOW', 'BLOCK', 'THROTTLE', 'N/A')),
  reason_codes TEXT[] NOT NULL DEFAULT '{}',

  -- Snapshots at decision time
  exposure_snapshot JSONB,
  drift_snapshot JSONB,
  config_snapshot JSONB,

  -- Metadata
  trace_id TEXT,
  agent_name TEXT DEFAULT 'RiskEngine',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_risk_events_type ON risk_events(event_type);
CREATE INDEX idx_risk_events_created ON risk_events(created_at DESC);
CREATE INDEX idx_risk_events_pick ON risk_events(pick_id) WHERE pick_id IS NOT NULL;
CREATE INDEX idx_risk_events_severity ON risk_events(severity) WHERE severity IN ('critical', 'emergency');

COMMENT ON TABLE risk_events IS
  'Audit log for all risk engine decisions. Fail-closed enforcement. Sprint: RISK-ENGINE-FOUNDATION-001';

-- ============================================================================
-- 2. RISK ENGINE CONFIG (Thresholds)
-- ============================================================================

CREATE TABLE IF NOT EXISTS risk_engine_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  config_key TEXT NOT NULL UNIQUE,
  config_value NUMERIC(10,5) NOT NULL,
  description TEXT,

  updated_by TEXT NOT NULL DEFAULT 'system',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default thresholds (fail-closed: conservative defaults)
INSERT INTO risk_engine_config (config_key, config_value, description) VALUES
  ('total_kelly_high',     0.60,  'HIGH: block new promotions when total kelly > this'),
  ('total_kelly_critical', 1.00,  'CRITICAL: block ALL promotions when total kelly > this'),
  ('event_kelly_limit',    0.25,  'Block promotions for event when event kelly > this'),
  ('drift_brier_block',    0.35,  'Block promotions when global brier_score > this'),
  ('drift_min_settled',    30.00, 'Minimum settled legs for drift evaluation'),
  ('engine_enabled',       1.00,  '1=enabled, 0=disabled (bypass, allow all)')
ON CONFLICT (config_key) DO NOTHING;

COMMENT ON TABLE risk_engine_config IS
  'Risk engine thresholds. Updatable at runtime. Sprint: RISK-ENGINE-FOUNDATION-001';

-- ============================================================================
-- 3. DRIFT SNAPSHOTS (Model Calibration Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS drift_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sample_size INTEGER NOT NULL,

  -- Calibration metrics
  brier_score NUMERIC(10,6),
  win_rate_actual NUMERIC(10,6),
  win_rate_predicted NUMERIC(10,6),
  calibration_gap NUMERIC(10,6),

  -- Decision
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  config_at_compute JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_drift_snapshots_computed ON drift_snapshots(computed_at DESC);

COMMENT ON TABLE drift_snapshots IS
  'Model calibration tracking computed from settled scored_legs. Sprint: RISK-ENGINE-FOUNDATION-001';

-- ============================================================================
-- ROLLBACK:
-- DROP TABLE IF EXISTS drift_snapshots;
-- DROP TABLE IF EXISTS risk_engine_config;
-- DROP TABLE IF EXISTS risk_events;
-- ============================================================================
