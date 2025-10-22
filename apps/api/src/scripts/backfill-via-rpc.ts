#!/usr/bin/env tsx
/**
 * Backfill market_props via server-side RPC to avoid timeout
 * Date: 2025-10-20
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function backfillViaRPC() {
  console.log('🔄 Backfilling market_props via RPC...\n');

  // First, create the RPC function if it doesn't exist
  const createFunctionSQL = `
CREATE OR REPLACE FUNCTION backfill_market_props_today()
RETURNS TABLE (
  inserted_count bigint,
  skipped_count bigint
) AS $$
DECLARE
  v_inserted bigint := 0;
  v_skipped bigint := 0;
  v_today date := CURRENT_DATE;
BEGIN
  -- Insert from raw_props to market_props for today
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
      rp.line,
      rp.odds,
      rp.over_odds,
      rp.under_odds,
      COALESCE((rp.metadata->>'bookmaker_key')::text, (rp.metadata->>'bookmaker')::text, 'unknown'),
      (rp.metadata->>'best_book')::text,
      (rp.metadata->>'best_available_line')::numeric,
      rp.game_date,
      rp.game_time,
      COALESCE((rp.metadata->>'player_name')::text, rp.player_name),
      (rp.metadata->>'team')::text,
      (rp.metadata->>'opponent')::text,
      COALESCE(rp.external_prop_id, 'raw_' || rp.id::text),
      rp.external_game_id,
      rp.game_id,
      rp.metadata
    FROM public.raw_props rp
    WHERE rp.game_date >= v_today
    ON CONFLICT (bookmaker_key, external_prop_id) DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*) INTO v_inserted FROM inserted;

  -- Count total raw_props for today
  SELECT COUNT(*) - v_inserted INTO v_skipped
  FROM public.raw_props
  WHERE game_date >= v_today;

  RETURN QUERY SELECT v_inserted, v_skipped;
END;
$$ LANGUAGE plpgsql;
  `;

  console.log('Creating backfill RPC function...');
  const { error: createError } = await supabase.rpc('exec_sql', { sql: createFunctionSQL });
  
  if (createError && !createError.message.includes('does not exist')) {
    // Try direct execution via a different approach
    console.log('Note: exec_sql RPC may not exist, function might already be created');
  }

  // Execute the backfill
  console.log('Executing backfill...\n');
  const { data, error } = await supabase.rpc('backfill_market_props_today');

  if (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Manual SQL to run in Supabase SQL Editor:');
    console.log(createFunctionSQL);
    console.log('\nThen run: SELECT * FROM backfill_market_props_today();');
    process.exit(1);
  }

  console.log('✅ Backfill complete!');
  console.log(`  Inserted: ${data?.[0]?.inserted_count || 0}`);
  console.log(`  Skipped: ${data?.[0]?.skipped_count || 0}`);

  // Verify
  const { count } = await supabase
    .from('market_props')
    .select('*', { count: 'exact', head: true })
    .gte('game_date', new Date().toISOString().split('T')[0]);

  console.log(`\nTotal market_props today: ${count}\n`);
}

backfillViaRPC().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

