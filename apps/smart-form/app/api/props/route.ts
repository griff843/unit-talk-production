import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase';
import {
  createRouteLogger,
  logDatabaseOperation,
  logApiPerformance,
  logValidationError
} from '@/lib/logger';
import {
  AutocompleteQuerySchema,
  PlayerAutocompleteSchema,
  MarketAutocompleteSchema,
  GameAutocompleteSchema,
  validatePlayerAutocomplete,
  validateMarketAutocomplete,
  validateGameAutocomplete,
  type PlayerOption,
  type MarketOption,
  type GameOption,
  type AutocompleteResponse,
  formatPlayerName,
  formatMarketDisplay,
  formatGameDisplay
} from '@unit-talk/shared-forms';

// Force dynamic rendering to prevent static generation errors
export const dynamic = 'force-dynamic';

const log = createRouteLogger('GET /api/props', 'GET');

// Enhanced validation schema for autocomplete endpoints
const PropsQuerySchema = z.object({
  // Autocomplete type
  type: z.enum(['player', 'market', 'game']).default('player'),

  // Base query
  query: z.string().min(2, 'Query must be at least 2 characters').max(100),

  // Filters
  sport: z.enum(['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'WNBA']).optional(),
  league: z.string().optional(),
  market: z.string().optional(),
  tier: z.array(z.enum(['S', 'A', 'B', 'C', 'D'])).optional(),
  min_confidence: z.number().min(0).max(1).optional(),

  // Pagination
  limit: z.number().int().min(1).max(50).default(20),

  // Performance options
  include_metadata: z.boolean().default(true),
  cache_enabled: z.boolean().default(true),
});


export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const rawQuery = {
      type: searchParams.get('type') || 'player',
      query: searchParams.get('query') || '',
      sport: searchParams.get('sport') || undefined,
      league: searchParams.get('league') || undefined,
      market: searchParams.get('market') || undefined,
      tier: searchParams.get('tier')?.split(',') || undefined,
      min_confidence: searchParams.get('min_confidence') ? parseFloat(searchParams.get('min_confidence')!) : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20,
      include_metadata: searchParams.get('include_metadata') !== 'false',
      cache_enabled: searchParams.get('cache_enabled') !== 'false',
    };

    // Validate query parameters
    const queryValidation = PropsQuerySchema.safeParse(rawQuery);
    if (!queryValidation.success) {
      logValidationError(log, queryValidation.error.errors, rawQuery);

      return NextResponse.json({
        error: 'Invalid query parameters',
        details: queryValidation.error.errors,
      }, { status: 400 });
    }

    const validatedQuery = queryValidation.data;
    const { type, query: searchQuery } = validatedQuery;

    log.info({
      autocompleteType: type,
      query: searchQuery,
      filters: validatedQuery,
    }, `Fetching autocomplete data for ${type}`);

    // Route to specific autocomplete handler
    let response: AutocompleteResponse<any>;

    switch (type) {
      case 'player':
        response = await handlePlayerAutocomplete(validatedQuery, startTime);
        break;
      case 'market':
        response = await handleMarketAutocomplete(validatedQuery, startTime);
        break;
      case 'game':
        response = await handleGameAutocomplete(validatedQuery, startTime);
        break;
      default:
        throw new Error(`Unknown autocomplete type: ${type}`);
    }

    logApiPerformance(log, `autocomplete-${type}`, startTime, {
      results_count: response.options.length,
      execution_time: response.meta.execution_time_ms,
      cache_hit: response.meta.cache_hit,
    });

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120', // 1min cache
      },
    });

  } catch (error) {
    log.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Unexpected error in props autocomplete endpoint');

    return NextResponse.json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching autocomplete data',
    }, { status: 500 });
  }
}

/**
 * Handle player name autocomplete
 */
async function handlePlayerAutocomplete(
  query: z.infer<typeof PropsQuerySchema>,
  startTime: number
): Promise<AutocompleteResponse<PlayerOption>> {
  const supabase = supabaseServer();
  const executionStart = Date.now();

  try {
    // Build optimized query using view_props_for_form
    let dbQuery = supabase
      .from('view_props_for_form')
      .select(`
        player_name,
        team_name,
        sport,
        tier,
        market,
        confidence,
        professional_score
      `)
      .ilike('player_name', `%${query.query}%`)
      .not('player_name', 'is', null);

    // Apply filters
    if (query.sport) {
      dbQuery = dbQuery.eq('sport', query.sport);
    }

    if (query.market) {
      dbQuery = dbQuery.eq('market', query.market);
    }

    if (query.tier?.length) {
      dbQuery = dbQuery.in('tier', query.tier);
    }

    if (query.min_confidence) {
      dbQuery = dbQuery.gte('confidence', query.min_confidence);
    }

    // Order by relevance and limit results
    dbQuery = dbQuery
      .order('professional_score', { ascending: false, nullsFirst: false })
      .order('confidence', { ascending: false, nullsFirst: false })
      .order('player_name')
      .limit(query.limit);

    const { data: dbResults, error } = await dbQuery;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    if (!dbResults || dbResults.length === 0) {
      return {
        options: [],
        meta: {
          total: 0,
          filtered: 0,
          query: query.query,
          filters: query,
          execution_time_ms: Date.now() - executionStart,
          cache_hit: false,
        },
      };
    }

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

    for (const result of dbResults) {
      const key = `${result.player_name}-${result.team_name}`;

      if (!playerMap.has(key)) {
        playerMap.set(key, {
          player_name: result.player_name,
          team_name: result.team_name,
          sport: result.sport,
          markets: new Set(),
          tiers: new Set(),
          confidence_scores: [],
          professional_scores: [],
        });
      }

      const player = playerMap.get(key)!;
      if (result.market) player.markets.add(result.market);
      if (result.tier) player.tiers.add(result.tier);
      if (result.confidence) player.confidence_scores.push(result.confidence);
      if (result.professional_score) player.professional_scores.push(result.professional_score);
    }

    // Transform to PlayerOption format
    const options: PlayerOption[] = Array.from(playerMap.values())
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
      .slice(0, query.limit);

    return {
      options,
      meta: {
        total: playerMap.size,
        filtered: options.length,
        query: query.query,
        filters: query,
        execution_time_ms: Date.now() - executionStart,
        cache_hit: false,
      },
    };

  } catch (error) {
    throw new Error(`Player autocomplete failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle market autocomplete
 */
async function handleMarketAutocomplete(
  query: z.infer<typeof PropsQuerySchema>,
  startTime: number
): Promise<AutocompleteResponse<MarketOption>> {
  const supabase = supabaseServer();
  const executionStart = Date.now();

  try {
    let dbQuery = supabase
      .from('view_props_for_form')
      .select(`
        market,
        submarket,
        sport,
        player_name
      `)
      .not('market', 'is', null);

    // Apply text search on market names
    if (query.query.length >= 2) {
      dbQuery = dbQuery.or(`market.ilike.%${query.query}%,submarket.ilike.%${query.query}%`);
    }

    if (query.sport) {
      dbQuery = dbQuery.eq('sport', query.sport);
    }

    const { data: dbResults, error } = await dbQuery
      .order('market')
      .limit(query.limit * 2); // Get more to dedupe

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    if (!dbResults || dbResults.length === 0) {
      return {
        options: [],
        meta: {
          total: 0,
          filtered: 0,
          query: query.query,
          filters: query,
          execution_time_ms: Date.now() - executionStart,
          cache_hit: false,
        },
      };
    }

    // Group markets and count props
    const marketMap = new Map<string, {
      market: string;
      submarket?: string;
      sport: string;
      prop_count: number;
    }>();

    for (const result of dbResults) {
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

    const options: MarketOption[] = Array.from(marketMap.values())
      .map(market => ({
        value: market.market,
        label: formatMarketDisplay(market.market, market.submarket),
        metadata: {
          submarket: market.submarket,
          sport: market.sport,
          prop_count: market.prop_count,
        },
      }))
      .slice(0, query.limit);

    return {
      options,
      meta: {
        total: marketMap.size,
        filtered: options.length,
        query: query.query,
        filters: query,
        execution_time_ms: Date.now() - executionStart,
        cache_hit: false,
      },
    };

  } catch (error) {
    throw new Error(`Market autocomplete failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle game autocomplete
 */
async function handleGameAutocomplete(
  query: z.infer<typeof PropsQuerySchema>,
  startTime: number
): Promise<AutocompleteResponse<GameOption>> {
  const supabase = supabaseServer();
  const executionStart = Date.now();

  try {
    let dbQuery = supabase
      .from('view_props_for_form')
      .select(`
        external_game_id,
        matchup,
        game_date,
        sport,
        league
      `)
      .not('matchup', 'is', null)
      .not('external_game_id', 'is', null);

    // Apply text search on matchup
    if (query.query.length >= 2) {
      dbQuery = dbQuery.ilike('matchup', `%${query.query}%`);
    }

    if (query.sport) {
      dbQuery = dbQuery.eq('sport', query.sport);
    }

    const { data: dbResults, error } = await dbQuery
      .order('game_date', { ascending: true })
      .limit(query.limit * 2);

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    if (!dbResults || dbResults.length === 0) {
      return {
        options: [],
        meta: {
          total: 0,
          filtered: 0,
          query: query.query,
          filters: query,
          execution_time_ms: Date.now() - executionStart,
          cache_hit: false,
        },
      };
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

    for (const result of dbResults) {
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

    const options: GameOption[] = Array.from(gameMap.values())
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
      .slice(0, query.limit);

    return {
      options,
      meta: {
        total: gameMap.size,
        filtered: options.length,
        query: query.query,
        filters: query,
        execution_time_ms: Date.now() - executionStart,
        cache_hit: false,
      },
    };

  } catch (error) {
    throw new Error(`Game autocomplete failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Health check endpoint
export async function HEAD() {
  try {
    const sb = supabaseServer();
    const { error } = await sb.from('raw_props').select('count').limit(1).single();
    
    if (error) {
      return NextResponse.json(null, { status: 503 });
    }
    
    return NextResponse.json(null, { status: 200 });
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}
