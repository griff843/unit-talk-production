-- 028_smart_form_bridge.sql
-- Purpose: Create Smart Form tables and align bridge_outbox/unified_picks schema for Phase 2 routing
-- Safe/idempotent: uses IF NOT EXISTS and adds columns conditionally

BEGIN;

-- 1) smart_tickets authoritative table (used by Smart Form UI/API)
CREATE TABLE IF NOT EXISTS public.smart_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_slip_id TEXT UNIQUE NOT NULL,
  capper TEXT NOT NULL,
  ticket_type TEXT NOT NULL CHECK (ticket_type IN ('single','parlay','teaser','round_robin')),
  sport TEXT NOT NULL,
  game_date DATE NOT NULL,
  user_tier TEXT NOT NULL CHECK (user_tier IN ('free','vip','vip_plus')),
  unit_size NUMERIC(4,1) NOT NULL CHECK (unit_size >= 0.5 AND unit_size <= 10.0),
  odds_format TEXT NOT NULL CHECK (odds_format IN ('AMERICAN','DECIMAL','FRACTIONAL')),
  auto_parlay BOOLEAN DEFAULT TRUE,
  confidence_level INTEGER NOT NULL CHECK (confidence_level BETWEEN 1 AND 10),
  bet_type TEXT NOT NULL,
  market_type TEXT NOT NULL CHECK (market_type IN ('pre_game','live','player_prop','team_prop','game_prop','futures')),
  game_selections JSONB NOT NULL DEFAULT '[]'::jsonb,
  legs JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','submitted','processing','completed','error')),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  timezone TEXT DEFAULT 'UTC',
  current_step INTEGER DEFAULT 1,
  completed_steps INTEGER[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) bridge_outbox table (idempotent outbox for bridge events)
-- Use the ACTUAL schema used by API types: event_data + retry_count
CREATE TABLE IF NOT EXISTS public.bridge_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_slip_id TEXT,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

-- Optional boolean flag some health checks reference
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='bridge_outbox' AND column_name='processed'
  ) THEN
    ALTER TABLE public.bridge_outbox ADD COLUMN processed BOOLEAN GENERATED ALWAYS AS (processed_at IS NOT NULL) STORED;
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_bridge_outbox_status_created ON public.bridge_outbox(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bridge_outbox_bet_slip ON public.bridge_outbox(bet_slip_id);

-- 3) Align unified_picks for FeedAgent writes (bookmaker_key used in pipeline)
ALTER TABLE IF EXISTS public.unified_picks
  ADD COLUMN IF NOT EXISTS bookmaker_key TEXT;

-- 4) Refresh PostgREST schema cache (Supabase)
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

COMMIT;

