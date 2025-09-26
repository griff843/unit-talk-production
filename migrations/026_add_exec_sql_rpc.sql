-- 026_add_exec_sql_rpc.sql
-- Utility RPC to execute read-only SQL for inventory tooling (DEV/OPS)
-- NOTE: This function is intended for non-production-sensitive environments.

CREATE OR REPLACE FUNCTION public.exec_sql(p_sql TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Very limited safeguard: block write keywords
  IF p_sql ~* '\b(insert|update|delete|alter|drop|truncate|grant|revoke)\b' THEN
    RAISE EXCEPTION 'exec_sql only allows read-only statements';
  END IF;

  EXECUTE format('SELECT coalesce(json_agg(t), ''[]''::json) FROM (%s) t', p_sql) INTO result;
  RETURN jsonb_build_object('rows', COALESCE(result, '[]'::jsonb));
END;
$$;

DO $$
BEGIN
  BEGIN
    GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO anon;
    GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO service_role;
  EXCEPTION WHEN undefined_object THEN NULL; END;
END $$;

