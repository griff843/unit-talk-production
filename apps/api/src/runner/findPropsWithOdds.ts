/**
 * Find Props With Odds Data
 * Search for any props that have odds information
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function findPropsWithOdds() {
  console.log('🔍 SEARCHING FOR PROPS WITH ODDS DATA');
  console.log('='.repeat(50));

  try {
    // Count total props
    const { count: totalCount } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 Total raw props: ${totalCount}`);

    // Look for any props with over odds
    const { data: propsWithOverOdds, count: overOddsCount } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact' })
      .not('over_odds', 'is', null)
      .limit(5);

    console.log(`📊 Props with over_odds: ${overOddsCount || 0}`);

    // Look for any props with under odds
    const { data: propsWithUnderOdds, count: underOddsCount } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact' })
      .not('under_odds', 'is', null)
      .limit(5);

    console.log(`📊 Props with under_odds: ${underOddsCount || 0}`);

    // Look for props with 'over' field populated
    const { data: propsWithOver, count: overCount } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact' })
      .not('over', 'is', null)
      .limit(5);

    console.log(`📊 Props with over field: ${overCount || 0}`);

    // Look for props with 'under' field populated
    const { data: propsWithUnder, count: underCount } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact' })
      .not('under', 'is', null)
      .limit(5);

    console.log(`📊 Props with under field: ${underCount || 0}`);

    // Look for props with outcome field
    const { data: propsWithOutcome, count: outcomeCount } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact' })
      .not('outcome', 'is', null)
      .limit(5);

    console.log(`📊 Props with outcome field: ${outcomeCount || 0}`);

    // Sample different providers
    const { data: providersData } = await supabase
      .from('raw_props')
      .select('provider, source')
      .not('provider', 'is', null)
      .limit(20);

    if (providersData) {
      const providers = [...new Set(providersData.map(p => p.provider))];
      const sources = [...new Set(providersData.map(p => p.source))];
      console.log(`📊 Data providers found: ${providers.join(', ')}`);
      console.log(`📊 Data sources found: ${sources.join(', ')}`);
    }

    if (propsWithOver && propsWithOver.length > 0) {
      console.log('\n📋 SAMPLE PROPS WITH OVER DATA:');
      propsWithOver.forEach((prop, i) => {
        console.log(`${i + 1}. ${prop.player_name} ${prop.stat_type} ${prop.line}`);
        console.log(`   over: ${prop.over}, under: ${prop.under}`);
        console.log(`   over_odds: ${prop.over_odds}, under_odds: ${prop.under_odds}`);
        console.log(`   provider: ${prop.provider}, source: ${prop.source}`);
        console.log(`   created: ${prop.created_at}`);
      });
    }

    if (propsWithOutcome && propsWithOutcome.length > 0) {
      console.log('\n📋 SAMPLE PROPS WITH OUTCOME DATA:');
      propsWithOutcome.forEach((prop, i) => {
        console.log(`${i + 1}. ${prop.player_name} ${prop.stat_type} ${prop.line}`);
        console.log(`   outcome: ${prop.outcome}`);
        console.log(`   provider: ${prop.provider}, source: ${prop.source}`);
      });
    }

    // Check if we have non-Optimal data
    const { data: nonOptimalProps, count: nonOptimalCount } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact' })
      .neq('provider', 'Optimal')
      .limit(5);

    console.log(`📊 Non-Optimal props: ${nonOptimalCount || 0}`);

    if (nonOptimalProps && nonOptimalProps.length > 0) {
      console.log('\n📋 SAMPLE NON-OPTIMAL PROPS:');
      nonOptimalProps.forEach((prop, i) => {
        console.log(`${i + 1}. ${prop.player_name} ${prop.stat_type} ${prop.line}`);
        console.log(`   over: ${prop.over}, under: ${prop.under}`);
        console.log(`   provider: ${prop.provider}, source: ${prop.source}`);
      });
    }
  } catch (error) {
    console.error('❌ Error searching for odds data:', error);
  }
}

findPropsWithOdds()
  .then(() => {
    console.log('\n✅ ODDS SEARCH COMPLETE');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Odds search failed:', error);
    process.exit(1);
  });
