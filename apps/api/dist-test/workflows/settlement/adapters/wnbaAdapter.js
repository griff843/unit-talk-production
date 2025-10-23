"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WNBAAdapter = void 0;
const types_1 = require("./types");
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../../../utils/logger");
class WNBAAdapter extends types_1.BaseAdapter {
    constructor() {
        super();
        this.baseUrl = 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba';
        this.logger = (0, logger_1.createLogger)('WNBAAdapter');
        this.rateLimit = 4; // ESPN rate limit
    }
    getName() {
        return 'ESPN WNBA';
    }
    async fetchGameStats(gameId) {
        return this.retryWithBackoff(async () => {
            try {
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
                this.logger.error('Failed to fetch WNBA game stats', { gameId, error });
                throw error;
            }
        });
    }
    async resolveGameId(gameId) {
        if (/^\d+$/.test(gameId)) {
            return gameId;
        }
        const parts = gameId.split('_');
        if (parts.length >= 5) {
            const [year, month, day] = parts;
            const date = `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`;
            const response = await axios_1.default.get(`${this.baseUrl}/scoreboard`, {
                params: { dates: date }
            });
            for (const event of response.data.events || []) {
                if (this.matchesGame(event, gameId)) {
                    return event.id;
                }
            }
        }
        throw new Error(`Could not resolve WNBA game ID for: ${gameId}`);
    }
    matchesGame(event, gameId) {
        const competitors = event.competitions?.[0]?.competitors || [];
        const gameIdLower = gameId.toLowerCase();
        return competitors.every((c) => {
            const abbr = c.team?.abbreviation?.toLowerCase();
            const name = c.team?.displayName?.toLowerCase().replace(/\s+/g, '');
            return gameIdLower.includes(abbr) || gameIdLower.includes(name);
        });
    }
    parseBoxScore(gameData) {
        const stats = {};
        const boxscore = gameData.boxscore;
        if (!boxscore?.players) {
            return stats;
        }
        for (const teamPlayers of boxscore.players) {
            for (const category of teamPlayers.statistics || []) {
                // WNBA uses same format as NBA
                if (category.name !== 'starters' && category.name !== 'bench')
                    continue;
                for (const athleteData of category.athletes || []) {
                    const playerId = athleteData.athlete.id;
                    const playerName = athleteData.athlete.displayName;
                    const normalizedName = this.normalizePlayerName(playerName);
                    // ESPN WNBA stat order matches NBA
                    const statValues = athleteData.stats.map((s) => parseFloat(s) || 0);
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
                        'PTS+REB+AST': statValues[12] + statValues[6] + statValues[7],
                        'STL+BLK': statValues[8] + statValues[9],
                        'DOUBLE_DOUBLE': this.checkDoubleDouble(statValues) ? 1 : 0,
                        'TRIPLE_DOUBLE': this.checkTripleDouble(statValues) ? 1 : 0
                    };
                    stats[playerId] = playerStats;
                    stats[playerName] = playerStats;
                    stats[normalizedName] = playerStats;
                }
            }
        }
        return stats;
    }
    parseMadeAttempted(stat) {
        const [made, attempted] = stat.split('-').map(Number);
        return [made || 0, attempted || 0];
    }
    checkDoubleDouble(stats) {
        // Check PTS, REB, AST, STL, BLK (indices 12, 6, 7, 8, 9)
        const categories = [stats[12], stats[6], stats[7], stats[8], stats[9]];
        return categories.filter(cat => cat >= 10).length >= 2;
    }
    checkTripleDouble(stats) {
        const categories = [stats[12], stats[6], stats[7], stats[8], stats[9]];
        return categories.filter(cat => cat >= 10).length >= 3;
    }
}
exports.WNBAAdapter = WNBAAdapter;
