-- Migration 030: ML Weight Optimization Support
-- Add database functions to support ML training pipeline

-- Function to count outcomes by sport for training
CREATE OR REPLACE FUNCTION count_outcomes_by_sport()
RETURNS TABLE (
  sport TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    so.sport,
    COUNT(*)::BIGINT as count
  FROM settled_outcomes so
  WHERE
    so.actual_value IS NOT NULL
    AND so.actual_value <> -1
    AND so.outcome IN ('win', 'loss')
  GROUP BY so.sport
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to fetch training sample for ML optimization
CREATE OR REPLACE FUNCTION fetch_training_sample(
  p_sport TEXT,
  p_limit INTEGER DEFAULT 10000
)
RETURNS TABLE (
  id UUID,
  sport TEXT,
  player_name TEXT,
  market_type TEXT,
  line NUMERIC,
  odds INTEGER,
  actual_value NUMERIC,
  outcome TEXT,
  game_date DATE,
  settled_at TIMESTAMPTZ,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    so.id,
    so.sport,
    so.player_name,
    so.market_type,
    so.line,
    so.odds,
    so.actual_value,
    so.outcome,
    so.game_date,
    so.settled_at,
    so.metadata
  FROM settled_outcomes so
  WHERE
    so.sport = UPPER(p_sport)
    AND so.actual_value IS NOT NULL
    AND so.actual_value <> -1
    AND so.outcome IN ('win', 'loss')
  ORDER BY so.settled_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add indexes for ML training queries
CREATE INDEX IF NOT EXISTS idx_settled_outcomes_ml_training
  ON settled_outcomes(sport, settled_at DESC)
  WHERE actual_value IS NOT NULL
    AND actual_value <> -1
    AND outcome IN ('win', 'loss');

-- Comment on new functions
COMMENT ON FUNCTION count_outcomes_by_sport() IS
  'Returns count of valid settled outcomes by sport for ML training';

COMMENT ON FUNCTION fetch_training_sample(TEXT, INTEGER) IS
  'Fetches training sample for ML weight optimization';
