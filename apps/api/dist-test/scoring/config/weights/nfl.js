"use strict";
/**
 * NFL-specific scoring weights configuration
 * Optimized for football with focus on weather, injuries, and motivational factors
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NFL_CONFIG = exports.NFL_RISK = exports.NFL_TIERS = exports.NFL_WEIGHTS = void 0;
exports.NFL_WEIGHTS = {
    sport: 'NFL',
    version: '1.0.0',
    description: 'NFL football optimized for weather impact, injuries, and situational factors',
    lastUpdated: '2025-01-09',
    // Core Components (football-optimized)
    expectedValue: 0.22, // High EV focus in NFL
    lineMovement: 0.14, // Very important - sharp money moves lines
    matchupRating: 0.13, // Matchup analysis critical
    playerForm: 0.10, // Recent form important but smaller sample
    injuryImpact: 0.09, // HUGE in NFL - can change everything
    weatherImpact: 0.04, // Significant for outdoor games
    // Advanced Market Intelligence  
    marketIntelligence: 0.15, // NFL has sophisticated sharp play
    sharpMoney: 0.11, // Clear sharp/public differences
    volumeProfile: 0.07, // Volume patterns predictive
    closingLineValue: 0.12, // Strong CLV predictive power
    // Professional Capper Features
    steamDetection: 0.03, // Common in NFL betting
    closingLinePrediction: 0.025, // Important for line closure
    optimalTiming: 0.02, // Timing matters for injury news
    lineShoppingEdge: 0.018, // Significant line differences exist
    publicVsSharpSplit: 0.025, // Strong contrarian opportunities
    marketTimingAdvantage: 0.015, // Time decay important
    injuryTimingEdge: 0.02, // Breaking injury news crucial
    crossMarketDiscrepancy: 0.015, // Correlated markets exist
    // Player & Game Context (NFL-specific)
    playerFatigue: 0.02, // Weekly rest, not as critical as NBA
    venueAdvantage: 0.025, // Home field advantage notable
    refereeImpact: 0.025, // Referee tendencies on penalties/flags
    paceImpact: 0.03, // Pace affects total possessions
    motivationalFactors: 0.04, // HUGE - playoff implications, prime time
    // Risk & Correlation
    correlationRisk: 0.02, // Player props can correlate
    volatility: 0.02, // High variance sport
    portfolioImpact: 0.005, // Portfolio balance
    // ML Model Ensemble
    neuralNetwork: 0.025, // Complex situational patterns
    gradientBoosting: 0.03, // Great for feature interactions
    randomForest: 0.02, // Handles categorical features well
    ensemble: 0.035, // Strong ensemble benefits
    // Enhanced Capper Features (NFL-optimized)
    handednessSplits: 0.0, // Not relevant in football
    recentTrendAnalysis: 0.015, // Limited recent sample in NFL
    headToHeadHistory: 0.01, // Less frequent matchups
    rosterStabilityScore: 0.02, // Injury replacements matter
    bullpenQualityScore: 0.0, // Not applicable
    advancedSplitAnalysis: 0.025, // Home/away, division splits
    // Time-based weights (NFL adjusted)
    last3Weight: 0.5, // Very limited sample, recent critical
    last7Weight: 0.3, // Only covers 1-2 games typically
    last15Weight: 0.15, // 2-3 games context
    last30Weight: 0.05, // 4-5 games max, season context
    enhancedWeight: 0.06, // Moderate enhanced contribution
    // NFL-specific factors
    sportSpecificFactors: {
        weatherConditions: 0.035, // Rain, snow, wind, temperature
        primeTimeBonus: 0.02, // Monday/Thursday night motivation
        playoffImplications: 0.03, // Win-and-in, seeding implications  
        divisionRivalry: 0.015, // Division game intensity
        restAdvantage: 0.01, // Bye week vs short week
    }
};
exports.NFL_TIERS = {
    S_TIER: { minScore: 72, minEdge: 22, maxRisk: 3, minPositionSize: 0.05 },
    A_TIER: { minScore: 52, minEdge: 2, maxRisk: 4, minPositionSize: 0.03 },
    B_TIER: { minScore: 42, maxRisk: 5, minPositionSize: 0.015 },
    C_TIER: { minScore: 32, maxRisk: 6, minPositionSize: 0.005 },
    D_TIER: { description: 'Below quality threshold - rejected' }
};
exports.NFL_RISK = {
    maxPositionSize: 0.05, // Standard max position
    kellyMultiplier: 0.25, // Standard Kelly multiplier  
    maxDrawdown: 0.20, // Higher variance tolerance
    maxCorrelation: 0.70, // Allow higher correlation
    minSharpeRatio: 1.0, // Moderate Sharpe requirement
    maxExposurePerSport: 0.30, // Standard sport exposure
    maxExposurePerPlayer: 0.10, // Player exposure limit
    maxDailyRisk: 0.15, // Standard daily risk
    stopLossThreshold: 0.15, // Standard stop loss
    maxVaR: 0.05, // Standard VaR limit
    maxCVaR: 0.08 // Standard CVaR limit
};
exports.NFL_CONFIG = {
    weights: exports.NFL_WEIGHTS,
    tiers: exports.NFL_TIERS,
    risk: exports.NFL_RISK
};
