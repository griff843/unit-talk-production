"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NFLAdapter = void 0;
const types_1 = require("./types");
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../../../utils/logger");
class NFLAdapter extends types_1.BaseAdapter {
    constructor() {
        super();
        this.baseUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
        this.logger = (0, logger_1.createLogger)('NFLAdapter');
        this.rateLimit = 4; // ESPN rate limit
    }
    getName() {
        return 'ESPN NFL';
    }
    async fetchGameStats(gameId) {
        return this.retryWithBackoff(async () => {
            try {
                // ESPN game IDs are typically numeric like "401547428"
                const espnGameId = await this.resolveGameId(gameId);
                const response = await axios_1.default.get(`${this.baseUrl}/summary`, {
                    params: { event: espnGameId },
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'UnitTalk/1.0 Settlement System'
                    }
                });
                return this.parseBoxScore(response.data);
            }
            catch (error) {
                this.logger.error('Failed to fetch NFL game stats', { gameId, error });
                throw error;
            }
        });
    }
    async resolveGameId(gameId) {
        // If already numeric ESPN ID, return as is
        if (/^\d+$/.test(gameId)) {
            return gameId;
        }
        // Parse from format like "2024_09_15_buf_mia"
        const parts = gameId.split('_');
        if (parts.length >= 5) {
            const [year, month, day, awayTeam, homeTeam] = parts;
            const date = `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`;
            // Query ESPN scoreboard for that date
            const response = await axios_1.default.get(`${this.baseUrl}/scoreboard`, {
                params: { dates: date }
            });
            // Find matching game
            for (const event of response.data.events || []) {
                if (this.matchesGame(event, awayTeam, homeTeam)) {
                    return event.id;
                }
            }
        }
        throw new Error(`Could not resolve ESPN game ID for: ${gameId}`);
    }
    matchesGame(event, awayCode, homeCode) {
        const competitors = event.competitions?.[0]?.competitors || [];
        const away = competitors.find((c) => c.homeAway === 'away');
        const home = competitors.find((c) => c.homeAway === 'home');
        return away?.team?.abbreviation?.toLowerCase() === awayCode.toLowerCase() &&
            home?.team?.abbreviation?.toLowerCase() === homeCode.toLowerCase();
    }
    parseBoxScore(gameData) {
        const stats = {};
        const boxscore = gameData.boxscore;
        if (!boxscore?.players) {
            return stats;
        }
        for (const teamPlayers of boxscore.players) {
            for (const category of teamPlayers.statistics || []) {
                const statMapping = this.getStatMapping(category.name);
                if (!statMapping)
                    continue;
                for (const athleteData of category.athletes || []) {
                    const playerId = athleteData.athlete.id;
                    const playerName = athleteData.athlete.displayName;
                    const normalizedName = this.normalizePlayerName(playerName);
                    // Initialize player if not exists
                    if (!stats[playerId])
                        stats[playerId] = {};
                    if (!stats[playerName])
                        stats[playerName] = {};
                    if (!stats[normalizedName])
                        stats[normalizedName] = {};
                    // Parse stats based on category
                    const parsedStats = this.parseStatCategory(category.name, athleteData.stats, statMapping);
                    // Merge stats
                    Object.assign(stats[playerId], parsedStats);
                    Object.assign(stats[playerName], parsedStats);
                    Object.assign(stats[normalizedName], parsedStats);
                }
            }
        }
        return stats;
    }
    getStatMapping(category) {
        const mappings = {
            passing: ['C/ATT', 'YDS', 'TD', 'INT', 'SACKS', 'QBR', 'RTG'],
            rushing: ['CAR', 'YDS', 'AVG', 'TD', 'LONG'],
            receiving: ['REC', 'TARGETS', 'YDS', 'AVG', 'TD', 'LONG'],
            fumbles: ['FUM', 'LOST', 'REC'],
            defensive: ['TOT', 'SOLO', 'SACKS', 'TFL', 'PD', 'QB HTS', 'TD'],
            interceptions: ['INT', 'YDS', 'TD'],
            kickReturns: ['NO', 'YDS', 'AVG', 'LONG', 'TD'],
            puntReturns: ['NO', 'YDS', 'AVG', 'LONG', 'TD'],
            kicking: ['FG', 'PCT', 'LONG', 'XP', 'PTS'],
            punting: ['NO', 'YDS', 'AVG', 'TB', 'In 20', 'LONG']
        };
        return mappings[category] || null;
    }
    parseStatCategory(category, statValues, mapping) {
        const result = {};
        switch (category) {
            case 'passing':
                // Parse completions/attempts
                const [comp, att] = (statValues[0] || '0/0').split('/').map(Number);
                result.PASS_COMP = comp || 0;
                result.PASS_ATT = att || 0;
                result.PASS_YDS = parseFloat(statValues[1]) || 0;
                result.PASS_TD = parseFloat(statValues[2]) || 0;
                result.PASS_INT = parseFloat(statValues[3]) || 0;
                result.SACKS_TAKEN = parseFloat(statValues[4]) || 0;
                break;
            case 'rushing':
                result.RUSH_ATT = parseFloat(statValues[0]) || 0;
                result.RUSH_YDS = parseFloat(statValues[1]) || 0;
                result.RUSH_TD = parseFloat(statValues[3]) || 0;
                break;
            case 'receiving':
                result.REC = parseFloat(statValues[0]) || 0;
                result.TARGETS = parseFloat(statValues[1]) || 0;
                result.REC_YDS = parseFloat(statValues[2]) || 0;
                result.REC_TD = parseFloat(statValues[4]) || 0;
                break;
            case 'defensive':
                result.TACKLES = parseFloat(statValues[0]) || 0;
                result.SOLO_TACKLES = parseFloat(statValues[1]) || 0;
                result.SACKS = parseFloat(statValues[2]) || 0;
                result.TFL = parseFloat(statValues[3]) || 0;
                result.PD = parseFloat(statValues[4]) || 0;
                result.QB_HITS = parseFloat(statValues[5]) || 0;
                break;
            case 'interceptions':
                result.DEF_INT = parseFloat(statValues[0]) || 0;
                result.INT_YDS = parseFloat(statValues[1]) || 0;
                result.INT_TD = parseFloat(statValues[2]) || 0;
                break;
            case 'kicking':
                // Parse field goals made/attempted
                const [fgMade, fgAtt] = (statValues[0] || '0/0').split('/').map(Number);
                result.FG_MADE = fgMade || 0;
                result.FG_ATT = fgAtt || 0;
                // Parse extra points
                const [xpMade, xpAtt] = (statValues[3] || '0/0').split('/').map(Number);
                result.XP_MADE = xpMade || 0;
                result.XP_ATT = xpAtt || 0;
                result.KICK_PTS = parseFloat(statValues[4]) || 0;
                break;
        }
        // Calculate combined stats
        if (result.PASS_YDS !== undefined || result.RUSH_YDS !== undefined) {
            result.TOTAL_YDS = (result.PASS_YDS || 0) + (result.RUSH_YDS || 0) + (result.REC_YDS || 0);
        }
        if (result.PASS_TD !== undefined || result.RUSH_TD !== undefined) {
            result.TOTAL_TD = (result.PASS_TD || 0) + (result.RUSH_TD || 0) + (result.REC_TD || 0);
        }
        return result;
    }
}
exports.NFLAdapter = NFLAdapter;
