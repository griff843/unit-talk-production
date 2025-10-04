-- Add missing columns to unified_picks and raw_props
-- Enables support for cache materialized views and all-props ingestion

-- Add missing columns to unified_picks
ALTER TABLE IF EXISTS public.unified_picks
  ADD COLUMN IF NOT EXISTS league TEXT,
  ADD COLUMN IF NOT EXISTS submarket TEXT,
  ADD COLUMN IF NOT EXISTS player_name TEXT,
  ADD COLUMN IF NOT EXISTS side TEXT,
  ADD COLUMN IF NOT EXISTS price INTEGER,
  ADD COLUMN IF NOT EXISTS implied_prob NUMERIC,
  ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promoted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS outcome TEXT,
  ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::JSONB;

-- Add missing columns to raw_props if table exists
ALTER TABLE IF EXISTS public.raw_props
  ADD COLUMN IF NOT EXISTS league TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS inserted_at TIMESTAMPTZ DEFAULT NOW();

-- Create indexes for commonly queried columns
CREATE INDEX IF NOT EXISTS idx_unified_picks_league ON public.unified_picks(league);
CREATE INDEX IF NOT EXISTS idx_unified_picks_submarket ON public.unified_picks(submarket);
CREATE INDEX IF NOT EXISTS idx_unified_picks_player_name ON public.unified_picks(player_name);
CREATE INDEX IF NOT EXISTS idx_unified_picks_scored_at ON public.unified_picks(scored_at);

-- Add trigram index for player name search
CREATE INDEX IF NOT EXISTS idx_unified_picks_player_name_trgm
  ON public.unified_picks USING gin (player_name gin_trgm_ops);
