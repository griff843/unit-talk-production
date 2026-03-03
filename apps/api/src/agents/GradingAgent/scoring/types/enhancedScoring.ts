/**
 * Enhanced Scoring Types
 * Implements professional capper analysis techniques identified in capper insights analysis
 */

export interface HandednessSplits {
  batterVsLHP: {
    avg: number;
    ops: number;
    hr: number;
    rbi: number;
    strikeouts: number;
    games: number;
  };
  batterVsRHP: {
    avg: number;
    ops: number;
    hr: number;
    rbi: number;
    strikeouts: number;
    games: number;
  };
  pitcherVsLHB: {
    era: number;
    whip: number;
    k_rate: number;
    hr_rate: number;
    games: number;
  };
  pitcherVsRHB: {
    era: number;
    whip: number;
    k_rate: number;
    hr_rate: number;
    games: number;
  };
}

export interface PerformanceMetrics {
  avg?: number;
  ops?: number;
  era?: number;
  whip?: number;
  k_rate?: number;
  hr_rate?: number;
  hits?: number;
  runs?: number;
  rbi?: number;
  strikeouts?: number;
  wins?: number;
  losses?: number;
}

export interface RecentTrends {
  last3Games: PerformanceMetrics;
  last7Games: PerformanceMetrics;
  last15Games: PerformanceMetrics;
  last30Games: PerformanceMetrics;
  trendDirection: 'improving' | 'declining' | 'stable';
  streakType: 'hitting' | 'cold' | 'neutral';
  streakLength: number;
  consistencyScore: number; // 0-100, how consistent performance has been
}

export interface HeadToHeadHistory {
  playerVsPitcher: {
    atBats: number;
    hits: number;
    homeRuns: number;
    strikeouts: number;
    avg: number;
    ops: number;
    lastFaced: Date | null;
  };
  pitcherVsBatter: {
    atBats: number;
    hits: number;
    strikeouts: number;
    homeRuns: number;
    era: number;
    whip: number;
    lastFaced: Date | null;
  };
  recentPerformance: PerformanceMetrics[]; // Last 5 meetings
  advantageDirection: 'batter' | 'pitcher' | 'neutral';
}

export interface RosterStabilityData {
  recentTrades: {
    playersAdded: number;
    playersLost: number;
    keyPlayersAffected: string[];
    tradeDeadlineActivity: boolean;
    daysAgo: number;
  };
  lineupChanges: {
    newStarters: number;
    positionChanges: number;
    battingOrderChanges: number;
    consistencyScore: number;
  };
  chemistryIndicators: {
    newPlayerIntegrationDays: number;
    teamMoraleScore: number;
    recentTeamPerformance: PerformanceMetrics;
    leadershipStability: boolean;
  };
  stabilityScore: number; // 0-100, 100 = very stable
}

export interface BullpenQualityData {
  overallStrength: {
    era: number;
    whip: number;
    k_rate: number;
    saves: number;
    blownSaves: number;
  };
  recentChanges: {
    tradedAway: string[];
    acquired: string[];
    injuries: string[];
    daysAgo: number;
  };
  depthChart: {
    closer: { name: string; era: number; available: boolean };
    setup: { name: string; era: number; available: boolean }[];
    middle: { name: string; era: number; available: boolean }[];
  };
  qualityScore: number; // 0-100, quality relative to league
  fatigueLevel: number; // 0-100, recent usage intensity
}

export interface AdvancedSplits {
  monthly: {
    [month: string]: PerformanceMetrics;
  };
  homeAway: {
    home: PerformanceMetrics;
    away: PerformanceMetrics;
    advantage: 'home' | 'away' | 'neutral';
  };
  parkSpecific: {
    [parkName: string]: PerformanceMetrics;
  };
  situational: {
    dayGame: PerformanceMetrics;
    nightGame: PerformanceMetrics;
    temperature: {
      cold: PerformanceMetrics; // <60F
      moderate: PerformanceMetrics; // 60-80F
      hot: PerformanceMetrics; // >80F
    };
    wind: {
      favorable: PerformanceMetrics; // wind blowing out
      neutral: PerformanceMetrics;
      unfavorable: PerformanceMetrics; // wind blowing in
    };
  };
}

export interface EnhancedScoringWeights {
  // New scoring components
  handednessSplits: number;
  recentTrendAnalysis: number;
  headToHeadHistory: number;
  rosterStabilityScore: number;
  bullpenQualityScore: number;
  advancedSplitAnalysis: number;

  // Existing components (adjusted weights)
  expectedValue: number;
  lineMovement: number;
  matchupRating: number;
  playerForm: number;
  injuryImpact: number;
  weatherImpact: number;
  marketIntelligence: number;
  sharpMoney: number;
  volumeProfile: number;
  closingLineValue: number;

  // Professional features
  steamDetection: number;
  closingLinePrediction: number;
  optimalTiming: number;
  lineShoppingEdge: number;
  publicVsSharpSplit: number;
  marketTimingAdvantage: number;
  injuryTimingEdge: number;
  crossMarketDiscrepancy: number;

  // Context factors
  playerFatigue: number;
  venueAdvantage: number;
  refereeImpact: number;
  paceImpact: number;
  motivationalFactors: number;

  // Risk factors
  correlationRisk: number;
  volatility: number;
  portfolioImpact: number;

  // ML ensemble
  neuralNetwork: number;
  gradientBoosting: number;
  randomForest: number;
  ensemble: number;
}

export interface EnhancedScoringResult {
  // New component scores
  handednessSplitsScore: number;
  recentTrendsScore: number;
  headToHeadScore: number;
  rosterStabilityScore: number;
  bullpenQualityScore: number;
  advancedSplitsScore: number;

  // Component analysis
  handednessAdvantage: 'strong' | 'moderate' | 'slight' | 'neutral' | 'disadvantage';
  trendMomentum: 'hot' | 'warm' | 'neutral' | 'cool' | 'cold';
  historicalEdge:
    | 'strong_batter'
    | 'slight_batter'
    | 'neutral'
    | 'slight_pitcher'
    | 'strong_pitcher';
  teamStability: 'very_stable' | 'stable' | 'moderate' | 'unstable' | 'very_unstable';
  bullpenReliability: 'elite' | 'strong' | 'average' | 'weak' | 'poor';
  situationalEdge: 'strong' | 'moderate' | 'slight' | 'neutral' | 'negative';

  // Overall enhanced professional_score
  enhancedScore: number;
  confidenceLevel: number;
  riskAssessment: 'low' | 'medium' | 'high';

  // Insights for display
  keyFactors: string[];
  warnings: string[];
  recommendations: string[];
}

export interface SportSpecificWeights {
  MLB: EnhancedScoringWeights;
  NBA: EnhancedScoringWeights;
  NFL: EnhancedScoringWeights;
  NHL: EnhancedScoringWeights;
}

// Contextual multipliers based on game situations
export interface ContextualMultipliers {
  deadlineImpact: number; // 1.2x for trade deadline effects
  weatherGames: number; // 1.5x for total props in weather games
  revengeGames: number; // 1.1x for motivational factors
  playoffRace: number; // 1.3x for late season games affecting playoff positioning
  rookieDebut: number; // 1.4x for first-time players or significant role changes
  streakSituations: number; // 1.2x for players on hot/cold streaks
}
