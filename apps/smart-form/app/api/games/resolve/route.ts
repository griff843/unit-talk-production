/**
 * GET /api/games/resolve
 *
 * Auto-resolves player to game based on player ID and date.
 * Returns GameRef with game details or null if no game found.
 *
 * Query params:
 * - playerId: string (required)
 * - date: YYYY-MM-DD (required)
 * - league: League (optional, for optimization)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase';
import { createRouteLogger, logDatabaseOperation, logApiPerformance } from '@/lib/logger';
import type { GameRef } from '@/types/form';

const log = createRouteLogger('GET /api/games/resolve', 'GET');

// Query validation schema
const QuerySchema = z.object({
  playerId: z.string().min(1, 'Player ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  league: z.enum(['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'WNBA']).optional(),
});

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = {
      playerId: searchParams.get('playerId'),
      date: searchParams.get('date'),
      league: searchParams.get('league'),
    };

    // Validate query parameters
    const queryValidation = QuerySchema.safeParse(rawQuery);
    if (!queryValidation.success) {
      log.warn({
        validation_errors: queryValidation.error.errors,
        query: rawQuery,
      }, 'Invalid query parameters');

      return NextResponse.json({
        error: 'Invalid query parameters',
        details: queryValidation.error.errors,
      }, { status: 400 });
    }

    const { playerId, date, league } = queryValidation.data;

    log.info({
      playerId,
      date,
      league,
    }, 'Resolving player to game');

    const supabase = supabaseServer();

    // Step 1: Get player's team from raw_props or player table
    let playerTeam: string | null = null;
    let playerLeague: string | null = league || null;

    // Try to find player in raw_props first (most recent data)
    const { data: propData, error: propError } = await supabase
      .from('raw_props')
      .select('team, sport')
      .ilike('player_name', `%${playerId}%`)
      .limit(1)
      .maybeSingle();

    logDatabaseOperation(log, 'SELECT', 'raw_props', propData, propError);

    if (propData) {
      playerTeam = propData.team;
      playerLeague = propData.sport || playerLeague;
      log.info({ playerTeam, playerLeague }, 'Found player team from raw_props');
    }

    // If not found in props, we can't resolve the game
    if (!playerTeam) {
      log.warn({ playerId, date }, 'Player team not found, cannot resolve game');

      // Return partial GameRef with date but no game ID
      const partialGameRef: GameRef = {
        id: null,
        homeTeam: 'TBD',
        awayTeam: 'TBD',
        dateISO: date,
        timeUTC: null,
        venue: null,
        status: 'scheduled',
      };

      return NextResponse.json({
        gameRef: partialGameRef,
        resolved: false,
        reason: 'Player team not found in database',
      }, { status: 200 });
    }

    // Step 2: Find game where player's team is home or away on the specified date
    let query = supabase
      .from('games')
      .select('id, home_team, away_team, game_date, commence_time, venue, status, league, home_team_meta, away_team_meta')
      .eq('game_date', date);

    if (playerLeague) {
      query = query.eq('league', playerLeague);
    }

    // Match by team ID or team name (case-insensitive)
    query = query.or(`home_team.ilike.%${playerTeam}%,away_team.ilike.%${playerTeam}%`);

    const { data: games, error: gamesError } = await query.limit(1);

    logDatabaseOperation(log, 'SELECT', 'games', games, gamesError);

    if (gamesError) {
      log.error({
        error: gamesError.message,
        playerId,
        date,
        playerTeam,
      }, 'Database error while resolving game');

      return NextResponse.json({
        error: 'Database error',
        message: 'Failed to resolve game',
      }, { status: 500 });
    }

    // Step 3: Build GameRef response
    if (!games || games.length === 0) {
      log.info({ playerId, date, playerTeam }, 'No game found for player on date');

      // Return partial GameRef with date but no game ID
      const partialGameRef: GameRef = {
        id: null,
        homeTeam: playerTeam,
        awayTeam: 'TBD',
        dateISO: date,
        timeUTC: null,
        venue: null,
        status: 'scheduled',
      };

      logApiPerformance(log, 'resolve-game', startTime, {
        playerId,
        date,
        resolved: false,
      });

      return NextResponse.json({
        gameRef: partialGameRef,
        resolved: false,
        reason: 'No game scheduled for player on this date',
      }, { status: 200 });
    }

    const game = games[0];

    // Extract team names from metadata if available
    const homeTeamName = game.home_team_meta?.names?.long || game.home_team;
    const awayTeamName = game.away_team_meta?.names?.long || game.away_team;

    // Parse commence_time if available
    let timeUTC: string | null = null;
    if (game.commence_time) {
      try {
        const gameTime = new Date(game.commence_time);
        timeUTC = gameTime.toISOString().split('T')[1].split('.')[0]; // HH:MM:SS
      } catch (e) {
        log.warn({ commence_time: game.commence_time }, 'Failed to parse game time');
      }
    }

    const gameRef: GameRef = {
      id: game.id,
      homeTeam: homeTeamName,
      awayTeam: awayTeamName,
      dateISO: game.game_date,
      timeUTC,
      venue: game.venue || null,
      status: (game.status as GameRef['status']) || 'scheduled',
    };

    log.info({
      gameRef,
      playerId,
      date,
      playerTeam,
    }, 'Successfully resolved game');

    logApiPerformance(log, 'resolve-game', startTime, {
      playerId,
      date,
      resolved: true,
      gameId: gameRef.id,
    });

    return NextResponse.json({
      gameRef,
      resolved: true,
      playerTeam,
      matchup: `${awayTeamName} @ ${homeTeamName}`,
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800', // 10min cache
      },
    });

  } catch (error) {
    log.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Unexpected error in game resolution');

    return NextResponse.json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while resolving game',
    }, { status: 500 });
  }
}
