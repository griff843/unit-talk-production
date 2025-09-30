#!/usr/bin/env node

/**
 * FIXED SGO BACKFILL - Correct Schema Mapping
 *
 * Uses actual database columns to fix insertion issues
 */

import { fetchAndFlattenSGOProps } from './src/logic/providers/sgoFetcher';
import { supabaseClient } from './src/services/supabaseClient';

const SGO_API_KEY = process.env.SPORTSGAMEODDS_KEY;

async function insertPropsWithCorrectSchema(props: any[], sport: string) {
  console.log(`📦 Inserting ${props.length} ${sport} props with correct schema...`);

  // Map to actual database columns
  const timestamp = Date.now();
  const mappedProps = props.map((prop: any, index: number) => ({
    // Core required fields
    sport: sport,
    stat_type: prop.statType || 'unknown',
    player_name: prop.playerName || 'Team Prop',
    line: parseFloat(prop.line?.toString() || '0'),

    // Correct time field (not game_start!)
    start_time: prop.startsAtUTC || null,

    // Odds fields
    over_odds: prop.odds ? parseInt(prop.odds.toString()) : null,
    under_odds: prop.odds ? parseInt(prop.odds.toString()) : null,

    // Identification
    external_id: `sgo_fixed_${sport.toLowerCase()}_${timestamp}_${index}`,
    event_id: prop.eventID,
    source: 'sgo',
    provider: 'sportsgameodds',

    // Team information
    team: prop.team || prop.homeTeam || prop.awayTeam || null,
    home_team: prop.homeTeam || null,
    away_team: prop.awayTeam || null,
    opponent: prop.opponent || null,

    // Settlement data if available
    outcome: prop.result || prop.outcome || null,

    // Metadata
    is_valid: true,
    confidence: 0.7,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  try {
    const batchSize = 50;
    let totalInserted = 0;

    for (let i = 0; i < mappedProps.length; i += batchSize) {
      const batch = mappedProps.slice(i, i + batchSize);

      const { data, error } = await supabaseClient
        .from('raw_props')
        .insert(batch)
        .select('id');

      if (error) {
        console.error(`   ❌ Batch ${Math.floor(i/batchSize) + 1} error:`, error.message);
        if (error.code !== '23505') { // Ignore duplicates
          console.error('   Error details:', error);
        }
      } else {
        const inserted = data?.length || 0;
        totalInserted += inserted;
        console.log(`   ✅ Batch ${Math.floor(i/batchSize) + 1}: ${inserted} props inserted`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`   🎯 ${sport} total inserted: ${totalInserted}/${props.length} props`);
    return totalInserted;

  } catch (error: any) {
    console.error(`   ❌ ${sport} insertion failed:`, error.message);
    return 0;
  }
}

async function runFixedSGOBackfill() {
  console.log('🚀 FIXED SGO BACKFILL - Correct Schema Mapping');
  console.log('🎯 Target: Process current live props with proper columns');
  console.log('='.repeat(60));

  if (!SGO_API_KEY) {
    console.error('❌ SPORTSGAMEODDS_KEY not configured');
    process.exit(1);
  }

  // Current live sports
  const CURRENT_SPORTS = [
    { league: 'NBA', name: 'Basketball' },
    { league: 'NFL', name: 'Football' },
    { league: 'NHL', name: 'Hockey' },
    { league: 'MLB', name: 'Baseball' }
  ];

  // Get current date ranges for live props
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const dateRange = {
    start: today.toISOString(),
    end: nextWeek.toISOString()
  };

  console.log(`📅 Processing live props: ${dateRange.start} to ${dateRange.end}`);

  let totalFetched = 0;
  let totalInserted = 0;

  for (const sport of CURRENT_SPORTS) {
    console.log(`\n📊 PROCESSING ${sport.league} (${sport.name}):`);

    try {
      // Fetch current live props
      const sgoProps = await fetchAndFlattenSGOProps({
        apiKey: SGO_API_KEY,
        leagueID: sport.league,
        startsAfter: dateRange.start,
        startsBefore: dateRange.end,
        includeAltLine: true,
        finalized: false // Live props
      });

      console.log(`   ✅ Fetched ${sgoProps.length} live ${sport.league} props`);
      totalFetched += sgoProps.length;

      if (sgoProps.length > 0) {
        // Show sample
        console.log('   📋 Sample props:');
        sgoProps.slice(0, 3).forEach((prop: any, i: number) => {
          console.log(`     ${i + 1}. ${prop.playerName || 'Team'} - ${prop.statType} ${prop.line}`);
        });

        // Insert with correct schema
        const inserted = await insertPropsWithCorrectSchema(sgoProps, sport.league);
        totalInserted += inserted;
      } else {
        console.log(`   📋 No live ${sport.league} props available`);
      }

      // Delay between sports
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error: any) {
      console.error(`   ❌ ${sport.league} processing failed:`, error.message);
    }
  }

  // Final verification
  const { count: finalCount } = await supabaseClient
    .from('raw_props')
    .select('*', { count: 'exact' })
    .eq('source', 'sgo');

  console.log('\n🎯 FIXED SGO BACKFILL COMPLETE!');
  console.log('='.repeat(60));
  console.log(`   📊 Total Props Fetched: ${totalFetched}`);
  console.log(`   💾 Total Props Inserted: ${totalInserted}`);
  console.log(`   📈 Success Rate: ${totalFetched > 0 ? Math.round((totalInserted / totalFetched) * 100) : 0}%`);
  console.log(`   ✅ Total SGO Props in DB: ${finalCount}`);

  if (totalInserted > 0) {
    console.log('🟢 SCHEMA ISSUES RESOLVED - Props successfully inserted!');
  } else if (totalFetched > 0) {
    console.log('🔶 PROPS FETCHED BUT NOT INSERTED - Check for duplicates or other issues');
  } else {
    console.log('📋 NO LIVE PROPS AVAILABLE - Normal during off-season');
  }
}

runFixedSGOBackfill().catch(console.error);