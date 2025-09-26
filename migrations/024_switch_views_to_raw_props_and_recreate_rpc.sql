-- 024_switch_views_to_raw_props_and_recreate_rpc.sql
-- Create robust Smart Form views from raw_props and (re)expose RPC for credit logging

-- Ensure ops schema and credit_usage table shape
CREATE SCHEMA IF NOT EXISTS ops;
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='ops' AND c.relname='idx_credit_usage_bucket_provider'
  ) THEN
    CREATE INDEX idx_credit_usage_bucket_provider ON ops.credit_usage(bucket_hour, provider);
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

DO $$
BEGIN
  BEGIN
    GRANT EXECUTE ON FUNCTION public.log_credit_usage(TEXT, INTEGER) TO anon;
    GRANT EXECUTE ON FUNCTION public.log_credit_usage(TEXT, INTEGER) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.log_credit_usage(TEXT, INTEGER) TO service_role;
  EXCEPTION WHEN undefined_object THEN NULL; END;
END $$;

-- Smart Form views from raw_props (robust to legacy nulls)
CREATE OR REPLACE VIEW public.view_props_for_form AS
SELECT
  rp.player_name,
  rp.market_type,
  rp.line,
  rp.odds,
  rp.game_id        AS external_game_id,
  rp.external_prop_id
FROM public.raw_props rp
WHERE COALESCE(rp.is_valid, TRUE);

DROP MATERIALIZED VIEW IF EXISTS public.mv_props_for_form;
CREATE MATERIALIZED VIEW public.mv_props_for_form AS
SELECT
  md5(
    COALESCE(rp.player_name,'') || '|' ||
    COALESCE(rp.market_type,'') || '|' ||
    COALESCE(rp.line::text,'') || '|' ||
    COALESCE(rp.odds::text,'') || '|' ||
    COALESCE(rp.game_id,'') || '|' ||
    COALESCE(rp.external_prop_id,'')
  ) AS mv_id,
  rp.player_name,
  rp.market_type,
  rp.line,
  rp.odds,
  rp.game_id        AS external_game_id,
  rp.external_prop_id
FROM public.raw_props rp
WHERE COALESCE(rp.is_valid, TRUE)
WITH NO DATA;

-- Using non-unique index and non-concurrent refresh to avoid duplicate conflicts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='mv_props_for_form_idx'
  ) THEN
    CREATE INDEX mv_props_for_form_idx ON public.mv_props_for_form (player_name, market_type);
  END IF;
END $$;

-- Non-concurrent refresh (robust in dev)
REFRESH MATERIALIZED VIEW public.mv_props_for_form;

