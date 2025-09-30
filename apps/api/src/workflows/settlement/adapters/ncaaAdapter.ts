import { BaseAdapter, PlayerStatMap } from './types';
import axios from 'axios';
import { createLogger, Logger } from '../../../utils/logger';

export class NCAAAdapter extends BaseAdapter {
  private logger: Logger;
  private baseUrl = 'https://site.api.espn.com/apis/site/v2/sports';

  constructor() {
    super();
    this.logger = createLogger('NCAAAdapter');
    this.rateLimit = 4; // ESPN rate limit
  }

  getName(): string {
    return 'ESPN NCAA';
  }

  async fetchGameStats(gameId: string): Promise<PlayerStatMap> {
    return this.retryWithBackoff(async () => {
      try {
        // Determine sport from gameId format
        const sport = this.determineSport(gameId);
        const espnGameId = await this.resolveGameId(gameId, sport);
        
        const endpoint = sport === 'football' 
          ? '/football/college-football'
          : '/basketball/mens-college-basketball';
        
        const response = await axios.get(
          `${this.baseUrl}${endpoint}/summary`,
          {
            params: { event: espnGameId },
            timeout: 10000,
            headers: {
              'User-Agent': 'UnitTalk/1.0 Settlement System'
            }
          }
        );

        return sport === 'football' 
          ? this.parseFootballBoxScore(response.data)
          : this.parseBasketballBoxScore(response.data);
      } catch (error) {
        this.logger.error('Failed to fetch NCAA game stats', { gameId, error });
        throw error;
      }
    });
  }

  private determineSport(gameId: string): 'football' | 'basketball' {
    // Could be passed in metadata or inferred from game format/teams
    // Default to football for NCAAF
    return gameId.toLowerCase().includes('ncaab') ? 'basketball' : 'football';
  }

  private async resolveGameId(gameId: string, sport: string): Promise<string> {
    if (/^\d+$/.test(gameId)) {
      return gameId;
    }

    const parts = gameId.split('_');
    if (parts.length >= 5) {
      const [year, month, day] = parts;
      const date = `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`;
      
      const endpoint = sport === 'football'
        ? '/football/college-football'
        : '/basketball/mens-college-basketball';
      
      const response = await axios.get(
        `${this.baseUrl}${endpoint}/scoreboard`,
        {
          params: { dates: date, groups: sport === 'football' ? '80' : '50' }
        }
      );

      for (const event of response.data.events || []) {
        if (this.matchesGame(event, gameId)) {
          return event.id;
        }
      }
    }

    throw new Error(`Could not resolve NCAA game ID for: ${gameId}`);
  }

  private matchesGame(event: any, gameId: string): boolean {
    const competitors = event.competitions?.[0]?.competitors || [];
    const gameIdLower = gameId.toLowerCase();
    
    // Check if team abbreviations or names are in gameId
    return competitors.some((c: any) => {
      const abbr = c.team?.abbreviation?.toLowerCase();
      const name = c.team?.displayName?.toLowerCase().replace(/\s+/g, '');
      return gameIdLower.includes(abbr) || gameIdLower.includes(name);
    });
  }

  private parseFootballBoxScore(gameData: any): PlayerStatMap {
    const stats: PlayerStatMap = {};
    const boxscore = gameData.boxscore;

    if (!boxscore?.players) {
      return stats;
    }

    for (const teamPlayers of boxscore.players) {
      for (const category of teamPlayers.statistics || []) {
        const statMapping = this.getFootballStatMapping(category.name);
        if (!statMapping) continue;

        for (const athleteData of category.athletes || []) {
          const playerId = athleteData.athlete.id;
          const playerName = athleteData.athlete.displayName;
          const normalizedName = this.normalizePlayerName(playerName);

          if (!stats[playerId]) stats[playerId] = {};
          if (!stats[playerName]) stats[playerName] = {};
          if (!stats[normalizedName]) stats[normalizedName] = {};

          const parsedStats = this.parseFootballStatCategory(
            category.name,
            athleteData.stats
          );

          Object.assign(stats[playerId], parsedStats);
          Object.assign(stats[playerName], parsedStats);
          Object.assign(stats[normalizedName], parsedStats);
        }
      }
    }

    return stats;
  }

  private parseBasketballBoxScore(gameData: any): PlayerStatMap {
    const stats: PlayerStatMap = {};
    const boxscore = gameData.boxscore;

    if (!boxscore?.players) {
      return stats;
    }

    for (const teamPlayers of boxscore.players) {
      for (const category of teamPlayers.statistics || []) {
        if (category.name !== 'starters' && category.name !== 'bench') continue;

        for (const athleteData of category.athletes || []) {
          const playerId = athleteData.athlete.id;
          const playerName = athleteData.athlete.displayName;
          const normalizedName = this.normalizePlayerName(playerName);

          // Similar to NBA parsing
          const statValues = athleteData.stats.map((s: string) => parseFloat(s) || 0);

          const playerStats = {
            MIN: statValues[0],
            FGM: this.parseMadeAttempted(athleteData.stats[1])[0],
            FGA: this.parseMadeAttempted(athleteData.stats[1])[1],
            '3PM': this.parseMadeAttempted(athleteData.stats[2])[0],
            '3PA': this.parseMadeAttempted(athleteData.stats[2])[1],
            FTM: this.parseMadeAttempted(athleteData.stats[3])[0],
            FTA: this.parseMadeAttempted(athleteData.stats[3])[1],
            OREB: statValues[4],
            DREB: statValues[5],
            REB: statValues[6],
            AST: statValues[7],
            STL: statValues[8],
            BLK: statValues[9],
            TO: statValues[10],
            PF: statValues[11],
            PTS: statValues[12],
            // Calculated stats
            'PTS+REB': statValues[12] + statValues[6],
            'PTS+AST': statValues[12] + statValues[7],
            'REB+AST': statValues[6] + statValues[7],
            'PTS+REB+AST': statValues[12] + statValues[6] + statValues[7]
          };

          stats[playerId] = playerStats;
          stats[playerName] = playerStats;
          stats[normalizedName] = playerStats;
        }
      }
    }

    return stats;
  }

  private getFootballStatMapping(category: string): boolean {
    const validCategories = [
      'passing', 'rushing', 'receiving', 'fumbles',
      'defensive', 'interceptions', 'kickReturns',
      'puntReturns', 'kicking', 'punting'
    ];
    return validCategories.includes(category);
  }

  private parseFootballStatCategory(
    category: string,
    statValues: string[]
  ): Record<string, number> {
    const result: Record<string, number> = {};

    // Similar to NFL parsing logic
    switch (category) {
      case 'passing':
        const [comp, att] = (statValues[0] || '0/0').split('/').map(Number);
        result.PASS_COMP = comp || 0;
        result.PASS_ATT = att || 0;
        result.PASS_YDS = parseFloat(statValues[1]) || 0;
        result.PASS_TD = parseFloat(statValues[2]) || 0;
        result.PASS_INT = parseFloat(statValues[3]) || 0;
        break;

      case 'rushing':
        result.RUSH_ATT = parseFloat(statValues[0]) || 0;
        result.RUSH_YDS = parseFloat(statValues[1]) || 0;
        result.RUSH_TD = parseFloat(statValues[3]) || 0;
        break;

      case 'receiving':
        result.REC = parseFloat(statValues[0]) || 0;
        result.REC_YDS = parseFloat(statValues[2]) || 0;
        result.REC_TD = parseFloat(statValues[4]) || 0;
        break;
    }

    // Calculate totals
    if (result.PASS_YDS !== undefined || result.RUSH_YDS !== undefined) {
      result.TOTAL_YDS = (result.PASS_YDS || 0) + (result.RUSH_YDS || 0) + (result.REC_YDS || 0);
    }
    
    if (result.PASS_TD !== undefined || result.RUSH_TD !== undefined) {
      result.TOTAL_TD = (result.PASS_TD || 0) + (result.RUSH_TD || 0) + (result.REC_TD || 0);
    }

    return result;
  }

  private parseMadeAttempted(stat: string): [number, number] {
    const [made, attempted] = stat.split('-').map(Number);
    return [made || 0, attempted || 0];
  }
}