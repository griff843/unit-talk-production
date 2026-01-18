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
  v_cutoff_date date;
  v_has_status boolean;
BEGIN
  v_cutoff_date := CURRENT_DATE - (p_days || ' days')::interval;

  -- Check if status column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'market_props'
    AND column_name = 'status'
  ) INTO v_has_status;

  -- Skip if market_props table doesn't exist or is empty source
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'market_props') THEN
    RETURN QUERY SELECT 0::bigint, 0::bigint, 0::bigint;
    RETURN;
  END IF;

  -- Insert from raw_props to market_props with conditional status column
  IF v_has_status THEN
    WITH inserted AS (
      INSERT INTO public.market_props (
        sport, market, selection, line, odds, over_odds, under_odds,
        bookmaker_key, best_book, best_available_line,
        game_date, game_time, player_name, team, opponent,
        external_prop_id, external_game_id, game_id, metadata,
        status, created_at, updated_at
      )
      SELECT
        COALESCE((rp.metadata->>'sport')::text, rp.sport, 'NFL'),
        COALESCE((rp.metadata->>'market')::text, (rp.metadata->>'market_type')::text, 'player_prop'),
        COALESCE(rp.selection, (rp.metadata->>'selection')::text),
        COALESCE(rp.line, (rp.metadata->>'line')::numeric),
        COALESCE(rp.odds, (rp.metadata->>'odds')::numeric),
        COALESCE(rp.over_odds, (rp.metadata->>'over_odds')::numeric),
        COALESCE(rp.under_odds, (rp.metadata->>'under_odds')::numeric),
        COALESCE((rp.metadata->>'bookmaker_key')::text, 'unknown'),
        (rp.metadata->>'best_book')::text,
        (rp.metadata->>'best_available_line')::numeric,
        COALESCE(rp.game_date, CURRENT_DATE),
        (rp.metadata->>'game_time')::time,
        COALESCE(rp.player_name, (rp.metadata->>'player_name')::text),
        COALESCE((rp.metadata->>'team')::text, 'Unknown'),
        (rp.metadata->>'opponent')::text,
        rp.external_id,
        (rp.metadata->>'external_game_id')::text,
        (rp.metadata->>'game_id')::uuid,
        rp.metadata,
        'active',
        COALESCE(rp.created_at, NOW()),
        NOW()
      FROM public.raw_props rp
      WHERE rp.game_date >= v_cutoff_date
        AND rp.player_name IS NOT NULL
      ON CONFLICT (external_prop_id) DO NOTHING
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_inserted FROM inserted;
  ELSE
    -- Insert without status column for older schemas
    WITH inserted AS (
      INSERT INTO public.market_props (
        sport, market, selection, line, odds, over_odds, under_odds,
        bookmaker_key, best_book, best_available_line,
        game_date, game_time, player_name, team, opponent,
        external_prop_id, external_game_id, game_id, metadata,
        created_at, updated_at
      )
      SELECT
        COALESCE((rp.metadata->>'sport')::text, rp.sport, 'NFL'),
        COALESCE((rp.metadata->>'market')::text, (rp.metadata->>'market_type')::text, 'player_prop'),
        COALESCE(rp.selection, (rp.metadata->>'selection')::text),
        COALESCE(rp.line, (rp.metadata->>'line')::numeric),
        COALESCE(rp.odds, (rp.metadata->>'odds')::numeric),
        COALESCE(rp.over_odds, (rp.metadata->>'over_odds')::numeric),
        COALESCE(rp.under_odds, (rp.metadata->>'under_odds')::numeric),
        COALESCE((rp.metadata->>'bookmaker_key')::text, 'unknown'),
        (rp.metadata->>'best_book')::text,
        (rp.metadata->>'best_available_line')::numeric,
        COALESCE(rp.game_date, CURRENT_DATE),
        (rp.metadata->>'game_time')::time,
        COALESCE(rp.player_name, (rp.metadata->>'player_name')::text),
        COALESCE((rp.metadata->>'team')::text, 'Unknown'),
        (rp.metadata->>'opponent')::text,
        rp.external_id,
        (rp.metadata->>'external_game_id')::text,
        (rp.metadata->>'game_id')::uuid,
        rp.metadata,
        COALESCE(rp.created_at, NOW()),
        NOW()
      FROM public.raw_props rp
      WHERE rp.game_date >= v_cutoff_date
        AND rp.player_name IS NOT NULL
      ON CONFLICT (external_prop_id) DO NOTHING
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_inserted FROM inserted;
  END IF;

  -- Get total count
  SELECT COUNT(*) INTO v_total
  FROM public.market_props
  WHERE game_date >= CURRENT_DATE;

  RETURN QUERY SELECT v_inserted, (0)::bigint, v_total;
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
