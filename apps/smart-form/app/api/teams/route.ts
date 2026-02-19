import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase';
import { createRouteLogger, logDatabaseOperation, logApiPerformance } from '@/lib/logger';
import { toTeamOption, metadataError, isZeroRowsSuspicious } from '@/lib/metadata-helpers';

const log = createRouteLogger('GET /api/teams', 'GET');

// Type for team row data
interface TeamRow {
  id: string;
  name: string;
  abbr: string;
  sport: string;
  team_uuid: string | null;
  meta: Record<string, any> | null;
}

// ---------- Query-param validation ----------

const QuerySchema = z.object({
  sport: z.string().min(1, 'sport parameter is required'),
  q: z.string().nullish(),
});

// ---------- Route handler ----------

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = {
      sport: searchParams.get('sport'),
      q: searchParams.get('q'),
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

    const { sport, q } = queryValidation.data;

    log.info({ query: { sport, q } }, 'Fetching teams from canonical teams table');

    const sb = supabaseServer();

    // ── CANONICAL QUERY: teams table ONLY ──
    // Cloud schema columns: id, name, abbr, sport, team_uuid, meta, created_at, updated_at, logo_url
    // ID-ALIGNMENT-001: Include team_uuid for UUID FK resolution
    // SMART-FORM-FIX-004: Include meta to filter out deprecated teams
    let query = (sb.from('teams') as any)
      .select('id, name, abbr, sport, team_uuid, meta')
      .eq('sport', sport.toUpperCase());

    if (q) {
      query = query.ilike('name', `%${q}%`);
    }

    query = query.order('name', { ascending: true });

    const { data, error } = (await query) as { data: TeamRow[] | null; error: any };

    logDatabaseOperation(log, 'SELECT', 'teams', data, error);

    // ── FAIL-CLOSED: DB error → 503 ──
    if (error) {
      const body = metadataError(
        'TEAMS_METADATA_UNAVAILABLE',
        `Canonical teams query failed: ${error.message}`
      );
      log.error({ ...body, pg_code: error.code, details: error.details }, body.message);
      return NextResponse.json(body, { status: 503 });
    }

    // ── FAIL-CLOSED: zero rows for well-known sport ──
    if ((!data || data.length === 0) && !q && isZeroRowsSuspicious(sport)) {
      const body = metadataError(
        'TEAMS_METADATA_UNAVAILABLE',
        `Canonical teams table returned 0 rows for sport=${sport}. This is unexpected.`
      );
      log.error(body, body.message);
      return NextResponse.json(body, { status: 503 });
    }

    // ── Transform to contract shape ──
    // SMART-FORM-FIX-004: Filter out deprecated teams before transform
    const activeTeams = (data || []).filter(team => !team.meta?.deprecated);
    const teams = (activeTeams as unknown as Record<string, unknown>[]).map(toTeamOption);

    log.info(
      { team_count: teams.length, source: 'teams_table' },
      `Found ${teams.length} teams for ${sport}`
    );

    logApiPerformance(log, 'fetch-teams', startTime, {
      team_count: teams.length,
      filters: { sport, q },
    });

    return NextResponse.json(
      {
        teams,
        meta: {
          total: teams.length,
          filters: { sport: sport.toUpperCase(), q: q || null },
          source: 'database',
          timestamp: new Date().toISOString(),
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800',
        },
      }
    );
  } catch (error) {
    const body = metadataError(
      'TEAMS_METADATA_UNAVAILABLE',
      error instanceof Error ? error.message : 'Unknown error'
    );
    log.error(
      { ...body, stack: error instanceof Error ? error.stack : undefined },
      'Unexpected error in teams endpoint'
    );
    return NextResponse.json(body, { status: 500 });
  }
}

// ---------- Health check ----------

export async function HEAD() {
  try {
    const sb = supabaseServer();
    const { error } = await sb.from('teams').select('count').limit(1).single();
    return NextResponse.json(null, { status: error ? 503 : 200 });
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}
