import { NextResponse } from 'next/server';
import { createRouteLogger } from '@/lib/logger';
import { env } from '@/lib/env';
import { supabaseServer } from '@/lib/supabase-server';
import { addCacheHeaders, CACHE_CONFIGS } from '@/lib/middleware/cache-headers';

const log = createRouteLogger('GET /api/domain/cappers/default', 'GET');

/**
 * UUID validation helper
 */
function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * GET /api/domain/cappers/default
 *
 * Returns the default capper ID that would be used if no userId is provided in submissions.
 * This allows clients to preview which capper will be used without making an actual submission.
 *
 * Response format:
 * {
 *   success: true,
 *   capperId: "uuid",
 *   source: "request_body" | "CAPPER_ID" | "DEFAULT_CAPPER_ID" | "TEST_CAPPER_ID" | "SMARTFORM_DEFAULT_CAPPER_ID" | "CAPPER_IDS" | "database",
 *   capper?: { id, username, role, tier } // If database source
 * }
 */
export async function GET() {
  try {
    log.info('Resolving default capper ID');

    // Priority 1: Environment variables (in order)
    const envVars = [
      { key: 'CAPPER_ID', value: env.CAPPER_ID },
      { key: 'DEFAULT_CAPPER_ID', value: env.DEFAULT_CAPPER_ID },
      { key: 'TEST_CAPPER_ID', value: env.TEST_CAPPER_ID },
      { key: 'SMARTFORM_DEFAULT_CAPPER_ID', value: env.SMARTFORM_DEFAULT_CAPPER_ID },
    ];

    for (const { key, value } of envVars) {
      if (value && isValidUUID(value)) {
        log.info({ capperId: value, source: key }, 'Default capper resolved from environment');
        const response = NextResponse.json({
          success: true,
          capperId: value,
          source: key,
        });
        return addCacheHeaders(response, CACHE_CONFIGS.read);
      }
    }

    // Priority 2: CAPPER_IDS (comma or space separated list)
    if (env.CAPPER_IDS) {
      const capperId = env.CAPPER_IDS
        .split(/[,\s]+/)
        .map(id => id.trim())
        .filter(id => id.length > 0)
        .find(id => isValidUUID(id));

      if (capperId) {
        log.info({ capperId, source: 'CAPPER_IDS' }, 'Default capper resolved from CAPPER_IDS');
        const response = NextResponse.json({
          success: true,
          capperId,
          source: 'CAPPER_IDS',
        });
        return addCacheHeaders(response, CACHE_CONFIGS.read);
      }
    }

    // Priority 3: Database lookup
    const { data: capper, error } = await supabaseServer
      .from('users')
      .select('id, username, role, tier')
      .in('role', ['capper', 'tipster'])
      .or('disabled.is.null,disabled.eq.false')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      log.warn({ error: error.message }, 'Database query for default capper failed');
    } else if (capper?.id) {
      log.info({ capperId: capper.id, source: 'database' }, 'Default capper resolved from database');
      const response = NextResponse.json({
        success: true,
        capperId: capper.id,
        source: 'database',
        capper: {
          id: capper.id,
          username: capper.username,
          role: capper.role,
          tier: capper.tier,
        },
      });
      return addCacheHeaders(response, CACHE_CONFIGS.read);
    }

    // No default capper available
    log.warn('No default capper ID could be resolved');
    return NextResponse.json({
      success: false,
      error: 'No default capper configured',
      message: 'Please configure one of: CAPPER_ID, DEFAULT_CAPPER_ID, TEST_CAPPER_ID, SMARTFORM_DEFAULT_CAPPER_ID, or CAPPER_IDS environment variables',
      checkedSources: [
        'env.CAPPER_ID',
        'env.DEFAULT_CAPPER_ID',
        'env.TEST_CAPPER_ID',
        'env.SMARTFORM_DEFAULT_CAPPER_ID',
        'env.CAPPER_IDS',
        'database (public.users)',
      ],
    }, { status: 404 });

  } catch (error) {
    log.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Unexpected error resolving default capper');

    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred while resolving the default capper',
    }, { status: 500 });
  }
}
