-- ============================================================================
-- Migration: PR10 Add form_source Column to unified_picks
-- Date: 2026-01-21
-- Authority: SYSTEM_CONTRACT.md - Smart Form E2E Proof Requirements
-- ============================================================================
--
-- PURPOSE:
-- Add form_source column to unified_picks to track pick submission source.
-- This enables Smart Form E2E proof by distinguishing UI submissions from
-- test scripts or API injections.
--
-- REQUIRED FOR:
-- - Smart Form E2E gate validation
-- - Distinguishing 'smart_form' vs 'api' vs 'test_script' sources
-- - CHECK constraint enforcement for smart_form required fields
-- ============================================================================

-- Add form_source column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'unified_picks' AND column_name = 'form_source'
  ) THEN
    ALTER TABLE unified_picks ADD COLUMN form_source TEXT DEFAULT NULL;
    COMMENT ON COLUMN unified_picks.form_source IS
      'Source of the pick submission: smart_form, api, test_script, etc.';
  END IF;
END $$;

-- Add CHECK constraint for Smart Form required fields
-- Only enforce when form_source='smart_form'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_smart_form_required_fields'
  ) THEN
    ALTER TABLE unified_picks
    ADD CONSTRAINT chk_smart_form_required_fields CHECK (
      form_source IS DISTINCT FROM 'smart_form' OR (
        stake IS NOT NULL AND
        user_id IS NOT NULL AND
        selection IS NOT NULL AND
        sport IS NOT NULL AND
        trace_id IS NOT NULL
      )
    );

    COMMENT ON CONSTRAINT chk_smart_form_required_fields ON unified_picks IS
      'Enforces Smart Form minimum required fields per SYSTEM_CONTRACT.md. ' ||
      'Picks with form_source=smart_form must have: stake (units), user_id (capper), selection, sport, trace_id.';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'unified_picks' AND column_name = 'form_source';
--
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'unified_picks'::regclass AND conname = 'chk_smart_form_required_fields';
-- ============================================================================
