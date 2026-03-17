-- ============================================================================
-- SPRINT-069-SETTLEMENT-RPC-REPAIR: Create 7 missing DB objects for
-- manual_settle_pick() RPC
-- Date: 2026-03-17
-- Purpose: The manual_settle_pick() and correct_settlement() RPCs defined in
--   20260215100000_settlement_guard_seal_patch.sql reference DB objects that
--   were never created. This migration creates all 7 missing objects.
--
-- Missing objects addressed:
--   1. generate_settlement_hash()  — function called by RPC
--   2. settlement_audit_log        — table written by RPC
--   3. settlement_version column   — unified_picks column
--   4. settlement_hash column      — unified_picks column
--   5. settlement_frozen column    — unified_picks column (DEFECT-10)
--   6. freeze_enforced_at column   — unified_picks column
--   7. prevent_direct_settlement_update trigger — trigger attachment (DEFECT-12)
--
-- Rollback:
--   DROP TRIGGER IF EXISTS prevent_settlement_update ON unified_picks;
--   DROP FUNCTION IF EXISTS prevent_direct_settlement_update() CASCADE;
--   DROP FUNCTION IF EXISTS generate_settlement_hash(UUID, TEXT, DECIMAL, TIMESTAMPTZ) CASCADE;
--   DROP TABLE IF EXISTS settlement_audit_log;
--   ALTER TABLE unified_picks DROP COLUMN IF EXISTS settlement_frozen;
--   ALTER TABLE unified_picks DROP COLUMN IF EXISTS freeze_enforced_at;
--   ALTER TABLE unified_picks DROP COLUMN IF EXISTS settlement_hash;
--   ALTER TABLE unified_picks DROP COLUMN IF EXISTS settlement_version;
-- ============================================================================

-- ========================================================================
-- 1. Add missing columns to unified_picks
-- ========================================================================

-- settlement_version: tracks how many times a pick has been settled/corrected
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS settlement_version INTEGER DEFAULT 0;

-- settlement_hash: deterministic hash of settlement inputs for idempotency
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS settlement_hash TEXT;

-- settlement_frozen: whether settlement corrections are freeze-locked
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS settlement_frozen BOOLEAN DEFAULT FALSE;

-- freeze_enforced_at: when the freeze lock was applied
ALTER TABLE unified_picks ADD COLUMN IF NOT EXISTS freeze_enforced_at TIMESTAMPTZ;

-- ========================================================================
-- 2. Create generate_settlement_hash() function
-- ========================================================================

CREATE OR REPLACE FUNCTION generate_settlement_hash(
  p_pick_id UUID,
  p_result TEXT,
  p_actual_value DECIMAL,
  p_settled_at TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Deterministic hash of settlement inputs.
  -- Same inputs always produce the same hash — enables idempotency checks.
  -- Uses md5 for simplicity (non-security use).
  RETURN md5(
    p_pick_id::TEXT ||
    '|' || COALESCE(p_result, '') ||
    '|' || COALESCE(p_actual_value::TEXT, '') ||
    '|' || COALESCE(p_settled_at::TEXT, '')
  );
END;
$$;

COMMENT ON FUNCTION generate_settlement_hash(UUID, TEXT, DECIMAL, TIMESTAMPTZ) IS
  'SPRINT-069: Deterministic hash of settlement inputs for idempotency checks. '
  'Used by manual_settle_pick() and correct_settlement() RPCs.';

-- ========================================================================
-- 3. Create settlement_audit_log table
-- ========================================================================

CREATE TABLE IF NOT EXISTS settlement_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Pick reference
  pick_id UUID NOT NULL REFERENCES unified_picks(id) ON DELETE RESTRICT,

  -- Settlement reference (optional — first settlement creates the prop_settlement row)
  prop_settlement_id UUID REFERENCES prop_settlements(id) ON DELETE SET NULL,

  -- Snapshot of settlement state before and after
  prev_settlement JSONB,
  new_settlement JSONB NOT NULL,

  -- Hash-based versioning
  prev_hash TEXT,
  new_hash TEXT NOT NULL,

  -- Audit metadata
  action_type TEXT NOT NULL CHECK (action_type IN ('initial', 'correction', 'void', 'admin_correction')),
  changed_by TEXT NOT NULL DEFAULT 'operator',
  reason TEXT,

  -- Idempotency key — prevents duplicate audit entries
  idempotency_key TEXT UNIQUE NOT NULL,

  -- Tracing
  trace_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_settlement_audit_log_pick_id ON settlement_audit_log(pick_id);
CREATE INDEX IF NOT EXISTS idx_settlement_audit_log_created_at ON settlement_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_settlement_audit_log_action_type ON settlement_audit_log(action_type);

COMMENT ON TABLE settlement_audit_log IS
  'SPRINT-069: Immutable audit trail for all settlement actions. '
  'Written by manual_settle_pick() and correct_settlement() RPCs.';

-- ========================================================================
-- 4. Create prevent_direct_settlement_update() trigger function
--    (replaces stub if exists, ensures it's up to date)
-- ========================================================================

CREATE OR REPLACE FUNCTION prevent_direct_settlement_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Allow if being called from within manual_settle_pick or correct_settlement RPC
  IF current_setting('settlement.rpc_context', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Check if ANY settlement lifecycle field is being modified
  IF OLD.settlement_version IS DISTINCT FROM NEW.settlement_version
     OR OLD.settlement_result IS DISTINCT FROM NEW.settlement_result
     OR OLD.settled_at IS DISTINCT FROM NEW.settled_at
     OR OLD.settlement_hash IS DISTINCT FROM NEW.settlement_hash
     OR OLD.settlement_status IS DISTINCT FROM NEW.settlement_status
     OR OLD.actual_outcome IS DISTINCT FROM NEW.actual_outcome
     OR OLD.settlement_frozen IS DISTINCT FROM NEW.settlement_frozen
     OR OLD.freeze_enforced_at IS DISTINCT FROM NEW.freeze_enforced_at
  THEN
    RAISE EXCEPTION
      'SETTLEMENT-GUARD: Direct modification of settlement fields is prohibited. '
      'Use manual_settle_pick() or correct_settlement() RPC. '
      'Protected fields: settlement_version, settlement_result, settled_at, '
      'settlement_hash, settlement_status, actual_outcome, settlement_frozen, freeze_enforced_at';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION prevent_direct_settlement_update() IS
  'SPRINT-069 (DEFECT-12): Settlement guard trigger. Blocks direct UPDATE of '
  'settlement lifecycle fields. Allows updates from RPC context only.';

-- ========================================================================
-- 5. Attach prevent_direct_settlement_update trigger to unified_picks
--    (DEFECT-12: trigger was never attached)
-- ========================================================================

-- Drop if exists (idempotent)
DROP TRIGGER IF EXISTS prevent_settlement_update ON unified_picks;

CREATE TRIGGER prevent_settlement_update
  BEFORE UPDATE ON unified_picks
  FOR EACH ROW
  EXECUTE FUNCTION prevent_direct_settlement_update();

COMMENT ON TRIGGER prevent_settlement_update ON unified_picks IS
  'SPRINT-069 (DEFECT-12): Enforces settlement immutability. '
  'Prevents direct UPDATE of settlement fields outside of approved RPCs.';

-- ========================================================================
-- 6. Create settlement_freeze_config table (required by correct_settlement())
--    Only create if it does not exist — may be pre-existing in remote DB
-- ========================================================================

CREATE TABLE IF NOT EXISTS settlement_freeze_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Sport-specific config (NULL = default for all sports)
  sport TEXT,

  -- Hours after settlement when corrections are frozen
  freeze_window_hours INTEGER NOT NULL DEFAULT 48,

  -- Whether admin override is allowed after freeze window
  admin_override_allowed BOOLEAN NOT NULL DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Only one row per sport (or one default)
  CONSTRAINT settlement_freeze_config_sport_unique UNIQUE (sport)
);

-- Insert default config if none exists
INSERT INTO settlement_freeze_config (sport, freeze_window_hours, admin_override_allowed)
VALUES (NULL, 48, TRUE)
ON CONFLICT (sport) DO NOTHING;

COMMENT ON TABLE settlement_freeze_config IS
  'SPRINT-069: Configuration for settlement freeze windows. '
  'Controls how long after settlement corrections can be made. '
  'NULL sport row = default for all sports.';

-- ========================================================================
-- Complete
-- ========================================================================

COMMENT ON SCHEMA public IS
  'SPRINT-069-SETTLEMENT-RPC-REPAIR applied: 7 missing DB objects created for '
  'manual_settle_pick() and correct_settlement() RPCs.';
