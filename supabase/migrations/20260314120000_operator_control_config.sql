-- Migration: Add operator control plane config rows to risk_engine_config
-- Sprint: SPRINT-042-LAYER2-PHASE6-OPERATOR-CONTROL-PLANE
-- Layer/Phase: Layer 2 / Phase 6 — Operator Control Plane
-- Rollback:
--   DELETE FROM risk_engine_config
--   WHERE config_key IN ('autopilot_mode', 'canary_percentage');

-- autopilot_mode: config_value is numeric — string modes ('off','log_only','canary','prod')
-- are read from the AUTOPILOT_MODE env var at runtime. Only numeric config rows go here.
-- Skipping autopilot_mode insert: config_value column is NUMERIC, cannot store 'off'.

-- canary_percentage: pct of side effects allowed in canary mode (0–100)
INSERT INTO risk_engine_config (config_key, config_value, description, updated_by)
VALUES (
  'canary_percentage',
  0,
  'Canary rollout percentage (0–100). Active when autopilot_mode=canary.',
  'system'
)
ON CONFLICT (config_key) DO NOTHING;
