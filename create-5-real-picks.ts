#!/usr/bin/env tsx
/**
 * Create 5 Real Picks using Real NFL Props
 *
 * This script:
 * 1. Fetches 5 real NFL props from database
 * 2. Creates picks in unified_picks with auto-approval
 * 3. Verifies picks are created correctly
 */

import { createClient } from '@supabase/supabase-js';
import { getRealProps, RealProp } from './apps/api/src/scripts/get-real-props';

const SUPABASE_URL = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// User ID for griff843
const CAPPER_ID = '0aca56c1-b9d9-4fde-b9e1-914d779e50ba';

async function createRealPicks() {
  console.log('🎯 CREATING 5 REAL PICKS FROM DATABASE\n');
  console.log('='.repeat(80));

  // Step 1: Fetch real props
  console.log('\n📊 Step 1: Fetching real NFL props...\n');
  const realProps = await getRealProps(5, 'NFL');

  if (!realProps || realProps.length === 0) {
    console.error('❌ No real props available');
    process.exit(1);
  }

  console.log(`✅ Fetched ${realProps.length} real props\n`);

  // Step 2: Create picks
  console.log('='.repeat(80));
  console.log('\n📝 Step 2: Creating picks in unified_picks...\n');

  const createdPicks: any[] = [];

  for (let i = 0; i < realProps.length; i++) {
    const prop = realProps[i];
    console.log(`\n🏈 Creating pick ${i + 1}/${realProps.length}:`);
    console.log(`   ${prop.player_name} - ${prop.market} ${prop.selection} ${prop.line}`);

    // Calculate potential payout
    const stake = 2.0;
    const odds = prop.odds;
    const potentialPayout = odds > 0
      ? stake * (1 + odds / 100)
      : stake * (1 + 100 / Math.abs(odds));

    const pick = {
      player_name: prop.player_name,
      sport: prop.sport,
      market: prop.market,
      selection: prop.selection,
      line: prop.line,
      odds: prop.odds,
      bookmaker_key: prop.bookmaker_key,
      game_date: prop.game_date,
      matchup: `${prop.team || 'Unknown'} vs ${prop.opponent}`,
      user_id: CAPPER_ID,
      stake: stake,
      potential_payout: potentialPayout,
      pick_type: 'player_props',
      tier_when_placed: 'A',
      confidence: 70,
      // AUTO-APPROVAL for user submissions
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: 'auto_system',
      promoted: false, // Will be promoted by PromotionAgent
      posted_at: null,
      discord_message_id: null,
      created_at: new Date().toISOString(),
      source: 'api_script',
      metadata: {
        real_prop: true,
        auto_approved: true,
        created_via: 'create-5-real-picks script',
        prop_source: 'raw_props table'
      }
    };

    const { data: insertedPick, error } = await supabase
      .from('unified_picks')
      .insert(pick)
      .select()
      .single();

    if (error) {
      console.error(`   ❌ Failed to create pick:`, error.message);
      continue;
    }

    console.log(`   ✅ Pick created: ${insertedPick.id}`);
    createdPicks.push(insertedPick);
  }

  // Step 3: Verification
  console.log('\n' + '='.repeat(80));
  console.log('\n✅ PICKS CREATION COMPLETE\n');
  console.log(`📊 Created: ${createdPicks.length}/${realProps.length} picks`);

  if (createdPicks.length > 0) {
    console.log('\n📋 Created Pick IDs:');
    createdPicks.forEach((pick, i) => {
      console.log(`   ${i + 1}. ${pick.id} - ${pick.player_name} ${pick.market} ${pick.selection} ${pick.line}`);
    });

    console.log('\n✅ Next Steps:');
    console.log('   1. Check Command Center: http://localhost:3004');
    console.log('   2. Check Discord for posted picks');
    console.log('   3. Verify picks in database:');
    console.log(`      SELECT * FROM unified_picks WHERE id IN ('${createdPicks.map(p => p.id).join("','")}');`);
  }

  console.log('\n' + '='.repeat(80));
}

createRealPicks().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
