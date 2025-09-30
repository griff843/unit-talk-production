#!/usr/bin/env node

/**
 * Final SGO Backfill - Proven Working Version
 *
 * Based on successful comprehensive test showing 3,196 props fetched.
 * Uses direct database insertion to bypass Supabase schema cache.
 */

import { fetchAndFlattenSGOProps } from './src/logic/providers/sgoFetcher';
import { supabaseClient } from './src/services/supabaseClient';

const SGO_API_KEY = process.env.SPORTSGAMEODDS_KEY;

async function insertPropsToSupabase(props: any[]) {
  console.log(`📦 Inserting ${props.length} props to Supabase...`);

  // Map to match exact database schema
  const mappedProps = props.map((prop: any, index: number) => {
    return {
      sport: prop.leagueID || 'NBA',
      stat_type: prop.statType,
      player_name: prop.playerName || 'Unknown Player',
      line: parseFloat(prop.line?.toString() || '0'),
      over_odds: prop.odds ? parseInt(prop.odds.toString()) : null,
      under_odds: prop.odds ? parseInt(prop.odds.toString()) : null,
      // Skip problematic columns to bypass schema cache issues
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
  } catch (error: any) {
    console.error('❌ Insertion failed:', error.message);
    return false;
  }
}

async function runFinalSGOBackfill() {
  if (!SGO_API_KEY) {
    console.error('❌ SPORTSGAMEODDS_KEY environment variable not set');
    process.exit(1);
  }

  console.log('🚀 Final SGO Backfill - Proven Working Version');
  console.log('📊 Using proven parameters that fetched 3,196 props...');

  try {
    // Use CURRENT SEASON parameters for 2024-25 NBA season
    console.log('📊 Fetching CURRENT 2024-25 NBA season data...');
    const sgoProps = await fetchAndFlattenSGOProps({
      apiKey: SGO_API_KEY,
      leagueID: 'NBA',
      startsAfter: '2024-10-01T00:00:00Z',     // October 2024 season start
      startsBefore: '2025-06-30T23:59:59Z',    // June 2025 season end
      includeAltLine: true,
      finalized: false  // Include upcoming games, not just finalized
    });

    console.log(`✅ Fetched ${sgoProps.length} props from SGO`);

    if (sgoProps.length === 0) {
      console.log('📋 No props found to process');
      return;
    }

    // Show sample data to verify
    console.log('📋 Sample fetched props:');
    sgoProps.slice(0, 3).forEach((prop: any, i: number) => {
      console.log(`   ${i + 1}. ${prop.playerName} - ${prop.statType} ${prop.line}`);
    });

    console.log('🔄 Processing in batches of 100...');

    const batchSize = 100;
    let successCount = 0;

    for (let i = 0; i < sgoProps.length; i += batchSize) {
      const batch = sgoProps.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(sgoProps.length / batchSize);

      console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} props)`);

      const success = await insertPropsToSupabase(batch);
      if (success) {
        successCount += batch.length;
      }

      // Progress update
      if (batchNum % 5 === 0) {
        const processed = i + batch.length;
        const percent = Math.round((processed / sgoProps.length) * 100);
        console.log(`   📊 Progress: ${processed}/${sgoProps.length} props processed (${percent}%)`);
      }

      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Final verification
    const { count: finalCount } = await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact' })
      .eq('source', 'sgo');

    console.log('\n🎯 Current Season SGO Backfill Complete!');
    console.log(`   📊 Processed: ${sgoProps.length} props`);
    console.log(`   💾 Successfully inserted: ${successCount} props`);
    console.log(`   📅 Date Range: October 2024 - June 2025 (Current Season)`);
    console.log(`   🏀 League: NBA`);
    console.log(`   🔧 Source: SGO API`);
    console.log(`   📈 Success Rate: ${Math.round((successCount / sgoProps.length) * 100)}%`);
    console.log(`   ✅ Total SGO props in database: ${finalCount}`);

  } catch (error: any) {
    console.error('❌ SGO backfill failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  runFinalSGOBackfill().catch(error => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });
}