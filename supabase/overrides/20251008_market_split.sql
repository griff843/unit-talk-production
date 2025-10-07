-- ============================================================
-- MARKET PROPS SPLIT: Separate Market Feed from User Picks
-- Generated: 2025-10-08
-- Purpose: Create dual-track pipeline for market props (no user_id)
-- ============================================================

BEGIN;

-- 1) market_props: normalized market feed (NO user_id required)
CREATE TABLE IF NOT EXISTS public.market_props (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport TEXT NOT NULL,
  market TEXT NOT NULL,
  selection TEXT,
  line NUMERIC,
  odds INTEGER,
  over_odds INTEGER,
  under_odds INTEGER,
  bookmaker_key TEXT,
  best_book TEXT,
  best_available_line NUMERIC,
  game_date TIMESTAMPTZ,
  game_time TIMESTAMPTZ,
  player_name TEXT,
  team TEXT,
  opponent TEXT,
  external_prop_id TEXT,
  external_game_id TEXT,
  game_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one row per (bookmaker, external_prop_id)
CREATE UNIQUE INDEX IF NOT EXISTS ux_market_props_book_ext
  ON public.market_props (COALESCE(bookmaker_key,'default'), COALESCE(external_prop_id,'unknown'));

-- Performance indexes
CREATE INDEX IF NOT EXISTS ix_market_props_dates
  ON public.market_props (game_date);
CREATE INDEX IF NOT EXISTS ix_market_props_sport_market
  ON public.market_props (sport, market);
CREATE INDEX IF NOT EXISTS ix_market_props_player
  ON public.market_props (player_name);
CREATE INDEX IF NOT EXISTS ix_market_props_game
  ON public.market_props (game_id);

-- 2) promotion_queue: add source discriminator
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='promotion_queue' AND column_name='source'
  ) THEN
    ALTER TABLE public.promotion_queue
      ADD COLUMN source TEXT DEFAULT 'market' CHECK (source IN ('market','user'));
  END IF;
END $$;

-- 3) scored_props: ensure indexes for performance
CREATE INDEX IF NOT EXISTS ix_scored_props_updated_at
  ON public.scored_props(updated_at);
CREATE INDEX IF NOT EXISTS ix_scored_props_prop_ref
  ON public.scored_props(prop_ref);

-- 4) Drop and recreate views to avoid column rename conflicts
DROP VIEW IF EXISTS public.v_daily_board CASCADE;
DROP VIEW IF EXISTS public.v_prop_read_model CASCADE;

-- 5) Read-model view: v_prop_read_model (market path)
CREATE OR REPLACE VIEW public.v_prop_read_model AS
SELECT
  mp.id AS id,
  mp.id AS prop_ref,
  'market'::TEXT AS source,
  mp.sport,
  mp.market,
  mp.selection,
  mp.line,
  COALESCE(mp.odds,
    CASE
      WHEN mp.selection = 'Over' THEN mp.over_odds
      WHEN mp.selection = 'Under' THEN mp.under_odds
    END
  ) AS odds,
  mp.over_odds,
  mp.under_odds,
  mp.bookmaker_key,
  mp.best_book,
  mp.best_available_line,
  mp.game_date,
  mp.game_time,
  mp.player_name,
  mp.team,
  mp.opponent,
  mp.external_prop_id,
  mp.external_game_id,
  mp.game_id,
  mp.metadata,
  mp.created_at,
  sp.edge,
  sp.prob_win,
  sp.professional_score,
  sp.tier,
  sp.confidence,
  sp.kelly_fraction,
  sp.clv_pct,
  sp.updated_at AS scored_at,
  pq.status AS queue_status,
  pq.publish_at,
  pq.published_at
FROM public.market_props mp
LEFT JOIN public.scored_props sp
  ON sp.prop_ref = mp.id
LEFT JOIN public.promotion_queue pq
  ON pq.prop_ref = mp.id
WHERE mp.game_date >= (NOW()::DATE);

-- 6) Daily board view: v_daily_board (prioritized market props)
CREATE OR REPLACE VIEW public.v_daily_board AS
SELECT
  prop_ref,
  source,
  sport,
  market,
  selection,
  line,
  odds,
  over_odds,
  under_odds,
  bookmaker_key,
  best_book,
  best_available_line,
  game_date,
  game_time,
  player_name,
  team,
  opponent,
  edge,
  prob_win,
  professional_score,
  tier,
  confidence,
  kelly_fraction,
  clv_pct,
  queue_status,
  publish_at,
  published_at
FROM public.v_prop_read_model
WHERE professional_score IS NOT NULL
ORDER BY
  CASE COALESCE(tier,'C')
    WHEN 'S' THEN 0
    WHEN 'A' THEN 1
    WHEN 'B' THEN 2
    WHEN 'C' THEN 3
    ELSE 9
  END,
  edge DESC NULLS LAST,
  game_date,
  game_time NULLS LAST;

-- 7) Helper function: get market props needing scoring
CREATE OR REPLACE FUNCTION public.get_unscored_market_props(limit_count INT DEFAULT 100)
RETURNS TABLE (
  id UUID,
  sport TEXT,
  market TEXT,
  selection TEXT,
  line NUMERIC,
  odds INTEGER,
  game_date TIMESTAMPTZ,
  player_name TEXT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mp.id,
    mp.sport,
    mp.market,
    mp.selection,
    mp.line,
    mp.odds,
    mp.game_date,
    mp.player_name,
    mp.metadata
  FROM public.market_props mp
  LEFT JOIN public.scored_props sp ON sp.prop_ref = mp.id
  WHERE mp.game_date >= (NOW()::DATE)
    AND (sp.id IS NULL OR sp.updated_at < NOW() - INTERVAL '1 hour')
  ORDER BY mp.game_date, mp.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- 8) Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;

-- Verification queries (run separately after migration):
-- SELECT COUNT(*) AS market_props_today FROM public.market_props WHERE game_date >= (NOW()::DATE);
-- SELECT COUNT(*) AS scored_15m FROM public.scored_props WHERE updated_at >= NOW() - INTERVAL '15 minutes';
-- SELECT COUNT(*) AS feed_rows FROM public.v_prop_read_model WHERE game_date >= (NOW()::DATE);
-- SELECT COUNT(*) AS board_rows FROM public.v_daily_board WHERE game_date >= (NOW()::DATE);
