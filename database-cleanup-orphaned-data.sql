-- =============================================================================
-- DATABASE CLEANUP - ORPHANED DATA REMOVAL
-- Clean up data integrity issues before adding foreign key constraints
-- =============================================================================

-- Step 1: Analyze orphaned data before cleanup
-- =============================================================================

-- Check orphaned props (props referencing non-existent games)
SELECT 
  'ORPHANED PROPS ANALYSIS' as analysis_type,
  COUNT(*) as total_props,
  COUNT(CASE WHEN game_id IS NOT NULL THEN 1 END) as props_with_game_id,
  COUNT(CASE WHEN game_id IS NOT NULL AND game_id NOT IN (SELECT id FROM games) THEN 1 END) as orphaned_props,
  ROUND(COUNT(CASE WHEN game_id IS NOT NULL AND game_id NOT IN (SELECT id FROM games) THEN 1 END) * 100.0 / COUNT(*), 2) as orphaned_percentage
FROM raw_props;

-- Check orphaned picks (picks referencing non-existent users or props)
SELECT 
  'ORPHANED PICKS ANALYSIS' as analysis_type,
  COUNT(*) as total_picks,
  COUNT(CASE WHEN user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users) THEN 1 END) as picks_orphaned_users,
  COUNT(CASE WHEN prop_id IS NOT NULL AND prop_id NOT IN (SELECT id FROM raw_props) THEN 1 END) as picks_orphaned_props,
  ROUND(COUNT(CASE WHEN user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users) THEN 1 END) * 100.0 / COUNT(*), 2) as user_orphan_percentage
FROM unified_picks;

-- Show sample orphaned data for review
SELECT 
  'SAMPLE ORPHANED PROPS' as sample_type,
  rp.id,
  rp.game_id,
  rp.player_name,
  rp.stat_type,
  rp.game_date,
  'Game ID not found in games table' as issue
FROM raw_props rp
WHERE rp.game_id IS NOT NULL 
  AND rp.game_id NOT IN (SELECT id FROM games)
LIMIT 10;

-- Step 2: Create backup tables for safety
-- =============================================================================

-- Backup orphaned props before deletion
CREATE TABLE IF NOT EXISTS orphaned_props_backup AS
SELECT 
  *,
  NOW() as backup_created_at,
  'Orphaned game_id reference' as backup_reason
FROM raw_props 
WHERE game_id IS NOT NULL 
  AND game_id NOT IN (SELECT id FROM games);

-- Backup orphaned picks before deletion
CREATE TABLE IF NOT EXISTS orphaned_picks_backup AS
SELECT 
  *,
  NOW() as backup_created_at,
  CASE 
    WHEN user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users) THEN 'Orphaned user_id reference'
    WHEN prop_id IS NOT NULL AND prop_id NOT IN (SELECT id FROM raw_props) THEN 'Orphaned prop_id reference'
    ELSE 'Other orphan issue'
  END as backup_reason
FROM unified_picks 
WHERE (user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users))
   OR (prop_id IS NOT NULL AND prop_id NOT IN (SELECT id FROM raw_props));

-- Step 3: Clean up orphaned data
-- =============================================================================

-- Option A: Set orphaned references to NULL (preserves records)
-- This is the safer approach - keeps the data but removes invalid references

-- Clean orphaned game_id references in raw_props
UPDATE raw_props 
SET game_id = NULL 
WHERE game_id IS NOT NULL 
  AND game_id NOT IN (SELECT id FROM games);

-- Clean orphaned user_id references in unified_picks
UPDATE unified_picks 
SET user_id = NULL 
WHERE user_id IS NOT NULL 
  AND user_id NOT IN (SELECT id FROM users);

-- Clean orphaned prop_id references in unified_picks
UPDATE unified_picks 
SET prop_id = NULL 
WHERE prop_id IS NOT NULL 
  AND prop_id NOT IN (SELECT id FROM raw_props);

-- Step 4: Alternative cleanup (commented out) - DELETE orphaned records
-- =============================================================================
-- Uncomment these if you prefer to delete orphaned records entirely

-- Delete props with orphaned game references
-- DELETE FROM raw_props 
-- WHERE game_id IS NOT NULL 
--   AND game_id NOT IN (SELECT id FROM games);

-- Delete picks with orphaned user references
-- DELETE FROM unified_picks 
-- WHERE user_id IS NOT NULL 
--   AND user_id NOT IN (SELECT id FROM users);

-- Delete picks with orphaned prop references
-- DELETE FROM unified_picks 
-- WHERE prop_id IS NOT NULL 
--   AND prop_id NOT IN (SELECT id FROM raw_props);

-- Step 5: Verify cleanup
-- =============================================================================

-- Verify orphaned data is cleaned up
SELECT 
  'POST-CLEANUP VERIFICATION' as verification_type,
  (SELECT COUNT(*) FROM raw_props WHERE game_id IS NOT NULL AND game_id NOT IN (SELECT id FROM games)) as remaining_orphaned_props,
  (SELECT COUNT(*) FROM unified_picks WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users)) as remaining_orphaned_picks_users,
  (SELECT COUNT(*) FROM unified_picks WHERE prop_id IS NOT NULL AND prop_id NOT IN (SELECT id FROM raw_props)) as remaining_orphaned_picks_props,
  'Should all be 0 after cleanup' as expected_result;

-- Show backup table record counts
SELECT 
  'BACKUP TABLES CREATED' as backup_info,
  (SELECT COUNT(*) FROM orphaned_props_backup) as backed_up_props,
  (SELECT COUNT(*) FROM orphaned_picks_backup) as backed_up_picks,
  'Data safely backed up before cleanup' as safety_note;

-- Step 6: Update statistics after cleanup
-- =============================================================================

-- Update table statistics for query planner
ANALYZE raw_props;
ANALYZE unified_picks;
ANALYZE games;
ANALYZE users;

-- Step 7: Ready for foreign key constraints
-- =============================================================================

SELECT 
  'DATA CLEANUP COMPLETE' as status,
  'Orphaned references cleaned up' as cleanup_result,
  'Data backed up in orphaned_*_backup tables' as safety_measure,
  'Ready to add foreign key constraints' as next_step,
  'Run database-relationship-fixes.sql again' as instruction;

-- Final integrity check
SELECT 
  'FINAL INTEGRITY CHECK' as check_type,
  CASE WHEN (SELECT COUNT(*) FROM raw_props WHERE game_id IS NOT NULL AND game_id NOT IN (SELECT id FROM games)) = 0 
       THEN 'CLEAN' ELSE 'ISSUES REMAIN' END as props_to_games,
  CASE WHEN (SELECT COUNT(*) FROM unified_picks WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users)) = 0 
       THEN 'CLEAN' ELSE 'ISSUES REMAIN' END as picks_to_users,
  CASE WHEN (SELECT COUNT(*) FROM unified_picks WHERE prop_id IS NOT NULL AND prop_id NOT IN (SELECT id FROM raw_props)) = 0 
       THEN 'CLEAN' ELSE 'ISSUES REMAIN' END as picks_to_props,
  'All should show CLEAN' as expected;
