-- 20250926_enable_rpc_credit_logging.sql
-- Enable RPC credit logging in Supabase (idempotent)

create schema if not exists ops;

create table if not exists ops.credit_usage (
  id bigserial primary key,
  provider text not null,
  credits int not null default 1,
  calls int not null default 1,
  bucket_hour timestamptz not null default date_trunc('hour', now()),
  created_at timestamptz default now()
);

create index if not exists idx_credit_usage_provider
  on ops.credit_usage (provider, bucket_hour);

create or replace function public.log_credit_usage(p_provider text, p_credits int default 1)
returns void
language plpgsql
security definer
as $$
begin
  insert into ops.credit_usage(provider, credits, calls, bucket_hour)
  values (p_provider, p_credits, 1, date_trunc('hour', now()));
end;
$$;

grant execute on function public.log_credit_usage(text,int) to anon, authenticated, service_role;

