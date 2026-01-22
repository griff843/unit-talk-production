-- ============================================================================
-- Migration: PR10 Week 2 Anti-Cheat Enforcement
-- Date: 2026-01-21
-- Authority: SYSTEM_CONTRACT.md Section 5.3
-- ============================================================================
--
-- PURPOSE:
-- Add DB-level anti-cheat enforcement to ensure picks only come from
-- legitimate sources (Smart Form, API, ingestion) - not manual inserts.
--
-- APPROACH: Audit Trigger + Source Validation
-- - Every insert to unified_picks is logged to picks_audit_log
-- - form_source must be from known valid sources
-- - Captures pg role and timestamp for forensic analysis
--
-- WHY TRIGGER (not RLS):
-- RLS is bypassed by service_role key. Since Smart Form and API both use
-- service_role, RLS cannot differentiate legitimate vs manual inserts.
-- A trigger runs on ALL inserts regardless of role.
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Create audit log table for insert tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.picks_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    pick_id UUID NOT NULL,
    bet_slip_id TEXT,
    form_source TEXT,
    trace_id TEXT,
    pg_role TEXT NOT NULL DEFAULT current_role,
    pg_user TEXT NOT NULL DEFAULT current_user,
    client_ip INET,
    action TEXT NOT NULL DEFAULT 'INSERT'
);

-- Index for forensic queries
CREATE INDEX IF NOT EXISTS idx_picks_audit_log_created_at
    ON public.picks_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_picks_audit_log_form_source
    ON public.picks_audit_log(form_source);
CREATE INDEX IF NOT EXISTS idx_picks_audit_log_trace_id
    ON public.picks_audit_log(trace_id);

COMMENT ON TABLE public.picks_audit_log IS
    'Week 2 Anti-Cheat: Audit trail for all unified_picks inserts. '
    'Used to detect and investigate unauthorized direct inserts.';

-- ============================================================================
-- STEP 2: Define valid form_source values
-- ============================================================================
-- KNOWN VALID SOURCES (per SYSTEM_CONTRACT.md):
-- - smart_form: From Smart Form UI via /api/submit-ticket route
-- - api: From external API integrations
-- - ingestion: From data ingestion pipelines
-- - system: From internal system processes (grading, settlement)
-- - migration: From data migrations (legacy data import)

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_valid_form_source'
        AND conrelid = 'public.unified_picks'::regclass
    ) THEN
        ALTER TABLE public.unified_picks
        ADD CONSTRAINT chk_valid_form_source CHECK (
            form_source IS NULL OR
            form_source IN ('smart_form', 'api', 'ingestion', 'system', 'migration', 'test')
        );
        RAISE NOTICE 'Added chk_valid_form_source constraint';
    ELSE
        RAISE NOTICE 'chk_valid_form_source constraint already exists';
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Create audit trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_audit_picks_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.picks_audit_log (
        pick_id,
        bet_slip_id,
        form_source,
        trace_id,
        pg_role,
        pg_user,
        client_ip,
        action
    ) VALUES (
        NEW.id,
        NEW.bet_slip_id,
        NEW.form_source,
        NEW.trace_id,
        current_role,
        current_user,
        inet_client_addr(),
        'INSERT'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.fn_audit_picks_insert() IS
    'Week 2 Anti-Cheat: Logs every insert to unified_picks for audit trail.';

-- ============================================================================
-- STEP 4: Attach trigger to unified_picks
-- ============================================================================
DROP TRIGGER IF EXISTS trg_audit_picks_insert ON public.unified_picks;

CREATE TRIGGER trg_audit_picks_insert
    AFTER INSERT ON public.unified_picks
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_audit_picks_insert();

COMMENT ON TRIGGER trg_audit_picks_insert ON public.unified_picks IS
    'Week 2 Anti-Cheat: Captures all inserts for forensic analysis.';

-- ============================================================================
-- STEP 5: Add column comments
-- ============================================================================
COMMENT ON COLUMN public.picks_audit_log.pg_role IS 'PostgreSQL role that performed the insert';
COMMENT ON COLUMN public.picks_audit_log.pg_user IS 'PostgreSQL user that performed the insert';
COMMENT ON COLUMN public.picks_audit_log.client_ip IS 'Client IP address (if available)';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================================
--
-- 1. Verify audit table exists:
--    SELECT * FROM public.picks_audit_log LIMIT 5;
--
-- 2. Verify trigger exists:
--    SELECT tgname, tgenabled FROM pg_trigger
--    WHERE tgrelid = 'public.unified_picks'::regclass
--    AND tgname = 'trg_audit_picks_insert';
--
-- 3. Verify form_source constraint:
--    SELECT conname, pg_get_constraintdef(oid)
--    FROM pg_constraint
--    WHERE conrelid = 'public.unified_picks'::regclass
--    AND conname = 'chk_valid_form_source';
--
-- 4. Test invalid form_source (should FAIL):
--    INSERT INTO unified_picks (bet_slip_id, form_source, selection)
--    VALUES ('test-invalid', 'hacker_script', 'over');
--    -- Expected: ERROR - violates CHECK constraint
--
-- 5. Check audit log after legitimate insert:
--    SELECT * FROM picks_audit_log ORDER BY created_at DESC LIMIT 10;
-- ============================================================================
