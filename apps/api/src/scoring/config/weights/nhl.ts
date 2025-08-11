/**
 * NHL-specific scoring weights configuration
 * Optimized for hockey with focus on goaltending, special teams, and pace
 */

import { SportSpecificWeights, TierThresholds, RiskManagementConfig, ScoringConfig } from './types';

export const NHL_WEIGHTS: SportSpecificWeights = {
  sport: 'NHL',
  version: '1.0.0',
  description: 'NHL hockey optimized for goaltending, special teams, and game flow',
  lastUpdated: '2025-01-09',
  
  // Core Components (hockey-optimized)
  expectedValue: 0.19,            // Strong EV focus
  lineMovement: 0.11,             // Moderate importance
  matchupRating: 0.14,            // Line matchups and goaltending crucial
  playerForm: 0.09,               // Streaky sport, form matters
  injuryImpact: 0.07,             // Injuries impactful but depth helps
  weatherImpact: 0.0,             // Indoor sport
  
  // Advanced Market Intelligence
  marketIntelligence: 0.13,       // Sharp hockey knowledge valuable
  sharpMoney: 0.08,               // Clear sharp play patterns
  volumeProfile: 0.06,            // Volume patterns moderate
  closingLineValue: 0.11,         // CLV predictive but volatile
  
  // Professional Capper Features
  steamDetection: 0.02,           // Steam moves occur
  closingLinePrediction: 0.015,   // Line closure modeling
  optimalTiming: 0.012,           // Goalie news timing
  lineShoppingEdge: 0.015,        // Line differences exist
  publicVsSharpSplit: 0.018,      // Public biases in hockey
  marketTimingAdvantage: 0.01,    // Moderate timing effects
  injuryTimingEdge: 0.013,        // Lineup news important
  crossMarketDiscrepancy: 0.012,  // Some prop correlations
  
  // Player & Game Context (hockey-specific)
  playerFatigue: 0.025,           // Back-to-backs matter more
  venueAdvantage: 0.02,           // Home ice advantage
  refereeImpact: 0.03,            // Referee penalty tendencies HUGE
  paceImpact: 0.035,              // Game pace affects shot totals
  motivationalFactors: 0.02,      // Playoff race, rivalry games
  
  // Risk & Correlation
  correlationRisk: 0.018,         // Some correlation in props
  volatility: 0.015,              // Moderate volatility
  portfolioImpact: 0.007,         // Portfolio considerations
  
  // ML Model Ensemble
  neuralNetwork: 0.022,           // Good for complex patterns
  gradientBoosting: 0.028,        // Excellent for hockey features
  randomForest: 0.018,            // Handles categories well
  ensemble: 0.032,                // Strong ensemble performance
  
  // Enhanced Capper Features (hockey-optimized)
  handednessSplits: 0.01,         // Some relevance for shots
  recentTrendAnalysis: 0.02,      // Streaky sport
  headToHeadHistory: 0.015,       // Head-to-head matters
  rosterStabilityScore: 0.015,    // Line combinations matter
  bullpenQualityScore: 0.0,       // Not applicable
  advancedSplitAnalysis: 0.025,   // Home/away, vs handedness
  
  // Time-based weights
  last3Weight: 0.4,               // Recent form important
  last7Weight: 0.3,               // Week performance
  last15Weight: 0.2,              // Decent sample size
  last30Weight: 0.1,              // Monthly context
  enhancedWeight: 0.07,           // Enhanced analysis contribution
  
  // Hockey-specific factors  
  sportSpecificFactors: {
    goalieMatchup: 0.04,          // Starting goalie critical
    specialTeamsEdge: 0.03,       // PP/PK unit quality
    restAdvantage: 0.02,          // Days rest difference
    lineChemistry: 0.015,         // Line combination effects
    seasonalTrend: 0.01,          // Season-long trends
  }
};

export const NHL_TIERS: TierThresholds = {
  S_TIER: { minScore: 71, minEdge: 21, maxRisk: 4, minPositionSize: 0.045 },
  A_TIER: { minScore: 51, minEdge: 1, maxRisk: 5, minPositionSize: 0.028 },
  B_TIER: { minScore: 41, maxRisk: 6, minPositionSize: 0.014 },
  C_TIER: { minScore: 31, maxRisk: 7, minPositionSize: 0.005 },
  D_TIER: { description: 'Below quality threshold - rejected' }
};

export const NHL_RISK: RiskManagementConfig = {
  maxPositionSize: 0.05,          // Standard max position
  kellyMultiplier: 0.24,          // Slightly conservative
  maxDrawdown: 0.19,              // Moderate variance tolerance
  maxCorrelation: 0.68,           // Lower correlation tolerance
  minSharpeRatio: 1.1,            // Higher Sharpe requirement
  maxExposurePerSport: 0.30,      // Standard sport exposure
  maxExposurePerPlayer: 0.10,     // Player exposure limit
  maxDailyRisk: 0.15,             // Standard daily risk
  stopLossThreshold: 0.14,        // Moderate stop loss
  maxVaR: 0.048,                  // Slightly lower VaR
  maxCVaR: 0.075                  // Lower CVaR tolerance
};

export const NHL_CONFIG: ScoringConfig = {
  weights: NHL_WEIGHTS,
  tiers: NHL_TIERS,
  risk: NHL_RISK
};