-- ========================================
-- BATCH MIGRATION - 10,000 RECORDS
-- Run this multiple times to migrate in safe batches
-- ========================================
-- 
-- INSTRUCTIONS:
-- 1. Run BATCHED-MIGRATION.sql first (creates tables)
-- 2. Run this script repeatedly until no more records
-- 3. Each run migrates 10,000 old records safely
-- 4. Monitor progress with the verification queries
-- ========================================

-- BATCH MIGRATION: Move 10,000 oldest records
WITH old_records AS (
    SELECT id
    FROM raw_props 
    WHERE game_date < CURRENT_DATE - INTERVAL '1 day'
    ORDER BY game_date ASC, id ASC
    LIMIT 10000
),
migrated_data AS (
    INSERT INTO raw_props_historical 
    SELECT rp.* 
    FROM raw_props rp
    INNER JOIN old_records o ON rp.id = o.id
    ON CONFLICT (id) DO NOTHING
    RETURNING id
)
DELETE FROM raw_props 
WHERE id IN (SELECT id FROM migrated_data);

-- Progress check after this batch
SELECT 
    'BATCH MIGRATION PROGRESS' as status,
    '========================' as separator;

SELECT 
    COUNT(*) as remaining_total_props,
    COUNT(*) FILTER (WHERE game_date < CURRENT_DATE - INTERVAL '1 day') as remaining_old_props,
    COUNT(*) FILTER (WHERE game_date >= CURRENT_DATE - INTERVAL '1 day') as current_props
FROM raw_props;

SELECT 
    COUNT(*) as historical_props_count
FROM raw_props_historical;

-- Show if more batches needed
SELECT 
    CASE 
        WHEN COUNT(*) FILTER (WHERE game_date < CURRENT_DATE - INTERVAL '1 day') > 0 
        THEN '🔄 RUN THIS SCRIPT AGAIN - More batches needed'
        ELSE '✅ MIGRATION COMPLETE - All old data archived'
    END as next_action,
    COUNT(*) FILTER (WHERE game_date < CURRENT_DATE - INTERVAL '1 day') as remaining_old_records
FROM raw_props;