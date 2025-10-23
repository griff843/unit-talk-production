-- 20251009110000_dual_track_permissions.sql (renamed for unique version)
-- Purpose: Enforce GRANT/RLS for dual-track objects and ensure PostgREST can read
-- Target: Supabase project cqfnsozknjzvyiziwicl
-- Guardrails: No destructive DDL; idempotent where possible

BEGIN;

-- Enable RLS on core dual-track tables (safe if already enabled)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='market_props') THEN
    EXECUTE 'ALTER TABLE public.market_props ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='scored_props') THEN
    EXECUTE 'ALTER TABLE public.scored_props ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='promotion_queue') THEN
    EXECUTE 'ALTER TABLE public.promotion_queue ENABLE ROW LEVEL SECURITY';
  END IF;
END$$;

-- Grants for tables (anon/authenticated read; service_role full DML)
DO $$
DECLARE r TEXT;
BEGIN
  FOR r IN SELECT unnest(ARRAY['market_props','scored_props','promotion_queue']) LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=r) THEN
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon, authenticated', r);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', r);
    END IF;
  END LOOP;
END$$;

-- Policies: SELECT for anon/authenticated, ALL for service_role
-- Create policies only if they do not already exist
DO $$
DECLARE r TEXT;
BEGIN
  FOR r IN SELECT unnest(ARRAY['market_props','scored_props','promotion_queue']) LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=r) THEN
      -- SELECT for anon
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=r AND policyname = r||'_select_anon'
      ) THEN
        EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon USING (true)', r||'_select_anon', r);
      END IF;
      -- SELECT for authenticated
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=r AND policyname = r||'_select_auth'
      ) THEN
        EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', r||'_select_auth', r);
      END IF;
      -- ALL for service_role
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=r AND policyname = r||'_all_service'
      ) THEN
        EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', r||'_all_service', r);
      END IF;
    END IF;
  END LOOP;
END$$;

-- View grants (readable by anon/auth/service_role)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='v_prop_read_model') THEN
    GRANT SELECT ON public.v_prop_read_model TO anon, authenticated, service_role;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='v_daily_board') THEN
    GRANT SELECT ON public.v_daily_board TO anon, authenticated, service_role;
  END IF;
END$$;

-- Grant access to sequences (needed for identity/serials)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Ensure future sequences inherit privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;

-- Refresh PostgREST schema cache
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

COMMIT;

