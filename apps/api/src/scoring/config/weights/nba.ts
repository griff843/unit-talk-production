/**
 * NBA-specific scoring weights configuration
 * Optimized for basketball player props with focus on pace, matchups, and player form
 */

import { SportSpecificWeights, TierThresholds, RiskManagementConfig, ScoringConfig } from './types';

export const NBA_WEIGHTS: SportSpecificWeights = {
  sport: 'NBA',
  version: '1.0.0',
  description: 'NBA basketball optimized for player props with pace and usage rate focus - NORMALIZED TO 1.0',
  lastUpdated: '2025-08-12',
  
  // Core Components (optimized for basketball) - NORMALIZED
  expectedValue: 0.1307,            // Strong EV focus for NBA
  lineMovement: 0.0784,             // Important in NBA due to news sensitivity
  matchupRating: 0.0980,            // Critical for player props vs defense
  playerForm: 0.0784,               // Recent performance very important
  injuryImpact: 0.0523,             // High impact due to pace/usage changes
  weatherImpact: 0.0,               // Indoor sport - no weather impact
  
  // Advanced Market Intelligence
  marketIntelligence: 0.0915,       // Sharp NBA market intelligence
  sharpMoney: 0.0588,               // Clear sharp/public splits
  volumeProfile: 0.0392,            // Volume patterns matter
  closingLineValue: 0.0719,         // Strong CLV predictive power
  
  // Professional Capper Features
  steamDetection: 0.0131,           // Steam moves common in NBA
  closingLinePrediction: 0.0098,    // Line closure modeling
  optimalTiming: 0.0065,            // Injury news timing critical
  lineShoppingEdge: 0.0098,         // Multiple book advantage
  publicVsSharpSplit: 0.0131,       // Clear contrarian opportunities
  marketTimingAdvantage: 0.0065,    // Time decay effects
  injuryTimingEdge: 0.0098,         // Breaking news impact
  crossMarketDiscrepancy: 0.0065,   // Correlated prop opportunities
  
  // Player & Game Context (NBA-specific)
  playerFatigue: 0.0196,            // Back-to-back games matter
  venueAdvantage: 0.0131,           // Home court advantage
  refereeImpact: 0.0131,            // Referee tendencies on totals
  paceImpact: 0.0261,               // CRITICAL in NBA - pace affects all props
  motivationalFactors: 0.0131,      // Playoff push, rest games
  
  // Risk & Correlation
  correlationRisk: 0.0098,          // Player props can be correlated
  volatility: 0.0065,               // NBA has moderate volatility
  portfolioImpact: 0.0033,          // Portfolio balance
  
  // ML Model Ensemble
  neuralNetwork: 0.0163,            // Neural network for complex patterns
  gradientBoosting: 0.0196,         // Strong for NBA feature interactions
  randomForest: 0.0131,             // Tree-based models work well
  ensemble: 0.0229,                 // Ensemble of models
  
  // Enhanced Capper Features (NBA-optimized)
  handednessSplits: 0.0033,         // Less relevant in basketball
  recentTrendAnalysis: 0.0163,      // Hot/cold streaks matter
  headToHeadHistory: 0.0098,        // Matchup history
  rosterStabilityScore: 0.0065,     // Lineup consistency
  bullpenQualityScore: 0.0,         // N/A for basketball
  advancedSplitAnalysis: 0.0131,    // Home/away, vs position splits
  
  // Time-based weights
  last3Weight: 0.2614,              // Recent games heavily weighted
  last7Weight: 0.1961,              // Last week performance
  last15Weight: 0.1307,             // Two weeks context
  last30Weight: 0.0654,             // Monthly baseline
  enhancedWeight: 0.0523,           // Enhanced analysis contribution
  
  // NBA-specific factors
  sportSpecificFactors: {
    usageRate: 0.0196,              // Player usage rate impact
    paceAdjustment: 0.0131,         // Pace-adjusted statistics
    restAdvantage: 0.0098,          // Days rest differential
    travelFatigue: 0.0065,          // Travel schedule impact
  }
};

export const NBA_TIERS: TierThresholds = {
  S_TIER: { minScore: 75, minEdge: 25, maxRisk: 3, minPositionSize: 0.05 },
  A_TIER: { minScore: 55, minEdge: 5, maxRisk: 4, minPositionSize: 0.03 },
  B_TIER: { minScore: 45, maxRisk: 5, minPositionSize: 0.015 },
  C_TIER: { minScore: 35, maxRisk: 6, minPositionSize: 0.005 },
  D_TIER: { description: 'Below quality threshold - rejected' }
};

export const NBA_RISK: RiskManagementConfig = {
  maxPositionSize: 0.06,          // Slightly higher for NBA liquidity
  kellyMultiplier: 0.25,          // Standard Kelly multiplier
  maxDrawdown: 0.18,              // Tighter drawdown control
  maxCorrelation: 0.65,           // Lower correlation tolerance
  minSharpeRatio: 1.2,            // Higher Sharpe requirement
  maxExposurePerSport: 0.35,      // Higher NBA exposure allowed
  maxExposurePerPlayer: 0.12,     // Player-specific exposure
  maxDailyRisk: 0.15,             // Daily risk limit
  stopLossThreshold: 0.12,        // Stop loss threshold
  maxVaR: 0.04,                   // Value at Risk limit
  maxCVaR: 0.07                   // Conditional VaR limit
};

export const NBA_CONFIG: ScoringConfig = {
  weights: NBA_WEIGHTS,
  tiers: NBA_TIERS,
  risk: NBA_RISK
};