/**
 * Collect 2024 NFL Season Stats (Current Season)
 *
 * Priority: NFL is in Week 4, need recent data for grading system
 * MLB playoffs are ending soon, so NFL becomes primary focus
 *
 * This collects:
 * - Weeks 1-4 (already completed)
 * - Player stats for all games
 * - Settles existing NFL props from our database
 */

import { createClient } from '@supabase/supabase-js';
import { nflStatsService } from '../../services/data-collection/NFLStatsService';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

const NFL_2024_SEASON = {
  year: 2024,
  weeks: [
    { week: 1, dates: ['2024-09-05', '2024-09-06', '2024-09-08', '2024-09-09'] },
    { week: 2, dates: ['2024-09-12', '2024-09-13', '2024-09-15', '2024-09-16'] },
    { week: 3, dates: ['2024-09-19', '2024-09-20', '2024-09-22', '2024-09-23'] },
    { week: 4, dates: ['2024-09-26', '2024-09-27', '2024-09-29', '2024-09-30'] }
  ]
};

async function collectNFL2024Season() {
  console.log('🏈 COLLECTING 2024 NFL SEASON DATA');
  console.log('==========================================');
  console.log('Season: 2024 Regular Season');
  console.log('Weeks: 1-4 (Weeks 1-4 already completed)');
  console.log('Purpose: Build historical data for probability grading\n');

  let totalStats = 0;
  let totalGames = 0;

  // Process each week
  for (const weekData of NFL_2024_SEASON.weeks) {
    console.log(`\n📅 WEEK ${weekData.week}`);
    console.log('─'.repeat(50));

    for (const date of weekData.dates) {
      console.log(`\n   Processing ${date}...`);

      try {
        // Fetch scoreboard for this date
        const scoreboard = await nflStatsService.getScoreboard(weekData.week, 2024);

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
            console.log(`      ${event.shortName}: Not completed, skipping`);
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

  console.log('\n\n🎉 2024 NFL SEASON DATA COLLECTION COMPLETE');
  console.log('==========================================');
  console.log(`Total Games Processed: ${totalGames}`);
  console.log(`Total Player Stats: ${totalStats}`);

  // Show sample stats
  console.log('\n📊 Sample Player Stats:');
  const { data: sampleStats } = await supabase
    .from('player_stats')
    .select('*')
    .eq('sport', 'NFL')
    .gte('game_date', '2024-09-05')
    .order('game_date', { ascending: false })
    .limit(5);

  if (sampleStats && sampleStats.length > 0) {
    sampleStats.forEach(stat => {
      console.log(`   ${stat.player_name} (${stat.team}): ${stat.game_date}`);
      console.log(`      ${JSON.stringify(stat.stats)}`);
    });
  }

  // Now settle NFL props using this data
  console.log('\n\n🎯 SETTLING NFL PROPS');
  console.log('==========================================\n');

  await settleNFLProps();

  process.exit(0);
}

async function settleNFLProps() {
  // Get all NFL props from Weeks 1-4
  const { data: nflProps, count } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact' })
    .eq('sport', 'NFL')
    .gte('game_date', '2024-09-05')
    .lte('game_date', '2024-09-30');

  console.log(`Found ${count || 0} NFL props to settle\n`);

  if (!nflProps || nflProps.length === 0) {
    console.log('No NFL props to settle');
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
      .ilike('player_name', `%${prop.player_name.split(' ').pop()}%`) // Match last name
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

  console.log(`\n✅ Settled ${settled} NFL props`);
}

function determineNFLOutcome(prop: any, playerStat: any): any | null {
  const marketType = (prop.stat_type || prop.market_type || '').toLowerCase();
  const line = parseFloat(prop.line);
  const selection = prop.selection?.toLowerCase() || 'over';

  let actualValue: number | undefined;

  // Map market types
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

  // Determine outcome
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
    season: 2024,
    source: 'espn_api'
  };
}

collectNFL2024Season().catch(error => {
  console.error('❌ Collection failed:', error);
  process.exit(1);
});
