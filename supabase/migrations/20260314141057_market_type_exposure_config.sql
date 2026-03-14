-- Migration: Add market_type_kelly_limit to risk_engine_config
-- Sprint: SPRINT-041-MARKET-TYPE-EXPOSURE-CAPS
-- Rollback: DELETE FROM risk_engine_config WHERE config_key = 'market_type_kelly_limit';

INSERT INTO risk_engine_config (config_key, config_value, description, updated_by)
VALUES (
  'market_type_kelly_limit',
  0.35,
  'Max Kelly exposure per market category (player_prop, game_line, team_total, alternate, futures, special)',
  'system'
)
ON CONFLICT (config_key) DO NOTHING;
