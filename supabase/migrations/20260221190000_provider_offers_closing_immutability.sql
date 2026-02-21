-- ============================================================================
-- PROVIDER OFFERS CLOSING LINE IMMUTABILITY TRIGGER
-- Sprint: SPRINT-CLOSING-LINE-IMMUTABILITY-096
-- Date: 2026-02-21
--
-- Enforces immutability of provider_offers rows where is_closing = TRUE.
-- These rows represent the canonical "closing truth" for CLV analysis.
--
-- RULES:
-- 1. Once is_closing = TRUE, the row cannot be UPDATED
-- 2. Once is_closing = TRUE, the row cannot be DELETED
-- 3. is_closing cannot be toggled from TRUE to FALSE
-- ============================================================================

-- ============================================================================
-- 1. IMMUTABILITY TRIGGER FUNCTION
-- Blocks UPDATE/DELETE operations on closing offer rows
-- ============================================================================

CREATE OR REPLACE FUNCTION guard_provider_offers_closing_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle DELETE: block if is_closing = TRUE
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_closing = TRUE THEN
      RAISE EXCEPTION 'IMMUTABILITY_VIOLATION: Cannot DELETE provider_offers row with is_closing=TRUE (id=%)', OLD.id
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;

  -- Handle UPDATE: block if OLD.is_closing = TRUE
  IF TG_OP = 'UPDATE' THEN
    -- Block any update to a closing row
    IF OLD.is_closing = TRUE THEN
      RAISE EXCEPTION 'IMMUTABILITY_VIOLATION: Cannot UPDATE provider_offers row with is_closing=TRUE (id=%)', OLD.id
        USING ERRCODE = 'restrict_violation';
    END IF;

    -- Block toggling is_closing from FALSE to TRUE on update
    -- (closing flag should only be set at INSERT time, not via UPDATE)
    IF OLD.is_closing = FALSE AND NEW.is_closing = TRUE THEN
      RAISE EXCEPTION 'IMMUTABILITY_VIOLATION: Cannot toggle is_closing from FALSE to TRUE via UPDATE (id=%). Set is_closing=TRUE at INSERT time only.', OLD.id
        USING ERRCODE = 'restrict_violation';
    END IF;

    RETURN NEW;
  END IF;

  -- Should never reach here
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION guard_provider_offers_closing_immutability IS
  'Enforces immutability of provider_offers rows where is_closing=TRUE. Sprint: SPRINT-CLOSING-LINE-IMMUTABILITY-096';

-- ============================================================================
-- 2. APPLY TRIGGER TO provider_offers TABLE
-- BEFORE trigger ensures violation is caught before operation proceeds
-- ============================================================================

-- Drop if exists (idempotent)
DROP TRIGGER IF EXISTS trigger_guard_provider_offers_closing_immutability ON provider_offers;

CREATE TRIGGER trigger_guard_provider_offers_closing_immutability
  BEFORE UPDATE OR DELETE ON provider_offers
  FOR EACH ROW
  EXECUTE FUNCTION guard_provider_offers_closing_immutability();

COMMENT ON TRIGGER trigger_guard_provider_offers_closing_immutability ON provider_offers IS
  'Prevents modification or deletion of closing line offers. Sprint: SPRINT-CLOSING-LINE-IMMUTABILITY-096';

-- ============================================================================
-- END OF MIGRATION
-- Sprint: SPRINT-CLOSING-LINE-IMMUTABILITY-096
--
-- ENFORCEMENT:
-- - UPDATE on is_closing=TRUE row: BLOCKED
-- - DELETE on is_closing=TRUE row: BLOCKED
-- - Toggle is_closing FALSE->TRUE via UPDATE: BLOCKED (must be set at INSERT)
--
-- ALLOWED:
-- - INSERT with is_closing=TRUE: ALLOWED (setting closing at insert time)
-- - UPDATE on is_closing=FALSE row: ALLOWED
-- - DELETE on is_closing=FALSE row: ALLOWED
-- ============================================================================
