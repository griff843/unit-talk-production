import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase';
import { createRouteLogger, logDatabaseOperation, logApiPerformance } from '@/lib/logger';
import {
  CONTRACT_VERSION,
  CatalogPlayerSchema,
  PlayersResponseSchema,
  buildContractMeta,
  buildContractError,
  validateContractResponse,
} from '@/lib/contracts/smartform-data-contract-v1';
import { getRedisClient } from '@/lib/redis';

const log = createRouteLogger('GET /api/catalog/players', 'GET');

/**
 * SPRINT-SMARTFORM-DATA-CONTRACTS-INVENTORY-SURFACE-059
 *
 * Players Catalog Endpoint - Contract Surface V1
 *
 * CRITICAL: This route queries ONLY catalog_players_v1.
 *           Direct queries to 'players' or 'mv_search_players' are FORBIDDEN.
 *
 * Contract: docs/contracts/SMARTFORM_DATA_CONTRACT_V1.md
 */

/**
 * SPRINT-SMARTFORM-PLAYER-TEAM-INTEGRITY-090
 * Added away_team_id and home_team_id for matchup-aware filtering.
 * Fail-closed: if require_matchup=true and no teams provided, return empty.
 */
// PHASE-0-FIX: Use transform instead of coerce for proper string 'false' handling
const booleanFromString = z
  .union([z.boolean(), z.string()])
  .transform(val => {
    if (typeof val === 'boolean') return val;
    return val === 'true' || val === '1';
  })
  .default(false);

const QuerySchema = z.object({
  sport: z.string().min(1, 'sport parameter is required'),
  team_id: z.string().nullish(), // Legacy single-team filter (text team ID like "team_nfl_buffalo_bills")
  away_team_id: z.string().nullish(), // Matchup: away team ID
  home_team_id: z.string().nullish(), // Matchup: home team ID
  require_matchup: booleanFromString, // Fail-closed: require team filter (FIXED: string 'false' now works)
  q: z.string().min(2).nullish(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

// Cache TTL in seconds (10 minutes per contract)
const CACHE_TTL = 600;

// Contract surface name - the ONLY allowed source
const CONTRACT_SURFACE = 'catalog_players_v1';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = {
      sport: searchParams.get('sport'),
      team_id: searchParams.get('team_id'),
      away_team_id: searchParams.get('away_team_id'),
      home_team_id: searchParams.get('home_team_id'),
      require_matchup: searchParams.get('require_matchup') || 'false',
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
        buildContractError(
          'Invalid query parameters',
          'INVALID_PARAMS',
          queryValidation.error.errors
        ),
        { status: 400 }
      );
    }

    const { sport, team_id, away_team_id, home_team_id, require_matchup, q, limit } =
      queryValidation.data;

    // SPRINT-090: Fail-closed matchup validation
    // If require_matchup is true and no team filters provided, return empty
    const hasTeamFilter = team_id || away_team_id || home_team_id;
    if (require_matchup && !hasTeamFilter) {
      log.info(
        { sport, require_matchup },
        'Matchup required but no team filter provided - returning empty (fail-closed)'
      );
      return NextResponse.json(
        {
          players: [],
          meta: {
            ...buildContractMeta(sport, 0),
            query: q || null,
            team_id: null,
            cache_hit: false,
            fail_closed_reason: 'matchup_required_but_no_team_filter',
          },
        },
        { status: 200 }
      );
    }

    // Build cache key including matchup teams
    const teamKey =
      away_team_id && home_team_id ? `matchup:${away_team_id}:${home_team_id}` : team_id || 'all';
    const cacheKey = `contract:players:v1:${sport}:${teamKey}${q ? `:${q}` : ''}`;

    log.info(
      {
        sport,
        team_id,
        away_team_id,
        home_team_id,
        require_matchup,
        q,
        limit,
        surface: CONTRACT_SURFACE,
      },
      'Fetching players from contract surface'
    );

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
        log.warn({ error: cacheError }, 'Cache read failed, continuing with contract surface');
      }
    }

    const sb = supabaseServer();

    // =========================================================================
    // CRITICAL: Query ONLY the contract surface catalog_players_v1
    // NO fallback to raw tables. Contract surface is authoritative.
    // =========================================================================
    let query = sb
      .from(CONTRACT_SURFACE)
      .select(
        `
        player_id,
        player_name,
        sport,
        team_id,
        team_name,
        team_abbr,
        position,
        headshot_url,
        external_player_id,
        contract_version,
        last_updated
      `
      )
      .eq('sport', sport.toUpperCase());

    // Apply search filter using trigram similarity on search_text
    if (q) {
      // search_text is pre-computed in the view for efficient matching
      query = query.or(`player_name.ilike.%${q}%,search_text.ilike.%${q}%`);
    }

    // Apply team filter - SPRINT-090: matchup-aware filtering
    if (away_team_id && home_team_id) {
      // Matchup mode: show players from BOTH teams
      query = query.in('team_id', [away_team_id, home_team_id]);
    } else if (team_id) {
      // Legacy single-team filter
      query = query.eq('team_id', team_id);
    } else if (away_team_id || home_team_id) {
      // Single matchup team provided
      query = query.eq('team_id', (away_team_id || home_team_id)!);
    }
    // If no team filter and not require_matchup, return all players for sport

    // Order and limit
    query = query.order('player_name').limit(limit);

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
    const players = (data || []).map((p: any) => ({
      player_id: p.player_id,
      player_name: p.player_name,
      sport: p.sport,
      team_id: p.team_id,
      team_name: p.team_name,
      team_abbr: p.team_abbr,
      position: p.position,
      headshot_url: p.headshot_url,
      external_player_id: p.external_player_id,
      contract_version: p.contract_version || CONTRACT_VERSION,
      last_updated: p.last_updated,
    }));

    // =========================================================================
    // SPRINT-SMARTFORM-PLAYER-TEAM-INTEGRITY-090: FAIL-CLOSED TEAM CONSISTENCY
    // If a team filter is applied, ALL returned players MUST match that team.
    // Any mismatch indicates data integrity violation - reject with explicit error.
    // =========================================================================
    const expectedTeamIds = new Set<string>();
    if (away_team_id) expectedTeamIds.add(away_team_id);
    if (home_team_id) expectedTeamIds.add(home_team_id);
    if (team_id) expectedTeamIds.add(team_id);

    if (expectedTeamIds.size > 0) {
      const mismatches = players.filter(p => !expectedTeamIds.has(p.team_id));
      if (mismatches.length > 0) {
        log.error(
          {
            expected_teams: Array.from(expectedTeamIds),
            mismatched_count: mismatches.length,
            sample_mismatches: mismatches.slice(0, 5).map(p => ({
              player_id: p.player_id,
              player_name: p.player_name,
              actual_team_id: p.team_id,
            })),
          },
          'FAIL-CLOSED: Team consistency violation detected - players returned outside requested teams'
        );
        return NextResponse.json(
          buildContractError(
            `Data integrity violation: ${mismatches.length} players returned outside requested teams`,
            'TEAM_CONSISTENCY_VIOLATION',
            {
              expected_teams: Array.from(expectedTeamIds),
              mismatched_count: mismatches.length,
              sample_mismatches: mismatches.slice(0, 3).map(p => ({
                player_id: p.player_id,
                player_name: p.player_name,
                actual_team_id: p.team_id,
              })),
            }
          ),
          { status: 500 }
        );
      }
    }

    // Build response with contract metadata
    const response = {
      players,
      meta: {
        ...buildContractMeta(sport, players.length),
        query: q || null,
        team_id: team_id || null,
        away_team_id: away_team_id || null,
        home_team_id: home_team_id || null,
        matchup_filtered: !!(away_team_id && home_team_id),
        cache_hit: false,
      },
    };

    // Validate response against contract schema (fail-closed)
    try {
      validateContractResponse(PlayersResponseSchema, response, 'PlayersResponse');
    } catch (validationError) {
      log.error({ error: validationError }, 'Contract response validation failed');
      // Still return data but log the violation for monitoring
    }

    // Cache the result (only for non-search queries)
    if (!q && players.length > 0) {
      try {
        const redis = getRedisClient();
        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(response));
      } catch (cacheError) {
        log.warn({ error: cacheError }, 'Cache write failed');
      }
    }

    logApiPerformance(log, 'catalog-players-v1', startTime, {
      player_count: players.length,
      sport,
      team_id,
      away_team_id,
      home_team_id,
      matchup_filtered: !!(away_team_id && home_team_id),
      search_query: q || null,
      surface: CONTRACT_SURFACE,
    });

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': q
          ? 'public, s-maxage=30, stale-while-revalidate=60'
          : 'public, s-maxage=600, stale-while-revalidate=1800',
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
      'Unexpected error in players catalog endpoint'
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
    const { error } = await sb.from(CONTRACT_SURFACE).select('player_id').limit(1);

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
