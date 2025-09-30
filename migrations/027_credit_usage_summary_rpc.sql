-- 027_credit_usage_summary_rpc.sql
-- Safe, read-only summary RPC for credit usage

CREATE SCHEMA IF NOT EXISTS ops;

CREATE TABLE IF NOT EXISTS ops.credit_usage (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  credits INT NOT NULL DEFAULT 1,
  calls INT NOT NULL DEFAULT 1,
  bucket_hour TIMESTAMPTZ NOT NULL DEFAULT date_trunc('hour', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_usage_bucket_hour
  ON ops.credit_usage (bucket_hour, provider);

CREATE OR REPLACE FUNCTION public.get_credit_usage_summary()
RETURNS TABLE (
  provider TEXT,
  credits BIGINT,
  calls BIGINT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT provider,
         COALESCE(SUM(credits), 0) AS credits,
         COALESCE(SUM(calls), 0)   AS calls
  FROM ops.credit_usage
  GROUP BY provider
  ORDER BY provider;
$$;

REVOKE ALL ON FUNCTION public.get_credit_usage_summary() FROM public;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION public.get_credit_usage_summary() TO anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.get_credit_usage_summary() TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.get_credit_usage_summary() TO service_role;
  END IF;
END $$;

