"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mlbCapperFactors = exports.handednessAdvantages = exports.mlbContextualMultipliers = exports.enhancedMLBWeights = exports.mlbSynergy = exports.mlbCoreStats = void 0;
exports.mlbCoreStats = ['hits', 'home_runs', 'rbi', 'runs', 'total_bases'];
exports.mlbSynergy = {
    SP: ['strikeouts', 'outs', 'wins'],
    RP: ['strikeouts', 'outs', 'holds'],
    "1B": ['hits', 'total_bases', 'rbi'],
    "2B": ['hits', 'total_bases', 'runs'],
    "3B": ['hits', 'total_bases', 'runs'],
    SS: ['hits', 'total_bases', 'runs'],
    OF: ['hits', 'total_bases', 'runs', 'home_runs'],
    C: ['hits', 'rbi'],
    DH: ['hits', 'home_runs'],
};
// 🆕 NEW: Enhanced MLB Scoring Weights (Based on Capper Insights Analysis)
exports.enhancedMLBWeights = {
    // NEW: Enhanced components based on capper insights
    handednessSplits: 0.08, // Major factor in MLB - batter vs LHP/RHP analysis
    recentTrendAnalysis: 0.07, // Performance over 3/7/15/30 games
    headToHeadHistory: 0.04, // Player vs pitcher historical performance
    rosterStabilityScore: 0.03, // Trade/chemistry impact analysis
    bullpenQualityScore: 0.03, // Relief pitcher strength assessment
    advancedSplitAnalysis: 0.05, // Monthly, park, situational splits
    // ADJUSTED: Core features (reduced to make room for new)
    expectedValue: 0.18, // Was 0.22
    lineMovement: 0.08, // Was 0.10
    matchupRating: 0.11, // Was 0.13
    playerForm: 0.07, // Was 0.09
    injuryImpact: 0.06, // Was 0.07
    weatherImpact: 0.04, // Increased for MLB park factors
    // Market intelligence (slightly reduced)
    marketIntelligence: 0.12, // Was 0.15
    sharpMoney: 0.08, // Was 0.10
    volumeProfile: 0.06, // Was 0.07
    closingLineValue: 0.10, // Was 0.12
    // Professional features (maintained)
    steamDetection: 0.025,
    closingLinePrediction: 0.020,
    optimalTiming: 0.015,
    lineShoppingEdge: 0.015,
    publicVsSharpSplit: 0.020,
    marketTimingAdvantage: 0.010,
    injuryTimingEdge: 0.010,
    crossMarketDiscrepancy: 0.005,
    // Context (adjusted for MLB)
    playerFatigue: 0.04, // Was 0.05
    venueAdvantage: 0.05, // Increased for MLB park factors
    refereeImpact: 0.01, // Reduced for MLB (umpires less impact)
    paceImpact: 0.02, // Reduced for MLB
    motivationalFactors: 0.03, // Increased for rivalry/revenge games
    // Risk factors (maintained)
    correlationRisk: 0.09,
    volatility: 0.07,
    portfolioImpact: 0.10,
    // ML ensemble (slightly reduced)
    neuralNetwork: 0.15, // Was 0.18
    gradientBoosting: 0.18, // Was 0.22
    randomForest: 0.10, // Was 0.13
    ensemble: 0.22 // Was 0.27
};
// Contextual multipliers for special game situations
exports.mlbContextualMultipliers = {
    tradeDeadlineImpact: 1.2, // Enhanced weight during trade deadline
    weatherGames: 1.5, // Weather impact on total props
    revengeGames: 1.1, // Rivalry/motivational factors
    playoffRace: 1.3, // Late season playoff implications
    rookieDebut: 1.4, // First-time situations
    streakSituations: 1.2 // Hot/cold streak analysis
};
// Key handedness matchup advantages (based on capper insights)
exports.handednessAdvantages = {
    'L_vs_R': 1.12, // Lefty batter vs righty pitcher (generally favorable)
    'R_vs_L': 1.10, // Righty batter vs lefty pitcher (can be advantageous)
    'L_vs_L': 0.85, // Lefty vs lefty (typically tougher for batter)
    'R_vs_R': 0.95 // Righty vs righty (neutral to slightly disadvantageous)
};
// MLB-specific factors that cappers emphasize
exports.mlbCapperFactors = {
    // Recent performance windows (weights for trend analysis)
    trendWeights: {
        last3Games: 0.4, // Most recent games weighted heaviest
        last7Games: 0.3, // Recent week performance
        last15Games: 0.2, // Two-week sample
        last30Games: 0.1 // Monthly context
    },
    // Weather thresholds for significant impact
    weatherThresholds: {
        strongWind: 15, // mph - affects home run props
        extremeCold: 50, // degrees F - affects performance
        extremeHeat: 90, // degrees F - affects stamina
        precipitation: 0.1 // inches - affects game conditions
    },
    // Park factor adjustments
    parkFactors: {
        'Coors Field': 1.3, // Hitter-friendly (altitude)
        'Fenway Park': 1.15, // Green Monster effect
        'Yankee Stadium': 1.1, // Short right field
        'Petco Park': 0.85, // Pitcher-friendly
        'Marlins Park': 0.9, // Pitcher-friendly
        'Kauffman Stadium': 0.9 // Pitcher-friendly
    }
};
