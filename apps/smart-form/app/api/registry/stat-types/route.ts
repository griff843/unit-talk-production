import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase';
import { createRouteLogger, logDatabaseOperation, logApiPerformance } from '@/lib/logger';
import {
  CONTRACT_VERSION,
  StatTypesResponseSchema,
  buildContractMeta,
  buildContractError,
} from '@/lib/contracts/smartform-data-contract-v1';

const log = createRouteLogger('GET /api/registry/stat-types', 'GET');

/**
 * SPRINT-SMARTFORM-DATA-CONTRACTS-INVENTORY-SURFACE-059
 *
 * Stat Types Registry Endpoint - Contract Surface V1
 *
 * STRATEGY: Inventory-First with Taxonomy Fallback
 *
 * 1. Query inventory_props_for_form_v1 for distinct market_keys with live data
 * 2. Intersect with market_taxonomy_v1 to get display names and metadata
 * 3. If inventory is empty, return taxonomy as fallback (clearly marked)
 *
 * Contract: docs/contracts/SMARTFORM_DATA_CONTRACT_V1.md
 */

const QuerySchema = z.object({
  sport: z.string().min(1, 'sport parameter is required'),
  bet_type: z.string().nullish(),
});

// Contract surface names - the ONLY allowed sources
const INVENTORY_SURFACE = 'inventory_props_for_form_v1';
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
      { sport: sportUpper, bet_type, surfaces: [INVENTORY_SURFACE, TAXONOMY_SURFACE] },
      'Fetching stat types from contract surfaces'
    );

    const sb = supabaseServer();

    // =========================================================================
    // STEP 1: Query inventory for distinct market_keys with live data
    // =========================================================================
    const { data: inventoryData, error: inventoryError } = await sb
      .from(INVENTORY_SURFACE)
      .select('market_key')
      .eq('sport', sportUpper)
      .not('market_key', 'is', null);

    logDatabaseOperation(log, 'SELECT DISTINCT', INVENTORY_SURFACE, inventoryData, inventoryError);

    // Extract unique market keys from inventory
    const inventoryMarketKeys = new Set<string>();
    const inventoryCounts = new Map<string, number>();

    if (!inventoryError && inventoryData) {
      for (const row of inventoryData as Array<{ market_key: string | null }>) {
        if (row.market_key) {
          const key = row.market_key.toUpperCase();
          inventoryMarketKeys.add(key);
          inventoryCounts.set(key, (inventoryCounts.get(key) || 0) + 1);
        }
      }
    }

    const hasInventory = inventoryMarketKeys.size > 0;

    log.info(
      {
        inventory_market_count: inventoryMarketKeys.size,
        has_inventory: hasInventory,
      },
      'Inventory query complete'
    );

    // =========================================================================
    // STEP 2: Query taxonomy for display names and metadata
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
      source: 'inventory' | 'taxonomy';
      has_inventory: boolean;
      inventory_count?: number;
    }

    const statTypes: StatTypeResult[] = [];

    if (hasInventory) {
      // INVENTORY-FIRST: Only include markets that exist in inventory
      // but enrich with taxonomy metadata
      for (const marketKey of inventoryMarketKeys) {
        const taxonomy = taxonomyMap.get(marketKey);
        statTypes.push({
          code: marketKey,
          display_name: taxonomy?.display_name || marketKey,
          category: taxonomy?.category || 'other',
          source: 'inventory',
          has_inventory: true,
          inventory_count: inventoryCounts.get(marketKey) || 0,
        });
      }

      // Sort by taxonomy sort_order (if available) or alphabetically
      statTypes.sort((a, b) => {
        const sortA = taxonomyMap.get(a.code)?.sort_order ?? 999;
        const sortB = taxonomyMap.get(b.code)?.sort_order ?? 999;
        if (sortA !== sortB) return sortA - sortB;
        return a.code.localeCompare(b.code);
      });
    } else {
      // TAXONOMY FALLBACK: No inventory data, return full taxonomy
      // This allows form to work even without live props
      log.warn({ sport: sportUpper }, 'No inventory data, using taxonomy fallback');

      for (const row of (taxonomyData || []) as TaxonomyRow[]) {
        statTypes.push({
          code: row.market_key,
          display_name: row.display_name,
          category: row.category,
          source: 'taxonomy',
          has_inventory: false,
        });
      }
    }

    // Build response
    const response = {
      stat_types: statTypes,
      meta: {
        ...buildContractMeta(sportUpper, statTypes.length),
        bet_type: bet_type || null,
        inventory_first: true,
        taxonomy_fallback: !hasInventory,
      },
    };

    logApiPerformance(log, 'registry-stat-types-v1', startTime, {
      stat_types_count: statTypes.length,
      sport: sportUpper,
      has_inventory: hasInventory,
      taxonomy_fallback: !hasInventory,
    });

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': hasInventory
          ? 'public, s-maxage=120, stale-while-revalidate=300' // 2 min if live data
          : 'public, s-maxage=3600, stale-while-revalidate=7200', // 1 hour for taxonomy-only
        'X-Contract-Version': CONTRACT_VERSION,
        'X-Inventory-First': 'true',
        'X-Taxonomy-Fallback': String(!hasInventory),
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
        'X-Contract-Surfaces': `${INVENTORY_SURFACE},${TAXONOMY_SURFACE}`,
      },
    });
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}
