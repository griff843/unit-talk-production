-- ============================================================================
-- DEBUG: Check why 23505 error occurs on first insert
-- ============================================================================

-- 1. Show current unique indexes on unified_picks
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'unified_picks'
ORDER BY indexname;

-- 2. Check for existing picks with same constraint key
-- Using the sample row from the error:
-- source=odds-api, market=h2h, selection=Los Angeles Rams,
-- bookmaker_key=draftkings, game_date=2025-10-03T00:16:00Z, line=null

SELECT
  id,
  source,
  market,
  selection,
  bookmaker_key,
  game_date,
  line,
  external_game_id,
  external_prop_id,
  created_at
FROM unified_picks
WHERE source = 'odds-api'
  AND market = 'h2h'
  AND selection = 'Los Angeles Rams'
  AND bookmaker_key = 'draftkings'
  AND game_date = '2025-10-03T00:16:00Z'
  AND external_prop_id IS NULL;

-- 3. Check for ANY picks from 49ers vs Rams game
SELECT
  id,
  source,
  market,
  selection,
  bookmaker_key,
  external_game_id,
  external_prop_id
FROM unified_picks
WHERE external_game_id = 'c4b72eabb3d557e73022ec730d8e3944';

-- 4. Check if there's an old constraint still active
SELECT
  conname,
  contype,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'unified_picks'::regclass
  AND contype = 'u'; -- unique constraints

-- 5. Look for the ux_unified_picks_dedup constraint from the migration
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'unified_picks'
  AND indexname = 'ux_unified_picks_dedup';
