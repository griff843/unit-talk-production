#!/usr/bin/env node

/**
 * Current Season All Sports SGO Backfill - 2024-25 Season
 *
 * Fetches props for ALL SPORTS current seasons:
 * - NFL: 2024-25 season (Sep 2024 - Feb 2025)
 * - NBA: 2024-25 season (Oct 2024 - June 2025)
 * - MLB: Off-season (will get 2025 data when available)
 * - NHL: 2024-25 season (Oct 2024 - June 2025)
 * - NCAAF: 2024 season (Aug 2024 - Jan 2025)
 * - WNBA: 2025 season (May 2025 - Oct 2025)
 */

import { fetchAndFlattenSGOProps } from './src/logic/providers/sgoFetcher';
import { supabaseClient } from './src/services/supabaseClient';

const SGO_API_KEY = process.env.SPORTSGAMEODDS_KEY;

// Current season date ranges for all sports
const CURRENT_SEASONS = {
  NFL: {
    startsAfter: '2024-09-01T00:00:00Z',
    startsBefore: '2025-02-28T23:59:59Z'
  },
  NBA: {
    startsAfter: '2024-10-01T00:00:00Z',
    startsBefore: '2025-06-30T23:59:59Z'
  },
  MLB: {
    startsAfter: '2024-03-01T00:00:00Z',
    startsBefore: '2024-11-30T23:59:59Z' // 2024 season through playoffs
  },
  NHL: {
    startsAfter: '2024-10-01T00:00:00Z',
    startsBefore: '2025-06-30T23:59:59Z'
  },
  NCAAF: {
    startsAfter: '2024-08-01T00:00:00Z',
    startsBefore: '2025-01-31T23:59:59Z'
  },
  WNBA: {
    startsAfter: '2024-05-01T00:00:00Z',
    startsBefore: '2024-10-31T23:59:59Z'
  }
};

async function insertPropsToSupabase(props: any[], league: string) {
  console.log(`📦 Inserting ${props.length} ${league} props to Supabase...`);

  if (props.length === 0) {
    console.log(`📋 No ${league} props to insert`);
    return true;
  }

  // Map to match exact database schema
  const mappedProps = props.map((prop: any) => {
    return {
      sport: prop.leagueID || league,
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
      console.error(`❌ ${league} database insertion error:`, error.message);
      return false;
    }

    console.log(`✅ Successfully upserted ${data?.length || 0} ${league} props`);
    if (data && data.length > 0) {
      console.log(`📋 Sample ${league} props:`);
      data.slice(0, 3).forEach((prop: any, i: number) => {
        console.log(`   ${i + 1}. ${prop.player_name} - ${prop.stat_type} ${prop.line}`);
      });
    }
    return true;
  } catch (error: any) {
    console.error(`❌ ${league} upsert failed:`, error.message);
    return false;
  }
}

async function runCurrentSeasonAllSports() {
  if (!SGO_API_KEY) {
    console.error('❌ SPORTSGAMEODDS_KEY environment variable not set');
    process.exit(1);
  }

  console.log('🚀 Current Season All Sports SGO Backfill');
  console.log('📅 Processing 2024-25 seasons for ALL sports');
  console.log('🏈 NFL | 🏀 NBA | ⚾ MLB | 🏒 NHL | 🏈 NCAAF | 🏀 WNBA');
  console.log('=' .repeat(60));

  const sports = Object.keys(CURRENT_SEASONS) as (keyof typeof CURRENT_SEASONS)[];
  let totalPropsProcessed = 0;
  let totalPropsInserted = 0;
  const results: Record<string, { fetched: number; inserted: number }> = {};

  for (let i = 0; i < sports.length; i++) {
    const sport = sports[i];
    const batchNum = i + 1;

    console.log(`\n📦 SPORT ${batchNum}/${sports.length}: ${sport}`);
    console.log(`📅 Period: ${CURRENT_SEASONS[sport].startsAfter} to ${CURRENT_SEASONS[sport].startsBefore}`);

    try {
      // Fetch current season data for this sport
      const sgoProps = await fetchAndFlattenSGOProps({
        apiKey: SGO_API_KEY,
        leagueID: sport,
        startsAfter: CURRENT_SEASONS[sport].startsAfter,
        startsBefore: CURRENT_SEASONS[sport].startsBefore,
        includeAltLine: true,
        finalized: false // Include upcoming games
      });

      console.log(`✅ Fetched ${sgoProps.length} ${sport} props for current season`);
      results[sport] = { fetched: sgoProps.length, inserted: 0 };

      if (sgoProps.length === 0) {
        console.log(`📋 No current season ${sport} props available`);
        continue;
      }

      // Show sample data
      console.log(`📋 Sample ${sport} props:`);
      sgoProps.slice(0, 3).forEach((prop: any, i: number) => {
        const startTime = prop.startsAtUTC ? new Date(prop.startsAtUTC).toLocaleDateString() : 'No date';
        console.log(`   ${i + 1}. ${prop.playerName || 'Team'} - ${prop.statType} ${prop.line} (${startTime})`);
      });

      // Process in batches for reliability
      console.log(`🔄 Processing ${sport} in batches of 50...`);
      const batchSize = 50;
      let sportSuccessCount = 0;

      for (let j = 0; j < sgoProps.length; j += batchSize) {
        const batch = sgoProps.slice(j, j + batchSize);
        const subBatchNum = Math.floor(j / batchSize) + 1;
        const totalSubBatches = Math.ceil(sgoProps.length / batchSize);

        console.log(`   📦 ${sport} batch ${subBatchNum}/${totalSubBatches} (${batch.length} props)`);

        const success = await insertPropsToSupabase(batch, sport);
        if (success) {
          sportSuccessCount += batch.length;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      results[sport].inserted = sportSuccessCount;
      totalPropsProcessed += sgoProps.length;
      totalPropsInserted += sportSuccessCount;

      console.log(`✅ ${sport} complete: ${sgoProps.length} processed, ${sportSuccessCount} inserted`);

    } catch (error: any) {
      console.error(`❌ ${sport} processing failed:`, error.message);
      results[sport] = { fetched: 0, inserted: 0 };
    }
  }

  // Final summary
  console.log('\n' + '=' .repeat(60));
  console.log('🎯 CURRENT SEASON ALL SPORTS BACKFILL COMPLETE!');
  console.log('=' .repeat(60));

  sports.forEach(sport => {
    const { fetched, inserted } = results[sport] || { fetched: 0, inserted: 0 };
    const successRate = fetched > 0 ? Math.round((inserted / fetched) * 100) : 0;
    console.log(`${sport.padEnd(6)} | Fetched: ${fetched.toString().padStart(6)} | Inserted: ${inserted.toString().padStart(6)} | Success: ${successRate}%`);
  });

  console.log('─' .repeat(60));
  console.log(`📊 TOTALS | Fetched: ${totalPropsProcessed.toString().padStart(6)} | Inserted: ${totalPropsInserted.toString().padStart(6)} | Overall: ${Math.round((totalPropsInserted / Math.max(totalPropsProcessed, 1)) * 100)}%`);
  console.log(`🏈 Coverage: All 6 major sports for current 2024-25 seasons`);
  console.log(`🔧 Source: SGO API (Sports Game Odds)`);
  console.log(`💾 Target: Supabase production database`);

  // Database verification
  try {
    const { count: finalCount } = await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact' })
      .eq('source', 'sgo');

    console.log(`✅ Total SGO props in database: ${finalCount || 'Many'}`);
  } catch (error: any) {
    console.log(`⚠️ Could not verify final count: ${error.message}`);
  }
}

if (require.main === module) {
  runCurrentSeasonAllSports().catch(error => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });
}