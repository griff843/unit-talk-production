-- Replace legacy daily_picks table with a compatibility view over unified_picks

DROP VIEW IF EXISTS daily_picks CASCADE;
DROP TABLE IF EXISTS daily_picks CASCADE;

CREATE OR REPLACE VIEW daily_picks AS
SELECT 
  up.id,
  u.discord_id AS capper_discord_id,
  u.username AS capper,
  up.outcome AS selection,
  up.odds,
  up.stake AS units,
  up.confidence AS confidence_score,
  up.analysis,
  up.tier_when_placed AS tier,
  up.pick_type AS play_type,
  NULL::UUID AS parlay_id,
  NULL::INT AS total_legs,
  NULL::INT AS total_odds,
  up.workflow_stage AS status,
  up.placed_at AS created_at,
  up.updated_at
FROM unified_picks up
JOIN users u ON up.user_id = u.id
WHERE up.pick_source = 'manual';

-- Optional: prevent accidental writes through the view
CREATE OR REPLACE RULE daily_picks_no_insert AS
  ON INSERT TO daily_picks DO INSTEAD NOTHING;
CREATE OR REPLACE RULE daily_picks_no_update AS
  ON UPDATE TO daily_picks DO INSTEAD NOTHING;
CREATE OR REPLACE RULE daily_picks_no_delete AS
  ON DELETE TO daily_picks DO INSTEAD NOTHING;

