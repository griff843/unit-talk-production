#!/usr/bin/env node

/**
 * MINIMAL SGO Backfill - Bypass Schema Cache Issues
 *
 * This version only uses core columns that definitely exist to bypass cache issues
 */

import { fetchAndFlattenSGOProps } from './src/logic/providers/sgoFetcher';
import { supabaseClient } from './src/services/supabaseClient';

const SGO_API_KEY = process.env.SPORTSGAMEODDS_KEY;

async function insertPropsToSupabase(props: any[]) {
  console.log(`📦 Inserting ${props.length} props to Supabase...`);

  // Use only core columns that definitely exist - bypass schema cache issues
  const mappedProps = props.map((prop: any, index: number) => {
    return {
      sport: prop.leagueID || 'NBA',
      stat_type: prop.statType,
      player_name: prop.playerName || 'Unknown Player',
      line: parseFloat(prop.line?.toString() || '0'),
      over_odds: prop.odds ? parseInt(prop.odds.toString()) : null,
      under_odds: prop.odds ? parseInt(prop.odds.toString()) : null,
      // Skip game_start to avoid schema cache issues
      created_at: new Date().toISOString()
    };
  });

  try {
    const { data, error } = await supabaseClient
      .from('raw_props')
      .insert(mappedProps)
      .select('id, player_name, stat_type, line');

    if (error) {
      console.error('❌ Database insertion error:', error.message);
      console.error('Error details:', error);
      return false;
    }

    console.log(`✅ Successfully inserted ${data?.length || 0} props`);
    if (data && data.length > 0) {
      console.log('📋 Sample inserted props:');
      data.slice(0, 3).forEach((prop: any, i: number) => {
        console.log(`   ${i + 1}. ${prop.player_name} - ${prop.stat_type} ${prop.line}`);
      });
    }
    return true;
  } catch (error) {
    console.error('❌ Database insertion failed:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 MINIMAL SGO Backfill - Bypass Schema Cache Issues');

  if (!SGO_API_KEY) {
    console.error('❌ SPORTSGAMEODDS_KEY environment variable is required');
    process.exit(1);
  }

  console.log('📊 Using minimal column set to bypass schema cache...');

  try {
    // Use proven working parameters from previous test
    console.log('📊 Fetching NBA historical data...');
    const props = await fetchAndFlattenSGOProps('basketball_nba', {
      startDate: '2024-03-28',
      endDate: '2024-09-30'
    });

    console.log(`✅ Fetched ${props.length} props from SGO`);

    if (props.length === 0) {
      console.log('⚠️  No props fetched, exiting...');
      return;
    }

    // Show sample of fetched data
    console.log('📋 Sample fetched props:');
    props.slice(0, 3).forEach((prop: any, i: number) => {
      console.log(`   ${i + 1}. ${prop.playerName || 'null'} - ${prop.statType} ${prop.line}`);
    });

    // Process in smaller batches for testing
    const batchSize = 50;
    const totalBatches = Math.ceil(props.length / batchSize);
    console.log(`🔄 Processing in batches of ${batchSize}...`);

    let successfulInserts = 0;

    // Test with just first 3 batches to verify it works
    const testBatches = Math.min(3, totalBatches);

    for (let i = 0; i < testBatches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, props.length);
      const batch = props.slice(start, end);

      console.log(`📦 Processing TEST batch ${i + 1}/${testBatches} (${batch.length} props)`);

      const success = await insertPropsToSupabase(batch);
      if (success) {
        successfulInserts += batch.length;
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Final statistics
    console.log('\n🎯 MINIMAL SGO Backfill Test Complete!');
    console.log(`   📊 Tested: ${testBatches * batchSize} props`);
    console.log(`   💾 Successfully inserted: ${successfulInserts} props`);
    console.log(`   📅 Date Range: 2024-03-28 to 2024-09-30`);
    console.log(`   🏀 League: NBA`);
    console.log(`   🔧 Source: SGO API`);
    console.log(`   📈 Success Rate: ${Math.round((successfulInserts/(testBatches * batchSize))*100)}%`);

    if (successfulInserts > 0) {
      console.log('\n✅ SUCCESS! Schema cache issue bypassed.');
      console.log('   This approach can be scaled up to process all props.');
      console.log(`   Remaining props to process: ${props.length - (testBatches * batchSize)}`);
    }

    // Check total count in database
    const { count } = await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true });

    console.log(`   ✅ Total props in database: ${count}`);

  } catch (error) {
    console.error('❌ Minimal SGO Backfill failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);