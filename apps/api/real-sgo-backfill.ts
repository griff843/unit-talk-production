#!/usr/bin/env node

/**
 * Real SGO Backfill Script - Database Schema Compliant
 *
 * This script correctly maps SGO data to the actual raw_props table structure
 * without the 'source' column that doesn't exist.
 */

import { fetchAndFlattenSGOProps } from './src/logic/providers/sgoFetcher';
import { supabaseClient } from './src/services/supabaseClient';

const SGO_API_KEY = process.env.SPORTSGAMEODDS_KEY;

interface DatabaseProp {
  prop_id: string;
  sport: string;
  stat_type: string;
  player_name: string;
  line: number;
  over_odds?: number;
  under_odds?: number;
  game_start?: string;
}

async function insertPropsToDatabase(props: DatabaseProp[]) {
  console.log(`📦 Inserting ${props.length} props to database...`);

  try {
    const { data, error } = await supabaseClient
      .from('raw_props')
      .insert(props)
      .select('id, prop_id, player_name, stat_type, line');

    if (error) {
      console.error('❌ Database insertion error:', error.message);
      return false;
    }

    console.log(`✅ Successfully inserted ${data?.length || 0} props`);
    if (data && data.length > 0) {
      console.log('📋 Sample inserted props:');
      data.slice(0, 3).forEach((prop, i) => {
        console.log(`   ${i + 1}. ${prop.player_name} - ${prop.stat_type} ${prop.line}`);
      });
    }
    return true;
  } catch (error: any) {
    console.error('❌ Insertion failed:', error.message);
    return false;
  }
}

async function runRealSGOBackfill() {
  if (!SGO_API_KEY) {
    console.error('❌ SPORTSGAMEODDS_KEY environment variable not set');
    process.exit(1);
  }

  console.log('🚀 Starting Real SGO Backfill...');
  console.log('📊 Fetching historical NBA data from SGO API...');

  try {
    // Fetch SGO data using your exact sample parameters
    const sgoProps = await fetchAndFlattenSGOProps({
      apiKey: SGO_API_KEY,
      leagueID: 'NBA',
      startsAfter: '2024-03-28T07:00:00Z',
      startsBefore: '2024-09-30T06:59:59Z',
      includeAltLine: true,
      finalized: true
    });

    console.log(`✅ Fetched ${sgoProps.length} props from SGO`);

    if (sgoProps.length === 0) {
      console.log('📋 No props found to process');
      return;
    }

    // Map SGO props to database schema (without source column)
    const dbProps: DatabaseProp[] = sgoProps.map((prop, index) => ({
      prop_id: `sgo_${prop.eventID}_${prop.playerId || 'team'}_${prop.statType}_${index}`,
      sport: prop.leagueID || 'NBA',
      stat_type: prop.statType,
      player_name: prop.playerName || 'Unknown Player',
      line: parseFloat(prop.line?.toString() || '0'),
      over_odds: prop.odds ? parseInt(prop.odds.toString()) : undefined,
      under_odds: prop.odds ? parseInt(prop.odds.toString()) : undefined,
      game_start: prop.startsAtUTC || undefined
    }));

    console.log('🔄 Processing in batches of 50...');

    const batchSize = 50;
    let successCount = 0;

    for (let i = 0; i < dbProps.length; i += batchSize) {
      const batch = dbProps.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(dbProps.length / batchSize);

      console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} props)`);

      const success = await insertPropsToDatabase(batch);
      if (success) {
        successCount += batch.length;
      }

      // Progress update every 10 batches
      if (batchNum % 10 === 0) {
        console.log(`   📊 Progress: ${i + batch.length}/${dbProps.length} props processed (${Math.round(((i + batch.length) / dbProps.length) * 100)}%)`);
      }

      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Final verification
    const { count: finalCount } = await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact' });

    console.log('\n🎯 Real SGO Backfill Complete!');
    console.log(`   📊 Processed: ${sgoProps.length} props`);
    console.log(`   💾 Successfully inserted: ${successCount} props`);
    console.log(`   📅 Date Range: 2024-03-28 to 2024-09-30`);
    console.log(`   🏀 League: NBA`);
    console.log(`   🔧 Source: SGO API`);
    console.log(`   📈 Success Rate: ${Math.round((successCount / sgoProps.length) * 100)}%`);
    console.log(`   ✅ Total props in database: ${finalCount}`);

  } catch (error: any) {
    console.error('❌ SGO backfill failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  runRealSGOBackfill().catch(error => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });
}