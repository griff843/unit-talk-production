-- Extend api_quota_configs with runtime controls and allow-lists
-- Safe, idempotent migration: adds columns IF NOT EXISTS

DO $$ BEGIN
  -- Ensure table exists (created previously in 20250926_reconcile_api_quota_configs)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema='public' AND table_name='api_quota_configs'
  ) THEN
    CREATE TABLE public.api_quota_configs (
      provider TEXT PRIMARY KEY,
      daily_limit INTEGER NOT NULL DEFAULT 1000,
      used_today INTEGER NOT NULL DEFAULT 0,
      reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      enabled BOOLEAN NOT NULL DEFAULT true
    );
  END IF;
END $$;

-- New columns
ALTER TABLE public.api_quota_configs
  ADD COLUMN IF NOT EXISTS monthly_limit INTEGER NOT NULL DEFAULT 5000000,
  ADD COLUMN IF NOT EXISTS emergency_freeze BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_remaining_threshold INTEGER NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS rpm INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS cache_ttl_seconds INTEGER NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS sport_market_allowlist JSONB DEFAULT '{}'::jsonb;

-- Touch trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_quota_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_quota_updated_at ON public.api_quota_configs;
CREATE TRIGGER trg_quota_updated_at
  BEFORE UPDATE ON public.api_quota_configs
  FOR EACH ROW EXECUTE FUNCTION public.touch_quota_updated_at();

-- Seed row for oddsapi if missing
INSERT INTO public.api_quota_configs(provider, daily_limit, monthly_limit, enabled)
VALUES ('oddsapi', 10000, 5000000, true)
ON CONFLICT (provider) DO NOTHING;

COMMENT ON COLUMN public.api_quota_configs.monthly_limit IS 'Monthly request/credit limit for provider';
COMMENT ON COLUMN public.api_quota_configs.emergency_freeze IS 'Provider-level kill switch';
COMMENT ON COLUMN public.api_quota_configs.min_remaining_threshold IS 'Remaining credits threshold to stop live calls';
COMMENT ON COLUMN public.api_quota_configs.rpm IS 'Token bucket rate: requests per minute';
COMMENT ON COLUMN public.api_quota_configs.cache_ttl_seconds IS 'Default cache TTL for provider responses';
COMMENT ON COLUMN public.api_quota_configs.sport_market_allowlist IS 'Allow-list of markets by sport for scoped canaries';

