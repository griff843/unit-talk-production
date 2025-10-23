-- SportsGameOdds (SGO) schema setup and safety patches
-- This migration is idempotent and safe to run multiple times

-- 1) Core games table
create table if not exists public.games (
  id bigserial primary key,
  external_game_id text unique not null,
  sport text not null,
  league text,
  home_team text,
  away_team text,
  game_date timestamptz not null,
  status text,
  inserted_at timestamptz default now()
);

-- Helpful indexes
create index if not exists idx_games_game_date on public.games (game_date);
create index if not exists idx_games_sport_date on public.games (sport, game_date);

-- 2) Patch raw_props with SGO-related columns (no-op if already exist)
alter table if exists public.raw_props
  add column if not exists source text default 'sgo',
  add column if not exists external_game_id text,
  add column if not exists external_prop_id text;

-- Unique constraint to support idempotent upserts for SGO
-- Requires the columns above to exist; safe if index already exists
create unique index if not exists raw_props_sgo_unique
  on public.raw_props (source, external_game_id, external_prop_id);

-- Helpful indexes
create index if not exists idx_raw_props_source_created_at on public.raw_props (source, created_at desc nulls last);
create index if not exists idx_raw_props_external_game_id on public.raw_props (external_game_id);

-- 3) Historical config table
create table if not exists public.historical_config (
  id bigserial primary key,
  sport text not null,
  hot_window_days int default 14,
  archive_window_days int default 365,
  created_at timestamptz default now()
);

-- 4) Archive schema and table (structure copy of raw_props)
create schema if not exists archive;
create table if not exists archive.raw_props (
  like public.raw_props including all
);

-- Optional: archive index parity
create index if not exists idx_archive_raw_props_created_at on archive.raw_props (created_at desc nulls last);

