-- PR10: Add form_source Column to unified_picks for Smart Form E2E Tracing
-- Purpose: Enable identification of picks submitted via Smart Form UI
-- Date: 2026-01-20
--
-- CANONICAL RULES:
--   - unified_picks is the ONLY writable pick table
--   - form_source='smart_form' marks picks from Smart Form UI submissions
--   - This enables E2E tracing from Smart Form → unified_picks → pick_publish → Discord

BEGIN;

-- Add form_source column to unified_picks if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'unified_picks'
                   AND column_name = 'form_source') THEN
        ALTER TABLE public.unified_picks ADD COLUMN form_source TEXT;
        RAISE NOTICE 'Added form_source column to unified_picks';
    ELSE
        RAISE NOTICE 'form_source column already exists in unified_picks';
    END IF;
END $$;

-- Add stat_type column if it doesn't exist (used by Smart Form)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'unified_picks'
                   AND column_name = 'stat_type') THEN
        ALTER TABLE public.unified_picks ADD COLUMN stat_type TEXT;
        RAISE NOTICE 'Added stat_type column to unified_picks';
    ELSE
        RAISE NOTICE 'stat_type column already exists in unified_picks';
    END IF;
END $$;

-- Add line column if it doesn't exist (betting line)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'unified_picks'
                   AND column_name = 'line') THEN
        ALTER TABLE public.unified_picks ADD COLUMN line NUMERIC(10,2);
        RAISE NOTICE 'Added line column to unified_picks';
    ELSE
        RAISE NOTICE 'line column already exists in unified_picks';
    END IF;
END $$;

-- Add source column if it doesn't exist (api/manual)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'unified_picks'
                   AND column_name = 'source') THEN
        ALTER TABLE public.unified_picks ADD COLUMN source TEXT DEFAULT 'api';
        RAISE NOTICE 'Added source column to unified_picks';
    ELSE
        RAISE NOTICE 'source column already exists in unified_picks';
    END IF;
END $$;

-- Add is_live column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'unified_picks'
                   AND column_name = 'is_live') THEN
        ALTER TABLE public.unified_picks ADD COLUMN is_live BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added is_live column to unified_picks';
    ELSE
        RAISE NOTICE 'is_live column already exists in unified_picks';
    END IF;
END $$;

-- Add team_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'unified_picks'
                   AND column_name = 'team_id') THEN
        ALTER TABLE public.unified_picks ADD COLUMN team_id UUID;
        RAISE NOTICE 'Added team_id column to unified_picks';
    ELSE
        RAISE NOTICE 'team_id column already exists in unified_picks';
    END IF;
END $$;

-- Add player_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'unified_picks'
                   AND column_name = 'player_id') THEN
        ALTER TABLE public.unified_picks ADD COLUMN player_id UUID;
        RAISE NOTICE 'Added player_id column to unified_picks';
    ELSE
        RAISE NOTICE 'player_id column already exists in unified_picks';
    END IF;
END $$;

-- Add workflow_stage column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'unified_picks'
                   AND column_name = 'workflow_stage') THEN
        ALTER TABLE public.unified_picks ADD COLUMN workflow_stage TEXT DEFAULT 'pending_review';
        RAISE NOTICE 'Added workflow_stage column to unified_picks';
    ELSE
        RAISE NOTICE 'workflow_stage column already exists in unified_picks';
    END IF;
END $$;

-- Create index on form_source for efficient filtering
CREATE INDEX IF NOT EXISTS idx_unified_picks_form_source ON public.unified_picks(form_source);

-- Create index on workflow_stage
CREATE INDEX IF NOT EXISTS idx_unified_picks_workflow_stage ON public.unified_picks(workflow_stage);

COMMENT ON COLUMN public.unified_picks.form_source IS 'Source of pick submission: smart_form, discord_bot, api, etc.';
COMMENT ON COLUMN public.unified_picks.stat_type IS 'Type of stat for player props: passing_yards, rushing_yards, etc.';
COMMENT ON COLUMN public.unified_picks.line IS 'Betting line value (e.g., 285.5 for over/under)';
COMMENT ON COLUMN public.unified_picks.source IS 'Odds source: api (from data feeds) or manual (user entered)';
COMMENT ON COLUMN public.unified_picks.is_live IS 'Whether this is a live in-game bet';
COMMENT ON COLUMN public.unified_picks.workflow_stage IS 'Pick workflow stage: pending_review, approved, rejected, published';

-- Verification
DO $$
DECLARE
    col_count INT;
BEGIN
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'unified_picks'
    AND column_name IN ('form_source', 'stat_type', 'line', 'source', 'is_live', 'team_id', 'player_id', 'workflow_stage');

    RAISE NOTICE 'Verified % Smart Form columns exist in unified_picks', col_count;
END $$;

COMMIT;
