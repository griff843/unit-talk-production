-- Onboarding V2 hardening migration (idempotent)
-- Creates staff_access_codes and guards optional indexes behind IF EXISTS checks

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.staff_access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT NOT NULL,
  created_by TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  max_attempts INT NOT NULL DEFAULT 3,
  attempts INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', -- active|used|revoked|expired
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  discord_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_staff_access_codes_updated_at'
  ) THEN
    CREATE TRIGGER trg_staff_access_codes_updated_at
    BEFORE UPDATE ON public.staff_access_codes
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Optional indexes if tables exist in this project
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='invite_intents'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_intents_code_unique ON public.invite_intents (code);
    CREATE INDEX IF NOT EXISTS idx_invite_intents_role_expires ON public.invite_intents (role_intent, expires_at);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='role_requests'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_role_requests_one_pending_per_user
      ON public.role_requests (discord_id) WHERE status = 'pending';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='scheduled_messages'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_messages_idempotent ON public.scheduled_messages (idempotency_key);
  END IF;
END $$;

-- Convenience view or function stubs can be added here as needed

