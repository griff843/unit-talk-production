#!/usr/bin/env node

/**
 * FIXED SGO Backfill - Schema-Corrected Working Version
 *
 * Fixed database schema mismatch issues:
 * - Changed start_time to game_start to match database schema
 * - Added proper SGO columns (source, external_game_id, external_prop_id)
 * - Proper error handling and progress tracking
 */

import { fetchAndFlattenSGOProps } from './src/logic/providers/sgoFetcher';
import { supabaseClient } from './src/services/supabaseClient';

const SGO_API_KEY = process.env.SPORTSGAMEODDS_KEY;

async function insertPropsToSupabase(props: any[]) {
  console.log(`📦 Inserting ${props.length} props to Supabase...`);

  // Map to match exact database schema with fixed column names
  const mappedProps = props.map((prop: any, index: number) => {
    return {
      sport: prop.leagueID || 'NBA',
      stat_type: prop.statType,
      player_name: prop.playerName || 'Unknown Player',
      line: parseFloat(prop.line?.toString() || '0'),
      over_odds: prop.odds ? parseInt(prop.odds.toString()) : null,
      under_odds: prop.odds ? parseInt(prop.odds.toString()) : null,
      game_start: prop.startsAtUTC || null,  // FIXED: Changed from start_time to game_start
      source: 'sgo',  // SGO source tracking
      external_game_id: prop.gameId || `game-${index}`,  // SGO game linking
      external_prop_id: prop.propId || `prop-${Date.now()}-${index}`,  // SGO prop tracking
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
  console.log('🚀 FIXED SGO Backfill - Schema-Corrected Working Version');

  if (!SGO_API_KEY) {
    console.error('❌ SPORTSGAMEODDS_KEY environment variable is required');
    process.exit(1);
  }

  console.log('📊 Using proven parameters that fetched 3,196 props...');

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

    // Process in batches to avoid timeouts
    const batchSize = 100;
    const totalBatches = Math.ceil(props.length / batchSize);
    console.log(`🔄 Processing in batches of ${batchSize}...`);

    let successfulInserts = 0;

    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, props.length);
      const batch = props.slice(start, end);

      console.log(`📦 Processing batch ${i + 1}/${totalBatches} (${batch.length} props)`);

      const success = await insertPropsToSupabase(batch);
      if (success) {
        successfulInserts += batch.length;
      }

      // Progress update every 5 batches
      if ((i + 1) % 5 === 0) {
        console.log(`   📊 Progress: ${end}/${props.length} props processed (${Math.round((end/props.length)*100)}%)`);
      }

      // Small delay between batches to avoid overwhelming database
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Final statistics
    console.log('\n🎯 FIXED SGO Backfill Complete!');
    console.log(`   📊 Processed: ${props.length} props`);
    console.log(`   💾 Successfully inserted: ${successfulInserts} props`);
    console.log(`   📅 Date Range: 2024-03-28 to 2024-09-30`);
    console.log(`   🏀 League: NBA`);
    console.log(`   🔧 Source: SGO API`);
    console.log(`   📈 Success Rate: ${Math.round((successfulInserts/props.length)*100)}%`);

    // Check total count in database
    const { count } = await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'sgo');

    console.log(`   ✅ Total SGO props in database: ${count}`);

  } catch (error) {
    console.error('❌ SGO Backfill failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);