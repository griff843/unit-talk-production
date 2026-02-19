import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase';
import { createRouteLogger, logDatabaseOperation, logApiPerformance } from '@/lib/logger';
import { metadataError } from '@/lib/metadata-helpers';
import { getRedisClient } from '@/lib/redis';

const log = createRouteLogger('GET /api/catalog/teams', 'GET');

/**
 * SEARCH-CATALOG-CONTRACT-035: Teams Catalog Endpoint
 *
 * Returns teams filtered by sport with optional fuzzy search (pg_trgm).
 *
 * Contract: docs/contracts/SEARCH_CATALOG_CONTRACT_V1.md Section 3.B
 */

const QuerySchema = z.object({
  sport: z.string().min(1, 'sport parameter is required'),
  q: z.string().min(2).nullish(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

// Cache TTL in seconds (10 minutes per contract)
const CACHE_TTL = 600;

interface TeamResult {
  id: string;
  name: string;
  abbr: string | null;
  sport: string;
  team_uuid: string | null;
  logo_url: string | null;
  aliases?: string[];
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = {
      sport: searchParams.get('sport'),
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
        { error: 'Invalid query parameters', details: queryValidation.error.errors },
        { status: 400 }
      );
    }

    const { sport, q, limit } = queryValidation.data;
    const cacheKey = `catalog:teams:${sport}${q ? `:${q}` : ''}`;

    log.info({ sport, q, limit }, 'Fetching teams from catalog');

    // Try cache first (only for non-search queries)
    if (!q) {
      try {
        const redis = getRedisClient();
        const cached = await redis.get(cacheKey);
        if (cached) {
          const parsedCache = JSON.parse(cached);
          log.info(
            { team_count: parsedCache.teams.length, cache_hit: true },
            'Returning cached teams'
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
    }

    const sb = supabaseServer();

    let teams: TeamResult[];

    if (q) {
      // Use pg_trgm similarity search via the materialized view
      // This enables typo-tolerant fuzzy matching
      const { data, error } = await sb
        .from('mv_search_teams')
        .select('id, name, abbr, sport, team_uuid, logo_url, aliases')
        .eq('sport', sport.toUpperCase())
        .or(`name.ilike.%${q}%,abbr.ilike.%${q}%,search_text.ilike.%${q}%`)
        .order('name')
        .limit(limit);

      logDatabaseOperation(log, 'SELECT', 'mv_search_teams', data, error);

      if (error) {
        // Fallback to direct table query if MV doesn't exist
        log.warn({ error: error.message }, 'MV query failed, falling back to direct query');

        const fallbackQuery = sb
          .from('teams')
          .select('id, name, abbr, sport, team_uuid, meta')
          .eq('sport', sport.toUpperCase())
          .or(`name.ilike.%${q}%,abbr.ilike.%${q}%`)
          .order('name')
          .limit(limit);

        const { data: fallbackData, error: fallbackError } = await fallbackQuery;

        if (fallbackError) {
          const body = metadataError(
            'TEAMS_CATALOG_UNAVAILABLE',
            `Teams query failed: ${fallbackError.message}`
          );
          log.error({ ...body }, body.message);
          return NextResponse.json(body, { status: 503 });
        }

        teams = (fallbackData || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          abbr: t.abbr,
          sport: t.sport,
          team_uuid: t.team_uuid,
          logo_url: t.meta?.logo_url || null,
          aliases: t.meta?.aliases || [],
        }));
      } else {
        teams = (data || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          abbr: t.abbr,
          sport: t.sport,
          team_uuid: t.team_uuid,
          logo_url: t.logo_url,
          aliases: Array.isArray(t.aliases) ? t.aliases : [],
        }));
      }
    } else {
      // No search query - fetch all teams for sport
      const { data, error } = await sb
        .from('teams')
        .select('id, name, abbr, sport, team_uuid, meta, logo_url')
        .eq('sport', sport.toUpperCase())
        .order('name')
        .limit(limit);

      logDatabaseOperation(log, 'SELECT', 'teams', data, error);

      if (error) {
        const body = metadataError(
          'TEAMS_CATALOG_UNAVAILABLE',
          `Teams query failed: ${error.message}`
        );
        log.error({ ...body }, body.message);
        return NextResponse.json(body, { status: 503 });
      }

      teams = (data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        abbr: t.abbr,
        sport: t.sport,
        team_uuid: t.team_uuid,
        logo_url: t.logo_url || t.meta?.logo_url || null,
        aliases: t.meta?.aliases || [],
      }));

      // Cache the result (only for non-search queries)
      try {
        const redis = getRedisClient();
        const cacheData = {
          teams,
          meta: {
            total: teams.length,
            sport: sport.toUpperCase(),
            source: 'database',
          },
        };
        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(cacheData));
      } catch (cacheError) {
        log.warn({ error: cacheError }, 'Cache write failed');
      }
    }

    logApiPerformance(log, 'catalog-teams', startTime, {
      team_count: teams.length,
      sport,
      search_query: q || null,
    });

    return NextResponse.json(
      {
        teams,
        meta: {
          total: teams.length,
          sport: sport.toUpperCase(),
          query: q || null,
          source: 'database',
          cache_hit: false,
          timestamp: new Date().toISOString(),
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': q
            ? 'public, s-maxage=30, stale-while-revalidate=60'
            : 'public, s-maxage=600, stale-while-revalidate=1800',
        },
      }
    );
  } catch (error) {
    const body = metadataError(
      'TEAMS_CATALOG_UNAVAILABLE',
      error instanceof Error ? error.message : 'Unknown error'
    );
    log.error(
      { ...body, stack: error instanceof Error ? error.stack : undefined },
      'Unexpected error in teams catalog endpoint'
    );
    return NextResponse.json(body, { status: 500 });
  }
}

// Health check
export async function HEAD() {
  try {
    const sb = supabaseServer();
    const { error } = await sb.from('teams').select('count').limit(1).single();
    return NextResponse.json(null, { status: error ? 503 : 200 });
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}
