"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateEdgeScore = calculateEdgeScore;
const mlb_1 = require("./rules/mlb");
const nba_1 = require("./rules/nba");
const nfl_1 = require("./rules/nfl");
const nhl_1 = require("./rules/nhl");
function calculateEdgeScore(prop) {
    const league = (prop['league'] || '').toUpperCase();
    let professional_score = 1; // Start with base professional_score of 1
    let coreStats = [];
    let synergy = {};
    if (league === 'NBA') {
        coreStats = nba_1.nbaCoreStats;
        synergy = nba_1.nbaSynergy;
    }
    else if (league === 'MLB') {
        coreStats = mlb_1.mlbCoreStats;
        synergy = mlb_1.mlbSynergy;
    }
    else if (league === 'NHL') {
        coreStats = nhl_1.nhlCoreStats;
        synergy = nhl_1.nhlSynergy;
    }
    else if (league === 'NFL') {
        coreStats = nfl_1.nflCoreStats;
        synergy = nfl_1.nflSynergy;
    }
    else {
        // Unknown league, fallback to basic scoring
        coreStats = [];
        synergy = {};
    }
    // 1. Odds sweet-spot (use either 'odds', 'over_odds', or 'under_odds', adjust as needed)
    const odds = typeof prop['odds'] === 'number'
        ? prop['odds']
        : typeof prop['over_odds'] === 'number'
            ? prop['over_odds']
            : typeof prop['under_odds'] === 'number'
                ? prop['under_odds']
                : 0;
    if (odds >= -125 && odds <= 115) {
        professional_score += 1;
    }
    // 2. Core stat type (stat_type, not statType)
    if (coreStats.includes((prop['stat_type'] || '').toLowerCase())) {
        professional_score += 1;
    }
    // 3. DVP or matchup professional_score
    if (typeof prop['dvp_score'] === 'number' && prop['dvp_score'] >= 1) {
        professional_score += 1;
    }
    // 4. Synergy: position to stat
    const pos = prop['position'] || '';
    const stat = (prop['stat_type'] || '').toLowerCase();
    if (pos && typeof pos === 'string' && pos in synergy && synergy[pos]?.some((s) => s.toLowerCase() === stat)) {
        professional_score += 1;
    }
    // 5. No injury/context flag
    if (!prop['context_flag']) {
        professional_score += 1;
    }
    // 6. Has valid line
    if (typeof prop['line'] === 'number' && prop['line'] > 0) {
        professional_score += 1;
    }
    // 7. Has valid odds
    if (odds !== 0) {
        professional_score += 1;
    }
    // 8. Has valid player name
    if (prop['player_name']) {
        professional_score += 1;
    }
    return professional_score;
}
