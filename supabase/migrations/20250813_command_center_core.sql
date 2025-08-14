-- Command Center Core Infrastructure Migration
-- Date: 2025-08-13
-- Purpose: Create core tables and RPCs for command center wiring patch

-- Core tables
create table if not exists app_system_config (
  key text primary key,
  value boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists app_audit_log (
  id bigserial primary key,
  occurred_at timestamptz not null default now(),
  actor text,
  action text not null,
  target text not null,
  meta jsonb not null default '{}',
  user_id uuid,
  ip_address text,
  user_agent text
);

create table if not exists app_incidents (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  title text not null,
  description text,
  severity text not null check (severity in ('warning','critical')),
  status text not null default 'open' check (status in ('open','resolved')),
  source text not null,
  details jsonb not null default '{}',
  created_by text,
  resolved_at timestamptz,
  resolution_notes text
);

-- Optional metrics infrastructure used by tiles (safe to add now, fill later)
create table if not exists system_heartbeat (
  id bigserial primary key,
  source text not null,
  created_at timestamptz not null default now()
);

create table if not exists notifications_outbox (
  id bigserial primary key,
  sink text not null,                      -- 'discord' | 'notion' | ...
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','retrying','delivered','dlq')),
  attempt_count int not null default 0,
  next_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Optional provider usage table for health tiles
create table if not exists provider_usage (
  id bigserial primary key,
  ts timestamptz not null default now(),
  credits_used int not null default 0,
  window_minutes int not null default 5
);

-- RPCs used by src/server/systemConfig.ts
-- 1) write_audit_log(...) -> returns audit_id
create or replace function write_audit_log(
  p_actor text,
  p_action text,
  p_target text,
  p_meta jsonb default '{}'::jsonb,
  p_user_id uuid default null,
  p_ip_address text default null,
  p_user_agent text default null
) returns bigint
language plpgsql
security definer
as $$
declare v_id bigint;
begin
  insert into app_audit_log(actor, action, target, meta, user_id, ip_address, user_agent)
  values (p_actor, p_action, p_target, coalesce(p_meta,'{}'::jsonb), p_user_id, p_ip_address, p_user_agent)
  returning id into v_id;
  return v_id;
end$$;

-- 2) set_system_flag(flag_key, flag_value, p_actor, p_user_id, p_ip, p_ua) -> returns audit_id
create or replace function set_system_flag(
  flag_key text,
  flag_value boolean,
  p_actor text,
  p_user_id uuid default null,
  p_ip_address text default null,
  p_user_agent text default null
) returns bigint
language plpgsql
security definer
as $$
begin
  insert into app_system_config(key, value, updated_by)
  values (flag_key, flag_value, p_actor)
  on conflict (key) do update
    set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();

  return write_audit_log(p_actor, 'set_system_flag', flag_key,
                         json_build_object('value', flag_value), p_user_id, p_ip_address, p_user_agent);
end$$;

-- 3) get_system_flag(flag_key) -> returns flag value
create or replace function get_system_flag(
  flag_key text
) returns boolean
language plpgsql
security definer
as $$
declare flag_value boolean;
begin
  select value into flag_value from app_system_config where key = flag_key;
  return coalesce(flag_value, false);
end$$;

-- 4) create_incident_auto_safemode(...) -> returns incident_id
create or replace function create_incident_auto_safemode(
  p_title text,
  p_description text,
  p_severity text,
  p_source text,
  p_actor text default 'system',
  p_meta jsonb default '{}'::jsonb
) returns bigint
language plpgsql
security definer
as $$
declare v_id bigint;
begin
  insert into app_incidents(title, description, severity, status, source, details, created_by)
  values (p_title, p_description, p_severity, 'open', p_source, coalesce(p_meta,'{}'::jsonb), p_actor)
  returning id into v_id;

  -- auto-enable SAFE_MODE for criticals
  if p_severity = 'critical' then
    perform set_system_flag('SAFE_MODE', true, coalesce(p_actor,'system'));
  end if;

  return v_id;
end$$;

-- Seed defaults (idempotent)
insert into app_system_config(key,value) values
  ('SAFE_MODE', false),
  ('SYSTEM_FREEZE', false),
  ('SHADOW_MODE', true),
  ('PUBLISH_TO_DISCORD', false),
  ('PUBLISH_TO_NOTION', false)
on conflict (key) do nothing;

-- Create indexes for better performance
create index if not exists idx_audit_log_occurred_at on app_audit_log(occurred_at desc);
create index if not exists idx_audit_log_actor on app_audit_log(actor);
create index if not exists idx_audit_log_action on app_audit_log(action);
create index if not exists idx_incidents_status on app_incidents(status);
create index if not exists idx_incidents_severity on app_incidents(severity);
create index if not exists idx_incidents_created_at on app_incidents(created_at desc);
create index if not exists idx_notifications_status on notifications_outbox(status);
create index if not exists idx_provider_usage_ts on provider_usage(ts desc);

-- Comments for documentation
comment on table app_system_config is 'System configuration flags for operational control';
comment on table app_audit_log is 'Audit trail for all system operations';
comment on table app_incidents is 'Incident tracking with automatic safe mode activation';
comment on table system_heartbeat is 'System health monitoring heartbeats';
comment on table notifications_outbox is 'Notification delivery queue with retry logic';
comment on table provider_usage is 'API provider usage tracking for cost monitoring';

comment on function write_audit_log is 'Write an audit log entry and return the audit ID';
comment on function set_system_flag is 'Set a system flag and write audit log, returns audit ID';
comment on function get_system_flag is 'Get a system flag value with safe default';
comment on function create_incident_auto_safemode is 'Create incident and auto-activate safe mode for critical alerts';