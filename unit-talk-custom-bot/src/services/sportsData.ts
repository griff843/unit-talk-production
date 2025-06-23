import { PlayerSearchResult, GameSearchResult, SportConfig } from '../types';

/**
 * Sports Data Service - Provides real-time sports data and search functionality
 */
export class SportsDataService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.SPORTS_API_KEY || '';
    this.baseUrl = 'https://api.sportsdata.io/v3';
  }

  /**
   * Search for players by name and sport
   */
  async searchPlayers(query: string, sport: string, limit: number = 10): Promise<PlayerSearchResult[]> {
    try {
      // Mock implementation - replace with actual API call
      const mockPlayers: PlayerSearchResult[] = [
        {
          id: '1',
          name: 'Patrick Mahomes',
          team: 'Kansas City Chiefs',
          position: 'QB',
          sport: 'NFL',
          league: 'NFL'
        },
        {
          id: '2',
          name: 'Josh Allen',
          team: 'Buffalo Bills',
          position: 'QB',
          sport: 'NFL',
          league: 'NFL'
        },
        {
          id: '3',
          name: 'Lamar Jackson',
          team: 'Baltimore Ravens',
          position: 'QB',
          sport: 'NFL',
          league: 'NFL'
        }
      ].filter(player =>
        player.name.toLowerCase().includes(query.toLowerCase()) &&
        player.sport.toLowerCase() === sport.toLowerCase()
      ).slice(0, limit);

      return mockPlayers;
    } catch (error) {
      console.error('Error searching players:', error);
      return [];
    }
  }

  /**
   * Search for games by teams, date, or sport
   */
  async searchGames(query: string, sport: string, limit: number = 10): Promise<GameSearchResult[]> {
    try {
      // Mock implementation - replace with actual API call
      const mockGames: GameSearchResult[] = [
        {
          id: '1',
          homeTeam: 'Kansas City Chiefs',
          awayTeam: 'Buffalo Bills',
          date: '2024-01-15T20:00:00Z',
          time: '20:00:00',
          status: 'SCHEDULED' as const,
          sport: 'NFL',
          league: 'NFL',
          home_team: 'Kansas City Chiefs', // Database compatibility
          away_team: 'Buffalo Bills' // Database compatibility
        },
        {
          id: '2',
          homeTeam: 'Los Angeles Lakers',
          awayTeam: 'Boston Celtics',
          date: '2024-01-15T22:00:00Z',
          time: '22:00:00',
          status: 'SCHEDULED' as const,
          sport: 'NBA',
          league: 'NBA',
          home_team: 'Los Angeles Lakers', // Database compatibility
          away_team: 'Boston Celtics' // Database compatibility
        }
      ].filter(game =>
        (game.home_team.toLowerCase().includes(query.toLowerCase()) ||
         game.away_team.toLowerCase().includes(query.toLowerCase())) &&
        game.sport.toLowerCase() === sport.toLowerCase()
      ).slice(0, limit);

      return mockGames;
    } catch (error) {
      console.error('Error searching games:', error);
      return [];
    }
  }

  /**
   * Get current odds for a specific game or market
   */
  async getOdds(gameId: string, market: string): Promise<any> {
    try {
      // Mock implementation - replace with actual API call
      return {
        gameId,
        market,
        odds: {
          home: -110,
          away: -110,
          over: -105,
          under: -115
        },
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching odds:', error);
      return null;
    }
  }

  /**
   * Get sport configuration and available markets
   */
  getSportConfig(sport: string): SportConfig | null {
    const configs: Record<string, SportConfig> = {
      'NFL': {
        name: 'NFL',
        displayName: 'National Football League',
        betTypes: [
          { id: 'spread', name: 'Point Spread', displayName: 'Point Spread', description: 'Betting on the margin of victory', category: 'spread', requiresLine: true },
          { id: 'total', name: 'Total Points', displayName: 'Total Points', description: 'Over/Under total points scored', category: 'total', requiresLine: true },
          { id: 'moneyline', name: 'Moneyline', displayName: 'Moneyline', description: 'Straight up winner', category: 'moneyline' },
          { id: 'player_props', name: 'Player Props', displayName: 'Player Props', description: 'Individual player performance bets', category: 'prop', requiresPlayer: true }
        ],
        positions: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'],
        leagues: ['NFL'],
        season: { start: '2024-09-01', end: '2025-02-15' }
      },
      'NBA': {
        name: 'NBA',
        displayName: 'National Basketball Association',
        betTypes: [
          { id: 'spread', name: 'Point Spread', displayName: 'Point Spread', description: 'Betting on the margin of victory', category: 'spread', requiresLine: true },
          { id: 'total', name: 'Total Points', displayName: 'Total Points', description: 'Over/Under total points scored', category: 'total', requiresLine: true },
          { id: 'moneyline', name: 'Moneyline', displayName: 'Moneyline', description: 'Straight up winner', category: 'moneyline' },
          { id: 'player_props', name: 'Player Props', displayName: 'Player Props', description: 'Individual player performance bets', category: 'prop', requiresPlayer: true }
        ],
        positions: ['PG', 'SG', 'SF', 'PF', 'C'],
        leagues: ['NBA'],
        season: { start: '2024-10-01', end: '2025-06-30' }
      },
      'MLB': {
        name: 'MLB',
        displayName: 'Major League Baseball',
        betTypes: [
          { id: 'runline', name: 'Run Line', displayName: 'Run Line', description: 'Baseball point spread (usually 1.5)', category: 'spread', requiresLine: true },
          { id: 'total', name: 'Total Runs', displayName: 'Total Runs', description: 'Over/Under total runs scored', category: 'total', requiresLine: true },
          { id: 'moneyline', name: 'Moneyline', displayName: 'Moneyline', description: 'Straight up winner', category: 'moneyline' },
          { id: 'player_props', name: 'Player Props', displayName: 'Player Props', description: 'Individual player performance bets', category: 'prop', requiresPlayer: true }
        ],
        positions: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'],
        leagues: ['MLB'],
        season: { start: '2024-03-01', end: '2024-11-30' }
      }
    };

    return configs[sport.toUpperCase()] || null;
  }

  /**
   * Get live scores and game status
   */
  async getLiveScores(sport: string): Promise<any[]> {
    try {
      // Mock implementation - replace with actual API call
      return [
        {
          gameId: '1',
          homeTeam: 'Kansas City Chiefs',
          awayTeam: 'Buffalo Bills',
          homeScore: 21,
          awayScore: 14,
          quarter: 3,
          timeRemaining: '8:45',
          status: 'live'
        }
      ];
    } catch (error) {
      console.error('Error fetching live scores:', error);
      return [];
    }
  }

  /**
   * Get team statistics and trends
   */
  async getTeamStats(teamId: string, sport: string): Promise<any> {
    try {
      // Mock implementation - replace with actual API call
      return {
        teamId,
        sport,
        record: { wins: 12, losses: 4 },
        stats: {
          pointsPerGame: 28.5,
          pointsAllowed: 18.2,
          turnoverDifferential: 8
        },
        trends: {
          ats: { wins: 10, losses: 6 },
          totals: { overs: 8, unders: 8 }
        }
      };
    } catch (error) {
      console.error('Error fetching team stats:', error);
      return null;
    }
  }

  /**
   * Get player statistics and trends
   */
  async getPlayerStats(playerId: string, sport: string): Promise<any> {
    try {
      // Mock implementation - replace with actual API call
      return {
        playerId,
        sport,
        season: '2024',
        stats: {
          passingYards: 4200,
          touchdowns: 35,
          interceptions: 8,
          completionPercentage: 68.5
        },
        trends: {
          last5Games: {
            passingYards: 285,
            touchdowns: 2.4,
            interceptions: 0.4
          }
        }
      };
    } catch (error) {
      console.error('Error fetching player stats:', error);
      return null;
    }
  }

  /**
   * Get injury reports and player status
   */
  async getInjuryReport(sport: string, teamId?: string): Promise<any[]> {
    try {
      // Mock implementation - replace with actual API call
      return [
        {
          playerId: '123',
          playerName: 'Travis Kelce',
          team: 'Kansas City Chiefs',
          position: 'TE',
          injury: 'Ankle',
          status: 'Questionable',
          lastUpdated: new Date().toISOString()
        }
      ];
    } catch (error) {
      console.error('Error fetching injury report:', error);
      return [];
    }
  }

  /**
   * Get weather conditions for outdoor games
   */
  async getWeatherConditions(gameId: string): Promise<any> {
    try {
      // Mock implementation - replace with actual API call
      return {
        gameId,
        temperature: 45,
        windSpeed: 12,
        windDirection: 'NW',
        precipitation: 0,
        conditions: 'Partly Cloudy',
        dome: false
      };
    } catch (error) {
      console.error('Error fetching weather conditions:', error);
      return null;
    }
  }
}