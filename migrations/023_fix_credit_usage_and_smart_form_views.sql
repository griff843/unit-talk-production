-- 023_fix_credit_usage_and_smart_form_views.sql
-- Fix prior attempt by ensuring columns exist before indexes; (re)create RPC and views

-- Ensure ops schema exists
CREATE SCHEMA IF NOT EXISTS ops;

-- Create table or add missing columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='ops' AND table_name='credit_usage'
  ) THEN
    CREATE TABLE ops.credit_usage (
      id            BIGSERIAL PRIMARY KEY,
      provider      TEXT NOT NULL,
      credits       INTEGER NOT NULL DEFAULT 1,
      ts            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      bucket_hour   TIMESTAMPTZ NOT NULL DEFAULT date_trunc('hour', NOW())
    );
  ELSE
    -- Add missing columns idempotently
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='ops' AND table_name='credit_usage' AND column_name='bucket_hour'
    ) THEN
      ALTER TABLE ops.credit_usage ADD COLUMN bucket_hour TIMESTAMPTZ NOT NULL DEFAULT date_trunc('hour', NOW());
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='ops' AND table_name='credit_usage' AND column_name='ts'
    ) THEN
      ALTER TABLE ops.credit_usage ADD COLUMN ts TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='ops' AND table_name='credit_usage' AND column_name='credits'
    ) THEN
      ALTER TABLE ops.credit_usage ADD COLUMN credits INTEGER NOT NULL DEFAULT 1;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='ops' AND table_name='credit_usage' AND column_name='provider'
    ) THEN
      ALTER TABLE ops.credit_usage ADD COLUMN provider TEXT NOT NULL DEFAULT 'unknown';
    END IF;
  END IF;
END $$;

-- Helpful index for aggregations (create if missing)
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

-- (Re)create RPC function in public
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

-- Grant execution for common Supabase roles (best-effort)
DO $$
BEGIN
  BEGIN
    GRANT EXECUTE ON FUNCTION public.log_credit_usage(TEXT, INTEGER) TO anon;
    GRANT EXECUTE ON FUNCTION public.log_credit_usage(TEXT, INTEGER) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.log_credit_usage(TEXT, INTEGER) TO service_role;
  EXCEPTION WHEN undefined_object THEN NULL; END;
END $$;

-- Views for Smart Form
CREATE OR REPLACE VIEW public.view_props_for_form AS
SELECT
  NULL::text              AS player_name,
  up.stat_type            AS market_type,
  up.line                 AS line,
  up.odds                 AS odds,
  up.game_id              AS external_game_id,
  NULL::text              AS external_prop_id
FROM public.unified_picks up
WHERE TRUE;

-- Materialized view with unique key for concurrent refresh
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

-- Unique index for CONCURRENTLY
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

-- Populate, preferring CONCURRENTLY
DO $$
BEGIN
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_props_for_form;
  EXCEPTION WHEN feature_not_supported OR invalid_schema_name OR insufficient_privilege OR object_not_in_prerequisite_state THEN
    REFRESH MATERIALIZED VIEW public.mv_props_for_form;
  END;
END $$;

