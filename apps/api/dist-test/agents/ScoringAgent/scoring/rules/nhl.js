"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nhlSpecialTeamsFactors = exports.nhlLineMatchups = exports.nhlGoalieFactors = exports.nhlContextualMultipliers = exports.enhancedNHLWeights = exports.nhlSynergy = exports.nhlCoreStats = void 0;
exports.nhlCoreStats = ['goals', 'assists', 'points', 'shots_on_goal', 'blocks', 'saves'];
exports.nhlSynergy = {
    C: ['points', 'goals', 'shots_on_goal'],
    LW: ['points', 'goals', 'shots_on_goal'],
    RW: ['points', 'goals', 'shots_on_goal'],
    D: ['blocks', 'points', 'shots_on_goal'],
    G: ['saves', 'wins'],
};
// 🆕 NEW: Enhanced NHL Scoring Weights (September 5, 2025)
exports.enhancedNHLWeights = {
    // NEW: Enhanced components based on professional hockey insights
    goalieMatchupAnalysis: 0.12, // Goalie vs team offensive strength - huge factor
    homeIceAdvantage: 0.08, // Last change, crowd, familiarity
    lineMatchupDepth: 0.07, // Specific line vs defensive pairing matchups
    recentFormTrend: 0.06, // Hot/cold streaks very important in NHL
    backToBackImpact: 0.07, // Travel, fatigue, backup goalie situations
    powerPlayOpportunity: 0.06, // PP/PK matchups affect scoring props
    playoffIntensityFactor: 0.05, // Playoff race, rivalry games
    // ADJUSTED: Core features (reduced to make room for new)
    expectedValue: 0.14, // Was 0.22
    lineMovement: 0.06, // Was 0.10
    matchupRating: 0.08, // Was 0.13
    playerForm: 0.05, // Was 0.09
    injuryImpact: 0.04, // Was 0.07
    // Market intelligence (slightly reduced)
    marketIntelligence: 0.09, // Was 0.15
    sharpMoney: 0.06, // Was 0.10
    volumeProfile: 0.04, // Was 0.07
    closingLineValue: 0.07, // Was 0.12
    // Professional features (maintained)
    steamDetection: 0.025,
    closingLinePrediction: 0.020,
    optimalTiming: 0.015,
    lineShoppingEdge: 0.015,
    publicVsSharpSplit: 0.020,
    marketTimingAdvantage: 0.010,
    injuryTimingEdge: 0.010,
    crossMarketDiscrepancy: 0.005,
    // Context (adjusted for NHL)
    playerFatigue: 0.05, // Back-to-backs very common in NHL
    venueAdvantage: 0.05, // Home ice advantage moderate
    refereeImpact: 0.03, // Refs can affect PP/PK calls
    paceImpact: 0.04, // Fast vs slow game impact
    motivationalFactors: 0.03, // Rivalry games matter
    // Risk factors (maintained)
    correlationRisk: 0.09,
    volatility: 0.09, // High volatility in NHL
    portfolioImpact: 0.10,
    // ML ensemble (adjusted for hockey patterns)
    neuralNetwork: 0.12, // Good for complex NHL interactions
    gradientBoosting: 0.18, // Excellent for situational hockey
    randomForest: 0.13, // Good for NHL's many variables
    ensemble: 0.24 // Strong ensemble for NHL complexity
};
// Contextual multipliers for NHL game situations
exports.nhlContextualMultipliers = {
    backToBackGames: 0.8, // Second game of back-to-back
    restAdvantageGames: 1.2, // Team with rest vs tired opponent
    rivalryGames: 1.3, // Division rivals, playoff history
    playoffRace: 1.4, // Late season must-win games
    goalieConfirmation: 1.5, // Known starting goalie vs TBD
    powerPlayMatchups: 1.2, // Elite PP vs poor PK
    homeOpener: 1.2, // Season home opener
    tradedPlayerReturn: 1.1 // Player facing former team
};
// NHL-specific goalie impact factors
exports.nhlGoalieFactors = {
    goalieStrength: {
        elite: 0.7, // Elite goalie reduces scoring props
        average: 1.0, // Average goalie neutral impact
        backup: 1.3, // Backup goalie increases scoring
        poor: 1.5, // Poor goalie major increase
        unknown: 1.1 // Unknown/rookie goalie slight increase
    },
    goalieMatchup: {
        'elite_vs_weak_offense': 0.6, // Dominant goalie vs struggling offense
        'poor_vs_strong_offense': 1.8, // Poor goalie vs high-powered offense
        'backup_vs_rested_offense': 1.4, // Backup goalie vs fresh offensive team
        'tired_goalie_b2b': 1.6, // Tired goalie on back-to-back
        'home_goalie_advantage': 0.9 // Goalie at home with last change
    },
    situationalFactors: {
        newTeam: 1.2, // Goalie with new team (system adjustment)
        revenge: 1.1, // Goalie vs former team
        playoff_experience: 0.9, // Veteran goalie in big games
        rookie_playoff: 1.3 // Rookie goalie in pressure situations
    }
};
// NHL line and pairing analysis
exports.nhlLineMatchups = {
    offensiveLines: {
        'top_line_vs_weak_pairing': 1.4, // Elite line vs poor defense
        'second_line_vs_tired_d': 1.2, // Depth scoring vs tired defense
        'power_play_specialists': 1.3, // PP specialists in PP situations
        'checking_line_vs_skill': 0.8, // Defensive line limiting skill players
        'fourth_line_energy': 1.1 // Energy line in physical games
    },
    defensivePairings: {
        'shutdown_pairing': 0.7, // Elite defensive pairing
        'offensive_dmen': 1.2, // D-men who join rush
        'rookie_dmen': 1.3, // Inexperienced defense
        'injured_dmen': 1.4, // Playing through injury
        'tired_defense_b2b': 1.2 // Defense on back-to-back
    }
};
// NHL special teams impact
exports.nhlSpecialTeamsFactors = {
    powerPlayOpportunity: {
        undisciplinedTeam: 1.3, // Team that takes many penalties
        disciplinedTeam: 0.8, // Team that rarely gives PP chances
        refereeHistory: 1.1, // Ref crew that calls many penalties
        rivalryGame: 1.2, // More penalties in heated games
        playoffRace: 1.4 // Desperate teams take more penalties
    },
    powerPlayEfficiency: {
        'elite_pp_vs_poor_pk': 1.6, // Top PP vs weak PK
        'poor_pp_vs_elite_pk': 0.6, // Weak PP vs strong PK
        'road_power_play': 0.9, // PP efficiency drops on road
        'tired_power_play': 0.8, // PP units tired from travel/b2b
        'key_injury_pp': 0.7 // Missing key PP player
    }
};
