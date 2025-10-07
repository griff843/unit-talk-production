#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkNFLData() {
  console.log('🔍 INVESTIGATING MISSING NFL DATA (Chiefs vs Jags MNF)\n');
  console.log('='.repeat(70));

  // Check raw_props for NFL
  console.log('\n1️⃣  CHECKING RAW_PROPS (Source Data):');
  const { data: rawNFL, count: rawNFLCount } = await supabase
    .from('raw_props')
    .select('id, sport, player_name, game_date, bookmaker_key, created_at', { count: 'exact' })
    .eq('sport', 'NFL')
    .limit(5);

  console.log(`   Total NFL props in raw_props: ${rawNFLCount || 0}`);
  if (rawNFL && rawNFL.length > 0) {
    console.log('   Sample:');
    rawNFL.forEach(p => {
      console.log(`     - ${p.player_name} | Date: ${p.game_date} | Source: ${p.bookmaker_key}`);
    });
  }

  // Check market_props for NFL
  console.log('\n2️⃣  CHECKING MARKET_PROPS (Normalized):');
  const { data: marketNFL, count: marketNFLCount } = await supabase
    .from('market_props')
    .select('id, sport, player_name, game_date, bookmaker_key, created_at', { count: 'exact' })
    .eq('sport', 'NFL')
    .limit(5);

  console.log(`   Total NFL props in market_props: ${marketNFLCount || 0}`);
  if (marketNFL && marketNFL.length > 0) {
    console.log('   Sample:');
    marketNFL.forEach(p => {
      console.log(`     - ${p.player_name} | Date: ${p.game_date} | Source: ${p.bookmaker_key}`);
    });
  }

  // Check sports_game_odds (SGO adapter data)
  console.log('\n3️⃣  CHECKING SPORTS_GAME_ODDS (SGO Adapter):');
  const { data: sgoNFL, count: sgoNFLCount } = await supabase
    .from('sports_game_odds')
    .select('id, sport, player_name, game_date, created_at', { count: 'exact' })
    .eq('sport', 'NFL')
    .limit(5);

  console.log(`   Total NFL props in sports_game_odds: ${sgoNFLCount || 0}`);
  if (sgoNFL && sgoNFL.length > 0) {
    console.log('   Sample:');
    sgoNFL.forEach(p => {
      console.log(`     - ${p.player_name} | Date: ${p.game_date}`);
    });
  }

  // Check all sports to see what we DO have
  console.log('\n4️⃣  CHECKING ALL SPORTS IN MARKET_PROPS:');
  const { data: allSports } = await supabase
    .from('market_props')
    .select('sport')
    .limit(1000);

  const sportCounts: Record<string, number> = {};
  allSports?.forEach(row => {
    sportCounts[row.sport] = (sportCounts[row.sport] || 0) + 1;
  });

  console.log('   Sports found:');
  Object.entries(sportCounts).forEach(([sport, count]) => {
    console.log(`     ${sport}: ${count} props`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('\n📊 DIAGNOSIS:\n');

  if (rawNFLCount === 0 && marketNFLCount === 0 && sgoNFLCount === 0) {
    console.log('❌ NO NFL DATA IN ANY TABLE');
    console.log('\n🔧 ISSUE: Data ingestion not running for NFL');
    console.log('\nPossible causes:');
    console.log('   1. Odds API not configured for NFL (americanfootball_nfl)');
    console.log('   2. FeedAgent not running for NFL sport');
    console.log('   3. API key expired or rate limited');
    console.log('   4. NFL sport key mismatch in configuration');
    console.log('\n🎯 TIER 1 STATUS: ❌ NOT CONFIRMED - Missing NFL ingestion');
  } else if (rawNFLCount > 0 && marketNFLCount === 0) {
    console.log('⚠️  DATA IN RAW_PROPS BUT NOT NORMALIZED');
    console.log('\n🔧 ISSUE: Normalization not running or failing for NFL');
    console.log('\n🎯 TIER 1 STATUS: ⚠️  PARTIAL - Ingestion works, normalization broken');
  } else if (marketNFLCount > 0) {
    console.log('✅ NFL DATA PRESENT IN MARKET_PROPS');
    console.log('\n🎯 TIER 1 STATUS: ✅ CONFIRMED - Just filtering issue in previous query');
  }

  console.log('');
}

checkNFLData().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
