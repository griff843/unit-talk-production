-- ============================================================================
-- CANONICAL SCHEMA MIGRATION - IDEMPOTENT
-- Date: 2025-01-29
-- Purpose: Apply canonical picks/pick_publish schema to production Supabase
-- ============================================================================

-- Sanity check first
DO $$
BEGIN
  RAISE NOTICE 'Database: %, User: %', current_database(), current_user;
  RAISE NOTICE 'Picks table exists: %', to_regclass('public.picks');
  RAISE NOTICE 'Pick_publish table exists: %', to_regclass('public.pick_publish');
END $$;

-- ============================================================================
-- CANONICAL TABLES
-- ============================================================================

-- Picks table (canonical)
CREATE TABLE IF NOT EXISTS public.picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,                    -- capper id
  league text NOT NULL CHECK (league IN ('NBA','NFL','MLB','NHL','NCAAF','NCAAB','WNBA')),
  player_id uuid,
  player_name text NOT NULL,
  market_type text NOT NULL,                -- e.g., PLAYER_POINTS
  line numeric NOT NULL,
  side text NOT NULL CHECK (lower(side) IN ('over','under')),
  odds integer,
  game_id uuid,
  game_date date,
  prediction text,                          -- optional semantic note
  confidence numeric,                       -- 0..1
  reasoning text,
  bet_slip_id text,                         -- idempotency dimension
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text DEFAULT 'api',
  updated_at timestamptz,
  CONSTRAINT picks_tenant_fk CHECK (tenant_id IS NOT NULL)
);

-- Pick publish table (outbox pattern)
CREATE TABLE IF NOT EXISTS public.pick_publish (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id uuid NOT NULL REFERENCES public.picks(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  dedupe_key text,                           -- unique when present
  external_message_id text,                  -- Discord message id
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

-- ============================================================================
-- INDEXES (IDEMPOTENT)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_picks_tenant_created 
  ON public.picks (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_picks_league_created 
  ON public.picks (league, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_picks_game_created 
  ON public.picks (game_date, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pick_publish_status_created 
  ON public.pick_publish (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pick_publish_next_attempt 
  ON public.pick_publish (next_attempt_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pick_publish_dedupe 
  ON public.pick_publish (dedupe_key) WHERE dedupe_key IS NOT NULL;

-- ============================================================================
-- RLS POLICIES (STUBS - NOT ENABLED YET)
-- ============================================================================

DO $$
BEGIN
  -- Picks table policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
      AND tablename='picks' 
      AND policyname='tenant_isolation_picks'
  ) THEN
    CREATE POLICY tenant_isolation_picks ON public.picks 
      FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- Pick_publish table policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
      AND tablename='pick_publish' 
      AND policyname='tenant_isolation_pick_publish'
  ) THEN
    CREATE POLICY tenant_isolation_pick_publish ON public.pick_publish 
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================================
-- POSTGREST SCHEMA RELOAD
-- ============================================================================

SELECT pg_notify('pgrst', 'reload schema');

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration complete';
  RAISE NOTICE 'Picks table: %', to_regclass('public.picks');
  RAISE NOTICE 'Pick_publish table: %', to_regclass('public.pick_publish');
END $$;

