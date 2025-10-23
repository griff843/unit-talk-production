"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MLBAdapter = void 0;
const types_1 = require("./types");
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../../../utils/logger");
class MLBAdapter extends types_1.BaseAdapter {
    constructor() {
        super();
        this.baseUrl = 'https://statsapi.mlb.com/api/v1.1';
        this.logger = (0, logger_1.createLogger)('MLBAdapter');
        this.rateLimit = 10; // MLB API allows higher rate
    }
    getName() {
        return 'MLB StatsAPI';
    }
    async fetchGameStats(gameId) {
        return this.retryWithBackoff(async () => {
            try {
                // MLB game IDs are typically in format: 2024_09_15_bosmlb_nyamlb_1
                // We need to convert to MLB's game_pk format
                const gamePk = await this.getGamePk(gameId);
                const response = await axios_1.default.get(`${this.baseUrl}/game/${gamePk}/boxscore`, {
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'UnitTalk/1.0 Settlement System'
                    }
                });
                return this.parseBoxScore(response.data);
            }
            catch (error) {
                this.logger.warn('MLB API unavailable for game, returning empty stats', { gameId, error: error.message });
                // Return empty stats instead of throwing - allows settlement to continue
                return new Map();
            }
        });
    }
    async getGamePk(gameId) {
        // If already in game_pk format (numeric), return as is
        if (/^\d+$/.test(gameId)) {
            return gameId;
        }
        // Parse date from game ID format: 2024_09_15_bosmlb_nyamlb_1
        const parts = gameId.split('_');
        if (parts.length >= 5) {
            const [year, month, day] = parts.slice(0, 3);
            const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            // Query schedule for that date to find game_pk
            const response = await axios_1.default.get(`${this.baseUrl}/schedule`, {
                params: {
                    sportId: 1, // MLB
                    date: date
                }
            });
            // Find matching game
            for (const dateData of response.data.dates || []) {
                for (const game of dateData.games || []) {
                    // Match by team codes
                    if (this.matchesGame(game, gameId)) {
                        return String(game.gamePk);
                    }
                }
            }
        }
        throw new Error(`Could not resolve game_pk for gameId: ${gameId}`);
    }
    matchesGame(game, gameId) {
        const idLower = gameId.toLowerCase();
        const awayCode = game.teams?.away?.team?.abbreviation?.toLowerCase();
        const homeCode = game.teams?.home?.team?.abbreviation?.toLowerCase();
        return idLower.includes(awayCode) && idLower.includes(homeCode);
    }
    parseBoxScore(boxScore) {
        const stats = {};
        // Process both teams
        for (const side of ['away', 'home']) {
            const teamData = boxScore.teams[side];
            if (!teamData?.players)
                continue;
            for (const playerId in teamData.players) {
                const player = teamData.players[playerId];
                const playerName = player.person.fullName;
                const normalizedName = this.normalizePlayerName(playerName);
                // Initialize player stats
                stats[playerId] = {};
                stats[playerName] = {};
                stats[normalizedName] = {};
                // Batting stats
                if (player.stats?.batting) {
                    const batting = player.stats.batting;
                    // Calculate total bases: singles + 2*doubles + 3*triples + 4*HR
                    const singles = batting.hits - batting.doubles - batting.triples - batting.homeRuns;
                    const totalBases = singles + (2 * batting.doubles) + (3 * batting.triples) + (4 * batting.homeRuns);
                    const battingStats = {
                        H: batting.hits,
                        HR: batting.homeRuns,
                        R: batting.runs,
                        RBI: batting.rbi,
                        BB: batting.baseOnBalls,
                        SO: batting.strikeOuts,
                        TB: totalBases,
                        SB: batting.stolenBases,
                        AB: batting.atBats,
                        '2B': batting.doubles,
                        '3B': batting.triples
                    };
                    // Store under all name variations for flexibility
                    Object.assign(stats[playerId], battingStats);
                    Object.assign(stats[playerName], battingStats);
                    Object.assign(stats[normalizedName], battingStats);
                }
                // Pitching stats
                if (player.stats?.pitching) {
                    const pitching = player.stats.pitching;
                    // Convert innings pitched from "6.2" format to outs
                    const ipParts = pitching.inningsPitched.split('.');
                    const innings = parseInt(ipParts[0]) || 0;
                    const outs = parseInt(ipParts[1]) || 0;
                    const totalOuts = (innings * 3) + outs;
                    const pitchingStats = {
                        IP: pitching.inningsPitched,
                        OUTS: totalOuts,
                        K: pitching.strikeOuts,
                        BB_ALLOWED: pitching.baseOnBalls,
                        H_ALLOWED: pitching.hits,
                        ER: pitching.earnedRuns,
                        R_ALLOWED: pitching.runs,
                        HR_ALLOWED: pitching.homeRuns,
                        PITCHES: pitching.pitchesThrown
                    };
                    Object.assign(stats[playerId], pitchingStats);
                    Object.assign(stats[playerName], pitchingStats);
                    Object.assign(stats[normalizedName], pitchingStats);
                }
            }
        }
        return stats;
    }
}
exports.MLBAdapter = MLBAdapter;
