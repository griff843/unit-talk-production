-- ============================================================================
-- APPLY VIA SUPABASE DASHBOARD SQL EDITOR
-- ============================================================================
-- Run this file in Supabase Dashboard > SQL Editor
-- Project: lxqmuzmqtnnlpfapvief (griff843's Project)
-- URL: https://supabase.com/dashboard/project/lxqmuzmqtnnlpfapvief/sql/new
-- ============================================================================

-- Migration 1: 20250925_unified_picks_all_props.sql
-- Already applied: column additions via 20251003_200000_add_missing_columns.sql
-- Applying: indexes and views only

-- Indexes (create if not exists)
CREATE INDEX IF NOT EXISTS idx_unified_picks_external_ids
  ON public.unified_picks (external_game_id, external_prop_id);

CREATE INDEX IF NOT EXISTS idx_unified_picks_settled_at
  ON public.unified_picks (settled_at);

CREATE INDEX IF NOT EXISTS idx_unified_picks_game_date
  ON public.unified_picks (game_date);

-- Games table safety
ALTER TABLE IF EXISTS public.games
  ADD COLUMN IF NOT EXISTS sport TEXT,
  ADD COLUMN IF NOT EXISTS game_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_games_date_sport
  ON public.games (game_date, sport);

-- Smart Form views
CREATE OR REPLACE VIEW public.view_props_for_form AS
SELECT
  external_prop_id,
  external_game_id,
  sport,
  league,
  player_name,
  team,
  matchup,
  market,
  submarket,
  line,
  price,
  game_date,
  posted_at
FROM public.unified_picks
WHERE (game_date >= now() - interval '3 days')
   OR (posted_at >= now() - interval '3 days');

-- Materialized view for blazing-fast form queries
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_props_for_form AS
SELECT
  external_prop_id,
  external_game_id,
  sport,
  league,
  player_name,
  team,
  matchup,
  market,
  submarket,
  line,
  price,
  game_date,
  posted_at
FROM public.unified_picks
WHERE (game_date >= now() - interval '3 days')
   OR (posted_at >= now() - interval '3 days');

-- Indexes for materialized view
CREATE INDEX IF NOT EXISTS mv_props_for_form_player_name_trgm
  ON public.mv_props_for_form USING gin (player_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS mv_props_for_form_team
  ON public.mv_props_for_form (team);
CREATE INDEX IF NOT EXISTS mv_props_for_form_market
  ON public.mv_props_for_form (market);
CREATE INDEX IF NOT EXISTS mv_props_for_form_game_date
  ON public.mv_props_for_form (game_date);

-- Refresh helper function
CREATE OR REPLACE FUNCTION public.refresh_mv_props_for_form()
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE 'REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_props_for_form';
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'REFRESH MATERIALIZED VIEW public.mv_props_for_form';
  END;
END;
$$;

-- ============================================================================
-- Migration 2: 20250925_cache_materialized_views.sql (excerpts - skip broken views)
-- ============================================================================

-- Hot picks: Published picks from last 24 hours
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_hot_published_picks AS
SELECT
    up.id,
    up.user_id,
    up.sport,
    up.market,
    up.player_name,
    up.team,
    up.matchup,
    up.game_date,
    up.side,
    up.line,
    up.price,
    up.implied_prob,
    up.posted_at,
    up.meta
FROM public.unified_picks up
WHERE up.posted_at >= NOW() - INTERVAL '24 hours'
ORDER BY up.posted_at DESC;

-- Indexes for hot picks
CREATE INDEX IF NOT EXISTS mv_hot_published_picks_sport_idx
    ON public.mv_hot_published_picks(sport);
CREATE INDEX IF NOT EXISTS mv_hot_published_picks_market_idx
    ON public.mv_hot_published_picks(market);
CREATE INDEX IF NOT EXISTS mv_hot_published_picks_posted_at_idx
    ON public.mv_hot_published_picks(posted_at DESC);

-- Today's premium picks (S-tier cappers)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_todays_premium_picks AS
WITH todays_date AS (
    SELECT CURRENT_DATE AS today
)
SELECT
    up.id,
    up.user_id,
    up.sport,
    up.market,
    up.player_name,
    up.team,
    up.matchup,
    up.game_date,
    up.side,
    up.line,
    up.price
FROM public.unified_picks up
CROSS JOIN todays_date
WHERE DATE(up.game_date) = todays_date.today
ORDER BY up.game_date ASC;

-- Indexes for premium picks
CREATE INDEX IF NOT EXISTS mv_todays_premium_picks_sport_idx
    ON public.mv_todays_premium_picks(sport);
CREATE INDEX IF NOT EXISTS mv_todays_premium_picks_game_date_idx
    ON public.mv_todays_premium_picks(game_date);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migrations applied successfully!';
    RAISE NOTICE 'Created views: view_props_for_form, mv_props_for_form';
    RAISE NOTICE 'Created matviews: mv_hot_published_picks, mv_todays_premium_picks';
    RAISE NOTICE 'All indexes created';
END $$;
