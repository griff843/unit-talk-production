import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase';
import {
  createRouteLogger,
  logDatabaseOperation,
  logApiPerformance,
  logExternalApiCall,
  logValidationError,
} from '@/lib/logger';

const log = createRouteLogger('GET /api/games', 'GET');

// GAUNTLET-CLOSEOUT-028: Explicit type for Supabase game row
interface GameRow {
  id: string;
  sport: string;
  league: string;
  home_team: string;
  away_team: string;
  game_date: string;
  start_time: string | null;
  commence_time?: string | null;
  status: string;
  external_game_id: string | null;
  meta: Record<string, any> | null;
  moneyline_home?: number | null;
  moneyline_away?: number | null;
  spread?: number | null;
  total?: number | null;
  spread_odds?: number | null;
  total_over_odds?: number | null;
  total_under_odds?: number | null;
  home_team_meta?: Record<string, any> | null;
  away_team_meta?: Record<string, any> | null;
  matchup?: string | null;
  created_at?: string;
  updated_at?: string;
}

// GAUNTLET-CLOSEOUT-028: Type for game insert payload
interface GameInsertPayload {
  sport: string;
  league: string;
  away_team: string;
  home_team: string;
  game_date: string;
  start_time: string;
  status: string;
  external_game_id: string;
  meta: Record<string, any>;
}

// Validation schema for query parameters
const QuerySchema = z.object({
  sport: z.enum(['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF']),
  team_id: z.string().uuid().nullish(),
  refresh: z
    .string()
    .nullish()
    .transform(val => val === 'true'),
});

// Optimal API Configuration - using environment variables
const OPTIMAL_API_BASE = 'https://api.optimal-bet.com';
// SPRINT-SCHEMA-ENV-GATES-002: Lazy env access
function getOptimalApiKey(): string | undefined {
  return process.env.OPTIMAL_API_KEY;
}

interface OptimalEvent {
  id: string;
  league: string;
  start_date: string;
  start_date_code: string;
  home: string;
  away: string;
  home_display: string;
  away_display: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  status: string;
}

interface OptimalGameLine {
  id: string;
  game_id: string;
  sportsbook: string;
  spread_home: number;
  spread_away: number;
  spread_home_odds: number;
  spread_away_odds: number;
  total: number;
  over_odds: number;
  under_odds: number;
  moneyline_home: number;
  moneyline_away: number;
  sport: string;
  created_at: string;
  updated_at: string;
}

async function makeOptimalRequest<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
  if (!getOptimalApiKey()) {
    throw new Error('getOptimalApiKey() environment variable is required');
  }

  const url = `${OPTIMAL_API_BASE}${endpoint}`;
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${getOptimalApiKey()}`,
      },
      cache: 'no-store', // Always fetch fresh data
    });

    if (!response.ok) {
      throw new Error(`Optimal API request failed (${response.status}): ${response.statusText}`);
    }

    const data = await response.json();

    logExternalApiCall(log, 'Optimal API', endpoint, 'GET', startTime, response.status);

    return data;
  } catch (error) {
    logExternalApiCall(log, 'Optimal API', endpoint, 'GET', startTime, undefined, error);
    throw error;
  }
}

async function fetchOptimalEvents(): Promise<OptimalEvent[]> {
  console.log('[Optimal API] Fetching events...');

  try {
    const response = await makeOptimalRequest<{ events: OptimalEvent[] }>('/v1/events');
    console.log(`[Optimal API] Found ${response.events.length} events`);
    return response.events;
  } catch (error) {
    console.error('[Optimal API] Error fetching events:', error);
    return [];
  }
}

async function fetchOptimalGameLines(sport: string): Promise<OptimalGameLine[]> {
  console.log(`[Optimal API] Fetching game lines for ${sport}...`);

  try {
    const gameLines = await makeOptimalRequest<OptimalGameLine[]>(`/v1/gamelines/${sport}`);
    console.log(`[Optimal API] Fetched ${gameLines.length} game lines for ${sport}`);
    return gameLines;
  } catch (error) {
    console.error(`[Optimal API] Failed to fetch game lines for ${sport}:`, error);
    return [];
  }
}

function convertOptimalEventToGame(event: OptimalEvent, gameLines: OptimalGameLine[]) {
  const today = new Date().toISOString().split('T')[0];

  // Find the best game line for this event (using best odds available)
  const eventGameLines = gameLines.filter(line => line.game_id === event.id);
  const bestLine = eventGameLines.length > 0 ? eventGameLines[0] : null; // Take first available line

  // ACTIVATION-P1-FIXES-001: Use cloud-canonical schema
  // Cloud games table: id, sport, league, home_team, away_team, game_date,
  //   start_time, status, external_game_id, meta, created_at, updated_at
  // Odds, matchup, venue, team_meta all stored in `meta` JSONB.
  const game = {
    sport: 'BASEBALL',
    league: event.league,
    away_team: `${event.away.toUpperCase().replace(/\s+/g, '_')}_${event.league}`,
    home_team: `${event.home.toUpperCase().replace(/\s+/g, '_')}_${event.league}`,
    game_date: today,
    start_time: event.commence_time, // canonical column (was commence_time)
    status: event.status || 'scheduled',
    external_game_id: event.id,
    meta: {
      source: 'optimal_api',
      matchup: `${event.away_display} @ ${event.home_display}`,
      venue: `${event.home} Stadium`,
      spread: bestLine ? bestLine.spread_home.toString() : null,
      total: bestLine ? bestLine.total.toString() : null,
      moneyline_home: bestLine ? bestLine.moneyline_home.toString() : null,
      moneyline_away: bestLine ? bestLine.moneyline_away.toString() : null,
      spread_odds: bestLine ? bestLine.spread_home_odds.toString() : null,
      total_over_odds: bestLine ? bestLine.over_odds.toString() : null,
      total_under_odds: bestLine ? bestLine.under_odds.toString() : null,
      home_team_meta: {
        names: {
          long: event.home_display,
          short: event.home,
          medium: event.home,
          location: event.home.split(' ').slice(0, -1).join(' '),
          nickname: event.home.split(' ').slice(-1)[0],
        },
        teamID: `${event.home.toUpperCase().replace(/\s+/g, '_')}_${event.league}`,
      },
      away_team_meta: {
        names: {
          long: event.away_display,
          short: event.away,
          medium: event.away,
          location: event.away.split(' ').slice(0, -1).join(' '),
          nickname: event.away.split(' ').slice(-1)[0],
        },
        teamID: `${event.away.toUpperCase().replace(/\s+/g, '_')}_${event.league}`,
      },
    },
  };

  return game;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = {
      sport: searchParams.get('sport') || 'NFL',
      team_id: searchParams.get('team_id'),
      refresh: searchParams.get('refresh'),
    };

    // Validate query parameters
    const queryValidation = QuerySchema.safeParse(rawQuery);
    if (!queryValidation.success) {
      logValidationError(log, queryValidation.error.errors, rawQuery);

      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: queryValidation.error.errors,
        },
        { status: 400 }
      );
    }

    const { sport, team_id, refresh: forceRefresh } = queryValidation.data;

    log.info(
      {
        query: { sport, team_id, refresh: forceRefresh },
      },
      `Fetching ${sport} games`
    );

    const today = new Date().toISOString().split('T')[0];
    const supabase = supabaseServer();

    // Check if we should fetch fresh data from Optimal API
    if (forceRefresh && getOptimalApiKey()) {
      try {
        log.info('Fetching fresh data from Optimal API');

        // Fetch events and game lines from Optimal API
        const [events, gameLines] = await Promise.all([
          fetchOptimalEvents(),
          fetchOptimalGameLines(sport),
        ]);

        // Filter events for today and the requested sport
        const todaysEvents = events.filter(event => {
          const eventDate = new Date(event.commence_time).toISOString().split('T')[0];
          return eventDate === today && event.league.toUpperCase() === sport.toUpperCase();
        });

        log.info(
          {
            events_found: todaysEvents.length,
            sport,
            date: today,
          },
          `Found ${todaysEvents.length} ${sport} events for today`
        );

        if (todaysEvents.length > 0) {
          // Convert Optimal events to our game format
          const optimalGames = todaysEvents.map(event =>
            convertOptimalEventToGame(event, gameLines)
          );

          // Clear existing games and insert fresh data
          log.info('Updating database with fresh Optimal data');

          const { error: deleteError } = await supabase
            .from('games')
            .delete()
            .eq('game_date', today)
            .eq('league', sport);

          logDatabaseOperation(log, 'DELETE', 'games', null, deleteError);

          // GAUNTLET-CLOSEOUT-028: Type assertion for Supabase insert
          const { data: insertedGames, error: insertError } = (await (supabase.from('games') as any)
            .insert(optimalGames)
            .select()) as { data: GameRow[] | null; error: any };

          logDatabaseOperation(log, 'INSERT', 'games', insertedGames, insertError);

          if (!insertError) {
            log.info(
              {
                inserted_count: insertedGames?.length || 0,
                source: 'optimal_api',
              },
              `Successfully inserted ${insertedGames?.length} games from Optimal API`
            );
          }
        }
      } catch (optimalError) {
        log.error(
          {
            error: optimalError instanceof Error ? optimalError.message : 'Unknown error',
          },
          'Error fetching from Optimal API, falling back to database data'
        );
      }
    }

    // Fetch games from database (either fresh Optimal data or existing data)
    let query = supabase.from('games').select('*').eq('league', sport).eq('game_date', today);

    // Add team filter if provided
    if (team_id) {
      query = query.or(`home_team_id.eq.${team_id},away_team_id.eq.${team_id}`);
    }

    // ACTIVATION-P1-FIXES-001: Use canonical start_time (commence_time doesn't exist in cloud)
    query = query.order('start_time');

    // GAUNTLET-CLOSEOUT-028: Type assertion for Supabase query result
    const { data: games, error } = (await query) as { data: GameRow[] | null; error: any };

    logDatabaseOperation(log, 'SELECT', 'games', games, error);

    if (error) {
      log.error(
        {
          error: error.message,
          code: error.code,
          sport,
          team_id,
          date: today,
        },
        'Database query error'
      );

      return NextResponse.json(
        {
          error: 'Failed to fetch games',
          message: error.message,
        },
        { status: 500 }
      );
    }

    log.info(
      {
        game_count: games?.length || 0,
        sport,
        date: today,
        team_filter: !!team_id,
      },
      `Returning ${games?.length || 0} games for ${sport} on ${today}`
    );

    // Transform games for frontend consumption with proper time and odds handling
    const transformedGames =
      games
        ?.map(game => {
          let gameTime, display_time, formatted_time;
          let isLive = false;

          try {
            // ACTIVATION-P1-FIXES-001: Use canonical start_time (cloud schema)
            let gameTimeStr = game.start_time || game.commence_time;

            // Handle timezone conversion properly
            if (
              gameTimeStr &&
              typeof gameTimeStr === 'string' &&
              !gameTimeStr.includes('Z') &&
              !gameTimeStr.includes('+') &&
              !/\d{2}-\d{2}/.test(gameTimeStr.slice(-5))
            ) {
              // If no timezone info, treat as UTC (which is what the database stores)
              gameTimeStr = gameTimeStr + 'Z';
            }

            // GAUNTLET-CLOSEOUT-028: Guard against null/undefined gameTimeStr
            gameTime = gameTimeStr ? new Date(gameTimeStr) : new Date();

            // Format time - let client handle timezone conversion for capper's local time
            if (!isNaN(gameTime.getTime())) {
              // Send UTC timestamp - client will convert to user's local timezone
              display_time = gameTime.toLocaleString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZoneName: 'short',
              });
              formatted_time = gameTime.toLocaleString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZoneName: 'short',
              });

              // Also provide raw UTC timestamp for client-side conversion
              const utc_timestamp = gameTime.getTime();

              // Determine if live - FIXED LOGIC
              const currentTime = new Date();
              const timeDiff = currentTime.getTime() - gameTime.getTime();
              const timeDiffHours = timeDiff / (1000 * 60 * 60);

              // Game is live if:
              // 1. Game started within last 4 hours (typical MLB game duration)
              // 2. Game starts within next 30 minutes (pregame coverage)
              const gameStartedRecently = timeDiffHours > 0 && timeDiffHours < 4;
              const gameStartingSoon = timeDiffHours < 0 && Math.abs(timeDiffHours) < 0.5; // 30 minutes
              isLive = gameStartedRecently || gameStartingSoon;

              // Don't include games that ended more than 4 hours ago
              if (timeDiffHours > 4) {
                return null; // Skip this game
              }
            } else {
              display_time = 'TBD';
              formatted_time = 'Time TBD';
            }
          } catch (error) {
            console.error('Error parsing game time:', error);
            display_time = 'TBD';
            formatted_time = 'Time TBD';
          }

          // Parse odds with proper validation - don't use hardcoded fallbacks
          const parseOdds = (value: any) => {
            if (!value) return null;
            const parsed = parseInt(value);
            return !isNaN(parsed) ? parsed : null;
          };

          const parseFloatValue = (value: any) => {
            if (!value) return null;
            const parsed = parseFloat(value);
            return !isNaN(parsed) ? parsed : null;
          };

          // ACTIVATION-P1-FIXES-001: Read odds from top-level columns (local) or meta JSONB (cloud)
          const meta =
            game.meta && typeof game.meta === 'object' ? (game.meta as Record<string, any>) : {};
          const moneylineHome = parseOdds(game.moneyline_home ?? meta.moneyline_home);
          const moneylineAway = parseOdds(game.moneyline_away ?? meta.moneyline_away);
          const spreadValue = parseFloatValue(game.spread ?? meta.spread);
          const totalValue = parseFloatValue(game.total ?? meta.total);
          const spreadOdds = parseOdds(game.spread_odds ?? meta.spread_odds);
          const totalOverOdds = parseOdds(game.total_over_odds ?? meta.total_over_odds);
          const totalUnderOdds = parseOdds(game.total_under_odds ?? meta.total_under_odds);

          console.log(`[Games API] ${game.away_team} @ ${game.home_team}:`, {
            display_time,
            moneylineHome,
            moneylineAway,
            spread: spreadValue,
            total: totalValue,
            isLive,
          });

          return {
            ...game,
            display_time,
            formatted_time,
            game_time_local: display_time,
            utc_timestamp: gameTime ? gameTime.getTime() : null, // For client-side timezone conversion
            is_live: isLive,
            live_status: isLive ? 'LIVE' : 'PREGAME',

            // Real odds data - properly parsed without fallbacks
            moneyline_home_clean: moneylineHome,
            moneyline_away_clean: moneylineAway,
            spread_clean: spreadValue,
            total_clean: totalValue,
            spread_odds_clean: spreadOdds,
            total_over_odds_clean: totalOverOdds,
            total_under_odds_clean: totalUnderOdds,

            // Market availability based on actual data presence
            has_moneyline: !!(moneylineHome && moneylineAway),
            has_spread: !!(spreadValue && spreadOdds),
            has_total: !!(totalValue && (totalOverOdds || totalUnderOdds)),

            // ACTIVATION-P1-FIXES-001: Read matchup/team_meta from top-level or meta JSONB
            matchup:
              game.matchup ||
              meta.matchup ||
              `${(game.away_team_meta || meta.away_team_meta)?.names?.long || game.away_team} @ ${(game.home_team_meta || meta.home_team_meta)?.names?.long || game.home_team}`,
            matchup_short: `${(game.away_team_meta || meta.away_team_meta)?.names?.short || game.away_team} @ ${(game.home_team_meta || meta.home_team_meta)?.names?.short || game.home_team}`,
          };
        })
        .filter(game => game !== null) || []; // Filter out games that ended too long ago

    logApiPerformance(log, 'fetch-games', startTime, {
      game_count: transformedGames.length,
      sport,
      team_id,
      refresh: forceRefresh,
      source: getOptimalApiKey() ? 'optimal_api' : 'database',
    });

    return NextResponse.json(
      {
        games: transformedGames,
        meta: {
          count: transformedGames.length,
          date: today,
          sport,
          team_id: team_id || null,
          source: getOptimalApiKey() ? 'optimal_api' : 'database',
          timestamp: new Date().toISOString(),
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': forceRefresh
            ? 'no-cache'
            : 'public, s-maxage=300, stale-while-revalidate=900', // 5min cache unless refresh
        },
      }
    );
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        sport: (request.url.match(/sport=([^&]+)/) || [])[1],
      },
      'Unexpected error in games endpoint'
    );

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred while fetching games',
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function HEAD() {
  try {
    const sb = supabaseServer();
    const { error } = await sb.from('games').select('count').limit(1).single();

    if (error) {
      return NextResponse.json(null, { status: 503 });
    }

    return NextResponse.json(null, { status: 200 });
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}
