-- Migration: Reconcile api_quota_configs table
-- Date: 2025-09-26
-- Description: Creates or updates the api_quota_configs table with proper schema and initial data

-- Create the api_quota_configs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.api_quota_configs (
  provider TEXT PRIMARY KEY,
  daily_limit INTEGER NOT NULL DEFAULT 1000,
  used_today INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add enabled column if it doesn't exist (feature flag style)
ALTER TABLE public.api_quota_configs
ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true;

-- Create or replace the trigger function for updating updated_at
CREATE OR REPLACE FUNCTION public.touch_quota_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- Drop existing trigger if it exists and recreate
DROP TRIGGER IF EXISTS trg_quota_updated_at ON public.api_quota_configs;
CREATE TRIGGER trg_quota_updated_at
  BEFORE UPDATE ON public.api_quota_configs
  FOR EACH ROW EXECUTE FUNCTION public.touch_quota_updated_at();

-- Insert default quota configurations
INSERT INTO public.api_quota_configs (provider, daily_limit, enabled)
VALUES
  ('oddsapi', 5000, true),
  ('optimal', 10000, false),
  ('sgo', 1000, false)
ON CONFLICT (provider) DO NOTHING;

-- Grant permissions conditionally based on role existence
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    GRANT ALL ON public.api_quota_configs TO service_role;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    GRANT SELECT ON public.api_quota_configs TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    GRANT SELECT ON public.api_quota_configs TO anon;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON TABLE public.api_quota_configs IS 'API quota management and tracking for external data providers';
COMMENT ON COLUMN public.api_quota_configs.provider IS 'Provider identifier (oddsapi, optimal, sgo)';
COMMENT ON COLUMN public.api_quota_configs.daily_limit IS 'Maximum API calls allowed per day';
COMMENT ON COLUMN public.api_quota_configs.used_today IS 'Number of API calls used today';
COMMENT ON COLUMN public.api_quota_configs.reset_at IS 'Timestamp when quota resets (usually daily)';
COMMENT ON COLUMN public.api_quota_configs.enabled IS 'Feature flag to enable/disable provider usage';