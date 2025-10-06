
-- WEEK 1 DEPLOYMENT: Elite Status Upgrade
-- Generated: 2025-10-06T13:22:32.791Z
-- Expected Impact: +5-10% Win Rate

-- ============================================================
-- PART 1: Player Performance Materialized Views
-- ============================================================

-- Player Recent Performance (Last 30 Days)
DROP MATERIALIZED VIEW IF EXISTS player_recent_performance CASCADE;
CREATE MATERIALIZED VIEW player_recent_performance AS
SELECT
  player_name,
  sport,
  market_type,
  COUNT(*) as games_played,
  AVG(actual_value) as avg_performance,
  STDDEV(actual_value) as performance_volatility,
  MAX(actual_value) as max_performance,
  MIN(actual_value) as min_performance,
  AVG(CASE WHEN game_date >= CURRENT_DATE - INTERVAL '7 days' THEN actual_value END) as avg_last_7_days,
  AVG(CASE WHEN game_date >= CURRENT_DATE - INTERVAL '14 days' AND game_date < CURRENT_DATE - INTERVAL '7 days' THEN actual_value END) as avg_prev_7_days,
  AVG(CASE WHEN outcome = 'over' THEN 1.0 ELSE 0.0 END) as over_rate,
  MAX(game_date) as last_game_date,
  NOW() as refreshed_at
FROM settled_outcomes
WHERE game_date >= CURRENT_DATE - INTERVAL '30 days'
  AND actual_value IS NOT NULL
GROUP BY player_name, sport, market_type;

CREATE INDEX idx_player_recent_perf_player
  ON player_recent_performance(player_name, sport, market_type);

-- Prop History by Player and Market
DROP MATERIALIZED VIEW IF EXISTS player_prop_history CASCADE;
CREATE MATERIALIZED VIEW player_prop_history AS
SELECT
  player_name,
  sport,
  market_type,
  line,
  COUNT(*) as times_seen,
  AVG(actual_value) as avg_actual,
  AVG(CASE WHEN outcome = 'over' THEN 1.0 ELSE 0.0 END) as over_percentage,
  AVG(CASE WHEN game_date >= CURRENT_DATE - INTERVAL '14 days' THEN actual_value END) as recent_avg,
  MAX(game_date) as last_seen,
  NOW() as refreshed_at
FROM settled_outcomes
WHERE game_date >= CURRENT_DATE - INTERVAL '90 days'
  AND actual_value IS NOT NULL
GROUP BY player_name, sport, market_type, line
HAVING COUNT(*) >= 3;

CREATE INDEX idx_player_prop_hist_lookup
  ON player_prop_history(player_name, sport, market_type, line);

-- ============================================================
-- PART 2: Database Functions
-- ============================================================

-- Count outcomes by sport (required for ML weight training)
CREATE OR REPLACE FUNCTION count_outcomes_by_sport()
RETURNS TABLE(sport VARCHAR, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.sport::VARCHAR,
    COUNT(*)::BIGINT as count
  FROM settled_outcomes s
  WHERE s.actual_value IS NOT NULL
  GROUP BY s.sport
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION count_outcomes_by_sport() TO authenticated;
GRANT EXECUTE ON FUNCTION count_outcomes_by_sport() TO service_role;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Verify views created
SELECT 'player_recent_performance' as view_name, COUNT(*) as row_count FROM player_recent_performance
UNION ALL
SELECT 'player_prop_history', COUNT(*) FROM player_prop_history;

-- Test function
SELECT * FROM count_outcomes_by_sport();
