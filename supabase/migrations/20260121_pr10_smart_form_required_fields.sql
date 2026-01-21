-- ============================================================================
-- Migration: PR10 Smart Form Required Fields Enforcement
-- Date: 2026-01-21
-- Authority: SYSTEM_CONTRACT.md - Smart Form Minimum Required Fields
-- ============================================================================
--
-- PURPOSE:
-- Enforce at the database level that picks with form_source='smart_form' have
-- all required fields populated. This is a defense-in-depth measure that
-- complements the server-side validation in submit-ticket/route.ts.
--
-- REQUIRED FIELDS FOR form_source='smart_form':
-- - stake (units) - MUST NOT BE NULL
-- - user_id (capper) - MUST NOT BE NULL
-- - selection - MUST NOT BE NULL
-- - sport - MUST NOT BE NULL
-- - trace_id - MUST NOT BE NULL (for E2E observability)
-- ============================================================================

-- Add CHECK constraint for Smart Form required fields
-- This ensures no row with form_source='smart_form' can be inserted without
-- the minimum required fields
ALTER TABLE unified_picks
ADD CONSTRAINT chk_smart_form_required_fields CHECK (
  -- If form_source is 'smart_form', these fields MUST be populated
  form_source != 'smart_form' OR (
    stake IS NOT NULL AND
    user_id IS NOT NULL AND
    selection IS NOT NULL AND
    sport IS NOT NULL AND
    trace_id IS NOT NULL
  )
);

-- Add comment documenting the constraint
COMMENT ON CONSTRAINT chk_smart_form_required_fields ON unified_picks IS
  'Enforces Smart Form minimum required fields per SYSTEM_CONTRACT.md. Picks with form_source=smart_form must have: stake (units), user_id (capper), selection, sport, trace_id.';

-- ============================================================================
-- VERIFICATION QUERY (run manually to verify constraint is active)
-- ============================================================================
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'unified_picks'::regclass
--   AND conname = 'chk_smart_form_required_fields';
-- ============================================================================
