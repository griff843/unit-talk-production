-- Migration: Add bookmaker columns to raw_props table
-- Date: October 4, 2025
-- Purpose: Support pipeline-native ingestion script

-- Add bookmaker_key column (required for deduplication and tracking)
ALTER TABLE raw_props
ADD COLUMN IF NOT EXISTS bookmaker_key TEXT;

-- Add bookmaker_title column (human-readable bookmaker name)
ALTER TABLE raw_props
ADD COLUMN IF NOT EXISTS bookmaker_title TEXT;

-- Add index for faster bookmaker queries
CREATE INDEX IF NOT EXISTS idx_raw_props_bookmaker_key
ON raw_props(bookmaker_key)
WHERE bookmaker_key IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN raw_props.bookmaker_key IS 'Bookmaker identifier (e.g., draftkings, fanduel, betmgm)';
COMMENT ON COLUMN raw_props.bookmaker_title IS 'Human-readable bookmaker name (e.g., DraftKings, FanDuel, BetMGM)';
