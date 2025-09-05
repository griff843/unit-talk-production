export const ncaafCoreStats = [
  'passing_yards', 'passing_tds', 'rushing_yards', 'rushing_tds',
  'receiving_yards', 'receiving_tds', 'receptions', 'completions', 'interceptions'
];
export const ncaafSynergy: Record<string, string[]> = {
  QB: ['passing_yards', 'passing_tds', 'completions', 'interceptions'],
  RB: ['rushing_yards', 'rushing_tds', 'receptions'],
  WR: ['receiving_yards', 'receiving_tds', 'receptions'],
  TE: ['receiving_yards', 'receiving_tds', 'receptions'],
  DEF: ['sacks', 'interceptions', 'defensive_tds'],
};

// 🆕 NEW: Enhanced NCAAF Scoring Weights (September 5, 2025)
export const enhancedNCAAFWeights = {
  // NEW: Enhanced components based on professional college football insights
  talentDiscrepancyAnalysis: 0.12, // Recruiting rankings and talent gaps between teams
  motivationalGameFactor: 0.10,    // Rivalry games, bowl eligibility, playoff implications
  coachingMatchupAnalysis: 0.09,   // Head coach vs head coach historical performance
  weatherImpactAssessment: 0.08,   // College stadiums more weather-exposed
  homeFieldAdvantageDepth: 0.08,   // College crowds more impactful than pro
  lookAheadConcern: 0.07,         // Teams looking past opponents to bigger games
  injuryDepthImpact: 0.06,        // Smaller rosters, less depth than NFL

  // ADJUSTED: Core features (reduced to make room for new)
  expectedValue: 0.13,             // Was 0.22
  lineMovement: 0.05,              // Was 0.10
  matchupRating: 0.08,             // Was 0.13
  playerForm: 0.04,                // Was 0.09
  injuryImpact: 0.03,              // Was 0.07 (separate depth analysis above)

  // Market intelligence (reduced for college markets)
  marketIntelligence: 0.07,        // Was 0.15
  sharpMoney: 0.04,                // Was 0.10
  volumeProfile: 0.03,             // Was 0.07
  closingLineValue: 0.06,          // Was 0.12

  // Professional features (maintained but adjusted)
  steamDetection: 0.020,
  closingLinePrediction: 0.015,
  optimalTiming: 0.012,
  lineShoppingEdge: 0.010,
  publicVsSharpSplit: 0.025,       // Higher in college (more public betting)
  marketTimingAdvantage: 0.008,
  injuryTimingEdge: 0.010,
  crossMarketDiscrepancy: 0.005,

  // Context (adjusted for NCAAF)
  playerFatigue: 0.03,             // Less relevant in weekly college games
  venueAdvantage: 0.08,            // Higher than NFL (college atmosphere)
  refereeImpact: 0.03,             // Conference refs, different rule interpretations
  paceImpact: 0.06,                // Wide variety of offensive styles
  motivationalFactors: 0.07,       // Higher than pros (rivalry, bowl games)

  // Risk factors (adjusted for college volatility)
  correlationRisk: 0.10,           // Higher correlation in college
  volatility: 0.12,                // Much higher volatility than pros
  portfolioImpact: 0.09,

  // ML ensemble (adjusted for college patterns)
  neuralNetwork: 0.11,             // Good for complex college interactions
  gradientBoosting: 0.22,          // Excellent for situational college football
  randomForest: 0.14,              // Good for many college variables
  ensemble: 0.25                   // Strong ensemble for college complexity
};

// Contextual multipliers for NCAAF game situations
export const ncaafContextualMultipliers = {
  rivalryGames: 1.8,               // Huge factor in college football
  bowlEligibilityGame: 1.6,        // 6th win for bowl eligibility
  playoffImplications: 2.0,        // College Football Playoff implications
  conferenceChampionship: 1.7,     // Conference title games
  homecomingGame: 1.3,             // Homecoming games
  seniorNight: 1.2,                // Senior night emotional factor
  lookAheadSpot: 0.7,              // Team looking ahead to bigger game
  trapGame: 0.8,                   // Good team vs bad team after big win
  revengeGame: 1.4,                // Rematch of previous season loss
  weatherGames: 1.8,               // Weather more impactful in college
  primetime: 1.3,                  // College GameDay, national TV
  offWeek: 1.2,                    // Team coming off bye week
  shortWeek: 0.9                   // Tuesday/Wednesday games
};

// NCAAF-specific talent and coaching factors
export const ncaafTalentFactors = {
  recruitingAdvantage: {
    massive: 1.8,        // 5-star vs 2-star talent gaps
    significant: 1.4,    // Clear talent advantage
    moderate: 1.2,       // Some talent edge
    minimal: 1.0,        // Even talent levels
    disadvantage: 0.8    // Talent disadvantage
  },

  coachingExperience: {
    elite_vs_inexperienced: 1.5,    // Top coach vs rookie coach
    experienced_vs_rookie: 1.3,     // Veteran vs new coach
    program_builder: 1.2,           // Coach known for building programs
    coordinator_promotion: 0.9,     // Coordinator promoted to head coach
    interim_coach: 0.8,             // Interim head coach situation
    hot_seat: 0.9                   // Coach on hot seat, desperate
  },

  programStability: {
    established_powerhouse: 1.2,     // Traditional powers (Alabama, Ohio State)
    rising_program: 1.1,            // Programs on the upswing
    stable_program: 1.0,            // Consistent mid-tier programs
    rebuilding: 0.9,                // Programs in rebuild mode
    chaos: 0.7                      // Programs with major instability
  }
};

// NCAAF conference and schedule factors
export const ncaafConferenceFactors = {
  conferenceStrength: {
    SEC: 1.15,           // Strongest conference depth
    Big10: 1.10,         // Strong conference
    ACC: 1.05,           // Above average
    Big12: 1.05,         // Above average
    Pac12: 1.0,          // Average
    other: 0.95          // Weaker conferences
  },

  scheduleSpot: {
    conference_opener: 1.2,          // First conference game
    cross_division: 1.1,            // Playing opposite division
    out_of_conference: 0.9,         // Non-conference game
    season_opener: 1.3,             // First game of season
    season_finale: 1.4,             // Regular season finale, rivalry
    postBye: 1.2,                   // Coming off bye week
    third_straight_road: 0.8,       // Third consecutive road game
    homestand_finale: 0.9           // End of long homestand
  },

  travelFactors: {
    cross_country: 0.9,             // Coast to coast travel
    timezone_change: 0.95,          // Crossing time zones
    neutral_site: 1.0,              // Neutral site games
    short_turnaround: 0.8,          // Short rest between games
    long_travel: 0.9                // Unusual travel situations
  }
};

// NCAAF weather and venue factors
export const ncaafWeatherFactors = {
  weatherImpact: {
    dome: 1.0,           // Indoor games
    mild: 1.0,           // Perfect conditions
    windy: 0.9,          // High winds
    rain: 0.8,           // Wet conditions
    snow: 0.7,           // Snow games
    extreme_cold: 0.8,   // Very cold weather
    extreme_heat: 0.9    // Very hot weather
  },

  venueFactors: {
    big_house: 1.3,      // Michigan Stadium, huge crowds
    death_valley: 1.4,   // LSU, Clemson - intimidating venues
    altitude: 1.2,       // High altitude games (Air Force, etc.)
    hostile_environment: 1.3, // Known difficult road venues
    neutral_site_bowl: 1.0,   // Bowl games, neutral crowds
    small_crowd: 0.9,         // Games with small attendance
    student_section: 1.2      // Strong student section presence
  },

  gameTimingImpact: {
    early_kickoff: 0.95,      // 11 AM kickoffs
    afternoon: 1.0,           // Normal afternoon games
    primetime: 1.2,           // 7-8 PM kickoffs
    late_night: 1.1,          // West coast late games
    college_gameday: 1.3,     // ESPN College GameDay presence
    conference_showcase: 1.2   // Marquee conference games
  }
};