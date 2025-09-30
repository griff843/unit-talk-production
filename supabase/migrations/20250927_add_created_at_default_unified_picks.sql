-- Migration: Add created_at default to unified_picks table (guarded)
-- Purpose: Ensure unified_picks has proper timestamp defaults for FeedAgent writes
-- Date: 2025-09-27

-- Check if unified_picks table exists and add created_at default if missing
DO $$
BEGIN
    -- Check if unified_picks table exists
    IF EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'unified_picks'
    ) THEN
        -- Check if created_at column exists
        IF EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'unified_picks'
            AND column_name = 'created_at'
        ) THEN
            -- Check if created_at already has a default value
            IF NOT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'unified_picks'
                AND column_name = 'created_at'
                AND column_default IS NOT NULL
            ) THEN
                -- Add default value to created_at column
                ALTER TABLE public.unified_picks
                ALTER COLUMN created_at SET DEFAULT now();

                RAISE NOTICE 'Added created_at default to unified_picks table';
            ELSE
                RAISE NOTICE 'unified_picks.created_at already has a default value';
            END IF;
        ELSE
            -- Add created_at column with default if it doesn't exist
            ALTER TABLE public.unified_picks
            ADD COLUMN created_at timestamptz DEFAULT now();

            RAISE NOTICE 'Added created_at column with default to unified_picks table';
        END IF;
    ELSE
        RAISE NOTICE 'unified_picks table does not exist, skipping migration';
    END IF;
END
$$;