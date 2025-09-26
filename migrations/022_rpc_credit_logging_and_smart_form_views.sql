-- 022_rpc_credit_logging_and_smart_form_views.sql
-- Purpose: Enable Supabase RPC credit logging and create Smart Form views
-- Safe/idempotent migration: uses IF NOT EXISTS and CREATE OR REPLACE where possible

-- 1) Ensure ops schema and credit_usage table exist
CREATE SCHEMA IF NOT EXISTS ops;

CREATE TABLE IF NOT EXISTS ops.credit_usage (
  id            BIGSERIAL PRIMARY KEY,
  provider      TEXT NOT NULL,
  credits       INTEGER NOT NULL DEFAULT 1,
  ts            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bucket_hour   TIMESTAMPTZ NOT NULL DEFAULT date_trunc('hour', NOW())
);

-- Helpful index for aggregations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'ops' AND c.relname = 'idx_credit_usage_bucket_provider'
  ) THEN
    CREATE INDEX idx_credit_usage_bucket_provider ON ops.credit_usage (bucket_hour, provider);
  END IF;
END $$;

-- 2) RPC function: public.log_credit_usage(provider, credits)
-- Must be in public schema for PostgREST exposure
CREATE OR REPLACE FUNCTION public.log_credit_usage(
  p_provider TEXT,
  p_credits INTEGER DEFAULT 1
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO ops.credit_usage(provider, credits, ts, bucket_hour)
  VALUES (COALESCE(p_provider, 'unknown'), GREATEST(COALESCE(p_credits, 1), 0), NOW(), date_trunc('hour', NOW()));
END;
$$;

-- Grant execution for typical Supabase roles
DO $$
BEGIN
  GRANT EXECUTE ON FUNCTION public.log_credit_usage(TEXT, INTEGER) TO anon;
  GRANT EXECUTE ON FUNCTION public.log_credit_usage(TEXT, INTEGER) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.log_credit_usage(TEXT, INTEGER) TO service_role;
EXCEPTION WHEN undefined_object THEN
  -- Roles may not exist in all environments; ignore
  NULL;
END $$;

-- 3) Smart Form views (read models)
-- Select from unified_picks where possible; allow nulls to avoid NOT NULL conflicts
-- View: public.view_props_for_form
CREATE OR REPLACE VIEW public.view_props_for_form AS
SELECT
  -- unified_picks does not always have player_name/external ids; expose as nullable
  NULL::text              AS player_name,
  up.stat_type            AS market_type,
  up.line                 AS line,
  up.odds                 AS odds,
  up.game_id              AS external_game_id,
  NULL::text              AS external_prop_id
FROM public.unified_picks up
WHERE TRUE;

-- Materialized view: public.mv_props_for_form
-- Include a synthetic unique key to allow CONCURRENTLY refresh when index exists
DROP MATERIALIZED VIEW IF EXISTS public.mv_props_for_form;
CREATE MATERIALIZED VIEW public.mv_props_for_form AS
SELECT
  md5(
    COALESCE(up.stat_type,'') || '|' ||
    COALESCE(up.line::text,'') || '|' ||
    COALESCE(up.odds::text,'') || '|' ||
    COALESCE(up.game_id,'')
  ) AS mv_id,
  NULL::text              AS player_name,
  up.stat_type            AS market_type,
  up.line                 AS line,
  up.odds                 AS odds,
  up.game_id              AS external_game_id,
  NULL::text              AS external_prop_id
FROM public.unified_picks up
WITH NO DATA;

-- Unique index required for REFRESH CONCURRENTLY
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'mv_props_for_form_pk'
  ) THEN
    CREATE UNIQUE INDEX mv_props_for_form_pk ON public.mv_props_for_form (mv_id);
  END IF;
END $$;

-- Initial population with best-effort concurrent refresh
DO $$
BEGIN
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_props_for_form;
  EXCEPTION WHEN feature_not_supported OR invalid_schema_name OR insufficient_privilege OR object_not_in_prerequisite_state THEN
    -- Fall back if concurrent refresh is not supported yet
    REFRESH MATERIALIZED VIEW public.mv_props_for_form;
  END;
END $$;

