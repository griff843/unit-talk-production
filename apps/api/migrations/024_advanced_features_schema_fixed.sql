-- Migration 024: Advanced Features Schema (Fixed for v3.0.0 compatibility)
-- Adds support for Steam Detection, Line Shopping, Injury Analysis, and Arbitrage Scanner
-- Compatible with existing v3.0.0 database architecture

-- ============================================================================
-- 1. CREATE UPDATE FUNCTION (if not exists)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. PLAYERS TABLE (already exists with compatible schema)
-- ============================================================================
-- Note: players table already exists and is compatible

-- ============================================================================
-- 3. STEAM_MOVES TABLE (Enhanced steam detection tracking)
-- ============================================================================
CREATE TABLE steam_moves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prop_id INTEGER NOT NULL REFERENCES raw_props(id) ON DELETE CASCADE,
    line_change NUMERIC(10,4) NOT NULL, -- Amount of line movement
    volume_delta NUMERIC(15,2) NOT NULL, -- Change in betting volume
    confidence_score NUMERIC(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    source VARCHAR(100) NOT NULL, -- Source of steam detection (book/feed)
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    -- Additional context fields
    previous_line NUMERIC(10,2),
    new_line NUMERIC(10,2),
    time_window_minutes INTEGER DEFAULT 5, -- Detection window
    significance_level VARCHAR(20) CHECK (significance_level IN ('low', 'medium', 'high', 'critical'))
);

-- Create indexes for performance
CREATE INDEX idx_steam_moves_prop_id ON steam_moves(prop_id);
CREATE INDEX idx_steam_moves_detected_at ON steam_moves(detected_at DESC);
CREATE INDEX idx_steam_moves_confidence ON steam_moves(confidence_score DESC);
CREATE INDEX idx_steam_moves_significance ON steam_moves(significance_level, detected_at DESC);

-- ============================================================================
-- 4. BEST_ODDS TABLE (Line shopping optimizer)
-- ============================================================================
CREATE TABLE best_odds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prop_id INTEGER NOT NULL REFERENCES raw_props(id) ON DELETE CASCADE,
    source VARCHAR(100) NOT NULL, -- Sportsbook name
    odds INTEGER NOT NULL, -- American odds format
    edge_pct NUMERIC(8,4), -- Edge percentage
    is_best_available BOOLEAN DEFAULT false,
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    -- Additional fields for comprehensive tracking
    book_limits JSONB, -- Betting limits for this book
    market_status VARCHAR(50) DEFAULT 'active', -- active, suspended, closed
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_best_odds_prop_id ON best_odds(prop_id);
CREATE INDEX idx_best_odds_is_best ON best_odds(is_best_available, edge_pct DESC) WHERE is_best_available = true;
CREATE INDEX idx_best_odds_captured_at ON best_odds(captured_at DESC);
CREATE INDEX idx_best_odds_source ON best_odds(source, captured_at DESC);

-- ============================================================================
-- 5. INJURY_IMPACTS TABLE (Enhanced injury analysis)
-- ============================================================================
CREATE TABLE injury_impacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    injury_type VARCHAR(100) NOT NULL,
    severity VARCHAR(50) CHECK (severity IN ('questionable', 'probable', 'doubtful', 'out', 'ir')),
    affected_props JSONB NOT NULL, -- Array of prop types affected
    impact_score NUMERIC(5,4) CHECK (impact_score >= 0 AND impact_score <= 1),
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    -- Additional context
    injury_description TEXT,
    expected_return_date DATE,
    source VARCHAR(100), -- Where injury was reported
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'updated')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_injury_impacts_player_id ON injury_impacts(player_id);
CREATE INDEX idx_injury_impacts_severity ON injury_impacts(severity, reported_at DESC);
CREATE INDEX idx_injury_impacts_status ON injury_impacts(status, reported_at DESC);
CREATE INDEX idx_injury_impacts_impact_score ON injury_impacts(impact_score DESC);

-- Add update trigger
CREATE TRIGGER update_injury_impacts_updated_at
    BEFORE UPDATE ON injury_impacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. ARBITRAGE_OPPORTUNITIES TABLE (Arbitrage scanner)
-- ============================================================================
CREATE TABLE arbitrage_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prop_ids INTEGER[] NOT NULL, -- Array of prop IDs involved
    combined_odds JSONB NOT NULL, -- Odds from each book involved
    profit_margin NUMERIC(8,4) NOT NULL CHECK (profit_margin > 0),
    expiry_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'executed', 'invalid')),

    -- Additional fields
    min_bet_amount NUMERIC(10,2),
    max_bet_amount NUMERIC(10,2),
    books_involved VARCHAR[] NOT NULL, -- Array of sportsbooks
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high')),
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_validated TIMESTAMP WITH TIME ZONE DEFAULT now(),

    -- Ensure we have at least 2 props for arbitrage
    CHECK (array_length(prop_ids, 1) >= 2),
    CHECK (array_length(books_involved, 1) >= 2)
);

-- Create indexes for performance
CREATE INDEX idx_arbitrage_opportunities_status ON arbitrage_opportunities(status, profit_margin DESC);
CREATE INDEX idx_arbitrage_opportunities_expiry ON arbitrage_opportunities(expiry_time) WHERE status = 'active';
CREATE INDEX idx_arbitrage_opportunities_profit ON arbitrage_opportunities(profit_margin DESC) WHERE status = 'active';
CREATE INDEX idx_arbitrage_opportunities_detected ON arbitrage_opportunities(detected_at DESC);

-- GIN index for prop_ids array searches
CREATE INDEX idx_arbitrage_opportunities_prop_ids ON arbitrage_opportunities USING GIN (prop_ids);

-- ============================================================================
-- 7. CREATE VIEWS FOR EFFICIENT QUERYING
-- ============================================================================

-- View for active steam moves with prop details
CREATE VIEW active_steam_moves AS
SELECT
    sm.*,
    rp.player_name,
    rp.sport,
    rp.stat_type,
    rp.line as current_line
FROM steam_moves sm
JOIN raw_props rp ON sm.prop_id = rp.id
WHERE sm.detected_at > now() - INTERVAL '24 hours'
ORDER BY sm.confidence_score DESC, sm.detected_at DESC;

-- View for best available odds per prop
CREATE VIEW current_best_odds AS
SELECT DISTINCT ON (prop_id)
    bo.*,
    rp.player_name,
    rp.sport,
    rp.stat_type
FROM best_odds bo
JOIN raw_props rp ON bo.prop_id = rp.id
WHERE bo.market_status = 'active'
ORDER BY prop_id, edge_pct DESC, captured_at DESC;

-- View for active injury impacts with player details
CREATE VIEW active_injury_impacts AS
SELECT
    ii.*,
    p.name as player_name,
    p.sport,
    p.team,
    p.position
FROM injury_impacts ii
JOIN players p ON ii.player_id = p.id
WHERE ii.status = 'active'
ORDER BY ii.impact_score DESC, ii.reported_at DESC;

-- View for profitable arbitrage opportunities
CREATE VIEW profitable_arbitrage AS
SELECT
    ao.*,
    array_length(ao.prop_ids, 1) as num_props,
    array_length(ao.books_involved, 1) as num_books
FROM arbitrage_opportunities ao
WHERE ao.status = 'active'
  AND ao.expiry_time > now()
  AND ao.profit_margin > 0.02 -- Minimum 2% profit margin
ORDER BY ao.profit_margin DESC;

-- ============================================================================
-- 8. ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE steam_moves IS 'Historical tracking of steam moves and line movements';
COMMENT ON TABLE best_odds IS 'Line shopping data with best available odds per sportsbook';
COMMENT ON TABLE injury_impacts IS 'Player injury tracking with impact analysis';
COMMENT ON TABLE arbitrage_opportunities IS 'Cross-market arbitrage opportunity detection';

COMMENT ON COLUMN steam_moves.confidence_score IS 'AI confidence in steam detection (0-1)';
COMMENT ON COLUMN best_odds.edge_pct IS 'Calculated edge percentage for this line';
COMMENT ON COLUMN injury_impacts.affected_props IS 'JSON array of prop types affected by injury';
COMMENT ON COLUMN arbitrage_opportunities.prop_ids IS 'Array of prop IDs involved in arbitrage';
COMMENT ON COLUMN arbitrage_opportunities.combined_odds IS 'JSON object with odds from each book';

-- Migration completed successfully
-- Next migration number: 025