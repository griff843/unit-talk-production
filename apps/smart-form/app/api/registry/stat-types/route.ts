import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase';
import { createRouteLogger, logDatabaseOperation, logApiPerformance } from '@/lib/logger';
import {
  CONTRACT_VERSION,
  buildContractMeta,
  buildContractError,
} from '@/lib/contracts/smartform-data-contract-v1';

const log = createRouteLogger('GET /api/registry/stat-types', 'GET');

/**
 * SPRINT-SMARTFORM-DATA-CONTRACTS-MANUAL-INVENTORY-059
 *
 * Stat Types Registry Endpoint - Contract Surface V1.0.1
 *
 * STRATEGY: Manual-Usage-First with Taxonomy Fallback
 *
 * 1. Query market_usage_stats_v1 for markets used in manual submissions
 * 2. Query market_taxonomy_v1 for display names and all valid markets
 * 3. Sort by usage_count (most used first), then taxonomy sort_order
 * 4. If no usage data, return full taxonomy (allows form to work without historical data)
 *
 * This endpoint works WITHOUT dependency on live prop feeds.
 *
 * Contract: docs/contracts/SMARTFORM_DATA_CONTRACT_V1.md
 */

const QuerySchema = z.object({
  sport: z.string().min(1, 'sport parameter is required'),
  bet_type: z.string().nullish(),
});

// Contract surface names - the ONLY allowed sources
const USAGE_STATS_SURFACE = 'market_usage_stats_v1';
const TAXONOMY_SURFACE = 'market_taxonomy_v1';

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
        buildContractError(
          'Invalid query parameters',
          'INVALID_PARAMS',
          queryValidation.error.errors
        ),
        { status: 400 }
      );
    }

    const { sport, bet_type } = queryValidation.data;
    const sportUpper = sport.toUpperCase();

    log.info(
      { sport: sportUpper, bet_type, surfaces: [USAGE_STATS_SURFACE, TAXONOMY_SURFACE] },
      'Fetching stat types from contract surfaces'
    );

    const sb = supabaseServer();

    // =========================================================================
    // STEP 1: Query market usage stats from manual submissions
    // =========================================================================
    const { data: usageData, error: usageError } = await sb
      .from(USAGE_STATS_SURFACE)
      .select('market_key, usage_count, unique_players, last_used_at')
      .eq('sport', sportUpper);

    logDatabaseOperation(log, 'SELECT', USAGE_STATS_SURFACE, usageData, usageError);

    // Build usage lookup
    interface UsageRow {
      market_key: string;
      usage_count: number;
      unique_players: number;
      last_used_at: string | null;
    }

    const usageMap = new Map<
      string,
      {
        usage_count: number;
        unique_players: number;
        last_used_at: string | null;
      }
    >();

    if (!usageError && usageData) {
      for (const row of usageData as UsageRow[]) {
        usageMap.set(row.market_key.toUpperCase(), {
          usage_count: row.usage_count,
          unique_players: row.unique_players,
          last_used_at: row.last_used_at,
        });
      }
    }

    const hasUsageData = usageMap.size > 0;

    log.info(
      {
        usage_market_count: usageMap.size,
        has_usage_data: hasUsageData,
      },
      'Usage stats query complete'
    );

    // =========================================================================
    // STEP 2: Query taxonomy for display names and all valid markets
    // =========================================================================
    let taxonomyQuery = sb
      .from(TAXONOMY_SURFACE)
      .select('market_key, display_name, category, bet_type, sort_order, aliases')
      .eq('sport', sportUpper);

    if (bet_type) {
      taxonomyQuery = taxonomyQuery.eq('bet_type', bet_type);
    }

    taxonomyQuery = taxonomyQuery.order('sort_order');

    const { data: taxonomyData, error: taxonomyError } = await taxonomyQuery;

    logDatabaseOperation(log, 'SELECT', TAXONOMY_SURFACE, taxonomyData, taxonomyError);

    if (taxonomyError) {
      // FAIL-CLOSED: Taxonomy is required
      log.error(
        { error: taxonomyError.message, code: taxonomyError.code, surface: TAXONOMY_SURFACE },
        'Taxonomy surface query failed'
      );
      return NextResponse.json(
        buildContractError(
          `Taxonomy surface unavailable: ${taxonomyError.message}`,
          'CONTRACT_SURFACE_ERROR',
          { surface: TAXONOMY_SURFACE, pg_code: taxonomyError.code }
        ),
        { status: 503 }
      );
    }

    // Build taxonomy lookup
    interface TaxonomyRow {
      market_key: string;
      display_name: string;
      category: string;
      bet_type: string;
      sort_order: number;
      aliases: string[] | null;
    }

    const taxonomyMap = new Map<
      string,
      {
        display_name: string;
        category: string;
        sort_order: number;
      }
    >();

    for (const row of (taxonomyData || []) as TaxonomyRow[]) {
      taxonomyMap.set(row.market_key.toUpperCase(), {
        display_name: row.display_name,
        category: row.category,
        sort_order: row.sort_order,
      });
    }

    // =========================================================================
    // STEP 3: Build stat_types response
    // =========================================================================
    interface StatTypeResult {
      code: string;
      display_name: string;
      category: string;
      source: 'manual_inventory' | 'taxonomy';
      has_inventory: boolean;
      inventory_count?: number;
      usage_count?: number;
      last_used_at?: string | null;
    }

    const statTypes: StatTypeResult[] = [];

    // Add all markets from taxonomy, enriched with usage data
    for (const row of (taxonomyData || []) as TaxonomyRow[]) {
      const marketKey = row.market_key.toUpperCase();
      const usage = usageMap.get(marketKey);

      statTypes.push({
        code: marketKey,
        display_name: row.display_name,
        category: row.category,
        source: usage ? 'manual_inventory' : 'taxonomy',
        has_inventory: !!usage,
        inventory_count: usage?.usage_count || 0,
        usage_count: usage?.usage_count || 0,
        last_used_at: usage?.last_used_at || null,
      });
    }

    // Sort: markets with usage first (by usage_count desc), then by taxonomy sort_order
    statTypes.sort((a, b) => {
      // Markets with usage data come first
      if (a.has_inventory && !b.has_inventory) return -1;
      if (!a.has_inventory && b.has_inventory) return 1;

      // If both have usage, sort by usage_count descending
      if (a.has_inventory && b.has_inventory) {
        const usageDiff = (b.usage_count || 0) - (a.usage_count || 0);
        if (usageDiff !== 0) return usageDiff;
      }

      // Fall back to taxonomy sort_order
      const sortA = taxonomyMap.get(a.code)?.sort_order ?? 999;
      const sortB = taxonomyMap.get(b.code)?.sort_order ?? 999;
      if (sortA !== sortB) return sortA - sortB;

      return a.code.localeCompare(b.code);
    });

    // Build response
    const response = {
      stat_types: statTypes,
      meta: {
        ...buildContractMeta(sportUpper, statTypes.length),
        bet_type: bet_type || null,
        inventory_first: true,
        taxonomy_fallback: !hasUsageData,
        manual_usage_enabled: true,
      },
    };

    logApiPerformance(log, 'registry-stat-types-v1.0.1', startTime, {
      stat_types_count: statTypes.length,
      sport: sportUpper,
      has_usage_data: hasUsageData,
      markets_with_usage: usageMap.size,
    });

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': hasUsageData
          ? 'public, s-maxage=300, stale-while-revalidate=600' // 5 min if usage data
          : 'public, s-maxage=3600, stale-while-revalidate=7200', // 1 hour for taxonomy-only
        'X-Contract-Version': CONTRACT_VERSION,
        'X-Manual-Usage-Enabled': 'true',
        'X-Taxonomy-Fallback': String(!hasUsageData),
      },
    });
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Unexpected error in stat-types registry endpoint'
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

// Health check
export async function HEAD() {
  try {
    const sb = supabaseServer();
    const { error } = await sb.from(TAXONOMY_SURFACE).select('market_key').limit(1);

    return NextResponse.json(null, {
      status: error ? 503 : 200,
      headers: {
        'X-Contract-Version': CONTRACT_VERSION,
        'X-Contract-Surfaces': `${USAGE_STATS_SURFACE},${TAXONOMY_SURFACE}`,
      },
    });
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}
