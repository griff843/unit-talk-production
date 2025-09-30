#!/usr/bin/env node

/**
 * Current Season SGO Backfill - 2024-25 NBA Season
 *
 * Fetches props for the CURRENT 2024-25 NBA season
 * NBA Season: October 2024 - June 2025
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
      start_time: prop.startsAtUTC || null,
      source: 'sgo',
      created_at: new Date().toISOString(),
      // Add unique identifier for upsert
      external_id: `sgo_${prop.eventID}_${prop.playerId || 'team'}_${prop.statType}_${prop.line}`
    };
  });

  try {
    // Use upsert to handle duplicates gracefully
    const { data, error } = await supabaseClient
      .from('raw_props')
      .upsert(mappedProps, {
        onConflict: 'external_id',
        ignoreDuplicates: false
      })
      .select('id, player_name, stat_type, line');

    if (error) {
      console.error('❌ Database insertion error:', error.message);
      return false;
    }

    console.log(`✅ Successfully upserted ${data?.length || 0} props`);
    if (data && data.length > 0) {
      console.log('📋 Sample upserted props:');
      data.slice(0, 3).forEach((prop: any, i: number) => {
        console.log(`   ${i + 1}. ${prop.player_name} - ${prop.stat_type} ${prop.line}`);
      });
    }
    return true;
  } catch (error: any) {
    console.error('❌ Upsert failed:', error.message);
    return false;
  }
}

async function runCurrentSeasonBackfill() {
  if (!SGO_API_KEY) {
    console.error('❌ SPORTSGAMEODDS_KEY environment variable not set');
    process.exit(1);
  }

  console.log('🚀 COMPREHENSIVE ALL SPORTS SGO BACKFILL');
  console.log('📅 2023-2025: Complete Recent + Current + Future Seasons');
  console.log('🏈 NFL | 🏀 NBA | ⚾ MLB | 🏒 NHL | 🏈 NCAAF | 🏀 WNBA');
  console.log('🔥 INCLUDING: MLB Playoffs, NBA Finals, NFL Playoffs, NCAAF Bowl Games');
  console.log('=' .repeat(70));

  // COMPREHENSIVE DATE RANGES - All Recent Seasons + Current Seasons + Future Seasons
  const sports = [
    // NFL: 2024-25 season (Sep 2024 through Super Bowl Feb 2025) + 2025-26 season planning
    { league: 'NFL', start: '2024-01-01T00:00:00Z', end: '2025-12-31T23:59:59Z', icon: '🏈' },

    // NBA: 2023-24 season completion + 2024-25 season + 2025 playoffs
    { league: 'NBA', start: '2023-10-01T00:00:00Z', end: '2025-08-31T23:59:59Z', icon: '🏀' },

    // MLB: 2024 season + playoffs + 2025 season (spring training starts Feb)
    { league: 'MLB', start: '2024-01-01T00:00:00Z', end: '2025-12-31T23:59:59Z', icon: '⚾' },

    // NHL: 2023-24 season completion + 2024-25 season + 2025 playoffs
    { league: 'NHL', start: '2023-10-01T00:00:00Z', end: '2025-08-31T23:59:59Z', icon: '🏒' },

    // NCAAF: 2024 season + bowl games + 2025 season planning
    { league: 'NCAAF', start: '2024-01-01T00:00:00Z', end: '2025-12-31T23:59:59Z', icon: '🏈' },

    // WNBA: 2024 season completion + playoffs + 2025 season
    { league: 'WNBA', start: '2024-01-01T00:00:00Z', end: '2025-12-31T23:59:59Z', icon: '🏀' }
  ];

  let totalPropsProcessed = 0;
  let totalPropsInserted = 0;

  for (let i = 0; i < sports.length; i++) {
    const sport = sports[i];
    const batchNum = i + 1;

    console.log(`\n📦 SPORT ${batchNum}/${sports.length}: ${sport.icon} ${sport.league}`);
    console.log(`📅 Season: ${sport.start} to ${sport.end}`);

    try {
      // Fetch current season data for this sport
      console.log(`📊 Fetching current ${sport.league} season data...`);
      const sgoProps = await fetchAndFlattenSGOProps({
        apiKey: SGO_API_KEY,
        leagueID: sport.league,
        startsAfter: sport.start,
        startsBefore: sport.end,
        includeAltLine: true,
        finalized: false  // Include upcoming games, not just finalized
      });

    console.log(`✅ Fetched ${sgoProps.length} props from SGO for current season`);

    if (sgoProps.length === 0) {
      console.log('📋 No current season props found to process');
      return;
    }

    // Show sample data to verify
    console.log('📋 Sample current season props:');
    sgoProps.slice(0, 3).forEach((prop: any, i: number) => {
      const startTime = prop.startsAtUTC ? new Date(prop.startsAtUTC).toLocaleDateString() : 'No date';
      console.log(`   ${i + 1}. ${prop.playerName} - ${prop.statType} ${prop.line} (${startTime})`);
    });

    console.log('🔄 Processing in batches of 50 (smaller batches for stability)...');

    const batchSize = 50;
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
      if (batchNum % 10 === 0) {
        const processed = i + batch.length;
        const percent = Math.round((processed / sgoProps.length) * 100);
        console.log(`   📊 Progress: ${processed}/${sgoProps.length} props processed (${percent}%)`);
      }

      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Final verification
    const { count: finalCount } = await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact' })
      .eq('source', 'sgo')
      .gte('start_time', '2024-10-01T00:00:00Z');

    console.log('\n🎯 Current Season SGO Backfill Complete!');
    console.log(`   📊 Processed: ${sgoProps.length} props`);
    console.log(`   💾 Successfully processed: ${successCount} props`);
    console.log(`   📅 Date Range: October 2024 - June 2025`);
    console.log(`   🏀 League: NBA (Current Season)`);
    console.log(`   🔧 Source: SGO API`);
    console.log(`   📈 Success Rate: ${Math.round((successCount / sgoProps.length) * 100)}%`);
    console.log(`   ✅ Current season SGO props in database: ${finalCount || 'Many'}`);

  } catch (error: any) {
    console.error('❌ Current season SGO backfill failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  runCurrentSeasonBackfill().catch(error => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });
}