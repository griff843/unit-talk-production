"use strict";
// src/logic/scoring/rules/nfl.ts
// NFL-specific scoring rules and statistics
Object.defineProperty(exports, "__esModule", { value: true });
exports.nflCoreStats = nflCoreStats;
exports.nflSynergy = nflSynergy;
/**
 * NFL Core Statistics Scoring
 * Evaluates fundamental football metrics
 */
function nflCoreStats(prop) {
    const breakdown = {};
    // Use existing prop scores
    if (prop['trend_score']) {
        breakdown['trend_factor'] = prop['trend_score'] * 0.4;
    }
    if (prop['matchup_score']) {
        breakdown['matchup_advantage'] = prop['matchup_score'] * 0.35;
    }
    if (prop['role_score']) {
        breakdown['role_impact'] = prop['role_score'] * 0.3;
    }
    // NFL-specific adjustments based on market type
    if (prop['market_type'].toLowerCase().includes('passing')) {
        breakdown['passing_prop_bonus'] = 0.12;
    }
    else if (prop['market_type'].toLowerCase().includes('rushing')) {
        breakdown['rushing_prop_bonus'] = 0.15;
    }
    else if (prop['market_type'].toLowerCase().includes('receiving')) {
        breakdown['receiving_prop_bonus'] = 0.13;
    }
    else if (prop['market_type'].toLowerCase().includes('touchdown')) {
        breakdown['scoring_prop_bonus'] = 0.18;
    }
    return breakdown;
}
/**
 * NFL Synergy Analytics
 * Advanced football analytics and situational factors
 */
function nflSynergy(prop) {
    const breakdown = {};
    // Use line value professional_score as game script factor
    if (prop['line_value_score']) {
        breakdown['game_script_factor'] = prop['line_value_score'] * 0.25;
    }
    // Rocket plays get prime time boost
    if (prop['is_rocket']) {
        breakdown['rocket_boost'] = 0.22;
    }
    // Ladder plays get consistency bonus
    if (prop['is_ladder']) {
        breakdown['ladder_consistency'] = 0.17;
    }
    // Tag-based adjustments
    if (prop['tags'] && prop['tags'].length > 0) {
        const hasWeatherTag = prop['tags'].some(tag => typeof tag === 'string' && tag.toLowerCase().includes('weather'));
        if (hasWeatherTag) {
            breakdown['weather_impact'] = -0.08; // Negative for bad weather
        }
        const hasPrimeTimeTag = prop['tags'].some(tag => typeof tag === 'string' && tag.toLowerCase().includes('primetime'));
        if (hasPrimeTimeTag) {
            breakdown['prime_time_boost'] = 0.1;
        }
        const hasInjuryTag = prop['tags'].some(tag => typeof tag === 'string' && tag.toLowerCase().includes('injury'));
        if (hasInjuryTag) {
            breakdown['injury_opportunity'] = 0.12;
        }
    }
    return breakdown;
}
