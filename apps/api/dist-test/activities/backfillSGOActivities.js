"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backfillSGOActivities = exports.storeBatch = exports.validateSGOResponse = exports.checkDuplicates = exports.updateProgress = exports.queueSettlement = exports.insertProps = exports.insertGames = exports.fetchSGOProps = exports.fetchSGOGames = exports.BackfillSGOActivities = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const supabaseClient_1 = require("../services/supabaseClient");
const logger = (0, logger_1.createLogger)('BackfillSGOActivities');
// Sport configuration mapping
const SPORT_CONFIG = {
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
class BackfillSGOActivities {
    constructor() {
        this.baseUrl = 'https://api.sportsgameodds.com/v2';
        this.userAgent = 'UnitTalk/1.0 SGO Backfill System';
    }
    /**
     * Fetch games from SGO API for specified sport and date
     */
    async fetchSGOGames(params) {
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
            const response = await axios_1.default.get(`${this.baseUrl}/games`, {
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
        }
        catch (error) {
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
    async fetchSGOProps(params) {
        const { gameId, sport, apiKey } = params;
        const sportConfig = SPORT_CONFIG[sport];
        if (!sportConfig) {
            throw new Error(`Sport ${sport} is not supported`);
        }
        try {
            logger.debug(`Fetching SGO props for game ${gameId}`);
            const response = await axios_1.default.get(`${this.baseUrl}/games/${gameId}/props`, {
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
        }
        catch (error) {
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
    async insertGames(params) {
        const { games, source } = params;
        if (games.length === 0)
            return;
        try {
            const insertData = games.map(game => ({
                id: game.id,
                external_game_id: game.external_game_id,
                sport: game.sport,
                home_team: game.home_team,
                away_team: game.away_team,
                game_date: game.game_date,
                game_time: game.game_time,
                status: game.status,
                venue: game.venue,
                season: game.season,
                week: game.week,
                source: source,
                metadata: {
                    ...game.metadata,
                    backfill_source: source,
                    ingested_at: new Date().toISOString()
                },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }));
            const { error } = await supabaseClient_1.supabaseClient
                .from('games')
                .insert(insertData);
            if (error) {
                throw error;
            }
            logger.info(`Inserted ${games.length} games with source '${source}'`);
        }
        catch (error) {
            logger.error('Failed to insert games', { count: games.length, source, error });
            throw error;
        }
    }
    /**
     * Insert props into database with source tagging and game linking
     */
    async insertProps(params) {
        const { props, gameId, source } = params;
        if (props.length === 0)
            return;
        try {
            const insertData = props.map(prop => ({
                id: prop.id,
                external_prop_id: prop.external_prop_id,
                external_game_id: prop.external_game_id,
                game_id: gameId,
                sport: prop.sport,
                player_name: prop.player_name,
                stat_type: prop.stat_type,
                line: prop.line,
                over_odds: prop.over_odds,
                under_odds: prop.under_odds,
                market_type: prop.market_type,
                status: prop.status,
                source: source,
                metadata: {
                    ...prop.metadata,
                    backfill_source: source,
                    ingested_at: new Date().toISOString()
                },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }));
            const { error } = await supabaseClient_1.supabaseClient
                .from('raw_props')
                .insert(insertData);
            if (error) {
                throw error;
            }
            logger.info(`Inserted ${props.length} props for game ${gameId} with source '${source}'`);
        }
        catch (error) {
            logger.error('Failed to insert props', { count: props.length, gameId, source, error });
            throw error;
        }
    }
    /**
     * Queue props for settlement processing
     */
    async queueSettlement(params) {
        const { propIds, gameId, priority, source } = params;
        if (propIds.length === 0)
            return;
        try {
            const jobData = {
                job_id: `backfill-${source}-${gameId}-${Date.now()}`,
                job_type: 'backfill',
                status: 'running',
                options: {
                    prop_ids: propIds,
                    game_id: gameId,
                    priority,
                    source,
                    batch_size: propIds.length,
                    created_by: 'backfill-sgo-workflow'
                },
                progress: {
                    scanned: 0,
                    settled: 0,
                    skipped: 0,
                    errors: 0,
                    failed: []
                },
                created_by: 'backfill-sgo-workflow'
            };
            const { error } = await supabaseClient_1.supabaseClient
                .from('settlement_jobs')
                .insert(jobData);
            if (error) {
                throw error;
            }
            logger.info(`Queued settlement for ${propIds.length} props from game ${gameId}`);
        }
        catch (error) {
            logger.error('Failed to queue settlement', { propCount: propIds.length, gameId, error });
            throw error;
        }
    }
    /**
     * Check for duplicate games/props to maintain idempotency
     */
    async checkDuplicates(ids, table) {
        if (ids.length === 0) {
            return { existing: [], new: ids };
        }
        try {
            const column = table === 'games' ? 'external_game_id' : 'external_prop_id';
            const { data, error } = await supabaseClient_1.supabaseClient
                .from(table)
                .select(column)
                .in(column, ids);
            if (error) {
                throw error;
            }
            const existing = data?.map((row) => row[column]) || [];
            const newIds = ids.filter(id => !existing.includes(id));
            logger.debug(`Duplicate check for ${table}: ${existing.length} existing, ${newIds.length} new`);
            return { existing, new: newIds };
        }
        catch (error) {
            logger.error(`Failed to check duplicates for ${table}`, { count: ids.length, error });
            throw error;
        }
    }
    /**
     * Update backfill progress in database for monitoring
     */
    async updateProgress(progress) {
        try {
            const progressData = {
                workflow_id: progress.workflowId,
                status: progress.status,
                progress_data: {
                    ...progress,
                    updatedAt: new Date().toISOString()
                },
                updated_at: new Date().toISOString()
            };
            // Upsert progress record
            const { error } = await supabaseClient_1.supabaseClient
                .from('workflow_progress')
                .upsert(progressData, {
                onConflict: 'workflow_id'
            });
            if (error) {
                logger.warn('Failed to update progress in database', { error });
                // Don't throw - progress updates shouldn't fail workflow
            }
        }
        catch (error) {
            logger.warn('Failed to update progress', { error });
        }
    }
    /**
     * Validate SGO API response structure
     */
    async validateSGOResponse(data, type) {
        try {
            if (type === 'games') {
                return Array.isArray(data.games) &&
                    data.games.every((game) => game.id && game.home_team && game.away_team);
            }
            if (type === 'props') {
                return Array.isArray(data.props) &&
                    data.props.every((prop) => prop.id && prop.player_name && prop.stat_type);
            }
            return false;
        }
        catch (error) {
            logger.error('Failed to validate SGO response', { type, error });
            return false;
        }
    }
    /**
     * Store batch data with error handling
     */
    async storeBatch(params) {
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
                        if (!acc[gameId])
                            acc[gameId] = [];
                        acc[gameId].push(prop);
                    }
                    return acc;
                }, {});
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
        }
        catch (error) {
            logger.error('Failed to store batch', { games: games.length, props: props.length, error });
            throw error;
        }
    }
    /**
     * Transform SGO games response to internal format
     */
    transformSGOGamesToInternal(sgoGames, sport) {
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
    transformSGOPropsToInternal(sgoProps, gameId, sport) {
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
    mapSGOGameStatus(sgoStatus) {
        const statusMap = {
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
    mapSGOStatType(market, description) {
        const marketMap = {
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
    convertOddsToAmerican(decimalOdds) {
        if (!decimalOdds || decimalOdds <= 1)
            return -110; // Default
        if (decimalOdds >= 2) {
            return Math.round((decimalOdds - 1) * 100);
        }
        else {
            return Math.round(-100 / (decimalOdds - 1));
        }
    }
    /**
     * Generate UUID for internal IDs
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}
exports.BackfillSGOActivities = BackfillSGOActivities;
// Export activity implementations
const backfillSGOActivitiesInstance = new BackfillSGOActivities();
// Export individual activity functions for Temporal worker registration
exports.fetchSGOGames = backfillSGOActivitiesInstance.fetchSGOGames.bind(backfillSGOActivitiesInstance);
exports.fetchSGOProps = backfillSGOActivitiesInstance.fetchSGOProps.bind(backfillSGOActivitiesInstance);
exports.insertGames = backfillSGOActivitiesInstance.insertGames.bind(backfillSGOActivitiesInstance);
exports.insertProps = backfillSGOActivitiesInstance.insertProps.bind(backfillSGOActivitiesInstance);
exports.queueSettlement = backfillSGOActivitiesInstance.queueSettlement.bind(backfillSGOActivitiesInstance);
exports.updateProgress = backfillSGOActivitiesInstance.updateProgress.bind(backfillSGOActivitiesInstance);
exports.checkDuplicates = backfillSGOActivitiesInstance.checkDuplicates.bind(backfillSGOActivitiesInstance);
exports.validateSGOResponse = backfillSGOActivitiesInstance.validateSGOResponse.bind(backfillSGOActivitiesInstance);
exports.storeBatch = backfillSGOActivitiesInstance.storeBatch.bind(backfillSGOActivitiesInstance);
// Keep the instance export for backward compatibility
exports.backfillSGOActivities = backfillSGOActivitiesInstance;
