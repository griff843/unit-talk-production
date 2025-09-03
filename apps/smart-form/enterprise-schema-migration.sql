-- ============================================================================
-- UNIT TALK ENTERPRISE DATABASE SCHEMA
-- Fortune 100-Grade Production Schema with Full Referential Integrity
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- 1. CORE ENTITY TABLES (Foundation)
-- ============================================================================

-- Users table (Central user management)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discord_id TEXT UNIQUE,
    username TEXT NOT NULL,
    email TEXT UNIQUE,
    display_name TEXT,
    tier TEXT NOT NULL DEFAULT 'Free' CHECK (tier IN ('Free', 'Premium', 'VIP', 'VIP_Plus')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'banned')),
    subscription_expires_at TIMESTAMPTZ,
    last_active TIMESTAMPTZ DEFAULT NOW(),
    total_picks INTEGER DEFAULT 0,
    won_picks INTEGER DEFAULT 0,
    lost_picks INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 0.00 CHECK (win_rate >= 0 AND win_rate <= 100),
    total_profit DECIMAL(12,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ, -- Soft delete
    metadata JSONB DEFAULT '{}'
);

-- Teams table (Normalized team data)
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    abbreviation TEXT NOT NULL,
    city TEXT,
    league TEXT NOT NULL,
    division TEXT,
    conference TEXT,
    external_id TEXT UNIQUE,
    logo_url TEXT,
    primary_color TEXT,
    secondary_color TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

-- Players table (Normalized player data)
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id TEXT UNIQUE,
    name TEXT NOT NULL,
    position TEXT,
    jersey_number INTEGER,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    league TEXT NOT NULL,
    height_inches INTEGER,
    weight_lbs INTEGER,
    birth_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

-- Games table (Properly structured with foreign keys)
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id TEXT UNIQUE,
    external_game_id TEXT, -- For backward compatibility
    sport TEXT NOT NULL,
    league TEXT NOT NULL,
    season TEXT,
    week INTEGER,
    home_team_id UUID REFERENCES teams(id) ON DELETE RESTRICT,
    away_team_id UUID REFERENCES teams(id) ON DELETE RESTRICT,
    home_team TEXT NOT NULL, -- Denormalized for performance
    away_team TEXT NOT NULL, -- Denormalized for performance
    venue TEXT,
    game_date DATE NOT NULL,
    commence_time TIMESTAMPTZ NOT NULL,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'final', 'postponed', 'cancelled')),
    home_score INTEGER,
    away_score INTEGER,
    current_period TEXT,
    time_remaining TEXT,
    -- Betting lines
    spread DECIMAL(4,1),
    total DECIMAL(4,1),
    moneyline_home INTEGER,
    moneyline_away INTEGER,
    spread_odds INTEGER DEFAULT -110,
    total_over_odds INTEGER DEFAULT -110,
    total_under_odds INTEGER DEFAULT -110,
    -- Metadata
    source TEXT DEFAULT 'odds_api',
    source_event_id TEXT,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

-- ============================================================================
-- 2. PROPS AND BETTING TABLES
-- ============================================================================

-- Raw Props table (Properly structured with foreign keys)
CREATE TABLE IF NOT EXISTS raw_props (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id TEXT UNIQUE,
    external_game_id TEXT, -- For backward compatibility
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    player_name TEXT NOT NULL, -- Denormalized for performance
    team TEXT NOT NULL, -- Denormalized for performance
    opponent TEXT,
    sport TEXT NOT NULL,
    league TEXT NOT NULL,
    stat_type TEXT NOT NULL,
    market_type TEXT NOT NULL DEFAULT 'player_props',
    bet_type TEXT,
    line DECIMAL(8,2),
    over_odds INTEGER,
    under_odds INTEGER,
    odds INTEGER, -- For non-line bets
    outcome TEXT,
    direction TEXT CHECK (direction IN ('over', 'under', 'yes', 'no')),
    -- Timing
    game_time TIMESTAMPTZ,
    game_date DATE,
    -- Scoring and analysis
    confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
    edge_score INTEGER CHECK (edge_score >= 0 AND edge_score <= 100),
    trend_confidence INTEGER CHECK (trend_confidence >= 0 AND trend_confidence <= 100),
    matchup_quality INTEGER CHECK (matchup_quality >= 0 AND matchup_quality <= 100),
    line_value_score INTEGER CHECK (line_value_score >= 0 AND line_value_score <= 100),
    role_stability INTEGER CHECK (role_stability >= 0 AND role_stability <= 100),
    tier TEXT CHECK (tier IN ('S', 'A', 'B', 'C', 'D')),
    tier_tag TEXT,
    ev_percent DECIMAL(5,2),
    fair_odds INTEGER,
    -- Status and promotion
    is_valid BOOLEAN DEFAULT true,
    is_promoted BOOLEAN DEFAULT false,
    is_primary BOOLEAN DEFAULT true,
    is_alt_line BOOLEAN DEFAULT false,
    published BOOLEAN DEFAULT false,
    context_flag BOOLEAN DEFAULT false,
    promoted_to_picks BOOLEAN DEFAULT false,
    promoted_at TIMESTAMPTZ,
    unit_size DECIMAL(3,1) DEFAULT 1.0,
    -- Source and tracking
    provider TEXT NOT NULL,
    source TEXT NOT NULL,
    book TEXT,
    unique_key TEXT UNIQUE,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    outcomes JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}'
);

-- Final Picks table (User's actual picks)
CREATE TABLE IF NOT EXISTS unified_picks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    raw_prop_id UUID REFERENCES raw_props(id) ON DELETE SET NULL,
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE SET NULL,
    -- Pick details (denormalized for performance)
    player_name TEXT NOT NULL,
    team TEXT NOT NULL,
    opponent TEXT,
    sport TEXT NOT NULL,
    league TEXT NOT NULL,
    stat_type TEXT NOT NULL,
    line DECIMAL(8,2),
    direction TEXT NOT NULL CHECK (direction IN ('over', 'under', 'yes', 'no')),
    odds INTEGER NOT NULL,
    unit_size DECIMAL(3,1) DEFAULT 1.0,
    -- Status and results
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'push', 'cancelled')),
    result_value DECIMAL(8,2),
    profit_loss DECIMAL(10,2),
    settled_at TIMESTAMPTZ,
    -- Metadata
    notes TEXT,
    confidence INTEGER CHECK (confidence >= 1 AND confidence <= 10),
    tier TEXT CHECK (tier IN ('S', 'A', 'B', 'C', 'D')),
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

-- ============================================================================
-- 3. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_tier_status ON users(tier, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_active ON users(last_active) WHERE deleted_at IS NULL;

-- Teams indexes
CREATE INDEX IF NOT EXISTS idx_teams_league ON teams(league) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_teams_external_id ON teams(external_id) WHERE deleted_at IS NULL;

-- Players indexes
CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_players_league ON players(league) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_players_external_id ON players(external_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_players_name_trgm ON players USING gin(name gin_trgm_ops) WHERE deleted_at IS NULL;

-- Games indexes
CREATE INDEX IF NOT EXISTS idx_games_date_league ON games(game_date, league) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_games_commence_time ON games(commence_time) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_games_teams ON games(home_team_id, away_team_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_games_external_id ON games(external_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_games_external_game_id ON games(external_game_id) WHERE deleted_at IS NULL;

-- Raw Props indexes
CREATE INDEX IF NOT EXISTS idx_raw_props_game_id ON raw_props(game_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_raw_props_player_id ON raw_props(player_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_raw_props_sport_league ON raw_props(sport, league) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_raw_props_game_time ON raw_props(game_time) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_raw_props_promoted ON raw_props(is_promoted, promoted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_raw_props_tier ON raw_props(tier) WHERE deleted_at IS NULL AND tier IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_raw_props_external_game_id ON raw_props(external_game_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_raw_props_unique_key ON raw_props(unique_key) WHERE deleted_at IS NULL;

-- Final Picks indexes
CREATE INDEX IF NOT EXISTS idx_unified_picks_user_id ON unified_picks(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_unified_picks_game_id ON unified_picks(game_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_unified_picks_status ON unified_picks(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_unified_picks_created_at ON unified_picks(created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_unified_picks_sport_league ON unified_picks(sport, league) WHERE deleted_at IS NULL;

-- ============================================================================
-- 4. TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_raw_props_updated_at BEFORE UPDATE ON raw_props FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_unified_picks_updated_at BEFORE UPDATE ON unified_picks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_props ENABLE ROW LEVEL SECURITY;
ALTER TABLE unified_picks ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (can be customized based on your auth system)
CREATE POLICY "Users can view their own data" ON users FOR SELECT USING (auth.uid()::text = id::text);
CREATE POLICY "Public read access to teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Public read access to players" ON players FOR SELECT USING (true);
CREATE POLICY "Public read access to games" ON games FOR SELECT USING (true);
CREATE POLICY "Public read access to raw_props" ON raw_props FOR SELECT USING (true);
CREATE POLICY "Users can view their own picks" ON unified_picks FOR SELECT USING (auth.uid()::text = user_id::text);

-- ============================================================================
-- 6. DATA MIGRATION AND CLEANUP
-- ============================================================================

-- Migrate existing data to new structure
DO $$
BEGIN
    -- Update existing games to link to teams (if teams exist)
    UPDATE games SET
        home_team_id = (SELECT id FROM teams WHERE LOWER(teams.name) = LOWER(games.home_team) LIMIT 1),
        away_team_id = (SELECT id FROM teams WHERE LOWER(teams.name) = LOWER(games.away_team) LIMIT 1)
    WHERE home_team_id IS NULL OR away_team_id IS NULL;

    -- Update existing raw_props to link to games and players
    UPDATE raw_props SET
        game_id = (
            SELECT g.id FROM games g
            WHERE g.external_game_id = raw_props.external_game_id
            OR g.external_id = raw_props.external_game_id
            LIMIT 1
        )
    WHERE game_id IS NULL AND external_game_id IS NOT NULL;

    -- Link props to players by name matching
    UPDATE raw_props SET
        player_id = (
            SELECT p.id FROM players p
            WHERE LOWER(p.name) = LOWER(raw_props.player_name)
            AND p.league = raw_props.league
            LIMIT 1
        )
    WHERE player_id IS NULL AND player_name IS NOT NULL;

    -- Generate unique keys for props that don't have them
    UPDATE raw_props SET
        unique_key = CONCAT(
            COALESCE(external_game_id, game_id::text, 'no-game'),
            '-',
            COALESCE(player_name, 'no-player'),
            '-',
            COALESCE(stat_type, 'no-stat'),
            '-',
            COALESCE(line::text, 'no-line'),
            '-',
            COALESCE(provider, 'no-provider')
        )
    WHERE unique_key IS NULL;

    RAISE NOTICE 'Data migration completed successfully';
END $$;

-- ============================================================================
-- 7. VALIDATION AND REPORTING
-- ============================================================================

-- Validation queries
DO $$
DECLARE
    total_games INTEGER;
    linked_games INTEGER;
    total_props INTEGER;
    linked_props INTEGER;
    orphaned_props INTEGER;
BEGIN
    -- Count games
    SELECT COUNT(*) INTO total_games FROM games WHERE deleted_at IS NULL;
    SELECT COUNT(*) INTO linked_games FROM games WHERE home_team_id IS NOT NULL AND away_team_id IS NOT NULL AND deleted_at IS NULL;

    -- Count props
    SELECT COUNT(*) INTO total_props FROM raw_props WHERE deleted_at IS NULL;
    SELECT COUNT(*) INTO linked_props FROM raw_props WHERE game_id IS NOT NULL AND deleted_at IS NULL;
    SELECT COUNT(*) INTO orphaned_props FROM raw_props WHERE game_id IS NULL AND deleted_at IS NULL;

    RAISE NOTICE '=== MIGRATION VALIDATION REPORT ===';
    RAISE NOTICE 'Games: % total, % linked to teams (% %%)', total_games, linked_games, ROUND((linked_games::DECIMAL / NULLIF(total_games, 0)) * 100, 1);
    RAISE NOTICE 'Props: % total, % linked to games (% %%)', total_props, linked_props, ROUND((linked_props::DECIMAL / NULLIF(total_props, 0)) * 100, 1);
    RAISE NOTICE 'Orphaned props: %', orphaned_props;

    IF linked_props::DECIMAL / NULLIF(total_props, 0) > 0.8 THEN
        RAISE NOTICE '✅ MIGRATION SUCCESSFUL: >80%% props linked';
    ELSE
        RAISE NOTICE '⚠️  MIGRATION PARTIAL: <%80%% props linked - may need manual cleanup';
    END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE - ENTERPRISE READY
-- ============================================================================
