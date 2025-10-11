-- FIX_SCORED_PROPS_FK.sql
-- Purpose: Align scored_props foreign key with dual-track architecture (market track)
-- Strategy: Drop legacy FK to unified_picks if present; add FK to market_props(id) with NOT VALID then VALIDATE
-- Also: ensure prop_ref is UUID, add supporting index, drop polymorphic FK on promotion_queue if present
-- Idempotent and zero-downtime safe (constraint added NOT VALID then validated)

BEGIN;

-- 0) Guard: Ensure market_props exists
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='market_props'
  ) THEN
    RAISE NOTICE 'market_props table not found; skipping FK fix.';
  END IF;
END
$do$;

-- 1) Ensure scored_props.prop_ref is UUID
DO $do$
DECLARE v_datatype text;
BEGIN
  SELECT data_type INTO v_datatype
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='scored_props' AND column_name='prop_ref';

  IF v_datatype IS NOT NULL AND v_datatype <> 'uuid' THEN
    EXECUTE 'ALTER TABLE public.scored_props ALTER COLUMN prop_ref TYPE uuid USING prop_ref::uuid';
  END IF;
END
$do$;

-- 2) Supporting index for FK lookups
CREATE INDEX IF NOT EXISTS ix_scored_props_prop_ref ON public.scored_props(prop_ref);

-- 3) Drop legacy FK from scored_props.prop_ref -> unified_picks.id (if present)
DO $do$
DECLARE v_conname text;
BEGIN
  SELECT c.conname INTO v_conname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_class r ON r.oid = c.confrelid
  WHERE c.contype = 'f'
    AND t.relname = 'scored_props'
    AND r.relname = 'unified_picks'
  LIMIT 1;

  IF v_conname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.scored_props DROP CONSTRAINT ' || quote_ident(v_conname);
  END IF;
END
$do$;

-- 4) Add FK scored_props.prop_ref -> market_props.id if missing (NOT VALID then VALIDATE)
DO $do$
DECLARE v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_class r ON r.oid = c.confrelid
    WHERE c.contype = 'f'
      AND t.relname = 'scored_props'
      AND r.relname = 'market_props'
  ) INTO v_exists;

  IF NOT v_exists THEN
    EXECUTE 'ALTER TABLE public.scored_props
      ADD CONSTRAINT fk_scored_props_prop_ref_market
      FOREIGN KEY (prop_ref) REFERENCES public.market_props(id)
      ON DELETE CASCADE NOT VALID';

    -- Try to validate; if validation fails due to legacy data, leave NOT VALID and log a notice
    BEGIN
      EXECUTE 'ALTER TABLE public.scored_props VALIDATE CONSTRAINT fk_scored_props_prop_ref_market';
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Validation of fk_scored_props_prop_ref_market failed; constraint remains NOT VALID. Clean up legacy rows then VALIDATE.';
    END;
  END IF;
END
$do$;

-- 5) Remove polymorphic FK from promotion_queue.prop_ref (if it points to unified_picks)
DO $do$
DECLARE v_pq_fk text;
BEGIN
  SELECT c.conname INTO v_pq_fk
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_class r ON r.oid = c.confrelid
  WHERE c.contype = 'f'
    AND t.relname = 'promotion_queue'
    AND r.relname = 'unified_picks'
  LIMIT 1;

  IF v_pq_fk IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.promotion_queue DROP CONSTRAINT ' || quote_ident(v_pq_fk);
  END IF;
END
$do$;

-- 6) Ensure updated_at trigger exists on scored_props (optional best-practice)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$func$;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_scored_props_updated_at'
  ) THEN
    CREATE TRIGGER trg_scored_props_updated_at
    BEFORE UPDATE ON public.scored_props
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$do$;

-- 7) Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;

