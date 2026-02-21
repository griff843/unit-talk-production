import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { createRouteLogger, logDatabaseOperation, logApiPerformance } from '@/lib/logger';
import { metadataError } from '@/lib/metadata-helpers';
import { getRedisClient } from '@/lib/redis';

const log = createRouteLogger('GET /api/catalog/cappers', 'GET');

/**
 * SPRINT-SMARTFORM-ENTITY-AUTOFILL-088: Cappers Catalog Endpoint
 *
 * Returns active cappers for dropdown selection.
 * Cached for 10 minutes.
 */

// Cache TTL in seconds (10 minutes)
const CACHE_TTL = 600;

interface CapperResult {
  id: string;
  display_name: string;
  username: string | null;
  external_id: string | null;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const cacheKey = 'catalog:cappers:active';

  try {
    log.info({}, 'Fetching active cappers');

    // Try cache first
    try {
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        log.info(
          { capper_count: parsedCache.cappers.length, cache_hit: true },
          'Returning cached cappers'
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

    // Query active cappers via RPC
    const { data, error } = await sb.rpc('get_active_cappers');

    logDatabaseOperation(log, 'RPC', 'get_active_cappers', data, error);

    if (error) {
      // Fallback to direct table query if RPC doesn't exist
      log.warn({ error: error.message }, 'RPC query failed, falling back to direct query');

      const { data: fallbackData, error: fallbackError } = await sb
        .from('cappers')
        .select('id, display_name')
        .eq('is_active', true)
        .order('display_name');

      if (fallbackError) {
        const body = metadataError(
          'CAPPERS_CATALOG_UNAVAILABLE',
          `Cappers query failed: ${fallbackError.message}`
        );
        log.error({ ...body }, body.message);
        return NextResponse.json(body, { status: 503 });
      }

      const cappers: CapperResult[] = (fallbackData || []).map((c: any) => ({
        id: c.id,
        display_name: c.display_name,
        username: c.username || null,
        external_id: c.external_id || null,
      }));

      const response = {
        cappers,
        meta: {
          total: cappers.length,
          source: 'database_fallback',
          cache_hit: false,
          timestamp: new Date().toISOString(),
        },
      };

      // Cache the result
      try {
        const redis = getRedisClient();
        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(response));
      } catch (cacheError) {
        log.warn({ error: cacheError }, 'Cache write failed');
      }

      logApiPerformance(log, 'catalog-cappers', startTime, {
        capper_count: cappers.length,
        source: 'fallback',
      });

      return NextResponse.json(response, {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800',
        },
      });
    }

    const cappers: CapperResult[] = (data || []).map((c: any) => ({
      id: c.id,
      display_name: c.display_name,
      username: c.username || null,
      external_id: c.external_id || null,
    }));

    const response = {
      cappers,
      meta: {
        total: cappers.length,
        source: 'database',
        cache_hit: false,
        timestamp: new Date().toISOString(),
      },
    };

    // Cache the result
    try {
      const redis = getRedisClient();
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(response));
    } catch (cacheError) {
      log.warn({ error: cacheError }, 'Cache write failed');
    }

    logApiPerformance(log, 'catalog-cappers', startTime, {
      capper_count: cappers.length,
    });

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800',
      },
    });
  } catch (error) {
    const body = metadataError(
      'CAPPERS_CATALOG_UNAVAILABLE',
      error instanceof Error ? error.message : 'Unknown error'
    );
    log.error(
      { ...body, stack: error instanceof Error ? error.stack : undefined },
      'Unexpected error in cappers catalog endpoint'
    );
    return NextResponse.json(body, { status: 500 });
  }
}

// Health check
export async function HEAD() {
  try {
    const sb = supabaseServer();
    const { error } = await sb.from('cappers').select('id').limit(1);
    return NextResponse.json(null, { status: error ? 503 : 200 });
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}
