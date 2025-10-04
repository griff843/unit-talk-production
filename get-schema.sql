-- Get unified_picks schema
SELECT 'unified_picks' as table_name, column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'unified_picks'
ORDER BY ordinal_position;

-- Get raw_props schema
SELECT 'raw_props' as table_name, column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'raw_props'
ORDER BY ordinal_position;

-- Get games schema
SELECT 'games' as table_name, column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'games'
ORDER BY ordinal_position;
