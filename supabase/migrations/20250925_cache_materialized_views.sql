-- Cache-First Architecture Materialized Views
-- Optimized materialized views for frequently accessed cache data patterns
-- Designed for <50ms query responses and automatic refresh strategies

-- ============================================================================
-- FREQUENTLY ACCESSED PICKS MATERIALIZED VIEWS
-- ============================================================================

-- Hot picks: Published picks from last 24 hours (most frequently accessed)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_hot_published_picks AS
SELECT 
    up.id,
    up.user_id,
    up.external_game_id,
    up.external_prop_id,
    up.sport,
    up.league,
    up.market,
    up.submarket,
    up.player_name,
    up.team,
    up.matchup,
    up.game_date,
    up.side,
    up.line,
    up.price,
    up.implied_prob,
    up.source,
    up.outcome,
    up.confidence,
    up.tier_when_placed,
    up.analysis,
    up.placed_at,
    up.posted_at,
    u.username,
    u.tier AS current_tier,
    u.discord_id
FROM public.unified_picks up
JOIN public.users u ON up.user_id = u.id
WHERE up.published = true
  AND up.posted_at >= NOW() - INTERVAL '24 hours'
  AND up.game_date >= NOW() - INTERVAL '12 hours'  -- Only upcoming/recent games
ORDER BY up.posted_at DESC, up.confidence DESC NULLS LAST;

-- Create indexes for hot picks materialized view
CREATE INDEX IF NOT EXISTS mv_hot_published_picks_posted_at_idx 
    ON public.mv_hot_published_picks (posted_at DESC);
CREATE INDEX IF NOT EXISTS mv_hot_published_picks_game_date_idx 
    ON public.mv_hot_published_picks (game_date);
CREATE INDEX IF NOT EXISTS mv_hot_published_picks_sport_idx 
    ON public.mv_hot_published_picks (sport);
CREATE INDEX IF NOT EXISTS mv_hot_published_picks_user_idx 
    ON public.mv_hot_published_picks (user_id);
CREATE INDEX IF NOT EXISTS mv_hot_published_picks_tier_idx 
    ON public.mv_hot_published_picks (current_tier);
CREATE INDEX IF NOT EXISTS mv_hot_published_picks_confidence_idx 
    ON public.mv_hot_published_picks (confidence DESC NULLS LAST);

-- Today's premium picks (S-tier cappers only)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_todays_premium_picks AS
WITH todays_date AS (
    SELECT CURRENT_DATE AS today
)
SELECT 
    up.id,
    up.user_id,
    up.external_game_id,
    up.sport,
    up.league,
    up.market,
    up.submarket,
    up.player_name,
    up.team,
    up.matchup,
    up.game_date,
    up.side,
    up.line,
    up.price,
    up.confidence,
    up.analysis,
    up.placed_at,
    up.posted_at,
    u.username,
    u.tier,
    ROW_NUMBER() OVER (PARTITION BY up.sport ORDER BY up.confidence DESC NULLS LAST, up.posted_at DESC) AS priority_rank
FROM public.unified_picks up
JOIN public.users u ON up.user_id = u.id
CROSS JOIN todays_date td
WHERE up.published = true
  AND u.tier = 'S'
  AND DATE(up.game_date) = td.today
  AND up.game_date >= NOW() - INTERVAL '2 hours'  -- Include games that just started
ORDER BY up.sport, priority_rank;

-- Indexes for premium picks
CREATE INDEX IF NOT EXISTS mv_todays_premium_picks_sport_rank_idx 
    ON public.mv_todays_premium_picks (sport, priority_rank);
CREATE INDEX IF NOT EXISTS mv_todays_premium_picks_game_date_idx 
    ON public.mv_todays_premium_picks (game_date);
CREATE INDEX IF NOT EXISTS mv_todays_premium_picks_user_idx 
    ON public.mv_todays_premium_picks (user_id);

-- User leaderboard with recent performance
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_capper_leaderboard AS
WITH recent_performance AS (
    SELECT 
        up.user_id,
        COUNT(*) AS total_picks_30d,
        COUNT(*) FILTER (WHERE up.status = 'won') AS wins_30d,
        COUNT(*) FILTER (WHERE up.status = 'lost') AS losses_30d,
        COUNT(*) FILTER (WHERE up.status IN ('won', 'lost')) AS settled_30d,
        ROUND(
            CASE 
                WHEN COUNT(*) FILTER (WHERE up.status IN ('won', 'lost')) > 0 
                THEN (COUNT(*) FILTER (WHERE up.status = 'won')::NUMERIC / COUNT(*) FILTER (WHERE up.status IN ('won', 'lost'))) * 100 
                ELSE 0 
            END, 2
        ) AS win_rate_30d,
        AVG(up.confidence) FILTER (WHERE up.confidence IS NOT NULL) AS avg_confidence,
        COUNT(*) FILTER (WHERE up.published = true) AS published_picks_30d
    FROM public.unified_picks up
    WHERE up.placed_at >= NOW() - INTERVAL '30 days'
    GROUP BY up.user_id
),
all_time_performance AS (
    SELECT 
        up.user_id,
        COUNT(*) AS total_picks_all_time,
        COUNT(*) FILTER (WHERE up.status = 'won') AS wins_all_time,
        COUNT(*) FILTER (WHERE up.status IN ('won', 'lost')) AS settled_all_time,
        ROUND(
            CASE 
                WHEN COUNT(*) FILTER (WHERE up.status IN ('won', 'lost')) > 0 
                THEN (COUNT(*) FILTER (WHERE up.status = 'won')::NUMERIC / COUNT(*) FILTER (WHERE up.status IN ('won', 'lost'))) * 100 
                ELSE 0 
            END, 2
        ) AS win_rate_all_time
    FROM public.unified_picks up
    GROUP BY up.user_id
)
SELECT 
    u.id AS user_id,
    u.username,
    u.tier,
    u.discord_id,
    u.created_at AS member_since,
    COALESCE(rp.total_picks_30d, 0) AS picks_30d,
    COALESCE(rp.wins_30d, 0) AS wins_30d,
    COALESCE(rp.losses_30d, 0) AS losses_30d,
    COALESCE(rp.settled_30d, 0) AS settled_30d,
    COALESCE(rp.win_rate_30d, 0) AS win_rate_30d,
    COALESCE(rp.avg_confidence, 0) AS avg_confidence_30d,
    COALESCE(rp.published_picks_30d, 0) AS published_30d,
    COALESCE(atp.total_picks_all_time, 0) AS picks_all_time,
    COALESCE(atp.wins_all_time, 0) AS wins_all_time,
    COALESCE(atp.settled_all_time, 0) AS settled_all_time,
    COALESCE(atp.win_rate_all_time, 0) AS win_rate_all_time,
    -- Composite score for ranking (weighted recent performance)
    ROUND(
        (COALESCE(rp.win_rate_30d, 0) * 0.6) + 
        (COALESCE(atp.win_rate_all_time, 0) * 0.3) + 
        (LEAST(COALESCE(rp.published_picks_30d, 0), 20) * 0.5) + -- Max 10 points for volume
        (CASE u.tier 
            WHEN 'S' THEN 10 
            WHEN 'A' THEN 7 
            WHEN 'B' THEN 5 
            WHEN 'C' THEN 3 
            ELSE 0 
        END), 2
    ) AS composite_score,
    ROW_NUMBER() OVER (ORDER BY 
        ROUND(
            (COALESCE(rp.win_rate_30d, 0) * 0.6) + 
            (COALESCE(atp.win_rate_all_time, 0) * 0.3) + 
            (LEAST(COALESCE(rp.published_picks_30d, 0), 20) * 0.5) +
            (CASE u.tier 
                WHEN 'S' THEN 10 
                WHEN 'A' THEN 7 
                WHEN 'B' THEN 5 
                WHEN 'C' THEN 3 
                ELSE 0 
            END), 2
        ) DESC
    ) AS rank
FROM public.users u
LEFT JOIN recent_performance rp ON u.id = rp.user_id
LEFT JOIN all_time_performance atp ON u.id = atp.user_id
WHERE u.tier IS NOT NULL
ORDER BY rank;

-- Indexes for leaderboard
CREATE INDEX IF NOT EXISTS mv_capper_leaderboard_rank_idx 
    ON public.mv_capper_leaderboard (rank);
CREATE INDEX IF NOT EXISTS mv_capper_leaderboard_tier_score_idx 
    ON public.mv_capper_leaderboard (tier, composite_score DESC);
CREATE INDEX IF NOT EXISTS mv_capper_leaderboard_win_rate_idx 
    ON public.mv_capper_leaderboard (win_rate_30d DESC);

-- ============================================================================
-- SMART FORM OPTIMIZATION VIEWS
-- ============================================================================

-- Recent games and props for smart form autocomplete
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_smart_form_data AS
WITH recent_games AS (
    SELECT DISTINCT
        external_game_id,
        sport,
        league,
        matchup,
        game_date,
        COUNT(*) OVER (PARTITION BY external_game_id) AS prop_count
    FROM public.unified_picks
    WHERE game_date >= NOW() - INTERVAL '3 days'
      AND game_date <= NOW() + INTERVAL '7 days'
),
recent_props AS (
    SELECT DISTINCT
        external_prop_id,
        external_game_id,
        sport,
        league,
        market,
        submarket,
        player_name,
        team,
        line,
        price,
        COUNT(*) OVER (PARTITION BY external_prop_id) AS usage_count
    FROM public.unified_picks
    WHERE posted_at >= NOW() - INTERVAL '7 days'
)
SELECT 
    COALESCE(rg.external_game_id, rp.external_game_id) AS external_game_id,
    COALESCE(rg.sport, rp.sport) AS sport,
    COALESCE(rg.league, rp.league) AS league,
    rg.matchup,
    rg.game_date,
    rg.prop_count,
    rp.external_prop_id,
    rp.market,
    rp.submarket,
    rp.player_name,
    rp.team,
    rp.line,
    rp.price,
    rp.usage_count,
    -- Search optimization fields
    LOWER(rp.player_name) AS player_name_lower,
    LOWER(rp.team) AS team_lower,
    LOWER(rg.matchup) AS matchup_lower,
    LOWER(rp.market || ' ' || COALESCE(rp.submarket, '')) AS market_search
FROM recent_games rg
FULL OUTER JOIN recent_props rp ON rg.external_game_id = rp.external_game_id
WHERE COALESCE(rg.game_date, NOW() + INTERVAL '1 day') >= NOW() - INTERVAL '3 days'
ORDER BY rg.game_date ASC NULLS LAST, rp.usage_count DESC NULLS LAST;

-- Trigram indexes for fast text search
CREATE INDEX IF NOT EXISTS mv_smart_form_data_player_trgm_idx 
    ON public.mv_smart_form_data USING gin (player_name_lower gin_trgm_ops);
CREATE INDEX IF NOT EXISTS mv_smart_form_data_team_trgm_idx 
    ON public.mv_smart_form_data USING gin (team_lower gin_trgm_ops);
CREATE INDEX IF NOT EXISTS mv_smart_form_data_matchup_trgm_idx 
    ON public.mv_smart_form_data USING gin (matchup_lower gin_trgm_ops);
CREATE INDEX IF NOT EXISTS mv_smart_form_data_market_trgm_idx 
    ON public.mv_smart_form_data USING gin (market_search gin_trgm_ops);

-- Regular indexes for filtering
CREATE INDEX IF NOT EXISTS mv_smart_form_data_sport_idx 
    ON public.mv_smart_form_data (sport);
CREATE INDEX IF NOT EXISTS mv_smart_form_data_game_date_idx 
    ON public.mv_smart_form_data (game_date);
CREATE INDEX IF NOT EXISTS mv_smart_form_data_usage_idx 
    ON public.mv_smart_form_data (usage_count DESC NULLS LAST);

-- ============================================================================
-- CACHE WARMING PRIORITY VIEW
-- ============================================================================

-- Cache warming priority based on access patterns
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_cache_warming_priority AS
WITH pick_access_patterns AS (
    SELECT 
        up.id,
        up.user_id,
        up.sport,
        up.published,
        up.tier_when_placed,
        up.posted_at,
        up.game_date,
        -- Simulate access count (in real system, this would come from actual metrics)
        CASE 
            WHEN up.published AND up.tier_when_placed = 'S' THEN 100
            WHEN up.published AND up.tier_when_placed = 'A' THEN 75
            WHEN up.published AND up.tier_when_placed = 'B' THEN 50
            WHEN up.published THEN 25
            ELSE 10
        END * 
        CASE 
            WHEN up.game_date >= NOW() THEN 2.0  -- Upcoming games get priority
            WHEN up.game_date >= NOW() - INTERVAL '6 hours' THEN 1.5  -- Recent games
            ELSE 1.0
        END AS estimated_access_score
    FROM public.unified_picks up
    WHERE up.posted_at >= NOW() - INTERVAL '7 days'
      AND up.game_date >= NOW() - INTERVAL '12 hours'
),
user_popularity AS (
    SELECT 
        u.id,
        u.username,
        u.tier,
        COUNT(up.id) AS total_published,
        AVG(pap.estimated_access_score) AS avg_access_score
    FROM public.users u
    JOIN public.unified_picks up ON u.id = up.user_id
    JOIN pick_access_patterns pap ON up.id = pap.id
    WHERE up.published = true
    GROUP BY u.id, u.username, u.tier
)
SELECT 
    pap.id AS pick_id,
    pap.user_id,
    pap.sport,
    pap.posted_at,
    pap.game_date,
    pap.estimated_access_score,
    up.avg_access_score AS user_avg_score,
    -- Cache warming priority score
    ROUND(
        pap.estimated_access_score * 
        (1 + (up.avg_access_score / 100)) * 
        CASE 
            WHEN pap.game_date >= NOW() AND pap.game_date <= NOW() + INTERVAL '24 hours' THEN 3.0
            WHEN pap.game_date >= NOW() AND pap.game_date <= NOW() + INTERVAL '3 days' THEN 2.0
            WHEN pap.posted_at >= NOW() - INTERVAL '6 hours' THEN 2.5  -- Fresh picks
            ELSE 1.0
        END, 2
    ) AS warming_priority,
    -- Suggested cache keys to warm
    ARRAY[
        'unified_picks:pick:' || pap.id,
        'unified_picks:user_picks:' || pap.user_id,
        'unified_picks:daily_picks:' || DATE(pap.game_date)
    ] AS suggested_cache_keys,
    ROW_NUMBER() OVER (ORDER BY 
        ROUND(
            pap.estimated_access_score * 
            (1 + (up.avg_access_score / 100)) * 
            CASE 
                WHEN pap.game_date >= NOW() AND pap.game_date <= NOW() + INTERVAL '24 hours' THEN 3.0
                WHEN pap.game_date >= NOW() AND pap.game_date <= NOW() + INTERVAL '3 days' THEN 2.0
                WHEN pap.posted_at >= NOW() - INTERVAL '6 hours' THEN 2.5
                ELSE 1.0
            END, 2
        ) DESC
    ) AS priority_rank
FROM pick_access_patterns pap
JOIN user_popularity up ON pap.user_id = up.id
ORDER BY priority_rank
LIMIT 1000;  -- Top 1000 items for warming

-- Index for warming priority
CREATE INDEX IF NOT EXISTS mv_cache_warming_priority_rank_idx 
    ON public.mv_cache_warming_priority (priority_rank);
CREATE INDEX IF NOT EXISTS mv_cache_warming_priority_score_idx 
    ON public.mv_cache_warming_priority (warming_priority DESC);

-- ============================================================================
-- REFRESH FUNCTIONS AND AUTOMATION
-- ============================================================================

-- Function to refresh all cache-related materialized views
CREATE OR REPLACE FUNCTION public.refresh_cache_materialized_views() RETURNS TEXT AS $$
DECLARE
    v_start_time TIMESTAMPTZ := NOW();
    v_result TEXT := '';
BEGIN
    -- Refresh hot published picks (most critical)
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_hot_published_picks;
        v_result := v_result || 'mv_hot_published_picks: OK, ';
    EXCEPTION WHEN OTHERS THEN
        REFRESH MATERIALIZED VIEW public.mv_hot_published_picks;
        v_result := v_result || 'mv_hot_published_picks: FALLBACK, ';
    END;
    
    -- Refresh today's premium picks
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_todays_premium_picks;
        v_result := v_result || 'mv_todays_premium_picks: OK, ';
    EXCEPTION WHEN OTHERS THEN
        REFRESH MATERIALIZED VIEW public.mv_todays_premium_picks;
        v_result := v_result || 'mv_todays_premium_picks: FALLBACK, ';
    END;
    
    -- Refresh leaderboard (less frequent)
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_capper_leaderboard;
        v_result := v_result || 'mv_capper_leaderboard: OK, ';
    EXCEPTION WHEN OTHERS THEN
        REFRESH MATERIALIZED VIEW public.mv_capper_leaderboard;
        v_result := v_result || 'mv_capper_leaderboard: FALLBACK, ';
    END;
    
    -- Refresh smart form data
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_smart_form_data;
        v_result := v_result || 'mv_smart_form_data: OK, ';
    EXCEPTION WHEN OTHERS THEN
        REFRESH MATERIALIZED VIEW public.mv_smart_form_data;
        v_result := v_result || 'mv_smart_form_data: FALLBACK, ';
    END;
    
    -- Refresh warming priority (least frequent)
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_cache_warming_priority;
        v_result := v_result || 'mv_cache_warming_priority: OK';
    EXCEPTION WHEN OTHERS THEN
        REFRESH MATERIALIZED VIEW public.mv_cache_warming_priority;
        v_result := v_result || 'mv_cache_warming_priority: FALLBACK';
    END;
    
    v_result := v_result || ' (Total time: ' || EXTRACT(EPOCH FROM (NOW() - v_start_time))::TEXT || 's)';
    
    -- Log the refresh
    INSERT INTO public.cache_warming_log (
        strategy_id, 
        started_at, 
        completed_at, 
        status, 
        execution_time_ms,
        metadata
    ) VALUES (
        'materialized_view_refresh',
        v_start_time,
        NOW(),
        'completed',
        EXTRACT(EPOCH FROM (NOW() - v_start_time)) * 1000,
        jsonb_build_object('result', v_result)
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to refresh only critical views (for high-frequency updates)
CREATE OR REPLACE FUNCTION public.refresh_critical_cache_views() RETURNS TEXT AS $$
DECLARE
    v_start_time TIMESTAMPTZ := NOW();
    v_result TEXT := '';
BEGIN
    -- Only refresh the most critical views that change frequently
    
    -- Hot published picks
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_hot_published_picks;
        v_result := v_result || 'mv_hot_published_picks: OK, ';
    EXCEPTION WHEN OTHERS THEN
        REFRESH MATERIALIZED VIEW public.mv_hot_published_picks;
        v_result := v_result || 'mv_hot_published_picks: FALLBACK, ';
    END;
    
    -- Today's premium picks
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_todays_premium_picks;
        v_result := v_result || 'mv_todays_premium_picks: OK';
    EXCEPTION WHEN OTHERS THEN
        REFRESH MATERIALIZED VIEW public.mv_todays_premium_picks;
        v_result := v_result || 'mv_todays_premium_picks: FALLBACK';
    END;
    
    v_result := v_result || ' (Time: ' || EXTRACT(EPOCH FROM (NOW() - v_start_time))::TEXT || 's)';
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON MATERIALIZED VIEW public.mv_hot_published_picks IS 
'Hot cache for published picks from last 24 hours - refresh every 15 minutes';

COMMENT ON MATERIALIZED VIEW public.mv_todays_premium_picks IS 
'S-tier capper picks for today only - refresh every 30 minutes';

COMMENT ON MATERIALIZED VIEW public.mv_capper_leaderboard IS 
'Capper performance leaderboard with 30-day and all-time stats - refresh every 2 hours';

COMMENT ON MATERIALIZED VIEW public.mv_smart_form_data IS 
'Optimized data for Smart Form autocomplete and suggestions - refresh every hour';

COMMENT ON MATERIALIZED VIEW public.mv_cache_warming_priority IS 
'Priority-ordered list for cache warming strategies - refresh every 4 hours';

COMMENT ON FUNCTION public.refresh_cache_materialized_views IS 
'Refreshes all cache-related materialized views - run every 30 minutes';

COMMENT ON FUNCTION public.refresh_critical_cache_views IS 
'Refreshes only critical materialized views - run every 5 minutes';