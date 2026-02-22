-- ============================================================================
-- MARKET UNIVERSE VIEW
-- Sprint: SPRINT-MARKET-SCOPED-IDENTITY-100B2
-- Date: 2026-02-22
--
-- Defines the "market universe" - players that appear in active betting markets
-- where team linkage is critical for scoring accuracy.
--
-- Market Universe Definition:
-- 1. Players appearing in provider_offers within last 30 days, OR
-- 2. Players on upcoming event rosters (next 7 days)
--
-- Players outside the market universe may have missing team linkage (free agents,
-- historical players) without impacting scoring quality.
-- ============================================================================

-- ============================================================================
-- 1. VIEW: view_market_universe_players
-- Players in active betting markets (provider_offers or upcoming events)
-- ============================================================================

CREATE OR REPLACE VIEW view_market_universe_players AS
WITH
-- Players appearing in recent provider_offers (last 30 days)
offered_players AS (
  SELECT DISTINCT po.participant_id
  FROM provider_offers po
  WHERE po.participant_id IS NOT NULL
    AND po.snapshot_at >= NOW() - INTERVAL '30 days'
),
-- Teams in upcoming scheduled events (next 7 days)
upcoming_teams AS (
  SELECT ce.home_participant_id AS team_id
  FROM canonical_events ce
  WHERE ce.status = 'scheduled'
    AND ce.scheduled_at >= NOW()
    AND ce.scheduled_at <= NOW() + INTERVAL '7 days'
    AND ce.home_participant_id IS NOT NULL
  UNION
  SELECT ce.away_participant_id AS team_id
  FROM canonical_events ce
  WHERE ce.status = 'scheduled'
    AND ce.scheduled_at >= NOW()
    AND ce.scheduled_at <= NOW() + INTERVAL '7 days'
    AND ce.away_participant_id IS NOT NULL
),
-- Players on upcoming team rosters
roster_players AS (
  SELECT DISTINCT pm.participant_id
  FROM participant_memberships pm
  INNER JOIN upcoming_teams ut ON ut.team_id = pm.team_id
  WHERE pm.valid_to IS NULL  -- Current membership only
)
-- Union of offered + roster players
SELECT DISTINCT p.id AS participant_id,
       p.external_id,
       p.name,
       p.sport,
       p.type,
       CASE
         WHEN op.participant_id IS NOT NULL THEN TRUE
         ELSE FALSE
       END AS in_recent_offers,
       CASE
         WHEN rp.participant_id IS NOT NULL THEN TRUE
         ELSE FALSE
       END AS in_upcoming_roster
FROM participants p
LEFT JOIN offered_players op ON op.participant_id = p.id
LEFT JOIN roster_players rp ON rp.participant_id = p.id
WHERE p.type = 'player'
  AND (op.participant_id IS NOT NULL OR rp.participant_id IS NOT NULL);

COMMENT ON VIEW view_market_universe_players IS
  'Players in active betting markets (recent offers or upcoming rosters). V3 Market-Scoped Identity.';

-- ============================================================================
-- 2. VIEW: view_market_universe_stats
-- Aggregated stats for market universe by sport
-- ============================================================================

CREATE OR REPLACE VIEW view_market_universe_stats AS
WITH
all_players AS (
  SELECT p.id, p.sport
  FROM participants p
  WHERE p.type = 'player'
),
market_universe AS (
  SELECT * FROM view_market_universe_players
),
linked_players AS (
  SELECT DISTINCT pm.participant_id
  FROM participant_memberships pm
  WHERE pm.valid_to IS NULL
)
SELECT
  COALESCE(ap.sport, 'TOTAL') AS sport,
  COUNT(DISTINCT ap.id) AS total_players,
  COUNT(DISTINCT mu.participant_id) AS market_universe_players,
  COUNT(DISTINCT CASE WHEN lp.participant_id IS NOT NULL THEN mu.participant_id END) AS market_universe_linked,
  COUNT(DISTINCT CASE WHEN lp.participant_id IS NULL THEN mu.participant_id END) AS market_universe_unlinked,
  CASE
    WHEN COUNT(DISTINCT mu.participant_id) > 0
    THEN ROUND(100.0 * COUNT(DISTINCT CASE WHEN lp.participant_id IS NOT NULL THEN mu.participant_id END) / COUNT(DISTINCT mu.participant_id), 1)
    ELSE 0.0
  END AS linked_percent
FROM all_players ap
LEFT JOIN market_universe mu ON mu.participant_id = ap.id
LEFT JOIN linked_players lp ON lp.participant_id = mu.participant_id
GROUP BY ROLLUP(ap.sport)
ORDER BY
  CASE WHEN ap.sport IS NULL THEN 1 ELSE 0 END,
  market_universe_players DESC;

COMMENT ON VIEW view_market_universe_stats IS
  'Market universe linkage stats by sport. V3 Market-Scoped Identity.';

-- ============================================================================
-- 3. VIEW: view_market_universe_unlinked
-- Market universe players missing team linkage (for debugging/resolution)
-- ============================================================================

CREATE OR REPLACE VIEW view_market_universe_unlinked AS
SELECT
  mu.participant_id,
  mu.external_id,
  mu.name,
  mu.sport,
  mu.in_recent_offers,
  mu.in_upcoming_roster,
  -- Get last offer date if available
  (
    SELECT MAX(po.snapshot_at)
    FROM provider_offers po
    WHERE po.participant_id = mu.participant_id
  ) AS last_offer_at
FROM view_market_universe_players mu
LEFT JOIN participant_memberships pm
  ON pm.participant_id = mu.participant_id
  AND pm.valid_to IS NULL
WHERE pm.participant_id IS NULL
ORDER BY mu.sport, mu.name;

COMMENT ON VIEW view_market_universe_unlinked IS
  'Market universe players missing team linkage. Priority for resolution. V3.';

-- ============================================================================
-- 4. FUNCTION: check_market_universe_linkage
-- Returns TRUE if market universe linkage is at acceptable threshold
-- ============================================================================

CREATE OR REPLACE FUNCTION check_market_universe_linkage(
  p_min_threshold NUMERIC DEFAULT 95.0
)
RETURNS TABLE (
  sport TEXT,
  linked_percent NUMERIC,
  passes_threshold BOOLEAN
) AS $$
  SELECT
    sport::TEXT,
    linked_percent,
    linked_percent >= p_min_threshold AS passes_threshold
  FROM view_market_universe_stats
  WHERE sport != 'TOTAL'
  UNION ALL
  SELECT
    sport::TEXT,
    linked_percent,
    linked_percent >= p_min_threshold AS passes_threshold
  FROM view_market_universe_stats
  WHERE sport = 'TOTAL';
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION check_market_universe_linkage IS
  'Check if market universe linkage meets threshold. Default 95%. V3.';

-- ============================================================================
-- END OF MIGRATION
-- Sprint: SPRINT-MARKET-SCOPED-IDENTITY-100B2
--
-- NEW VIEWS:
-- - view_market_universe_players (players in active betting markets)
-- - view_market_universe_stats (stats by sport)
-- - view_market_universe_unlinked (players needing team resolution)
--
-- NEW FUNCTIONS:
-- - check_market_universe_linkage(threshold) - verify linkage meets threshold
-- ============================================================================
