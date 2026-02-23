import { supabase } from './supabase';
import { formatTimeInEST } from './betting-utils';

// SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Renamed to avoid conflict with canonical DB types
export interface QueryCapper {
  id: string;
  name: string;
  active: boolean;
}

export interface QueryTeam {
  id: string;
  name: string;
  sport: string;
  abbr: string;
  // SPRINT-RUNTIME-TRUTH-008: active removed (not in current schema)
}

export interface QueryPlayer {
  id: string;
  full_name: string; // SPRINT-RUNTIME-TRUTH-008: renamed from 'name'
  team_id: string | null;
  sport: string;
  active: boolean | null;
  position: string | null;
}

export interface QueryGame {
  id: string;
  sport: string;
  home_team_id: string;
  away_team_id: string;
  game_date: string;
  game_time: string;
  status: string;
}

export interface QueryRawProp {
  id: string;
  game_id: string;
  player_id?: string;
  team_id?: string;
  prop_type: string;
  market_type: string;
  line: number;
  odds: number;
  status: string;
}

// SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Legacy aliases for backward compatibility
export type Capper = QueryCapper;
export type Team = QueryTeam;
export type Player = QueryPlayer;

// Type for user row data
interface UserRow {
  id: string;
  username: string;
  tier: string | null;
  discord_id: string | null;
  active: boolean;
}

// Fetch active cappers from v3.0.0 unified users table
// CANONICAL CONTRACT: users.active BOOLEAN NOT NULL - see USERS_CANONICAL_CONTRACT.md
export const fetchCappers = async () => {
  console.log('🔍 fetchCappers: Querying production users table with canonical active column...');

  // FAIL-CLOSED: Query the canonical active column explicitly
  const { data, error } = (await (supabase.from('users') as any)
    .select('id, username, tier, discord_id, active')
    .neq('username', 'System') // Exclude system user
    .eq('active', true) // Only fetch active cappers
    .order('username')) as { data: UserRow[] | null; error: any };

  // FAIL-CLOSED: If database query fails, throw error - no fallback data
  if (error) {
    console.error('🔍 fetchCappers: Database error:', error);
    throw new Error(
      `Database query failed: ${error.message}. Cannot use fallback data per FAIL-CLOSED contract.`
    );
  }

  // FAIL-CLOSED: Validate that active column exists in response
  if (data && data.length > 0 && typeof data[0].active !== 'boolean') {
    console.error('🔍 fetchCappers: SCHEMA VIOLATION - active column missing or invalid type');
    throw new Error(
      'SCHEMA VIOLATION: users.active column missing or invalid type. Canonical contract requires BOOLEAN.'
    );
  }

  console.log('🔍 fetchCappers: Found', data?.length || 0, 'active cappers');

  // Transform to match expected Capper interface
  // FAIL-CLOSED: active must be explicitly boolean from database, no fallback
  const transformedData = (data || []).map(user => ({
    id: user.id,
    name: user.username,
    active: user.active, // FAIL-CLOSED: No fallback - column is required
    tier: user.tier || 'VIP+',
    discord_id: user.discord_id,
    stats: {
      winRate: 68,
      roi: 12.5,
      lastPick: '2 hours ago',
      isLive: Math.random() > 0.5,
    },
  })) as Capper[];

  return transformedData;
};

// Fetch teams by sport
// SPRINT-RUNTIME-TRUTH-008: Removed .eq('active', true) - teams table has no active column
export const fetchTeams = async (sport: string) => {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, sport, abbr')
    .eq('sport', sport)
    .order('name');

  if (error) throw error;
  return data as QueryTeam[];
};

// Search teams
// SPRINT-RUNTIME-TRUTH-008: Removed .eq('active', true) - teams table has no active column
export const searchTeams = async (query: string, sport: string) => {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, sport, abbr')
    .eq('sport', sport)
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(10);

  if (error) throw error;
  return data as QueryTeam[];
};

// Fetch players by team
// SPRINT-RUNTIME-TRUTH-008: Changed order from 'name' to 'full_name'
export const fetchPlayers = async (teamId: string) => {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('team_id', teamId)
    .eq('active', true)
    .order('full_name');

  if (error) throw error;
  return data as QueryPlayer[];
};

// Search players
// SPRINT-RUNTIME-TRUTH-008: Changed 'name' to 'full_name', using type assertion for join
export const searchPlayers = async (query: string, sport: string) => {
  const { data, error } = await (supabase as any)
    .from('players')
    .select('*, teams!inner(*)')
    .eq('sport', sport)
    .eq('active', true)
    .ilike('full_name', `%${query}%`)
    .order('full_name')
    .limit(10);

  if (error) throw error;
  return data as (QueryPlayer & { teams: QueryTeam })[];
};

// Fetch games by sport and date range
export const fetchGames = async (sport: string, startDate: string, endDate: string) => {
  console.log('🔍 fetchGames: Querying games table for', sport, 'from', startDate, 'to', endDate);

  try {
    // Map front-end sport names to database league values
    const sportToLeagueMap: { [key: string]: string } = {
      MLB: 'MLB',
      NBA: 'NBA',
      NFL: 'NFL',
      NHL: 'NHL',
      NCAAB: 'NCAAB',
      NCAAF: 'NCAAF',
    };

    const league = sportToLeagueMap[sport] || sport;

    // Try multiple query variations to handle different schema possibilities
    let data = null;
    let error = null;

    // First attempt: Try with 'sport' column
    const result1 = await supabase
      .from('games')
      .select('*')
      .eq('sport', league)
      .eq('game_date', startDate)
      .order('game_date')
      .order('start_time');

    if (!result1.error && result1.data) {
      data = result1.data;
    } else {
      console.log(
        '🔍 fetchGames: First query failed, trying with league column:',
        result1.error?.message
      );

      // Second attempt: Try with 'league' column
      const result2 = await supabase
        .from('games')
        .select('*')
        .eq('league', league)
        .eq('game_date', startDate)
        .order('game_date');

      if (!result2.error && result2.data) {
        data = result2.data;
      } else {
        console.log(
          '🔍 fetchGames: Second query failed, trying simplified query:',
          result2.error?.message
        );

        // Third attempt: Simplified query just by date
        const result3 = await supabase
          .from('games')
          .select('*')
          .eq('game_date', startDate)
          .order('game_date');

        if (!result3.error && result3.data) {
          // Filter by sport client-side if database structure doesn't support it
          data = result3.data.filter(
            (game: any) =>
              game.sport === league ||
              game.league === league ||
              (game.home_team && game.home_team.includes(league.substring(0, 3)))
          );
        } else {
          error = result3.error;
        }
      }
    }

    // V1.1 COMPLIANCE: No mock fallback - return empty array on error
    if (error && !data) {
      console.error('🔍 fetchGames: All queries failed, no mock fallback per V1.1 spec:', error);
      return [];
    }

    console.log('🔍 fetchGames: Found', data?.length || 0, 'games for', sport, 'on', startDate);

    // Transform the data to standardize team names, times, odds, and live status
    const transformedData = data
      ?.map(game => {
        // Standardize team names - use consistent format with proper team name mapping
        const getTeamName = (teamCode: string) => {
          const teamMap: { [key: string]: string } = {
            TOR_MLB: 'Toronto Blue Jays',
            BAL_MLB: 'Baltimore Orioles',
            NYY_MLB: 'New York Yankees',
            BOS_MLB: 'Boston Red Sox',
            TB_MLB: 'Tampa Bay Rays',
            LAD_MLB: 'Los Angeles Dodgers',
            SF_MLB: 'San Francisco Giants',
            CHC_MLB: 'Chicago Cubs',
            MIL_MLB: 'Milwaukee Brewers',
            ATL_MLB: 'Atlanta Braves',
            KC_MLB: 'Kansas City Royals',
            PHI_MLB: 'Philadelphia Phillies',
            CWS_MLB: 'Chicago White Sox',
            MIA_MLB: 'Miami Marlins',
            STL_MLB: 'St. Louis Cardinals',
            CIN_MLB: 'Cincinnati Reds',
            ARI_MLB: 'Arizona Diamondbacks',
            DET_MLB: 'Detroit Tigers',
            PIT_MLB: 'Pittsburgh Pirates',
            SEA_MLB: 'Seattle Mariners',
            OAK_MLB: 'Oakland Athletics',
            CLE_MLB: 'Cleveland Guardians',
            MIN_MLB: 'Minnesota Twins',
          };
          return teamMap[teamCode] || teamCode;
        };

        const home_team_name = game.home_team_meta?.names?.long || getTeamName(game.home_team);
        const away_team_name = game.away_team_meta?.names?.long || getTeamName(game.away_team);
        const home_team_short =
          game.home_team_meta?.names?.short || game.home_team_meta?.names?.medium || game.home_team;
        const away_team_short =
          game.away_team_meta?.names?.short || game.away_team_meta?.names?.medium || game.away_team;

        // Format game time - convert to user's local timezone
        let formatted_time = null;
        let display_time = null;
        let is_live = false;

        if (game.commence_time || game.start_time) {
          // Prefer commence_time as it has correct times, fallback to start_time
          let gameTimeStr = game.commence_time || game.start_time;

          // Handle timezone conversion properly
          if (
            game.commence_time &&
            !game.commence_time.includes('Z') &&
            !game.commence_time.includes('+') &&
            !game.commence_time.includes('-')
          ) {
            // If no timezone info, treat as UTC (which is what the database stores)
            gameTimeStr = game.commence_time + 'Z';
          }

          const gameTime = new Date(gameTimeStr);
          const currentTime = new Date();

          // Format display times in EST timezone
          formatted_time = formatTimeInEST(gameTime) + ' EST';
          display_time = formatTimeInEST(gameTime);

          // Determine if game is live - FIXED LOGIC
          const timeDiff = currentTime.getTime() - gameTime.getTime();
          const timeDiffHours = timeDiff / (1000 * 60 * 60);

          // Game is live if:
          // 1. Game started within last 4 hours (typical MLB game duration)
          // 2. Game starts within next 30 minutes (pregame coverage)
          const gameStartedRecently = timeDiffHours > 0 && timeDiffHours < 4;
          const gameStartingSoon = timeDiffHours < 0 && Math.abs(timeDiffHours) < 0.5; // 30 minutes
          is_live = gameStartedRecently || gameStartingSoon;

          // Don't show games that ended more than 4 hours ago
          const gameEndedTooLongAgo = timeDiffHours > 4;

          console.log(`🎮 Game ${game.away_team} @ ${game.home_team}:`, {
            gameTime: gameTime.toLocaleString('en-US', { timeZone: 'America/New_York' }),
            currentTime: currentTime.toLocaleString('en-US', { timeZone: 'America/New_York' }),
            timeDiffHours: Math.round(timeDiffHours * 100) / 100,
            isLive: is_live,
            endedTooLongAgo: gameEndedTooLongAgo,
            localTime: display_time,
          });

          // Skip games that ended more than 4 hours ago
          if (gameEndedTooLongAgo) {
            return null;
          }
        }

        // Clean and validate odds data - check for real odds in database
        const cleanOdds = (odds: any) => {
          if (!odds) return null;
          const numOdds = parseFloat(odds);
          // Filter out suspicious odds that are too extreme
          if (Math.abs(numOdds) > 10000) return null;
          return odds;
        };

        // Check for spread odds from different possible fields
        const spread_value = game.spread || game.home_spread || game.away_spread;
        const spread_odds_value =
          game.spread_odds || game.home_spread_odds || game.away_spread_odds;

        // Helper functions to clean and validate odds data from Optimal API pipeline
        const parseOdds = (value: any, fallback: number) => {
          if (!value) return fallback;
          const parsed = parseFloat(value);
          return !isNaN(parsed) ? parsed : fallback;
        };

        const parseSpread = (value: any, fallback: number) => {
          if (!value) return fallback;
          const parsed = parseFloat(value);
          return !isNaN(parsed) ? parsed : fallback;
        };

        return {
          ...game,
          // Standardized team names
          home_team_name,
          away_team_name,
          home_team_short,
          away_team_short,
          // Formatted matchup string
          matchup: `${away_team_name} @ ${home_team_name}`,
          matchup_short: `${away_team_short} @ ${home_team_short}`,
          // Formatted time displays
          formatted_time,
          display_time,
          game_time_local: display_time,
          // Live status
          is_live,
          live_status: is_live ? 'LIVE' : 'PREGAME',
          // Real odds from Optimal API pipeline (processed by your Temporal scheduler)
          moneyline_home_clean: parseOdds(game.moneyline_home || game.home_odds, 0) || null,
          moneyline_away_clean: parseOdds(game.moneyline_away || game.away_odds, 0) || null,
          total_clean: parseOdds(game.total, 0) || null,
          spread_clean: parseSpread(spread_value, 0) || null,
          spread_odds_clean: parseOdds(spread_odds_value || game.spread_odds, 0) || null,
          total_over_odds_clean: parseOdds(game.total_over_odds, 0) || null,
          total_under_odds_clean: parseOdds(game.total_under_odds, 0) || null,
          // Market availability based on real data (not hardcoded defaults)
          has_moneyline: !!(game.moneyline_home && game.moneyline_away),
          has_spread: !!(spread_value && spread_odds_value),
          has_total: !!(game.total && (game.total_over_odds || game.total_under_odds)),
        };
      })
      .filter(game => game !== null); // Filter out games that ended too long ago

    return transformedData;
  } catch (error) {
    console.error('🔍 fetchGames: Unexpected error:', error);
    // Return empty array on unexpected errors
    return [];
  }
};

export const fetchProps = async (gameId: string, marketType: string) => {
  // OPTIMIZED: Use foreign key relationships and confidence sorting
  const { data, error } = await supabase
    .from('raw_props')
    .select(
      `
      *,
      games!inner(
        id, home_team, away_team, game_date, status, game_time, sport
      )
    `
    )
    .eq('game_id', gameId)
    .eq('market_type', marketType)
    .not('game_id', 'is', null) // Only props linked to games
    .order('confidence', { ascending: false }) // Highest confidence first
    .order('expected_value', { ascending: false })
    .order('player_name');

  if (error) throw error;
  return data;
};

export const searchProps = async (
  sportType: string,
  marketType: string,
  propType: string,
  query?: string
) => {
  // OPTIMIZED: Use sport column directly and foreign key relationships
  let queryBuilder = supabase
    .from('raw_props')
    .select(
      `
      *,
      games!inner(
        id, home_team, away_team, game_date, status, game_time, sport
      )
    `
    )
    .eq('sport', sportType) // Direct sport column (faster than join)
    .eq('market_type', marketType)
    .eq('stat_type', propType) // Use stat_type instead of prop_type
    .not('game_id', 'is', null) // Only props linked to games
    .gte('games.game_time', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()) // Recent games
    .order('confidence', { ascending: false })
    .order('expected_value', { ascending: false });

  if (query) {
    queryBuilder = queryBuilder.ilike('player_name', `%${query}%`);
  }

  const { data, error } = await queryBuilder.limit(100); // Prevent large result sets

  if (error) throw error;
  return data;
};

// NEW: Cross-sport analytics leveraging sport columns
// SPRINT-RUNTIME-TRUTH-008: ev_modeling table may not exist - using type assertion
export const getCrossSportAnalytics = async (userId?: string) => {
  const { data, error } = await (supabase as any)
    .from('ev_modeling')
    .select(
      `
      sport,
      confidence,
      expected_value,
      created_at
    `
    )
    .gte('confidence', 0.5) // Only confident predictions
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
    .order('expected_value', { ascending: false })
    .limit(200);

  if (error) throw error;
  return data;
};

// NEW: Sport-specific contest data
// SPRINT-RUNTIME-TRUTH-008: contests table may not exist - using type assertion
export const getSportContests = async (sport?: string) => {
  let query = (supabase as any)
    .from('contests')
    .select(
      `
      *,
      contest_participants(
        user_id,
        professional_score,
        users(username, tier)
      )
    `
    )
    .eq('status', 'active')
    .order('prize_pool', { ascending: false });

  if (sport) {
    query = query.eq('sport', sport);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
};

// NEW: Enhanced user performance with sport breakdown
export const getUserSportPerformance = async (userId: string, days: number = 30) => {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('unified_picks')
    .select(
      `
      sport,
      status,
      confidence,
      potential_payout,
      placed_at,
      raw_props!inner(stat_type, player_name)
    `
    )
    .eq('user_id', userId)
    .gte('placed_at', startDate)
    .order('placed_at', { ascending: false });

  if (error) throw error;
  return data;
};
