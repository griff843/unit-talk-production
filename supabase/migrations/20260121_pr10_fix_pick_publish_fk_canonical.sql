-- PR10: Fix pick_publish FK to Reference unified_picks (Canonical Schema Alignment)
-- Purpose: Correct the pick_publish.pick_id FK to reference unified_picks instead of picks
-- Date: 2026-01-21
-- Author: Release Integrity Engineer
--
-- PROBLEM:
--   - picks is currently a TABLE (not a VIEW as documented)
--   - pick_publish.pick_id FK references picks TABLE
--   - This violates canonical rules: unified_picks should be the only writable pick table
--
-- SOLUTION:
--   1. Add missing columns to unified_picks to support pick_publish data
--   2. Migrate picks data to unified_picks
--   3. Update pick_publish FK to reference unified_picks
--   4. Convert picks TABLE to a READ-ONLY VIEW
--
-- CANONICAL RULES (ABSOLUTE):
--   - unified_picks is the ONLY writable pick table
--   - pick_publish.pick_id MUST reference unified_picks(id)
--   - picks MUST be a READ-ONLY VIEW (no inserts allowed)

BEGIN;

-- ============================================================================
-- STEP 1: Add missing columns to unified_picks if they don't exist
-- ============================================================================
-- The existing unified_picks table may be missing columns that picks has
-- We need: tenant_id, selection, stake, confidence, status, metadata, bet_slip_id

DO $$
BEGIN
    -- Add tenant_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'unified_picks' AND column_name = 'tenant_id') THEN
        ALTER TABLE public.unified_picks ADD COLUMN tenant_id UUID;
    END IF;

    -- Add selection if missing (maps from 'side' or needs new column)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'unified_picks' AND column_name = 'selection') THEN
        ALTER TABLE public.unified_picks ADD COLUMN selection TEXT;
    END IF;

    -- Add stake if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'unified_picks' AND column_name = 'stake') THEN
        ALTER TABLE public.unified_picks ADD COLUMN stake NUMERIC(10,2);
    END IF;

    -- Add confidence if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'unified_picks' AND column_name = 'confidence') THEN
        ALTER TABLE public.unified_picks ADD COLUMN confidence INTEGER;
    END IF;

    -- Add status if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'unified_picks' AND column_name = 'status') THEN
        ALTER TABLE public.unified_picks ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;

    -- Add bet_slip_id if missing (needed for pick_publish relationship)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'unified_picks' AND column_name = 'bet_slip_id') THEN
        ALTER TABLE public.unified_picks ADD COLUMN bet_slip_id TEXT;
    END IF;

    -- Add legacy_pick_id to track migrated records
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'unified_picks' AND column_name = 'legacy_pick_id') THEN
        ALTER TABLE public.unified_picks ADD COLUMN legacy_pick_id UUID;
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Create index on legacy_pick_id for FK migration
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_unified_picks_legacy_pick_id ON public.unified_picks(legacy_pick_id);
CREATE INDEX IF NOT EXISTS idx_unified_picks_bet_slip_id_v2 ON public.unified_picks(bet_slip_id);

-- ============================================================================
-- STEP 3: Check if picks is a TABLE and migrate data
-- ============================================================================
DO $$
DECLARE
    picks_type TEXT;
    picks_count INTEGER;
BEGIN
    -- Check if picks is a table or view
    SELECT table_type INTO picks_type
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'picks';

    IF picks_type = 'BASE TABLE' THEN
        RAISE NOTICE 'picks is a TABLE - migrating data to unified_picks';

        -- Count records to migrate
        SELECT COUNT(*) INTO picks_count FROM public.picks;
        RAISE NOTICE 'Records to migrate: %', picks_count;

        -- Migrate picks data to unified_picks
        -- Map picks columns to unified_picks columns
        INSERT INTO public.unified_picks (
            legacy_pick_id,
            tenant_id,
            user_id,
            selection,
            odds,
            stake,
            confidence,
            status,
            bet_slip_id,
            meta,
            created_at,
            updated_at,
            -- Set defaults for required unified_picks columns
            sport,
            market,
            side,
            workflow_stage,
            game_date
        )
        SELECT
            p.id AS legacy_pick_id,
            p.tenant_id,
            p.user_id,
            p.selection,
            p.odds,
            p.stake,
            p.confidence,
            p.status,
            COALESCE(p.bet_slip_id, p.metadata->>'bet_slip_id', 'migrated_' || p.id::text) AS bet_slip_id,
            p.metadata AS meta,
            p.created_at,
            p.updated_at,
            -- Defaults
            COALESCE(p.metadata->>'league', p.metadata->>'sport', 'NFL') AS sport,
            COALESCE(p.metadata->>'stat_type', 'spread') AS market,
            p.selection AS side,
            COALESCE(p.workflow_stage, 'draft') AS workflow_stage,
            CURRENT_DATE AS game_date
        FROM public.picks p
        WHERE NOT EXISTS (
            SELECT 1 FROM public.unified_picks up
            WHERE up.legacy_pick_id = p.id
        )
        ON CONFLICT DO NOTHING;

        RAISE NOTICE 'Data migration completed';
    ELSIF picks_type = 'VIEW' THEN
        RAISE NOTICE 'picks is already a VIEW - no data migration needed';
    ELSE
        RAISE NOTICE 'picks does not exist or has unexpected type: %', picks_type;
    END IF;
END $$;

-- ============================================================================
-- STEP 4: Update pick_publish.pick_id to reference unified_picks
-- ============================================================================
-- First, update pick_publish records to point to the new unified_picks IDs

UPDATE public.pick_publish pp
SET pick_id = (
    SELECT up.id
    FROM public.unified_picks up
    WHERE up.legacy_pick_id = pp.pick_id
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1
    FROM public.unified_picks up
    WHERE up.legacy_pick_id = pp.pick_id
);

-- ============================================================================
-- STEP 5: Drop existing FK constraint on pick_publish
-- ============================================================================
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find and drop any FK constraint on pick_publish.pick_id
    FOR constraint_name IN
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = 'pick_publish'
            AND kcu.column_name = 'pick_id'
            AND tc.table_schema = 'public'
    LOOP
        RAISE NOTICE 'Dropping FK constraint: %', constraint_name;
        EXECUTE format('ALTER TABLE public.pick_publish DROP CONSTRAINT IF EXISTS %I', constraint_name);
    END LOOP;
END $$;

-- ============================================================================
-- STEP 6: Add new FK constraint to reference unified_picks
-- ============================================================================
-- First make pick_id nullable temporarily for records that couldn't be migrated
ALTER TABLE public.pick_publish ALTER COLUMN pick_id DROP NOT NULL;

-- Add the new FK constraint
ALTER TABLE public.pick_publish
    ADD CONSTRAINT pick_publish_pick_id_unified_fkey
    FOREIGN KEY (pick_id) REFERENCES public.unified_picks(id) ON DELETE SET NULL;

-- ============================================================================
-- STEP 7: Drop picks TABLE and create as VIEW
-- ============================================================================
DO $$
DECLARE
    picks_type TEXT;
BEGIN
    -- Check current type
    SELECT table_type INTO picks_type
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'picks';

    IF picks_type = 'BASE TABLE' THEN
        RAISE NOTICE 'Dropping picks TABLE';

        -- Drop all constraints first
        EXECUTE 'ALTER TABLE public.picks DROP CONSTRAINT IF EXISTS picks_pkey CASCADE';
        EXECUTE 'ALTER TABLE public.picks DROP CONSTRAINT IF EXISTS picks_confidence_check CASCADE';

        -- Drop the table
        DROP TABLE IF EXISTS public.picks CASCADE;

        RAISE NOTICE 'picks TABLE dropped';
    ELSIF picks_type = 'VIEW' THEN
        RAISE NOTICE 'picks is already a VIEW, dropping to recreate';
        DROP VIEW IF EXISTS public.picks;
    END IF;
END $$;

-- ============================================================================
-- STEP 8: Create picks as READ-ONLY VIEW over unified_picks
-- ============================================================================
CREATE OR REPLACE VIEW public.picks AS
SELECT
    id,
    tenant_id,
    user_id,
    game_id,
    bet_slip_id,
    selection,
    odds,
    stake,
    confidence,
    workflow_stage,
    status,
    meta AS metadata,
    created_at,
    updated_at,
    -- Legacy mappings
    legacy_pick_id AS original_pick_id
FROM public.unified_picks;

COMMENT ON VIEW public.picks IS
'READ-ONLY backward compatibility view over unified_picks.
WRITE OPERATIONS WILL FAIL.
All pick writes MUST go to unified_picks.
This view exists only for backward compatibility with legacy services.
TODO: Remove this view once all services are migrated.';

-- ============================================================================
-- STEP 9: Create INSTEAD OF trigger to block writes (extra safety)
-- ============================================================================
CREATE OR REPLACE FUNCTION prevent_picks_write()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Cannot write to picks view. Use unified_picks table instead. picks is a READ-ONLY view.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_picks_insert ON public.picks;
CREATE TRIGGER prevent_picks_insert
    INSTEAD OF INSERT ON public.picks
    FOR EACH ROW EXECUTE FUNCTION prevent_picks_write();

DROP TRIGGER IF EXISTS prevent_picks_update ON public.picks;
CREATE TRIGGER prevent_picks_update
    INSTEAD OF UPDATE ON public.picks
    FOR EACH ROW EXECUTE FUNCTION prevent_picks_write();

DROP TRIGGER IF EXISTS prevent_picks_delete ON public.picks;
CREATE TRIGGER prevent_picks_delete
    INSTEAD OF DELETE ON public.picks
    FOR EACH ROW EXECUTE FUNCTION prevent_picks_write();

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================================
--
-- 1. Verify picks is now a VIEW:
--    SELECT table_name, table_type
--    FROM information_schema.tables
--    WHERE table_schema = 'public' AND table_name = 'picks';
--    Expected: table_type = 'VIEW'
--
-- 2. Verify pick_publish FK references unified_picks:
--    SELECT ccu.table_name AS foreign_table_name
--    FROM information_schema.table_constraints tc
--    JOIN information_schema.constraint_column_usage ccu
--        ON ccu.constraint_name = tc.constraint_name
--    WHERE tc.table_name = 'pick_publish'
--        AND tc.constraint_type = 'FOREIGN KEY';
--    Expected: foreign_table_name = 'unified_picks'
--
-- 3. Test that INSERT into picks fails:
--    INSERT INTO picks (user_id, selection) VALUES ('test', 'over');
--    Expected: ERROR about READ-ONLY view
