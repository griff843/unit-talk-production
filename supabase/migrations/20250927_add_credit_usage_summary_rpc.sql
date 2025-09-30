-- 20250927_add_credit_usage_summary_rpc.sql
-- Fortune-100 style: expose a safe, aggregated credit usage summary
-- Keeps ops schema private; exposes only what’s needed for dashboards

-- Ensure ops.credit_usage exists (idempotent)
CREATE SCHEMA IF NOT EXISTS ops;

CREATE TABLE IF NOT EXISTS ops.credit_usage (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  credits INT NOT NULL DEFAULT 1,
  calls INT NOT NULL DEFAULT 1,
  bucket_hour TIMESTAMPTZ NOT NULL DEFAULT date_trunc('hour', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast hourly lookups
CREATE INDEX IF NOT EXISTS idx_credit_usage_bucket_hour
  ON ops.credit_usage (bucket_hour, provider);

-- Safe read-only summary RPC
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

-- Grants: restrict to read-only exec
GRANT EXECUTE ON FUNCTION public.get_credit_usage_summary() TO anon, authenticated, service_role;
