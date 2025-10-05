-- Check unique constraints on raw_props
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.raw_props'::regclass
  AND contype IN ('u', 'p')
ORDER BY conname;
