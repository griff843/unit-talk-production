-- Check which scoring-related columns exist in unified_picks
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'unified_picks'
  AND (
    column_name LIKE '%score%'
    OR column_name LIKE '%confidence%'
    OR column_name LIKE '%grade%'
    OR column_name LIKE '%tier%'
  )
ORDER BY column_name;
