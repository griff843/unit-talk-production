import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase';
import { createRouteLogger, logDatabaseOperation, logApiPerformance } from '@/lib/logger';
import {
  CONTRACT_VERSION,
  PropsResponseSchema,
  buildContractMeta,
  buildContractError,
} from '@/lib/contracts/smartform-data-contract-v1';
import { getRedisClient } from '@/lib/redis';

const log = createRouteLogger('GET /api/catalog/props', 'GET');

/**
 * SPRINT-SMARTFORM-DATA-CONTRACTS-INVENTORY-SURFACE-059
 *
 * Props Catalog Endpoint - Contract Surface V1
 *
 * CRITICAL: This route queries ONLY inventory_props_for_form_v1.
 *           Direct queries to 'raw_props' or 'mv_props_for_form' are FORBIDDEN.
 *
 * Contract: docs/contracts/SMARTFORM_DATA_CONTRACT_V1.md
 */

const QuerySchema = z.object({
  sport: z.string().min(1, 'sport parameter is required'),
  player_id: z.string().uuid().nullish(),
  player_name: z.string().min(2).nullish(),
  market_key: z.string().nullish(),
  stat_type: z.string().nullish(), // Alias for market_key
  team: z.string().nullish(),
  game_id: z.string().uuid().nullish(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

// Cache TTL in seconds (2 minutes per contract - props change frequently)
const CACHE_TTL = 120;

// Contract surface name - the ONLY allowed source
const CONTRACT_SURFACE = 'inventory_props_for_form_v1';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);

    const rawQuery = {
      sport: searchParams.get('sport'),
      player_id: searchParams.get('player_id'),
      player_name: searchParams.get('player_name'),
      market_key: searchParams.get('market_key'),
      stat_type: searchParams.get('stat_type'),
      team: searchParams.get('team'),
      game_id: searchParams.get('game_id'),
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
        buildContractError(
          'Invalid query parameters',
          'INVALID_PARAMS',
          queryValidation.error.errors
        ),
        { status: 400 }
      );
    }

    const { sport, player_id, player_name, market_key, stat_type, team, game_id, limit } =
      queryValidation.data;
    const sportUpper = sport.toUpperCase();

    // stat_type is an alias for market_key
    const effectiveMarketKey = market_key || stat_type;

    const cacheKey = `contract:props:v1:${sportUpper}${player_name ? `:${player_name}` : ''}${effectiveMarketKey ? `:${effectiveMarketKey}` : ''}`;

    log.info(
      {
        sport: sportUpper,
        player_name,
        market_key: effectiveMarketKey,
        team,
        game_id,
        limit,
        surface: CONTRACT_SURFACE,
      },
      'Fetching props from contract surface'
    );

    // Try cache first for specific player queries
    if (player_name && !effectiveMarketKey) {
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
        log.warn({ error: cacheError }, 'Cache read failed, continuing with contract surface');
      }
    }

    const sb = supabaseServer();

    // =========================================================================
    // CRITICAL: Query ONLY the contract surface inventory_props_for_form_v1
    // NO fallback to raw tables. Contract surface is authoritative.
    // =========================================================================
    let query = sb
      .from(CONTRACT_SURFACE)
      .select(
        `
        prop_id,
        sport,
        game_id,
        start_time,
        game_date,
        matchup,
        home_team,
        away_team,
        player_name,
        team_abbr,
        market_key,
        line,
        over_odds,
        under_odds,
        book,
        prop_key,
        display_label,
        contract_version,
        last_updated
      `
      )
      .eq('sport', sportUpper);

    // Apply filters
    if (player_name) {
      query = query.ilike('player_name', `%${player_name}%`);
    }

    if (effectiveMarketKey) {
      query = query.eq('market_key', effectiveMarketKey.toUpperCase());
    }

    if (team) {
      query = query.ilike('team_abbr', `%${team}%`);
    }

    if (game_id) {
      query = query.eq('game_id', game_id);
    }

    // Order by player, then market, then line
    query = query.order('player_name').order('market_key').order('line').limit(limit);

    const { data, error } = await query;

    logDatabaseOperation(log, 'SELECT', CONTRACT_SURFACE, data, error);

    if (error) {
      // FAIL-CLOSED: Contract surface query failed
      log.error(
        { error: error.message, code: error.code, surface: CONTRACT_SURFACE },
        'Contract surface query failed'
      );
      return NextResponse.json(
        buildContractError(
          `Contract surface unavailable: ${error.message}`,
          'CONTRACT_SURFACE_ERROR',
          { surface: CONTRACT_SURFACE, pg_code: error.code }
        ),
        { status: 503 }
      );
    }

    // Transform to contract response shape
    const props = (data || []).map((p: any) => ({
      prop_id: p.prop_id,
      sport: p.sport,
      game_id: p.game_id,
      start_time: p.start_time,
      game_date: p.game_date,
      matchup: p.matchup,
      home_team: p.home_team,
      away_team: p.away_team,
      player_name: p.player_name,
      team_abbr: p.team_abbr,
      market_key: p.market_key,
      line: parseFloat(p.line) || 0,
      over_odds: p.over_odds ? parseInt(p.over_odds) : null,
      under_odds: p.under_odds ? parseInt(p.under_odds) : null,
      book: p.book,
      prop_key: p.prop_key,
      display_label: p.display_label,
      contract_version: p.contract_version || CONTRACT_VERSION,
      last_updated: p.last_updated,
    }));

    // Extract unique market keys for dropdown population
    const availableMarkets = [...new Set(props.map(p => p.market_key))].sort();

    // Build response
    const response = {
      props,
      available_markets: availableMarkets,
      meta: {
        ...buildContractMeta(sportUpper, props.length),
        player_name: player_name || null,
        market_key: effectiveMarketKey || null,
        game_id: game_id || null,
        cache_hit: false,
      },
    };

    // Cache the result for player-specific queries
    if (player_name && props.length > 0) {
      try {
        const redis = getRedisClient();
        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(response));
      } catch (cacheError) {
        log.warn({ error: cacheError }, 'Cache write failed');
      }
    }

    logApiPerformance(log, 'catalog-props-v1', startTime, {
      prop_count: props.length,
      available_markets: availableMarkets.length,
      sport: sportUpper,
      player_name,
      market_key: effectiveMarketKey,
      surface: CONTRACT_SURFACE,
    });

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        'X-Contract-Version': CONTRACT_VERSION,
        'X-Contract-Surface': CONTRACT_SURFACE,
      },
    });
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Unexpected error in props catalog endpoint'
    );
    return NextResponse.json(
      buildContractError(
        error instanceof Error ? error.message : 'Unknown error',
        'INTERNAL_ERROR'
      ),
      { status: 500 }
    );
  }
}

// Health check - verifies contract surface is accessible
export async function HEAD() {
  try {
    const sb = supabaseServer();
    const { error } = await sb.from(CONTRACT_SURFACE).select('prop_id').limit(1);

    return NextResponse.json(null, {
      status: error ? 503 : 200,
      headers: {
        'X-Contract-Version': CONTRACT_VERSION,
        'X-Contract-Surface': CONTRACT_SURFACE,
      },
    });
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}
