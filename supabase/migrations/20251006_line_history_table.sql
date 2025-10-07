-- Migration: Create Line History Tracking for Feature Store
-- Purpose: Enable 30-day rolling window of line movement for advanced features
-- Features Unlocked: line_history, steam_analysis, price_action, predicted_closing

-- Line History Table: Track all line snapshots over time
CREATE TABLE IF NOT EXISTS line_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prop_id UUID REFERENCES raw_props(id) ON DELETE CASCADE,

  -- Line data
  line DECIMAL NOT NULL,
  odds INTEGER NOT NULL,
  book VARCHAR(50) NOT NULL,

  -- Metadata
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  volume INTEGER DEFAULT 0,

  -- Indexes
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_line_history_prop_id ON line_history(prop_id);
CREATE INDEX IF NOT EXISTS idx_line_history_timestamp ON line_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_line_history_prop_timestamp ON line_history(prop_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_line_history_book ON line_history(book);

-- Composite index for time-range queries
CREATE INDEX IF NOT EXISTS idx_line_history_prop_time_range
  ON line_history(prop_id, timestamp DESC)
  INCLUDE (line, odds, book);

-- Function: Get line movement for a prop
CREATE OR REPLACE FUNCTION get_line_history(
  p_prop_id UUID,
  p_hours_back INTEGER DEFAULT 24
)
RETURNS TABLE(
  timestamp TIMESTAMPTZ,
  line DECIMAL,
  odds INTEGER,
  book VARCHAR,
  line_change DECIMAL,
  odds_change INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH ordered_history AS (
    SELECT
      lh.timestamp,
      lh.line,
      lh.odds,
      lh.book,
      LAG(lh.line) OVER (ORDER BY lh.timestamp) AS prev_line,
      LAG(lh.odds) OVER (ORDER BY lh.timestamp) AS prev_odds
    FROM line_history lh
    WHERE lh.prop_id = p_prop_id
      AND lh.timestamp >= NOW() - (p_hours_back || ' hours')::INTERVAL
    ORDER BY lh.timestamp DESC
  )
  SELECT
    oh.timestamp,
    oh.line,
    oh.odds,
    oh.book,
    COALESCE(oh.line - oh.prev_line, 0) AS line_change,
    COALESCE(oh.odds - oh.prev_odds, 0) AS odds_change
  FROM ordered_history oh;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Detect steam (sharp coordinated action)
CREATE OR REPLACE FUNCTION detect_steam(
  p_prop_id UUID,
  p_minutes_window INTEGER DEFAULT 15
)
RETURNS BOOLEAN AS $$
DECLARE
  v_line_movement DECIMAL;
  v_avg_volume INTEGER;
  v_recent_volume INTEGER;
BEGIN
  -- Calculate line movement in window
  SELECT
    ABS(MAX(line) - MIN(line)) INTO v_line_movement
  FROM line_history
  WHERE prop_id = p_prop_id
    AND timestamp >= NOW() - (p_minutes_window || ' minutes')::INTERVAL;

  -- Calculate average vs recent volume
  SELECT AVG(volume) INTO v_avg_volume
  FROM line_history
  WHERE prop_id = p_prop_id
    AND timestamp >= NOW() - INTERVAL '24 hours';

  SELECT AVG(volume) INTO v_recent_volume
  FROM line_history
  WHERE prop_id = p_prop_id
    AND timestamp >= NOW() - (p_minutes_window || ' minutes')::INTERVAL;

  -- Steam = rapid movement (>0.5 line) with lower volume (sharps moving)
  RETURN (
    v_line_movement > 0.5 AND
    v_recent_volume < v_avg_volume * 0.8
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Calculate line velocity (points per hour)
CREATE OR REPLACE FUNCTION calculate_line_velocity(
  p_prop_id UUID,
  p_hours INTEGER DEFAULT 6
)
RETURNS DECIMAL AS $$
DECLARE
  v_earliest_line DECIMAL;
  v_latest_line DECIMAL;
  v_time_diff_hours DECIMAL;
BEGIN
  SELECT line INTO v_earliest_line
  FROM line_history
  WHERE prop_id = p_prop_id
    AND timestamp >= NOW() - (p_hours || ' hours')::INTERVAL
  ORDER BY timestamp ASC
  LIMIT 1;

  SELECT line INTO v_latest_line
  FROM line_history
  WHERE prop_id = p_prop_id
  ORDER BY timestamp DESC
  LIMIT 1;

  IF v_earliest_line IS NULL OR v_latest_line IS NULL THEN
    RETURN 0;
  END IF;

  -- Calculate hourly velocity
  RETURN (v_latest_line - v_earliest_line) / p_hours;
END;
$$ LANGUAGE plpgsql STABLE;

-- Materialized View: Line movement summary (refresh every 5 minutes)
CREATE MATERIALIZED VIEW IF NOT EXISTS line_movement_summary AS
SELECT
  lh.prop_id,
  rp.sport,
  rp.market_type,

  -- Current state
  FIRST_VALUE(lh.line) OVER w AS current_line,
  FIRST_VALUE(lh.odds) OVER w AS current_odds,

  -- Movement metrics (last 24h)
  MAX(lh.line) OVER w - MIN(lh.line) OVER w AS total_movement,
  COUNT(*) OVER w AS snapshot_count,

  -- Velocity (last 6h)
  (FIRST_VALUE(lh.line) OVER w -
   FIRST_VALUE(lh.line) OVER (PARTITION BY lh.prop_id ORDER BY lh.timestamp ASC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
  ) / 6.0 AS line_velocity_6h,

  MAX(lh.timestamp) OVER w AS last_updated

FROM line_history lh
JOIN raw_props rp ON lh.prop_id = rp.id
WHERE lh.timestamp >= NOW() - INTERVAL '24 hours'
WINDOW w AS (PARTITION BY lh.prop_id ORDER BY lh.timestamp DESC);

-- Index on materialized view
CREATE INDEX IF NOT EXISTS idx_line_movement_summary_prop
  ON line_movement_summary(prop_id);

-- Auto-refresh schedule (every 5 minutes via cron job)
COMMENT ON MATERIALIZED VIEW line_movement_summary IS
'Refresh every 5 minutes: REFRESH MATERIALIZED VIEW CONCURRENTLY line_movement_summary';

-- Grant permissions
GRANT SELECT ON line_history TO authenticated;
GRANT SELECT ON line_movement_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_line_history TO authenticated;
GRANT EXECUTE ON FUNCTION detect_steam TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_line_velocity TO authenticated;

-- Comments
COMMENT ON TABLE line_history IS 'Historical line snapshots for tracking movement and detecting sharp action';
COMMENT ON FUNCTION get_line_history IS 'Retrieve line movement history with changes over time';
COMMENT ON FUNCTION detect_steam IS 'Detect coordinated sharp action (rapid movement, low volume)';
COMMENT ON FUNCTION calculate_line_velocity IS 'Calculate line movement speed (points per hour)';
