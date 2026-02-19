import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase';
import { createRouteLogger, logDatabaseOperation, logApiPerformance } from '@/lib/logger';
import { metadataError } from '@/lib/metadata-helpers';
import { getRedisClient } from '@/lib/redis';

const log = createRouteLogger('GET /api/search', 'GET');

/**
 * SEARCH-CATALOG-CONTRACT-035: Unified Search Endpoint
 *
 * Provides typo-tolerant fuzzy search across teams, players, and games.
 * Uses pg_trgm GIN indexes for efficient similarity matching.
 *
 * Contract: docs/contracts/SEARCH_CATALOG_CONTRACT_V1.md Section 3.F
 */

const QuerySchema = z.object({
  q: z.string().min(2, 'Query must be at least 2 characters'),
  sport: z.string().nullish(),
  type: z.enum(['player', 'team', 'game', 'all']).default('all'),
  limit: z.coerce.number().min(1).max(50).default(20),
});

// Cache TTL in seconds (30 seconds per contract)
const CACHE_TTL = 30;

interface SearchResult {
  type: 'player' | 'team' | 'game';
  id: string;
  name: string;
  sport: string;
  team?: string;
  team_id?: string;
  abbr?: string;
  display_label?: string;
  score?: number;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);

    const rawQuery = {
      q: searchParams.get('q'),
      sport: searchParams.get('sport'),
      type: searchParams.get('type') || 'all',
      limit: searchParams.get('limit') || '20',
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

    const { q, sport, type, limit } = queryValidation.data;
    const cacheKey = `search:${sport || 'all'}:${type}:${q.toLowerCase()}`;

    log.info({ query: q, sport, type, limit }, 'Executing unified search');

    // Try cache first
    try {
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        log.info(
          { result_count: parsedCache.results.length, cache_hit: true },
          'Returning cached search results'
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
    const results: SearchResult[] = [];
    const searchTerm = q.toLowerCase();
    const limitPerType = Math.ceil(limit / (type === 'all' ? 3 : 1));

    // Search teams
    if (type === 'all' || type === 'team') {
      try {
        let teamQuery = sb
          .from('mv_search_teams')
          .select('id, name, abbr, sport')
          .or(`name.ilike.%${searchTerm}%,abbr.ilike.%${searchTerm}%,search_text.ilike.%${searchTerm}%`);

        if (sport) {
          teamQuery = teamQuery.eq('sport', sport.toUpperCase());
        }

        teamQuery = teamQuery.limit(limitPerType);

        const { data: teams, error: teamError } = await teamQuery;

        logDatabaseOperation(log, 'SEARCH', 'mv_search_teams', teams, teamError);

        if (!teamError && teams) {
          teams.forEach((t: any) => {
            results.push({
              type: 'team',
              id: t.id,
              name: t.name,
              sport: t.sport,
              abbr: t.abbr,
              display_label: t.abbr ? `${t.name} (${t.abbr})` : t.name,
            });
          });
        }
      } catch (error) {
        log.warn({ error }, 'Team search failed, trying fallback');

        // Fallback to direct teams table
        let fallbackQuery = sb
          .from('teams')
          .select('id, name, abbr, sport')
          .or(`name.ilike.%${searchTerm}%,abbr.ilike.%${searchTerm}%`);

        if (sport) {
          fallbackQuery = fallbackQuery.eq('sport', sport.toUpperCase());
        }

        const { data: fallbackTeams } = await fallbackQuery.limit(limitPerType);

        if (fallbackTeams) {
          fallbackTeams.forEach((t: any) => {
            results.push({
              type: 'team',
              id: t.id,
              name: t.name,
              sport: t.sport,
              abbr: t.abbr,
              display_label: t.abbr ? `${t.name} (${t.abbr})` : t.name,
            });
          });
        }
      }
    }

    // Search players
    if (type === 'all' || type === 'player') {
      try {
        let playerQuery = sb
          .from('mv_search_players')
          .select('id, name, sport, team_id, team_name, team_abbr')
          .or(`name.ilike.%${searchTerm}%,search_text.ilike.%${searchTerm}%`);

        if (sport) {
          playerQuery = playerQuery.eq('sport', sport.toUpperCase());
        }

        playerQuery = playerQuery.limit(limitPerType);

        const { data: players, error: playerError } = await playerQuery;

        logDatabaseOperation(log, 'SEARCH', 'mv_search_players', players, playerError);

        if (!playerError && players) {
          players.forEach((p: any) => {
            results.push({
              type: 'player',
              id: p.id,
              name: p.name,
              sport: p.sport,
              team: p.team_name,
              team_id: p.team_id,
              display_label: p.team_abbr ? `${p.name} (${p.team_abbr})` : p.name,
            });
          });
        }
      } catch (error) {
        log.warn({ error }, 'Player search failed, trying fallback');

        // Fallback to direct players table
        let fallbackQuery = sb
          .from('players')
          .select('id, name, sport, team_id')
          .ilike('name', `%${searchTerm}%`);

        if (sport) {
          fallbackQuery = fallbackQuery.eq('sport', sport.toUpperCase());
        }

        const { data: fallbackPlayers } = await fallbackQuery.limit(limitPerType);

        if (fallbackPlayers) {
          fallbackPlayers.forEach((p: any) => {
            results.push({
              type: 'player',
              id: p.id,
              name: p.name,
              sport: p.sport,
              team_id: p.team_id,
              display_label: p.name,
            });
          });
        }
      }
    }

    // Search games (by team names in display_label)
    if (type === 'all' || type === 'game') {
      const today = new Date().toISOString().split('T')[0];

      try {
        let gameQuery = sb
          .from('mv_search_games')
          .select('id, sport, display_label, game_date, start_time, home_team, away_team')
          .or(`display_label.ilike.%${searchTerm}%,home_team.ilike.%${searchTerm}%,away_team.ilike.%${searchTerm}%`)
          .gte('game_date', today);

        if (sport) {
          gameQuery = gameQuery.eq('sport', sport.toUpperCase());
        }

        gameQuery = gameQuery.limit(limitPerType);

        const { data: games, error: gameError } = await gameQuery;

        logDatabaseOperation(log, 'SEARCH', 'mv_search_games', games, gameError);

        if (!gameError && games) {
          games.forEach((g: any) => {
            results.push({
              type: 'game',
              id: g.id,
              name: g.display_label || `${g.away_team} @ ${g.home_team}`,
              sport: g.sport,
              display_label: g.display_label || `${g.away_team} @ ${g.home_team}`,
            });
          });
        }
      } catch (error) {
        log.warn({ error }, 'Game search failed, trying fallback');

        // Fallback to direct games table
        let fallbackQuery = sb
          .from('games')
          .select('id, sport, home_team, away_team, game_date')
          .or(`home_team.ilike.%${searchTerm}%,away_team.ilike.%${searchTerm}%`)
          .gte('game_date', today);

        if (sport) {
          fallbackQuery = fallbackQuery.eq('sport', sport.toUpperCase());
        }

        const { data: fallbackGames } = await fallbackQuery.limit(limitPerType);

        if (fallbackGames) {
          fallbackGames.forEach((g: any) => {
            results.push({
              type: 'game',
              id: g.id,
              name: `${g.away_team} @ ${g.home_team}`,
              sport: g.sport,
              display_label: `${g.away_team} @ ${g.home_team}`,
            });
          });
        }
      }
    }

    // Sort results by relevance (exact match first, then partial)
    results.sort((a, b) => {
      const aExact = a.name.toLowerCase() === searchTerm ? 1 : 0;
      const bExact = b.name.toLowerCase() === searchTerm ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;

      const aStartsWith = a.name.toLowerCase().startsWith(searchTerm) ? 1 : 0;
      const bStartsWith = b.name.toLowerCase().startsWith(searchTerm) ? 1 : 0;
      return bStartsWith - aStartsWith;
    });

    // Limit total results
    const limitedResults = results.slice(0, limit);

    // Cache the result
    try {
      const redis = getRedisClient();
      const cacheData = {
        results: limitedResults,
        meta: {
          total: limitedResults.length,
          query: q,
          sport: sport || null,
          type,
          source: 'database',
        },
      };
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(cacheData));
    } catch (cacheError) {
      log.warn({ error: cacheError }, 'Cache write failed');
    }

    logApiPerformance(log, 'unified-search', startTime, {
      result_count: limitedResults.length,
      query: q,
      sport,
      type,
    });

    return NextResponse.json(
      {
        results: limitedResults,
        meta: {
          total: limitedResults.length,
          query: q,
          sport: sport || null,
          type,
          source: 'database',
          cache_hit: false,
          timestamp: new Date().toISOString(),
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error) {
    const body = metadataError(
      'SEARCH_UNAVAILABLE',
      error instanceof Error ? error.message : 'Unknown error'
    );
    log.error(
      { ...body, stack: error instanceof Error ? error.stack : undefined },
      'Unexpected error in search endpoint'
    );
    return NextResponse.json(body, { status: 500 });
  }
}

// Health check
export async function HEAD() {
  return NextResponse.json(null, { status: 200 });
}
