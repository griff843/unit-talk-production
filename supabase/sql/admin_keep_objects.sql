-- ═══════════════════════════════════════════════════════════
-- Admin Keep Objects - Protected Database Objects
-- ═══════════════════════════════════════════════════════════
-- This table defines the KEEP set - objects that must NEVER be dropped
-- Cleanup plan generator will refuse to emit DROP statements for these
-- Safe to run multiple times (idempotent)

create table if not exists public.admin_keep_objects (
  kind text check (kind in ('table', 'view', 'function')) not null,
  name text not null,
  reason text,
  created_at timestamptz not null default now(),
  primary key(kind, name)
);

-- Comment
comment on table public.admin_keep_objects is 'Protected database objects that must never be dropped without explicit approval';
comment on column public.admin_keep_objects.kind is 'Object type: table, view, or function';
comment on column public.admin_keep_objects.name is 'Fully-qualified object name (e.g., public.unified_picks)';
comment on column public.admin_keep_objects.reason is 'Why this object must be protected';

-- Populate with core keep-set
insert into public.admin_keep_objects(kind, name, reason) values
  -- Core tables (12)
  ('table', 'public.unified_picks', 'Central pick management - production critical'),
  ('table', 'public.raw_props', 'Market data source - required for all picks'),
  ('table', 'public.scored_props', 'Scoring results - drives approval workflow'),
  ('table', 'public.promotion_queue', 'Approval workflow - production critical'),
  ('table', 'public.settled_outcomes', 'Settlement data - required for grading'),
  ('table', 'public.player_stats', 'Player performance data - scoring dependency'),
  ('table', 'public.players', 'Player master data - core entity'),
  ('table', 'public.games', 'Game master data - core entity'),
  ('table', 'public.users', 'User and capper management - core entity'),
  ('table', 'public.api_quota_configs', 'API rate limiting configuration'),
  ('table', 'public.runtime_config', 'System configuration'),
  ('table', 'public.agent_health', 'Agent monitoring - observability critical'),

  -- Read-model views (6)
  ('view', 'public.v_daily_board', 'Command Center primary read-model'),
  ('view', 'public.v_prop_read_model', 'Prop feed read-model'),
  ('view', 'public.v_open_promotions', 'Promotion queue read-model'),
  ('view', 'public.v_best_line_now', 'Line shopping read-model'),
  ('view', 'public.v_recent_settlement', 'Settlement tracking read-model'),
  ('view', 'public.v_command_center_board', 'Command Center board view'),

  -- RPC functions (3)
  ('function', 'public.submit_pick', 'Pick submission RPC - production workflow'),
  ('function', 'public.approve_pick', 'Pick approval RPC - production workflow'),
  ('function', 'public.deny_pick', 'Pick denial RPC - production workflow')
on conflict (kind, name) do update
  set reason = excluded.reason;

-- Index for fast lookups by cleanup generator
create index if not exists idx_admin_keep_objects_kind_name
  on public.admin_keep_objects (kind, name);

-- Grant read access to service role (cleanup scripts)
grant select on public.admin_keep_objects to service_role;
