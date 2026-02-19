import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase';
import { createRouteLogger, logDatabaseOperation, logApiPerformance } from '@/lib/logger';
import {
  CONTRACT_VERSION,
  buildContractMeta,
  buildContractError,
} from '@/lib/contracts/smartform-data-contract-v1';
import { getRedisClient } from '@/lib/redis';

const log = createRouteLogger('GET /api/catalog/props', 'GET');

/**
 * SPRINT-SMARTFORM-DATA-CONTRACTS-MANUAL-INVENTORY-059
 *
 * Props Catalog Endpoint - Contract Surface V1.0.1
 *
 * STRATEGY: Manual Inventory Suggestions
 *
 * This route queries manual_inventory_for_form_v1 for prop SUGGESTIONS
 * derived from previous manual submissions. It does NOT depend on live prop feeds.
 *
 * CRITICAL: This route queries ONLY manual_inventory_for_form_v1.
 *           Direct queries to 'unified_picks', 'raw_props', or 'mv_props_for_form' are FORBIDDEN.
 *
 * Use cases:
 * - Show previously used player/market combinations as suggestions
 * - Pre-fill common lines based on historical submissions
 * - Enable manual entry even without live props
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
  limit: z.coerce.number().min(1).max(100).default(50),
});

// Cache TTL in seconds (5 minutes - manual inventory changes less frequently)
const CACHE_TTL = 300;

// Contract surface name - the ONLY allowed source
const CONTRACT_SURFACE = 'manual_inventory_for_form_v1';

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

    const { sport, player_id, player_name, market_key, stat_type, team, limit } =
      queryValidation.data;
    const sportUpper = sport.toUpperCase();

    // stat_type is an alias for market_key
    const effectiveMarketKey = market_key || stat_type;

    const cacheKey = `contract:manual-props:v1:${sportUpper}${player_name ? `:${player_name}` : ''}${effectiveMarketKey ? `:${effectiveMarketKey}` : ''}`;

    log.info(
      {
        sport: sportUpper,
        player_name,
        market_key: effectiveMarketKey,
        team,
        limit,
        surface: CONTRACT_SURFACE,
      },
      'Fetching prop suggestions from manual inventory surface'
    );

    // Try cache first for specific player queries
    if (player_name && !effectiveMarketKey) {
      try {
        const redis = getRedisClient();
        const cached = await redis.get(cacheKey);
        if (cached) {
          const parsedCache = JSON.parse(cached);
          log.info(
            { suggestion_count: parsedCache.suggestions.length, cache_hit: true },
            'Returning cached suggestions'
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
    // CRITICAL: Query ONLY the contract surface manual_inventory_for_form_v1
    // NO fallback to raw tables. Contract surface is authoritative.
    // =========================================================================
    let query = sb
      .from(CONTRACT_SURFACE)
      .select(
        `
        sport,
        player_id,
        player_name,
        team_abbr,
        market_key,
        avg_line,
        min_line,
        max_line,
        avg_odds,
        count_recent,
        last_seen_at,
        contract_version
      `
      )
      .eq('sport', sportUpper);

    // Apply filters
    if (player_name) {
      query = query.ilike('player_name', `%${player_name}%`);
    }

    if (player_id) {
      query = query.eq('player_id', player_id);
    }

    if (effectiveMarketKey) {
      query = query.eq('market_key', effectiveMarketKey.toUpperCase());
    }

    if (team) {
      query = query.ilike('team_abbr', `%${team}%`);
    }

    // Order by usage count (most used first), then recent
    query = query
      .order('count_recent', { ascending: false })
      .order('last_seen_at', { ascending: false })
      .limit(limit);

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
          {
            surface: CONTRACT_SURFACE,
            pg_code: error.code,
          }
        ),
        { status: 503 }
      );
    }

    // Transform to contract response shape
    interface ManualInventoryRow {
      sport: string;
      player_id: string | null;
      player_name: string;
      team_abbr: string | null;
      market_key: string;
      avg_line: number | null;
      min_line: number | null;
      max_line: number | null;
      avg_odds: number | null;
      count_recent: number;
      last_seen_at: string | null;
      contract_version: string;
    }

    const suggestions = ((data || []) as ManualInventoryRow[]).map(p => ({
      sport: p.sport,
      player_id: p.player_id,
      player_name: p.player_name,
      team_abbr: p.team_abbr,
      market_key: p.market_key,
      // Line suggestions
      avg_line: p.avg_line !== null ? parseFloat(String(p.avg_line)) : null,
      min_line: p.min_line !== null ? parseFloat(String(p.min_line)) : null,
      max_line: p.max_line !== null ? parseFloat(String(p.max_line)) : null,
      suggested_line: p.avg_line !== null ? parseFloat(String(p.avg_line)) : null,
      // Odds suggestion
      avg_odds: p.avg_odds !== null ? parseInt(String(p.avg_odds)) : null,
      // Usage metrics
      count_recent: p.count_recent,
      last_seen_at: p.last_seen_at,
      // Contract metadata
      contract_version: p.contract_version || CONTRACT_VERSION,
    }));

    // Extract unique market keys for dropdown population
    const availableMarkets = [...new Set(suggestions.map(p => p.market_key))].sort();

    // Build response
    const response = {
      suggestions,
      available_markets: availableMarkets,
      meta: {
        ...buildContractMeta(sportUpper, suggestions.length),
        player_name: player_name || null,
        market_key: effectiveMarketKey || null,
        days_lookback: 30,
        cache_hit: false,
        manual_inventory: true,
      },
    };

    // Cache the result for player-specific queries
    if (player_name && suggestions.length > 0) {
      try {
        const redis = getRedisClient();
        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(response));
      } catch (cacheError) {
        log.warn({ error: cacheError }, 'Cache write failed');
      }
    }

    logApiPerformance(log, 'catalog-props-manual-v1.0.1', startTime, {
      suggestion_count: suggestions.length,
      available_markets: availableMarkets.length,
      sport: sportUpper,
      player_name,
      market_key: effectiveMarketKey,
      surface: CONTRACT_SURFACE,
    });

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Contract-Version': CONTRACT_VERSION,
        'X-Contract-Surface': CONTRACT_SURFACE,
        'X-Manual-Inventory': 'true',
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
    const { error } = await sb.from(CONTRACT_SURFACE).select('sport').limit(1);

    return NextResponse.json(null, {
      status: error ? 503 : 200,
      headers: {
        'X-Contract-Version': CONTRACT_VERSION,
        'X-Contract-Surface': CONTRACT_SURFACE,
        'X-Manual-Inventory': 'true',
      },
    });
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}
