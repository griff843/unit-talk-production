/**
 * Analyze Existing Props Data
 *
 * We have 1.4 MILLION props in raw_props!
 * Let's see what we can extract for ML training
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeExistingData() {
  console.log('🔍 ANALYZING 1.4M PROPS IN DATABASE');
  console.log('==========================================\n');

  // Get total count
  const { count: totalProps } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Total Props: ${(totalProps || 0).toLocaleString()}`);

  // By sport
  const { data: bySport } = await supabase
    .from('raw_props')
    .select('sport')
    .limit(10000);

  const sportCounts: Record<string, number> = {};
  bySport?.forEach(p => {
    sportCounts[p.sport] = (sportCounts[p.sport] || 0) + 1;
  });

  console.log('\n📈 By Sport (sample):');
  Object.entries(sportCounts)
    .sort(([,a], [,b]) => b - a)
    .forEach(([sport, count]) => {
      console.log(`   ${sport}: ${count.toLocaleString()}`);
    });

  // Check what columns have data
  const { data: sampleProps } = await supabase
    .from('raw_props')
    .select('*')
    .limit(100);

  if (sampleProps && sampleProps.length > 0) {
    const firstProp = sampleProps[0];
    console.log('\n📋 Available Fields:');
    Object.keys(firstProp).forEach(key => {
      const nonNullCount = sampleProps.filter(p => p[key] != null).length;
      const percentage = (nonNullCount / sampleProps.length * 100).toFixed(0);
      console.log(`   ${key}: ${percentage}% populated`);
    });
  }

  // Check for player props vs game props
  const { data: playerProps } = await supabase
    .from('raw_props')
    .select('player_name, market_type, line, odds, game_date, sport')
    .not('player_name', 'is', null)
    .limit(10);

  console.log('\n🏀 Sample Player Props:');
  playerProps?.slice(0, 5).forEach(p => {
    console.log(`   ${p.sport} - ${p.player_name}: ${p.market_type} ${p.line} @ ${p.odds}`);
  });

  // Check date range
  const { data: dateRange } = await supabase
    .from('raw_props')
    .select('game_date, start_time')
    .not('game_date', 'is', null)
    .order('game_date', { ascending: true })
    .limit(1);

  const { data: latestDate } = await supabase
    .from('raw_props')
    .select('game_date, start_time')
    .not('game_date', 'is', null)
    .order('game_date', { ascending: false })
    .limit(1);

  console.log('\n📅 Date Range:');
  console.log(`   Earliest: ${dateRange?.[0]?.game_date || dateRange?.[0]?.start_time || 'Unknown'}`);
  console.log(`   Latest: ${latestDate?.[0]?.game_date || latestDate?.[0]?.start_time || 'Unknown'}`);

  // Check for game_id to match with results
  const { count: withGameId } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .not('game_id', 'is', null);

  console.log(`\n🎮 Props with game_id: ${(withGameId || 0).toLocaleString()}`);
  console.log(`   Can potentially match ${((withGameId || 0) / (totalProps || 1) * 100).toFixed(1)}% with game results`);

  // Check if we can extract player performance data
  console.log('\n\n🎯 EXTRACTION OPPORTUNITIES');
  console.log('==========================================');

  const { count: nflProps } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL')
    .not('player_name', 'is', null);

  const { count: nbaProps } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NBA')
    .not('player_name', 'is', null);

  const { count: mlbProps } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MLB')
    .not('player_name', 'is', null);

  console.log(`\n📊 Player Props by Sport:`);
  console.log(`   NFL: ${(nflProps || 0).toLocaleString()}`);
  console.log(`   NBA: ${(nbaProps || 0).toLocaleString()}`);
  console.log(`   MLB: ${(mlbProps || 0).toLocaleString()}`);

  // Extract unique players
  const { data: uniquePlayers } = await supabase
    .from('raw_props')
    .select('player_name, sport')
    .not('player_name', 'is', null)
    .limit(1000);

  const playersBySport: Record<string, Set<string>> = {};
  uniquePlayers?.forEach(p => {
    if (!playersBySport[p.sport]) {
      playersBySport[p.sport] = new Set();
    }
    playersBySport[p.sport].add(p.player_name);
  });

  console.log(`\n👥 Unique Players (sample of 1000):`);
  Object.entries(playersBySport).forEach(([sport, players]) => {
    console.log(`   ${sport}: ${players.size} unique players`);
  });

  // ACTIONABLE INSIGHTS
  console.log('\n\n💡 ACTIONABLE INSIGHTS');
  console.log('==========================================');

  console.log(`\n1. We have ${(totalProps || 0).toLocaleString()} props - MASSIVE dataset!`);
  console.log(`2. ${(withGameId || 0).toLocaleString()} have game_id - can match with results`);
  console.log(`3. ${((nflProps || 0) + (nbaProps || 0) + (mlbProps || 0)).toLocaleString()} player props total`);
  console.log(`4. 100s of unique players per sport`);

  console.log(`\n🚀 IMMEDIATE ACTIONS:`);
  console.log(`   1. Match props with game results using game_id`);
  console.log(`   2. Extract player performance patterns from prop lines`);
  console.log(`   3. Calculate historical hit rates from odds movements`);
  console.log(`   4. Build league averages from 1.4M samples!`);
  console.log(`   5. We don't need to collect NEW data - we HAVE the data!`);

  console.log(`\n⚠️  SETTLEMENT NEEDED:`);
  console.log(`   - Most props don't have outcomes yet`);
  console.log(`   - Need to match with game results retroactively`);
  console.log(`   - Use OddsAPI, MLB Stats API, ESPN to settle historical games`);
}

analyzeExistingData().catch(console.error);
