import { createClient } from '@supabase/supabase-js';

import { logger as baseLogger } from '../shared/logger';

const logger = baseLogger.child({ service: 'ESPN Grading Service' });

interface ESPNGameData {
  id: string;
  date: string;
  status: {
    type: {
      completed: boolean;
    };
  };
  competitions: Array<{
    competitors: Array<{
      team: {
        id: string;
        displayName: string;
        abbreviation: string;
      };
      score: string;
      homeAway: string;
      statistics?: Array<{
        name: string;
        displayValue: string;
      }>;
    }>;
    status: {
      type: {
        completed: boolean;
      };
    };
  }>;
}

interface ESPNPlayerStats {
  athlete: {
    id: string;
    displayName: string;
    position: {
      abbreviation: string;
    };
  };
  stats: string[];
}

interface PropGradingResult {
  prop_id: string;
  game_id: string;
  player_name: string;
  prop_type: string;
  line: number;
  actual_value: number;
  result: 'win' | 'loss' | 'push';
  confidence: number;
  graded_at: string;
  data_source: string;
}

export class ESPNGradingService {
  private supabase: any;
  private readonly BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports';
  private readonly RATE_LIMIT_MS = 1000; // 1 second between requests
  private lastRequestTime = 0;

  constructor() {
    this.supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.RATE_LIMIT_MS) {
      await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_MS - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();
  }

  private async fetchESPNData(url: string): Promise<any> {
    await this.rateLimit();

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      logger.error('ESPN API request failed', { url, error });
      throw error;
    }
  }

  private getSportEndpoint(sport: string): string {
    const sportMappings: Record<string, string> = {
      NFL: 'football/nfl',
      NBA: 'basketball/nba',
      MLB: 'baseball/mlb',
      NHL: 'hockey/nhl',
      NCAAF: 'football/college-football',
      NCAAB: 'basketball/mens-college-basketball',
    };
    return sportMappings[sport.toUpperCase()] || 'football/nfl';
  }

  async getGameResults(sport: string, gameDate: string): Promise<ESPNGameData[]> {
    const sportEndpoint = this.getSportEndpoint(sport);
    const url = `${this.BASE_URL}/${sportEndpoint}/scoreboard?dates=${gameDate}`;

    logger.info('Fetching game results from ESPN', { sport, gameDate, url });

    const data = await this.fetchESPNData(url);
    return data.events || [];
  }

  async getPlayerStats(sport: string, gameId: string): Promise<ESPNPlayerStats[]> {
    const sportEndpoint = this.getSportEndpoint(sport);
    const url = `${this.BASE_URL}/${sportEndpoint}/summary?event=${gameId}`;

    logger.info('Fetching player stats from ESPN', { sport, gameId });

    try {
      const data = await this.fetchESPNData(url);

      // Extract player stats from game summary
      const playerStats: ESPNPlayerStats[] = [];

      if (data.boxscore?.players) {
        for (const team of data.boxscore.players) {
          for (const statCategory of team.statistics || []) {
            for (const athlete of statCategory.athletes || []) {
              playerStats.push({
                athlete: athlete.athlete,
                stats: athlete.stats || [],
              });
            }
          }
        }
      }

      return playerStats;
    } catch (error) {
      logger.warn('Failed to fetch player stats', { sport, gameId, error });
      return [];
    }
  }

  private parsePlayerStat(
    stats: ESPNPlayerStats[],
    playerName: string,
    statType: string
  ): number | null {
    const player = stats.find(
      p =>
        p.athlete.displayName.toLowerCase().includes(playerName.toLowerCase()) ||
        playerName.toLowerCase().includes(p.athlete.displayName.toLowerCase())
    );

    if (!player) return null;

    // Map prop types to ESPN stat indices (varies by sport)
    const statMappings: Record<string, number> = {
      points: 0,
      rebounds: 1,
      assists: 2,
      rushing_yards: 0,
      passing_yards: 1,
      receiving_yards: 2,
      touchdowns: 3,
      hits: 0,
      runs: 1,
      rbis: 2,
      goals: 0,
      saves: 1,
    };

    const statIndex = statMappings[statType.toLowerCase()];
    if (statIndex !== undefined && player.stats[statIndex]) {
      return parseFloat(player.stats[statIndex]) || 0;
    }

    return null;
  }

  private gradeProp(line: number, actualValue: number, propType: string): 'win' | 'loss' | 'push' {
    const diff = actualValue - line;

    // Handle different prop types
    if (propType.toLowerCase().includes('over') || propType.toLowerCase().includes('total')) {
      if (diff > 0) return 'win';
      if (diff < 0) return 'loss';
      return 'push';
    }

    if (propType.toLowerCase().includes('under')) {
      if (diff < 0) return 'win';
      if (diff > 0) return 'loss';
      return 'push';
    }

    // Default to over/under logic
    if (Math.abs(diff) < 0.5) return 'push';
    return diff > 0 ? 'win' : 'loss';
  }

  async gradePropsForGame(gameExternalId: string): Promise<PropGradingResult[]> {
    logger.info('Starting prop grading for game', { gameExternalId });

    try {
      // Get props for this game from database
      const { data: props, error: propsError } = await this.supabase
        .from('raw_props')
        .select('*')
        .eq('external_game_id', gameExternalId)
        .is('outcome', null); // Only ungraded props

      if (propsError) {
        logger.error('Failed to fetch props from database', { gameExternalId, error: propsError });
        return [];
      }

      if (!props || props.length === 0) {
        logger.info('No ungraded props found for game', { gameExternalId });
        return [];
      }

      // Extract game info from external_game_id (format: "MLB-phi-cws-2025072819")
      const [sport, , , dateStr] = gameExternalId.split('-');
      const gameDate = dateStr
        ? `${dateStr.slice(0, 4)}${dateStr.slice(4, 6)}${dateStr.slice(6, 8)}`
        : null;

      if (!gameDate) {
        logger.error('Invalid external game ID format', { gameExternalId });
        return [];
      }

      // Get game results from ESPN
      const games = await this.getGameResults(sport, gameDate);

      // Find matching game (this is simplified - would need better matching logic)
      const game = games.find(g => g.status.type.completed);

      if (!game) {
        logger.info('Game not completed or not found', { gameExternalId, gameDate });
        return [];
      }

      // Get player stats for the game
      const playerStats = await this.getPlayerStats(sport, game.id);

      if (playerStats.length === 0) {
        logger.warn('No player stats available for game', { gameExternalId, espnGameId: game.id });
        return [];
      }

      // Grade each prop
      const gradingResults: PropGradingResult[] = [];

      for (const prop of props) {
        try {
          const actualValue = this.parsePlayerStat(playerStats, prop.player_name, prop.prop_type);

          if (actualValue === null) {
            logger.warn('Could not find player stat', {
              player: prop.player_name,
              propType: prop.prop_type,
              gameId: gameExternalId,
            });
            continue;
          }

          const result = this.gradeProp(prop.line, actualValue, prop.prop_type);
          const confidence = this.calculateConfidence(prop, actualValue);

          const gradingResult: PropGradingResult = {
            prop_id: prop.id,
            game_id: prop.game_id,
            player_name: prop.player_name,
            prop_type: prop.prop_type,
            line: prop.line,
            actual_value: actualValue,
            result,
            confidence,
            graded_at: new Date().toISOString(),
            data_source: 'ESPN',
          };

          gradingResults.push(gradingResult);

          // Update the prop in database
          await this.updatePropResult(prop.id, {
            outcome: result,
            updated_at: new Date().toISOString(),
          });
        } catch (error) {
          logger.error('Failed to grade prop', { propId: prop.id, error });
        }
      }

      logger.info('Completed prop grading for game', {
        gameExternalId,
        totalProps: props.length,
        gradedProps: gradingResults.length,
      });

      return gradingResults;
    } catch (error) {
      logger.error('Failed to grade props for game', { gameExternalId, error });
      return [];
    }
  }

  private calculateConfidence(prop: any, actualValue: number): number {
    // Simple confidence calculation based on how close the result was
    const diff = Math.abs(actualValue - prop.line);
    const percentageDiff = diff / prop.line;

    if (percentageDiff < 0.1) return 0.95; // Very close
    if (percentageDiff < 0.2) return 0.85; // Close
    if (percentageDiff < 0.5) return 0.75; // Moderate
    return 0.65; // Far off
  }

  private async updatePropResult(propId: string, updates: any): Promise<void> {
    const { error } = await this.supabase.from('raw_props').update(updates).eq('id', propId);

    if (error) {
      logger.error('Failed to update prop result', { propId, error });
      throw error;
    }
  }

  async gradeAllHistoricalProps(
    options: {
      batchSize?: number;
      startDate?: string;
      endDate?: string;
      sports?: string[];
    } = {}
  ): Promise<{
    totalProcessed: number;
    totalGraded: number;
    errors: number;
  }> {
    const { batchSize = 10, sports = ['NFL', 'NBA', 'MLB', 'NHL'] } = options;

    logger.info('Starting historical prop grading', options);

    try {
      // Get all unique external_game_ids that need grading
      const { data: gameIds, error } = await this.supabase
        .from('raw_props')
        .select('external_game_id')
        .is('outcome', null)
        .not('external_game_id', 'is', null);

      if (error) {
        logger.error('Failed to fetch game IDs', { error });
        throw error;
      }

      const uniqueGameIds = [...new Set(gameIds.map(g => g.external_game_id))];
      logger.info(`Found ${uniqueGameIds.length} games to process`);

      let totalProcessed = 0;
      let totalGraded = 0;
      let errors = 0;

      // Process games in batches
      for (let i = 0; i < uniqueGameIds.length; i += batchSize) {
        const batch = uniqueGameIds.slice(i, i + batchSize);

        logger.info(
          `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(uniqueGameIds.length / batchSize)}`
        );

        for (const gameId of batch) {
          try {
            const results = await this.gradePropsForGame(String(gameId));
            totalGraded += results.length;
            totalProcessed++;

            // Small delay between games to be respectful to ESPN
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (error) {
            logger.error('Failed to grade game', { gameId, error });
            errors++;
          }
        }

        // Longer delay between batches
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      const summary = { totalProcessed, totalGraded, errors };
      logger.info('Historical prop grading completed', summary);

      return summary;
    } catch (error) {
      logger.error('Historical prop grading failed', { error });
      throw error;
    }
  }
}
