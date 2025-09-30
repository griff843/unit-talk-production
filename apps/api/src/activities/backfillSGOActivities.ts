import axios from 'axios';
import { createLogger } from '../utils/logger';
import { requireSupabase } from '../utils/supabaseUtils';

const logger = createLogger('BackfillSGOActivities');

// Types for SGO API responses and internal data structures
export interface SportConfig {
  name: string;
  sgoSportId: string;
  enabled: boolean;
  markets: string[];
}

export interface GameData {
  id: string;
  external_game_id: string;
  sport: string;
  home_team: string;
  away_team: string;
  game_date: string;
  game_time: string;
  status: string;
  venue?: string;
  season?: string;
  week?: number;
  metadata: Record<string, any>;
}

export interface PropData {
  id: string;
  external_prop_id: string;
  external_game_id: string;
  sport: string;
  player_name: string;
  stat_type: string;
  line: number;
  over_odds: number;
  under_odds: number;
  market_type: string;
  status: string;
  source: string;
  created_at: string;
  metadata: Record<string, any>;
}

export interface BackfillSGOOptions {
  sports?: string[];
  days?: number;
  batchSize?: number;
  rateLimit?: number; // requests per minute
  dryRun?: boolean;
  maxDays?: number;
}

export interface BackfillProgress {
  workflowId: string;
  startedAt: Date;
  totalDays: number;
  processedDays: number;
  totalSports: number;
  processedSports: number;
  totalGames: number;
  processedGames: number;
  totalProps: number;
  processedProps: number;
  duplicatesSkipped: number;
  errors: Array<{
    timestamp: Date;
    sport?: string;
    date?: Date;
    gameId?: string;
    error: string;
  }>;
  completedAt: Date | null;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
}

export interface DuplicateCheckResult {
  existing: string[];
  new: string[];
}

// Sport configuration mapping
const SPORT_CONFIG: Record<string, SportConfig> = {
  MLB: {
    name: 'MLB',
    sgoSportId: 'baseball_mlb',
    enabled: true,
    markets: ['player_props', 'game_props', 'team_props']
  },
  NFL: {
    name: 'NFL', 
    sgoSportId: 'americanfootball_nfl',
    enabled: true,
    markets: ['player_props', 'game_props', 'team_props']
  },
  NBA: {
    name: 'NBA',
    sgoSportId: 'basketball_nba',
    enabled: true,
    markets: ['player_props', 'game_props', 'team_props']
  },
  NCAAF: {
    name: 'NCAAF',
    sgoSportId: 'americanfootball_ncaaf',
    enabled: true,
    markets: ['player_props', 'game_props', 'team_props']
  },
  NCAAB: {
    name: 'NCAAB',
    sgoSportId: 'basketball_ncaab',
    enabled: true,
    markets: ['player_props', 'game_props', 'team_props']
  },
  WNBA: {
    name: 'WNBA',
    sgoSportId: 'basketball_wnba',
    enabled: true,
    markets: ['player_props', 'game_props']
  },
  NHL: {
    name: 'NHL',
    sgoSportId: 'icehockey_nhl',
    enabled: true,
    markets: ['player_props', 'game_props', 'team_props']
  }
};

/**
 * Activities for SportsGameOdds backfill workflow
 */
export class BackfillSGOActivities {
  private readonly baseUrl = 'https://api.sportsgameodds.com/v2';
  private readonly userAgent = 'UnitTalk/1.0 SGO Backfill System';

  /**
   * Fetch games from SGO API for specified sport and date
   */
  async fetchSGOGames(params: {
    sport: string;
    date: Date;
    apiKey: string;
  }): Promise<GameData[]> {
    const { sport, date, apiKey } = params;
    
    if (!apiKey) {
      throw new Error('SPORTSGAMEODDS_KEY environment variable is required');
    }

    const sportConfig = SPORT_CONFIG[sport];
    if (!sportConfig || !sportConfig.enabled) {
      throw new Error(`Sport ${sport} is not supported or enabled`);
    }

    try {
      logger.info(`Fetching SGO games for ${sport} on ${date.toISOString().split('T')[0]}`);

      const response = await axios.get(`${this.baseUrl}/games`, {
        headers: {
          'x-api-key': apiKey,
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        },
        params: {
          sport: sportConfig.sgoSportId,
          date: date.toISOString().split('T')[0],
          status: 'completed,live,upcoming' // Include all statuses for comprehensive backfill
        },
        timeout: 30000
      });

      const games = this.transformSGOGamesToInternal(response.data.games || [], sport);
      
      logger.info(`Retrieved ${games.length} games for ${sport}`, { 
        sport, 
        date: date.toISOString().split('T')[0],
        count: games.length 
      });

      return games;

    } catch (error: any) {
      logger.error(`Failed to fetch SGO games for ${sport}`, { 
        sport, 
        date: date.toISOString().split('T')[0],
        error: error.message,
        status: error.response?.status
      });

      if (error.response?.status === 429) {
        throw new Error(`SGO API rate limit exceeded for ${sport}`);
      }
      
      if (error.response?.status === 401) {
        throw new Error('Invalid SGO API key');
      }

      throw new Error(`SGO API error for ${sport}: ${error.message}`);
    }
  }

  /**
   * Fetch props from SGO API for specified game
   */
  async fetchSGOProps(params: {
    gameId: string;
    sport: string;
    apiKey: string;
  }): Promise<PropData[]> {
    const { gameId, sport, apiKey } = params;

    const sportConfig = SPORT_CONFIG[sport];
    if (!sportConfig) {
      throw new Error(`Sport ${sport} is not supported`);
    }

    try {
      logger.debug(`Fetching SGO props for game ${gameId}`);

      const response = await axios.get(`${this.baseUrl}/games/${gameId}/props`, {
        headers: {
          'x-api-key': apiKey,
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        },
        params: {
          markets: sportConfig.markets.join(',')
        },
        timeout: 30000
      });

      const props = this.transformSGOPropsToInternal(response.data.props || [], gameId, sport);
      
      logger.debug(`Retrieved ${props.length} props for game ${gameId}`);
      return props;

    } catch (error: any) {
      logger.error(`Failed to fetch SGO props for game ${gameId}`, { 
        gameId, 
        sport,
        error: error.message 
      });

      // Don't throw on prop fetch failures - game might not have props
      if (error.response?.status === 404) {
        logger.info(`No props found for game ${gameId}`);
        return [];
      }

      throw error;
    }
  }

  /**
   * Insert games into database with source tagging
   */
  async insertGames(params: {
    games: GameData[];
    source: string;
  }): Promise<void> {
    const { games, source } = params;

    if (games.length === 0) return;

    try {

      const insertData = games.map(game => ({
        id: game.id,
        game_id: game.external_game_id, // Map external_game_id to game_id field
        sport: game.sport,
        home_team: game.home_team,
        away_team: game.away_team,
        start_time: game.game_time, // Map game_time to start_time field
        status: game.status,
        provider: source, // Map source to provider field
        external_data: {
          ...game.metadata,
          backfill_source: source,
          ingested_at: new Date().toISOString(),
          venue: game.venue,
          season: game.season,
          week: game.week,
          game_date: game.game_date
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const supabaseClient = requireSupabase();
      const { error } = await supabaseClient
        .from('games')
        .insert(insertData);

      if (error) {
        throw error;
      }

      logger.info(`Inserted ${games.length} games with source '${source}'`);

    } catch (error) {
      logger.error('Failed to insert games', { count: games.length, source, error });
      throw error;
    }
  }

  /**
   * Insert props into database with source tagging and game linking
   */
  async insertProps(params: {
    props: PropData[];
    gameId: string;
    source: string;
  }): Promise<void> {
    const { props, gameId, source } = params;

    if (props.length === 0) return;

    try {

      const insertData = props.map(prop => ({
        prop_id: prop.id,
        external_prop_id: prop.external_prop_id,
        sport: prop.sport,
        player_name: prop.player_name,
        stat_type: prop.stat_type,
        line: prop.line,
        over_odds: prop.over_odds,
        under_odds: prop.under_odds,
        source: source,
        quality_flags: {
          ...prop.metadata,
          backfill_source: source,
          ingested_at: new Date().toISOString(),
          internal_game_id: gameId // Store the internal game ID in metadata
        }
      }));

      const supabaseClient = requireSupabase();
      const { error } = await supabaseClient
        .from('raw_props')
        .insert(insertData);

      if (error) {
        throw error;
      }

      logger.info(`Inserted ${props.length} props for game ${gameId} with source '${source}'`);

    } catch (error) {
      logger.error('Failed to insert props', { count: props.length, gameId, source, error });
      throw error;
    }
  }

  /**
   * Queue props for settlement processing (simplified - logs only)
   */
  async queueSettlement(params: {
    propIds: string[];
    gameId: string;
    priority: string;
    source: string;
  }): Promise<void> {
    const { propIds, gameId, priority, source } = params;

    if (propIds.length === 0) return;

    try {
      // For now, just log the settlement queue request
      // Settlement will be handled by other processes
      logger.info(`Settlement queued for ${propIds.length} props from game ${gameId}`, {
        gameId,
        priority,
        source,
        propCount: propIds.length
      });

    } catch (error) {
      logger.error('Failed to queue settlement', { propCount: propIds.length, gameId, error });
      throw error;
    }
  }

  /**
   * Check for duplicate games/props to maintain idempotency
   */
  async checkDuplicates(ids: string[], table: 'games' | 'raw_props'): Promise<DuplicateCheckResult> {
    if (ids.length === 0) {
      return { existing: [], new: ids };
    }

    try {

      const column = table === 'games' ? 'game_id' : 'external_prop_id';

      const supabaseClient = requireSupabase();
      const { data, error } = await supabaseClient
        .from(table)
        .select(column)
        .in(column, ids);

      if (error) {
        throw error;
      }

      const existing = data?.map((row: any) => row[column]) || [];
      const newIds = ids.filter(id => !existing.includes(id));

      logger.debug(`Duplicate check for ${table}: ${existing.length} existing, ${newIds.length} new`);

      return { existing, new: newIds };

    } catch (error) {
      logger.error(`Failed to check duplicates for ${table}`, { count: ids.length, error });
      throw error;
    }
  }

  /**
   * Update backfill progress (simplified - logs only)
   */
  async updateProgress(progress: BackfillProgress): Promise<void> {
    try {
      // For now, just log the progress update
      // Progress tracking will be handled by other systems
      logger.info('Backfill progress update', {
        workflowId: progress.workflowId,
        status: progress.status,
        processedDays: progress.processedDays,
        totalDays: progress.totalDays,
        processedProps: progress.processedProps,
        totalProps: progress.totalProps,
        duplicatesSkipped: progress.duplicatesSkipped,
        errorCount: progress.errors.length
      });

    } catch (error) {
      logger.warn('Failed to update progress', { error });
    }
  }

  /**
   * Validate SGO API response structure
   */
  async validateSGOResponse(data: any, type: 'games' | 'props'): Promise<boolean> {
    try {
      if (type === 'games') {
        return Array.isArray(data.games) && 
               data.games.every((game: any) => 
                 game.id && game.home_team && game.away_team
               );
      }
      
      if (type === 'props') {
        return Array.isArray(data.props) &&
               data.props.every((prop: any) =>
                 prop.id && prop.player_name && prop.stat_type
               );
      }

      return false;

    } catch (error) {
      logger.error('Failed to validate SGO response', { type, error });
      return false;
    }
  }

  /**
   * Store batch data with error handling
   */
  async storeBatch(params: {
    games: GameData[];
    props: PropData[];
    source: string;
  }): Promise<void> {
    const { games, props, source } = params;

    try {
      // Insert games first
      if (games.length > 0) {
        await this.insertGames({ games, source });
      }

      // Then insert props
      if (props.length > 0) {
        // Group props by game
        const propsByGame = props.reduce((acc, prop) => {
          const gameId = games.find(g => g.external_game_id === prop.external_game_id)?.id;
          if (gameId) {
            if (!acc[gameId]) acc[gameId] = [];
            acc[gameId].push(prop);
          }
          return acc;
        }, {} as Record<string, PropData[]>);

        // Insert props for each game
        for (const [gameId, gameProps] of Object.entries(propsByGame)) {
          await this.insertProps({ props: gameProps, gameId, source });
          
          // Queue settlement
          await this.queueSettlement({
            propIds: gameProps.map(p => p.id),
            gameId,
            priority: 'backfill',
            source
          });
        }
      }

      logger.info(`Stored batch: ${games.length} games, ${props.length} props`);

    } catch (error) {
      logger.error('Failed to store batch', { games: games.length, props: props.length, error });
      throw error;
    }
  }

  /**
   * Transform SGO games response to internal format
   */
  private transformSGOGamesToInternal(sgoGames: any[], sport: string): GameData[] {
    return sgoGames.map(game => ({
      id: this.generateUUID(),
      external_game_id: game.id,
      sport,
      home_team: game.home_team,
      away_team: game.away_team,
      game_date: game.commence_time?.split('T')[0] || new Date().toISOString().split('T')[0],
      game_time: game.commence_time || new Date().toISOString(),
      status: this.mapSGOGameStatus(game.status),
      venue: game.venue,
      season: game.season,
      week: game.week,
      metadata: {
        sgo_data: game,
        original_status: game.status,
        bookmakers: game.bookmakers?.length || 0
      }
    }));
  }

  /**
   * Transform SGO props response to internal format
   */
  private transformSGOPropsToInternal(sgoProps: any[], gameId: string, sport: string): PropData[] {
    return sgoProps.map(prop => ({
      id: this.generateUUID(),
      external_prop_id: prop.id,
      external_game_id: gameId,
      sport,
      player_name: prop.player_name || 'Team',
      stat_type: this.mapSGOStatType(prop.market, prop.description),
      line: parseFloat(prop.point) || 0,
      over_odds: this.convertOddsToAmerican(prop.over_price),
      under_odds: this.convertOddsToAmerican(prop.under_price),
      market_type: prop.market,
      status: 'active',
      source: 'sgo',
      created_at: new Date().toISOString(),
      metadata: {
        sgo_data: prop,
        bookmaker: prop.bookmaker,
        description: prop.description,
        last_update: prop.last_update
      }
    }));
  }

  /**
   * Map SGO game status to internal status
   */
  private mapSGOGameStatus(sgoStatus: string): string {
    const statusMap: Record<string, string> = {
      'upcoming': 'scheduled',
      'live': 'live',
      'completed': 'final',
      'cancelled': 'cancelled',
      'postponed': 'postponed'
    };

    return statusMap[sgoStatus?.toLowerCase()] || 'scheduled';
  }

  /**
   * Map SGO stat types to internal stat types
   */
  private mapSGOStatType(market: string, _description: string): string {
    const marketMap: Record<string, string> = {
      'player_points': 'points',
      'player_rebounds': 'rebounds',
      'player_assists': 'assists',
      'player_passing_yards': 'passing_yards',
      'player_rushing_yards': 'rushing_yards',
      'player_receiving_yards': 'receiving_yards',
      'player_hits': 'hits',
      'player_runs': 'runs',
      'player_rbi': 'rbi',
      'player_strikeouts': 'strikeouts'
    };

    return marketMap[market] || market;
  }

  /**
   * Convert decimal odds to American odds
   */
  private convertOddsToAmerican(decimalOdds: number): number {
    if (!decimalOdds || decimalOdds <= 1) return -110; // Default

    if (decimalOdds >= 2) {
      return Math.round((decimalOdds - 1) * 100);
    } else {
      return Math.round(-100 / (decimalOdds - 1));
    }
  }

  /**
   * Generate UUID for internal IDs
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// Export activity implementations
const backfillSGOActivitiesInstance = new BackfillSGOActivities();

// Export individual activity functions for Temporal worker registration
export const fetchSGOGames = backfillSGOActivitiesInstance.fetchSGOGames.bind(backfillSGOActivitiesInstance);
export const fetchSGOProps = backfillSGOActivitiesInstance.fetchSGOProps.bind(backfillSGOActivitiesInstance);
export const insertGames = backfillSGOActivitiesInstance.insertGames.bind(backfillSGOActivitiesInstance);
export const insertProps = backfillSGOActivitiesInstance.insertProps.bind(backfillSGOActivitiesInstance);
export const queueSettlement = backfillSGOActivitiesInstance.queueSettlement.bind(backfillSGOActivitiesInstance);
export const updateProgress = backfillSGOActivitiesInstance.updateProgress.bind(backfillSGOActivitiesInstance);
export const checkDuplicates = backfillSGOActivitiesInstance.checkDuplicates.bind(backfillSGOActivitiesInstance);
export const validateSGOResponse = backfillSGOActivitiesInstance.validateSGOResponse.bind(backfillSGOActivitiesInstance);
export const storeBatch = backfillSGOActivitiesInstance.storeBatch.bind(backfillSGOActivitiesInstance);

// Keep the instance export for backward compatibility
export const backfillSGOActivities = backfillSGOActivitiesInstance;

// Type-safe activity interfaces
export interface BackfillSGOActivities {
  fetchSGOGames(params: { sport: string; date: Date; apiKey: string }): Promise<GameData[]>;
  fetchSGOProps(params: { gameId: string; sport: string; apiKey: string }): Promise<PropData[]>;
  insertGames(params: { games: GameData[]; source: string }): Promise<void>;
  insertProps(params: { props: PropData[]; gameId: string; source: string }): Promise<void>;
  queueSettlement(params: { propIds: string[]; gameId: string; priority: string; source: string }): Promise<void>;
  updateProgress(progress: BackfillProgress): Promise<void>;
  checkDuplicates(ids: string[], table: 'games' | 'raw_props'): Promise<DuplicateCheckResult>;
  validateSGOResponse(data: any, type: 'games' | 'props'): Promise<boolean>;
  storeBatch(params: { games: GameData[]; props: PropData[]; source: string }): Promise<void>;
}