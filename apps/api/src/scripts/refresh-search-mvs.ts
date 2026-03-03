/**
 * SEARCH-CATALOG-CONTRACT-035: Search MV Refresh Script
 *
 * Refreshes materialized views used by Smart Form search/catalog.
 *
 * MVs refreshed:
 * - mv_search_teams (team search with trigram)
 * - mv_search_players (player search with team info)
 * - mv_search_games (game selection for Smart Form)
 * - mv_props_for_form (prop filtering)
 *
 * Usage:
 *   npx tsx src/scripts/refresh-search-mvs.ts [--all|--teams|--players|--games|--props]
 *
 * Schedule (recommended):
 *   - mv_search_teams: Every 1 hour
 *   - mv_search_players: Every 1 hour
 *   - mv_search_games: Every 15 minutes
 *   - mv_props_for_form: Every 2 minutes
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface RefreshResult {
  view: string;
  success: boolean;
  duration_ms: number;
  error?: string;
}

const SEARCH_MVS = [
  'mv_search_teams',
  'mv_search_players',
  'mv_search_games',
  'mv_props_for_form',
] as const;

type SearchMV = (typeof SEARCH_MVS)[number];

async function refreshMV(viewName: SearchMV): Promise<RefreshResult> {
  const startTime = Date.now();
  console.log(`[refresh-search-mvs] Refreshing ${viewName}...`);

  try {
    // Use the RPC function we created in the migration
    const { error } = await supabase.rpc('refresh_search_mv', {
      view_name: viewName,
    });

    if (error) {
      throw error;
    }

    const duration = Date.now() - startTime;
    console.log(`[refresh-search-mvs] ✓ ${viewName} refreshed in ${duration}ms`);

    return {
      view: viewName,
      success: true,
      duration_ms: duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`[refresh-search-mvs] ✗ ${viewName} failed: ${errorMessage}`);

    return {
      view: viewName,
      success: false,
      duration_ms: duration,
      error: errorMessage,
    };
  }
}

async function refreshAllMVs(): Promise<RefreshResult[]> {
  console.log('[refresh-search-mvs] Starting full refresh...');
  const startTime = Date.now();

  // Use the batch refresh RPC function
  try {
    const { error } = await supabase.rpc('refresh_search_mvs');

    if (error) {
      throw error;
    }

    const duration = Date.now() - startTime;
    console.log(`[refresh-search-mvs] ✓ All MVs refreshed in ${duration}ms`);

    return SEARCH_MVS.map(mv => ({
      view: mv,
      success: true,
      duration_ms: duration / SEARCH_MVS.length,
    }));
  } catch (error) {
    // Fallback to individual refresh
    console.warn('[refresh-search-mvs] Batch refresh failed, trying individual...');

    const results: RefreshResult[] = [];
    for (const mv of SEARCH_MVS) {
      results.push(await refreshMV(mv));
    }
    return results;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const startTime = Date.now();

  console.log('='.repeat(60));
  console.log('SEARCH-CATALOG-CONTRACT-035: MV Refresh');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  let results: RefreshResult[];

  if (args.includes('--all') || args.length === 0) {
    results = await refreshAllMVs();
  } else {
    results = [];

    if (args.includes('--teams')) {
      results.push(await refreshMV('mv_search_teams'));
    }
    if (args.includes('--players')) {
      results.push(await refreshMV('mv_search_players'));
    }
    if (args.includes('--games')) {
      results.push(await refreshMV('mv_search_games'));
    }
    if (args.includes('--props')) {
      results.push(await refreshMV('mv_props_for_form'));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Summary:');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`  Successful: ${successful.length}`);
  console.log(`  Failed: ${failed.length}`);
  console.log(`  Total time: ${Date.now() - startTime}ms`);

  if (failed.length > 0) {
    console.log('\nFailed MVs:');
    failed.forEach(r => {
      console.log(`  - ${r.view}: ${r.error}`);
    });
  }

  console.log('='.repeat(60));

  // Exit with error code if any failed
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
