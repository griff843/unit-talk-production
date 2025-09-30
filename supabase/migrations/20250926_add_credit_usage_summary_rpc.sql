-- 20250926_add_credit_usage_summary_rpc.sql

-- Ensure ops schema & table exist (idempotent guard)
create schema if not exists ops;

create table if not exists ops.credit_usage (
  id bigserial primary key,
  provider text not null,
  credits bigint not null default 0,
  calls bigint not null default 0,
  created_at timestamptz not null default now()
);

-- Public-facing RPC that aggregates provider usage
create or replace function public.get_credit_usage_summary()
returns table(provider text, credits bigint, calls bigint)
language sql
stable
security definer
set search_path = public, ops
as $$
  select
    provider,
    sum(credits)::bigint as credits,
    sum(calls)::bigint as calls
  from ops.credit_usage
  group by provider
  order by provider;
$$;

-- Grant execute permissions to all roles
grant execute on function public.get_credit_usage_summary() to public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.get_credit_usage_summary() to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.get_credit_usage_summary() to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.get_credit_usage_summary() to service_role;
  end if;
end $$;