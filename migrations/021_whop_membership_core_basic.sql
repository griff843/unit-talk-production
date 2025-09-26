-- 021_whop_membership_core_basic.sql
-- Minimal schema for Whop onboarding: tables and indexes only (no triggers)

-- Members directory
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id TEXT UNIQUE,
  discord_username TEXT,
  whop_user_id TEXT UNIQUE,
  whop_email TEXT,
  tier TEXT NOT NULL DEFAULT 'member' CHECK (tier IN ('trial','member','vip','vip_plus','capper','staff')),
  trial_started_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  tier_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_members_discord_user_id ON members(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_members_whop_user_id ON members(whop_user_id);

-- Membership events
CREATE TABLE IF NOT EXISTS membership_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'whop',
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  whop_user_id TEXT,
  discord_user_id TEXT,
  raw_event JSONB NOT NULL,
  parsed JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_membership_events_type_time ON membership_events(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_membership_events_whop_user ON membership_events(whop_user_id);

-- Onboarding state
CREATE TABLE IF NOT EXISTS onboarding_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id TEXT UNIQUE,
  track TEXT NOT NULL CHECK (track IN ('trial','member','vip','vip_plus','capper','staff')),
  step TEXT NOT NULL DEFAULT 'start_here',
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  last_dm_sent_at TIMESTAMPTZ,
  progress JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_state_track ON onboarding_state(track);

-- Role audit
CREATE TABLE IF NOT EXISTS role_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('assign','remove')),
  role_name TEXT NOT NULL,
  reason TEXT,
  requested_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_role_audit_user_time ON role_audit(discord_user_id, created_at DESC);

-- Reminder jobs
CREATE TABLE IF NOT EXISTS reminder_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('trial_expiring','trial_expired','upgrade_nudge','onboarding_followup')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','processing','done','failed','cancelled')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminder_jobs_status_time ON reminder_jobs(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_reminder_jobs_user ON reminder_jobs(discord_user_id);

