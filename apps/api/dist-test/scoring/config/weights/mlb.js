"use strict";
/**
 * MLB-specific scoring weights configuration
 * Optimized for baseball with heavy focus on handedness, weather, and bullpen quality
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MLB_CONFIG = exports.MLB_RISK = exports.MLB_TIERS = exports.MLB_WEIGHTS = void 0;
exports.MLB_WEIGHTS = {
    sport: 'MLB',
    version: '1.0.0',
    description: 'MLB baseball optimized for handedness splits, weather, and bullpen analysis',
    lastUpdated: '2025-01-09',
    // Core Components (baseball-optimized)
    expectedValue: 0.18, // Strong but not dominant in baseball
    lineMovement: 0.10, // Moderate importance
    matchupRating: 0.12, // Pitcher vs batter critical
    playerForm: 0.08, // Streaky sport but longer sample
    injuryImpact: 0.06, // Injuries less immediately impactful
    weatherImpact: 0.05, // CRITICAL in baseball - wind, temperature
    // Advanced Market Intelligence
    marketIntelligence: 0.13, // Sharp baseball knowledge important
    sharpMoney: 0.08, // Sharp play identification
    volumeProfile: 0.05, // Volume less predictive than other sports
    closingLineValue: 0.10, // CLV still important
    // Professional Capper Features
    steamDetection: 0.015, // Less common than NBA/NFL
    closingLinePrediction: 0.01, // Slower market movement
    optimalTiming: 0.008, // Less time-sensitive than other sports
    lineShoppingEdge: 0.012, // Line shopping matters
    publicVsSharpSplit: 0.015, // Clear public biases exist
    marketTimingAdvantage: 0.008, // Less urgent timing
    injuryTimingEdge: 0.01, // News breaks matter but less urgent
    crossMarketDiscrepancy: 0.012, // Prop correlations exist
    // Player & Game Context (baseball-specific)
    playerFatigue: 0.015, // Rest days less critical
    venueAdvantage: 0.025, // Park factors HUGE in baseball
    refereeImpact: 0.015, // Umpire strike zone tendencies
    paceImpact: 0.02, // Game pace affects totals
    motivationalFactors: 0.015, // Division races, playoff push
    // Risk & Correlation
    correlationRisk: 0.02, // Props highly correlated in baseball
    volatility: 0.015, // Higher variance sport
    portfolioImpact: 0.005, // Portfolio considerations
    // ML Model Ensemble
    neuralNetwork: 0.02, // Good for complex baseball stats
    gradientBoosting: 0.025, // Excellent for feature interactions
    randomForest: 0.015, // Handles many baseball features well
    ensemble: 0.03, // Strong ensemble performance
    // Enhanced Capper Features (baseball-optimized)
    handednessSplits: 0.08, // CRITICAL in baseball - L/R matchups
    recentTrendAnalysis: 0.02, // Less streaky than other sports
    headToHeadHistory: 0.02, // Historical matchups matter
    rosterStabilityScore: 0.015, // Lineup consistency
    bullpenQualityScore: 0.04, // HUGE factor in baseball
    advancedSplitAnalysis: 0.035, // Home/away, vs LHP/RHP crucial
    // Time-based weights (baseball adjusted)
    last3Weight: 0.25, // Less emphasis on very recent
    last7Weight: 0.35, // Weekly performance important
    last15Weight: 0.25, // Good sample size for trends
    last30Weight: 0.15, // Monthly context valuable
    enhancedWeight: 0.12, // Higher enhanced contribution
    // Baseball-specific factors
    sportSpecificFactors: {
        parkFactor: 0.04, // Park hitting/pitching factors
        weatherConditions: 0.03, // Wind direction, temperature
        platoonAdvantage: 0.035, // L/R platoon splits
        bullpenUsage: 0.025, // Recent bullpen usage
        restDays: 0.01, // Starting pitcher rest
    }
};
exports.MLB_TIERS = {
    S_TIER: { minScore: 70, minEdge: 20, maxRisk: 4, minPositionSize: 0.045 },
    A_TIER: { minScore: 50, minEdge: 0, maxRisk: 5, minPositionSize: 0.025 },
    B_TIER: { minScore: 40, maxRisk: 6, minPositionSize: 0.012 },
    C_TIER: { minScore: 30, maxRisk: 7, minPositionSize: 0.004 },
    D_TIER: { description: 'Below quality threshold - rejected' }
};
exports.MLB_RISK = {
    maxPositionSize: 0.05, // Standard max position
    kellyMultiplier: 0.22, // Slightly more conservative
    maxDrawdown: 0.20, // Higher tolerance for baseball variance
    maxCorrelation: 0.70, // Higher correlation tolerance
    minSharpeRatio: 0.9, // Lower Sharpe requirement (higher variance)
    maxExposurePerSport: 0.30, // Standard sport exposure
    maxExposurePerPlayer: 0.10, // Player exposure limit
    maxDailyRisk: 0.16, // Slightly higher daily risk
    stopLossThreshold: 0.15, // Higher stop loss (variance)
    maxVaR: 0.055, // Higher VaR tolerance
    maxCVaR: 0.085 // Higher CVaR tolerance
};
exports.MLB_CONFIG = {
    weights: exports.MLB_WEIGHTS,
    tiers: exports.MLB_TIERS,
    risk: exports.MLB_RISK
};
