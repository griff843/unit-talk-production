-- ============================================================================
-- UTRP-R1: Fix DEFECT-13 — confidence range CHECK constraint
-- Date: 2026-03-19
-- Purpose: Add CHECK constraint to unified_picks.confidence for valid range.
--          Confidence is an INTEGER on 0-100 scale (percentage).
--          NULL is valid (unknown confidence, per DEFECT-10 fix).
--
-- Context: Other tables (scored_legs, player_projections, prop_settlements)
--          already have confidence CHECK constraints. unified_picks was missing
--          one, allowing arbitrary values like -100 or 999.
--
-- Rollback:
--   ALTER TABLE unified_picks DROP CONSTRAINT IF EXISTS chk_confidence_range;
-- ============================================================================

ALTER TABLE unified_picks
  ADD CONSTRAINT chk_confidence_range
  CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100));
