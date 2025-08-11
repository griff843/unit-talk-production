-- Check all columns in MLB history table
SELECT 
  'mlb_history columns:' as table_info,
  column_name,
  data_type,
  ordinal_position
FROM information_schema.columns 
WHERE table_name = 'mlb_history' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Sample data to see actual structure
SELECT 'mlb_history sample data:' as info, * FROM mlb_history LIMIT 1;
