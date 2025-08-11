-- ========================================
-- EMERGENCY ROLLBACK SCRIPT
-- Use ONLY if migration causes issues
-- ========================================
-- 
-- WARNING: This will restore the original state
-- Performance will return to slow queries
-- 
-- INSTRUCTIONS:
-- 1. Only use if migration caused problems
-- 2. Copy to Supabase SQL Editor
-- 3. Run to restore original state
-- ========================================

-- Step 1: Move data back from historical to main table
-- WARNING: This will slow down queries again
INSERT INTO raw_props (
    SELECT * FROM raw_props_historical
    WHERE NOT EXISTS (
        SELECT 1 FROM raw_props rp 
        WHERE rp.id = raw_props_historical.id
    )
);

-- Step 2: Verify data restoration
SELECT 
    'ROLLBACK VERIFICATION' as status,
    '=====================' as separator;

SELECT 
    COUNT(*) as total_props_restored,
    'Records back in raw_props' as description
FROM raw_props;

-- Step 3: Optional - Remove historical tables (CAREFUL!)
-- Uncomment these lines only if you want to completely remove the lifecycle system
-- DROP TABLE IF EXISTS raw_props_historical;
-- DROP TABLE IF EXISTS raw_props_recent;

-- Step 4: Confirmation
SELECT 
    '⚠️ ROLLBACK COMPLETED' as status,
    'System restored to original state' as result,
    'Query performance will be slow again' as warning,
    'Consider re-running migration when ready' as recommendation;