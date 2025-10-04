-- Check unified_picks columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'unified_picks'
ORDER BY ordinal_position;

-- Check if scored_props exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'scored_props'
ORDER BY ordinal_position;

-- Check if promotion_queue exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'promotion_queue'
ORDER BY ordinal_position;

-- Check existing views
SELECT viewname FROM pg_views
WHERE schemaname = 'public' AND viewname LIKE 'v_%';

-- Check existing RPCs
SELECT proname, pronargs FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND proname IN ('approve_pick', 'deny_pick', 'submit_pick');
