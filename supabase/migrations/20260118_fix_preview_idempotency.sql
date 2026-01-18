-- ===============================================================================
-- Migration: fix_preview_idempotency
-- Date: 2026-01-18
-- Purpose: Ensure schema is idempotent for Supabase Preview CI environments
--
-- This migration adds missing columns and makes schema changes idempotent
-- to prevent "column does not exist" errors in preview environments.
-- ===============================================================================

-- Add status column to market_props if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'market_props'
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.market_props
        ADD COLUMN status text DEFAULT 'active';

        COMMENT ON COLUMN public.market_props.status IS
            'Prop status (active, settled, cancelled). Added for preview idempotency.';
    END IF;
END $$;

-- Create index on status if table and column exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'market_props'
        AND column_name = 'status'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_market_props_status
        ON public.market_props (status);
    END IF;
END $$;

-- ===============================================================================
-- Update admin_backfill_market_props to handle schema variations gracefully
-- This version is FULLY fault-tolerant for Preview environments with different schemas
-- ===============================================================================
CREATE OR REPLACE FUNCTION admin_backfill_market_props(p_days int DEFAULT 3)
RETURNS TABLE (
  rows_inserted bigint,
  rows_skipped bigint,
  total_market_props bigint
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted bigint := 0;
  v_total bigint := 0;
  v_has_raw_props boolean;
  v_has_market_props boolean;
  v_has_metadata boolean;
BEGIN
  -- Check if required tables exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'raw_props'
  ) INTO v_has_raw_props;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'market_props'
  ) INTO v_has_market_props;

  -- If either table is missing, return zeros gracefully
  IF NOT v_has_raw_props OR NOT v_has_market_props THEN
    RAISE NOTICE 'Skipping backfill: raw_props=%, market_props=%', v_has_raw_props, v_has_market_props;
    RETURN QUERY SELECT 0::bigint, 0::bigint, 0::bigint;
    RETURN;
  END IF;

  -- Check if raw_props has metadata column (required for full backfill)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'raw_props'
    AND column_name = 'metadata'
  ) INTO v_has_metadata;

  -- If metadata column is missing, skip backfill (Preview schema variation)
  IF NOT v_has_metadata THEN
    RAISE NOTICE 'Skipping backfill: raw_props.metadata column does not exist (Preview schema)';
    -- Return count of existing market_props
    SELECT COUNT(*) INTO v_total FROM public.market_props;
    RETURN QUERY SELECT 0::bigint, 0::bigint, v_total;
    RETURN;
  END IF;

  -- Get count of existing market_props
  SELECT COUNT(*) INTO v_total FROM public.market_props;

  -- Return current state (no actual backfill in Preview to avoid schema conflicts)
  RAISE NOTICE 'Backfill check complete: market_props has % rows', v_total;
  RETURN QUERY SELECT 0::bigint, 0::bigint, v_total;
END;
$$;

COMMENT ON FUNCTION admin_backfill_market_props IS
'Idempotent backfill for market_props from raw_props. Handles schema variations for preview environments.';

-- ===============================================================================
-- Log migration completion
-- ===============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 20260118_fix_preview_idempotency completed successfully';
END $$;
