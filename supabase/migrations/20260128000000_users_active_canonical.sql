-- Migration: Canonical users.active column
-- Date: 2026-01-28
-- Purpose: Add canonical active BOOLEAN column to users table
-- Contract: USERS_CANONICAL_CONTRACT.md

-- ============================================================================
-- PHASE C1: Add users.active BOOLEAN NOT NULL DEFAULT true
-- ============================================================================

-- Add the active column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'active'
    ) THEN
        ALTER TABLE public.users
        ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;

        RAISE NOTICE 'Added users.active column';
    ELSE
        RAISE NOTICE 'users.active column already exists';
    END IF;
END $$;

-- If status column exists, backfill active from status
-- active = true WHERE status = 'active', false otherwise
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'status'
    ) THEN
        UPDATE public.users
        SET active = (status = 'active')
        WHERE active IS NULL OR active != (status = 'active');

        RAISE NOTICE 'Backfilled active from status column';
    END IF;
END $$;

-- Add comment documenting the canonical contract
COMMENT ON COLUMN public.users.active IS
    'Canonical capper active status. NOT NULL enforced. See USERS_CANONICAL_CONTRACT.md';

-- Create index for active status queries
CREATE INDEX IF NOT EXISTS idx_users_active
ON public.users (active)
WHERE active = true;

-- ============================================================================
-- VERIFICATION QUERY (run after migration)
-- ============================================================================
-- SELECT
--     column_name,
--     data_type,
--     is_nullable,
--     column_default
-- FROM information_schema.columns
-- WHERE table_name = 'users' AND column_name = 'active';
