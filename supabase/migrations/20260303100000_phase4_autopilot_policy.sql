-- ============================================================================
-- Phase 4: Autopilot Policy - Database Migration
-- ============================================================================
-- Copied from scripts/db/phase4_autopilot_policy.sql with idempotent policy guards.
--
-- Tables:
-- 1. autopilot_decisions - Immutable decision ledger (append-only)
-- 2. autopilot_policy_config - Policy configuration storage
-- 3. autopilot_cooldowns - Active cooldown tracking
-- ============================================================================

-- ============================================================================
-- 1. autopilot_decisions - Decision Ledger (IMMUTABLE)
-- ============================================================================
CREATE TABLE IF NOT EXISTS autopilot_decisions (
  decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('OFF', 'SHADOW', 'CANARY', 'AUTO')),
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  evaluation_result TEXT NOT NULL CHECK (evaluation_result IN ('ALLOW', 'DENY', 'SHADOW_ONLY')),
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  reason_message TEXT NOT NULL,
  executed BOOLEAN NOT NULL DEFAULT false,
  execution_result JSONB,
  operator_override JSONB,
  rollback_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_autopilot_decisions_trace_id ON autopilot_decisions(trace_id);
CREATE INDEX IF NOT EXISTS idx_autopilot_decisions_action_type ON autopilot_decisions(action_type);
CREATE INDEX IF NOT EXISTS idx_autopilot_decisions_created_at ON autopilot_decisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_autopilot_decisions_evaluation_result ON autopilot_decisions(evaluation_result);
CREATE INDEX IF NOT EXISTS idx_autopilot_decisions_mode ON autopilot_decisions(mode);
CREATE INDEX IF NOT EXISTS idx_autopilot_decisions_action_created ON autopilot_decisions(action_type, created_at DESC);

-- ============================================================================
-- 2. autopilot_policy_config - Policy Configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS autopilot_policy_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  version TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT NOT NULL,
  default_mode TEXT NOT NULL DEFAULT 'SHADOW' CHECK (default_mode IN ('OFF', 'SHADOW', 'CANARY', 'AUTO')),
  canary_percentage INTEGER NOT NULL DEFAULT 10 CHECK (canary_percentage >= 0 AND canary_percentage <= 100),
  fail_closed BOOLEAN NOT NULL DEFAULT true,
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  operator_overrides JSONB NOT NULL DEFAULT '{
    "global_freeze": false,
    "agent_freezes": {},
    "action_freezes": {}
  }'::jsonb
);

INSERT INTO autopilot_policy_config (id, version, updated_by, rules)
VALUES (
  'default',
  '1.0.0',
  'system',
  '[
    {"id":"publish-pick","action_type":"PUBLISH_PICK","enabled":true,"allowed_modes":["CANARY","AUTO"],"min_sample_size":30,"min_confidence_score":0.65,"min_confidence_tier":"A","min_clv_positive_rate":0.55,"require_healthy_platform":true,"require_slo_compliance":true,"cooldown_seconds":60,"cooldown_scope":"entity"},
    {"id":"publish-alert","action_type":"PUBLISH_ALERT","enabled":true,"allowed_modes":["CANARY","AUTO"],"min_sample_size":10,"min_confidence_score":0.50,"require_healthy_platform":true,"cooldown_seconds":300,"cooldown_scope":"entity"},
    {"id":"adjust-sizing","action_type":"ADJUST_SIZING","enabled":true,"allowed_modes":["AUTO"],"min_sample_size":50,"min_confidence_score":0.70,"min_clv_positive_rate":0.60,"max_exposure":0.20,"require_healthy_platform":true,"require_slo_compliance":true},
    {"id":"generate-hedge-alert","action_type":"GENERATE_HEDGE_ALERT","enabled":true,"allowed_modes":["CANARY","AUTO"],"min_sample_size":20,"min_confidence_score":0.60,"require_healthy_platform":true,"cooldown_seconds":300,"cooldown_scope":"entity"},
    {"id":"demote-capper","action_type":"DEMOTE_CAPPER","enabled":true,"allowed_modes":["AUTO"],"min_sample_size":100,"min_confidence_score":0.80,"require_healthy_platform":true,"require_slo_compliance":true},
    {"id":"pause-agent","action_type":"PAUSE_AGENT","enabled":true,"allowed_modes":["CANARY","AUTO"],"require_healthy_platform":false},
    {"id":"auto-promote","action_type":"AUTO_PROMOTE","enabled":true,"allowed_modes":["AUTO"],"min_sample_size":30,"min_confidence_score":0.75,"min_confidence_tier":"A","min_clv_positive_rate":0.60,"require_healthy_platform":true,"require_slo_compliance":true},
    {"id":"send-notification","action_type":"SEND_NOTIFICATION","enabled":true,"allowed_modes":["CANARY","AUTO"],"require_healthy_platform":true,"cooldown_seconds":60,"cooldown_scope":"entity"},
    {"id":"apply-cooldown","action_type":"APPLY_COOLDOWN","enabled":true,"allowed_modes":["CANARY","AUTO"]},
    {"id":"update-tier","action_type":"UPDATE_TIER","enabled":true,"allowed_modes":["AUTO"],"min_sample_size":50,"min_confidence_score":0.70,"require_healthy_platform":true,"require_slo_compliance":true}
  ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. autopilot_cooldowns - Cooldown Tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS autopilot_cooldowns (
  entity_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_id, action_type)
);

CREATE INDEX IF NOT EXISTS idx_autopilot_cooldowns_expires_at ON autopilot_cooldowns(expires_at);

-- ============================================================================
-- 4. Views for Analysis
-- ============================================================================
CREATE OR REPLACE VIEW v_autopilot_decisions_summary AS
SELECT
  DATE_TRUNC('hour', created_at) AS hour,
  action_type, mode, evaluation_result,
  COUNT(*) AS decision_count,
  COUNT(*) FILTER (WHERE executed = true) AS executed_count,
  COUNT(*) FILTER (WHERE evaluation_result = 'ALLOW') AS allow_count,
  COUNT(*) FILTER (WHERE evaluation_result = 'DENY') AS deny_count,
  COUNT(*) FILTER (WHERE evaluation_result = 'SHADOW_ONLY') AS shadow_count
FROM autopilot_decisions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at), action_type, mode, evaluation_result
ORDER BY hour DESC, action_type;

CREATE OR REPLACE VIEW v_autopilot_policy_violations AS
SELECT
  decision_id, trace_id, action_type, mode, evaluation_result,
  reason_codes, reason_message,
  inputs->>'context'->>'agent_name' AS agent_name,
  evidence, created_at
FROM autopilot_decisions
WHERE evaluation_result = 'DENY'
  AND NOT ('OPERATOR_FREEZE_ACTIVE' = ANY(reason_codes))
  AND NOT ('MODE_OFF' = ANY(reason_codes))
  AND NOT ('MODE_SHADOW' = ANY(reason_codes))
ORDER BY created_at DESC
LIMIT 100;

CREATE OR REPLACE VIEW v_autopilot_operator_overrides AS
SELECT
  decision_id, trace_id, action_type,
  operator_override->>'override_type' AS override_type,
  operator_override->>'override_by' AS override_by,
  operator_override->>'override_at' AS override_at,
  created_at
FROM autopilot_decisions
WHERE operator_override IS NOT NULL
ORDER BY created_at DESC;

-- ============================================================================
-- 5. Functions
-- ============================================================================
CREATE OR REPLACE FUNCTION get_active_cooldowns(p_entity_id TEXT)
RETURNS TABLE (action_type TEXT, expires_at TIMESTAMPTZ, remaining_seconds INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT c.action_type, c.expires_at,
    GREATEST(0, EXTRACT(EPOCH FROM (c.expires_at - NOW()))::INTEGER) AS remaining_seconds
  FROM autopilot_cooldowns c
  WHERE c.entity_id = p_entity_id AND c.expires_at > NOW();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_expired_cooldowns()
RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM autopilot_cooldowns WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_autopilot_decision_stats(p_hours INTEGER DEFAULT 24)
RETURNS TABLE (
  total_decisions BIGINT, allow_count BIGINT, deny_count BIGINT,
  shadow_count BIGINT, executed_count BIGINT,
  allow_rate NUMERIC, execution_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) AS total_decisions,
    COUNT(*) FILTER (WHERE d.evaluation_result = 'ALLOW') AS allow_count,
    COUNT(*) FILTER (WHERE d.evaluation_result = 'DENY') AS deny_count,
    COUNT(*) FILTER (WHERE d.evaluation_result = 'SHADOW_ONLY') AS shadow_count,
    COUNT(*) FILTER (WHERE d.executed = true) AS executed_count,
    ROUND(COUNT(*) FILTER (WHERE d.evaluation_result = 'ALLOW')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) AS allow_rate,
    ROUND(COUNT(*) FILTER (WHERE d.executed = true)::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE d.evaluation_result = 'ALLOW'), 0) * 100, 2) AS execution_rate
  FROM autopilot_decisions d
  WHERE d.created_at > NOW() - (p_hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. Triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION prevent_decision_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'autopilot_decisions is append-only. Updates are not allowed.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_prevent_decision_update ON autopilot_decisions;
CREATE TRIGGER tr_prevent_decision_update
BEFORE UPDATE ON autopilot_decisions
FOR EACH ROW EXECUTE FUNCTION prevent_decision_update();

CREATE OR REPLACE FUNCTION prevent_decision_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'autopilot_decisions is immutable. Deletes are not allowed.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_prevent_decision_delete ON autopilot_decisions;
CREATE TRIGGER tr_prevent_decision_delete
BEFORE DELETE ON autopilot_decisions
FOR EACH ROW EXECUTE FUNCTION prevent_decision_delete();

-- ============================================================================
-- 7. Row Level Security (RLS)
-- ============================================================================
ALTER TABLE autopilot_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE autopilot_policy_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE autopilot_cooldowns ENABLE ROW LEVEL SECURITY;

-- Idempotent policy creation: drop-then-create
DROP POLICY IF EXISTS "Service role has full access to decisions" ON autopilot_decisions;
CREATE POLICY "Service role has full access to decisions"
ON autopilot_decisions FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access to policy config" ON autopilot_policy_config;
CREATE POLICY "Service role has full access to policy config"
ON autopilot_policy_config FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access to cooldowns" ON autopilot_cooldowns;
CREATE POLICY "Service role has full access to cooldowns"
ON autopilot_cooldowns FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read decisions" ON autopilot_decisions;
CREATE POLICY "Authenticated users can read decisions"
ON autopilot_decisions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read policy config" ON autopilot_policy_config;
CREATE POLICY "Authenticated users can read policy config"
ON autopilot_policy_config FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- Migration complete
-- ============================================================================
