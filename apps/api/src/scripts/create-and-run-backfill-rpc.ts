#!/usr/bin/env tsx
/**
 * Create backfill RPC function and execute it
 * Date: 2025-10-20
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function createAndRunBackfill() {
  console.log('🔧 Creating backfill RPC function...\n');

  const createFunctionSQL = `
CREATE OR REPLACE FUNCTION backfill_market_props_today(batch_limit int DEFAULT 10000)
RETURNS TABLE (
  inserted_count bigint,
  skipped_count bigint,
  total_market_props bigint
) AS $$
DECLARE
  v_inserted bigint := 0;
  v_total bigint := 0;
BEGIN
  WITH inserted AS (
    INSERT INTO public.market_props (
      sport, market, selection, line, odds, over_odds, under_odds,
      bookmaker_key, best_book, best_available_line,
      game_date, game_time, player_name, team, opponent,
      external_prop_id, external_game_id, game_id, metadata
    )
    SELECT
      COALESCE((rp.metadata->>'sport')::text, rp.sport, 'NFL'),
      COALESCE((rp.metadata->>'market')::text, (rp.metadata->>'market_type')::text, 'player_prop'),
      COALESCE(rp.selection, (rp.metadata->>'selection')::text),
      rp.line, rp.odds, rp.over_odds, rp.under_odds,
      COALESCE((rp.metadata->>'bookmaker_key')::text, (rp.metadata->>'bookmaker')::text, 'unknown'),
      (rp.metadata->>'best_book')::text,
      (rp.metadata->>'best_available_line')::numeric,
      rp.game_date, rp.game_time,
      COALESCE((rp.metadata->>'player_name')::text, rp.player_name),
      (rp.metadata->>'team')::text,
      (rp.metadata->>'opponent')::text,
      COALESCE(rp.external_prop_id, 'raw_' || rp.id::text),
      rp.external_game_id, rp.game_id, rp.metadata
    FROM public.raw_props rp
    WHERE rp.game_date >= CURRENT_DATE
    LIMIT batch_limit
    ON CONFLICT (bookmaker_key, external_prop_id) DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*) INTO v_inserted FROM inserted;
  
  SELECT COUNT(*) INTO v_total FROM public.market_props WHERE game_date >= CURRENT_DATE;
  
  RETURN QUERY SELECT v_inserted, (batch_limit - v_inserted)::bigint, v_total;
END;
$$ LANGUAGE plpgsql;
  `;

  // Write SQL to file for manual execution if needed
  fs.writeFileSync('apps/api/out/ops/backfill_function.sql', createFunctionSQL);
  console.log('📄 SQL saved to: apps/api/out/ops/backfill_function.sql\n');

  console.log('⚠️  Supabase client cannot create functions directly.\n');
  console.log('Please run the following in Supabase SQL Editor:\n');
  console.log('https://supabase.com/dashboard/project/cqfnsozknjzvyiziwicl/sql\n');
  console.log(createFunctionSQL);
  console.log('\nThen run: SELECT * FROM backfill_market_props_today(50000);\n');
  console.log('Run multiple times until total_market_props >= 1000\n');

  // Try to call the function if it already exists
  console.log('Attempting to call backfill function (if it exists)...\n');

  const { data, error } = await supabase.rpc('backfill_market_props_today', { batch_limit: 50000 });

  if (error) {
    console.error(`❌ Error: ${error.message}`);
    console.log("\nThe function likely doesn't exist yet. Please create it manually.\n");
    process.exit(1);
  }

  console.log('✅ Backfill executed!\n');
  console.log(`Inserted: ${data?.[0]?.inserted_count || 0}`);
  console.log(`Skipped: ${data?.[0]?.skipped_count || 0}`);
  console.log(`Total market_props today: ${data?.[0]?.total_market_props || 0}\n`);

  if ((data?.[0]?.total_market_props || 0) < 1000) {
    console.log('⚠️  Less than 1000 props. Run again to continue.\n');
    process.exit(1);
  }

  process.exit(0);
}

createAndRunBackfill().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
