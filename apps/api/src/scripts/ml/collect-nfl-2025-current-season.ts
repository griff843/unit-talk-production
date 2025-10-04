/**
 * Collect 2025 NFL Current Season Stats
 *
 * Current Date: October 2, 2025
 * NFL 2025 Season: Week 4 (in progress)
 *
 * Collecting Weeks 1-4 from CURRENT 2025 season for immediate grading use
 */

import { createClient } from '@supabase/supabase-js';
import { nflStatsService } from '../../services/data-collection/NFLStatsService';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

const NFL_2025_SEASON = {
  year: 2025,
  weeks: [
    { week: 1, dates: ['2025-09-04', '2025-09-05', '2025-09-07', '2025-09-08'] },
    { week: 2, dates: ['2025-09-11', '2025-09-12', '2025-09-14', '2025-09-15'] },
    { week: 3, dates: ['2025-09-18', '2025-09-19', '2025-09-21', '2025-09-22'] },
    { week: 4, dates: ['2025-09-25', '2025-09-26', '2025-09-28', '2025-09-29'] }
  ]
};

async function collect2025NFLSeason() {
  console.log('🏈 COLLECTING 2025 NFL CURRENT SEASON DATA');
  console.log('==========================================');
  console.log('Season: 2025 Regular Season (CURRENT)');
  console.log('Weeks: 1-4 (Weeks 1-4 completed)');
  console.log('Purpose: Immediate grading for Week 5+ games\n');

  let totalStats = 0;
  let totalGames = 0;

  // Process each week
  for (const weekData of NFL_2025_SEASON.weeks) {
    console.log(`\n📅 WEEK ${weekData.week} (2025)`);
    console.log('─'.repeat(50));

    for (const date of weekData.dates) {
      console.log(`\n   Processing ${date}...`);

      try {
        // Fetch scoreboard for this date
        const scoreboard = await nflStatsService.getScoreboard(weekData.week, 2025);

        if (!scoreboard || !scoreboard.events) {
          console.log(`      No games found`);
          continue;
        }

        // Filter to games on this specific date
        const gamesOnDate = scoreboard.events.filter((event: any) => {
          const gameDate = event.date.split('T')[0];
          return gameDate === date;
        });

        console.log(`      Found ${gamesOnDate.length} games`);

        // Process each completed game
        for (const event of gamesOnDate) {
          if (!event.status?.type?.completed) {
            console.log(`      ${event.shortName}: Not completed yet`);
            continue;
          }

          console.log(`      ${event.shortName}: Processing...`);
          totalGames++;

          // Get game summary with box score
          const summary = await nflStatsService.getGameSummary(event.id);

          if (!summary) {
            console.log(`         ⚠️ No summary available`);
            continue;
          }

          // Extract player stats
          const playerStats = nflStatsService.extractPlayerStats(summary, date);

          if (playerStats.length === 0) {
            console.log(`         ⚠️ No player stats found`);
            continue;
          }

          // Store in database
          const stored = await nflStatsService.storePlayerStats(playerStats);

          console.log(`         ✅ Stored ${stored} player stat lines`);
          totalStats += stored;

          // Rate limiting (ESPN API)
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error: any) {
        console.error(`      ❌ Error processing ${date}:`, error.message);
      }
    }

    console.log(`\n   Week ${weekData.week} complete: ${totalStats} total stats collected`);
  }

  console.log('\n\n🎉 2025 NFL CURRENT SEASON DATA COLLECTION COMPLETE');
  console.log('==========================================');
  console.log(`Total Games Processed: ${totalGames}`);
  console.log(`Total Player Stats: ${totalStats}`);

  // Show sample stats
  console.log('\n📊 Sample Player Stats from 2025:');
  const { data: sampleStats } = await supabase
    .from('player_stats')
    .select('*')
    .eq('sport', 'NFL')
    .eq('season', 2025)
    .order('game_date', { ascending: false })
    .limit(5);

  if (sampleStats && sampleStats.length > 0) {
    sampleStats.forEach(stat => {
      console.log(`   ${stat.player_name} (${stat.team}): ${stat.game_date}`);
      console.log(`      ${JSON.stringify(stat.stats)}`);
    });
  }

  // Now settle NFL props from 2025 season
  console.log('\n\n🎯 SETTLING 2025 NFL PROPS');
  console.log('==========================================\n');

  await settle2025NFLProps();

  process.exit(0);
}

async function settle2025NFLProps() {
  // Get all NFL props from Sept 2025 (Weeks 1-4)
  const { data: nflProps, count } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact' })
    .eq('sport', 'NFL')
    .gte('game_date', '2025-09-04')
    .lte('game_date', '2025-09-29');

  console.log(`Found ${count || 0} NFL props from 2025 season to settle\n`);

  if (!nflProps || nflProps.length === 0) {
    console.log('No 2025 NFL props to settle');
    return;
  }

  let settled = 0;

  for (const prop of nflProps) {
    // Get player stats for this game date
    const { data: playerStats } = await supabase
      .from('player_stats')
      .select('*')
      .eq('sport', 'NFL')
      .eq('game_date', prop.game_date)
      .eq('season', 2025)
      .ilike('player_name', `%${prop.player_name.split(' ').pop()}%`)
      .limit(1)
      .single();

    if (!playerStats) continue;

    // Determine outcome
    const outcome = determineNFLOutcome(prop, playerStats);

    if (!outcome) continue;

    // Store settlement
    try {
      await supabase.from('settled_outcomes').insert(outcome);
      settled++;

      if (settled % 10 === 0) {
        console.log(`   Settled ${settled} NFL props...`);
      }
    } catch (err) {
      // Ignore duplicates
    }
  }

  console.log(`\n✅ Settled ${settled} NFL props from 2025 season`);
}

function determineNFLOutcome(prop: any, playerStat: any): any | null {
  const marketType = (prop.stat_type || prop.market_type || '').toLowerCase();
  const line = parseFloat(prop.line);
  const selection = prop.selection?.toLowerCase() || 'over';

  let actualValue: number | undefined;

  if (marketType.includes('pass') && marketType.includes('yds')) {
    actualValue = playerStat.stats.passingYards;
  } else if (marketType.includes('pass') && marketType.includes('td')) {
    actualValue = playerStat.stats.passingTDs;
  } else if (marketType.includes('rush') && marketType.includes('yds')) {
    actualValue = playerStat.stats.rushingYards;
  } else if (marketType.includes('rush') && marketType.includes('td')) {
    actualValue = playerStat.stats.rushingTDs;
  } else if (marketType.includes('rec') && (marketType.includes('yds') || marketType.includes('yards'))) {
    actualValue = playerStat.stats.receivingYards;
  } else if (marketType.includes('rec') && marketType.includes('td')) {
    actualValue = playerStat.stats.receivingTDs;
  } else if (marketType.includes('receptions')) {
    actualValue = playerStat.stats.receptions;
  }

  if (actualValue === undefined || actualValue === null) {
    return null;
  }

  let outcome: 'win' | 'loss' | 'push';
  if (selection === 'over') {
    outcome = actualValue > line ? 'win' : actualValue < line ? 'loss' : 'push';
  } else {
    outcome = actualValue < line ? 'win' : actualValue > line ? 'loss' : 'push';
  }

  return {
    prop_id: prop.id,
    sport: 'NFL',
    player_name: prop.player_name,
    market_type: prop.stat_type || prop.market_type,
    line: line,
    odds: prop.odds,
    selection: selection,
    outcome: outcome,
    actual_value: actualValue,
    game_date: prop.game_date,
    settled_at: new Date().toISOString(),
    settlement_method: 'exact_match',
    confidence: 0.95,
    season: 2025,
    source: 'espn_api'
  };
}

collect2025NFLSeason().catch(error => {
  console.error('❌ Collection failed:', error);
  process.exit(1);
});
