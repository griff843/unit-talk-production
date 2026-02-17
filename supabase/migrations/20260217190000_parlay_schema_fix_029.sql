-- PARLAY-SCHEMA-FIX-029
-- Fix unified_picks unique constraint to allow parlay multi-leg inserts
--
-- Problem: idx_unified_picks_bet_slip_id_unique prevents multiple legs per bet_slip_id
-- Solution: Replace with composite unique on (bet_slip_id, leg_index)
--
-- Date: 2026-02-17
-- Sprint: PARLAY-SCHEMA-FIX-029

-- Step 1: Ensure leg_index has a default value for existing rows
-- (leg_index column already exists, just ensure no NULLs)
UPDATE unified_picks
SET leg_index = 0
WHERE leg_index IS NULL;

-- Step 2: Make leg_index NOT NULL with default
ALTER TABLE unified_picks
ALTER COLUMN leg_index SET DEFAULT 0;

ALTER TABLE unified_picks
ALTER COLUMN leg_index SET NOT NULL;

-- Step 3: Drop the blocking unique index
DROP INDEX IF EXISTS idx_unified_picks_bet_slip_id_unique;

-- Step 4: Create composite unique index allowing multiple legs per bet_slip
-- This ensures uniqueness of (bet_slip_id, leg_index) pairs
CREATE UNIQUE INDEX idx_unified_picks_bet_slip_leg_unique
ON unified_picks (bet_slip_id, leg_index)
WHERE bet_slip_id IS NOT NULL;

-- Step 5: Keep a non-unique index on bet_slip_id for query performance
CREATE INDEX IF NOT EXISTS idx_unified_picks_bet_slip_id
ON unified_picks (bet_slip_id)
WHERE bet_slip_id IS NOT NULL;

-- Verification comment
COMMENT ON INDEX idx_unified_picks_bet_slip_leg_unique IS
'PARLAY-SCHEMA-FIX-029: Composite unique allows multiple legs per bet_slip_id';
