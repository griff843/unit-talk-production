import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase';
import { createRouteLogger, logDatabaseOperation } from '@/lib/logger';
import { metadataError } from '@/lib/metadata-helpers';

const log = createRouteLogger('GET /api/registry/stat-types', 'GET');

const QuerySchema = z.object({
  sport: z.string().min(1, 'sport parameter is required'),
  bet_type: z.string().nullish(),
});

/**
 * V1.1 COMPLIANCE: Stat Types Registry Endpoint
 * Returns stat types available for a given sport from raw_props table
 * NO MOCK DATA - FAIL-CLOSED on errors
 *
 * Per V1.1 Spec Section 7: Prop types must be filtered by sport
 * - NBA: PTS, REB, AST, PRA, 3PM
 * - NFL: Passing Yards, Rushing Yards, Receptions, etc.
 * - MLB: Total Bases, Strikeouts, Hits, HR, etc.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = {
      sport: searchParams.get('sport'),
      bet_type: searchParams.get('bet_type'),
    };

    const queryValidation = QuerySchema.safeParse(rawQuery);
    if (!queryValidation.success) {
      log.warn({ validation_errors: queryValidation.error.errors }, 'Invalid query parameters');
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryValidation.error.errors },
        { status: 400 }
      );
    }

    const { sport, bet_type } = queryValidation.data;

    log.info({ sport, bet_type }, 'Fetching stat types from raw_props');

    const sb = supabaseServer();

    // V1.1: Bet type values to exclude (these are NOT player prop stat types):
    const BET_TYPE_VALUES = ['moneyline', 'spread', 'total', 'over', 'under', 'ml', 'pk'];

    // Query distinct stat_types from raw_props for this sport
    // Simple query with limit to prevent timeout
    const { data, error } = await sb
      .from('raw_props')
      .select('stat_type')
      .eq('sport', sport.toUpperCase())
      .not('stat_type', 'is', null)
      .limit(1000);

    logDatabaseOperation(log, 'SELECT DISTINCT', 'raw_props', data, error);

    if (error) {
      const body = metadataError(
        'STAT_TYPES_UNAVAILABLE',
        `Stat types query failed: ${error.message}`
      );
      log.error({ ...body, pg_code: error.code }, body.message);
      return NextResponse.json(body, { status: 503 });
    }

    // Extract unique stat types and normalize
    let uniqueStatTypes = [...new Set((data || []).map((row: any) => row.stat_type))]
      .filter(Boolean)
      .sort();

    // V1.1: For player props, filter out bet_type values (moneyline, spread, total)
    // These are NOT player prop stat types - we want PTS, REB, AST, etc.
    if (bet_type === 'player_prop') {
      uniqueStatTypes = uniqueStatTypes.filter(st => !BET_TYPE_VALUES.includes(st.toLowerCase()));
    }

    // V1.1 COMPLIANCE: If no stat types found in DB, return empty (no fallback)
    // This forces the user to use manual mode or wait for data ingestion
    if (uniqueStatTypes.length === 0) {
      log.warn({ sport }, `No stat types found for sport ${sport}`);
    }

    log.info({
      stat_types_count: uniqueStatTypes.length,
      sport,
      duration_ms: Date.now() - startTime
    }, `Found ${uniqueStatTypes.length} stat types for ${sport}`);

    return NextResponse.json({
      stat_types: uniqueStatTypes,
      meta: {
        total: uniqueStatTypes.length,
        sport: sport.toUpperCase(),
        source: 'database',
        timestamp: new Date().toISOString(),
      },
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    const body = metadataError(
      'STAT_TYPES_UNAVAILABLE',
      error instanceof Error ? error.message : 'Unknown error'
    );
    log.error({ ...body, stack: error instanceof Error ? error.stack : undefined },
      'Unexpected error in stat-types registry');
    return NextResponse.json(body, { status: 500 });
  }
}
