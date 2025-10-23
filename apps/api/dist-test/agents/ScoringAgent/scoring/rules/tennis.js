"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tennisTournamentFactors = exports.tennisPhysicalFactors = exports.tennisMatchupFactors = exports.tennisSurfaceFactors = exports.tennisContextualMultipliers = exports.enhancedTennisWeights = exports.tennisSynergy = exports.tennisCoreStats = void 0;
exports.tennisCoreStats = ['aces', 'double_faults', 'first_serve_percentage', 'break_points_saved', 'games_won'];
exports.tennisSynergy = {
    'serve_and_volley': ['aces', 'first_serve_percentage', 'games_won'],
    'baseline': ['games_won', 'break_points_saved'],
    'all_court': ['aces', 'games_won', 'break_points_saved'],
};
// 🆕 NEW: Enhanced Tennis Scoring Weights (September 5, 2025)
exports.enhancedTennisWeights = {
    // NEW: Enhanced components based on professional tennis insights
    surfaceSpecializationAnalysis: 0.15, // Clay vs Hard vs Grass specialization - massive factor
    headToHeadHistoryDepth: 0.12, // H2H on specific surface and recent encounters
    physicalConditionAssessment: 0.10, // Injury status, recent workload, fitness level
    mentalMomentumAnalysis: 0.09, // Recent form, confidence, pressure handling
    playingStyleMatchup: 0.08, // Serve/volley vs baseline, lefty vs righty
    weatherConditionImpact: 0.07, // Wind, heat, humidity effects on play
    tournamentRankingImpact: 0.06, // Ranking points at stake, motivation levels
    // ADJUSTED: Core features (reduced to make room for new)
    expectedValue: 0.12, // Was 0.22
    lineMovement: 0.05, // Was 0.10
    matchupRating: 0.07, // Was 0.13
    playerForm: 0.04, // Was 0.09 (now separate momentum analysis)
    injuryImpact: 0.03, // Was 0.07 (now separate physical assessment)
    // Market intelligence (adjusted for tennis markets)
    marketIntelligence: 0.06, // Was 0.15
    sharpMoney: 0.04, // Was 0.10
    volumeProfile: 0.03, // Was 0.07
    closingLineValue: 0.05, // Was 0.12
    // Professional features (maintained but adjusted for tennis)
    steamDetection: 0.015,
    closingLinePrediction: 0.012,
    optimalTiming: 0.010,
    lineShoppingEdge: 0.008,
    publicVsSharpSplit: 0.015,
    marketTimingAdvantage: 0.006,
    injuryTimingEdge: 0.008,
    crossMarketDiscrepancy: 0.003,
    // Context (adjusted for tennis)
    playerFatigue: 0.08, // High importance in tennis
    venueAdvantage: 0.04, // Less venue advantage than team sports
    refereeImpact: 0.02, // Umpire impact minimal
    paceImpact: 0.03, // Match pace and rhythm
    motivationalFactors: 0.05, // Grand Slams, ranking implications
    // Risk factors (adjusted for tennis volatility)
    correlationRisk: 0.06, // Lower in individual sport
    volatility: 0.11, // High volatility in tennis
    portfolioImpact: 0.07,
    // ML ensemble (adjusted for tennis patterns)
    neuralNetwork: 0.14, // Excellent for complex tennis patterns
    gradientBoosting: 0.19, // Great for tennis situational factors
    randomForest: 0.13, // Good for tennis feature interactions
    ensemble: 0.24 // Strong ensemble for tennis complexity
};
// Contextual multipliers for tennis match situations
exports.tennisContextualMultipliers = {
    grandSlamMatches: 1.6, // Major tournaments
    masters1000: 1.4, // Top tier events
    atp500: 1.2, // Mid-tier events
    atp250: 1.0, // Regular tour events
    firstRound: 0.9, // Early round unpredictability
    finalWeek: 1.5, // Finals week pressure
    mondayMatch: 0.9, // Monday matches after travel
    nightSession: 1.1, // Prime time matches
    daySession: 1.0, // Regular day matches
    indoorSeason: 1.1, // Indoor hard court season
    clayCourtSeason: 1.3, // Clay court specialization period
    grassCourtSeason: 1.4 // Grass court specialization period
};
// Tennis surface-specific factors
exports.tennisSurfaceFactors = {
    surfaceSpecialization: {
        clay_specialist_on_clay: 1.8, // Clay courter on clay
        grass_specialist_on_grass: 2.0, // Grass specialist on grass
        hard_court_specialist: 1.3, // Hard court all-rounder
        surface_generalist: 1.0, // Plays well on all surfaces
        clay_specialist_on_hard: 0.7, // Clay specialist on hard court
        hard_court_player_on_clay: 0.6 // Hard court player on clay
    },
    surfaceConditions: {
        fast_hard_court: 1.2, // Fast hard courts favor servers
        slow_hard_court: 0.9, // Slow hard courts favor baseliners
        wet_clay: 0.8, // Wet clay very slow
        dry_clay: 1.1, // Dry clay faster
        fast_grass: 1.5, // Fast grass extreme server advantage
        slow_grass: 1.2, // Even slow grass favors servers
        indoor_hard: 1.1, // Controlled conditions
        outdoor_windy: 0.8 // Windy conditions disrupt rhythm
    },
    transitionPeriods: {
        clay_to_grass: 0.8, // Difficult transition
        grass_to_hard: 0.9, // Moderate adjustment needed
        hard_to_clay: 0.9, // Some adjustment needed
        within_surface: 1.1, // Staying on same surface
        surface_expert: 1.3 // Expert on current surface
    }
};
// Tennis head-to-head and matchup factors
exports.tennisMatchupFactors = {
    headToHeadAdvantage: {
        dominant_h2h: 1.4, // 4+ win advantage in H2H
        slight_h2h: 1.2, // 1-3 win advantage
        even_h2h: 1.0, // Even head to head
        slight_deficit: 0.8, // Behind in H2H
        dominated_h2h: 0.6 // Significantly behind in H2H
    },
    playingStyleMatchup: {
        server_vs_returner: 1.3, // Big server vs great returner
        baseliner_vs_serve_volley: 1.2, // Modern baseline vs old school
        power_vs_defense: 1.1, // Power player vs defender
        lefty_vs_righty: 1.1, // Lefty advantage vs right-handers
        tall_vs_short: 1.05, // Height advantage in serving
        young_vs_veteran: 0.95 // Experience vs youth
    },
    mentalFactors: {
        comeback_specialist: 1.2, // Known for comebacks
        front_runner: 1.1, // Plays well when ahead
        pressure_player: 1.3, // Thrives under pressure
        pressure_sensitive: 0.8, // Struggles with pressure
        clutch_performer: 1.4, // Clutch in big moments
        confidence_dependent: 0.9 // Confidence affects performance
    }
};
// Tennis physical and fitness factors
exports.tennisPhysicalFactors = {
    fitnessLevel: {
        elite_fitness: 1.3, // Exceptional physical condition
        good_fitness: 1.1, // Above average fitness
        average_fitness: 1.0, // Standard fitness level
        declining_fitness: 0.9, // Fitness concerns
        injury_concerns: 0.7 // Recent or ongoing injuries
    },
    matchLength: {
        quick_matches: 1.0, // Straight set wins
        three_set_battles: 0.9, // Competitive three setters
        five_set_epics: 0.7, // Marathon five set matches
        tiebreak_specialist: 1.2, // Excellent in tiebreaks
        tiebreak_struggles: 0.8 // Poor tiebreak record
    },
    recoveryFactors: {
        first_match_back: 0.8, // Returning from injury/break
        tournament_rust: 0.9, // Early in tournament
        match_rhythm: 1.1, // In good match rhythm
        fatigue_concern: 0.8, // Physical fatigue evident
        peak_condition: 1.2 // At physical peak
    }
};
// Tennis tournament and scheduling factors
exports.tennisTournamentFactors = {
    tournamentImportance: {
        grand_slam: 1.8, // Major tournaments
        masters_mandatory: 1.5, // Masters 1000 events
        masters_optional: 1.3, // Optional Masters events
        atp500: 1.2, // 500 level events
        atp250: 1.0, // Regular tour events
        exhibition: 0.7 // Exhibition matches
    },
    schedulingAdvantage: {
        rested_vs_tired: 1.3, // Rested player vs tired opponent
        both_rested: 1.0, // Both players well rested
        both_tired: 0.9, // Both players tired
        back_to_back: 0.8, // Back-to-back day matches
        favorable_schedule: 1.1, // Good scheduling luck
        difficult_schedule: 0.9 // Challenging schedule
    },
    weatherImpact: {
        extreme_heat: 0.8, // Very hot conditions
        windy_conditions: 0.7, // High winds
        perfect_conditions: 1.1, // Ideal playing conditions
        indoor: 1.05, // Controlled indoor environment
        altitude: 0.9, // High altitude effects
        humidity: 0.9 // High humidity effects
    }
};
