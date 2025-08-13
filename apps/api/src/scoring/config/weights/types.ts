/**
 * Centralized scoring weights types for all sports
 * Ensures type safety and eliminates magic numbers
 */

export interface CoreScoringWeights {
  // Core Components (22 points total)
  expectedValue: number;          // Primary factor - expected value calculation
  lineMovement: number;           // Line movement analysis
  matchupRating: number;          // Team/player matchup rating
  playerForm: number;             // Recent player performance
  injuryImpact: number;           // Injury status impact
  weatherImpact: number;          // Weather conditions impact
  
  // Advanced Market Intelligence (40 points total)
  marketIntelligence: number;     // Market sentiment analysis
  sharpMoney: number;             // Sharp money detection
  volumeProfile: number;          // Betting volume patterns
  closingLineValue: number;       // CLV prediction
  
  // Professional Capper Features (8 points total)
  steamDetection: number;         // Real-time steam move detection
  closingLinePrediction: number;  // Predictive line closure modeling
  optimalTiming: number;          // Hour-to-game edge calculation
  lineShoppingEdge: number;       // Multi-book best line identification
  publicVsSharpSplit: number;     // Contrarian opportunity detection
  marketTimingAdvantage: number;  // Time-decay edge modeling
  injuryTimingEdge: number;       // News break vs line adjustment timing
  crossMarketDiscrepancy: number; // Related prop arbitrage detection
  
  // Player & Game Context (5 points total)
  playerFatigue: number;          // Rest/fatigue impact
  venueAdvantage: number;         // Home/away performance
  refereeImpact: number;          // Official tendencies
  paceImpact: number;             // Game pace effects
  motivationalFactors: number;    // Situational motivation
  
  // Risk & Correlation (3 points total)
  correlationRisk: number;        // Portfolio correlation
  volatility: number;             // Outcome volatility
  portfolioImpact: number;        // Overall portfolio impact
  
  // ML Model Ensemble (4 points total)
  neuralNetwork: number;          // Neural network prediction
  gradientBoosting: number;       // Gradient boosting model
  randomForest: number;           // Random forest model
  ensemble: number;               // Ensemble consensus
}

export interface EnhancedScoringWeights {
  // Enhanced Capper Features (from professional insights)
  handednessSplits: number;       // Handedness analysis (MLB focus)
  recentTrendAnalysis: number;    // Recent trend analysis
  headToHeadHistory: number;      // H2H performance
  rosterStabilityScore: number;   // Team chemistry
  bullpenQualityScore: number;    // Bullpen assessment (MLB)
  advancedSplitAnalysis: number;  // Situational splits
  
  // Time-based weights for trends
  last3Weight: number;            // Recent 3 games weight
  last7Weight: number;            // Last week weight
  last15Weight: number;           // Two weeks weight
  last30Weight: number;           // Month weight
  enhancedWeight: number;         // Enhanced analysis contribution
}

export interface SportSpecificWeights extends CoreScoringWeights, EnhancedScoringWeights {
  sport: string;
  version: string;
  description: string;
  lastUpdated: string;
  
  // Sport-specific modifiers
  sportSpecificFactors?: Record<string, number>;
}

export interface TierThresholds {
  S_TIER: { minScore: number; minEdge: number; maxRisk: number; minPositionSize: number; };
  A_TIER: { minScore: number; minEdge: number; maxRisk: number; minPositionSize: number; };
  B_TIER: { minScore: number; maxRisk: number; minPositionSize: number; };
  C_TIER: { minScore: number; maxRisk: number; minPositionSize: number; };
  D_TIER: { description: string; };
}

export interface RiskManagementConfig {
  maxPositionSize: number;        // 5% max bet
  kellyMultiplier: number;        // 25% Kelly fraction cap
  maxDrawdown: number;            // 20% max drawdown
  maxCorrelation: number;         // 70% correlation limit
  minSharpeRatio: number;         // Minimum Sharpe ratio
  maxExposurePerSport: number;    // Max exposure per sport
  maxExposurePerPlayer: number;   // Max exposure per player
  maxDailyRisk: number;           // Max daily risk
  stopLossThreshold: number;      // Stop loss threshold
  maxVaR: number;                 // Maximum Value at Risk
  maxCVaR: number;                // Maximum Conditional VaR
}

export interface ScoringConfig {
  weights: SportSpecificWeights;
  tiers: TierThresholds;
  risk: RiskManagementConfig;
}

// Validation function to ensure weights sum correctly
export function validateWeights(weights: SportSpecificWeights): boolean {
  // Define the exact fields that should be included in the validation
  // Excluding metadata fields, time-based weights (these are multipliers), and sportSpecificFactors
  const weightFields = [
    // Core Components
    'expectedValue', 'lineMovement', 'matchupRating', 'playerForm', 'injuryImpact', 'weatherImpact',
    // Advanced Market Intelligence  
    'marketIntelligence', 'sharpMoney', 'volumeProfile', 'closingLineValue',
    // Professional Capper Features
    'steamDetection', 'closingLinePrediction', 'optimalTiming', 'lineShoppingEdge',
    'publicVsSharpSplit', 'marketTimingAdvantage', 'injuryTimingEdge', 'crossMarketDiscrepancy',
    // Player & Game Context
    'playerFatigue', 'venueAdvantage', 'refereeImpact', 'paceImpact', 'motivationalFactors',
    // Risk & Correlation
    'correlationRisk', 'volatility', 'portfolioImpact',
    // ML Model Ensemble
    'neuralNetwork', 'gradientBoosting', 'randomForest', 'ensemble',
    // Enhanced Features
    'handednessSplits', 'recentTrendAnalysis', 'headToHeadHistory', 'rosterStabilityScore',
    'bullpenQualityScore', 'advancedSplitAnalysis'
    // NOTE: Excluding time-based weights (last3Weight, etc.) as these are multipliers, not additive weights
  ];
  
  const total = weightFields.reduce((sum, field) => {
    const value = (weights as any)[field];
    return sum + (typeof value === 'number' ? value : 0);
  }, 0);
  
  // Allow some tolerance for floating point arithmetic
  return Math.abs(total - 1.0) < 0.001;
}