import { supabase } from './supabase';
import { formatTimeInEST } from './betting-utils';
import {
  type PropForForm,
  type PlayerOption,
  type MarketOption,
  type GameOption,
  type AutocompleteResponse,
  formatPlayerName,
  formatMarketDisplay,
  formatGameDisplay
} from '@unit-talk/shared-forms';

export interface Capper {
  id: string;
  name: string;
  active: boolean;
  tier?: string;
  discord_id?: string;
  stats?: {
    winRate: number;
    roi: number;
    lastPick: string;
    isLive: boolean;
  };
}

export interface Team {
  id: string;
  name: string;
  sport: string;
  abbreviation: string;
  active: boolean;
}

export interface Player {
  id: string;
  name: string;
  team_id: string;
  sport: string;
  active: boolean;
  position: string;
}

export interface Game {
  id: string;
  sport: string;
  home_team_id: string;
  away_team_id: string;
  game_date: string;
  game_time: string;
  status: string;
}

export interface RawProp {
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

// Fetch active cappers from v3.0.0 unified users table
export const fetchCappers = async () => {
  console.log('🔍 fetchCappers: Querying production users table...');

  try {
    // First, try with the expected v3.0.0 schema
    const { data, error } = await supabase
      .from('users')
      .select('id, username, tier, discord_id')
      .neq('username', 'System') // Exclude system user
      .order('username') as { data: any[] | null, error: any };

    if (error) {
      console.error('🔍 fetchCappers: Supabase error:', error);

      // If the main query fails, return empty array - no more hardcoded fallbacks
      console.error('🔍 fetchCappers: Database connection failed, returning empty array');
      return [];
    }

    console.log('🔍 fetchCappers: Found', data?.length || 0, 'users');

    // Transform to match expected Capper interface with v3.0.0 fields
    const transformedData = (data || []).map((user: any) => ({
      id: user.id,
      name: user.username,
      active: true, // All users from database are considered active cappers
      tier: user.tier || 'VIP+',
      discord_id: user.discord_id,
      stats: {
        winRate: 68,
        roi: 12.5,
        lastPick: '2 hours ago',
        isLive: Math.random() > 0.5, // Random live status for demo
      },
    })) as Capper[];

    return transformedData;
  } catch (error) {
    console.error('🔍 fetchCappers: Connection failed:', error);

    // Return empty array - no more hardcoded fallbacks
    console.error('🔍 fetchCappers: Connection failed, returning empty array');
    return [];
  }
};

// NEW: Fetch props from optimized view_props_for_form
export const fetchPropsFromView = async (filters: {
  sport?: string;
  player_name?: string;
  market?: string;
  tier?: string[];
  min_confidence?: number;
  limit?: number;
} = {}): Promise<PropForForm[]> => {
  console.log('🔍 fetchPropsFromView: Querying view_props_for_form...', filters);

  try {
    let query = supabase
      .from('view_props_for_form')
      .select('*');

    // Apply filters
    if (filters.sport) {
      query = query.eq('sport', filters.sport);
    }

    if (filters.player_name) {
      query = query.ilike('player_name', `%${filters.player_name}%`);
    }

    if (filters.market) {
      query = query.eq('market', filters.market);
    }

    if (filters.tier?.length) {
      query = query.in('tier', filters.tier);
    }

    if (filters.min_confidence !== undefined) {
      query = query.gte('confidence', filters.min_confidence);
    }

    // Order by relevance and apply limit
    query = query
      .order('professional_score', { ascending: false, nullsFirst: false })
      .order('confidence', { ascending: false, nullsFirst: false })
      .order('posted_at', { ascending: false })
      .limit(filters.limit || 100);

    const { data, error } = await query;

    if (error) {
      throw new Error(`View query failed: ${error.message}`);
    }

    console.log('🔍 fetchPropsFromView: Found', data?.length || 0, 'props');
    return data || [];
  } catch (error) {
    console.error('🔍 fetchPropsFromView: Query failed:', error);
    throw error;
  }
};

// NEW: Player autocomplete using view_props_for_form
export const searchPlayersFromView = async (query: string, filters: {
  sport?: string;
  market?: string;
  tier?: string[];
  limit?: number;
} = {}): Promise<PlayerOption[]> => {
  if (!query || query.length < 2) {
    return [];
  }

  const props = await fetchPropsFromView({
    ...filters,
    player_name: query,
    limit: (filters.limit || 20) * 3, // Get more to dedupe by player
  });

  // Group by player and aggregate metadata
  const playerMap = new Map<string, {
    player_name: string;
    team_name: string;
    sport: string;
    markets: Set<string>;
    tiers: Set<string>;
    confidence_scores: number[];
    professional_scores: number[];
  }>();

  for (const prop of props) {
    if (!prop.player_name || !prop.team_name) continue;

    const key = `${prop.player_name}-${prop.team_name}`;

    if (!playerMap.has(key)) {
      playerMap.set(key, {
        player_name: prop.player_name,
        team_name: prop.team_name,
        sport: prop.sport,
        markets: new Set(),
        tiers: new Set(),
        confidence_scores: [],
        professional_scores: [],
      });
    }

    const player = playerMap.get(key)!;
    if (prop.market) player.markets.add(prop.market);
    if (prop.tier) player.tiers.add(prop.tier);
    if (prop.confidence) player.confidence_scores.push(prop.confidence);
    if (prop.professional_score) player.professional_scores.push(prop.professional_score);
  }

  // Transform to PlayerOption format
  return Array.from(playerMap.values())
    .map(player => ({
      value: player.player_name,
      label: formatPlayerName(player.player_name, player.team_name),
      metadata: {
        team_name: player.team_name,
        sport: player.sport,
        recent_props: player.markets.size,
        tier: Array.from(player.tiers)[0], // Primary tier
        avg_confidence: player.confidence_scores.length > 0
          ? player.confidence_scores.reduce((a, b) => a + b, 0) / player.confidence_scores.length
          : undefined,
        avg_professional_score: player.professional_scores.length > 0
          ? player.professional_scores.reduce((a, b) => a + b, 0) / player.professional_scores.length
          : undefined,
      },
    }))
    .slice(0, filters.limit || 20);
};

// NEW: Market autocomplete using view_props_for_form
export const searchMarketsFromView = async (query: string, filters: {
  sport?: string;
  player_name?: string;
  limit?: number;
} = {}): Promise<MarketOption[]> => {
  if (!query || query.length < 2) {
    return [];
  }

  try {
    let dbQuery = supabase
      .from('view_props_for_form')
      .select('market, submarket, sport')
      .not('market', 'is', null);

    // Apply text search on market names
    dbQuery = dbQuery.or(`market.ilike.%${query}%,submarket.ilike.%${query}%`);

    if (filters.sport) {
      dbQuery = dbQuery.eq('sport', filters.sport);
    }

    if (filters.player_name) {
      dbQuery = dbQuery.ilike('player_name', `%${filters.player_name}%`);
    }

    const { data, error } = await dbQuery
      .order('market')
      .limit((filters.limit || 20) * 2); // Get more to dedupe

    if (error) {
      throw new Error(`Market search failed: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Group markets and count props
    const marketMap = new Map<string, {
      market: string;
      submarket?: string;
      sport: string;
      prop_count: number;
    }>();

    for (const result of data) {
      const key = result.submarket
        ? `${result.market}-${result.submarket}`
        : result.market;

      if (!marketMap.has(key)) {
        marketMap.set(key, {
          market: result.market,
          submarket: result.submarket,
          sport: result.sport,
          prop_count: 0,
        });
      }

      marketMap.get(key)!.prop_count++;
    }

    return Array.from(marketMap.values())
      .map(market => ({
        value: market.market,
        label: formatMarketDisplay(market.market, market.submarket),
        metadata: {
          submarket: market.submarket,
          sport: market.sport,
          prop_count: market.prop_count,
        },
      }))
      .slice(0, filters.limit || 20);

  } catch (error) {
    console.error('🔍 searchMarketsFromView: Query failed:', error);
    throw error;
  }
};

// NEW: Game autocomplete using view_props_for_form
export const searchGamesFromView = async (query: string, filters: {
  sport?: string;
  date_range?: string;
  limit?: number;
} = {}): Promise<GameOption[]> => {
  if (!query || query.length < 2) {
    return [];
  }

  try {
    let dbQuery = supabase
      .from('view_props_for_form')
      .select('external_game_id, matchup, game_date, sport, league')
      .not('matchup', 'is', null)
      .not('external_game_id', 'is', null);

    // Apply text search on matchup
    dbQuery = dbQuery.ilike('matchup', `%${query}%`);

    if (filters.sport) {
      dbQuery = dbQuery.eq('sport', filters.sport);
    }

    // Apply date range filter
    if (filters.date_range && filters.date_range !== 'all') {
      const now = new Date();
      let startDate: Date;
      let endDate: Date;

      switch (filters.date_range) {
        case 'today':
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'tomorrow':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() + 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'week':
        default:
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setDate(endDate.getDate() + 7);
          endDate.setHours(23, 59, 59, 999);
          break;
      }

      dbQuery = dbQuery
        .gte('game_date', startDate.toISOString())
        .lte('game_date', endDate.toISOString());
    }

    const { data, error } = await dbQuery
      .order('game_date', { ascending: true })
      .limit((filters.limit || 20) * 2);

    if (error) {
      throw new Error(`Game search failed: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Group by game and count props
    const gameMap = new Map<string, {
      external_game_id: string;
      matchup: string;
      game_date: string;
      sport: string;
      league: string;
      prop_count: number;
    }>();

    for (const result of data) {
      const key = result.external_game_id;

      if (!gameMap.has(key)) {
        gameMap.set(key, {
          external_game_id: result.external_game_id,
          matchup: result.matchup,
          game_date: result.game_date,
          sport: result.sport,
          league: result.league,
          prop_count: 0,
        });
      }

      gameMap.get(key)!.prop_count++;
    }

    return Array.from(gameMap.values())
      .map(game => ({
        value: game.external_game_id,
        label: formatGameDisplay(game.matchup, game.game_date),
        metadata: {
          game_date: game.game_date,
          sport: game.sport,
          league: game.league,
          matchup: game.matchup,
          prop_count: game.prop_count,
        },
      }))
      .slice(0, filters.limit || 20);

  } catch (error) {
    console.error('🔍 searchGamesFromView: Query failed:', error);
    throw error;
  }
};

// Fetch teams by sport
export const fetchTeams = async (sport: string) => {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, sport, abbreviation')
    .eq('sport', sport)
    .eq('active', true)
    .order('name') as { data: Team[] | null, error: any };

  if (error) throw error;
  return data as Team[];
};

// Search teams
export const searchTeams = async (query: string, sport: string) => {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, sport, abbreviation')
    .eq('sport', sport)
    .eq('active', true)
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(10) as { data: Team[] | null, error: any };

  if (error) throw error;
  return data as Team[];
};

// Fetch players by team
export const fetchPlayers = async (teamId: string) => {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('team_id', teamId)
    .eq('active', true)
    .order('name');

  if (error) throw error;
  return data as Player[];
};

// Search players
export const searchPlayers = async (query: string, sport: string) => {
  const { data, error } = await supabase
    .from('players')
    .select('*, teams!inner(*)')
    .eq('sport', sport)
    .eq('active', true)
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(10);

  if (error) throw error;
  return data as (Player & { teams: Team })[];
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

    if (error && !data) {
      console.error('🔍 fetchGames: All queries failed, using fallback data:', error);

      // Return empty array - no more hardcoded fallbacks
      console.error('🔍 fetchGames: All queries failed, returning empty array');
      data = [];
    } else {
      console.log('🔍 fetchGames: Found', data?.length || 0, 'games for', sport, 'on', startDate);
    }

    // Transform the data to standardize team names, times, odds, and live status
    const transformedData = data
      ?.map((game: any) => {
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
export const getCrossSportAnalytics = async (userId?: string) => {
  const { data, error } = await supabase
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
export const getSportContests = async (sport?: string) => {
  let query = supabase
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
