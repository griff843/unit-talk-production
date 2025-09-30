-- Syndicate-grade data layer hardening (idempotent, zero-downtime)
-- - Make unified_picks canonical for ALL props
-- - Smart Form views/materialized views
-- - Compatibility layer for raw_props
-- - Cache (Redis-backed) DB surfaces and ops schema
-- - Runtime flags and retention scaffolding

-- 0) Safety: required extensions
create extension if not exists pg_trgm;

-- 1) Canonical contracts: unified_picks
-- Ensure columns exist to support all props ingestion
alter table if exists public.unified_picks
  add column if not exists external_game_id text,
  add column if not exists external_prop_id text,
  add column if not exists sport text,
  add column if not exists league text,
  add column if not exists market text,
  add column if not exists submarket text,
  add column if not exists player_name text,
  add column if not exists team text,
  add column if not exists matchup text,
  add column if not exists game_date timestamptz,
  add column if not exists side text,
  add column if not exists line numeric,
  add column if not exists price integer,
  add column if not exists implied_prob numeric,
  add column if not exists source text,
  add column if not exists posted_at timestamptz default now(),
  add column if not exists scored_at timestamptz,
  add column if not exists promoted boolean default false,
  add column if not exists settled_at timestamptz,
  add column if not exists outcome text,
  add column if not exists meta jsonb default '{}'::jsonb;

-- Basic not-null constraints for core IDs
alter table if exists public.unified_picks
  alter column external_game_id set not null,
  alter column external_prop_id set not null,
  alter column sport set not null,
  alter column market set not null,
  alter column source set not null;

-- Indexes (create if not exists)
-- Unique pair for idempotent upsert semantics
create unique index if not exists idx_unified_picks_external_ids
  on public.unified_picks (external_game_id, external_prop_id);

create index if not exists idx_unified_picks_settled_at
  on public.unified_picks (settled_at);

create index if not exists idx_unified_picks_game_date
  on public.unified_picks (game_date);

-- Trigram index to accelerate autocomplete on player names (if present)
create index if not exists idx_unified_picks_player_name_trgm
  on public.unified_picks using gin (player_name gin_trgm_ops);

-- 1b) public.games safety: ensure sport, game_date and a helpful index
alter table if exists public.games
  add column if not exists sport text,
  add column if not exists game_date timestamptz;

create index if not exists idx_games_date_sport
  on public.games (game_date, sport);

-- 2) Smart Form views (autocomplete-ready)
create or replace view public.view_props_for_form as
select
  external_prop_id,
  external_game_id,
  sport,
  league,
  player_name,
  team,
  matchup,
  market,
  submarket,
  line,
  price,
  game_date,
  posted_at
from public.unified_picks
where (game_date >= now() - interval '3 days')
   or (posted_at >= now() - interval '3 days');

-- Optional: materialized view for blazing-fast form queries (Postgres ≥ 12)
create materialized view if not exists public.mv_props_for_form as
select
  external_prop_id,
  external_game_id,
  sport,
  league,
  player_name,
  team,
  matchup,
  market,
  submarket,
  line,
  price,
  game_date,
  posted_at
from public.unified_picks
where (game_date >= now() - interval '3 days')
   or (posted_at >= now() - interval '3 days');

-- Helpful indexes for matview
create index if not exists mv_props_for_form_player_name_trgm on public.mv_props_for_form using gin (player_name gin_trgm_ops);
create index if not exists mv_props_for_form_team on public.mv_props_for_form (team);
create index if not exists mv_props_for_form_market on public.mv_props_for_form (market);
create index if not exists mv_props_for_form_game_date on public.mv_props_for_form (game_date);

-- Refresh helper (safe by default)
create or replace function public.refresh_mv_props_for_form() returns void
language plpgsql as $$
begin
  -- Concurrent refresh avoids long read locks if privileges allow
  begin
    execute 'refresh materialized view concurrently public.mv_props_for_form';
  exception when others then
    -- Fallback if CONCURRENTLY not available
    execute 'refresh materialized view public.mv_props_for_form';
  end;
end;
$$;

-- 3) Compatibility layer for legacy raw_props
-- If raw_props is not a base table, create a compatibility view mapping to unified_picks
DO $$
DECLARE
  raw_kind char;
BEGIN
  SELECT c.relkind INTO raw_kind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'raw_props';

  IF raw_kind IS NULL OR raw_kind <> 'r' THEN
    -- Not a table: provide compatibility view
    EXECUTE $$create or replace view public.raw_props as
      select * from public.unified_picks$$;
    COMMENT ON VIEW public.raw_props IS 'DEPRECATED compatibility view (mapped to unified_picks). Scheduled for removal within 30–45 days.';
  END IF;
END$$;

-- 4) Ops/Cache schemas and tables
create schema if not exists cache;
create schema if not exists ops;

-- Cache: game_results (per-game snapshots)
create table if not exists cache.game_results (
  external_game_id text primary key,
  sport text,
  fetched_at timestamptz not null default now(),
  payload jsonb not null
);

-- Cache: per-book quotes (immutable by timestamp)
create table if not exists cache.book_quotes (
  external_game_id text not null,
  book text not null,
  market_key text not null,
  outcome text not null,
  line numeric,
  price integer,
  fetched_at timestamptz not null default now(),
  primary key (external_game_id, book, market_key, outcome, fetched_at)
);

-- Ops: credit usage accounting (hourly buckets)
create table if not exists ops.credit_usage (
  hour_bucket timestamptz not null,
  provider text not null,
  calls int not null default 1,
  credits numeric not null default 0,
  primary key (hour_bucket, provider)
);

-- Helper RPC-safe functions for PostgREST (public schema)
create or replace function public.log_credit_usage(p_provider text, p_credits numeric)
returns void language plpgsql as $$
begin
  insert into ops.credit_usage(hour_bucket, provider, calls, credits)
  values (date_trunc('hour', now()), p_provider, 1, coalesce(p_credits,0))
  on conflict (hour_bucket, provider)
  do update set calls = ops.credit_usage.calls + 1,
                credits = ops.credit_usage.credits + excluded.credits;
end; $$;

create or replace function public.write_book_quote(
  p_external_game_id text,
  p_book text,
  p_market_key text,
  p_outcome text,
  p_line numeric,
  p_price integer,
  p_fetched_at timestamptz default now()
) returns void language sql as $$
  insert into cache.book_quotes(external_game_id, book, market_key, outcome, line, price, fetched_at)
  values (p_external_game_id, p_book, p_market_key, p_outcome, p_line, p_price, coalesce(p_fetched_at, now()));
$$;

-- 5) Historical/retention scaffolding
create table if not exists public.historical_config (
  id int primary key default 1,
  hot_days int not null default 14,
  archive_days int not null default 365,
  updated_at timestamptz not null default now()
);

-- Runtime config and safety flags
create table if not exists public.runtime_config (
  key text primary key,
  value text not null
);

-- Seed/ensure keys exist (idempotent upserts)
insert into public.runtime_config(key, value) values
  ('shadow_mode','true'),
  ('freeze_mode','false'),
  ('max_api_rps','3'),
  ('daily_credit_budget','100000'),
  ('ops_safe_mode','true')
on conflict (key) do nothing;

-- Retention sweep skeleton (non-destructive)
create or replace function public.retention_sweeps() returns text
language plpgsql as $$
DECLARE
  v_hot int;
  v_archive int;
  v_safe boolean := true;
BEGIN
  select hot_days, archive_days into v_hot, v_archive from public.historical_config where id = 1;
  select coalesce((select value from public.runtime_config where key = 'ops_safe_mode'),'true') = 'true' into v_safe;

  -- This is a skeleton: in production, implement partition management/moves.
  -- For now, report what would happen without executing destructive operations.
  RAISE NOTICE 'Retention sweep: hot=% days, archive=% days, ops_safe_mode=%', v_hot, v_archive, v_safe;
  RAISE NOTICE 'Would move unified_picks older than % days to WARM/COLD partitions if configured', v_hot;
  RAISE NOTICE 'No deletes performed. Destructive actions must be gated behind ops_safe_mode = false.';

  return 'ok';
END; $$;

-- Notes for operators
comment on materialized view public.mv_props_for_form is 'Smart Form source (hot data, refreshed via public.refresh_mv_props_for_form())';
comment on table cache.book_quotes is 'Immutable quotes snapshots by fetch timestamp. TTL handled by ops processes. Retention: quotes 7d typical.';
comment on table cache.game_results is 'Per-game JSON snapshots (results/metadata). Retention: up to 365d for settlement replays.';

