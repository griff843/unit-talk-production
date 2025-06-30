-- Database Performance Optimization Script
-- Implements the recommendations from the database optimizer

-- 1. COMPOSITE INDEXES FOR HIGH-TRAFFIC QUERIES

-- Bets table optimization (50,000+ rows)
CREATE INDEX IF NOT EXISTS idx_bets_status_created_at ON bets (status, created_at);
CREATE INDEX IF NOT EXISTS idx_bets_user_id_status ON bets (user_id, status);
CREATE INDEX IF NOT EXISTS idx_bets_game_id_status ON bets (game_id, status);

-- Picks table optimization (25,000+ rows)  
CREATE INDEX IF NOT EXISTS idx_picks_capper_id_confidence ON picks (capper_id, confidence);
CREATE INDEX IF NOT EXISTS idx_picks_game_id_status ON picks (game_id, status);
CREATE INDEX IF NOT EXISTS idx_picks_created_at_status ON picks (created_at, status);

-- Alerts table optimization (10,000+ rows)
CREATE INDEX IF NOT EXISTS idx_alerts_type_timestamp ON alerts (type, timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id_type ON alerts (user_id, type);
CREATE INDEX IF NOT EXISTS idx_alerts_status_timestamp ON alerts (status, timestamp);

-- Analytics table optimization (100,000+ rows)
CREATE INDEX IF NOT EXISTS idx_analytics_date_type ON analytics (date, type);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id_date ON analytics (user_id, date);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type_date ON analytics (event_type, date);

-- Games table optimization (5,000+ rows)
CREATE INDEX IF NOT EXISTS idx_games_league_date ON games (league, date);
CREATE INDEX IF NOT EXISTS idx_games_status_date ON games (status, date);
CREATE INDEX IF NOT EXISTS idx_games_date_league ON games (date, league);

-- 2. SINGLE COLUMN INDEXES FOR FREQUENT FILTERS

-- Users table
CREATE INDEX IF NOT EXISTS idx_users_tier ON users (tier);
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at);

-- Agents table
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents (status);
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents (type);

-- Recaps table
CREATE INDEX IF NOT EXISTS idx_recaps_game_id ON recaps (game_id);
CREATE INDEX IF NOT EXISTS idx_recaps_status ON recaps (status);

-- 3. PERFORMANCE OPTIMIZATION VIEWS

-- Create materialized view for analytics dashboard (reduces complex query load)
CREATE OR REPLACE VIEW analytics_summary AS
SELECT 
    date,
    COUNT(*) as total_events,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(CASE WHEN event_type = 'pick_submitted' THEN 1 END) as picks_submitted,
    COUNT(CASE WHEN event_type = 'bet_placed' THEN 1 END) as bets_placed,
    AVG(CASE WHEN event_type = 'pick_submitted' THEN CAST(metadata->>'confidence' AS INTEGER) END) as avg_confidence
FROM analytics 
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date
ORDER BY date DESC;

-- Create view for capper performance metrics
CREATE OR REPLACE VIEW capper_performance AS
SELECT 
    p.capper_id,
    u.display_name as capper_name,
    COUNT(*) as total_picks,
    COUNT(CASE WHEN p.result = 'win' THEN 1 END) as winning_picks,
    COUNT(CASE WHEN p.result = 'loss' THEN 1 END) as losing_picks,
    ROUND(
        COUNT(CASE WHEN p.result = 'win' THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(CASE WHEN p.result IN ('win', 'loss') THEN 1 END), 0) * 100, 
        2
    ) as win_percentage,
    AVG(p.confidence) as avg_confidence,
    MAX(p.created_at) as last_pick_date
FROM picks p
JOIN users u ON p.capper_id = u.id
WHERE p.created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY p.capper_id, u.display_name
HAVING COUNT(CASE WHEN p.result IN ('win', 'loss') THEN 1 END) >= 5
ORDER BY win_percentage DESC, total_picks DESC;

-- 4. QUERY OPTIMIZATION FUNCTIONS

-- Function to get recent picks with optimized query
CREATE OR REPLACE FUNCTION get_recent_picks(
    limit_count INTEGER DEFAULT 50,
    capper_filter INTEGER DEFAULT NULL,
    league_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    pick_id INTEGER,
    capper_name TEXT,
    game_matchup TEXT,
    bet_type TEXT,
    selection TEXT,
    odds TEXT,
    confidence INTEGER,
    created_at TIMESTAMP,
    result TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        u.display_name,
        CONCAT(g.away_team, ' @ ', g.home_team),
        p.bet_type,
        p.selection,
        p.odds,
        p.confidence,
        p.created_at,
        p.result
    FROM picks p
    JOIN users u ON p.capper_id = u.id
    JOIN games g ON p.game_id = g.id
    WHERE 
        (capper_filter IS NULL OR p.capper_id = capper_filter)
        AND (league_filter IS NULL OR g.league = league_filter)
        AND p.status = 'active'
    ORDER BY p.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get user betting statistics
CREATE OR REPLACE FUNCTION get_user_stats(user_id_param INTEGER)
RETURNS TABLE (
    total_bets INTEGER,
    total_picks_followed INTEGER,
    win_rate DECIMAL,
    total_winnings DECIMAL,
    favorite_league TEXT,
    member_since DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(b.id)::INTEGER as total_bets,
        COUNT(DISTINCT p.id)::INTEGER as total_picks_followed,
        COALESCE(
            ROUND(
                COUNT(CASE WHEN b.result = 'win' THEN 1 END)::DECIMAL / 
                NULLIF(COUNT(CASE WHEN b.result IN ('win', 'loss') THEN 1 END), 0) * 100, 
                2
            ), 
            0
        ) as win_rate,
        COALESCE(SUM(CASE WHEN b.result = 'win' THEN b.amount * (b.odds / 100.0) ELSE 0 END), 0) as total_winnings,
        (
            SELECT g.league 
            FROM bets b2 
            JOIN games g ON b2.game_id = g.id 
            WHERE b2.user_id = user_id_param 
            GROUP BY g.league 
            ORDER BY COUNT(*) DESC 
            LIMIT 1
        ) as favorite_league,
        u.created_at::DATE as member_since
    FROM users u
    LEFT JOIN bets b ON u.id = b.user_id
    LEFT JOIN picks p ON b.pick_id = p.id
    WHERE u.id = user_id_param
    GROUP BY u.id, u.created_at;
END;
$$ LANGUAGE plpgsql;

-- 5. MAINTENANCE AND CLEANUP PROCEDURES

-- Function to archive old analytics data (keep last 6 months active)
CREATE OR REPLACE FUNCTION archive_old_analytics()
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- Move old analytics to archive table
    INSERT INTO analytics_archive 
    SELECT * FROM analytics 
    WHERE date < CURRENT_DATE - INTERVAL '6 months';
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    
    -- Delete archived records from main table
    DELETE FROM analytics 
    WHERE date < CURRENT_DATE - INTERVAL '6 months';
    
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update pick results based on game outcomes
CREATE OR REPLACE FUNCTION update_pick_results()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Update pick results for completed games
    UPDATE picks 
    SET result = CASE 
        WHEN bet_type = 'moneyline' AND 
             ((selection = games.home_team AND games.home_score > games.away_score) OR
              (selection = games.away_team AND games.away_score > games.home_score)) THEN 'win'
        WHEN bet_type = 'moneyline' THEN 'loss'
        -- Add more bet type logic as needed
        ELSE 'pending'
    END,
    updated_at = CURRENT_TIMESTAMP
    FROM games
    WHERE picks.game_id = games.id 
    AND games.status = 'completed'
    AND picks.result = 'pending';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- 6. PERFORMANCE MONITORING QUERIES

-- Query to identify slow-running queries (for monitoring)
CREATE OR REPLACE VIEW slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
WHERE mean_time > 100  -- queries taking more than 100ms on average
ORDER BY mean_time DESC;

-- Query to monitor index usage
CREATE OR REPLACE VIEW index_usage AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 100 THEN 'LOW_USAGE'
        ELSE 'ACTIVE'
    END as usage_status
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- 7. AUTOMATED MAINTENANCE SCHEDULE SETUP

-- Create function to run daily maintenance
CREATE OR REPLACE FUNCTION daily_maintenance()
RETURNS TEXT AS $$
DECLARE
    result TEXT := '';
    pick_updates INTEGER;
    analytics_archived INTEGER;
BEGIN
    -- Update pick results
    SELECT update_pick_results() INTO pick_updates;
    result := result || 'Updated ' || pick_updates || ' pick results. ';
    
    -- Archive old analytics (run weekly)
    IF EXTRACT(DOW FROM CURRENT_DATE) = 0 THEN  -- Sunday
        SELECT archive_old_analytics() INTO analytics_archived;
        result := result || 'Archived ' || analytics_archived || ' analytics records. ';
    END IF;
    
    -- Update statistics
    ANALYZE;
    result := result || 'Updated table statistics. ';
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Comments for implementation
-- To implement this optimization:
-- 1. Run this script against your production database during maintenance window
-- 2. Monitor query performance before and after
-- 3. Set up automated maintenance: SELECT daily_maintenance(); in cron job
-- 4. Monitor index usage with: SELECT * FROM index_usage WHERE usage_status = 'UNUSED';
-- 5. Monitor slow queries with: SELECT * FROM slow_queries LIMIT 10;