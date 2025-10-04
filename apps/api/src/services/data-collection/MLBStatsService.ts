/**
 * MLB Stats API Integration
 *
 * Official MLB Stats API - FREE and comprehensive
 * Documentation: https://github.com/toddrob99/MLB-StatsAPI
 * Base URL: https://statsapi.mlb.com/api/v1
 */

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

interface MLBPlayer {
  id: number;
  fullName: string;
  primaryPosition?: {
    abbreviation: string;
  };
}

interface MLBGameStats {
  playerId: number;
  playerName: string;
  team: string;
  opponent: string;
  gameDate: string;
  homeAway: 'home' | 'away';
  stats: {
    // Batting stats
    hits?: number;
    atBats?: number;
    runs?: number;
    rbi?: number;
    homeRuns?: number;
    strikeOuts?: number;
    baseOnBalls?: number;
    stolenBases?: number;
    totalBases?: number;
    doubles?: number;
    triples?: number;

    // Pitching stats
    inningsPitched?: number;
    earnedRuns?: number;
    pitchingStrikeouts?: number;
    walks?: number;
    hitsAllowed?: number;
    homeRunsAllowed?: number;
  };
}

export class MLBStatsService {
  private baseUrl = 'https://statsapi.mlb.com/api/v1';

  /**
   * Get schedule for a specific date
   */
  async getSchedule(date: string): Promise<any[]> {
    const url = `${this.baseUrl}/schedule`;
    const params = {
      sportId: 1, // MLB
      date,
      hydrate: 'team,linescore,decisions',
    };

    try {
      const response = await axios.get(url, { params });
      return response.data.dates[0]?.games || [];
    } catch (error: any) {
      console.error('Error fetching MLB schedule:', error.message);
      return [];
    }
  }

  /**
   * Get box score for a game (includes player stats)
   */
  async getBoxScore(gamePk: number): Promise<any> {
    const url = `${this.baseUrl}/game/${gamePk}/boxscore`;

    try {
      const response = await axios.get(url);
      return response.data;
    } catch (error: any) {
      console.error(`Error fetching boxscore for game ${gamePk}:`, error.message);
      return null;
    }
  }

  /**
   * Extract player stats from box score
   */
  extractPlayerStats(boxscore: any, gameDate: string): MLBGameStats[] {
    const playerStats: MLBGameStats[] = [];

    // Process home team
    const homeTeam = boxscore.teams.home;
    const awayTeam = boxscore.teams.away;

    // Extract batting stats for home team
    Object.values(homeTeam.players || {}).forEach((player: any) => {
      if (player.stats?.batting) {
        const batting = player.stats.batting;

        playerStats.push({
          playerId: player.person.id,
          playerName: player.person.fullName,
          team: homeTeam.team.name,
          opponent: awayTeam.team.name,
          gameDate,
          homeAway: 'home',
          stats: {
            hits: batting.hits,
            atBats: batting.atBats,
            runs: batting.runs,
            rbi: batting.rbi,
            homeRuns: batting.homeRuns,
            strikeOuts: batting.strikeOuts,
            baseOnBalls: batting.baseOnBalls,
            stolenBases: batting.stolenBases,
            totalBases: batting.totalBases,
            doubles: batting.doubles,
            triples: batting.triples,
          }
        });
      }

      // Extract pitching stats
      if (player.stats?.pitching) {
        const pitching = player.stats.pitching;

        playerStats.push({
          playerId: player.person.id,
          playerName: player.person.fullName,
          team: homeTeam.team.name,
          opponent: awayTeam.team.name,
          gameDate,
          homeAway: 'home',
          stats: {
            inningsPitched: parseFloat(pitching.inningsPitched || 0),
            earnedRuns: pitching.earnedRuns,
            pitchingStrikeouts: pitching.strikeOuts,
            walks: pitching.baseOnBalls,
            hitsAllowed: pitching.hits,
            homeRunsAllowed: pitching.homeRuns,
          }
        });
      }
    });

    // Extract batting stats for away team
    Object.values(awayTeam.players || {}).forEach((player: any) => {
      if (player.stats?.batting) {
        const batting = player.stats.batting;

        playerStats.push({
          playerId: player.person.id,
          playerName: player.person.fullName,
          team: awayTeam.team.name,
          opponent: homeTeam.team.name,
          gameDate,
          homeAway: 'away',
          stats: {
            hits: batting.hits,
            atBats: batting.atBats,
            runs: batting.runs,
            rbi: batting.rbi,
            homeRuns: batting.homeRuns,
            strikeOuts: batting.strikeOuts,
            baseOnBalls: batting.baseOnBalls,
            stolenBases: batting.stolenBases,
            totalBases: batting.totalBases,
            doubles: batting.doubles,
            triples: batting.triples,
          }
        });
      }

      // Extract pitching stats
      if (player.stats?.pitching) {
        const pitching = player.stats.pitching;

        playerStats.push({
          playerId: player.person.id,
          playerName: player.person.fullName,
          team: awayTeam.team.name,
          opponent: homeTeam.team.name,
          gameDate,
          homeAway: 'away',
          stats: {
            inningsPitched: parseFloat(pitching.inningsPitched || 0),
            earnedRuns: pitching.earnedRuns,
            pitchingStrikeouts: pitching.strikeOuts,
            walks: pitching.baseOnBalls,
            hitsAllowed: pitching.hits,
            homeRunsAllowed: pitching.homeRuns,
          }
        });
      }
    });

    return playerStats;
  }

  /**
   * Store player stats in database
   */
  async storePlayerStats(playerStats: MLBGameStats[]): Promise<number> {
    let stored = 0;

    for (const stat of playerStats) {
      const record = {
        player_id: stat.playerId.toString(),
        player_name: stat.playerName,
        sport: 'MLB',
        team: stat.team,
        game_date: stat.gameDate,
        opponent: stat.opponent,
        home_away: stat.homeAway,
        stats: stat.stats,
        season: new Date(stat.gameDate).getFullYear(),
      };

      try {
        const { error } = await supabase
          .from('player_stats')
          .upsert(record, {
            onConflict: 'player_id,sport,game_date',
            ignoreDuplicates: true
          });

        if (!error) stored++;
      } catch (err) {
        // Ignore duplicates
      }
    }

    return stored;
  }

  /**
   * Collect stats for a specific date
   */
  async collectStatsForDate(date: string): Promise<number> {
    console.log(`\n📅 Collecting MLB stats for ${date}...`);

    // Get schedule for date
    const games = await this.getSchedule(date);
    console.log(`   Found ${games.length} games`);

    if (games.length === 0) {
      return 0;
    }

    let totalStats = 0;

    // For each completed game, get box score
    for (const game of games) {
      if (game.status.statusCode !== 'F') {
        continue; // Skip non-final games
      }

      console.log(`   Processing: ${game.teams.away.team.name} @ ${game.teams.home.team.name}`);

      const boxscore = await this.getBoxScore(game.gamePk);
      if (!boxscore) continue;

      const playerStats = this.extractPlayerStats(boxscore, date);
      const stored = await this.storePlayerStats(playerStats);

      console.log(`      ✅ Stored ${stored} player stat lines`);
      totalStats += stored;

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return totalStats;
  }

  /**
   * Collect stats for date range
   */
  async collectStatsForDateRange(startDate: string, endDate: string): Promise<number> {
    console.log('🚀 MLB STATS COLLECTION');
    console.log('==========================================');
    console.log(`Date Range: ${startDate} to ${endDate}\n`);

    const start = new Date(startDate);
    const end = new Date(endDate);
    let totalStats = 0;

    for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const stats = await this.collectStatsForDate(dateStr);
      totalStats += stats;
    }

    console.log('\n\n🎉 COLLECTION COMPLETE');
    console.log('==========================================');
    console.log(`Total Player Stats: ${totalStats}`);

    return totalStats;
  }

  /**
   * Collect last N days of stats
   */
  async collectRecentStats(daysBack: number = 7): Promise<number> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    return this.collectStatsForDateRange(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
  }
}

// Export singleton
export const mlbStatsService = new MLBStatsService();
