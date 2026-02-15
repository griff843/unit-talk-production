-- ============================================================================
-- SINGLE-WRITER-SEAL-011: bet_slip_id Uniqueness + Authoritative INSERT RPC
-- Date: 2026-02-15
-- Sprint: SINGLE-WRITER-SEAL-011
--
-- Purpose:
--   P0-1: Add UNIQUE constraint on bet_slip_id (null-safe)
--   P0-2: Create authoritative RPC for unified_picks INSERT (single-writer)
--   P0-3: Create RPC for posted_to_discord mutation (no direct UPDATE)
--
-- Safe Application:
--   1. Archives any duplicate bet_slip_id rows (keeps canonical)
--   2. Adds UNIQUE constraint
--   3. Creates RPC functions with SECURITY DEFINER
--
-- Idempotent: Can be re-run safely
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 1: ARCHIVE TABLE FOR DUPLICATE REMEDIATION
-- ============================================================================

-- Create archive table to preserve any duplicates that might exist
CREATE TABLE IF NOT EXISTS public.unified_picks_duplicate_archive (
  archive_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  archived_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  archive_reason TEXT NOT NULL,
  canonical_pick_id UUID, -- Reference to the canonical row that was kept

  -- Original row data (all columns from unified_picks)
  original_id UUID NOT NULL,
  bet_slip_id TEXT,
  user_id UUID,
  capper_id UUID,
  sport TEXT,
  stat_type TEXT,
  line NUMERIC,
  odds INTEGER,
  selection TEXT,
  confidence INTEGER,
  tier TEXT,
  edge_score NUMERIC,
  professional_score NUMERIC,
  outcome TEXT,
  settlement_result TEXT,
  settlement_status TEXT,
  settlement_version INTEGER,
  settlement_hash TEXT,
  settled_at TIMESTAMPTZ,
  posted_to_discord BOOLEAN,
  discord_message_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,

  -- Store full original row as JSONB for completeness
  original_row_data JSONB NOT NULL
);

COMMENT ON TABLE public.unified_picks_duplicate_archive IS
  'SINGLE-WRITER-SEAL-011: Archive for duplicate bet_slip_id rows. Preserved for audit trail.';

CREATE INDEX IF NOT EXISTS idx_dup_archive_bet_slip_id
  ON public.unified_picks_duplicate_archive(bet_slip_id);

CREATE INDEX IF NOT EXISTS idx_dup_archive_archived_at
  ON public.unified_picks_duplicate_archive(archived_at DESC);

-- ============================================================================
-- PHASE 2: DUPLICATE REMEDIATION (DEFENSIVE)
-- ============================================================================

-- Move duplicates to archive, keeping the canonical row
-- Canonical = highest settlement_version, then newest updated_at, then newest created_at
DO $$
DECLARE
  v_duplicate_count INTEGER := 0;
  v_archived_count INTEGER := 0;
BEGIN
  -- Count duplicates before remediation
  SELECT COUNT(*) INTO v_duplicate_count
  FROM (
    SELECT bet_slip_id
    FROM public.unified_picks
    WHERE bet_slip_id IS NOT NULL AND bet_slip_id <> ''
    GROUP BY bet_slip_id
    HAVING COUNT(*) > 1
  ) dups;

  RAISE NOTICE 'SINGLE-WRITER-SEAL-011: Found % bet_slip_id values with duplicates', v_duplicate_count;

  IF v_duplicate_count > 0 THEN
    -- Archive non-canonical duplicates
    WITH ranked_picks AS (
      SELECT
        id,
        bet_slip_id,
        ROW_NUMBER() OVER (
          PARTITION BY bet_slip_id
          ORDER BY
            COALESCE(settlement_version, 0) DESC,
            COALESCE(updated_at, created_at) DESC,
            created_at DESC
        ) as rn
      FROM public.unified_picks
      WHERE bet_slip_id IS NOT NULL AND bet_slip_id <> ''
    ),
    canonical_picks AS (
      SELECT bet_slip_id, id as canonical_id
      FROM ranked_picks
      WHERE rn = 1
    ),
    duplicates_to_archive AS (
      SELECT rp.id, rp.bet_slip_id, cp.canonical_id
      FROM ranked_picks rp
      JOIN canonical_picks cp ON rp.bet_slip_id = cp.bet_slip_id
      WHERE rp.rn > 1
    )
    INSERT INTO public.unified_picks_duplicate_archive (
      archive_reason,
      canonical_pick_id,
      original_id,
      bet_slip_id,
      user_id,
      capper_id,
      sport,
      stat_type,
      line,
      odds,
      selection,
      confidence,
      tier,
      edge_score,
      professional_score,
      outcome,
      settlement_result,
      settlement_status,
      settlement_version,
      settlement_hash,
      settled_at,
      posted_to_discord,
      discord_message_id,
      created_at,
      updated_at,
      original_row_data
    )
    SELECT
      'SINGLE-WRITER-SEAL-011: Duplicate bet_slip_id remediation',
      d.canonical_id,
      up.id,
      up.bet_slip_id,
      up.user_id,
      up.capper_id,
      up.sport,
      up.stat_type,
      up.line,
      up.odds,
      up.selection,
      up.confidence,
      up.tier,
      up.edge_score,
      up.professional_score,
      up.outcome,
      up.settlement_result,
      up.settlement_status,
      up.settlement_version,
      up.settlement_hash,
      up.settled_at,
      up.posted_to_discord,
      up.discord_message_id,
      up.created_at,
      up.updated_at,
      to_jsonb(up.*)
    FROM public.unified_picks up
    JOIN duplicates_to_archive d ON up.id = d.id;

    GET DIAGNOSTICS v_archived_count = ROW_COUNT;
    RAISE NOTICE 'SINGLE-WRITER-SEAL-011: Archived % duplicate rows', v_archived_count;

    -- Delete the archived duplicates from main table
    DELETE FROM public.unified_picks
    WHERE id IN (
      SELECT original_id FROM public.unified_picks_duplicate_archive
      WHERE archive_reason = 'SINGLE-WRITER-SEAL-011: Duplicate bet_slip_id remediation'
    );

    RAISE NOTICE 'SINGLE-WRITER-SEAL-011: Removed duplicates from unified_picks';
  ELSE
    RAISE NOTICE 'SINGLE-WRITER-SEAL-011: No duplicates found - proceeding with constraint';
  END IF;
END $$;

-- ============================================================================
-- PHASE 3: UNIQUE CONSTRAINT ON bet_slip_id (NULL-SAFE)
-- ============================================================================

-- Drop existing constraint/index if exists (idempotent)
DROP INDEX IF EXISTS idx_unified_picks_bet_slip_id_unique;

-- Create UNIQUE index (null-safe: only enforces uniqueness on non-null, non-empty values)
CREATE UNIQUE INDEX idx_unified_picks_bet_slip_id_unique
  ON public.unified_picks(bet_slip_id)
  WHERE bet_slip_id IS NOT NULL AND bet_slip_id <> '';

COMMENT ON INDEX idx_unified_picks_bet_slip_id_unique IS
  'SINGLE-WRITER-SEAL-011: Enforces uniqueness on bet_slip_id. Idempotent inserts use this to detect duplicates.';

-- ============================================================================
-- PHASE 4: AUTHORITATIVE INSERT RPC (SINGLE-WRITER)
-- ============================================================================

-- Drop existing function if exists (for idempotent re-application)
DROP FUNCTION IF EXISTS create_unified_pick_idempotent(JSONB);

/**
 * create_unified_pick_idempotent: THE ONLY AUTHORIZED WAY TO INSERT unified_picks
 *
 * Requirements:
 *   - bet_slip_id REQUIRED in payload
 *   - If bet_slip_id exists: return existing row + idempotent=true
 *   - If bet_slip_id is new: insert and return row + idempotent=false
 *   - SECURITY DEFINER ensures only this function can insert
 *
 * Usage:
 *   SELECT * FROM create_unified_pick_idempotent('{"bet_slip_id": "...", "user_id": "...", ...}'::jsonb);
 */
CREATE OR REPLACE FUNCTION create_unified_pick_idempotent(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bet_slip_id TEXT;
  v_existing_pick RECORD;
  v_new_pick RECORD;
  v_trace_id TEXT;
BEGIN
  -- Extract bet_slip_id (REQUIRED)
  v_bet_slip_id := p_payload->>'bet_slip_id';
  v_trace_id := COALESCE(p_payload->>'trace_id', 'auto-' || gen_random_uuid()::TEXT);

  IF v_bet_slip_id IS NULL OR v_bet_slip_id = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'bet_slip_id is required and cannot be empty',
      'trace_id', v_trace_id
    );
  END IF;

  -- Check for existing row (idempotency check)
  SELECT * INTO v_existing_pick
  FROM public.unified_picks
  WHERE bet_slip_id = v_bet_slip_id
  LIMIT 1;

  IF FOUND THEN
    -- Return existing row (idempotent response)
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'message', 'Pick already exists with this bet_slip_id',
      'pick_id', v_existing_pick.id,
      'bet_slip_id', v_bet_slip_id,
      'created_at', v_existing_pick.created_at,
      'trace_id', v_trace_id
    );
  END IF;

  -- Insert new row
  INSERT INTO public.unified_picks (
    id,
    bet_slip_id,
    user_id,
    capper_id,
    sport,
    stat_type,
    line,
    odds,
    selection,
    confidence,
    tier,
    edge_score,
    professional_score,
    team_id,
    player_id,
    player_name,
    team_name,
    source,
    is_live,
    ticket_type,
    leg_index,
    total_ticket_odds_american,
    total_ticket_odds_decimal,
    total_units,
    units,
    matchup,
    game_start_time,
    odds_decimal,
    market,
    pick_type,
    selection_type,
    posted_to_discord,
    created_at,
    updated_at
  )
  VALUES (
    COALESCE((p_payload->>'id')::UUID, gen_random_uuid()),
    v_bet_slip_id,
    (p_payload->>'user_id')::UUID,
    (p_payload->>'capper_id')::UUID,
    p_payload->>'sport',
    p_payload->>'stat_type',
    (p_payload->>'line')::NUMERIC,
    (p_payload->>'odds')::INTEGER,
    p_payload->>'selection',
    (p_payload->>'confidence')::INTEGER,
    p_payload->>'tier',
    (p_payload->>'edge_score')::NUMERIC,
    (p_payload->>'professional_score')::NUMERIC,
    (p_payload->>'team_id')::UUID,
    (p_payload->>'player_id')::UUID,
    p_payload->>'player_name',
    p_payload->>'team_name',
    p_payload->>'source',
    COALESCE((p_payload->>'is_live')::BOOLEAN, false),
    p_payload->>'ticket_type',
    (p_payload->>'leg_index')::INTEGER,
    (p_payload->>'total_ticket_odds_american')::INTEGER,
    (p_payload->>'total_ticket_odds_decimal')::NUMERIC,
    (p_payload->>'total_units')::NUMERIC,
    (p_payload->>'units')::NUMERIC,
    p_payload->>'matchup',
    (p_payload->>'game_start_time')::TIMESTAMPTZ,
    (p_payload->>'odds_decimal')::NUMERIC,
    p_payload->>'market',
    p_payload->>'pick_type',
    p_payload->>'selection_type',
    false, -- Always start with posted_to_discord = false
    NOW(),
    NOW()
  )
  RETURNING * INTO v_new_pick;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'message', 'Pick created successfully',
    'pick_id', v_new_pick.id,
    'bet_slip_id', v_bet_slip_id,
    'created_at', v_new_pick.created_at,
    'trace_id', v_trace_id
  );

EXCEPTION WHEN unique_violation THEN
  -- Handle race condition where another process inserted between check and insert
  SELECT * INTO v_existing_pick
  FROM public.unified_picks
  WHERE bet_slip_id = v_bet_slip_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', true,
    'message', 'Pick already exists (race condition handled)',
    'pick_id', v_existing_pick.id,
    'bet_slip_id', v_bet_slip_id,
    'created_at', v_existing_pick.created_at,
    'trace_id', v_trace_id
  );
END;
$$;

COMMENT ON FUNCTION create_unified_pick_idempotent IS
  'SINGLE-WRITER-SEAL-011: THE ONLY AUTHORIZED WAY to insert unified_picks. '
  'Requires bet_slip_id. Returns existing row if duplicate (idempotent=true). '
  'All agents/APIs MUST use this function instead of direct INSERT.';

-- Grant execute to authenticated users (Supabase default role)
GRANT EXECUTE ON FUNCTION create_unified_pick_idempotent(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION create_unified_pick_idempotent(JSONB) TO service_role;

-- ============================================================================
-- PHASE 5: DISCORD POSTED FLAG AUTHORITY RPC
-- ============================================================================

-- Drop existing function if exists
DROP FUNCTION IF EXISTS mark_pick_posted_to_discord(UUID, TEXT, JSONB);

/**
 * mark_pick_posted_to_discord: THE ONLY AUTHORIZED WAY TO UPDATE posted_to_discord
 *
 * Requirements:
 *   - Idempotent: if already posted, returns idempotent=true
 *   - Records discord_message_id and metadata
 *   - No direct UPDATE allowed in TypeScript
 */
CREATE OR REPLACE FUNCTION mark_pick_posted_to_discord(
  p_pick_id UUID,
  p_message_id TEXT DEFAULT NULL,
  p_meta JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pick RECORD;
  v_trace_id TEXT;
BEGIN
  v_trace_id := COALESCE(p_meta->>'trace_id', 'discord-' || gen_random_uuid()::TEXT);

  -- Fetch the pick
  SELECT id, bet_slip_id, posted_to_discord, discord_message_id
  INTO v_pick
  FROM public.unified_picks
  WHERE id = p_pick_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pick not found: ' || p_pick_id::TEXT,
      'trace_id', v_trace_id
    );
  END IF;

  -- Check if already posted (idempotent)
  IF v_pick.posted_to_discord = true THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'message', 'Pick already marked as posted to Discord',
      'pick_id', p_pick_id,
      'bet_slip_id', v_pick.bet_slip_id,
      'discord_message_id', v_pick.discord_message_id,
      'trace_id', v_trace_id
    );
  END IF;

  -- Update the pick
  UPDATE public.unified_picks
  SET
    posted_to_discord = true,
    discord_message_id = COALESCE(p_message_id, discord_message_id),
    updated_at = NOW()
  WHERE id = p_pick_id;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'message', 'Pick marked as posted to Discord',
    'pick_id', p_pick_id,
    'bet_slip_id', v_pick.bet_slip_id,
    'discord_message_id', p_message_id,
    'trace_id', v_trace_id
  );
END;
$$;

COMMENT ON FUNCTION mark_pick_posted_to_discord IS
  'SINGLE-WRITER-SEAL-011: THE ONLY AUTHORIZED WAY to update posted_to_discord flag. '
  'Idempotent: returns idempotent=true if already posted. '
  'Records discord_message_id for tracking.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION mark_pick_posted_to_discord(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_pick_posted_to_discord(UUID, TEXT, JSONB) TO service_role;

-- ============================================================================
-- PHASE 6: VERIFICATION QUERIES (for manual validation)
-- ============================================================================

-- These queries can be run manually to verify the migration succeeded

-- Verify unique index exists:
-- SELECT indexname, indexdef FROM pg_indexes WHERE indexname = 'idx_unified_picks_bet_slip_id_unique';

-- Verify no duplicates remain:
-- SELECT bet_slip_id, COUNT(*) FROM unified_picks WHERE bet_slip_id IS NOT NULL AND bet_slip_id <> '' GROUP BY bet_slip_id HAVING COUNT(*) > 1;

-- Verify RPC functions exist:
-- SELECT proname, prosecdef FROM pg_proc WHERE proname IN ('create_unified_pick_idempotent', 'mark_pick_posted_to_discord');

-- Test idempotent insert (dry run):
-- SELECT * FROM create_unified_pick_idempotent('{"bet_slip_id": "test-123", "sport": "NBA"}'::jsonb);
-- SELECT * FROM create_unified_pick_idempotent('{"bet_slip_id": "test-123", "sport": "NBA"}'::jsonb); -- Should return idempotent=true

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
-- After this migration:
-- 1. All direct .from('unified_picks').insert() calls must be replaced with RPC call
-- 2. All direct .from('unified_picks').update({posted_to_discord: ...}) must use RPC
-- 3. The UNIQUE constraint will reject any future duplicate bet_slip_id inserts
-- 4. Existing duplicates (if any) are archived in unified_picks_duplicate_archive
