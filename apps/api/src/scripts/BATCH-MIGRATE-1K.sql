-- ========================================
-- CONSERVATIVE BATCH MIGRATION - 1,000 RECORDS
-- Use this if 10K batches are still too large
-- ========================================
-- 
-- INSTRUCTIONS:
-- 1. Use this if BATCH-MIGRATE-10K.sql times out
-- 2. Much safer for slower connections
-- 3. Run repeatedly until complete
-- 4. Will take more iterations but very reliable
-- ========================================

-- CONSERVATIVE BATCH: Move 1,000 oldest records
WITH old_records AS (
    SELECT id
    FROM raw_props 
    WHERE game_date < CURRENT_DATE - INTERVAL '1 day'
    ORDER BY game_date ASC, id ASC
    LIMIT 1000
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

-- Progress check
SELECT 
    'CONSERVATIVE BATCH PROGRESS' as status,
    '===========================' as separator;

SELECT 
    COUNT(*) as remaining_props,
    COUNT(*) FILTER (WHERE game_date < CURRENT_DATE - INTERVAL '1 day') as old_props_remaining,
    ROUND(
        (COUNT(*) FILTER (WHERE game_date >= CURRENT_DATE - INTERVAL '1 day'))::numeric * 100.0 / COUNT(*)::numeric, 
        1
    ) as percent_optimized
FROM raw_props;

SELECT 
    COUNT(*) as migrated_to_historical
FROM raw_props_historical;

-- Completion status
SELECT 
    CASE 
        WHEN COUNT(*) FILTER (WHERE game_date < CURRENT_DATE - INTERVAL '1 day') > 0 
        THEN CONCAT('🔄 ', COUNT(*) FILTER (WHERE game_date < CURRENT_DATE - INTERVAL '1 day'), ' records remaining - Run again')
        ELSE '🎉 MIGRATION COMPLETE!'
    END as status
FROM raw_props;