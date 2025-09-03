-- Indexes for high-throughput operations

-- unified_picks
CREATE INDEX IF NOT EXISTS idx_up_status_created ON unified_picks(status, placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_up_stage_created ON unified_picks(workflow_stage, placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_up_user_created ON unified_picks(user_id, placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_up_game_created ON unified_picks(game_id, placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_up_published_created ON unified_picks(placed_at DESC) WHERE published;

-- grading_results
CREATE INDEX IF NOT EXISTS idx_gr_unified ON grading_results(unified_pick_id);
CREATE INDEX IF NOT EXISTS idx_gr_tier ON grading_results(tier);
CREATE INDEX IF NOT EXISTS idx_gr_created ON grading_results(created_at DESC);

