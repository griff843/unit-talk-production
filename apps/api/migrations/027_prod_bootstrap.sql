-- Production Bootstrap Schema Migration
-- Creates HOT/WARM/COLD tables, matviews, views, indexes, and RLS
-- Generated: 2025-09-24 for unit-talk-production

-- HOT Tables (RLS enabled)

create table if not exists users(
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  role text not null,
  created_at timestamptz default now()
);

create table if not exists raw_props(
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  provider text not null,
  league text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists unified_picks(
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  raw_id uuid references raw_props(id) on delete cascade,
  sport text not null,
  market text not null,
  line numeric,
  odds int,
  approved_at timestamptz,
  posted_at timestamptz,
  promoted_by text,
  promoted_at timestamptz,
  hash text unique,
  created_at timestamptz default now()
);

create table if not exists approval_queue(
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  unified_id uuid references unified_picks(id) on delete cascade,
  status text not null check (status in ('pending','approved','denied')),
  reason text,
  approved_by text,
  denied_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists alerts_queue(
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  unified_id uuid references unified_picks(id) on delete cascade,
  type text not null,
  last_sent_hash text,
  cooldown_until timestamptz,
  created_at timestamptz default now()
);

create table if not exists api_quota_configs(
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  provider text not null,
  daily_limit int not null,
  used int not null default 0,
  window_start timestamptz default now()
);

create table if not exists runtime_config(
  key text primary key,
  value jsonb not null
);

create table if not exists agent_health(
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  agent text not null,
  status text not null,
  last_heartbeat timestamptz default now()
);

create table if not exists audit_log(
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  actor text not null,
  action text not null,
  entity text not null,
  entity_id uuid,
  created_at timestamptz default now()
);

-- Indexes and Constraints
create index if not exists idx_raw_props_org on raw_props(org_id);
create index if not exists idx_unified_picks_org on unified_picks(org_id);
create index if not exists idx_unified_picks_raw on unified_picks(raw_id);
create unique index if not exists ux_alerts_dedupe on alerts_queue(org_id, unified_id, type, coalesce(last_sent_hash,''));
create index if not exists idx_approval_pending on approval_queue(org_id, status);

-- Enable RLS on HOT tables
alter table users enable row level security;
alter table raw_props enable row level security;
alter table unified_picks enable row level security;
alter table approval_queue enable row level security;
alter table alerts_queue enable row level security;
alter table api_quota_configs enable row level security;
alter table agent_health enable row level security;
alter table audit_log enable row level security;

-- Tenant isolation policies (restrict by org_id)
create policy if not exists users_tenant_isolation
  on users using (org_id = current_setting('app.org_id', true));

create policy if not exists raw_props_tenant_isolation
  on raw_props using (org_id = current_setting('app.org_id', true));

create policy if not exists unified_picks_tenant_isolation
  on unified_picks using (org_id = current_setting('app.org_id', true));

create policy if not exists approval_queue_tenant_isolation
  on approval_queue using (org_id = current_setting('app.org_id', true));

create policy if not exists alerts_queue_tenant_isolation
  on alerts_queue using (org_id = current_setting('app.org_id', true));

create policy if not exists api_quota_configs_tenant_isolation
  on api_quota_configs using (org_id = current_setting('app.org_id', true));

create policy if not exists agent_health_tenant_isolation
  on agent_health using (org_id = current_setting('app.org_id', true));

create policy if not exists audit_log_tenant_isolation
  on audit_log using (org_id = current_setting('app.org_id', true));

-- Promoter single-writer guard: revoke insert from anon/authenticated
revoke insert on unified_picks from anon, authenticated;

-- Create secure promote function with security definer
create or replace function secure_promote(
  p_unified_id uuid,
  p_actor text
) returns boolean
language plpgsql
security definer
as $$
begin
  -- Only allow service_role_promoter to promote
  if current_user != 'service_role_promoter' then
    raise exception 'Access denied: only service_role_promoter can promote picks';
  end if;

  update unified_picks
  set promoted_by = p_actor, promoted_at = now()
  where id = p_unified_id;

  return found;
end;
$$;

-- View: postable picks
create or replace view view_postable_unified_picks as
  select *
  from unified_picks
  where approved_at is not null
    and posted_at is null
    and (created_at > now() - interval '2 days'); -- basic staleness guard

-- WARM materialized views (minimal definitions)
create materialized view if not exists mv_daily_unified_recaps as
  select date_trunc('day', created_at) as day, sport, count(*) picks
  from unified_picks
  group by 1,2;

create materialized view if not exists mv_capper_leaderboard_7_30_90 as
  select sport, count(*) picks_90
  from unified_picks
  where created_at > now() - interval '90 days'
  group by 1;

create materialized view if not exists mv_alert_overlay_today as
  select u.id unified_id, u.sport, a.type, a.cooldown_until
  from unified_picks u
  left join alerts_queue a on a.unified_id = u.id
  where u.created_at::date = now()::date;

create materialized view if not exists mv_provider_quota_state as
  select provider, daily_limit, used, window_start from api_quota_configs;

create materialized view if not exists mv_edge_summary_today as
  select sport, count(*) picks from unified_picks
  where created_at::date = now()::date
  group by sport;

-- COLD tier tables
create table if not exists settlements(
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  unified_id uuid references unified_picks(id) on delete cascade,
  settled_at timestamptz default now(),
  outcome text,
  payout numeric,
  created_at timestamptz default now()
);

create table if not exists metrics_timeseries(
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  metric_name text not null,
  metric_value numeric not null,
  timestamp timestamptz default now()
);

create table if not exists slo_incidents(
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  service text not null,
  incident_type text not null,
  started_at timestamptz default now(),
  resolved_at timestamptz
);

-- Enable RLS on COLD tables
alter table settlements enable row level security;
alter table metrics_timeseries enable row level security;
alter table slo_incidents enable row level security;

-- COLD table policies
create policy if not exists settlements_tenant_isolation
  on settlements using (org_id = current_setting('app.org_id', true));

create policy if not exists metrics_timeseries_tenant_isolation
  on metrics_timeseries using (org_id = current_setting('app.org_id', true));

create policy if not exists slo_incidents_tenant_isolation
  on slo_incidents using (org_id = current_setting('app.org_id', true));

-- Additional indexes for performance
create index if not exists idx_settlements_org on settlements(org_id);
create index if not exists idx_metrics_org_name on metrics_timeseries(org_id, metric_name);
create index if not exists idx_slo_incidents_org on slo_incidents(org_id);

-- Refresh materialized views
refresh materialized view mv_daily_unified_recaps;
refresh materialized view mv_capper_leaderboard_7_30_90;
refresh materialized view mv_alert_overlay_today;
refresh materialized view mv_provider_quota_state;
refresh materialized view mv_edge_summary_today;

-- Insert minimal bootstrap data
insert into runtime_config (key, value)
values ('bootstrap_completed', '{"timestamp": "2025-09-24T18:20:00Z", "version": "1.0.0"}')
on conflict (key) do update set value = excluded.value;