-- ============================================================================
-- Migration: PR10 Week 2 Smart Form Enforcement (ADDITIVE)
-- Date: 2026-01-21
-- Authority: SYSTEM_CONTRACT.md + Griff's Directive
-- ============================================================================
--
-- PURPOSE:
-- Add missing columns and enforce DB-level CHECK constraint for Smart Form
-- submissions. This is ADDITIVE and safe to run on any environment.
--
-- SMART FORM REQUIRED FIELDS (per Griff's authoritative directive):
-- 1. capper (user_id) - MUST NOT BE NULL
-- 2. units (stake) - MUST NOT BE NULL
-- 3. selection - MUST NOT BE NULL
-- 4. sport - MUST NOT BE NULL
-- 5. trace_id - MUST NOT BE NULL (for E2E observability)
--
-- CANONICAL COLUMN MAPPING:
-- - capper → user_id (UUID, FK → users.id)
-- - units → stake (NUMERIC(10,2))
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Add 'sport' column if not exists
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'unified_picks'
        AND column_name = 'sport'
    ) THEN
        ALTER TABLE public.unified_picks ADD COLUMN sport TEXT;
        RAISE NOTICE 'Added sport column to unified_picks';
    ELSE
        RAISE NOTICE 'sport column already exists in unified_picks';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Add 'trace_id' column if not exists
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'unified_picks'
        AND column_name = 'trace_id'
    ) THEN
        ALTER TABLE public.unified_picks ADD COLUMN trace_id TEXT;
        RAISE NOTICE 'Added trace_id column to unified_picks';
    ELSE
        RAISE NOTICE 'trace_id column already exists in unified_picks';
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Create indexes for new columns
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_unified_picks_sport ON public.unified_picks(sport);
CREATE INDEX IF NOT EXISTS idx_unified_picks_trace_id ON public.unified_picks(trace_id);

-- ============================================================================
-- STEP 4: Drop old CHECK constraint if exists (to avoid duplication)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_smart_form_required_fields'
        AND conrelid = 'public.unified_picks'::regclass
    ) THEN
        ALTER TABLE public.unified_picks DROP CONSTRAINT chk_smart_form_required_fields;
        RAISE NOTICE 'Dropped existing chk_smart_form_required_fields constraint';
    END IF;
END $$;

-- ============================================================================
-- STEP 5: Add CHECK constraint for Smart Form required fields
-- ============================================================================
-- AUTHORITATIVE RULE (per Griff):
-- If form_source='smart_form', then ALL of these MUST be NOT NULL:
--   - user_id (capper)
--   - stake (units)
--   - selection
--   - sport
--   - trace_id
--
-- Non-smart_form rows (API, ingestion, etc.) are NOT affected.
-- ============================================================================
ALTER TABLE public.unified_picks
ADD CONSTRAINT chk_smart_form_required_fields CHECK (
    form_source IS DISTINCT FROM 'smart_form' OR (
        user_id IS NOT NULL AND
        stake IS NOT NULL AND
        selection IS NOT NULL AND
        sport IS NOT NULL AND
        trace_id IS NOT NULL
    )
);

COMMENT ON CONSTRAINT chk_smart_form_required_fields ON public.unified_picks IS
    'Week 2 Enforcement: Smart Form submissions (form_source=smart_form) require: '
    'user_id (capper), stake (units), selection, sport, trace_id. '
    'Authority: SYSTEM_CONTRACT.md + Griff directive 2026-01-21';

-- ============================================================================
-- STEP 6: Add column comments for documentation
-- ============================================================================
COMMENT ON COLUMN public.unified_picks.sport IS 'Sport code: NFL, NBA, MLB, NHL, NCAAF, etc.';
COMMENT ON COLUMN public.unified_picks.trace_id IS 'End-to-end trace ID for observability (GAP-002)';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================================
--
-- 1. Verify columns exist:
--    SELECT column_name, data_type
--    FROM information_schema.columns
--    WHERE table_name = 'unified_picks'
--    AND column_name IN ('user_id', 'stake', 'selection', 'sport', 'trace_id', 'form_source');
--
-- 2. Verify constraint exists:
--    SELECT conname, pg_get_constraintdef(oid)
--    FROM pg_constraint
--    WHERE conrelid = 'public.unified_picks'::regclass
--    AND conname = 'chk_smart_form_required_fields';
--
-- 3. Test constraint enforcement (should FAIL):
--    INSERT INTO unified_picks (bet_slip_id, form_source, selection, odds)
--    VALUES ('test-fail', 'smart_form', 'over', -110);
--    -- Expected: ERROR - violates CHECK constraint (missing user_id, stake, sport, trace_id)
--
-- 4. Test non-smart_form bypass (should SUCCEED):
--    INSERT INTO unified_picks (bet_slip_id, form_source, selection, odds)
--    VALUES ('test-api', 'api', 'over', -110);
--    -- Expected: SUCCESS - form_source != 'smart_form' bypasses CHECK
-- ============================================================================
