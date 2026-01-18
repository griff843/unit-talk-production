-- ===============================================================================
-- Historical Migration: Backfill unified_picks → picks (Canonical)
-- Date: 2025-10-30
-- Purpose: Idempotent migration of historical picks data to canonical tables
-- Version: 1.0.0
-- Charter Compliance: v3.0 - Canonical-first architecture
-- ===============================================================================

-- ===============================================================================
-- 1. ENSURE CANONICAL TABLES EXIST
-- ===============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'picks') THEN
    RAISE EXCEPTION 'Canonical table "picks" does not exist. Run canonical schema migration first.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pick_publish') THEN
    RAISE EXCEPTION 'Canonical table "pick_publish" does not exist. Run canonical schema migration first.';
  END IF;
END $$;

-- ===============================================================================
-- 2. CHECK IF unified_picks EXISTS (Fallback Table)
-- ===============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'unified_picks') THEN
    RAISE NOTICE 'unified_picks table does not exist. Skipping backfill.';
    RETURN;
  END IF;
END $$;

-- ===============================================================================
-- 3. BACKFILL: unified_picks → picks (Idempotent)
-- ===============================================================================

-- Column Mapping:
-- unified_picks.id → picks.id
-- unified_picks.user_id → picks.user_id
-- unified_picks.prediction → picks.selection
-- unified_picks.confidence_score → picks.confidence
-- unified_picks.bet_slip_id → picks.bet_slip_id
-- unified_picks.created_at → picks.created_at
-- unified_picks.updated_at → picks.updated_at

INSERT INTO picks (
  id,
  tenant_id,
  user_id,
  prop_id,
  selection,
  odds,
  stake,
  confidence,
  workflow_stage,
  status,
  result,
  actual_value,
  profit_loss,
  settled_at,
  professional_score,
  grading_status,
  graded_at,
  idempotency_key,
  bet_slip_id,
  metadata,
  created_at,
  updated_at,
  published_at
)
SELECT
  up.id,
  COALESCE(up.tenant_id, '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a'::UUID) AS tenant_id,  -- Default tenant
  up.user_id,
  up.prop_id,
  COALESCE(up.prediction, up.direction, up.selection, 'over') AS selection,  -- Map prediction/direction/selection
  COALESCE(up.odds, -110) AS odds,  -- Default to -110 if missing
  COALESCE(up.stake, up.units, 1.0) AS stake,
  COALESCE(up.confidence_score, up.confidence, 5) AS confidence,
  CASE
    WHEN up.published_at IS NOT NULL THEN 'published'
    WHEN up.approved_at IS NOT NULL THEN 'approved'
    WHEN up.status = 'draft' THEN 'draft'
    ELSE 'approved'
  END AS workflow_stage,
  COALESCE(up.result, up.status, 'pending') AS status,
  up.result,
  up.actual_value,
  up.profit_loss,
  up.settled_at,
  up.professional_score,
  COALESCE(up.grading_status, 'pending') AS grading_status,
  up.graded_at,
  COALESCE(up.idempotency_key, 'backfill-' || up.id::text) AS idempotency_key,
  up.bet_slip_id,
  COALESCE(up.metadata, '{}'::JSONB) AS metadata,
  up.created_at,
  up.updated_at,
  up.published_at
FROM unified_picks up
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'unified_picks')
ON CONFLICT (id) DO NOTHING;  -- Idempotent: skip duplicates

-- Log migration progress
DO $$
DECLARE
  v_rows_migrated INTEGER;
  v_total_rows INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'unified_picks') THEN
    SELECT COUNT(*) INTO v_total_rows FROM unified_picks;
    SELECT COUNT(*) INTO v_rows_migrated FROM picks WHERE idempotency_key LIKE 'backfill-%';

    RAISE NOTICE 'Backfill Summary: % of % rows migrated from unified_picks to picks', v_rows_migrated, v_total_rows;
  END IF;
END $$;

-- ===============================================================================
-- 4. BACKFILL: pick_publish (Optional - Only if external_message_id exists)
-- ===============================================================================

-- Seed pick_publish for picks that have been published to Discord
INSERT INTO pick_publish (
  pick_id,
  tenant_id,
  channel,
  status,
  thread_id,
  external_message_id,
  discord_channel_id,
  attempts,
  max_attempts,
  sent_at,
  confirmed_at,
  metadata,
  created_at,
  updated_at
)
SELECT
  up.id AS pick_id,
  COALESCE(up.tenant_id, '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a'::UUID) AS tenant_id,
  'DISCORD' AS channel,
  CASE
    WHEN up.external_message_id IS NOT NULL THEN 'sent'
    WHEN up.published_at IS NOT NULL THEN 'queued'
    ELSE 'pending'
  END AS status,
  up.thread_id,
  up.external_message_id,
  up.discord_channel_id,
  0 AS attempts,
  3 AS max_attempts,
  up.published_at AS sent_at,
  CASE WHEN up.external_message_id IS NOT NULL THEN up.published_at END AS confirmed_at,
  COALESCE(up.metadata, '{}'::JSONB) AS metadata,
  up.created_at,
  COALESCE(up.updated_at, up.created_at) AS updated_at
FROM unified_picks up
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'unified_picks')
  AND (up.external_message_id IS NOT NULL OR up.published_at IS NOT NULL)
  AND EXISTS (SELECT 1 FROM picks WHERE id = up.id)
ON CONFLICT (pick_id, channel) DO NOTHING;

-- Log pick_publish backfill
DO $$
DECLARE
  v_publish_rows INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'unified_picks') THEN
    SELECT COUNT(*) INTO v_publish_rows
    FROM pick_publish
    WHERE pick_id IN (SELECT id FROM unified_picks);

    RAISE NOTICE 'pick_publish backfill: % rows created for published picks', v_publish_rows;
  END IF;
END $$;

-- ===============================================================================
-- 5. CREATE BACKFILL METRICS TABLE
-- ===============================================================================
CREATE TABLE IF NOT EXISTS backfill_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_name TEXT NOT NULL,
  source_table TEXT NOT NULL,
  target_table TEXT NOT NULL,
  total_source_rows INTEGER,
  rows_migrated INTEGER,
  rows_skipped INTEGER,
  duration_seconds DECIMAL(10,2),
  status TEXT CHECK (status IN ('started', 'completed', 'failed')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Record backfill metrics
INSERT INTO backfill_metrics (
  migration_name,
  source_table,
  target_table,
  total_source_rows,
  rows_migrated,
  rows_skipped,
  status,
  metadata,
  completed_at
)
SELECT
  '20251030_backfill_unified_to_canonical' AS migration_name,
  'unified_picks' AS source_table,
  'picks' AS target_table,
  (SELECT COUNT(*) FROM unified_picks) AS total_source_rows,
  (SELECT COUNT(*) FROM picks WHERE idempotency_key LIKE 'backfill-%') AS rows_migrated,
  (SELECT COUNT(*) FROM unified_picks) - (SELECT COUNT(*) FROM picks WHERE idempotency_key LIKE 'backfill-%') AS rows_skipped,
  'completed' AS status,
  jsonb_build_object(
    'canonical_driver', 'canonical',
    'charter_version', 'v3.0',
    'pick_publish_rows', (SELECT COUNT(*) FROM pick_publish WHERE pick_id IN (SELECT id FROM unified_picks))
  ) AS metadata,
  NOW() AS completed_at
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'unified_picks');

-- ===============================================================================
-- 6. TRIGGER POSTGREST RELOAD
-- ===============================================================================
SELECT pg_notify('pgrst', 'reload schema');

-- Log reload via RPC (if available)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'pgrst_reload'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    PERFORM pgrst_reload('backfill-migration', 'Post-backfill schema reload');
  END IF;
END $$;

-- ===============================================================================
-- 7. COMMENTS
-- ===============================================================================
COMMENT ON TABLE backfill_metrics IS 'Tracks historical migration metrics for canonical convergence';

-- ===============================================================================
-- END OF MIGRATION
-- ===============================================================================
