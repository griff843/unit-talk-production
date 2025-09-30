import { BaseAdapter, PlayerStatMap } from './types';
import axios from 'axios';
import { createLogger, Logger } from '../../../utils/logger';

/**
 * SportsGameOdds.com settlement adapter
 * Provides settlement data from SGO API for backfilled props
 */
export class SgoAdapter extends BaseAdapter {
  private logger: Logger;
  private baseUrl = 'https://api.sportsgameodds.com/v2';
  private apiKey: string;

  constructor() {
    super();
    this.logger = createLogger('SgoAdapter');
    this.rateLimit = 30; // 30 requests per minute for settlement
    this.apiKey = process.env.SPORTSGAMEODDS_KEY || '';
  }

  getName(): string {
    return 'SportsGameOdds';
  }

  /**
   * Fetch game stats for settlement from SGO API
   */
  async fetchGameStats(gameId: string): Promise<PlayerStatMap> {
    return this.retryWithBackoff(async () => {
      try {
        if (!this.apiKey) {
          throw new Error('SPORTSGAMEODDS_KEY not configured');
        }

        this.logger.info(`Fetching SGO game stats for settlement: ${gameId}`);

        // First get game details to identify sport
        const gameResponse = await axios.get(`${this.baseUrl}/games/${gameId}`, {
          headers: {
            'x-api-key': this.apiKey,
            'User-Agent': 'UnitTalk/1.0 Settlement System'
          },
          timeout: 15000
        });

        if (!gameResponse.data || !gameResponse.data.game) {
          throw new Error(`Game ${gameId} not found in SGO`);
        }

        const game = gameResponse.data.game;
        
        // Then fetch player stats based on sport
        const statsResponse = await axios.get(
          `${this.baseUrl}/games/${gameId}/results`,
          {
            headers: {
              'x-api-key': this.apiKey,
              'User-Agent': 'UnitTalk/1.0 Settlement System'
            },
            params: {
              include_player_stats: true,
              include_team_stats: true
            },
            timeout: 15000
          }
        );

        return this.parseSgoStatsResponse(statsResponse.data, game.sport);
        
      } catch (error: any) {
        this.logger.error('Failed to fetch SGO game stats', { 
          gameId, 
          error: error.message,
          status: error.response?.status 
        });

        if (error.response?.status === 404) {
          this.logger.info(`Game ${gameId} not found in SGO - may not be available for settlement`);
          return {};
        }

        if (error.response?.status === 429) {
          throw new Error('SGO API rate limit exceeded');
        }

        throw error;
      }
    });
  }

  /**
   * Parse SGO stats response into PlayerStatMap format
   */
  private parseSgoStatsResponse(data: any, sport: string): PlayerStatMap {
    const playerStats: PlayerStatMap = {};

    try {
      if (!data || !data.results) {
        this.logger.warn('No results data in SGO response');
        return {};
      }

      const results = data.results;

      // Parse player statistics based on sport
      if (results.player_stats && Array.isArray(results.player_stats)) {
        for (const playerStat of results.player_stats) {
          const playerName = this.normalizePlayerName(playerStat.player_name || playerStat.name);
          
          if (!playerName) continue;

          if (!playerStats[playerName]) {
            playerStats[playerName] = {};
          }

          // Map SGO stat types to internal stat types
          const statMappings = this.getSportStatMappings(sport);
          
          for (const [sgoStatType, internalStatType] of Object.entries(statMappings)) {
            if (playerStat[sgoStatType] !== undefined) {
              playerStats[playerName][internalStatType] = this.parseStatValue(playerStat[sgoStatType]);
            }
          }

          // Handle composite stats
          this.addCompositeStats(playerStats[playerName], sport);
        }
      }

      // Parse team statistics if available
      if (results.team_stats && Array.isArray(results.team_stats)) {
        for (const teamStat of results.team_stats) {
          const teamName = teamStat.team_name || 'Team';
          
          if (!playerStats[teamName]) {
            playerStats[teamName] = {};
          }

          // Add team-level stats
          const teamStatMappings = this.getTeamStatMappings(sport);
          
          for (const [sgoStatType, internalStatType] of Object.entries(teamStatMappings)) {
            if (teamStat[sgoStatType] !== undefined) {
              playerStats[teamName][internalStatType] = this.parseStatValue(teamStat[sgoStatType]);
            }
          }
        }
      }

      this.logger.info(`Parsed SGO stats for ${Object.keys(playerStats).length} players/entities`);
      return playerStats;

    } catch (error) {
      this.logger.error('Failed to parse SGO stats response', { error, sport });
      return {};
    }
  }

  /**
   * Get stat mapping for different sports
   */
  private getSportStatMappings(sport: string): Record<string, string> {
    const mappings: Record<string, Record<string, string>> = {
      'MLB': {
        'hits': 'hits',
        'runs': 'runs',
        'rbi': 'rbi',
        'home_runs': 'home_runs',
        'stolen_bases': 'stolen_bases',
        'strikeouts': 'strikeouts',
        'walks': 'walks',
        'innings_pitched': 'innings_pitched',
        'earned_runs': 'earned_runs',
        'wins': 'wins',
        'saves': 'saves'
      },
      'NFL': {
        'passing_yards': 'passing_yards',
        'passing_touchdowns': 'passing_touchdowns',
        'interceptions': 'interceptions',
        'rushing_yards': 'rushing_yards',
        'rushing_touchdowns': 'rushing_touchdowns',
        'receiving_yards': 'receiving_yards',
        'receiving_touchdowns': 'receiving_touchdowns',
        'receptions': 'receptions',
        'sacks': 'sacks',
        'tackles': 'tackles'
      },
      'NBA': {
        'points': 'points',
        'rebounds': 'rebounds',
        'assists': 'assists',
        'steals': 'steals',
        'blocks': 'blocks',
        'turnovers': 'turnovers',
        'field_goals_made': 'field_goals_made',
        'three_pointers_made': 'three_pointers_made',
        'free_throws_made': 'free_throws_made',
        'minutes': 'minutes'
      },
      'WNBA': {
        'points': 'points',
        'rebounds': 'rebounds',
        'assists': 'assists',
        'steals': 'steals',
        'blocks': 'blocks',
        'turnovers': 'turnovers',
        'field_goals_made': 'field_goals_made',
        'three_pointers_made': 'three_pointers_made',
        'free_throws_made': 'free_throws_made'
      },
      'NHL': {
        'goals': 'goals',
        'assists': 'assists',
        'shots': 'shots',
        'saves': 'saves',
        'penalty_minutes': 'penalty_minutes',
        'power_play_goals': 'power_play_goals',
        'short_handed_goals': 'short_handed_goals'
      },
      'NCAAF': {
        'passing_yards': 'passing_yards',
        'passing_touchdowns': 'passing_touchdowns',
        'rushing_yards': 'rushing_yards',
        'rushing_touchdowns': 'rushing_touchdowns',
        'receiving_yards': 'receiving_yards',
        'receiving_touchdowns': 'receiving_touchdowns',
        'receptions': 'receptions',
        'tackles': 'tackles',
        'sacks': 'sacks'
      },
      'NCAAB': {
        'points': 'points',
        'rebounds': 'rebounds',
        'assists': 'assists',
        'steals': 'steals',
        'blocks': 'blocks',
        'turnovers': 'turnovers',
        'field_goals_made': 'field_goals_made',
        'three_pointers_made': 'three_pointers_made'
      }
    };

    return mappings[sport] || {};
  }

  /**
   * Get team stat mappings
   */
  private getTeamStatMappings(sport: string): Record<string, string> {
    const mappings: Record<string, Record<string, string>> = {
      'MLB': {
        'team_runs': 'total_runs',
        'team_hits': 'total_hits',
        'team_errors': 'total_errors'
      },
      'NFL': {
        'total_yards': 'total_yards',
        'total_points': 'total_points',
        'turnovers': 'turnovers',
        'time_of_possession': 'time_of_possession'
      },
      'NBA': {
        'team_points': 'total_points',
        'team_rebounds': 'total_rebounds',
        'team_assists': 'total_assists',
        'team_turnovers': 'total_turnovers'
      }
    };

    return mappings[sport] || {};
  }

  /**
   * Add composite statistics (e.g., points + rebounds + assists)
   */
  private addCompositeStats(playerStats: Record<string, number>, sport: string): void {
    if (sport === 'NBA' || sport === 'WNBA' || sport === 'NCAAB') {
      // Points + Rebounds + Assists
      const points = playerStats.points || 0;
      const rebounds = playerStats.rebounds || 0;
      const assists = playerStats.assists || 0;
      
      if (points > 0 || rebounds > 0 || assists > 0) {
        playerStats['points_rebounds_assists'] = points + rebounds + assists;
      }

      // Points + Assists  
      if (points > 0 || assists > 0) {
        playerStats['points_assists'] = points + assists;
      }

      // Points + Rebounds
      if (points > 0 || rebounds > 0) {
        playerStats['points_rebounds'] = points + rebounds;
      }

      // Rebounds + Assists
      if (rebounds > 0 || assists > 0) {
        playerStats['rebounds_assists'] = rebounds + assists;
      }
    }

    if (sport === 'NFL' || sport === 'NCAAF') {
      // Passing + Rushing yards
      const passingYards = playerStats.passing_yards || 0;
      const rushingYards = playerStats.rushing_yards || 0;
      
      if (passingYards > 0 || rushingYards > 0) {
        playerStats['passing_rushing_yards'] = passingYards + rushingYards;
      }

      // Receiving + Rushing yards
      const receivingYards = playerStats.receiving_yards || 0;
      
      if (receivingYards > 0 || rushingYards > 0) {
        playerStats['receiving_rushing_yards'] = receivingYards + rushingYards;
      }
    }
  }

  /**
   * Normalize player names for consistent matching
   */
  protected normalizePlayerName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-\.\']/g, '') // Remove special chars except hyphens, dots, apostrophes
      .toLowerCase();
  }

  /**
   * Parse stat value, handling different formats
   */
  private parseStatValue(value: any): number {
    if (typeof value === 'number') {
      return value;
    }
    
    if (typeof value === 'string') {
      // Handle fractional format (e.g., "2.1" for innings pitched)
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    
    return 0;
  }
}