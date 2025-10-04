-- Check if promotion_fingerprint is auto-generated
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'unified_picks'
  AND column_name = 'promotion_fingerprint';

-- Check if there's a trigger or generated column
SELECT
  pg_get_triggerdef(oid) as trigger_def
FROM pg_trigger
WHERE tgrelid = 'unified_picks'::regclass;

-- Show the table definition
\d unified_picks;
