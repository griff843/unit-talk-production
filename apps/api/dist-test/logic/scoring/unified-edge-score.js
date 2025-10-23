"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_EDGE_CONFIG = exports.EDGE_SCORING_VERSION = void 0;
exports.unifiedEdgeScore = unifiedEdgeScore;
exports.finalEdgeScore = finalEdgeScore;
exports.gradePick = gradePick;
exports.calculateEdgeScore = calculateEdgeScore;
exports.scorePropEdge = scorePropEdge;
// Import league-specific rules
const mlb_1 = require("./rules/mlb");
const nba_1 = require("./rules/nba");
const nfl_1 = require("./rules/nfl");
const nhl_1 = require("./rules/nhl");
// Version tracking for scoring algorithm
exports.EDGE_SCORING_VERSION = {
    CURRENT: 2,
    LEGACY: 1,
    MINIMUM_SUPPORTED: 1
};
// Default configuration
exports.DEFAULT_EDGE_CONFIG = {
    version: exports.EDGE_SCORING_VERSION.CURRENT,
    market: {
        'points': 5,
        'rebounds': 4,
        'assists': 4,
        '3PM': 3,
        'PRA': 2,
        'default': 1
    },
    odds: {
        threshold: -125,
        high: 3
    },
    trend_score: {
        threshold: 0.7,
        strong: 4
    },
    matchup_score: {
        threshold: 0.6,
        strong: 3
    },
    role_score: {
        threshold: 0.5,
        strong: 2
    },
    line_value_score: {
        threshold: 0.6,
        strong: 3
    },
    source: {
        'premium': 2,
        'verified': 1,
        'standard': 0
    },
    tags: {
        'rocket': 3,
        'ladder': 2,
        'value': 1
    },
    max: 100,
    tier_thresholds: {
        S: 85,
        A: 75,
        B: 65,
        C: 55
    }
};
/**
 * Unified edge scoring function that combines all scoring logic
 * @param prop - The prop to professional_score
 * @param config - Configuration for scoring algorithm
 * @param options - Additional options
 * @returns Complete edge professional_score result
 */
function unifiedEdgeScore(prop, config = exports.DEFAULT_EDGE_CONFIG, options = {}) {
    // Use requested version or default to current
    const version = options.useLegacyScoring ? exports.EDGE_SCORING_VERSION.LEGACY : (config.version || exports.EDGE_SCORING_VERSION.CURRENT);
    let professional_score = 0;
    const breakdown = {};
    const tags = [];
    // Apply league-specific rules if requested
    if (options.useLeagueRules) {
        const leagueScore = calculateLeagueSpecificScore(prop);
        professional_score += leagueScore.score;
        breakdown['league_rules'] = leagueScore.score;
        Object.assign(breakdown, leagueScore.breakdown);
    }
    // Apply market type bonus
    const marketType = prop['market_type'] || prop['stat_type'] || 'default';
    const marketMod = config.market[marketType.toLowerCase()] ?? config.market['default'];
    if (marketMod !== undefined) {
        professional_score += marketMod;
        breakdown['market_type'] = marketMod;
    }
    // Odds logic
    const odds = prop['odds'] || prop['odds'];
    if (odds !== undefined && odds !== null && typeof odds === 'number') {
        if (odds < config.odds.threshold) {
            professional_score += config.odds.high;
            breakdown['odds'] = config.odds.high;
        }
    }
    // Trend professional_score
    const trendScore = prop['trend_score'];
    if (trendScore !== undefined && trendScore > config.trend_score.threshold) {
        professional_score += config.trend_score.strong;
        breakdown['trend_score'] = config.trend_score.strong;
    }
    // Matchup professional_score
    const matchupScore = prop['matchup_score'] || prop['dvp_score'];
    if (matchupScore !== undefined && matchupScore !== null && typeof matchupScore === 'number' && matchupScore > config.matchup_score.threshold) {
        professional_score += config.matchup_score.strong;
        breakdown['matchup_score'] = config.matchup_score.strong;
    }
    // Role professional_score
    const roleScore = prop['role_score'];
    if (roleScore !== undefined && roleScore > config.role_score.threshold) {
        professional_score += config.role_score.strong;
        breakdown['role_score'] = config.role_score.strong;
    }
    // Source bonus
    const source = prop['source'] || prop['provider'];
    if (source && config.source[source]) {
        professional_score += config.source[source];
        breakdown['source'] = config.source[source];
    }
    // Line value
    const lineValueScore = prop['line_value_score'];
    if (lineValueScore !== undefined && lineValueScore > config.line_value_score.threshold) {
        professional_score += config.line_value_score.strong;
        breakdown['line_value_score'] = config.line_value_score.strong;
    }
    // Tags + boosts
    if (prop['is_rocket']) {
        const rocketBonus = config.tags?.['rocket'];
        if (rocketBonus !== undefined) {
            professional_score += rocketBonus;
            breakdown['is_rocket'] = rocketBonus;
            tags.push('rocket');
        }
    }
    if (prop['is_ladder']) {
        const ladderBonus = config.tags?.['ladder'];
        if (ladderBonus !== undefined) {
            professional_score += ladderBonus;
            breakdown['is_ladder'] = ladderBonus;
            tags.push('ladder');
        }
    }
    // Context flag (lower professional_score if present)
    const contextFlag = prop['context_flag'];
    if (contextFlag === false) {
        professional_score += 1;
        breakdown['no_context_flag'] = 1;
    }
    // Clamp professional_score
    professional_score = Math.min(config.max, Math.max(0, professional_score));
    breakdown['total'] = professional_score;
    // Determine tier
    let tier = '';
    if (options.adminOverrideTier && typeof options.adminOverrideTier === 'string') {
        tier = options.adminOverrideTier;
        breakdown['override'] = `Forced to ${tier}`;
    }
    else {
        tier = determineTier(professional_score, config);
    }
    // Postable + Solo Lock Logic
    const postable = ['S', 'A'].includes(tier);
    const solo_lock = tier === 'S';
    return {
        score: professional_score,
        tier,
        tags,
        breakdown,
        postable,
        solo_lock,
        version
    };
}
/**
 * Calculate league-specific professional_score based on rules from edgeScoreEngine.ts
 */
function calculateLeagueSpecificScore(prop) {
    const leagueValue = prop['league'] || prop['league'] || '';
    const league = typeof leagueValue === 'string' ? leagueValue.toUpperCase() : String(leagueValue).toUpperCase();
    let professional_score = 0;
    const breakdown = {};
    // League-specific scoring functions
    let coreStatsFunc = null;
    let synergyFunc = null;
    // Set league-specific rules - cast to PropObject for compatibility
    if (league === 'NBA') {
        coreStatsFunc = (p) => (0, nba_1.nbaCoreStats)(p);
        synergyFunc = (p) => (0, nba_1.nbaSynergy)(p);
    }
    else if (league === 'MLB') {
        coreStatsFunc = (p) => (0, mlb_1.mlbCoreStats)(p);
        synergyFunc = (p) => (0, mlb_1.mlbSynergy)(p);
    }
    else if (league === 'NHL') {
        coreStatsFunc = (p) => (0, nhl_1.nhlCoreStats)(p);
        synergyFunc = (p) => (0, nhl_1.nhlSynergy)(p);
    }
    else if (league === 'NFL') {
        coreStatsFunc = (p) => (0, nfl_1.nflCoreStats)(p);
        synergyFunc = (p) => (0, nfl_1.nflSynergy)(p);
    }
    // 1. Odds sweet-spot
    const oddsValue = prop['odds'] || prop['odds'] ||
        prop['over_odds'] || prop['under_odds'];
    const odds = typeof oddsValue === 'number' ? oddsValue : 0;
    if (odds >= -125 && odds <= 115) {
        professional_score += 1;
        breakdown['odds_sweet_spot'] = 1;
    }
    // 2. Core stat type - use league-specific function
    if (coreStatsFunc) {
        const coreBreakdown = coreStatsFunc(prop);
        const coreScore = Object.values(coreBreakdown).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
        if (Number(coreScore) > 0) {
            professional_score += Math.min(Number(coreScore), 2); // Cap at 2 points
            breakdown['core_stats'] = coreScore;
        }
    }
    // 3. DVP or matchup professional_score
    const dvpScore = prop['matchup_score'] || prop['dvp_score'];
    if (typeof dvpScore === 'number' && dvpScore >= 1) {
        professional_score += 1;
        breakdown['dvp_score'] = 1;
    }
    // 4. Synergy - use league-specific function
    if (synergyFunc) {
        const synergyBreakdown = synergyFunc(prop);
        const synergyScore = Object.values(synergyBreakdown).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
        if (Number(synergyScore) > 0) {
            professional_score += Math.min(Number(synergyScore), 2); // Cap at 2 points
            breakdown['synergy'] = synergyScore;
        }
    }
    // 5. No injury/context flag
    const contextFlag = prop['context_flag'];
    if (contextFlag === false) {
        professional_score += 1;
        breakdown['no_context_flag'] = 1;
    }
    return { score: professional_score, breakdown };
}
/**
 * Determine tier based on professional_score and config thresholds
 */
function determineTier(score, config) {
    if (score >= config.tier_thresholds.S) {
        return 'S';
    }
    if (score >= config.tier_thresholds.A) {
        return 'A';
    }
    if (score >= config.tier_thresholds.B) {
        return 'B';
    }
    if (score >= config.tier_thresholds.C) {
        return 'C';
    }
    return 'D';
}
/**
 * Legacy compatibility function for finalEdgeScore
 * @deprecated Use unifiedEdgeScore instead
 */
function finalEdgeScore(prop, config, adminOverrideTier) {
    const result = unifiedEdgeScore(prop, config, { adminOverrideTier: adminOverrideTier || null, useLegacyScoring: true });
    // Remove version to match legacy return type
    const { version, ...legacyResult } = result;
    return legacyResult;
}
/**
 * Legacy compatibility function for gradePick
 * @deprecated Use unifiedEdgeScore instead
 */
function gradePick(prop) {
    const result = unifiedEdgeScore(prop, exports.DEFAULT_EDGE_CONFIG, { useLeagueRules: true });
    return {
        score: result.score,
        tier: result.tier,
        breakdown: result.breakdown
    };
}
/**
 * Legacy compatibility function for calculateEdgeScore
 * @deprecated Use unifiedEdgeScore instead
 */
function calculateEdgeScore(prop) {
    const result = calculateLeagueSpecificScore(prop);
    return result.score;
}
/**
 * Legacy compatibility function for scorePropEdge
 * @deprecated Use unifiedEdgeScore instead
 */
function scorePropEdge(prop) {
    const result = unifiedEdgeScore(prop, exports.DEFAULT_EDGE_CONFIG);
    return {
        edge_score: result.score,
        tier: result.tier,
        context_tags: result.tags,
        edge_breakdown: result.breakdown
    };
}
