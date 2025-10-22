#!/usr/bin/env tsx
/**
 * CI Admin RPC Runner
 * Date: 2025-10-20
 * Purpose: Call SECURITY DEFINER admin functions via RPC from GitHub Actions
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[ERROR] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runBackfill(days: number = 3): Promise<void> {
  console.log(`\n[BACKFILL] Running admin_backfill_market_props(${days})...`);

  const { data, error } = await supabase.rpc('admin_backfill_market_props', { p_days: days });

  if (error) {
    console.error(`[ERROR] Backfill failed: ${error.message}`);
    throw error;
  }

  const result = Array.isArray(data) ? data[0] : data;
  console.log(`[SUCCESS] Backfill complete:`);
  console.log(`   Rows inserted: ${result.rows_inserted}`);
  console.log(`   Rows skipped: ${result.rows_skipped}`);
  console.log(`   Total market_props: ${result.total_market_props}`);

  if (result.total_market_props < 1000) {
    console.warn(`[WARNING] Only ${result.total_market_props} market_props (target: 1000+)`);
  }
}

async function runScoring(): Promise<void> {
  console.log(`\n[SCORING] Running scoring loop...`);

  let iteration = 1;
  let totalScored = 0;

  while (iteration <= 20) {  // Max 20 iterations to prevent infinite loop
    console.log(`\n  Iteration ${iteration}:`);

    const { data, error } = await supabase.rpc('admin_score_batch', { p_limit: 5000 });

    if (error) {
      console.error(`[ERROR] Scoring failed: ${error.message}`);
      throw error;
    }

    const result = Array.isArray(data) ? data[0] : data;
    const scored = result.rows_scored || 0;
    const remaining = result.rows_remaining || 0;

    console.log(`   Scored: ${scored}, Remaining: ${remaining}`);

    totalScored += scored;

    if (scored === 0 || remaining === 0) {
      console.log(`\n[SUCCESS] Scoring complete! Total scored: ${totalScored}`);
      break;
    }

    iteration++;
  }

  if (iteration > 20) {
    console.warn(`[WARNING] Reached max iterations (20)`);
  }
}

async function refreshViews(): Promise<void> {
  console.log(`\n[REFRESH] Refreshing views...`);

  const { data, error } = await supabase.rpc('admin_refresh_views');

  if (error) {
    console.error(`[ERROR] View refresh failed: ${error.message}`);
    throw error;
  }

  console.log(`[SUCCESS] Views refreshed:`);
  
  if (Array.isArray(data)) {
    data.forEach((view: any) => {
      console.log(`   ${view.view_name}: ${view.rows_count} rows (${view.refresh_duration_ms}ms)`);
    });
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('CI Admin RPC Runner');
  console.log('Date: 2025-10-20');
  console.log('='.repeat(60));

  // Wait for PostgREST schema cache to reload after migration
  console.log('\n[INFO] Waiting 5 seconds for PostgREST schema cache to reload...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log('[INFO] Schema cache should be refreshed. Starting RPC calls...\n');

  try {
    // Step 1: Backfill
    await runBackfill(3);
    
    // Step 2: Score
    await runScoring();
    
    // Step 3: Refresh views
    await refreshViews();
    
    console.log('\n' + '='.repeat(60));
    console.log('[SUCCESS] All admin RPCs completed successfully!');
    console.log('='.repeat(60));
    console.log('');

    process.exit(0);

  } catch (error: any) {
    console.error('\n' + '='.repeat(60));
    console.error('[ERROR] Admin RPC execution failed!');
    console.error('Error:', error.message);
    console.error('='.repeat(60));
    console.error('');
    process.exit(1);
  }
}

main();

