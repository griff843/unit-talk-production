-- ============================================================================
-- SPRINT-UNIFIED-PICKS-CONTRACT-TRUTH-LOCK: Fix workflow_stage constraint
-- Date: 2026-03-19
-- Purpose: DEFECT-8 — chk_unified_picks_workflow_stage only allows
--   'pending_review' and 'approved'. The lifecycle engine writes
--   'submitted', 'posted', 'settled', 'rejected', 'blocked', 'failed', and
--   'cancelled' — all of which are blocked by the current constraint.
--
-- Fix: Drop the 2-value constraint and replace with the full lifecycle set.
--
-- Safety: Uses IF EXISTS on DROP so this migration is safe to re-run.
--   Existing rows are all compliant — they hold 'pending_review' or 'approved',
--   both of which remain in the expanded set.
--
-- Rollback:
--   ALTER TABLE unified_picks DROP CONSTRAINT IF EXISTS chk_unified_picks_workflow_stage;
--   ALTER TABLE unified_picks ADD CONSTRAINT chk_unified_picks_workflow_stage
--     CHECK (workflow_stage IN ('pending_review', 'approved'));
-- ============================================================================

ALTER TABLE unified_picks
  DROP CONSTRAINT IF EXISTS chk_unified_picks_workflow_stage;

ALTER TABLE unified_picks
  ADD CONSTRAINT chk_unified_picks_workflow_stage
  CHECK (workflow_stage IN (
    'submitted',
    'pending_review',
    'approved',
    'posted',
    'settled',
    'rejected',
    'blocked',
    'failed',
    'cancelled'
  ));

COMMENT ON CONSTRAINT chk_unified_picks_workflow_stage ON unified_picks IS
  'SPRINT-UNIFIED-PICKS-CONTRACT-TRUTH-LOCK: Full lifecycle set — submitted, pending_review, approved, posted, settled, rejected, blocked, failed, cancelled.';
