-- Migration: Create capper performance downstream surfaces
-- Sprint: SPRINT-CAPPER-PERFORMANCE-MV-CREATION
-- Purpose: Close HF-2 — missing mv_capper_daily_rollup and v_capper_streaks
-- Rollback: DROP MATERIALIZED VIEW IF EXISTS mv_capper_daily_rollup CASCADE;
--           DROP VIEW IF EXISTS v_capper_streaks CASCADE;
--           DROP FUNCTION IF EXISTS refresh_capper_daily_rollup();

-- ============================================================================
-- 1. Materialized View: mv_capper_daily_rollup
--    Aggregates settled picks by capper + day for rolling performance stats.
--    Columns match the contract in packages/contracts/src/supabase.ts.
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_capper_daily_rollup AS
SELECT
  up.capper_id,
  u.username AS capper_name,
  DATE(up.settled_at) AS day,
  COUNT(*)::integer AS picks,
  COUNT(*) FILTER (WHERE up.settlement_result = 'win')::integer AS wins,
  COUNT(*) FILTER (WHERE up.settlement_result = 'loss')::integer AS losses,
  COUNT(*) FILTER (WHERE up.settlement_result = 'push')::integer AS pushes,
  COALESCE(SUM(COALESCE(up.units, 1)), 0)::numeric(12,2) AS units_wagered,
  COALESCE(SUM(
    CASE
      WHEN up.settlement_result = 'win' THEN
        COALESCE(up.units, 1) * (COALESCE(up.odds_decimal, 2.0) - 1)
      WHEN up.settlement_result = 'loss' THEN
        -COALESCE(up.units, 1)
      WHEN up.settlement_result = 'push' THEN 0
      ELSE 0
    END
  ), 0)::numeric(12,2) AS units_profit,
  CASE
    WHEN COALESCE(SUM(COALESCE(up.units, 1)), 0) > 0 THEN
      ROUND(
        COALESCE(SUM(
          CASE
            WHEN up.settlement_result = 'win' THEN
              COALESCE(up.units, 1) * (COALESCE(up.odds_decimal, 2.0) - 1)
            WHEN up.settlement_result = 'loss' THEN
              -COALESCE(up.units, 1)
            ELSE 0
          END
        ), 0) / NULLIF(SUM(COALESCE(up.units, 1)), 0) * 100
      , 2)
    ELSE 0
  END::numeric(8,2) AS roi
FROM unified_picks up
LEFT JOIN users u ON up.capper_id = u.id
WHERE up.settlement_status = 'settled'
  AND up.capper_id IS NOT NULL
  AND up.settled_at IS NOT NULL
GROUP BY up.capper_id, u.username, DATE(up.settled_at);

-- Indexes for efficient querying by the /api/cappers route
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_capper_rollup_pk
  ON mv_capper_daily_rollup (capper_id, day);
CREATE INDEX IF NOT EXISTS idx_mv_capper_rollup_day
  ON mv_capper_daily_rollup (day DESC);

-- ============================================================================
-- 2. View: v_capper_streaks
--    Computes current win/loss streak and last-10 record per capper.
--    Real-time (computed on query, not materialized).
-- ============================================================================

CREATE OR REPLACE VIEW v_capper_streaks AS
WITH settled_picks AS (
  SELECT
    up.capper_id,
    u.username AS capper_name,
    up.settlement_result,
    up.settled_at,
    ROW_NUMBER() OVER (
      PARTITION BY up.capper_id ORDER BY up.settled_at DESC
    ) AS rn
  FROM unified_picks up
  LEFT JOIN users u ON up.capper_id = u.id
  WHERE up.settlement_status = 'settled'
    AND up.capper_id IS NOT NULL
    AND up.settled_at IS NOT NULL
    AND up.settlement_result IN ('win', 'loss', 'push')
),
-- Current streak: count consecutive same results from most recent
streak_calc AS (
  SELECT
    sp.capper_id,
    sp.capper_name,
    sp.settlement_result AS latest_result,
    -- Count how many consecutive picks from the top match the latest result
    (
      SELECT COUNT(*)
      FROM settled_picks sp2
      WHERE sp2.capper_id = sp.capper_id
        AND sp2.rn <= (
          SELECT COALESCE(MIN(sp3.rn) - 1, (SELECT COUNT(*) FROM settled_picks sp4 WHERE sp4.capper_id = sp.capper_id))
          FROM settled_picks sp3
          WHERE sp3.capper_id = sp.capper_id
            AND sp3.settlement_result != sp.settlement_result
            AND sp3.rn > 0
        )
    ) AS streak_len
  FROM settled_picks sp
  WHERE sp.rn = 1
),
-- Last 10 record
last_10 AS (
  SELECT
    capper_id,
    COUNT(*) FILTER (WHERE settlement_result = 'win') AS last_10_wins,
    COUNT(*) FILTER (WHERE settlement_result = 'loss') AS last_10_losses,
    COUNT(*) FILTER (WHERE settlement_result = 'push') AS last_10_pushes
  FROM settled_picks
  WHERE rn <= 10
  GROUP BY capper_id
)
SELECT
  sc.capper_id,
  sc.capper_name,
  CASE
    WHEN sc.latest_result = 'push' THEN NULL
    ELSE sc.latest_result
  END AS current_streak_type,
  CASE
    WHEN sc.latest_result = 'push' THEN 0
    ELSE sc.streak_len
  END::integer AS current_streak_len,
  COALESCE(l10.last_10_wins, 0)::integer AS last_10_wins,
  COALESCE(l10.last_10_losses, 0)::integer AS last_10_losses,
  COALESCE(l10.last_10_pushes, 0)::integer AS last_10_pushes,
  COALESCE(l10.last_10_wins, 0) || '-' ||
    COALESCE(l10.last_10_losses, 0) || '-' ||
    COALESCE(l10.last_10_pushes, 0) AS last_10_summary
FROM streak_calc sc
LEFT JOIN last_10 l10 ON sc.capper_id = l10.capper_id;

-- ============================================================================
-- 3. Refresh function — callable from application code or cron
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_capper_daily_rollup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_capper_daily_rollup;
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION refresh_capper_daily_rollup() TO service_role;

-- ============================================================================
-- 4. Initial data population — refresh the MV now
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_capper_daily_rollup;

COMMENT ON MATERIALIZED VIEW mv_capper_daily_rollup IS
  'SPRINT-CAPPER-PERFORMANCE-MV-CREATION: Daily capper performance rollup. Refresh via refresh_capper_daily_rollup() after settlement.';
COMMENT ON VIEW v_capper_streaks IS
  'SPRINT-CAPPER-PERFORMANCE-MV-CREATION: Current capper win/loss streaks and last-10 record. Computed on query.';
COMMENT ON FUNCTION refresh_capper_daily_rollup() IS
  'SPRINT-CAPPER-PERFORMANCE-MV-CREATION: Refreshes mv_capper_daily_rollup concurrently. Call after settlement batch completes.';
