"use strict";
/**
 * NBA-specific scoring weights configuration
 * Optimized for basketball player props with focus on pace, matchups, and player form
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NBA_CONFIG = exports.NBA_RISK = exports.NBA_TIERS = exports.NBA_WEIGHTS = void 0;
exports.NBA_WEIGHTS = {
    sport: 'NBA',
    version: '1.0.0',
    description: 'NBA basketball optimized for player props with pace and usage rate focus',
    lastUpdated: '2025-01-09',
    // Core Components (optimized for basketball)
    expectedValue: 0.20, // Strong EV focus for NBA
    lineMovement: 0.12, // Important in NBA due to news sensitivity
    matchupRating: 0.15, // Critical for player props vs defense
    playerForm: 0.12, // Recent performance very important
    injuryImpact: 0.08, // High impact due to pace/usage changes
    weatherImpact: 0.0, // Indoor sport - no weather impact
    // Advanced Market Intelligence
    marketIntelligence: 0.14, // Sharp NBA market intelligence
    sharpMoney: 0.09, // Clear sharp/public splits
    volumeProfile: 0.06, // Volume patterns matter
    closingLineValue: 0.11, // Strong CLV predictive power
    // Professional Capper Features
    steamDetection: 0.02, // Steam moves common in NBA
    closingLinePrediction: 0.015, // Line closure modeling
    optimalTiming: 0.01, // Injury news timing critical
    lineShoppingEdge: 0.015, // Multiple book advantage
    publicVsSharpSplit: 0.02, // Clear contrarian opportunities
    marketTimingAdvantage: 0.01, // Time decay effects
    injuryTimingEdge: 0.015, // Breaking news impact
    crossMarketDiscrepancy: 0.01, // Correlated prop opportunities
    // Player & Game Context (NBA-specific)
    playerFatigue: 0.03, // Back-to-back games matter
    venueAdvantage: 0.02, // Home court advantage
    refereeImpact: 0.02, // Referee tendencies on totals
    paceImpact: 0.04, // CRITICAL in NBA - pace affects all props
    motivationalFactors: 0.02, // Playoff push, rest games
    // Risk & Correlation
    correlationRisk: 0.015, // Player props can be correlated
    volatility: 0.01, // NBA has moderate volatility
    portfolioImpact: 0.005, // Portfolio balance
    // ML Model Ensemble
    neuralNetwork: 0.025, // Neural network for complex patterns
    gradientBoosting: 0.03, // Strong for NBA feature interactions
    randomForest: 0.02, // Tree-based models work well
    ensemble: 0.035, // Ensemble of models
    // Enhanced Capper Features (NBA-optimized)
    handednessSplits: 0.005, // Less relevant in basketball
    recentTrendAnalysis: 0.025, // Hot/cold streaks matter
    headToHeadHistory: 0.015, // Matchup history
    rosterStabilityScore: 0.01, // Lineup consistency
    bullpenQualityScore: 0.0, // N/A for basketball
    advancedSplitAnalysis: 0.02, // Home/away, vs position splits
    // Time-based weights
    last3Weight: 0.4, // Recent games heavily weighted
    last7Weight: 0.3, // Last week performance
    last15Weight: 0.2, // Two weeks context
    last30Weight: 0.1, // Monthly baseline
    enhancedWeight: 0.08, // Enhanced analysis contribution
    // NBA-specific factors
    sportSpecificFactors: {
        usageRate: 0.03, // Player usage rate impact
        paceAdjustment: 0.02, // Pace-adjusted statistics
        restAdvantage: 0.015, // Days rest differential
        travelFatigue: 0.01, // Travel schedule impact
    }
};
exports.NBA_TIERS = {
    S_TIER: { minScore: 75, minEdge: 25, maxRisk: 3, minPositionSize: 0.05 },
    A_TIER: { minScore: 55, minEdge: 5, maxRisk: 4, minPositionSize: 0.03 },
    B_TIER: { minScore: 45, maxRisk: 5, minPositionSize: 0.015 },
    C_TIER: { minScore: 35, maxRisk: 6, minPositionSize: 0.005 },
    D_TIER: { description: 'Below quality threshold - rejected' }
};
exports.NBA_RISK = {
    maxPositionSize: 0.06, // Slightly higher for NBA liquidity
    kellyMultiplier: 0.25, // Standard Kelly multiplier
    maxDrawdown: 0.18, // Tighter drawdown control
    maxCorrelation: 0.65, // Lower correlation tolerance
    minSharpeRatio: 1.2, // Higher Sharpe requirement
    maxExposurePerSport: 0.35, // Higher NBA exposure allowed
    maxExposurePerPlayer: 0.12, // Player-specific exposure
    maxDailyRisk: 0.15, // Daily risk limit
    stopLossThreshold: 0.12, // Stop loss threshold
    maxVaR: 0.04, // Value at Risk limit
    maxCVaR: 0.07 // Conditional VaR limit
};
exports.NBA_CONFIG = {
    weights: exports.NBA_WEIGHTS,
    tiers: exports.NBA_TIERS,
    risk: exports.NBA_RISK
};
