import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase';
import { createRouteLogger, logDatabaseOperation, logApiPerformance } from '@/lib/logger';
import { metadataError } from '@/lib/metadata-helpers';
import { getRedisClient } from '@/lib/redis';

const log = createRouteLogger('GET /api/catalog/games', 'GET');

/**
 * SEARCH-CATALOG-CONTRACT-035: Games Catalog Endpoint
 *
 * Returns games filtered by sport and date.
 *
 * Contract: docs/contracts/SEARCH_CATALOG_CONTRACT_V1.md Section 3.C
 */

const QuerySchema = z.object({
  sport: z.string().min(1, 'sport parameter is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  team_id: z.string().uuid().nullish(),
  status: z.enum(['scheduled', 'in_progress', 'final', 'all']).default('all'),
  limit: z.coerce.number().min(1).max(100).default(50),
});

// Cache TTL in seconds (5 minutes per contract)
const CACHE_TTL = 300;

interface GameResult {
  id: string;
  sport: string;
  league: string;
  game_date: string;
  start_time: string | null;
  status: string;
  home_team: {
    id: string | null;
    name: string;
    abbr: string | null;
  };
  away_team: {
    id: string | null;
    name: string;
    abbr: string | null;
  };
  display_label: string;
  odds?: {
    spread: number | null;
    total: number | null;
    moneyline_home: number | null;
    moneyline_away: number | null;
  };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const today = new Date().toISOString().split('T')[0];

    const rawQuery = {
      sport: searchParams.get('sport'),
      date: searchParams.get('date') || today,
      team_id: searchParams.get('team_id'),
      status: searchParams.get('status') || 'all',
      limit: searchParams.get('limit') || '50',
    };

    // Validate query parameters
    const queryValidation = QuerySchema.safeParse(rawQuery);
    if (!queryValidation.success) {
      log.warn(
        { validation_errors: queryValidation.error.errors, query: rawQuery },
        'Invalid query parameters'
      );
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryValidation.error.errors },
        { status: 400 }
      );
    }

    const { sport, date, team_id, status, limit } = queryValidation.data;
    const gameDate = date || today;
    const cacheKey = `catalog:games:${sport}:${gameDate}${team_id ? `:${team_id}` : ''}`;

    log.info({ sport, date: gameDate, team_id, status, limit }, 'Fetching games from catalog');

    // Try cache first
    try {
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        log.info(
          { game_count: parsedCache.games.length, cache_hit: true },
          'Returning cached games'
        );
        return NextResponse.json(
          {
            ...parsedCache,
            meta: {
              ...parsedCache.meta,
              cache_hit: true,
              timestamp: new Date().toISOString(),
            },
          },
          { status: 200 }
        );
      }
    } catch (cacheError) {
      log.warn({ error: cacheError }, 'Cache read failed, continuing with DB');
    }

    const sb = supabaseServer();

    // Try materialized view first, fallback to direct table
    let query = sb
      .from('mv_search_games')
      .select('*')
      .eq('sport', sport.toUpperCase())
      .eq('game_date', gameDate);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    query = query.order('start_time').limit(limit);

    const queryResult = await query;
    let data = queryResult.data;
    const error = queryResult.error;

    logDatabaseOperation(log, 'SELECT', 'mv_search_games', data, error);

    if (error) {
      // Fallback to direct games table query
      log.warn({ error: error.message }, 'MV query failed, falling back to direct query');

      let fallbackQuery = sb
        .from('games')
        .select('*')
        .or(`sport.eq.${sport.toUpperCase()},league.eq.${sport.toUpperCase()}`)
        .eq('game_date', gameDate);

      if (status !== 'all') {
        fallbackQuery = fallbackQuery.eq('status', status);
      }

      fallbackQuery = fallbackQuery.order('start_time').limit(limit);

      const { data: fallbackData, error: fallbackError } = await fallbackQuery;

      if (fallbackError) {
        const body = metadataError(
          'GAMES_CATALOG_UNAVAILABLE',
          `Games query failed: ${fallbackError.message}`
        );
        log.error({ ...body }, body.message);
        return NextResponse.json(body, { status: 503 });
      }

      data = fallbackData;
    }

    // Transform data to contract shape
    const games: GameResult[] = (data || []).map((g: any) => {
      const meta = typeof g.meta === 'object' ? g.meta : {};
      const homeTeamMeta = g.home_team_meta || meta.home_team_meta || {};
      const awayTeamMeta = g.away_team_meta || meta.away_team_meta || {};

      return {
        id: g.id,
        sport: g.sport,
        league: g.league,
        game_date: g.game_date,
        start_time: g.start_time,
        status: g.status,
        home_team: {
          id: homeTeamMeta.teamID || null,
          name: homeTeamMeta.names?.long || g.home_team,
          abbr: homeTeamMeta.names?.short || null,
        },
        away_team: {
          id: awayTeamMeta.teamID || null,
          name: awayTeamMeta.names?.long || g.away_team,
          abbr: awayTeamMeta.names?.short || null,
        },
        display_label: g.display_label || `${awayTeamMeta.names?.short || g.away_team} @ ${homeTeamMeta.names?.short || g.home_team}`,
        odds: {
          spread: g.spread || parseFloat(meta.spread) || null,
          total: g.total || parseFloat(meta.total) || null,
          moneyline_home: g.moneyline_home || parseInt(meta.moneyline_home) || null,
          moneyline_away: g.moneyline_away || parseInt(meta.moneyline_away) || null,
        },
      };
    });

    // Filter by team_id if provided
    let filteredGames = games;
    if (team_id) {
      filteredGames = games.filter(
        g => g.home_team.id === team_id || g.away_team.id === team_id
      );
    }

    // Cache the result
    try {
      const redis = getRedisClient();
      const cacheData = {
        games: filteredGames,
        meta: {
          total: filteredGames.length,
          sport: sport.toUpperCase(),
          date: gameDate,
          source: 'database',
        },
      };
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(cacheData));
    } catch (cacheError) {
      log.warn({ error: cacheError }, 'Cache write failed');
    }

    logApiPerformance(log, 'catalog-games', startTime, {
      game_count: filteredGames.length,
      sport,
      date: gameDate,
      team_id,
    });

    return NextResponse.json(
      {
        games: filteredGames,
        meta: {
          total: filteredGames.length,
          sport: sport.toUpperCase(),
          date: gameDate,
          team_id: team_id || null,
          status,
          source: 'database',
          cache_hit: false,
          timestamp: new Date().toISOString(),
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    const body = metadataError(
      'GAMES_CATALOG_UNAVAILABLE',
      error instanceof Error ? error.message : 'Unknown error'
    );
    log.error(
      { ...body, stack: error instanceof Error ? error.stack : undefined },
      'Unexpected error in games catalog endpoint'
    );
    return NextResponse.json(body, { status: 500 });
  }
}

// Health check
export async function HEAD() {
  try {
    const sb = supabaseServer();
    const { error } = await sb.from('games').select('count').limit(1).single();
    return NextResponse.json(null, { status: error ? 503 : 200 });
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}
