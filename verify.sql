-- Verification Queries for Core Setup Migration

-- 1. Check scored_props table exists with all columns
SELECT 'scored_props columns' AS check_name, COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'scored_props';

-- 2. Check promotion_queue table exists with all columns
SELECT 'promotion_queue columns' AS check_name, COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'promotion_queue';

-- 3. Check v_daily_board view exists and returns rows
SELECT 'v_daily_board' AS check_name, COUNT(*) AS row_count
FROM public.v_daily_board
LIMIT 5;

-- 4. Check v_prop_read_model view exists and returns rows
SELECT 'v_prop_read_model' AS check_name, COUNT(*) AS row_count
FROM public.v_prop_read_model
LIMIT 5;

-- 5. Check v_open_promotions view exists and returns rows
SELECT 'v_open_promotions' AS check_name, COUNT(*) AS row_count
FROM public.v_open_promotions;

-- 6. Check submit_pick RPC exists
SELECT 'submit_pick RPC' AS check_name, COUNT(*) AS exists
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'submit_pick';

-- 7. Check approve_pick RPC exists
SELECT 'approve_pick RPC' AS check_name, COUNT(*) AS exists
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'approve_pick';

-- 8. Check deny_pick RPC exists
SELECT 'deny_pick RPC' AS check_name, COUNT(*) AS exists
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'deny_pick';
