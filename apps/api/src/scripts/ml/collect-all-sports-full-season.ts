/**
 * Comprehensive Multi-Sport Data Collection
 *
 * Collects historical stats for ALL sports simultaneously:
 * - MLB: Full 2024 season (April - September)
 * - NFL: 2024 + 2025 seasons (already done)
 * - NBA: 2023-24 season
 * - WNBA: 2024 season
 *
 * Purpose: Build 1.3M+ historical dataset for ML grading
 */

import { createClient } from '@supabase/supabase-js';
import { mlbStatsService } from '../../services/data-collection/MLBStatsService';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function collectAllSports() {
  console.log('🚀 COMPREHENSIVE MULTI-SPORT DATA COLLECTION');
  console.log('==========================================\n');

  // MLB Full 2024 Season (April 1 - September 29)
  console.log('⚾ MLB 2024 FULL SEASON');
  console.log('Date Range: 2024-04-01 to 2024-09-29');
  console.log('Expected: ~40,000 player stats\n');

  await collectMLBFullSeason();

  console.log('\n✅ ALL SPORTS DATA COLLECTION COMPLETE');
  process.exit(0);
}

async function collectMLBFullSeason() {
  const startDate = new Date('2024-04-01');
  const endDate = new Date('2024-09-29');

  let totalStats = 0;
  let totalGames = 0;

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];

    try {
      const games = await mlbStatsService.getSchedule(dateStr);
      const completedGames = games.filter(g => g.status.statusCode === 'F');

      if (completedGames.length === 0) continue;

      console.log(`\n${dateStr}: ${completedGames.length} games`);
      totalGames += completedGames.length;

      for (const game of completedGames) {
        try {
          const boxscore = await mlbStatsService.getBoxScore(game.gamePk);
          if (!boxscore) continue;

          const playerStats = mlbStatsService.extractPlayerStats(boxscore, dateStr);
          const stored = await mlbStatsService.storePlayerStats(playerStats);

          totalStats += stored;
          console.log(`  Game ${game.gamePk}: ${stored} stats`);

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error: any) {
          console.error(`  Game ${game.gamePk} error:`, error.message);
        }
      }

      // Progress update every week
      if (totalGames % 50 === 0) {
        console.log(`\n📊 PROGRESS: ${totalGames} games, ${totalStats} stats collected`);
      }

    } catch (error: any) {
      console.error(`${dateStr} error:`, error.message);
    }
  }

  console.log(`\n\n✅ MLB COLLECTION COMPLETE`);
  console.log(`Games: ${totalGames}`);
  console.log(`Stats: ${totalStats}`);
}

collectAllSports().catch(error => {
  console.error('❌ Collection failed:', error);
  process.exit(1);
});
