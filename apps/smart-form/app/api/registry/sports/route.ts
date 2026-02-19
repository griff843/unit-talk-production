import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { createRouteLogger, logDatabaseOperation } from '@/lib/logger';
import { metadataError } from '@/lib/metadata-helpers';

const log = createRouteLogger('GET /api/registry/sports', 'GET');

/**
 * V1.1 COMPLIANCE: Sports Registry Endpoint
 * Returns all sports from the canonical teams table (distinct sports)
 * NO MOCK DATA - FAIL-CLOSED on errors
 */
export async function GET() {
  const startTime = Date.now();

  try {
    log.info({}, 'Fetching distinct sports from teams table');

    const sb = supabaseServer();

    // Query distinct sports from teams table
    const { data, error } = await sb
      .from('teams')
      .select('sport')
      .order('sport');

    logDatabaseOperation(log, 'SELECT DISTINCT', 'teams', data, error);

    if (error) {
      const body = metadataError(
        'SPORTS_REGISTRY_UNAVAILABLE',
        `Sports registry query failed: ${error.message}`
      );
      log.error({ ...body, pg_code: error.code }, body.message);
      return NextResponse.json(body, { status: 503 });
    }

    // Extract unique sports
    const uniqueSports = [...new Set((data || []).map((row: any) => row.sport))].filter(Boolean);

    if (uniqueSports.length === 0) {
      const body = metadataError(
        'SPORTS_REGISTRY_EMPTY',
        'No sports found in teams table. Database may be empty.'
      );
      log.error(body, body.message);
      return NextResponse.json(body, { status: 503 });
    }

    log.info({ sports_count: uniqueSports.length, duration_ms: Date.now() - startTime },
      `Found ${uniqueSports.length} sports`);

    return NextResponse.json({
      sports: uniqueSports,
      meta: {
        total: uniqueSports.length,
        source: 'database',
        timestamp: new Date().toISOString(),
      },
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (error) {
    const body = metadataError(
      'SPORTS_REGISTRY_UNAVAILABLE',
      error instanceof Error ? error.message : 'Unknown error'
    );
    log.error({ ...body, stack: error instanceof Error ? error.stack : undefined },
      'Unexpected error in sports registry');
    return NextResponse.json(body, { status: 500 });
  }
}
