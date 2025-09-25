-- Finalize SaaS-grade schema: canonical tables, archival, indexes, compatibility
-- Safe, idempotent, production-friendly
-- Date: 2025-09-25

-- 1) Canonical tables ---------------------------------------------------------

-- games
create table if not exists public.games (
  id bigserial primary key,
  external_game_id text unique,
  sport text not null,
  matchup text,
  game_date timestamptz
);

-- performance index
create index if not exists idx_games_date_sport on public.games(sport, game_date);

-- unified_picks (ensure core fields exist)
create table if not exists public.unified_picks (
  id uuid primary key default gen_random_uuid()
);
-- Add canonical/core columns if missing (non-destructive)
alter table public.unified_picks add column if not exists external_game_id text;
alter table public.unified_picks add column if not exists external_prop_id text;
alter table public.unified_picks add column if not exists player_id text;
alter table public.unified_picks add column if not exists line numeric;
alter table public.unified_picks add column if not exists odds integer;
alter table public.unified_picks add column if not exists outcome text;
alter table public.unified_picks add column if not exists settled_at timestamptz;
alter table public.unified_picks add column if not exists promoted_at timestamptz;
alter table public.unified_picks add column if not exists posted_at timestamptz;
alter table public.unified_picks add column if not exists created_at timestamptz default now();

-- settlement_jobs
create table if not exists public.settlement_jobs (
  id bigserial primary key,
  sport text,
  started_at timestamptz default now(),
  completed_at timestamptz,
  settled_count int default 0,
  error_count int default 0,
  status text default 'running'
);

-- historical_config
create table if not exists public.historical_config (
  id serial primary key,
  sport text not null,
  hot_window_days int default 14,
  archive_window_days int default 365,
  created_at timestamptz default now()
);

-- 2) raw_props compatibility and archival ------------------------------------

-- Create compatibility view only if raw_props (table or view) does not exist
DO $$
DECLARE
  v_exists_table boolean;
  v_exists_view boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'raw_props' AND c.relkind = 'r'
  ) INTO v_exists_table;

  SELECT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'raw_props' AND c.relkind IN ('v','m')
  ) INTO v_exists_view;

  IF NOT v_exists_table AND NOT v_exists_view THEN
    EXECUTE 'create or replace view public.raw_props as select * from public.unified_picks';
  END IF;
END$$;

-- Ensure archive schema and archive.raw_props (clone of public.raw_props)
create schema if not exists archive;

DO $$
DECLARE
  v_is_table boolean;
  v_is_view boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname='raw_props' AND c.relkind='r'
  ) INTO v_is_table;

  SELECT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname='raw_props' AND c.relkind IN ('v','m')
  ) INTO v_is_view;

  -- Create archive table if not exists, cloning structure from table or view
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='archive' AND c.relname='raw_props' AND c.relkind='r'
  ) THEN
    IF v_is_table THEN
      EXECUTE 'create table archive.raw_props (like public.raw_props including all)';
    ELSIF v_is_view THEN
      EXECUTE 'create table archive.raw_props as select * from public.raw_props with no data';
    END IF;
  END IF;

  -- Add a unique index on id in archive if id column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='archive' AND table_name='raw_props' AND column_name='id'
  ) THEN
    EXECUTE 'create unique index if not exists ux_archive_raw_props_id on archive.raw_props(id)';
  END IF;
END$$;

-- Move legacy rows into archive (source is null OR inserted_at < now()-30d; fallback to created_at)
-- Safe: only when raw_props is a table and id column exists
-- PATCH: qualified ambiguous columns in archival block (20250926)

DO $$
DECLARE
  v_has_id boolean;
  v_has_source boolean;
  v_has_inserted_at boolean;
  v_has_created_at boolean;
  v_condition text := '';
BEGIN
  -- Only proceed if public.raw_props is a table
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='raw_props' AND c.relkind='r'
  ) THEN

    SELECT EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='raw_props' AND column_name='id'
    ) INTO v_has_id;

    IF NOT v_has_id THEN
      RAISE NOTICE 'Skipping archival: public.raw_props has no id column';
      RETURN;
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='raw_props' AND column_name='source'
    ) INTO v_has_source;

    SELECT EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='raw_props' AND column_name='inserted_at'
    ) INTO v_has_inserted_at;

    SELECT EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='raw_props' AND column_name='created_at'
    ) INTO v_has_created_at;

    -- Build condition dynamically
    IF v_has_source THEN
      v_condition := '(p.source IS NULL)';
    END IF;

    IF v_has_inserted_at THEN
      v_condition := CASE WHEN v_condition <> '' THEN v_condition || ' OR ' ELSE '' END ||
                      '(p.inserted_at < now() - interval ''30 days'')';
    ELSIF v_has_created_at THEN
      v_condition := CASE WHEN v_condition <> '' THEN v_condition || ' OR ' ELSE '' END ||
                      '(p.created_at < now() - interval ''30 days'')';
    END IF;

    IF v_condition = '' THEN
      RAISE NOTICE 'Skipping archival: no qualifying columns (source/inserted_at/created_at) present';
      RETURN;
    END IF;

    -- Insert into archive only rows not already archived (by id), then delete those from live
    EXECUTE 'with to_move as (
               select p.* from public.raw_props p
               left join archive.raw_props a on a.id = p.id
               where a.id is null and (' || v_condition || ')
             ), ins as (
               insert into archive.raw_props select * from to_move
               on conflict do nothing
               returning id
             )
             delete from public.raw_props p using ins
             where p.id = ins.id';
  END IF;
END$$;

-- 3) Indexes ------------------------------------------------------------------

-- unified_picks
create index if not exists idx_unified_picks_external_ids on public.unified_picks(external_game_id, external_prop_id);
create index if not exists idx_unified_picks_settled_at on public.unified_picks(settled_at);

-- games
create index if not exists idx_games_date_sport on public.games(sport, game_date);

-- 4) Comments -----------------------------------------------------------------
comment on table public.games is 'Canonical games table (SaaS)';
comment on table public.unified_picks is 'Canonical picks table (SaaS) - core fields ensured';
comment on table public.settlement_jobs is 'Background jobs tracking for settlement runs';
comment on table public.historical_config is 'Retention/archival policy configuration per sport';

