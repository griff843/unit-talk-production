/**
 * NFL Stats API Integration
 *
 * Uses ESPN API (unofficial but works) for NFL player statistics
 * Endpoint: https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard
 */

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export interface NFLGameStats {
  playerId: string;
  playerName: string;
  team: string;
  opponent: string;
  gameDate: string;
  homeAway: 'home' | 'away';
  stats: {
    // Passing stats
    passingYards?: number;
    passingTDs?: number;
    passingCompletions?: number;
    passingAttempts?: number;
    passingInterceptions?: number;

    // Rushing stats
    rushingYards?: number;
    rushingTDs?: number;
    rushingAttempts?: number;

    // Receiving stats
    receivingYards?: number;
    receivingTDs?: number;
    receptions?: number;
    receivingTargets?: number;

    // Defense stats
    tackles?: number;
    sacks?: number;
    interceptions?: number;
  };
}

export class NFLStatsService {
  private baseUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

  /**
   * Get scoreboard for a specific week
   */
  async getScoreboard(week: number, season: number): Promise<any> {
    const url = `${this.baseUrl}/scoreboard`;
    const params = {
      dates: season,
      seasontype: 2, // Regular season
      week,
    };

    try {
      const response = await axios.get(url, { params });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching NFL scoreboard:', error.message);
      return null;
    }
  }

  /**
   * Get game summary (includes box score with player stats)
   */
  async getGameSummary(gameId: string): Promise<any> {
    const url = `${this.baseUrl}/summary`;
    const params = { event: gameId };

    try {
      const response = await axios.get(url, { params });
      return response.data;
    } catch (error: any) {
      console.error(`Error fetching NFL game summary ${gameId}:`, error.message);
      return null;
    }
  }

  /**
   * Extract player stats from game summary
   */
  extractPlayerStats(summary: any, gameDate: string): NFLGameStats[] {
    const playerStats: NFLGameStats[] = [];

    if (!summary || !summary.boxscore || !summary.boxscore.players) {
      return playerStats;
    }

    const teams = summary.boxscore.players;

    teams.forEach((teamData: any) => {
      const team = teamData.team;
      const homeAway = teamData.homeAway || 'home';

      // Each team has statistics categories (passing, rushing, receiving, defense)
      teamData.statistics?.forEach((statCategory: any) => {
        const categoryName = statCategory.name.toLowerCase();

        statCategory.athletes?.forEach((athlete: any) => {
          const stats: any = {};

          // Map stat labels to values
          athlete.stats?.forEach((statValue: string, index: number) => {
            const label = statCategory.labels?.[index]?.toLowerCase() || '';

            if (categoryName.includes('passing')) {
              if (label.includes('yds') || label.includes('yards')) stats.passingYards = parseFloat(statValue);
              if (label.includes('td')) stats.passingTDs = parseFloat(statValue);
              if (label.includes('c/att')) {
                const [comp, att] = statValue.split('/');
                stats.passingCompletions = parseFloat(comp);
                stats.passingAttempts = parseFloat(att);
              }
              if (label.includes('int')) stats.passingInterceptions = parseFloat(statValue);
            } else if (categoryName.includes('rushing')) {
              if (label.includes('yds') || label.includes('yards')) stats.rushingYards = parseFloat(statValue);
              if (label.includes('td')) stats.rushingTDs = parseFloat(statValue);
              if (label.includes('car') || label.includes('att')) stats.rushingAttempts = parseFloat(statValue);
            } else if (categoryName.includes('receiving')) {
              if (label.includes('yds') || label.includes('yards')) stats.receivingYards = parseFloat(statValue);
              if (label.includes('td')) stats.receivingTDs = parseFloat(statValue);
              if (label.includes('rec')) stats.receptions = parseFloat(statValue);
              if (label.includes('tgt') || label.includes('tar')) stats.receivingTargets = parseFloat(statValue);
            } else if (categoryName.includes('defense') || categoryName.includes('defensive')) {
              if (label.includes('tot') || label.includes('tackle')) stats.tackles = parseFloat(statValue);
              if (label.includes('sack')) stats.sacks = parseFloat(statValue);
              if (label.includes('int')) stats.interceptions = parseFloat(statValue);
            }
          });

          // Only add if we got some stats
          if (Object.keys(stats).length > 0) {
            playerStats.push({
              playerId: athlete.athlete?.id || 'unknown',
              playerName: athlete.athlete?.displayName || 'Unknown',
              team: team.displayName,
              opponent: '', // Will be filled in later
              gameDate,
              homeAway: homeAway as 'home' | 'away',
              stats,
            });
          }
        });
      });
    });

    return playerStats;
  }

  /**
   * Store player stats in database
   */
  async storePlayerStats(playerStats: NFLGameStats[]): Promise<number> {
    let stored = 0;

    for (const stat of playerStats) {
      const record = {
        player_id: stat.playerId,
        player_name: stat.playerName,
        sport: 'NFL',
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
            ignoreDuplicates: true,
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
    console.log(`\n📅 Collecting NFL stats for ${date}...`);

    // ESPN scoreboard uses week-based system
    // Convert date to season and week
    const gameDate = new Date(date);
    const season = gameDate.getFullYear();

    // Approximate week calculation (NFL season starts early September)
    const seasonStart = new Date(season, 8, 1); // Sept 1
    const weeksDiff = Math.floor((gameDate.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const week = Math.max(1, Math.min(18, weeksDiff + 1));

    const scoreboard = await this.getScoreboard(week, season);

    if (!scoreboard || !scoreboard.events) {
      console.log('   No NFL games found');
      return 0;
    }

    const games = scoreboard.events;
    console.log(`   Found ${games.length} games for week ${week}`);

    let totalStats = 0;

    for (const event of games) {
      if (event.status.type.completed !== true) {
        continue; // Skip non-completed games
      }

      console.log(`   Processing: ${event.name}`);

      const summary = await this.getGameSummary(event.id);
      if (!summary) continue;

      const playerStats = this.extractPlayerStats(summary, date);
      const stored = await this.storePlayerStats(playerStats);

      console.log(`      ✅ Stored ${stored} player stat lines`);
      totalStats += stored;

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return totalStats;
  }

  /**
   * Collect recent stats (last N weeks)
   */
  async collectRecentStats(weeksBack: number = 4): Promise<number> {
    console.log('🏈 NFL STATS COLLECTION');
    console.log('==========================================');

    const endDate = new Date();
    let totalStats = 0;

    for (let i = 0; i < weeksBack; i++) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - (i * 7));
      const dateStr = date.toISOString().split('T')[0];

      const stats = await this.collectStatsForDate(dateStr);
      totalStats += stats;
    }

    console.log('\n\n🎉 COLLECTION COMPLETE');
    console.log('==========================================');
    console.log(`Total Player Stats: ${totalStats}`);

    return totalStats;
  }
}

// Export singleton
export const nflStatsService = new NFLStatsService();
