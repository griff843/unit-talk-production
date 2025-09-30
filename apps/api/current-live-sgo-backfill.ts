#!/usr/bin/env node

/**
 * CURRENT LIVE SGO BACKFILL - Fresh Props Only
 *
 * Fetches CURRENT, LIVE props for today and upcoming games
 * No old historical data - only fresh, actionable props
 */

import { fetchAndFlattenSGOProps } from './src/logic/providers/sgoFetcher';
import { supabaseClient } from './src/services/supabaseClient';

const SGO_API_KEY = process.env.SPORTSGAMEODDS_KEY;

// Current active leagues
const CURRENT_LEAGUES = ['NBA', 'NFL', 'NHL', 'MLB'];

// Get current date ranges for LIVE props
const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

const CURRENT_RANGES = {
  start: today.toISOString(),
  end: nextWeek.toISOString()
};

async function insertCurrentProps(props: any[], league: string) {
  console.log(`📦 Inserting ${props.length} CURRENT ${league} props...`);

  const mappedProps = props.map((prop: any, index: number) => ({
    sport: league,
    stat_type: prop.statType,
    player_name: prop.playerName || 'Team Prop',
    line: parseFloat(prop.line?.toString() || '0'),
    over_odds: prop.odds ? parseInt(prop.odds.toString()) : null,
    under_odds: prop.odds ? parseInt(prop.odds.toString()) : null,
    source: 'sgo',
    external_id: `sgo_current_${league.toLowerCase()}_${Date.now()}_${index}`,
    start_time: prop.startsAtUTC || null,
    confidence: 0.7,
    is_valid: true,
    provider: 'sportsgameodds',
    created_at: new Date().toISOString()
  }));

  try {
    const { data, error } = await supabaseClient
      .from('raw_props')
      .insert(mappedProps)
      .select('id');

    if (error) {
      console.error(`❌ ${league} insertion error:`, error.message);
      return 0;
    }

    console.log(`✅ ${league}: ${data?.length || 0} CURRENT props inserted`);
    return data?.length || 0;
  } catch (error: any) {
    console.error(`❌ ${league} failed:`, error.message);
    return 0;
  }
}

async function runCurrentLiveSGOBackfill() {
  if (!SGO_API_KEY) {
    console.error('❌ SPORTSGAMEODDS_KEY environment variable not set');
    process.exit(1);
  }

  console.log('🚀 CURRENT LIVE SGO BACKFILL - Fresh Props Only');
  console.log('🎯 Target: Current, live props for today and next 7 days');
  console.log(`📅 Date Range: ${CURRENT_RANGES.start} to ${CURRENT_RANGES.end}`);
  console.log(`📊 Leagues: ${CURRENT_LEAGUES.join(', ')}`);

  let totalInserted = 0;
  let totalFetched = 0;

  for (const league of CURRENT_LEAGUES) {
    try {
      console.log(`\n📊 Fetching CURRENT ${league} props...`);

      const sgoProps = await fetchAndFlattenSGOProps({
        apiKey: SGO_API_KEY,
        leagueID: league,
        startsAfter: CURRENT_RANGES.start,
        startsBefore: CURRENT_RANGES.end,
        includeAltLine: true,
        finalized: false // Include LIVE, non-finalized props
      });

      console.log(`✅ Fetched ${sgoProps.length} CURRENT ${league} props`);
      totalFetched += sgoProps.length;

      if (sgoProps.length > 0) {
        // Show sample of what we're getting
        console.log('📋 Sample current props:');
        sgoProps.slice(0, 3).forEach((prop: any, i: number) => {
          console.log(`   ${i + 1}. ${prop.playerName || 'Team'} - ${prop.statType} ${prop.line}`);
        });

        // Process in batches
        const batchSize = 50;
        let leagueInserted = 0;

        for (let i = 0; i < sgoProps.length; i += batchSize) {
          const batch = sgoProps.slice(i, i + batchSize);
          const inserted = await insertCurrentProps(batch, league);
          leagueInserted += inserted;

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        totalInserted += leagueInserted;
        console.log(`✅ ${league} complete: ${leagueInserted} CURRENT props inserted`);
      } else {
        console.log(`📋 No current ${league} props found (off-season or no upcoming games)`);
      }

    } catch (error: any) {
      console.error(`❌ ${league} failed:`, error.message);
    }

    // Delay between leagues
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Final verification
  const { count: finalCount } = await supabaseClient
    .from('raw_props')
    .select('*', { count: 'exact' })
    .eq('source', 'sgo');

  console.log('\n🎯 CURRENT LIVE SGO BACKFILL COMPLETE!');
  console.log('='.repeat(50));
  console.log(`   📊 Current Props Fetched: ${totalFetched}`);
  console.log(`   💾 Current Props Inserted: ${totalInserted}`);
  console.log(`   🏆 Success Rate: ${totalFetched > 0 ? Math.round((totalInserted / totalFetched) * 100) : 0}%`);
  console.log(`   ✅ Total SGO Props in Database: ${finalCount}`);
  console.log(`   📅 Data Freshness: CURRENT (${today.toDateString()} onwards)`);
}

if (require.main === module) {
  runCurrentLiveSGOBackfill().catch(error => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });
}