-- Add missing columns to daily_picks table
ALTER TABLE daily_picks 
ADD COLUMN IF NOT EXISTS confidence DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS grade TEXT CHECK (grade IN ('S', 'A', 'B', 'C', 'D', 'F')) DEFAULT 'C',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_daily_picks_confidence ON daily_picks(confidence);
CREATE INDEX IF NOT EXISTS idx_daily_picks_grade ON daily_picks(grade);

-- Add comment for documentation
COMMENT ON COLUMN daily_picks.confidence IS 'Confidence professional_score for the pick, typically derived from edge_score';
COMMENT ON COLUMN daily_picks.grade IS 'Grade assigned to the pick (S, A, B, C, D, F)';
COMMENT ON COLUMN daily_picks.metadata IS 'Additional metadata for the pick in JSON format'; 