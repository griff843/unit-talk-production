import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase';
import { createRouteLogger, logDatabaseOperation, logApiPerformance } from '@/lib/logger';
import { metadataError } from '@/lib/metadata-helpers';
import { getRedisClient } from '@/lib/redis';

const log = createRouteLogger('GET /api/catalog/players', 'GET');

/**
 * SEARCH-CATALOG-CONTRACT-035: Players Catalog Endpoint
 *
 * Returns players filtered by sport and optionally team, with fuzzy search.
 *
 * Contract: docs/contracts/SEARCH_CATALOG_CONTRACT_V1.md Section 3.D
 */

const QuerySchema = z.object({
  sport: z.string().min(1, 'sport parameter is required'),
  team_id: z.string().uuid().nullish(),
  q: z.string().min(2).nullish(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

// Cache TTL in seconds (10 minutes per contract)
const CACHE_TTL = 600;

interface PlayerResult {
  id: string;
  name: string;
  sport: string;
  team_id: string | null;
  team_name: string | null;
  team_abbr: string | null;
  position: string | null;
  jersey_number: string | null;
  headshot_url: string | null;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = {
      sport: searchParams.get('sport'),
      team_id: searchParams.get('team_id'),
      q: searchParams.get('q'),
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

    const { sport, team_id, q, limit } = queryValidation.data;
    const cacheKey = `catalog:players:${sport}${team_id ? `:${team_id}` : ''}${q ? `:${q}` : ''}`;

    log.info({ sport, team_id, q, limit }, 'Fetching players from catalog');

    // Try cache first (only for non-search queries)
    if (!q) {
      try {
        const redis = getRedisClient();
        const cached = await redis.get(cacheKey);
        if (cached) {
          const parsedCache = JSON.parse(cached);
          log.info(
            { player_count: parsedCache.players.length, cache_hit: true },
            'Returning cached players'
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
    }

    const sb = supabaseServer();
    let players: PlayerResult[];

    if (q) {
      // Use pg_trgm similarity search via materialized view
      let query = sb
        .from('mv_search_players')
        .select('id, name, sport, team_id, team_name, team_abbr, position, jersey_number, headshot_url')
        .eq('sport', sport.toUpperCase())
        .or(`name.ilike.%${q}%,search_text.ilike.%${q}%`);

      if (team_id) {
        query = query.eq('team_id', team_id);
      }

      query = query.order('name').limit(limit);

      const { data, error } = await query;

      logDatabaseOperation(log, 'SELECT', 'mv_search_players', data, error);

      if (error) {
        // Fallback to direct table query if MV doesn't exist
        log.warn({ error: error.message }, 'MV query failed, falling back to direct query');

        let fallbackQuery = sb
          .from('players')
          .select('id, name, sport, team_id, position, jersey_number, headshot_url')
          .eq('sport', sport.toUpperCase())
          .ilike('name', `%${q}%`);

        if (team_id) {
          fallbackQuery = fallbackQuery.eq('team_id', team_id);
        }

        fallbackQuery = fallbackQuery.order('name').limit(limit);

        const { data: fallbackData, error: fallbackError } = await fallbackQuery;

        if (fallbackError) {
          const body = metadataError(
            'PLAYERS_CATALOG_UNAVAILABLE',
            `Players query failed: ${fallbackError.message}`
          );
          log.error({ ...body }, body.message);
          return NextResponse.json(body, { status: 503 });
        }

        players = (fallbackData || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          sport: p.sport,
          team_id: p.team_id,
          team_name: null,
          team_abbr: null,
          position: p.position,
          jersey_number: p.jersey_number,
          headshot_url: p.headshot_url,
        }));
      } else {
        players = (data || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          sport: p.sport,
          team_id: p.team_id,
          team_name: p.team_name,
          team_abbr: p.team_abbr,
          position: p.position,
          jersey_number: p.jersey_number,
          headshot_url: p.headshot_url,
        }));
      }
    } else {
      // No search query - fetch players with optional team filter
      let query = sb
        .from('players')
        .select(`
          id, name, sport, team_id, position, jersey_number, headshot_url,
          teams!players_team_id_fkey(name, abbr)
        `)
        .eq('sport', sport.toUpperCase());

      if (team_id) {
        query = query.eq('team_id', team_id);
      }

      query = query.order('name').limit(limit);

      const { data, error } = await query;

      logDatabaseOperation(log, 'SELECT', 'players', data, error);

      if (error) {
        const body = metadataError(
          'PLAYERS_CATALOG_UNAVAILABLE',
          `Players query failed: ${error.message}`
        );
        log.error({ ...body }, body.message);
        return NextResponse.json(body, { status: 503 });
      }

      players = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        sport: p.sport,
        team_id: p.team_id,
        team_name: p.teams?.name || null,
        team_abbr: p.teams?.abbr || null,
        position: p.position,
        jersey_number: p.jersey_number,
        headshot_url: p.headshot_url,
      }));

      // Cache the result (only for non-search queries)
      if (players.length > 0) {
        try {
          const redis = getRedisClient();
          const cacheData = {
            players,
            meta: {
              total: players.length,
              sport: sport.toUpperCase(),
              team_id: team_id || null,
              source: 'database',
            },
          };
          await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(cacheData));
        } catch (cacheError) {
          log.warn({ error: cacheError }, 'Cache write failed');
        }
      }
    }

    logApiPerformance(log, 'catalog-players', startTime, {
      player_count: players.length,
      sport,
      team_id,
      search_query: q || null,
    });

    return NextResponse.json(
      {
        players,
        meta: {
          total: players.length,
          sport: sport.toUpperCase(),
          team_id: team_id || null,
          query: q || null,
          source: 'database',
          cache_hit: false,
          timestamp: new Date().toISOString(),
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': q
            ? 'public, s-maxage=30, stale-while-revalidate=60'
            : 'public, s-maxage=600, stale-while-revalidate=1800',
        },
      }
    );
  } catch (error) {
    const body = metadataError(
      'PLAYERS_CATALOG_UNAVAILABLE',
      error instanceof Error ? error.message : 'Unknown error'
    );
    log.error(
      { ...body, stack: error instanceof Error ? error.stack : undefined },
      'Unexpected error in players catalog endpoint'
    );
    return NextResponse.json(body, { status: 500 });
  }
}

// Health check
export async function HEAD() {
  try {
    const sb = supabaseServer();
    const { error } = await sb.from('players').select('count').limit(1).single();
    return NextResponse.json(null, { status: error ? 503 : 200 });
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}
