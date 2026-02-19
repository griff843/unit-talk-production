import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase';
import { createRouteLogger, logDatabaseOperation, logApiPerformance } from '@/lib/logger';
import { metadataError } from '@/lib/metadata-helpers';
import { getRedisClient } from '@/lib/redis';

const log = createRouteLogger('GET /api/catalog/props', 'GET');

/**
 * SEARCH-CATALOG-CONTRACT-035: Props Catalog Endpoint
 *
 * Returns props filtered by sport, player, and stat_type.
 *
 * Contract: docs/contracts/SEARCH_CATALOG_CONTRACT_V1.md Section 3.E
 */

const QuerySchema = z.object({
  sport: z.string().min(1, 'sport parameter is required'),
  player_id: z.string().uuid().nullish(),
  player_name: z.string().min(2).nullish(),
  stat_type: z.string().nullish(),
  team: z.string().nullish(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

// Cache TTL in seconds (2 minutes per contract)
const CACHE_TTL = 120;

interface PropResult {
  id: string;
  sport: string;
  player_name: string;
  team: string | null;
  stat_type: string;
  line: number;
  over_odds: number | null;
  under_odds: number | null;
  game_id: string | null;
  game_date: string | null;
  display_label: string;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);

    const rawQuery = {
      sport: searchParams.get('sport'),
      player_id: searchParams.get('player_id'),
      player_name: searchParams.get('player_name'),
      stat_type: searchParams.get('stat_type'),
      team: searchParams.get('team'),
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

    const { sport, player_id, player_name, stat_type, team, limit } = queryValidation.data;
    const cacheKey = `catalog:props:${sport}${player_name ? `:${player_name}` : ''}${stat_type ? `:${stat_type}` : ''}`;

    log.info({ sport, player_name, stat_type, team, limit }, 'Fetching props from catalog');

    // Try cache first for specific player queries
    if (player_name && !stat_type) {
      try {
        const redis = getRedisClient();
        const cached = await redis.get(cacheKey);
        if (cached) {
          const parsedCache = JSON.parse(cached);
          log.info(
            { prop_count: parsedCache.props.length, cache_hit: true },
            'Returning cached props'
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

    // Try materialized view first
    let query = sb
      .from('mv_props_for_form')
      .select('*')
      .eq('sport', sport.toUpperCase());

    if (player_name) {
      query = query.ilike('player_name', `%${player_name}%`);
    }

    if (stat_type) {
      query = query.eq('stat_type', stat_type.toUpperCase());
    }

    if (team) {
      query = query.ilike('team', `%${team}%`);
    }

    query = query.order('player_name').order('stat_type').limit(limit);

    const queryResult = await query;
    let data = queryResult.data;
    const error = queryResult.error;

    logDatabaseOperation(log, 'SELECT', 'mv_props_for_form', data, error);

    if (error) {
      // Fallback to direct raw_props query
      log.warn({ error: error.message }, 'MV query failed, falling back to direct query');

      const today = new Date().toISOString().split('T')[0];
      let fallbackQuery = sb
        .from('raw_props')
        .select('id, sport, player_name, team, stat_type, line, over_odds, under_odds, game_id, game_date')
        .eq('sport', sport.toUpperCase())
        .gte('game_date', today);

      if (player_name) {
        fallbackQuery = fallbackQuery.ilike('player_name', `%${player_name}%`);
      }

      if (stat_type) {
        fallbackQuery = fallbackQuery.eq('stat_type', stat_type.toUpperCase());
      }

      if (team) {
        fallbackQuery = fallbackQuery.ilike('team', `%${team}%`);
      }

      fallbackQuery = fallbackQuery.order('player_name').order('stat_type').limit(limit);

      const { data: fallbackData, error: fallbackError } = await fallbackQuery;

      if (fallbackError) {
        const body = metadataError(
          'PROPS_CATALOG_UNAVAILABLE',
          `Props query failed: ${fallbackError.message}`
        );
        log.error({ ...body }, body.message);
        return NextResponse.json(body, { status: 503 });
      }

      data = fallbackData;
    }

    // Transform to contract shape
    const props: PropResult[] = (data || []).map((p: any) => ({
      id: p.id,
      sport: p.sport,
      player_name: p.player_name,
      team: p.team,
      stat_type: p.stat_type,
      line: parseFloat(p.line) || 0,
      over_odds: p.over_odds ? parseInt(p.over_odds) : null,
      under_odds: p.under_odds ? parseInt(p.under_odds) : null,
      game_id: p.game_id,
      game_date: p.game_date,
      display_label: p.display_label || `${p.player_name} ${p.stat_type} ${p.line}`,
    }));

    // Cache the result for player-specific queries
    if (player_name && props.length > 0) {
      try {
        const redis = getRedisClient();
        const cacheData = {
          props,
          meta: {
            total: props.length,
            sport: sport.toUpperCase(),
            player_name,
            source: 'database',
          },
        };
        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(cacheData));
      } catch (cacheError) {
        log.warn({ error: cacheError }, 'Cache write failed');
      }
    }

    // Extract unique stat types for dropdown (Array.from for ES5 compatibility)
    const statTypes = Array.from(new Set(props.map(p => p.stat_type))).sort();

    logApiPerformance(log, 'catalog-props', startTime, {
      prop_count: props.length,
      sport,
      player_name,
      stat_type,
    });

    return NextResponse.json(
      {
        props,
        stat_types: statTypes,
        meta: {
          total: props.length,
          sport: sport.toUpperCase(),
          player_name: player_name || null,
          stat_type: stat_type || null,
          team: team || null,
          source: 'database',
          cache_hit: false,
          timestamp: new Date().toISOString(),
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    const body = metadataError(
      'PROPS_CATALOG_UNAVAILABLE',
      error instanceof Error ? error.message : 'Unknown error'
    );
    log.error(
      { ...body, stack: error instanceof Error ? error.stack : undefined },
      'Unexpected error in props catalog endpoint'
    );
    return NextResponse.json(body, { status: 500 });
  }
}

// Health check
export async function HEAD() {
  try {
    const sb = supabaseServer();
    const { error } = await sb.from('raw_props').select('count').limit(1).single();
    return NextResponse.json(null, { status: error ? 503 : 200 });
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}
