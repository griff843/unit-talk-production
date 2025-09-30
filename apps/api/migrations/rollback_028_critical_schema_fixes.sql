-- ============================================================================
-- ROLLBACK SCRIPT FOR MIGRATION 028
-- File: rollback_028_critical_schema_fixes.sql
-- Date: September 29, 2025
-- Purpose: Safe rollback of critical schema fixes migration
-- CAUTION: This will remove Enhanced45Factor columns and professional grading data
-- ============================================================================

BEGIN;

-- ============================================================================
-- ROLLBACK PHASE 1: REMOVE TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Remove professional grading automation trigger
DROP TRIGGER IF EXISTS trg_professional_grading_metadata ON unified_picks;
DROP FUNCTION IF EXISTS set_professional_grading_metadata();

-- Remove player name extraction trigger and function
DROP TRIGGER IF EXISTS tr_extract_player_names ON sports_game_odds;
DROP FUNCTION IF EXISTS extract_player_names_from_json();

-- ============================================================================
-- ROLLBACK PHASE 2: REMOVE INDEXES
-- ============================================================================

-- Remove performance indexes added by migration 028
DROP INDEX IF EXISTS idx_sports_game_odds_player_name;
DROP INDEX IF EXISTS idx_unified_picks_professional_lookup;
DROP INDEX IF EXISTS idx_unified_picks_clv_tracking;
DROP INDEX IF EXISTS idx_unified_picks_recent_professional;
DROP INDEX IF EXISTS idx_unified_picks_processing_performance;
DROP INDEX IF EXISTS idx_unified_picks_user_analysis;
DROP INDEX IF EXISTS idx_unified_picks_clv_unique;

-- ============================================================================
-- ROLLBACK PHASE 3: REMOVE ENHANCED45FACTOR COLUMNS FROM UNIFIED_PICKS
-- ============================================================================

-- WARNING: This will remove all professional grading data
-- Save data to backup table before removing columns

-- Create backup table with professional grading data
CREATE TABLE IF NOT EXISTS unified_picks_professional_backup AS
SELECT
    id,
    professional_score,
    feature_contributions,
    kelly_fraction,
    devigged_edge,
    clv_tracking_id,
    processing_time,
    rule_compliance_score,
    sharp_grading_version,
    risk_assessment,
    professional_insights,
    NOW() as backup_created_at
FROM unified_picks
WHERE professional_score IS NOT NULL;

-- Remove Enhanced45Factor columns
ALTER TABLE unified_picks
DROP COLUMN IF EXISTS professional_score,
DROP COLUMN IF EXISTS feature_contributions,
DROP COLUMN IF EXISTS kelly_fraction,
DROP COLUMN IF EXISTS devigged_edge,
DROP COLUMN IF EXISTS clv_tracking_id,
DROP COLUMN IF EXISTS processing_time,
DROP COLUMN IF EXISTS rule_compliance_score,
DROP COLUMN IF EXISTS sharp_grading_version,
DROP COLUMN IF EXISTS risk_assessment,
DROP COLUMN IF EXISTS professional_insights;

-- ============================================================================
-- ROLLBACK PHASE 4: REMOVE PLAYER_NAME COLUMN FROM SPORTS_GAME_ODDS
-- ============================================================================

-- Create backup of player names if any exist
CREATE TABLE IF NOT EXISTS sports_game_odds_player_backup AS
SELECT
    id,
    game_id,
    player_name,
    NOW() as backup_created_at
FROM sports_game_odds
WHERE player_name IS NOT NULL;

-- Remove player_name column
ALTER TABLE sports_game_odds
DROP COLUMN IF EXISTS player_name;

-- ============================================================================
-- ROLLBACK PHASE 5: RESTORE ORIGINAL FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Remove the enhanced foreign key constraint
ALTER TABLE unified_picks
DROP CONSTRAINT IF EXISTS unified_picks_user_id_fkey;

-- Note: Cannot safely rollback users table UUID conversion without data loss
-- The UUID conversion should remain for system stability

-- ============================================================================
-- ROLLBACK VERIFICATION
-- ============================================================================

-- Verify columns were removed
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sports_game_odds' AND column_name = 'player_name'
    ) THEN
        RAISE EXCEPTION 'ROLLBACK FAILED: sports_game_odds.player_name column still exists';
    ELSE
        RAISE NOTICE 'SUCCESS: sports_game_odds.player_name column removed';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'unified_picks' AND column_name = 'professional_score'
    ) THEN
        RAISE EXCEPTION 'ROLLBACK FAILED: unified_picks.professional_score column still exists';
    ELSE
        RAISE NOTICE 'SUCCESS: Enhanced45Factor columns removed from unified_picks';
    END IF;
END $$;

-- Display rollback summary
SELECT
    '🔄 MIGRATION 028 ROLLBACK COMPLETED' as status,
    (SELECT COUNT(*) FROM unified_picks_professional_backup) as professional_data_backed_up,
    (SELECT COUNT(*) FROM sports_game_odds_player_backup) as player_names_backed_up,
    'Data preserved in backup tables' as note,
    NOW() as rollback_completed_at;

COMMIT;

-- ============================================================================
-- POST-ROLLBACK NOTES
-- ============================================================================

-- IMPORTANT NOTES:
-- 1. Professional grading data backed up to: unified_picks_professional_backup
-- 2. Player names backed up to: sports_game_odds_player_backup
-- 3. Users table UUID conversion NOT rolled back (for system stability)
-- 4. To restore Enhanced45Factor system, re-run migration 028
--
-- To restore data after re-running migration 028:
--
-- UPDATE unified_picks SET
--     professional_score = b.professional_score,
--     feature_contributions = b.feature_contributions,
--     kelly_fraction = b.kelly_fraction,
--     devigged_edge = b.devigged_edge,
--     clv_tracking_id = b.clv_tracking_id,
--     processing_time = b.processing_time,
--     rule_compliance_score = b.rule_compliance_score,
--     sharp_grading_version = b.sharp_grading_version,
--     risk_assessment = b.risk_assessment,
--     professional_insights = b.professional_insights
-- FROM unified_picks_professional_backup b
-- WHERE unified_picks.id = b.id;

RAISE NOTICE '🔄 ROLLBACK COMPLETED: Professional grading data preserved in backup tables';