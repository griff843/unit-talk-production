export const nflCoreStats = [
  'passing_yards', 'passing_tds', 'rushing_yards', 'rushing_tds',
  'receiving_yards', 'receiving_tds', 'receptions', 'completions', 'interceptions'
];
export const nflSynergy: Record<string, string[]> = {
  QB: ['passing_yards', 'passing_tds', 'completions', 'interceptions'],
  RB: ['rushing_yards', 'rushing_tds', 'receptions'],
  WR: ['receiving_yards', 'receiving_tds', 'receptions'],
  TE: ['receiving_yards', 'receiving_tds', 'receptions'],
  DEF: ['sacks', 'interceptions', 'defensive_tds'],
};

// 🆕 NEW: Enhanced NFL Scoring Weights (September 5, 2025)
export const enhancedNFLWeights = {
  // NEW: Enhanced components based on professional football insights
  weatherImpactAnalysis: 0.10,     // Wind, rain, cold - major NFL factors
  divisionalRivalryFactor: 0.08,   // Division games have unique dynamics
  injuryReportAnalysis: 0.09,      // NFL injury reports are public and critical
  offensiveLineHealth: 0.07,       // O-line injuries massively impact QB/RB props
  defenseVsPositionRanking: 0.08,  // Matchup-specific defensive rankings
  recentGameScript: 0.06,          // Team tendency in close/blowout games
  homeFieldAdvantage: 0.06,        // Stronger in NFL than other sports

  // ADJUSTED: Core features (reduced to make room for new)
  expectedValue: 0.15,             // Was 0.22
  lineMovement: 0.06,              // Was 0.10
  matchupRating: 0.09,             // Was 0.13
  playerForm: 0.05,                // Was 0.09
  injuryImpact: 0.04,              // Was 0.07 (now separate analysis above)

  // Market intelligence (slightly reduced)
  marketIntelligence: 0.10,        // Was 0.15
  sharpMoney: 0.06,                // Was 0.10
  volumeProfile: 0.04,             // Was 0.07
  closingLineValue: 0.08,          // Was 0.12

  // Professional features (maintained)
  steamDetection: 0.025,
  closingLinePrediction: 0.020,
  optimalTiming: 0.015,
  lineShoppingEdge: 0.015,
  publicVsSharpSplit: 0.020,
  marketTimingAdvantage: 0.010,
  injuryTimingEdge: 0.015,         // Increased for NFL (injury report timing)
  crossMarketDiscrepancy: 0.005,

  // Context (adjusted for NFL)
  playerFatigue: 0.02,             // Less relevant in weekly NFL games
  venueAdvantage: 0.06,            // High for NFL (weather, altitude, noise)
  refereeImpact: 0.02,             // Moderate impact in NFL
  paceImpact: 0.05,                // Game script and tempo important
  motivationalFactors: 0.04,       // Higher for division/playoff games

  // Risk factors (maintained)
  correlationRisk: 0.09,
  volatility: 0.08,                // Higher volatility in weekly NFL
  portfolioImpact: 0.10,

  // ML ensemble (adjusted for football patterns)
  neuralNetwork: 0.13,             // Reduced for NFL weekly variance
  gradientBoosting: 0.20,          // Increased for NFL situation-dependent outcomes
  randomForest: 0.12,              // Good for NFL feature interactions
  ensemble: 0.23                   // Increased for NFL complexity
};

// Contextual multipliers for NFL game situations
export const nflContextualMultipliers = {
  divisionGames: 1.4,              // Division rivals know each other well
  primeTimeGames: 1.2,             // Monday/Thursday night variance
  weatherGames: 1.6,               // Rain, snow, wind major factors
  playoffImplications: 1.5,        // Win-and-in scenarios
  revengeGames: 1.3,               // Playoff rematches, coaching changes
  roadFavorites: 1.1,              // Unusual situations
  largeSpreadGames: 0.8,           // Blowout risk and garbage time
  shortWeekGames: 1.2              // Thursday night after Sunday games
};

// NFL-specific weather impact thresholds
export const nflWeatherThresholds = {
  windImpact: {
    moderate: 15,        // 15+ mph affects passing
    severe: 25,          // 25+ mph major impact
    extreme: 35          // 35+ mph game-changing
  },
  temperatureImpact: {
    cold: 32,           // Freezing affects ball handling
    veryCold: 20,       // Extreme cold major impact
    hot: 90,            // Heat affects conditioning
    veryHot: 100        // Extreme heat major impact
  },
  precipitationImpact: {
    light: 0.1,         // Light rain minimal impact
    moderate: 0.5,      // Moderate rain affects passing/kicking
    heavy: 1.0          // Heavy rain/snow major impact
  }
};

// NFL position-specific matchup factors
export const nflPositionMatchups = {
  'QB_vs_pass_rush': 0.9,          // Strong pass rush vs QB props
  'RB_vs_run_defense': 1.2,        // Weak run D vs RB props
  'WR_vs_coverage': 1.15,          // WR vs specific coverage type
  'TE_vs_linebacker': 1.1,         // TE mismatches vs LBs
  'K_in_weather': 0.8,             // Kicker props in bad weather
  'DEF_vs_turnovers': 1.3          // Turnover-prone offense vs opportunistic defense
};

// NFL game script analysis
export const nflGameScriptFactors = {
  passingGameScript: {
    heavyFavorite: 0.9,      // Likely to run more in blowout
    lightFavorite: 1.1,      // Balanced attack
    underdog: 1.2,           // Likely need to pass more
    heavyUnderdog: 1.4       // Desperate passing situations
  },
  rushingGameScript: {
    heavyFavorite: 1.3,      // Run to kill clock
    lightFavorite: 1.1,      // Balanced approach
    underdog: 0.9,           // Less rushing opportunity
    heavyUnderdog: 0.7       // Abandoning run game
  },
  defenseGameScript: {
    favoriteDefense: 1.2,    // More opportunities for stops/turnovers
    underdogDefense: 0.9     // Likely to be on field more, worse spots
  }
};
