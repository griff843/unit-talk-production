"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nbaPaceFactors = exports.nbaPositionAdvantages = exports.nbaContextualMultipliers = exports.enhancedNBAWeights = exports.nbaSynergy = exports.nbaCoreStats = void 0;
exports.nbaCoreStats = ['points', 'rebounds', 'assists', '3PM', 'steals', 'blocks'];
exports.nbaSynergy = {
    PG: ['assists', 'points', '3PM', 'steals'],
    SG: ['points', '3PM', 'steals'],
    SF: ['points', 'rebounds', 'steals'],
    PF: ['rebounds', 'blocks', 'points'],
    C: ['rebounds', 'blocks', 'points'],
};
// 🆕 NEW: Enhanced NBA Scoring Weights (September 5, 2025)
exports.enhancedNBAWeights = {
    // NEW: Enhanced components based on professional basketball insights
    restAdvantage: 0.09, // Back-to-back games, rest differential analysis
    paceMatchupAnalysis: 0.08, // Fast vs slow pace team matchups  
    positionMatchupDepth: 0.07, // Individual matchup advantages by position
    fourthQuarterTendency: 0.06, // Clutch performance and closing ability
    homeCourtAdvantage: 0.05, // Venue-specific advantages (altitude, crowd, etc.)
    recentFormAnalysis: 0.07, // Performance over last 5/10/20 games
    injuryImpactAssessment: 0.04, // Key player absence and rotation changes
    // ADJUSTED: Core features (reduced to make room for new)
    expectedValue: 0.16, // Was 0.22
    lineMovement: 0.07, // Was 0.10
    matchupRating: 0.10, // Was 0.13
    playerForm: 0.06, // Was 0.09
    injuryImpact: 0.05, // Was 0.07 (now separate assessment above)
    // Market intelligence (slightly reduced)
    marketIntelligence: 0.11, // Was 0.15
    sharpMoney: 0.07, // Was 0.10
    volumeProfile: 0.05, // Was 0.07
    closingLineValue: 0.09, // Was 0.12
    // Professional features (maintained)
    steamDetection: 0.025,
    closingLinePrediction: 0.020,
    optimalTiming: 0.015,
    lineShoppingEdge: 0.015,
    publicVsSharpSplit: 0.020,
    marketTimingAdvantage: 0.010,
    injuryTimingEdge: 0.010,
    crossMarketDiscrepancy: 0.005,
    // Context (adjusted for NBA)
    playerFatigue: 0.06, // Increased for NBA (more games, more fatigue)
    venueAdvantage: 0.04, // Reduced for NBA (less venue variance than MLB)
    refereeImpact: 0.03, // Increased for NBA (refs have more impact)
    paceImpact: 0.04, // Increased for NBA pace analysis
    motivationalFactors: 0.02, // Reduced for NBA (less rivalry impact)
    // Risk factors (maintained)
    correlationRisk: 0.09,
    volatility: 0.07,
    portfolioImpact: 0.10,
    // ML ensemble (adjusted for basketball patterns)
    neuralNetwork: 0.14, // Was 0.15
    gradientBoosting: 0.19, // Increased for NBA volatility
    randomForest: 0.11, // Increased for feature interactions
    ensemble: 0.21 // Adjusted for NBA patterns
};
// Contextual multipliers for NBA game situations
exports.nbaContextualMultipliers = {
    backToBackGames: 0.8, // Fatigue impact on performance
    restAdvantageGames: 1.3, // Team with 2+ days rest vs tired opponent
    playoffPush: 1.4, // Late season games with playoff implications
    rivalryGames: 1.1, // Division rivals, historic rivalries
    seasonOpener: 1.2, // First games of season
    clutchSituations: 1.3, // Fourth quarter performance multiplier
    blowoutRisk: 0.7 // Large spread games (garbage time risk)
};
// NBA-specific position matchup advantages
exports.nbaPositionAdvantages = {
    'PG_speed_advantage': 1.15, // Fast PG vs slow defense
    'C_size_advantage': 1.20, // Big center vs small frontcourt
    'SG_shooting_advantage': 1.12, // Elite shooter vs poor perimeter defense
    'SF_versatility': 1.08, // Versatile forward vs rigid matchup
    'PF_mobility': 1.10 // Mobile PF vs traditional big
};
// NBA pace and style factors
exports.nbaPaceFactors = {
    paceWeights: {
        veryFast: 1.2, // 105+ possessions per game
        fast: 1.1, // 100-104 possessions
        average: 1.0, // 95-99 possessions  
        slow: 0.9, // 90-94 possessions
        verySlow: 0.8 // <90 possessions
    },
    styleMatchups: {
        fastVsFast: 1.3, // High scoring games
        fastVsSlow: 0.9, // Pace mismatch
        slowVsSlow: 0.8, // Low scoring grind
        threePointHeavy: 1.15, // Teams that live/die by three
        paintDominant: 1.1 // Inside-focused teams
    },
    // Rest differential impact
    restAdvantage: {
        '0vs1': 1.0, // Both teams same rest
        '0vs2': 1.1, // 1 day rest advantage  
        '0vs3': 1.2, // 2+ day rest advantage
        '1vs3': 1.15, // Well-rested vs tired
        'backToBack': 0.85 // Team on back-to-back
    }
};
