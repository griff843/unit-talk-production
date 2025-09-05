export const wnbaCoreStats = ['points', 'rebounds', 'assists', '3PM', 'steals', 'blocks'];
export const wnbaSynergy: Record<string, string[]> = {
  PG: ['assists', 'points', '3PM', 'steals'],
  SG: ['points', '3PM', 'steals'],
  SF: ['points', 'rebounds', 'steals'],
  PF: ['rebounds', 'blocks', 'points'],
  C: ['rebounds', 'blocks', 'points'],
};

// 🆕 NEW: Enhanced WNBA Scoring Weights (September 5, 2025)
export const enhancedWNBAWeights = {
  // NEW: Enhanced components based on professional women's basketball insights
  olympicImpactAnalysis: 0.08,     // Olympic years and player selection impacts
  internationalScheduling: 0.07,   // FIBA, EuroLeague commitments affecting availability
  shortenedSeasonImpact: 0.06,     // Condensed schedule vs NBA, higher intensity
  rolePlayerOpportunity: 0.07,     // Injury replacements get major minutes/shots
  veteranLeadershipFactor: 0.05,   // Veteran presence more impactful in WNBA
  homeCourtAdvantage: 0.06,        // Strong home crowds in WNBA
  recentFormAnalysis: 0.06,        // Performance over last 3/5/10 games

  // ADJUSTED: Core features (adjusted for WNBA scale and dynamics)
  expectedValue: 0.15,             // Was 0.22
  lineMovement: 0.06,              // Was 0.10
  matchupRating: 0.09,             // Was 0.13
  playerForm: 0.05,                // Was 0.09
  injuryImpact: 0.06,              // Higher impact in smaller rosters

  // Market intelligence (adjusted for smaller WNBA markets)
  marketIntelligence: 0.08,        // Was 0.15
  sharpMoney: 0.05,                // Was 0.10
  volumeProfile: 0.03,             // Was 0.07
  closingLineValue: 0.07,          // Was 0.12

  // Professional features (maintained but adjusted)
  steamDetection: 0.020,
  closingLinePrediction: 0.015,
  optimalTiming: 0.012,
  lineShoppingEdge: 0.010,
  publicVsSharpSplit: 0.015,
  marketTimingAdvantage: 0.008,
  injuryTimingEdge: 0.012,
  crossMarketDiscrepancy: 0.003,

  // Context (adjusted for WNBA)
  playerFatigue: 0.07,             // Higher due to smaller rosters, more minutes
  venueAdvantage: 0.06,            // Strong home court advantages
  refereeImpact: 0.03,             // Moderate impact
  paceImpact: 0.04,                // Game pace important
  motivationalFactors: 0.04,       // Playoff race, rivalry games

  // Risk factors (adjusted for WNBA volatility)
  correlationRisk: 0.08,
  volatility: 0.10,                // Higher volatility due to smaller sample sizes
  portfolioImpact: 0.09,

  // ML ensemble (adjusted for WNBA patterns)
  neuralNetwork: 0.13,             // Good for complex interactions
  gradientBoosting: 0.18,          // Excellent for situational basketball
  randomForest: 0.12,              // Good for feature interactions
  ensemble: 0.22                   // Strong ensemble approach
};

// Contextual multipliers for WNBA game situations
export const wnbaContextualMultipliers = {
  olympicYear: 1.3,                // Olympic selection and preparation impact
  internationalBreaks: 1.2,       // Players returning from overseas commitments
  playoffRace: 1.5,               // Intense playoff races with smaller field
  rookieShowcase: 1.2,            // Rookie of the year races, draft positioning
  veteranMilestones: 1.1,         // Career milestone games
  rivalryGames: 1.2,              // Historic team rivalries
  commissionersCup: 1.1,          // Special tournament games
  homecomingGames: 1.1            // Players returning to former cities
};

// WNBA-specific role impact factors
export const wnbaRoleFactors = {
  roleExpansion: {
    injuryReplacement: 1.4,        // Player getting expanded role due to injury
    rookieOpportunity: 1.3,        // Rookie getting first major opportunity
    veteranDecline: 1.2,           // Younger player taking over from veteran
    tradeAcquisition: 1.1,         // New player fitting into system
    coachingChange: 1.2            // Role changes under new coaching staff
  },

  experienceFactors: {
    playoff_rookie: 0.9,           // First playoff experience
    veteran_leadership: 1.1,       // Veteran in crucial games
    olympic_experience: 1.2,       // Olympic veterans in pressure situations
    international_experience: 1.1, // International play experience
    college_rivalry: 1.1           // Former college rivals facing off
  },

  situationalPerformance: {
    clutchTime: 1.2,               // Fourth quarter performance
    blowoutGames: 0.8,             // Garbage time concerns
    backToBack: 0.9,               // Second game of back-to-back
    travelGames: 0.95,             // Long travel situations
    primetime: 1.1                 // National TV games
  }
};

// WNBA pace and style factors
export const wnbaPaceFactors = {
  paceWeights: {
    veryFast: 1.2,      // High-tempo teams
    fast: 1.1,          // Above average pace
    average: 1.0,       // League average
    slow: 0.9,          // Below average pace
    verySlow: 0.8       // Slow, methodical teams
  },

  styleMatchups: {
    uptempo_vs_uptempo: 1.3,       // High-scoring affairs
    uptempo_vs_halfcourt: 1.0,     // Style clash neutralizes
    halfcourt_vs_halfcourt: 0.8,   // Lower scoring games
    threePointHeavy: 1.15,         // Teams that rely on three-point shooting
    inside_focused: 1.1,           // Post-heavy offensive teams
    transition_heavy: 1.2          // Teams that score in transition
  },

  scheduling: {
    shortRest: 0.9,      // Less than 2 days rest
    normalRest: 1.0,     // 2-3 days rest
    longRest: 1.1,       // 4+ days rest
    seasonStart: 1.1,    // First 10 games of season
    seasonEnd: 1.2,      // Final 10 games with playoff implications
    allStarBreak: 0.95   // Games immediately after All-Star break
  }
};

// WNBA coaching and system factors
export const wnbaCoachingFactors = {
  coachingStyles: {
    offensive_minded: 1.1,         // Coaches who emphasize scoring
    defensive_minded: 0.9,         // Defense-first coaching approach
    player_development: 1.05,      // Coaches known for developing talent
    veteran_management: 1.0,       // Experience managing veteran players
    timeout_usage: 1.05            // Strategic timeout usage
  },

  systemFit: {
    new_system: 0.95,              // Player adjusting to new system
    perfect_fit: 1.15,             // Player ideal for team's system
    role_mismatch: 0.85,           // Player forced into uncomfortable role
    position_versatility: 1.1,     // Players who can play multiple positions
    chemistry_building: 1.05       // Team building chemistry mid-season
  }
};