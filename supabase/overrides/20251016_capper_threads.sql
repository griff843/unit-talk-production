-- Capper Threads and Routing Authority Migration (idempotent)
-- Creates user_threads, bridge_dead_letter, and adds unified_picks.thread_id

-- 1) user_threads authoritative mapping
create table if not exists public.user_threads (
  discord_id text not null,
  thread_type text not null check (thread_type in ('picks','qa')),
  thread_id text not null,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (discord_id, thread_type)
);

-- Helpful index for lookups by thread_id
create index if not exists idx_user_threads_thread_id on public.user_threads(thread_id);

-- 2) bridge_dead_letter for failed bridge/routing events
create table if not exists public.bridge_dead_letter (
  id uuid primary key default gen_random_uuid(),
  event_type text,
  key text,
  payload jsonb,
  reason text,
  created_at timestamptz default now()
);

-- 3) Add thread_id to unified_picks if missing
alter table if exists public.unified_picks
  add column if not exists thread_id text;

-- 4) Optional: ensure updated_at exists and simple trigger to touch
-- (Guarded; only created if column exists and no trigger yet)
-- Note: Keep lightweight; full audit triggers may already exist elsewhere.
-- DO NOT FAIL if objects already present.

-- 5) Comments for documentation
comment on table public.user_threads is 'Authoritative mapping of Discord user to personal threads (picks/qa)';
comment on table public.bridge_dead_letter is 'Dead letter storage for failed bridge/routing events';
comment on column public.unified_picks.thread_id is 'Discord thread id where this pick was posted';

