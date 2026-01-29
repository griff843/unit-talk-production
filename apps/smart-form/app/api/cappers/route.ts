import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase';
import { createRouteLogger, logDatabaseOperation, logApiPerformance } from '@/lib/logger';

const log = createRouteLogger('GET /api/cappers', 'GET');

// Validation schema for query parameters
const QuerySchema = z.object({
  active: z.string().nullish().transform(val => val === 'true'),
  sport: z.enum(['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF']).nullish(),
});

export async function GET(request: Request) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = {
      active: searchParams.get('active'),
      sport: searchParams.get('sport'),
    };

    // Validate query parameters
    const queryValidation = QuerySchema.safeParse(rawQuery);
    if (!queryValidation.success) {
      log.warn({
        validation_errors: queryValidation.error.errors,
        query: rawQuery,
      }, 'Invalid query parameters');
      
      return NextResponse.json({
        error: 'Invalid query parameters',
        details: queryValidation.error.errors,
      }, { status: 400 });
    }

    const { active = true, sport } = queryValidation.data;
    
    log.info({
      query: { active, sport },
    }, 'Fetching cappers from v3 users table');

    const sb = supabaseServer();
    
    // Query v3 users table for all non-System users (all are cappers)
    let query = sb
      .from('users')
      .select('id, username, discord_id, tier, capper_tier, active')
      .neq('username', 'System');
    
    if (active !== undefined) {
      // Filter by active status if column exists, otherwise assume all are active
      query = query.eq('active', active);
    }
    
    query = query.order('username', { ascending: true });

    const { data, error } = await query;

    logDatabaseOperation(log, 'SELECT', 'users', data, error);

    if (error) {
      log.error({
        error: error.message,
        code: error.code,
        details: error.details,
      }, 'Failed to fetch cappers from users table');
      
      return NextResponse.json({
        error: 'Database error',
        message: 'Unable to fetch cappers at this time',
        details: error.message,
      }, { status: 500 });
    }

    // FAIL-CLOSED: Validate that active column exists in response
    // Per USERS_CANONICAL_CONTRACT.md - never assume active=true if missing
    if (data && data.length > 0 && typeof data[0].active !== 'boolean') {
      log.error({
        sample_user: data[0],
        active_type: typeof data[0].active,
      }, 'SCHEMA VIOLATION: users.active column missing or invalid type. Canonical contract requires BOOLEAN.');

      return NextResponse.json({
        error: 'Schema violation',
        message: 'Database schema does not match canonical contract. users.active column is required.',
        code: 'SCHEMA_CONTRACT_VIOLATION',
      }, { status: 500 });
    }

    // Transform to match expected interface
    // FAIL-CLOSED: active must be explicitly boolean, no fallback
    const cappers = (data || []).map(user => ({
      id: user.id,
      name: user.username,
      active: user.active, // FAIL-CLOSED: No fallback - column is required
      tier: user.tier || user.capper_tier || 'VIP',
      discordId: user.discord_id,
    }));

    log.info({
      capper_count: cappers.length,
      source: 'v3_users_table',
    }, `Found ${cappers.length} active cappers`);

    logApiPerformance(log, 'fetch-cappers', startTime, {
      capper_count: cappers.length,
      filters: { active, sport },
    });

    return NextResponse.json({
      cappers,
      meta: {
        total: cappers.length,
        filters: { active, sport },
        source: 'database',
        timestamp: new Date().toISOString(),
      },
    }, { 
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // 5min cache
      },
    });

  } catch (error) {
    log.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Unexpected error in cappers endpoint');

    return NextResponse.json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching cappers',
    }, { status: 500 });
  }
}

// Health check endpoint
export async function HEAD() {
  try {
    const sb = supabaseServer();
    const { error } = await sb.from('users').select('count').limit(1).single();
    
    if (error) {
      return NextResponse.json(null, { status: 503 });
    }
    
    return NextResponse.json(null, { status: 200 });
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}
