-- Migration: Ensure raw_props table has all required columns for pipeline
-- Date: October 4, 2025
-- Purpose: Support pipeline-native ingestion with complete schema

-- Create raw_props table if it doesn't exist
CREATE TABLE IF NOT EXISTS raw_props (
  id BIGSERIAL PRIMARY KEY,
  external_game_id TEXT NOT NULL,
  external_prop_id TEXT NOT NULL UNIQUE,
  sport TEXT NOT NULL,
  game_date TIMESTAMP WITH TIME ZONE NOT NULL,
  home_team TEXT,
  away_team TEXT,
  bookmaker_key TEXT,
  bookmaker_title TEXT,
  market_key TEXT,
  player_name TEXT,
  stat_type TEXT,
  line NUMERIC,
  over_odds INTEGER,
  under_odds INTEGER,
  outcome_name TEXT,
  price NUMERIC,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ingested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  normalized_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT raw_props_external_prop_id_key UNIQUE (external_prop_id)
);

-- Add columns if table exists but missing columns (idempotent)
DO $$
BEGIN
  -- Add bookmaker_key if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'bookmaker_key'
  ) THEN
    ALTER TABLE raw_props ADD COLUMN bookmaker_key TEXT;
  END IF;

  -- Add bookmaker_title if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'bookmaker_title'
  ) THEN
    ALTER TABLE raw_props ADD COLUMN bookmaker_title TEXT;
  END IF;

  -- Add stat_type if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'stat_type'
  ) THEN
    ALTER TABLE raw_props ADD COLUMN stat_type TEXT;
  END IF;

  -- Add outcome_name if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_props' AND column_name = 'outcome_name'
  ) THEN
    ALTER TABLE raw_props ADD COLUMN outcome_name TEXT;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_raw_props_created_at ON raw_props(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_props_sport ON raw_props(sport);
CREATE INDEX IF NOT EXISTS idx_raw_props_normalized_at ON raw_props(normalized_at) WHERE normalized_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_raw_props_bookmaker_key ON raw_props(bookmaker_key) WHERE bookmaker_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_raw_props_external_game_id ON raw_props(external_game_id);

-- Add helpful comments
COMMENT ON TABLE raw_props IS 'Raw props from Odds API - pipeline entry point';
COMMENT ON COLUMN raw_props.bookmaker_key IS 'Bookmaker identifier (e.g., draftkings, fanduel, betmgm)';
COMMENT ON COLUMN raw_props.bookmaker_title IS 'Human-readable bookmaker name';
COMMENT ON COLUMN raw_props.normalized_at IS 'Timestamp when NormalizerAgent processed this prop';
COMMENT ON COLUMN raw_props.external_prop_id IS 'Unique prop ID from Odds API (deduplication key)';
