#!/usr/bin/env node

/**
 * UPDATE EXISTING PROPS SETTLEMENT - 1.4M Props Status Update
 *
 * Updates existing props with settlement data instead of inserting new ones
 * Matches props by player_name, stat_type, line, and start_time
 */

import { fetchAndFlattenSGOProps } from './src/logic/providers/sgoFetcher';
import { supabaseClient } from './src/services/supabaseClient';

const SGO_API_KEY = process.env.SPORTSGAMEODDS_KEY;

async function updatePropsSettlement(sport: string, dateRange: { start: string; end: string }) {
  console.log(`\n📦 UPDATING ${sport} SETTLEMENT DATA`);
  console.log(`   📅 Date Range: ${dateRange.start} to ${dateRange.end}`);

  try {
    // Fetch finalized SGO data
    const settlementData = await fetchAndFlattenSGOProps({
      apiKey: SGO_API_KEY!,
      leagueID: sport,
      startsAfter: dateRange.start,
      startsBefore: dateRange.end,
      includeAltLine: true,
      finalized: true
    });

    console.log(`   ✅ Fetched ${settlementData.length} finalized ${sport} props`);

    if (settlementData.length === 0) {
      return { updated: 0 };
    }

    let totalUpdated = 0;

    // Process in batches to update existing props
    const batchSize = 50;
    for (let i = 0; i < settlementData.length; i += batchSize) {
      const batch = settlementData.slice(i, i + batchSize);

      for (const prop of batch) {
        try {
          // Find matching existing prop by key fields
          const { data: existingProps, error: findError } = await supabaseClient
            .from('raw_props')
            .select('id')
            .eq('sport', sport)
            .eq('stat_type', prop.statType || 'unknown')
            .eq('player_name', prop.playerName || 'Team Prop')
            .eq('line', parseFloat(prop.line?.toString() || '0'))
            .limit(1);

          if (findError || !existingProps || existingProps.length === 0) {
            continue; // Skip if no matching prop found
          }

          // Update the existing prop with settlement data
          const { error: updateError } = await supabaseClient
            .from('raw_props')
            .update({
              status: 'settled',
              result: prop.result || prop.outcome || 'completed',
              actual_value: prop.actualValue ? parseFloat(prop.actualValue.toString()) : null,
              settled_at: new Date().toISOString(),
              provider: 'sgo',
              game_id: prop.eventID || null,
              external_id: `sgo_settled_${prop.eventID}_${prop.playerId || 'team'}_${prop.statType}_${prop.line}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingProps[0].id);

          if (!updateError) {
            totalUpdated++;
          }

        } catch (error) {
          // Continue with next prop
        }
      }

      // Progress update
      if (i % (batchSize * 10) === 0) {
        console.log(`     📊 Processed ${i + batch.length}/${settlementData.length} props, ${totalUpdated} updated`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`   ✅ ${sport} settlement update complete: ${totalUpdated} props updated`);
    return { updated: totalUpdated };

  } catch (error: any) {
    console.error(`   ❌ ${sport} settlement update failed:`, error.message);
    return { updated: 0 };
  }
}

async function runSettlementUpdate() {
  if (!SGO_API_KEY) {
    console.error('❌ SPORTSGAMEODDS_KEY not configured');
    process.exit(1);
  }

  console.log('🚀 UPDATE EXISTING PROPS SETTLEMENT - 1.4M Props Status Update');
  console.log('🎯 Target: Update existing props with settlement data from SGO');
  console.log('=' .repeat(70));

  const SPORTS = [
    { sport: 'NFL', start: '2024-09-01T00:00:00Z', end: '2024-12-31T23:59:59Z' },
    { sport: 'NBA', start: '2024-01-01T00:00:00Z', end: '2024-06-30T23:59:59Z' },
    { sport: 'MLB', start: '2024-03-01T00:00:00Z', end: '2024-11-30T23:59:59Z' },
    { sport: 'NHL', start: '2024-10-01T00:00:00Z', end: '2024-12-31T23:59:59Z' },
    { sport: 'NCAAF', start: '2024-08-01T00:00:00Z', end: '2024-12-31T23:59:59Z' },
    { sport: 'WNBA', start: '2024-05-01T00:00:00Z', end: '2024-10-31T23:59:59Z' }
  ];

  let totalUpdated = 0;

  for (const sport of SPORTS) {
    const result = await updatePropsSettlement(sport.sport, { start: sport.start, end: sport.end });
    totalUpdated += result.updated;
  }

  // Final verification
  try {
    const { count: totalPropsCount } = await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact' })
      .eq('source', 'sgo');

    const { count: settledCount } = await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact' })
      .eq('status', 'settled');

    console.log('\n🎯 SETTLEMENT UPDATE COMPLETE!');
    console.log('=' .repeat(70));
    console.log(`💾 Total Props Updated: ${totalUpdated.toLocaleString()}`);
    console.log(`✅ Total SGO Props in DB: ${totalPropsCount?.toLocaleString()}`);
    console.log(`🏆 Total Settled Props: ${settledCount?.toLocaleString()}`);
    console.log(`📊 Settlement Rate: ${totalPropsCount ? Math.round((settledCount || 0) / totalPropsCount * 100) : 0}%`);
    console.log(`🚀 Status: ${totalUpdated > 1000 ? '🟢 MAJOR SUCCESS' : totalUpdated > 100 ? '🔶 PARTIAL SUCCESS' : '🔴 NEEDS INVESTIGATION'}`);

  } catch (error: any) {
    console.log(`⚠️ Final verification failed: ${error.message}`);
  }
}

runSettlementUpdate().catch(console.error);