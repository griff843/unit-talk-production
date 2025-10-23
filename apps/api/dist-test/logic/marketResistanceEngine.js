"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeMarketResistance = analyzeMarketResistance;
// 📁 src/logic/marketResistanceEngine.ts
const oddsService_1 = require("../services/oddsService");
/**
 * Detects market reaction for a given pick.
 * Compares current line to opening line and infers signal strength.
 */
async function analyzeMarketResistance(pick) {
    const player_name = typeof pick['player_name'] === 'string' ? pick['player_name'] : String(pick['player_name'] || '');
    const stat_type = typeof pick['stat_type'] === 'string' ? pick['stat_type'] : String(pick['stat_type'] || '');
    const matchup = typeof pick['matchup'] === 'string' ? pick['matchup'] : String(pick['matchup'] || '');
    const game_date = typeof pick['game_date'] === 'string' ? pick['game_date'] : String(pick['game_date'] || '');
    // Check for required fields
    if (!player_name || !stat_type || !matchup || !game_date) {
        return { reaction: 'unknown', movement: 0 };
    }
    const historical = await (0, oddsService_1.fetchHistoricalOdds)(player_name, stat_type, matchup, game_date);
    const current = await (0, oddsService_1.fetchCurrentOdds)(player_name, stat_type, matchup);
    if (!historical || !current || historical.line === undefined || current.line === undefined) {
        return { reaction: 'unknown', movement: 0 };
    }
    const movement = current.line - historical.line;
    const movementPct = Math.abs(movement / historical.line) * 100;
    let reaction = 'neutral';
    if (movementPct >= 3) {
        if ((pick['direction'] === 'over' && movement > 0) || (pick['direction'] === 'under' && movement < 0)) {
            reaction = 'sharp_agree';
        }
        else {
            reaction = 'sharp_fade';
        }
    }
    return {
        reaction,
        movement,
        movementPct,
        updated_line: current.line
    };
}
