/**
 * Daily Recaps Table Migration
 *
 * Creates table for storing daily recap summaries with CLV data,
 * sport breakdowns, and performance metrics.
 *
 * Phase 2 Step 5 - Daily Recap Automation
 *
 * Features:
 * - Idempotent daily recap generation (unique on recap_date)
 * - CLV distribution tracking by buckets
 * - Per-sport breakdown of performance
 * - Support for future extensions via metadata JSONB
 * - Indexed by recap_date for efficient queries
 */

-- Create daily_recaps table
CREATE TABLE IF NOT EXISTS daily_recaps (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recap date (unique constraint for idempotency)
  recap_date DATE NOT NULL UNIQUE,

  -- Overall metrics
  total_picks INTEGER NOT NULL DEFAULT 0,
  win_rate DECIMAL(5, 4), -- Win rate as decimal (0.0000 to 1.0000)
  avg_clv_bps INTEGER, -- Average CLV in basis points (e.g., 250 = 2.50%)

  -- CLV distribution buckets
  -- Tracks how many picks fall into each CLV range
  clv_distribution JSONB DEFAULT '{}',
  -- Example structure:
  -- {
  --   "[-200,-100)": 5,
  --   "[-100,-50)": 12,
  --   "[-50,0)": 23,
  --   "[0,50)": 45,
  --   "[50,100)": 32,
  --   "[100,200)": 18,
  --   "[200,+)": 8
  -- }

  -- Sport-level breakdown
  sport_breakdown JSONB DEFAULT '{}',
  -- Example structure:
  -- {
  --   "nfl": {
  --     "total_picks": 45,
  --     "wins": 28,
  --     "losses": 15,
  --     "pushes": 2,
  --     "win_rate": 0.6222,
  --     "avg_clv_bps": 125,
  --     "total_units": 5.5
  --   },
  --   "nba": { ... }
  -- }

  -- Capper-level breakdown (optional, for multi-capper recaps)
  capper_breakdown JSONB DEFAULT '{}',
  -- Example structure:
  -- {
  --   "Griff843": {
  --     "total_picks": 12,
  --     "win_rate": 0.75,
  --     "avg_clv_bps": 200
  --   }
  -- }

  -- Top performers
  top_picks JSONB DEFAULT '[]',
  -- Array of pick IDs for top 5 performing picks
  -- Example: ["pick-id-1", "pick-id-2", "pick-id-3"]

  -- Summary statistics
  total_units DECIMAL(10, 2), -- Net units won/lost
  roi DECIMAL(10, 4), -- Return on investment as decimal

  -- Grading status counts (if grading data is available)
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  pushes INTEGER DEFAULT 0,
  pending INTEGER DEFAULT 0, -- Picks not yet graded

  -- Metadata for future extensions
  metadata JSONB DEFAULT '{}',
  -- Can store additional data like:
  -- - External recap IDs
  -- - Discord message IDs
  -- - Additional analytics
  -- - Feature flags

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on recap_date for efficient date-based queries
CREATE INDEX IF NOT EXISTS idx_daily_recaps_recap_date ON daily_recaps(recap_date DESC);

-- Create index on created_at for time-series queries
CREATE INDEX IF NOT EXISTS idx_daily_recaps_created_at ON daily_recaps(created_at DESC);

-- Create GIN index on sport_breakdown for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_daily_recaps_sport_breakdown ON daily_recaps USING GIN (sport_breakdown);

-- Create GIN index on metadata for flexible querying
CREATE INDEX IF NOT EXISTS idx_daily_recaps_metadata ON daily_recaps USING GIN (metadata);

-- Create trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_daily_recaps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_recaps_updated_at_trigger
  BEFORE UPDATE ON daily_recaps
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_recaps_updated_at();

-- Add comments for documentation
COMMENT ON TABLE daily_recaps IS 'Daily recap summaries with CLV data and performance metrics';
COMMENT ON COLUMN daily_recaps.recap_date IS 'Date of the recap (unique, used for idempotency)';
COMMENT ON COLUMN daily_recaps.avg_clv_bps IS 'Average CLV in basis points (100 bps = 1%)';
COMMENT ON COLUMN daily_recaps.clv_distribution IS 'CLV distribution buckets showing count per range';
COMMENT ON COLUMN daily_recaps.sport_breakdown IS 'Per-sport performance metrics';
COMMENT ON COLUMN daily_recaps.capper_breakdown IS 'Per-capper performance metrics';
COMMENT ON COLUMN daily_recaps.top_picks IS 'Array of top performing pick IDs';
COMMENT ON COLUMN daily_recaps.metadata IS 'Extensible metadata field for future features';
