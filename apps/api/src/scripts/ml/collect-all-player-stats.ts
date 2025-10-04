/**
 * Collect All Player Stats
 *
 * Comprehensive data collection from free sources:
 * 1. MLB Stats API (free, official)
 * 2. OddsAPI game results (we already pay for this)
 * 3. Calculates league averages from collected data
 */

import { mlbStatsService } from '../../services/data-collection/MLBStatsService';
import { oddsAPIStatsExtractor } from '../../services/data-collection/OddsAPIStatsExtractor';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function collectMLBStats(daysBack: number = 7) {
  console.log('\n📊 Step 1: MLB Stats Collection');
  console.log('==========================================');

  try {
    const statsCollected = await mlbStatsService.collectRecentStats(daysBack);
    console.log(`✅ Collected ${statsCollected} MLB player stat lines`);
    return statsCollected;
  } catch (error: any) {
    console.error('❌ MLB stats collection failed:', error.message);
    return 0;
  }
}

async function collectOddsAPIResults(daysBack: number = 7) {
  console.log('\n📊 Step 2: OddsAPI Game Results');
  console.log('==========================================');

  try {
    const result = await oddsAPIStatsExtractor.collectRecentStats(
      ['americanfootball_nfl', 'basketball_nba', 'baseball_mlb', 'icehockey_nhl'],
      daysBack
    );
    console.log(`✅ Collected ${result.gamesProcessed} game results`);
    return result.gamesProcessed;
  } catch (error: any) {
    console.error('❌ OddsAPI collection failed:', error.message);
    return 0;
  }
}

async function calculateLeagueAveragesFromData() {
  console.log('\n📊 Step 3: Calculate League Averages from Real Data');
  console.log('==========================================');

  // Query player_stats to calculate actual league averages
  const { data: mlbStats } = await supabase
    .from('player_stats')
    .select('stats')
    .eq('sport', 'MLB');

  if (!mlbStats || mlbStats.length === 0) {
    console.log('⚠️  No MLB stats found, using default averages');
    return 0;
  }

  console.log(`   Analyzing ${mlbStats.length} MLB stat lines...`);

  // Calculate averages for key stats
  const totalBases = mlbStats
    .map(s => s.stats?.totalBases)
    .filter(tb => tb !== null && tb !== undefined)
    .map(tb => parseFloat(tb));

  const hits = mlbStats
    .map(s => s.stats?.hits)
    .filter(h => h !== null && h !== undefined)
    .map(h => parseFloat(h));

  if (totalBases.length > 0) {
    const avgTotalBases = totalBases.reduce((a, b) => a + b, 0) / totalBases.length;
    const stdDevTB = Math.sqrt(
      totalBases.reduce((sum, val) => sum + Math.pow(val - avgTotalBases, 2), 0) / totalBases.length
    );

    console.log(`   MLB Total Bases: avg=${avgTotalBases.toFixed(2)}, std=${stdDevTB.toFixed(2)}`);

    // Store in league_averages table
    const season = new Date().getFullYear();
    await supabase.from('league_averages').upsert({
      sport: 'MLB',
      season,
      market_type: 'batter_total_bases',
      stat_name: 'total_bases',
      average_value: avgTotalBases,
      std_deviation: stdDevTB,
      sample_size: totalBases.length,
    }, {
      onConflict: 'sport,season,market_type,stat_name'
    });
  }

  if (hits.length > 0) {
    const avgHits = hits.reduce((a, b) => a + b, 0) / hits.length;
    const stdDevHits = Math.sqrt(
      hits.reduce((sum, val) => sum + Math.pow(val - avgHits, 2), 0) / hits.length
    );

    console.log(`   MLB Hits: avg=${avgHits.toFixed(2)}, std=${stdDevHits.toFixed(2)}`);

    const season = new Date().getFullYear();
    await supabase.from('league_averages').upsert({
      sport: 'MLB',
      season,
      market_type: 'batter_hits',
      stat_name: 'hits',
      average_value: avgHits,
      std_deviation: stdDevHits,
      sample_size: hits.length,
    }, {
      onConflict: 'sport,season,market_type,stat_name'
    });
  }

  console.log(`✅ Updated league averages from real data`);
  return 1;
}

async function validateDataCollection() {
  console.log('\n📊 Step 4: Validation');
  console.log('==========================================');

  // Check player_stats count
  const { count: playerStatsCount } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });

  // Check league_averages count
  const { count: leagueAvgCount } = await supabase
    .from('league_averages')
    .select('*', { count: 'exact', head: true });

  // Check settled_outcomes count
  const { count: settledCount } = await supabase
    .from('settled_outcomes')
    .select('*', { count: 'exact', head: true });

  console.log(`\n   Database Status:`);
  console.log(`      Player Stats: ${playerStatsCount || 0} entries`);
  console.log(`      League Averages: ${leagueAvgCount || 0} entries`);
  console.log(`      Settled Outcomes: ${settledCount || 0} entries`);

  const isReady = (playerStatsCount || 0) >= 100 || (leagueAvgCount || 0) >= 5;

  if (isReady) {
    console.log(`\n   ✅ SYSTEM READY FOR REAL CALCULATIONS`);
    console.log(`      Can now use player historical method or league average method`);
  } else {
    console.log(`\n   ⚠️  LIMITED DATA - Using fallback methods`);
    console.log(`      Collect more data to improve accuracy`);
  }

  return isReady;
}

async function main() {
  console.log('🚀 COMPREHENSIVE DATA COLLECTION');
  console.log('==========================================');
  console.log('Collecting from FREE sources:');
  console.log('   - MLB Stats API (official, free)');
  console.log('   - OddsAPI game results (already paying)');
  console.log('');

  try {
    const daysBack = 30; // Collect last 30 days

    // Collect MLB stats (may take a while)
    const mlbStats = await collectMLBStats(daysBack);

    // Collect OddsAPI results
    const oddsAPIResults = await collectOddsAPIResults(daysBack);

    // Calculate league averages from collected data
    if (mlbStats > 0) {
      await calculateLeagueAveragesFromData();
    }

    // Validate
    const isReady = await validateDataCollection();

    console.log('\n\n🎉 DATA COLLECTION COMPLETE');
    console.log('==========================================');
    console.log(`   MLB Stats Collected: ${mlbStats}`);
    console.log(`   OddsAPI Games: ${oddsAPIResults}`);
    console.log(`   System Ready: ${isReady ? 'YES' : 'NEEDS MORE DATA'}`);

    if (isReady) {
      console.log('\n✅ NEXT STEP: Run comparison test');
      console.log('   npx tsx src/scripts/ml/compare-old-vs-new-system.ts');
    }

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Collection failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
