-- 025_fix_mv_props_for_form_refresh.sql
-- Make mv_props_for_form refresh robust by removing uniqueness requirement

-- If the unique index exists and causes conflicts, drop it safely
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='mv_props_for_form_pk'
  ) THEN
    BEGIN
      DROP INDEX IF EXISTS public.mv_props_for_form_pk;
    EXCEPTION WHEN undefined_table OR undefined_object THEN
      NULL;
    END;
  END IF;
END $$;

-- Ensure a non-unique helper index exists for lookups (optional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='mv_props_for_form_idx'
  ) THEN
    CREATE INDEX mv_props_for_form_idx ON public.mv_props_for_form (player_name, market_type);
  END IF;
END $$;

-- Refresh without CONCURRENTLY to avoid unique constraint requirement
REFRESH MATERIALIZED VIEW public.mv_props_for_form;

