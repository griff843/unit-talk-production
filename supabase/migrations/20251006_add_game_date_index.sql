-- Add index on game_date for faster queries on settled_outcomes
-- This will dramatically speed up date-filtered queries for ML training

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_settled_outcomes_game_date
ON settled_outcomes (game_date DESC);

-- Add composite index for ML training queries (sport + game_date + outcome)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_settled_outcomes_ml_training
ON settled_outcomes (sport, game_date DESC, outcome)
WHERE actual_value IS NOT NULL;

-- Add index on sport for count queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_settled_outcomes_sport
ON settled_outcomes (sport);

COMMENT ON INDEX idx_settled_outcomes_game_date IS 'Speeds up date-filtered queries for ML training';
COMMENT ON INDEX idx_settled_outcomes_ml_training IS 'Composite index optimized for ML training data fetches';
COMMENT ON INDEX idx_settled_outcomes_sport IS 'Speeds up sport-based aggregations';
