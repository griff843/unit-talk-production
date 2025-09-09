-- ============================================================================= 
-- SMART FORM PERFORMANCE OPTIMIZATION - FIXED VERSION
-- File: smart-form-optimization-fixed.sql
-- Date: September 5, 2025
-- Purpose: Optimize Smart Form auto-population queries for SaaS-level performance
-- Target: Reduce query time from 251ms to <25ms (10x improvement)
-- NOTE: Run each section separately in Supabase SQL Editor
-- =============================================================================

-- =============================================================================
-- SECTION 1: CREATE INDEXES (Run these one at a time)
-- =============================================================================

-- Smart Form primary lookup index (player, sport, stat_type with game time filter)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_props_smart_form_primary 
ON raw_props (player_name, sport, stat_type, game_time DESC) 
WHERE game_time > NOW() AND is_valid = TRUE;

-- Game time filtering index for upcoming games only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_props_upcoming_games 
ON raw_props (game_time, is_valid) 
WHERE game_time > NOW() AND is_valid = TRUE;

-- Sport and stat type filtering for dropdown population
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_props_sport_stat 
ON raw_props (sport, stat_type, game_time DESC) 
WHERE game_time > NOW() AND is_valid = TRUE;

-- Player name partial index for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_props_player_name 
ON raw_props (player_name) 
WHERE is_valid = TRUE;

-- =============================================================================
-- SECTION 2: CREATE MATERIALIZED VIEW (Run this after indexes)
-- =============================================================================

-- Drop existing materialized view if exists
DROP MATERIALIZED VIEW IF EXISTS smart_form_suggestions;

-- Create high-performance materialized view for Smart Form auto-population
CREATE MATERIALIZED VIEW smart_form_suggestions AS
SELECT 
    rp.id as prop_id,
    rp.player_name,
    rp.sport,
    rp.stat_type,
    rp.line,
    rp.over_odds,
    rp.under_odds,
    rp.game_time,
    rp.team,
    rp.opponent,
    
    -- Add aggregated statistics for better suggestions
    COALESCE(player_stats.avg_line, rp.line) as suggested_line,
    player_stats.recent_avg,
    player_stats.games_played,
    
    -- Add market context
    market_ctx.total_props_for_player,
    market_ctx.prop_variance,
    
    -- Add professional grading hints
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM unified_picks up 
            WHERE up.prop_id = rp.id 
            AND up.professional_score > 80
        ) THEN true 
        ELSE false 
    END as has_professional_grade,
    
    -- Performance ranking for sorting
    ROW_NUMBER() OVER (
        PARTITION BY rp.player_name, rp.stat_type 
        ORDER BY rp.game_time, market_ctx.total_props_for_player DESC
    ) as suggestion_rank

FROM raw_props rp

-- Join player recent performance stats
LEFT JOIN (
    SELECT 
        player_name,
        stat_type,
        AVG(line) as avg_line,
        AVG(CASE WHEN actual_stat IS NOT NULL THEN actual_stat END) as recent_avg,
        COUNT(*) as games_played
    FROM raw_props 
    WHERE game_time > NOW() - INTERVAL '30 days' 
    AND is_valid = TRUE
    GROUP BY player_name, stat_type
) player_stats ON rp.player_name = player_stats.player_name 
                 AND rp.stat_type = player_stats.stat_type

-- Join market context data
LEFT JOIN (
    SELECT 
        player_name,
        stat_type,
        COUNT(*) as total_props_for_player,
        STDDEV(line) as prop_variance
    FROM raw_props 
    WHERE game_time > NOW() - INTERVAL '7 days' 
    AND is_valid = TRUE
    GROUP BY player_name, stat_type
) market_ctx ON rp.player_name = market_ctx.player_name 
               AND rp.stat_type = market_ctx.stat_type

-- Filter to upcoming games only
WHERE rp.game_time > NOW() 
AND rp.is_valid = TRUE
AND rp.player_name IS NOT NULL
AND rp.stat_type IS NOT NULL

-- Order for optimal caching and access patterns
ORDER BY rp.game_time, rp.sport, rp.player_name;

-- =============================================================================
-- SECTION 3: CREATE INDEXES ON MATERIALIZED VIEW
-- =============================================================================

-- Primary Smart Form lookup index
CREATE INDEX idx_smart_form_suggestions_lookup 
ON smart_form_suggestions (player_name, sport, stat_type);

-- Game time index for chronological ordering
CREATE INDEX idx_smart_form_suggestions_time 
ON smart_form_suggestions (game_time) WHERE game_time > NOW();

-- Professional grade filtering
CREATE INDEX idx_smart_form_suggestions_professional 
ON smart_form_suggestions (has_professional_grade) WHERE has_professional_grade = true;

-- Suggestion ranking optimization
CREATE INDEX idx_smart_form_suggestions_rank 
ON smart_form_suggestions (player_name, stat_type, suggestion_rank);

-- =============================================================================
-- SECTION 4: CREATE REFRESH FUNCTION
-- =============================================================================

-- Create function to refresh Smart Form suggestions
CREATE OR REPLACE FUNCTION refresh_smart_form_suggestions() 
RETURNS void AS $$
BEGIN
    -- Refresh materialized view with new data
    REFRESH MATERIALIZED VIEW CONCURRENTLY smart_form_suggestions;
    
    -- Log refresh for monitoring
    INSERT INTO system_config (key, value, category, description)
    VALUES (
        'smart_form_last_refresh',
        to_jsonb(NOW()),
        'performance',
        'Last Smart Form suggestions refresh timestamp'
    )
    ON CONFLICT (key) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SECTION 5: ANALYZE TABLES FOR OPTIMIZATION
-- =============================================================================

-- Analyze tables for query planner optimization
ANALYZE raw_props;
ANALYZE smart_form_suggestions;

-- =============================================================================
-- SECTION 6: VALIDATE PERFORMANCE (Test Query)
-- =============================================================================

-- Test query performance (should be <25ms)
EXPLAIN (ANALYZE, BUFFERS) 
SELECT player_name, sport, stat_type, suggested_line, over_odds, under_odds, game_time
FROM smart_form_suggestions 
WHERE game_time > NOW()
ORDER BY game_time, suggestion_rank
LIMIT 50;

-- Performance validation summary
SELECT 
    'Smart Form Optimization Complete' as status,
    COUNT(*) as total_suggestions,
    COUNT(DISTINCT player_name) as unique_players,
    COUNT(DISTINCT sport) as sports_covered,
    MIN(game_time) as earliest_game,
    MAX(game_time) as latest_game,
    NOW() as completed_at
FROM smart_form_suggestions;

-- =============================================================================
-- USAGE EXAMPLES FOR SMART FORM QUERIES
-- =============================================================================

-- Example 1: Fast player auto-complete (<25ms)
/*
SELECT DISTINCT player_name 
FROM smart_form_suggestions 
WHERE player_name ILIKE 'lebron%'
ORDER BY player_name
LIMIT 10;
*/

-- Example 2: Get suggestions for specific sport (<25ms)
/*
SELECT player_name, stat_type, suggested_line, over_odds, under_odds, game_time
FROM smart_form_suggestions 
WHERE sport = 'NBA'
AND game_time > NOW()
ORDER BY game_time, suggestion_rank
LIMIT 50;
*/

-- Example 3: Get professional-graded suggestions (<25ms)
/*
SELECT player_name, stat_type, suggested_line, over_odds, under_odds
FROM smart_form_suggestions 
WHERE has_professional_grade = true
AND game_time > NOW()
ORDER BY suggestion_rank
LIMIT 25;
*/

-- =============================================================================
-- MONITORING QUERIES
-- =============================================================================

-- Check materialized view freshness:
/*
SELECT key, value->>'0' as last_refresh 
FROM system_config 
WHERE key = 'smart_form_last_refresh';
*/

-- Check index usage:
/*
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename IN ('raw_props', 'smart_form_suggestions')
ORDER BY idx_tup_read DESC;
*/

-- =============================================================================
-- NOTES FOR EXECUTION:
-- 
-- 1. Run Section 1 indexes one at a time (they run concurrently)
-- 2. Run Section 2 to create the materialized view
-- 3. Run Section 3 to create indexes on the view
-- 4. Run Section 4 to create the refresh function
-- 5. Run Section 5 to analyze tables
-- 6. Run Section 6 to test performance
--
-- The materialized view should be refreshed periodically (every 5-10 minutes)
-- during active betting hours for optimal performance.
-- =============================================================================