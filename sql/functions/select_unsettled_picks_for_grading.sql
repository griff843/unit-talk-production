-- ============================================================================
-- Settlement Pipeline Database Function
-- Function to select unsettled picks for grading workflow
-- ============================================================================

CREATE OR REPLACE FUNCTION select_unsettled_picks_for_grading(
  p_league TEXT DEFAULT 'MLB',
  p_limit INTEGER DEFAULT 200,
  p_lookback_cutoff TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '24 hours'),
  p_final_buffer_cutoff TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '20 minutes')
)
RETURNS TABLE (
  id UUID,
  player TEXT,
  market TEXT,
  line NUMERIC,
  book TEXT,
  sport TEXT,
  team TEXT,
  event_time TIMESTAMPTZ,
  tier TEXT,
  confidence INTEGER,
  game_id UUID,
  game_status TEXT,
  game_start_time TIMESTAMPTZ,
  home_team TEXT,
  away_team TEXT,
  external_game_id TEXT,
  prop_id UUID,
  raw_prop_data JSONB
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH linked_picks AS (
    -- Priority 1: Picks with direct game linkage
    SELECT 
      sd.id,
      sd.player,
      sd.market,
      sd.line,
      sd.book,
      sd.sport,
      sd.team,
      sd.event_time,
      sd.tier,
      sd.confidence,
      sd.game_id,
      g.status as game_status,
      g.start_time as game_start_time,
      g.home_team,
      g.away_team,
      g.external_game_id,
      sd.prop_id,
      CASE 
        WHEN rp.id IS NOT NULL THEN 
          jsonb_build_object(
            'stat_type', rp.stat_type,
            'player_name', rp.player_name,
            'line', rp.line,
            'odds', rp.odds,
            'provider', rp.provider
          )
        ELSE NULL 
      END as raw_prop_data,
      1 as priority_order
    FROM shadow_decisions sd
    INNER JOIN games g ON sd.game_id = g.id
    LEFT JOIN raw_props rp ON sd.prop_id = rp.id
    WHERE sd.sport = p_league
      AND sd.settled_at IS NULL
      AND sd.event_time >= p_lookback_cutoff
      AND g.league = p_league
      AND (
        UPPER(g.status) LIKE 'FINAL%' OR 
        g.start_time < (NOW() - INTERVAL '6 hours')
      )
      AND g.start_time <= p_final_buffer_cutoff

    UNION ALL

    -- Priority 2: Picks without game linkage but with matchable teams
    SELECT 
      sd.id,
      sd.player,
      sd.market,
      sd.line,
      sd.book,
      sd.sport,
      sd.team,
      sd.event_time,
      sd.tier,
      sd.confidence,
      g.id as game_id,
      g.status as game_status,
      g.start_time as game_start_time,
      g.home_team,
      g.away_team,
      g.external_game_id,
      sd.prop_id,
      NULL as raw_prop_data,
      2 as priority_order
    FROM shadow_decisions sd
    LEFT JOIN games g ON (
      (LOWER(TRIM(sd.team)) = LOWER(TRIM(g.home_team)) OR 
       LOWER(TRIM(sd.team)) = LOWER(TRIM(g.away_team)))
      AND g.start_time BETWEEN sd.event_time - INTERVAL '1 day' AND sd.event_time + INTERVAL '1 day'
      AND g.league = p_league
      AND (
        UPPER(g.status) LIKE 'FINAL%' OR 
        g.start_time < (NOW() - INTERVAL '6 hours')
      )
      AND g.start_time <= p_final_buffer_cutoff
    )
    WHERE sd.sport = p_league
      AND sd.settled_at IS NULL
      AND sd.game_id IS NULL
      AND sd.team IS NOT NULL
      AND sd.event_time IS NOT NULL
      AND sd.event_time >= p_lookback_cutoff
      AND g.id IS NOT NULL
  ),
  ranked_picks AS (
    SELECT 
      lp.*,
      ROW_NUMBER() OVER (
        PARTITION BY lp.id 
        ORDER BY lp.priority_order, 
                 ABS(EXTRACT(EPOCH FROM (lp.game_start_time - lp.event_time)))
      ) as rn
    FROM linked_picks lp
  )
  SELECT 
    rp.id,
    rp.player,
    rp.market,
    rp.line,
    rp.book,
    rp.sport,
    rp.team,
    rp.event_time,
    rp.tier,
    rp.confidence,
    rp.game_id,
    rp.game_status,
    rp.game_start_time,
    rp.home_team,
    rp.away_team,
    rp.external_game_id,
    rp.prop_id,
    rp.raw_prop_data
  FROM ranked_picks rp
  WHERE rp.rn = 1
  ORDER BY rp.event_time ASC
  LIMIT p_limit;
END;
$$;