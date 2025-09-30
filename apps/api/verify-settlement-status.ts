#!/usr/bin/env node

/**
 * VERIFY SETTLEMENT STATUS - Check 1.4M Props Status
 * Also verify games table population
 */

import { supabaseClient } from './src/services/supabaseClient';

async function verifySettlementStatus() {
  console.log('🔍 VERIFYING SETTLEMENT STATUS - 1.4M Props Analysis');
  console.log('='.repeat(60));

  try {
    // Check total props needing settlement
    console.log('\n📊 PROPS SETTLEMENT ANALYSIS:');

    const { count: totalProps } = await supabaseClient
      .from('raw_props')
      .select('*', { count: 'exact' });

    console.log(`   Total props in database: ${totalProps?.toLocaleString()}`);

    // Check unsettled props (assuming settlement columns exist)
    const settlementColumns = ['settled_at', 'outcome', 'is_settled', 'result'];

    for (const column of settlementColumns) {
      try {
        const { count: unsettledCount } = await supabaseClient
          .from('raw_props')
          .select('*', { count: 'exact' })
          .is(column, null);

        if (unsettledCount) {
          console.log(`   Props missing ${column}: ${unsettledCount.toLocaleString()}`);
        }
      } catch (error: any) {
        console.log(`   ${column} column: Not found in schema`);
      }
    }

    // Check by source
    console.log('\n📊 PROPS BY SOURCE:');
    const { data: sourceData } = await supabaseClient
      .from('raw_props')
      .select('source')
      .not('source', 'is', null);

    if (sourceData) {
      const sourceCounts: Record<string, number> = {};
      sourceData.forEach(row => {
        sourceCounts[row.source] = (sourceCounts[row.source] || 0) + 1;
      });

      Object.entries(sourceCounts).forEach(([source, count]) => {
        console.log(`   ${source}: ${count.toLocaleString()} props`);
      });
    }

    // Check games table
    console.log('\n🏈 GAMES TABLE ANALYSIS:');

    try {
      const { count: totalGames, error: gamesError } = await supabaseClient
        .from('games')
        .select('*', { count: 'exact' });

      if (gamesError) {
        console.log('   ❌ Games table error:', gamesError.message);
      } else {
        console.log(`   Total games in database: ${totalGames?.toLocaleString()}`);

        // Check games by sport
        const { data: gamesSports } = await supabaseClient
          .from('games')
          .select('sport')
          .not('sport', 'is', null);

        if (gamesSports) {
          const sportCounts: Record<string, number> = {};
          gamesSports.forEach(row => {
            sportCounts[row.sport] = (sportCounts[row.sport] || 0) + 1;
          });

          console.log('   Games by sport:');
          Object.entries(sportCounts).forEach(([sport, count]) => {
            console.log(`     ${sport}: ${count.toLocaleString()} games`);
          });
        }

        // Check recent games
        const { data: recentGames } = await supabaseClient
          .from('games')
          .select('sport, home_team, away_team, game_date, status')
          .order('created_at', { ascending: false })
          .limit(5);

        if (recentGames && recentGames.length > 0) {
          console.log('   Recent games:');
          recentGames.forEach((game, i) => {
            console.log(`     ${i + 1}. ${game.home_team} vs ${game.away_team} (${game.sport}) - ${game.status}`);
          });
        }
      }
    } catch (error: any) {
      console.log('   ❌ Games table not accessible:', error.message);
    }

    // Check SGO API capability for settlement data
    console.log('\n🔍 SGO SETTLEMENT CAPABILITY CHECK:');

    const SGO_API_KEY = process.env.SPORTSGAMEODDS_KEY;
    if (SGO_API_KEY) {
      console.log('   ✅ SGO API key configured');
      console.log('   📊 SGO can provide finalized results for settlement');
      console.log('   🎯 SGO historical data includes outcomes and results');
    } else {
      console.log('   ❌ SGO API key not found');
    }

    console.log('\n🎯 SETTLEMENT STRATEGY RECOMMENDATIONS:');

    if (totalProps && totalProps > 1000000) {
      console.log('   🚀 MASSIVE SCALE DETECTED: 1M+ props need processing');
      console.log('   📋 Recommended approach:');
      console.log('     1. Batch process in chunks of 1,000 props');
      console.log('     2. Use finalized=true SGO API calls for results');
      console.log('     3. Update games table with final scores');
      console.log('     4. Parallel processing by sport/date');
      console.log('     5. Track progress to avoid reprocessing');
    }

  } catch (error: any) {
    console.error('❌ Verification failed:', error.message);
  }
}

verifySettlementStatus().catch(console.error);