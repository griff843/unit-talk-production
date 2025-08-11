-- ============================================================================
-- Settlement Pipeline & Database Reconciliation Migration
-- Date: 2025-08-11
-- Purpose: Fix audit findings + enable MLB settlement automation
-- ============================================================================

-- ============================================================================
-- A) ADD SETTLEMENT COLUMNS TO SHADOW_DECISIONS
-- ============================================================================

-- Add approval and settlement tracking columns
ALTER TABLE shadow_decisions
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'candidate',
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dry_run BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS discord_thread_id TEXT,
  ADD COLUMN IF NOT EXISTS discord_message_id TEXT,
  ADD COLUMN IF NOT EXISTS actual_result NUMERIC,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS settlement_source TEXT,
  ADD COLUMN IF NOT EXISTS settlement_details JSONB,
  ADD COLUMN IF NOT EXISTS dataset_label TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS prop_id UUID,
  ADD COLUMN IF NOT EXISTS game_id UUID;

-- Add performance indexes for settlement operations
CREATE INDEX IF NOT EXISTS ix_shadow_decisions_status ON shadow_decisions(status);
CREATE INDEX IF NOT EXISTS ix_shadow_decisions_settled_at ON shadow_decisions(settled_at);
CREATE INDEX IF NOT EXISTS ix_shadow_decisions_created_at ON shadow_decisions(created_at);
CREATE INDEX IF NOT EXISTS ix_shadow_decisions_event_time ON shadow_decisions(event_time);
CREATE INDEX IF NOT EXISTS ix_shadow_decisions_sport ON shadow_decisions(sport);

-- Add comment for status values
COMMENT ON COLUMN shadow_decisions.status IS 'Workflow status: candidate|review|approved|published|rejected|settled';

-- ============================================================================
-- B) ENSURE UNIQUE CONSTRAINTS & INDEXES FOR LINKAGE
-- ============================================================================

-- Core linkage indexes for games
CREATE UNIQUE INDEX IF NOT EXISTS ux_games_external_game_id ON games(external_game_id) WHERE external_game_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_raw_props_external_game_id ON raw_props(external_game_id) WHERE external_game_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_games_start_time ON games(start_time);
CREATE INDEX IF NOT EXISTS ix_games_status ON games(status);
CREATE INDEX IF NOT EXISTS ix_games_league ON games(league);

-- Additional performance indexes
CREATE INDEX IF NOT EXISTS ix_raw_props_game_id ON raw_props(game_id) WHERE game_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_raw_props_unique_key ON raw_props(unique_key) WHERE unique_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_raw_props_created_at ON raw_props(created_at);

-- ============================================================================
-- C) FIX AUDIT FINDINGS - BACKFILL raw_props.game_id
-- ============================================================================

-- Backfill raw_props.game_id from games via external_game_id match
UPDATE raw_props 
SET game_id = g.id,
    updated_at = NOW()
FROM games g
WHERE raw_props.game_id IS NULL
  AND raw_props.external_game_id IS NOT NULL
  AND g.external_game_id = raw_props.external_game_id;

-- Log the backfill operation
DO $$
DECLARE
    backfilled_count INTEGER;
BEGIN
    GET DIAGNOSTICS backfilled_count = ROW_COUNT;
    RAISE NOTICE 'Backfilled % raw_props records with game_id', backfilled_count;
END $$;

-- ============================================================================
-- D) FIX AUDIT FINDINGS - DEDUPLICATE raw_props.unique_key
-- ============================================================================

-- Remove duplicates, keeping the newest record by created_at, then id
WITH duplicates AS (
  SELECT 
    ctid,
    unique_key,
    ROW_NUMBER() OVER (
      PARTITION BY unique_key 
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM raw_props
  WHERE unique_key IS NOT NULL
),
to_delete AS (
  SELECT ctid 
  FROM duplicates 
  WHERE rn > 1
)
DELETE FROM raw_props 
WHERE ctid IN (SELECT ctid FROM to_delete);

-- Log the deduplication operation
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Removed % duplicate raw_props records', deleted_count;
END $$;

-- ============================================================================
-- E) ADD FOREIGN KEY CONSTRAINTS (DEFERRED, NOT VALIDATED)
-- ============================================================================

-- Drop existing constraints if they exist
ALTER TABLE raw_props DROP CONSTRAINT IF EXISTS fk_raw_props_games_id;
ALTER TABLE shadow_decisions DROP CONSTRAINT IF EXISTS fk_shadow_prop;
ALTER TABLE shadow_decisions DROP CONSTRAINT IF EXISTS fk_shadow_game;

-- Add deferred foreign keys (validate later once linkage is complete)
ALTER TABLE raw_props
  ADD CONSTRAINT fk_raw_props_games_id
  FOREIGN KEY (game_id) REFERENCES games(id)
  DEFERRABLE INITIALLY DEFERRED
  NOT VALID;

ALTER TABLE shadow_decisions
  ADD CONSTRAINT fk_shadow_prop
  FOREIGN KEY (prop_id) REFERENCES raw_props(id)
  DEFERRABLE INITIALLY DEFERRED
  NOT VALID;

ALTER TABLE shadow_decisions
  ADD CONSTRAINT fk_shadow_game
  FOREIGN KEY (game_id) REFERENCES games(id)
  DEFERRABLE INITIALLY DEFERRED
  NOT VALID;

-- ============================================================================
-- F) LINK shadow_decisions TO games (BEST-EFFORT VIA TEAM + EVENT_TIME)
-- ============================================================================

-- Link shadow_decisions to games using team matching and time proximity
WITH candidates AS (
  SELECT 
    id, 
    team, 
    event_time
  FROM shadow_decisions
  WHERE game_id IS NULL 
    AND event_time IS NOT NULL 
    AND team IS NOT NULL
    AND sport = 'MLB'
),
matches AS (
  SELECT 
    c.id AS sd_id, 
    g.id AS game_id,
    ROW_NUMBER() OVER (
      PARTITION BY c.id 
      ORDER BY ABS(EXTRACT(EPOCH FROM (g.start_time - c.event_time)))
    ) AS rn
  FROM candidates c
  JOIN games g
    ON (
      LOWER(TRIM(c.team)) = LOWER(TRIM(g.home_team)) OR 
      LOWER(TRIM(c.team)) = LOWER(TRIM(g.away_team))
    )
    AND g.start_time BETWEEN c.event_time - INTERVAL '1 day' AND c.event_time + INTERVAL '1 day'
    AND g.league = 'MLB'
)
UPDATE shadow_decisions sd
SET 
  game_id = m.game_id,
  dataset_label = 'migration_linked'
FROM matches m
WHERE sd.id = m.sd_id 
  AND m.rn = 1 
  AND sd.game_id IS NULL;

-- Log the linking operation
DO $$
DECLARE
    linked_count INTEGER;
BEGIN
    GET DIAGNOSTICS linked_count = ROW_COUNT;
    RAISE NOTICE 'Linked % shadow_decisions records to games via team matching', linked_count;
END $$;

-- ============================================================================
-- G) LINK shadow_decisions TO raw_props WHERE raw_prop_id IS UUID
-- ============================================================================

-- Link shadow_decisions to raw_props where raw_prop_id contains a valid UUID
UPDATE shadow_decisions sd
SET 
  prop_id = sd.raw_prop_id::UUID,
  dataset_label = COALESCE(dataset_label, '') || '_prop_linked'
WHERE sd.prop_id IS NULL 
  AND sd.raw_prop_id IS NOT NULL
  AND sd.raw_prop_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Log the prop linking operation
DO $$
DECLARE
    prop_linked_count INTEGER;
BEGIN
    GET DIAGNOSTICS prop_linked_count = ROW_COUNT;
    RAISE NOTICE 'Linked % shadow_decisions records to raw_props via raw_prop_id', prop_linked_count;
END $$;

-- ============================================================================
-- H) CREATE SETTLEMENT HEARTBEAT TABLE
-- ============================================================================

-- Table to track settlement pipeline runs
CREATE TABLE IF NOT EXISTS settlement_heartbeat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_name TEXT NOT NULL,
  last_run TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_count INTEGER NOT NULL DEFAULT 0,
  last_ok BOOLEAN NOT NULL DEFAULT FALSE,
  last_error TEXT,
  run_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_settlement_heartbeat_pipeline ON settlement_heartbeat(pipeline_name);
CREATE INDEX IF NOT EXISTS ix_settlement_heartbeat_last_run ON settlement_heartbeat(last_run);

-- Insert initial heartbeat record
INSERT INTO settlement_heartbeat (pipeline_name, last_count, last_ok, run_details)
VALUES ('mlb_settlement', 0, TRUE, '{"migration": "initial_setup"}')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- I) CREATE CROSSWALK TABLES FOR EXTERNAL ID MAPPING
-- ============================================================================

-- Cross-reference table for games across providers
CREATE TABLE IF NOT EXISTS xwalk_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  external_game_id TEXT NOT NULL,
  league_game_id TEXT NOT NULL, -- MLB gamePk, NBA gameId, etc.
  league TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_xwalk_games_provider_external ON xwalk_games(provider, external_game_id);
CREATE INDEX IF NOT EXISTS ix_xwalk_games_league_game_id ON xwalk_games(league_game_id);
CREATE INDEX IF NOT EXISTS ix_xwalk_games_league ON xwalk_games(league);

-- Cross-reference table for players across providers  
CREATE TABLE IF NOT EXISTS xwalk_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_player_id TEXT NOT NULL,
  league_player_id TEXT NOT NULL, -- MLBAM ID, NBA playerId, etc.
  player_name TEXT NOT NULL,
  league TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_xwalk_players_provider_player ON xwalk_players(provider, provider_player_id);
CREATE INDEX IF NOT EXISTS ix_xwalk_players_league_player_id ON xwalk_players(league_player_id);
CREATE INDEX IF NOT EXISTS ix_xwalk_players_name ON xwalk_players(LOWER(player_name));
CREATE INDEX IF NOT EXISTS ix_xwalk_players_league ON xwalk_players(league);

-- ============================================================================
-- J) VERIFICATION QUERIES & FINAL SUMMARY
-- ============================================================================

-- Summary of migration results
DO $$
DECLARE
    null_game_ids INTEGER;
    duplicate_unique_keys INTEGER;
    linked_decisions INTEGER;
    prop_linked_decisions INTEGER;
BEGIN
    -- Count remaining null game_ids
    SELECT COUNT(*) INTO null_game_ids
    FROM raw_props 
    WHERE game_id IS NULL;
    
    -- Count remaining duplicate unique_keys
    SELECT COUNT(*) INTO duplicate_unique_keys
    FROM (
      SELECT unique_key 
      FROM raw_props 
      WHERE unique_key IS NOT NULL
      GROUP BY unique_key 
      HAVING COUNT(*) > 1
    ) dupes;
    
    -- Count linked shadow_decisions
    SELECT COUNT(*) INTO linked_decisions
    FROM shadow_decisions 
    WHERE game_id IS NOT NULL;
    
    -- Count prop-linked shadow_decisions
    SELECT COUNT(*) INTO prop_linked_decisions
    FROM shadow_decisions 
    WHERE prop_id IS NOT NULL;
    
    RAISE NOTICE '========== MIGRATION SUMMARY ==========';
    RAISE NOTICE 'Remaining raw_props.game_id NULLs: %', null_game_ids;
    RAISE NOTICE 'Remaining raw_props.unique_key duplicates: %', duplicate_unique_keys;
    RAISE NOTICE 'shadow_decisions linked to games: %', linked_decisions;
    RAISE NOTICE 'shadow_decisions linked to props: %', prop_linked_decisions;
    RAISE NOTICE '=======================================';
END $$;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (COMMENTED)
-- ============================================================================

/*
-- To rollback this migration (if needed):

-- Remove added columns from shadow_decisions
ALTER TABLE shadow_decisions 
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS approved_by,
  DROP COLUMN IF EXISTS approved_at,
  DROP COLUMN IF EXISTS published,
  DROP COLUMN IF EXISTS dry_run,
  DROP COLUMN IF EXISTS discord_thread_id,
  DROP COLUMN IF EXISTS discord_message_id,
  DROP COLUMN IF EXISTS actual_result,
  DROP COLUMN IF EXISTS settled_at,
  DROP COLUMN IF EXISTS settlement_source,
  DROP COLUMN IF EXISTS settlement_details,
  DROP COLUMN IF EXISTS dataset_label,
  DROP COLUMN IF EXISTS prop_id,
  DROP COLUMN IF EXISTS game_id;

-- Drop created indexes
DROP INDEX IF EXISTS ix_shadow_decisions_status;
DROP INDEX IF EXISTS ix_shadow_decisions_settled_at;
DROP INDEX IF EXISTS ix_shadow_decisions_created_at;
-- ... (other indexes)

-- Drop foreign key constraints
ALTER TABLE raw_props DROP CONSTRAINT IF EXISTS fk_raw_props_games_id;
ALTER TABLE shadow_decisions DROP CONSTRAINT IF EXISTS fk_shadow_prop;
ALTER TABLE shadow_decisions DROP CONSTRAINT IF EXISTS fk_shadow_game;

-- Drop created tables
DROP TABLE IF EXISTS settlement_heartbeat;
DROP TABLE IF EXISTS xwalk_games;
DROP TABLE IF EXISTS xwalk_players;

-- Note: Backfilled game_id values and deduplicated records cannot be easily rolled back
*/

-- ============================================================================
-- NEXT STEPS
-- ============================================================================

/*
1. Validate foreign keys after settlement pipeline improves coverage:
   ALTER TABLE raw_props VALIDATE CONSTRAINT fk_raw_props_games_id;
   
2. Add unique constraint to raw_props.unique_key after deduplication:
   CREATE UNIQUE INDEX CONCURRENTLY ux_raw_props_unique_key ON raw_props(unique_key) WHERE unique_key IS NOT NULL;
   ALTER TABLE raw_props ADD CONSTRAINT uq_raw_props_unique_key UNIQUE USING INDEX ux_raw_props_unique_key;
   
3. Run settlement backfill:
   npm run settlement:backfill -- --league=MLB --max=1000 --lookbackHours=168
*/