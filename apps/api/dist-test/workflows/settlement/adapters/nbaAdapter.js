"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NBAAdapter = void 0;
const types_1 = require("./types");
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../../../utils/logger");
class NBAAdapter extends types_1.BaseAdapter {
    constructor() {
        super();
        this.baseUrl = 'https://www.balldontlie.io/api/v1';
        this.espnUrl = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
        this.logger = (0, logger_1.createLogger)('NBAAdapter');
        this.rateLimit = 6; // BallDontLie allows 60 requests per minute
    }
    getName() {
        return 'NBA Stats API';
    }
    async fetchGameStats(gameId) {
        return this.retryWithBackoff(async () => {
            try {
                // Try BallDontLie API first, fallback to ESPN
                return await this.fetchFromBallDontLie(gameId);
            }
            catch (error) {
                this.logger.warn('BallDontLie API failed, trying ESPN', { gameId, error });
                return await this.fetchFromESPN(gameId);
            }
        });
    }
    async fetchFromBallDontLie(gameId) {
        const numericId = await this.resolveGameId(gameId);
        const response = await axios_1.default.get(`${this.baseUrl}/stats`, {
            params: {
                game_ids: [numericId],
                per_page: 100
            },
            timeout: 10000,
            headers: {
                'User-Agent': 'UnitTalk/1.0 Settlement System'
            }
        });
        return this.parseBallDontLieStats(response.data);
    }
    async fetchFromESPN(gameId) {
        const espnGameId = await this.resolveESPNGameId(gameId);
        const response = await axios_1.default.get(`${this.espnUrl}/summary`, {
            params: { event: espnGameId },
            timeout: 10000,
            headers: {
                'User-Agent': 'UnitTalk/1.0 Settlement System'
            }
        });
        return this.parseESPNBoxScore(response.data);
    }
    async resolveGameId(gameId) {
        // If already numeric, return as is
        if (/^\d+$/.test(gameId)) {
            return gameId;
        }
        // Parse from format like "2024_09_15_lal_gsw"
        const parts = gameId.split('_');
        if (parts.length >= 5) {
            const [year, month, day, awayTeam, homeTeam] = parts;
            const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            // Query BallDontLie for games on that date
            const response = await axios_1.default.get(`${this.baseUrl}/games`, {
                params: {
                    start_date: date,
                    end_date: date
                }
            });
            // Find matching game
            for (const game of response.data.data || []) {
                if (this.matchesNBAGame(game, awayTeam, homeTeam)) {
                    return String(game.id);
                }
            }
        }
        throw new Error(`Could not resolve NBA game ID for: ${gameId}`);
    }
    async resolveESPNGameId(gameId) {
        // Similar to NFL adapter logic
        if (/^\d+$/.test(gameId)) {
            return gameId;
        }
        const parts = gameId.split('_');
        if (parts.length >= 5) {
            const [year, month, day] = parts;
            const date = `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`;
            const response = await axios_1.default.get(`${this.espnUrl}/scoreboard`, {
                params: { dates: date }
            });
            for (const event of response.data.events || []) {
                // Match by teams
                if (this.matchesESPNGame(event, gameId)) {
                    return event.id;
                }
            }
        }
        throw new Error(`Could not resolve ESPN NBA game ID for: ${gameId}`);
    }
    matchesNBAGame(game, awayCode, homeCode) {
        const awayAbbr = game.visitor_team?.abbreviation?.toLowerCase();
        const homeAbbr = game.home_team?.abbreviation?.toLowerCase();
        return awayAbbr === awayCode.toLowerCase() &&
            homeAbbr === homeCode.toLowerCase();
    }
    matchesESPNGame(event, gameId) {
        const competitors = event.competitions?.[0]?.competitors || [];
        const gameIdLower = gameId.toLowerCase();
        return competitors.every((c) => gameIdLower.includes(c.team?.abbreviation?.toLowerCase()));
    }
    parseBallDontLieStats(data) {
        const stats = {};
        for (const playerStat of data.data || []) {
            const playerId = String(playerStat.id);
            const playerName = `${playerStat.first_name} ${playerStat.last_name}`;
            const normalizedName = this.normalizePlayerName(playerName);
            // Parse minutes to decimal
            const minutes = this.parseMinutes(playerStat.min);
            const playerStats = {
                PTS: playerStat.pts,
                REB: playerStat.reb,
                AST: playerStat.ast,
                STL: playerStat.stl,
                BLK: playerStat.blk,
                TO: playerStat.turnover,
                FGM: playerStat.fgm,
                FGA: playerStat.fga,
                '3PM': playerStat.fg3m,
                '3PA': playerStat.fg3a,
                FTM: playerStat.ftm,
                FTA: playerStat.fta,
                OREB: playerStat.oreb,
                DREB: playerStat.dreb,
                PF: playerStat.pf,
                MIN: minutes,
                // Calculated stats
                'PTS+REB': playerStat.pts + playerStat.reb,
                'PTS+AST': playerStat.pts + playerStat.ast,
                'REB+AST': playerStat.reb + playerStat.ast,
                'PTS+REB+AST': playerStat.pts + playerStat.reb + playerStat.ast,
                'STL+BLK': playerStat.stl + playerStat.blk,
                'DOUBLE_DOUBLE': this.checkDoubleDouble(playerStat) ? 1 : 0,
                'TRIPLE_DOUBLE': this.checkTripleDouble(playerStat) ? 1 : 0
            };
            // Store under all name variations
            stats[playerId] = playerStats;
            stats[playerName] = playerStats;
            stats[normalizedName] = playerStats;
        }
        return stats;
    }
    parseESPNBoxScore(gameData) {
        const stats = {};
        const boxscore = gameData.boxscore;
        if (!boxscore?.players) {
            return stats;
        }
        for (const teamPlayers of boxscore.players) {
            for (const category of teamPlayers.statistics || []) {
                if (category.name !== 'starters' && category.name !== 'bench')
                    continue;
                for (const athleteData of category.athletes || []) {
                    const playerId = athleteData.athlete.id;
                    const playerName = athleteData.athlete.displayName;
                    const normalizedName = this.normalizePlayerName(playerName);
                    // ESPN stat order: MIN, FG, 3PT, FT, OREB, DREB, REB, AST, STL, BLK, TO, PF, PTS
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
                        // Calculated
                        'PTS+REB': statValues[12] + statValues[6],
                        'PTS+AST': statValues[12] + statValues[7],
                        'REB+AST': statValues[6] + statValues[7],
                        'PTS+REB+AST': statValues[12] + statValues[6] + statValues[7],
                        'STL+BLK': statValues[8] + statValues[9]
                    };
                    stats[playerId] = playerStats;
                    stats[playerName] = playerStats;
                    stats[normalizedName] = playerStats;
                }
            }
        }
        return stats;
    }
    parseMinutes(minString) {
        if (!minString)
            return 0;
        const [minutes, seconds] = minString.split(':').map(Number);
        return minutes + (seconds / 60);
    }
    parseMadeAttempted(stat) {
        const [made, attempted] = stat.split('-').map(Number);
        return [made || 0, attempted || 0];
    }
    checkDoubleDouble(stats) {
        const categories = [stats.pts, stats.reb, stats.ast, stats.stl, stats.blk];
        return categories.filter(cat => cat >= 10).length >= 2;
    }
    checkTripleDouble(stats) {
        const categories = [stats.pts, stats.reb, stats.ast, stats.stl, stats.blk];
        return categories.filter(cat => cat >= 10).length >= 3;
    }
}
exports.NBAAdapter = NBAAdapter;
