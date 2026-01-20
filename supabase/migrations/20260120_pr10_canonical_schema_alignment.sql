-- PR10: Canonical Schema Alignment Migration
-- Purpose: Create all canonical tables required for E2E validation FULL PASS
-- Tables: users, games, unified_picks, smart_tickets, bridge_outbox, pick_publish, picks
-- Author: Release Integrity Engineer
-- Date: 2026-01-20

BEGIN;

-- ============================================================================
-- 1. USERS TABLE (Canonical Capper Registry)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    discord_id TEXT UNIQUE,
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'premium', 'vip', 'admin')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_tier ON public.users(tier);
CREATE INDEX IF NOT EXISTS idx_users_discord_id ON public.users(discord_id);

-- ============================================================================
-- 2. GAMES TABLE (Canonical Game Registry)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_game_id TEXT UNIQUE,
    league TEXT NOT NULL,
    sport TEXT NOT NULL DEFAULT 'NFL',
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    game_date DATE NOT NULL DEFAULT CURRENT_DATE,
    commence_time TIMESTAMPTZ,
    home_score INTEGER,
    away_score INTEGER,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'final', 'postponed', 'cancelled')),
    home_spread_odds NUMERIC(10,2),
    away_spread_odds NUMERIC(10,2),
    home_moneyline_odds NUMERIC(10,2),
    away_moneyline_odds NUMERIC(10,2),
    over_under_line NUMERIC(10,2),
    over_odds NUMERIC(10,2),
    under_odds NUMERIC(10,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_league ON public.games(league);
CREATE INDEX IF NOT EXISTS idx_games_game_date ON public.games(game_date);
CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);
CREATE INDEX IF NOT EXISTS idx_games_external_game_id ON public.games(external_game_id);

-- ============================================================================
-- 3. UNIFIED_PICKS TABLE (Canonical Pick Storage)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.unified_picks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
    bet_slip_id TEXT UNIQUE NOT NULL,
    pick_type TEXT NOT NULL CHECK (pick_type IN ('spread', 'moneyline', 'over_under', 'prop', 'parlay')),
    selection TEXT NOT NULL,
    odds NUMERIC(10,2) NOT NULL,
    stake NUMERIC(10,2),
    potential_payout NUMERIC(10,2),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'graded', 'won', 'lost', 'push', 'cancelled')),
    grade_result TEXT CHECK (grade_result IN ('win', 'loss', 'push', 'pending', 'cancelled')),
    graded_at TIMESTAMPTZ,
    confidence_score NUMERIC(5,2),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unified_picks_user_id ON public.unified_picks(user_id);
CREATE INDEX IF NOT EXISTS idx_unified_picks_game_id ON public.unified_picks(game_id);
CREATE INDEX IF NOT EXISTS idx_unified_picks_bet_slip_id ON public.unified_picks(bet_slip_id);
CREATE INDEX IF NOT EXISTS idx_unified_picks_status ON public.unified_picks(status);
CREATE INDEX IF NOT EXISTS idx_unified_picks_created_at ON public.unified_picks(created_at);

-- ============================================================================
-- 4. SMART_TICKETS TABLE (Canonical Smart Form Submissions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.smart_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bet_slip_id TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    capper_name TEXT NOT NULL,
    game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
    pick_data JSONB NOT NULL DEFAULT '{}',
    form_data JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'processing', 'validated', 'published', 'rejected')),
    validation_errors JSONB DEFAULT '[]',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_smart_tickets_bet_slip_id ON public.smart_tickets(bet_slip_id);
CREATE INDEX IF NOT EXISTS idx_smart_tickets_user_id ON public.smart_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_tickets_capper_name ON public.smart_tickets(capper_name);
CREATE INDEX IF NOT EXISTS idx_smart_tickets_status ON public.smart_tickets(status);
CREATE INDEX IF NOT EXISTS idx_smart_tickets_submitted_at ON public.smart_tickets(submitted_at);

-- ============================================================================
-- 5. BRIDGE_OUTBOX TABLE (Canonical Event Outbox)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bridge_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    event_payload JSONB NOT NULL,
    bet_slip_id TEXT,
    correlation_id UUID DEFAULT gen_random_uuid(),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    error_message TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bridge_outbox_status ON public.bridge_outbox(status);
CREATE INDEX IF NOT EXISTS idx_bridge_outbox_event_type ON public.bridge_outbox(event_type);
CREATE INDEX IF NOT EXISTS idx_bridge_outbox_bet_slip_id ON public.bridge_outbox(bet_slip_id);
CREATE INDEX IF NOT EXISTS idx_bridge_outbox_created_at ON public.bridge_outbox(created_at);
CREATE INDEX IF NOT EXISTS idx_bridge_outbox_pending ON public.bridge_outbox(status, created_at) WHERE status = 'pending';

-- ============================================================================
-- 6. PICK_PUBLISH TABLE (Canonical Discord Publish Outbox)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pick_publish (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pick_id UUID REFERENCES public.unified_picks(id) ON DELETE CASCADE,
    bet_slip_id TEXT NOT NULL,
    channel_id TEXT,
    message_id TEXT,
    embed_data JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'publishing', 'published', 'failed', 'retrying')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    error_message TEXT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(bet_slip_id)
);

CREATE INDEX IF NOT EXISTS idx_pick_publish_pick_id ON public.pick_publish(pick_id);
CREATE INDEX IF NOT EXISTS idx_pick_publish_bet_slip_id ON public.pick_publish(bet_slip_id);
CREATE INDEX IF NOT EXISTS idx_pick_publish_status ON public.pick_publish(status);
CREATE INDEX IF NOT EXISTS idx_pick_publish_pending ON public.pick_publish(status, created_at) WHERE status = 'pending';

-- ============================================================================
-- 7. PICKS TABLE (Legacy Compatibility - References unified_picks)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.picks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unified_pick_id UUID REFERENCES public.unified_picks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
    bet_slip_id TEXT UNIQUE,
    pick_type TEXT,
    selection TEXT,
    odds NUMERIC(10,2),
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_picks_unified_pick_id ON public.picks(unified_pick_id);
CREATE INDEX IF NOT EXISTS idx_picks_user_id ON public.picks(user_id);

-- ============================================================================
-- 8. SEED DATA FOR E2E TESTING
-- ============================================================================

-- Seed E2E Test Users
INSERT INTO public.users (id, username, email, discord_id, tier, status)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'griff843', 'griff@unittalk.com', '123456789012345678', 'vip', 'active'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'e2e_test_capper', 'e2e@test.com', '987654321098765432', 'premium', 'active'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'automation_bot', 'bot@test.com', '111222333444555666', 'admin', 'active')
ON CONFLICT (username) DO UPDATE SET
    tier = EXCLUDED.tier,
    status = EXCLUDED.status,
    updated_at = NOW();

-- Seed E2E Test Games
INSERT INTO public.games (id, external_game_id, league, sport, home_team, away_team, game_date, commence_time, status)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'e2e_nba_game_1', 'NBA', 'NBA', 'LOS_ANGELES_LAKERS_NBA', 'BOSTON_CELTICS_NBA', CURRENT_DATE, NOW() + INTERVAL '3 hours', 'scheduled'),
    ('22222222-2222-2222-2222-222222222222', 'e2e_nfl_game_1', 'NFL', 'NFL', 'KANSAS_CITY_CHIEFS_NFL', 'BUFFALO_BILLS_NFL', CURRENT_DATE, NOW() + INTERVAL '6 hours', 'scheduled'),
    ('33333333-3333-3333-3333-333333333333', 'e2e_mlb_game_1', 'MLB', 'MLB', 'NEW_YORK_YANKEES_MLB', 'LOS_ANGELES_DODGERS_MLB', CURRENT_DATE, NOW() + INTERVAL '9 hours', 'scheduled')
ON CONFLICT (external_game_id) DO UPDATE SET
    home_team = EXCLUDED.home_team,
    away_team = EXCLUDED.away_team,
    game_date = EXCLUDED.game_date,
    commence_time = EXCLUDED.commence_time,
    status = EXCLUDED.status,
    updated_at = NOW();

-- ============================================================================
-- 9. UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY['users', 'games', 'unified_picks', 'smart_tickets', 'bridge_outbox', 'pick_publish', 'picks'])
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON public.%s', tbl, tbl);
        EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON public.%s FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', tbl, tbl);
    END LOOP;
END;
$$;

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bridge_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pick_publish ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.picks ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for service role (E2E tests run with service role)
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY['users', 'games', 'unified_picks', 'smart_tickets', 'bridge_outbox', 'pick_publish', 'picks'])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS service_role_all_%s ON public.%s', tbl, tbl);
        EXECUTE format('CREATE POLICY service_role_all_%s ON public.%s FOR ALL TO service_role USING (true) WITH CHECK (true)', tbl, tbl);
    END LOOP;
END;
$$;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERY (Run after migration)
-- ============================================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('users', 'games', 'unified_picks', 'smart_tickets', 'bridge_outbox', 'pick_publish', 'picks')
-- ORDER BY table_name;
