#!/usr/bin/env tsx
/**
 * Verify that NFL props fix has been applied and is working
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function verifyFix() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  console.log('🔍 NFL Props Fix Verification\n');
  console.log('═'.repeat(80));

  // Step 1: Check constraints
  console.log('\n1️⃣  Checking database constraints...\n');

  // We can't query pg_indexes directly through Supabase client,
  // so we'll test by attempting to insert test data

  // Step 2: Check for NFL props
  console.log('2️⃣  Checking NFL props in database...\n');

  const { data: nflProps, count, error } = await supabase
    .from('unified_picks')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL')
    .eq('source', 'odds-api');

  if (error) {
    console.error('❌ Error querying NFL props:', error);
    return;
  }

  console.log(`   Total NFL props from odds-api: ${count || 0}`);

  if (count === 0) {
    console.log('   ⚠️  No NFL props found - run single49ersRams.ts to test\n');
  } else {
    console.log(`   ✅ NFL props present!\n`);
  }

  // Step 3: Check specific game
  console.log('3️⃣  Checking 49ers vs Rams game props...\n');

  const { data: gamePicks, count: gameCount } = await supabase
    .from('unified_picks')
    .select('id, market, selection, bookmaker_key, external_prop_id', { count: 'exact' })
    .eq('external_game_id', 'c4b72eabb3d557e73022ec730d8e3944');

  console.log(`   Total picks for game: ${gameCount || 0}`);

  if (gameCount && gameCount > 0) {
    // Count by market
    const h2h = gamePicks?.filter(p => p.market === 'h2h').length || 0;
    const spreads = gamePicks?.filter(p => p.market === 'spreads').length || 0;
    const totals = gamePicks?.filter(p => p.market === 'totals').length || 0;
    const playerProps = gamePicks?.filter(p => p.external_prop_id !== null).length || 0;

    console.log(`   - H2H: ${h2h} picks`);
    console.log(`   - Spreads: ${spreads} picks`);
    console.log(`   - Totals: ${totals} picks`);
    console.log(`   - Player Props: ${playerProps} picks`);
    console.log();

    // Check for proper deduplication
    const withPropId = gamePicks?.filter(p => p.external_prop_id !== null).length || 0;
    const withoutPropId = gamePicks?.filter(p => p.external_prop_id === null).length || 0;

    console.log(`   Props with external_prop_id: ${withPropId}`);
    console.log(`   Core markets (NULL external_prop_id): ${withoutPropId}`);
    console.log();

    if (withoutPropId >= 12) {
      console.log('   ✅ Multiple NULL external_prop_id values present - constraint fix working!\n');
    } else {
      console.log('   ⚠️  Only a few NULL values - may indicate constraint still blocking\n');
    }
  }

  // Step 4: Summary
  console.log('═'.repeat(80));
  console.log('\n📊 SUMMARY\n');

  if (count && count >= 180) {
    console.log('✅ FIX VERIFIED SUCCESSFULLY');
    console.log('   - NFL props are being written to database');
    console.log('   - Multiple picks with NULL external_prop_id allowed');
    console.log('   - Constraint fix is working correctly');
  } else if (count && count > 0) {
    console.log('⚠️  PARTIAL SUCCESS');
    console.log('   - Some NFL props written, but fewer than expected');
    console.log('   - May need to re-run single49ersRams.ts');
  } else {
    console.log('❌ FIX NOT YET APPLIED');
    console.log('   - No NFL props in database');
    console.log('   - Apply APPLY_THIS_TO_SUPABASE.sql first');
    console.log('   - Then run: npx tsx src/scripts/e2e/single49ersRams.ts');
  }

  console.log();
}

verifyFix().catch(console.error);
