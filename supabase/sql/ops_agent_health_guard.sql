-- ═══════════════════════════════════════════════════════════
-- Agent Health Table Guard
-- ═══════════════════════════════════════════════════════════
-- Ensures agent_health table exists for scheduler health pings
-- Safe to run multiple times (idempotent)

create table if not exists public.agent_health (
  id uuid primary key default gen_random_uuid(),
  agent text not null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Index for fast latest-ping queries
create index if not exists idx_agent_health_agent_created
  on public.agent_health (agent, created_at desc);

-- Comment
comment on table public.agent_health is 'Scheduler health ping records for watchdog monitoring';
comment on column public.agent_health.agent is 'Agent name (e.g., FeedAgent, ScoringAgent, PromotionAgent)';
comment on column public.agent_health.details is 'Loop-specific details (loop type, cycle count, etc.)';
comment on column public.agent_health.created_at is 'Ping timestamp for staleness detection';
