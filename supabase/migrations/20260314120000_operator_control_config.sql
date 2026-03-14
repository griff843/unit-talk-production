-- Migration: Add operator control plane config rows to risk_engine_config
-- Sprint: SPRINT-042-LAYER2-PHASE6-OPERATOR-CONTROL-PLANE
-- Layer/Phase: Layer 2 / Phase 6 — Operator Control Plane
-- Rollback:
--   DELETE FROM risk_engine_config
--   WHERE config_key IN ('autopilot_mode', 'canary_percentage');

-- autopilot_mode: current runtime mode (off | log_only | canary | prod)
-- Default 'off' — env var AUTOPILOT_MODE takes precedence on container start;
-- this row is used by PUT /ops/autopilot to persist operator changes.
INSERT INTO risk_engine_config (config_key, config_value, description, updated_by)
VALUES (
  'autopilot_mode',
  'off',
  'Autopilot runtime mode: off | log_only | canary | prod. Updated by operator API.',
  'system'
)
ON CONFLICT (config_key) DO NOTHING;

-- canary_percentage: pct of side effects allowed in canary mode (0–100)
INSERT INTO risk_engine_config (config_key, config_value, description, updated_by)
VALUES (
  'canary_percentage',
  '0',
  'Canary rollout percentage (0–100). Active when autopilot_mode=canary.',
  'system'
)
ON CONFLICT (config_key) DO NOTHING;
