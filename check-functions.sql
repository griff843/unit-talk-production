-- Find all versions of these functions with their exact signatures
SELECT 
  p.proname,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_args,
  'DROP FUNCTION IF EXISTS public.' || p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ');' as drop_statement
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('submit_pick', 'approve_pick', 'deny_pick')
ORDER BY p.proname;
