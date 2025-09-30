-- Helper functions for database contract testing
-- These functions provide safe, read-only access to schema information

-- Get table columns information
CREATE OR REPLACE FUNCTION public.get_table_columns(
  table_name TEXT DEFAULT NULL,
  schema_name TEXT DEFAULT 'public'
)
RETURNS TABLE(
  column_name TEXT,
  data_type TEXT,
  is_nullable TEXT,
  column_default TEXT
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    c.column_name::TEXT,
    c.data_type::TEXT,
    c.is_nullable::TEXT,
    c.column_default::TEXT
  FROM information_schema.columns c
  WHERE c.table_schema = schema_name
    AND (table_name IS NULL OR c.table_name = table_name)
  ORDER BY c.ordinal_position;
$$;

-- Get table indexes information
CREATE OR REPLACE FUNCTION public.get_table_indexes(
  table_name TEXT
)
RETURNS TABLE(
  indexname TEXT,
  indexdef TEXT
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    i.indexname::TEXT,
    i.indexdef::TEXT
  FROM pg_indexes i
  WHERE i.schemaname = 'public'
    AND i.tablename = table_name
  ORDER BY i.indexname;
$$;

-- Get table constraints information
CREATE OR REPLACE FUNCTION public.get_table_constraints(
  table_name TEXT
)
RETURNS TABLE(
  constraint_name TEXT,
  constraint_type TEXT,
  column_name TEXT
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT DISTINCT
    tc.constraint_name::TEXT,
    tc.constraint_type::TEXT,
    kcu.column_name::TEXT
  FROM information_schema.table_constraints tc
  LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_schema = 'public'
    AND tc.table_name = table_name
  ORDER BY tc.constraint_name;
$$;

-- Check if materialized view exists
CREATE OR REPLACE FUNCTION public.check_materialized_view_exists(
  view_name TEXT
)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT EXISTS(
    SELECT 1 FROM pg_class c 
    JOIN pg_namespace n ON n.oid = c.relnamespace 
    WHERE n.nspname = 'public' 
      AND c.relname = view_name 
      AND c.relkind = 'm'
  );
$$;

-- Find duplicate props (data quality check)
CREATE OR REPLACE FUNCTION public.find_duplicate_props()
RETURNS TABLE(
  external_prop_id TEXT,
  source TEXT,
  count_duplicates BIGINT
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    up.external_prop_id::TEXT,
    up.source::TEXT,
    COUNT(*) as count_duplicates
  FROM unified_picks up
  GROUP BY up.external_prop_id, up.source
  HAVING COUNT(*) > 1
  ORDER BY count_duplicates DESC;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_table_columns TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_indexes TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_constraints TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_materialized_view_exists TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_duplicate_props TO authenticated;
