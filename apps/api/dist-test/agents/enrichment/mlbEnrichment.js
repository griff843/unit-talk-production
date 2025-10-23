"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMlbRosters = getMlbRosters;
exports.convertMlbRosterPlayer = convertMlbRosterPlayer;
exports.getMlbHeadshot = getMlbHeadshot;
exports.getMlbStats = getMlbStats;
exports.getMlbTeam = getMlbTeam;
exports.getMlbGameLog = getMlbGameLog;
exports.getMlbInjuryStatus = getMlbInjuryStatus;
exports.getMlbProjections = getMlbProjections;
exports.getMlbPhysicals = getMlbPhysicals;
const axios_1 = __importDefault(require("axios"));
const player_1 = require("../../types/player");
const logger_1 = require("../../utils/logger");
/**
 * Fetch all MLB team rosters
 */
async function getMlbRosters() {
    try {
        logger_1.logger.info('Fetching MLB team rosters...');
        // First get all teams
        const teamsResponse = await axios_1.default.get('https://statsapi.mlb.com/api/v1/teams?sportId=1');
        const teams = teamsResponse.data.teams;
        const allPlayers = [];
        for (const team of teams) {
            try {
                logger_1.logger.info(`Fetching roster for ${team.name}...`);
                const rosterResponse = await axios_1.default.get(`https://statsapi.mlb.com/api/v1/teams/${team.id}/roster?rosterType=active`);
                const roster = rosterResponse.data;
                roster.roster.forEach(entry => {
                    if (entry.person.active) {
                        allPlayers.push(entry.person);
                    }
                });
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            catch (error) {
                logger_1.logger.error(`Error fetching roster for team ${team.id}:`, error);
            }
        }
        logger_1.logger.info(`Fetched ${allPlayers.length} MLB players from rosters`);
        return allPlayers;
    }
    catch (error) {
        logger_1.logger.error('Error fetching MLB rosters:', error);
        throw error;
    }
}
/**
 * Convert MLB roster player to standardized format
 */
function convertMlbRosterPlayer(player) {
    return {
        external_id: player.id.toString(),
        player_name: player.fullName,
        sport: 'MLB',
        height_cm: player.height ? convertHeightToCm(player.height) : null,
        weight_kg: player.weight ? Math.round(player.weight * 0.453592) : null, // lbs to kg
        birthday: player.birthDate || null,
        photo_url: null, // Will be enriched separately
        position: player.primaryPosition?.name || null,
        jersey_number: player.primaryNumber || null,
        active: player.active
    };
}
/**
 * Convert MLB height format (e.g., "6' 2\"") to centimeters
 */
function convertHeightToCm(height) {
    const match = height.match(/(\d+)'\s*(\d+)"/);
    if (match && match[1] && match[2]) {
        const feet = parseInt(match[1]);
        const inches = parseInt(match[2]);
        return Math.round((feet * 12 + inches) * 2.54);
    }
    return null;
}
/**
 * Get MLB player headshot URL
 * @param playerName - Full name of the player
 * @returns Headshot URL or null if not found
 */
async function getMlbHeadshot(playerId) {
    // Implementation would fetch from MLB API
    return `https://img.mlbstatic.com/mlb-photos/image/upload/w_213,q_100/v1/people/${playerId}/headshot/67/current`;
}
async function getMlbStats(_playerId) {
    // Implementation would fetch from MLB API
    return {
        batting: {
            avg: 0.300,
            hr: 30,
            rbi: 100
        },
        pitching: {
            era: 3.50,
            whip: 1.20,
            strikeouts: 200
        }
    };
}
async function getMlbTeam(_playerId) {
    // Implementation would fetch from MLB API
    return {
        id: 'team-1',
        name: 'Los Angeles Dodgers',
        abbreviation: 'LAD'
    };
}
async function getMlbGameLog(_playerId) {
    // Implementation would fetch from MLB API
    return {
        games: [
            {
                date: '2025-07-20',
                opponent: 'SFG',
                result: 'W',
                stats: {
                    batting: {
                        ab: 4,
                        h: 2,
                        hr: 1,
                        rbi: 3
                    },
                    pitching: {
                        ip: 7,
                        h: 5,
                        er: 2,
                        so: 8
                    }
                }
            }
        ]
    };
}
async function getMlbInjuryStatus(_playerId) {
    // Implementation would fetch from MLB API
    return {
        status: 'ACTIVE',
        details: null,
        expectedReturn: null
    };
}
async function getMlbProjections(_playerId) {
    // Implementation would fetch from MLB API
    return {
        nextGame: {
            opponent: 'SFG',
            date: '2025-07-20',
            projections: {
                batting: {
                    ab: 4,
                    h: 1.2,
                    hr: 0.3,
                    rbi: 0.8
                }
            }
        }
    };
}
/**
 * Get MLB player physical attributes (height, weight, birthday)
 * @param playerName - Full name of the player
 * @returns PlayerPhysicals object with height_cm, weight_kg, and birthday
 */
async function getMlbPhysicals(playerName) {
    try {
        console.log(`Fetching MLB physicals for: ${playerName}`);
        // Search for player by name
        const searchUrl = `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(playerName)}`;
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) {
            console.log(`MLB API search failed for ${playerName}: ${searchResponse.status} ${searchResponse.statusText}`);
            return { height_cm: null, weight_kg: null, birthday: null };
        }
        const searchData = await searchResponse.json();
        if (!searchData.people || searchData.people.length === 0) {
            console.log(`No MLB player found for name: ${playerName}`);
            return { height_cm: null, weight_kg: null, birthday: null };
        }
        // Get the first matching player (most relevant)
        const player = searchData.people[0];
        if (!player) {
            console.log(`No valid player data found for: ${playerName}`);
            return { height_cm: null, weight_kg: null, birthday: null };
        }
        // Get detailed player info if needed
        let detailedPlayer = player;
        if (!player.height || !player.weight || !player.birthDate) {
            try {
                const detailUrl = `https://statsapi.mlb.com/api/v1/people/${player.id}`;
                const detailResponse = await fetch(detailUrl);
                if (detailResponse.ok) {
                    const detailData = await detailResponse.json();
                    if (detailData.people && detailData.people.length > 0 && detailData.people[0]) {
                        detailedPlayer = detailData.people[0];
                    }
                }
            }
            catch (detailError) {
                console.log(`Could not fetch detailed info for ${playerName}:`, detailError);
            }
        }
        // Parse physical attributes
        const height_cm = detailedPlayer.height
            ? player_1.PlayerPhysicalUtils.parseHeightToCm(detailedPlayer.height)
            : null;
        const weight_kg = detailedPlayer.weight
            ? player_1.PlayerPhysicalUtils.poundsToKg(detailedPlayer.weight)
            : null;
        const birthday = detailedPlayer.birthDate
            ? player_1.PlayerPhysicalUtils.parseBirthday(detailedPlayer.birthDate)
            : null;
        const result = {
            height_cm,
            weight_kg,
            birthday
        };
        console.log(`Found MLB physicals for ${playerName}:`, {
            height: detailedPlayer.height ? `${detailedPlayer.height} (${height_cm}cm)` : 'N/A',
            weight: detailedPlayer.weight ? `${detailedPlayer.weight}lbs (${weight_kg}kg)` : 'N/A',
            birthday: birthday || 'N/A'
        });
        return result;
    }
    catch (error) {
        console.error(`Error fetching MLB physicals for ${playerName}:`, error);
        return { height_cm: null, weight_kg: null, birthday: null };
    }
}
