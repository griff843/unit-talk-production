-- Add confidence column to daily_picks table
ALTER TABLE daily_picks 
ADD COLUMN IF NOT EXISTS confidence DECIMAL DEFAULT 0;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_daily_picks_confidence 
ON daily_picks(confidence);

-- Add comment for documentation
COMMENT ON COLUMN daily_picks.confidence IS 'Confidence professional_score for the pick, typically derived from edge_score'; 