create table if not exists invite_intents (
  code text primary key,
  role_intent text not null check (role_intent in ('member','trial','vip','vip_plus','capper','staff')),
  created_by text not null,
  note text,
  max_uses int not null default 1,
  expires_at timestamptz,
  used_count int not null default 0,
  created_at timestamptz default now()
);

create table if not exists invite_joins (
  id uuid primary key default uuid_generate_v4(),
  code text not null references invite_intents(code),
  discord_id text not null,
  joined_at timestamptz default now(),
  processed boolean default false,
  meta jsonb
);

create table if not exists role_requests (
  id uuid primary key default uuid_generate_v4(),
  discord_id text not null,
  requested_role text not null check (requested_role in ('capper','staff')),
  source_code text references invite_intents(code),
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  approved_by text,
  approved_at timestamptz,
  metadata jsonb,
  created_at timestamptz default now()
);

create table if not exists scheduled_messages (
  id uuid primary key default uuid_generate_v4(),
  discord_id text not null,
  send_at timestamptz not null,
  template_key text not null,
  payload jsonb,
  sent_at timestamptz,
  status text not null default 'queued' check (status in ('queued','sent','failed','canceled')),
  fail_reason text
);
create index if not exists idx_sched_msgs_due on scheduled_messages (send_at) where status='queued';

